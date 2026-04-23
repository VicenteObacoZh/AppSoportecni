const express = require('express');
const mockData = require('../data/mockDashboard');
const { getSession, updateSession } = require('../services/sessionStore');
const {
  fetchPlatform,
  sendMonitorCommand,
  saveMonitorMeta,
  fetchConfigurationDeviceMeta,
  saveConfigurationDevice
} = require('../services/platformClient');
const config = require('../config');
const geocodeCacheService = require('../services/geocodeCacheService');
const { createShareToken } = require('../services/shareTokenStore');

const router = express.Router();

function pickAddress(item) {
  const candidates = [
    item?.address,
    item?.Address,
    item?.direccion,
    item?.Direccion,
    item?.location,
    item?.Location,
    item?.locationAddress,
    item?.LocationAddress,
    item?.formattedAddress,
    item?.FormattedAddress,
    item?.streetAddress,
    item?.StreetAddress,
    item?.lastAddress,
    item?.LastAddress,
    item?.fullAddress,
    item?.FullAddress,
    item?.descripcionDireccion,
    item?.DescripcionDireccion,
    item?.direccionTexto,
    item?.DireccionTexto,
    item?.position?.address,
    item?.Position?.address
  ];

  const found = candidates.find((value) => String(value || '').trim().length > 0);
  return found ? String(found).trim() : null;
}

function isCoordinateAddressText(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }

  // Matches "lat, lon" style values commonly returned as fallback.
  return /^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(text);
}

function normalizeCoordinatePair(item) {
  const lat = Number(item?.lat ?? item?.latitude ?? item?.Lat ?? item?.Latitude);
  const lon = Number(item?.lon ?? item?.longitude ?? item?.Lon ?? item?.Longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return { lat, lon };
}

async function fillMissingAddresses(items = []) {
  if (!config.geocodeEnabled || !Array.isArray(items) || items.length === 0) {
    return;
  }

  const eligible = [];
  const seen = new Set();

  items.forEach((item) => {
    const pair = normalizeCoordinatePair(item);
    if (!pair) {
      return;
    }

    const rawAddress = String(item?.address || '').trim();
    const hasUsableAddress = rawAddress && !isCoordinateAddressText(rawAddress);
    if (hasUsableAddress) {
      return;
    }

    const key = geocodeCacheService.buildCoordinateKey(pair.lat, pair.lon);
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    eligible.push({ key, lat: pair.lat, lon: pair.lon });
  });

  const limited = eligible.slice(0, config.geocodeMaxPerRequest);
  if (!limited.length) {
    return;
  }

  const unresolved = [];
  const resolvedByKey = new Map();

  for (const target of limited) {
    const cachedAddress = await geocodeCacheService.getCachedAddressAsync(target.lat, target.lon);
    if (cachedAddress) {
      resolvedByKey.set(target.key, cachedAddress);
    } else {
      unresolved.push(target);
    }
  }

  if (!resolvedByKey.size) {
    return;
  }

  items.forEach((item) => {
    const pair = normalizeCoordinatePair(item);
    if (!pair) {
      return;
    }

    const rawAddress = String(item?.address || '').trim();
    const hasUsableAddress = rawAddress && !isCoordinateAddressText(rawAddress);
    if (hasUsableAddress) {
      return;
    }

    const key = geocodeCacheService.buildCoordinateKey(pair.lat, pair.lon);
    const resolved = key ? resolvedByKey.get(key) : null;
    if (resolved) {
      item.address = resolved;
    }
  });

  // Queue missing points for async geocoding without delaying response.
  unresolved.forEach((target) => {
    geocodeCacheService.warmAddressAsync(target.lat, target.lon);
  });
}

function respondMissingSessionId(res) {
  return res.status(400).json({
    ok: false,
    code: 'SESSION_REQUIRED',
    message: 'sessionId es obligatorio.'
  });
}

function respondSessionNotFound(res) {
  return res.status(404).json({
    ok: false,
    code: 'SESSION_NOT_FOUND',
    message: 'Sesion valida no encontrada.'
  });
}

function hasLiveCookies(session) {
  return Array.isArray(session?.cookies) && session.cookies.length > 0;
}

function looksLikePortalLogin(text) {
  return (
    String(text || '').includes('Iniciar sesi') ||
    String(text || '').includes('class="login-form"') ||
    String(text || '').includes('placeholder="Correo electr')
  );
}

function extractHtmlTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? String(match[1]).replace(/\s+/g, ' ').trim() : null;
}

function extractInterestingSnippets(html, terms = []) {
  const source = String(html || '');
  const snippets = [];

  terms
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .forEach((term) => {
      const index = source.toLowerCase().indexOf(term.toLowerCase());
      if (index < 0) {
        return;
      }

      const start = Math.max(0, index - 160);
      const end = Math.min(source.length, index + 220);
      const snippet = source
        .slice(start, end)
        .replace(/\s+/g, ' ')
        .trim();

      snippets.push({
        term,
        snippet
      });
    });

  return snippets;
}

function extractMatchingLinks(html, terms = []) {
  const source = String(html || '');
  const matches = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let found;

  while ((found = regex.exec(source)) !== null) {
    const href = String(found[1] || '').trim();
    const text = String(found[2] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const combined = `${href} ${text}`.toLowerCase();

    if (terms.some((term) => combined.includes(String(term || '').trim().toLowerCase()))) {
      matches.push({ href, text });
    }
  }

  return matches.slice(0, 20);
}

function extractRequestVerificationToken(html) {
  const source = String(html || '');
  const patterns = [
    /<input[^>]*name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["'][^>]*>/i,
    /<input[^>]*value=["']([^"']+)["'][^>]*name=["']__RequestVerificationToken["'][^>]*>/i
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }

  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}

function normalizeCookies(setCookieHeaders) {
  return (setCookieHeaders || [])
    .map((item) => String(item || '').split(';')[0].trim())
    .filter(Boolean);
}

function mergeCookies(...cookieLists) {
  return [...new Set(cookieLists.flat().filter(Boolean))];
}

function buildPlatformUrl(path = '/') {
  const baseUrl = String(config.platformBaseUrl || '').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function fetchPlatformBinary(path = '/', options = {}) {
  const response = await fetch(buildPlatformUrl(path), {
    method: options.method || 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': 'GpsRastreo-Backend/0.1',
      ...(options.headers || {})
    },
    body: options.body
  });

  const body = Buffer.from(await response.arrayBuffer());
  const contentType = String(response.headers.get('content-type') || '');

  return {
    ok: response.ok,
    status: response.status,
    body,
    text: body.toString('utf8'),
    contentType,
    location: response.headers.get('location'),
    cookies: normalizeCookies(getSetCookieHeaders(response))
  };
}

function safeReportFileName(title, fallback = 'reporte') {
  const normalized = String(title || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ');

  return normalized || fallback;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function toDecimalOrNull(value) {
  const normalized = String(value || '').trim().replace(',', '.');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseFuelReportHtml(html) {
  const source = String(html || '');
  const totalMatch = source.match(/Total estimado:\s*([\d.,]+)\s*gal\s*\(([\d.,]+)\s*L\)/i);
  const distanceMatch = source.match(/Distancia total:\s*([\d.,]+)\s*km/i);
  const rangeMatch = source.match(/Rango:\s*([^<\r\n]+)/i);
  const modeMatch = source.match(/Modo:\s*([^<\r\n]+)/i);

  const rowMatches = [...source.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  let detail = null;

  for (const rowMatch of rowMatches) {
    const cellMatches = [...String(rowMatch[1] || '').matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
    const cells = cellMatches.map((item) => stripHtml(item[1]));

    if (cells.length >= 10 && !/dispositivo/i.test(cells[0])) {
      detail = {
        deviceName: cells[0] || null,
        distanceKm: toDecimalOrNull(cells[1]),
        engineHours: toDecimalOrNull(cells[2]),
        movingHours: toDecimalOrNull(cells[3]),
        idleHours: toDecimalOrNull(cells[4]),
        averageSpeedKph: toDecimalOrNull(cells[5]),
        maxSpeedKph: toDecimalOrNull(cells[6]),
        speedFactor: toDecimalOrNull(cells[7]),
        litersByDistance: toDecimalOrNull(cells[8]),
        estimatedLiters: toDecimalOrNull(cells[9])
      };
      break;
    }
  }

  const totalGallons = toDecimalOrNull(totalMatch?.[1]);
  const totalLiters = toDecimalOrNull(totalMatch?.[2]);

  return {
    totalGallons,
    totalLiters,
    totalDistanceKm: toDecimalOrNull(distanceMatch?.[1]),
    rangeLabel: rangeMatch?.[1] ? String(rangeMatch[1]).trim() : null,
    modeLabel: modeMatch?.[1] ? String(modeMatch[1]).trim() : null,
    detail,
    html
  };
}

function findNestedValue(source, matcher) {
  if (source == null) {
    return undefined;
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const found = findNestedValue(item, matcher);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  if (typeof source !== 'object') {
    return undefined;
  }

  for (const [key, value] of Object.entries(source)) {
    if (matcher(key, value)) {
      return value;
    }

    const found = findNestedValue(value, matcher);
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function findNestedArray(source, keyCandidates = []) {
  const lowered = keyCandidates.map((item) => String(item || '').toLowerCase());
  return findNestedValue(source, (key, value) => (
    Array.isArray(value) &&
    lowered.includes(String(key || '').toLowerCase())
  ));
}

function firstNumberFromObject(source, keyCandidates = []) {
  const lowered = keyCandidates.map((item) => String(item || '').toLowerCase());
  const direct = findNestedValue(source, (key, value) => (
    lowered.includes(String(key || '').toLowerCase()) &&
    toDecimalOrNull(value) !== null
  ));

  return toDecimalOrNull(direct);
}

function firstTextFromObject(source, keyCandidates = []) {
  const lowered = keyCandidates.map((item) => String(item || '').toLowerCase());
  const direct = findNestedValue(source, (key, value) => (
    lowered.includes(String(key || '').toLowerCase()) &&
    String(value || '').trim().length > 0
  ));

  return direct ? String(direct).trim() : null;
}

function normalizeFuelReportJson(payload) {
  const topLevelTotalLiters = firstNumberFromObject(payload, ['totalLiters', 'litros', 'liters', 'estimatedLiters']);
  const topLevelTotalGallons = firstNumberFromObject(payload, ['totalGallons', 'galones', 'gallons', 'estimatedGallons']);
  const topLevelDistanceKm = firstNumberFromObject(payload, ['totalDistanceKm', 'distanciaTotalKm', 'distanceKm', 'distanciaTotal']);
  const rows =
    (Array.isArray(payload) ? payload : null) ||
    findNestedArray(payload, ['items', 'rows', 'data', 'reportRows', 'details', 'detalle', 'devices']) ||
    [];

  let detail = null;
  if (Array.isArray(rows)) {
    const candidate = rows.find((item) => item && typeof item === 'object') || null;
    if (candidate) {
      detail = {
        deviceName: firstTextFromObject(candidate, ['deviceName', 'dispositivo', 'name', 'vehicleName']),
        distanceKm: firstNumberFromObject(candidate, ['distanceKm', 'distKm', 'distanciaKm', 'distance', 'dist']),
        engineHours: firstNumberFromObject(candidate, ['engineHours', 'horasMotor', 'hoursMotor']),
        movingHours: firstNumberFromObject(candidate, ['movingHours', 'horasMov', 'hoursMov']),
        idleHours: firstNumberFromObject(candidate, ['idleHours', 'horasRalenti', 'hoursIdle']),
        averageSpeedKph: firstNumberFromObject(candidate, ['averageSpeedKph', 'avgSpeedKmh', 'velProm', 'speedAvg']),
        maxSpeedKph: firstNumberFromObject(candidate, ['maxSpeedKph', 'avgSpeedKmh', 'velMax', 'speedMax']),
        speedFactor: firstNumberFromObject(candidate, ['speedFactor', 'factorVel', 'velocityFactor']),
        litersByDistance: firstNumberFromObject(candidate, ['litersByDistance', 'litrosPorKm', 'litersPerKm', 'litersByKm']),
        estimatedLiters: firstNumberFromObject(candidate, ['estimatedLiters', 'litrosEstimados', 'fuelLiters', 'liters', 'litersEstimated'])
      };
    }
  }

  const detailEstimatedLiters = toDecimalOrNull(detail?.estimatedLiters);
  const detailDistanceKm = toDecimalOrNull(detail?.distanceKm);
  const fallbackTotalLiters =
    (topLevelTotalLiters != null && topLevelTotalLiters > 0 ? topLevelTotalLiters : null) ??
    detailEstimatedLiters;
  const fallbackTotalGallons =
    (topLevelTotalGallons != null && topLevelTotalGallons > 0 ? topLevelTotalGallons : null) ??
    (fallbackTotalLiters == null ? null : Number(fallbackTotalLiters) * 0.264172);
  const fallbackDistanceKm =
    (topLevelDistanceKm != null && topLevelDistanceKm > 0 ? topLevelDistanceKm : null) ??
    detailDistanceKm;

  return {
    totalGallons: fallbackTotalGallons,
    totalLiters: fallbackTotalLiters,
    totalDistanceKm: fallbackDistanceKm,
    rangeLabel: firstTextFromObject(payload, ['rangeLabel', 'rango', 'range']),
    modeLabel: firstTextFromObject(payload, ['modeLabel', 'modo', 'mode']),
    detail,
    json: payload
  };
}

async function fetchFuelConsumptionReport(session, { deviceId, from, to }) {
  const reportPage = await fetchPlatform('/Reportes/Reportes', {
    headers: {
      Cookie: session.cookies.join('; ')
    }
  });

  if (looksLikePortalLogin(reportPage.text)) {
    return {
      ok: false,
      code: 'SESSION_EXPIRED',
      message: 'La sesion del portal expiro o ya no es valida para generar reportes.'
    };
  }

  const token = extractRequestVerificationToken(reportPage.text);
  if (!token) {
    return {
      ok: false,
      code: 'REPORT_TOKEN_MISSING',
      message: 'No fue posible extraer el token de reportes.'
    };
  }

  const payload = {
    type: 'fuelConsumption',
    format: 'JSON',
    title: 'Reporte Consumo de Combustible',
    from,
    to,
    deviceIds: [Number(deviceId)],
    stopMinMinutes: 3,
    stopSpeedKmh: 1,
    speedLimitKmh: null,
    fuelMode: 'hybrid',
    fuelLitersPer100Km: 12,
    fuelLitersPerEngineHour: 2.5,
    emails: ''
  };

  const generated = await fetchPlatform('/Reportes/Reportes?handler=Generate', {
    method: 'POST',
    headers: {
      Cookie: session.cookies.join('; '),
      'Content-Type': 'application/json',
      Accept: '*/*',
      RequestVerificationToken: token
    },
    body: JSON.stringify(payload)
  });

  if (looksLikePortalLogin(generated.text)) {
    return {
      ok: false,
      code: 'SESSION_EXPIRED',
      message: 'La sesion del portal expiro o ya no es valida para generar el reporte.'
    };
  }

  const parsedJson = (() => {
    try {
      return JSON.parse(generated.text);
    } catch {
      return null;
    }
  })();

  return {
    ok: true,
    payload,
    report: parsedJson
      ? normalizeFuelReportJson(parsedJson)
      : parseFuelReportHtml(generated.text)
  };
}

async function generatePlatformReport(session, reportPayload = {}) {
  const reportPage = await fetchPlatform('/Reportes/Reportes', {
    headers: {
      Cookie: session.cookies.join('; ')
    }
  });

  if (looksLikePortalLogin(reportPage.text)) {
    return {
      ok: false,
      code: 'SESSION_EXPIRED',
      message: 'La sesion del portal expiro o ya no es valida para generar reportes.'
    };
  }

  const token = extractRequestVerificationToken(reportPage.text);
  if (!token) {
    return {
      ok: false,
      code: 'REPORT_TOKEN_MISSING',
      message: 'No fue posible extraer el token del modulo de reportes.'
    };
  }

  const mergedCookies = mergeCookies(session.cookies, reportPage.cookies);
  const generated = await fetchPlatformBinary('/Reportes/Reportes?handler=Generate', {
    method: 'POST',
    headers: {
      Cookie: mergedCookies.join('; '),
      'Content-Type': 'application/json',
      Accept: 'application/pdf,application/json,text/html,*/*',
      RequestVerificationToken: token
    },
    body: JSON.stringify(reportPayload)
  });

  if (looksLikePortalLogin(generated.text)) {
    return {
      ok: false,
      code: 'SESSION_EXPIRED',
      message: 'La sesion del portal expiro o ya no es valida para generar el reporte.'
    };
  }

  let parsedJson = null;
  if (generated.contentType.toLowerCase().includes('application/json')) {
    try {
      parsedJson = JSON.parse(generated.text);
    } catch {
      parsedJson = null;
    }
  }

  return {
    ok: generated.ok,
    status: generated.status,
    contentType: generated.contentType,
    body: generated.body,
    text: generated.text,
    json: parsedJson,
    cookies: mergeCookies(mergedCookies, generated.cookies)
  };
}

function buildReportPayloadFromRequest(source = {}) {
  const type = String(source?.type || '').trim();
  const format = String(source?.format || 'PDF').trim().toUpperCase();
  const title = String(source?.title || 'Reporte').trim();
  const from = String(source?.from || '').trim();
  const to = String(source?.to || '').trim();
  const rawDeviceIds = Array.isArray(source?.deviceIds)
    ? source.deviceIds
    : (source?.deviceId != null ? [source.deviceId] : []);
  const deviceIds = rawDeviceIds
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);

  return {
    type,
    format,
    title,
    from,
    to,
    deviceIds,
    stopMinMinutes: Number(source?.stopMinMinutes || 3),
    stopSpeedKmh: Number(source?.stopSpeedKmh || 1),
    speedLimitKmh: source?.speedLimitKmh ?? null,
    fuelMode: source?.fuelMode ?? null,
    fuelLitersPer100Km: source?.fuelLitersPer100Km ?? null,
    fuelLitersPerEngineHour: source?.fuelLitersPerEngineHour ?? null,
    emails: String(source?.emails || '')
  };
}

function buildMonitorSummary(payload) {
  const rawDevices = Array.isArray(payload?.devices) ? payload.devices : [];
  const devices = rawDevices.map((item) => ({
    ...item,
    vehicleName: item?.vehicleName ?? item?.VehicleName ?? item?.name ?? item?.Name ?? 'Unidad',
    groupName: item?.groupName ?? item?.GroupName ?? item?.empresa ?? item?.Empresa ?? 'Sin empresa',
    uniqueId: item?.uniqueId ?? item?.UniqueId ?? item?.imei ?? item?.Imei ?? item?.IMEI ?? '-',
    lat: Number(item?.lat ?? item?.latitude ?? item?.Lat ?? item?.Latitude),
    lon: Number(item?.lon ?? item?.longitude ?? item?.Lon ?? item?.Longitude),
    speedKmh: Number(item?.speedKmh ?? item?.speed ?? item?.SpeedKmh ?? item?.Speed ?? 0),
    course: Number(item?.course ?? item?.Course ?? item?.heading ?? item?.Heading ?? item?.direction ?? item?.Direction ?? 0),
    fixTime: item?.fixTime ?? item?.FixTime ?? item?.deviceTime ?? item?.DeviceTime ?? null,
    address: pickAddress(item)
  }));
  const moving = devices.filter((item) => Number(item.speedKmh || 0) > 3);
  const withLocation = devices.filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)));
  const companies = [...new Set(devices.map((item) => item.groupName).filter(Boolean))];

  return {
    source: 'monitor-data',
    userName: payload?.userName || null,
    empresaNombre: payload?.empresaNombre || null,
    clienteId: payload?.clienteId || null,
    empresaId: payload?.empresaId || null,
    allowedCount: payload?.allowedCount || devices.length,
    afterCount: payload?.afterCount || devices.length,
    devices: devices.slice(0, 100),
    summary: {
      total: devices.length,
      moving: moving.length,
      stopped: Math.max(devices.length - moving.length, 0),
      withLocation: withLocation.length,
      companies: companies.length
    }
  };
}

function buildAlertsSummary(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const active = items.filter((item) => Boolean(item?.activo));
  const inactive = items.filter((item) => !item?.activo);
  const types = [...new Set(items.map((item) => item?.tipo).filter(Boolean))];

  return {
    source: 'alertas-list',
    items: items.slice(0, 30),
    summary: {
      total: items.length,
      active: active.length,
      inactive: inactive.length,
      types: types.length
    }
  };
}

function buildRouteSummary(payload) {
  const points = Array.isArray(payload) ? payload : [];

  const normalized = points
    .map((item, index) => {
      const lat = Number(item?.latitude ?? item?.lat ?? item?.Latitude ?? item?.Lat);
      const lon = Number(item?.longitude ?? item?.lon ?? item?.Longitude ?? item?.Lon);
      const speedKmh = Number(item?.speedKmh ?? item?.speed ?? item?.SpeedKmh ?? item?.Speed ?? 0);

      return {
        pointId: String(item?.pointId ?? item?.PointId ?? item?.id ?? item?.Id ?? `route-point-${index + 1}`),
        lat,
        lon,
        speedKmh,
        fixTime: item?.fixTime ?? item?.FixTime ?? item?.deviceTime ?? item?.DeviceTime ?? null,
        address: pickAddress(item),
        course: Number(item?.course ?? item?.Course ?? 0)
      };
    })
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));

  return {
    source: 'monitor-route',
    points: normalized,
    summary: {
      total: normalized.length,
      moving: normalized.filter((item) => item.speedKmh > 3).length,
      firstFixTime: normalized[0]?.fixTime || null,
      lastFixTime: normalized[normalized.length - 1]?.fixTime || null
    }
  };
}

function normalizeGeofences(payload) {
  const rawItems =
    (Array.isArray(payload) ? payload : null) ||
    (Array.isArray(payload?.items) ? payload.items : null) ||
    (Array.isArray(payload?.data) ? payload.data : null) ||
    (Array.isArray(payload?.rows) ? payload.rows : null) ||
    [];

  function parsePolygonWkt(areaText) {
    const source = String(areaText || '').trim();
    const match = source.match(/POLYGON\s*\(\((.*)\)\)/i);
    if (!match || !match[1]) {
      return [];
    }

    const points = match[1]
      .split(',')
      .map((pair) => pair.trim().split(/\s+/))
      .map((parts) => {
        if (parts.length < 2) {
          return null;
        }
        const lon = Number(parts[0]);
        const lat = Number(parts[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return null;
        }
        return { lat, lon };
      })
      .filter(Boolean);

    if (points.length > 1) {
      const first = points[0];
      const last = points[points.length - 1];
      if (first.lat === last.lat && first.lon === last.lon) {
        points.pop();
      }
    }

    return points;
  }

  function parseCircleWkt(areaText) {
    const source = String(areaText || '').trim();
    const match = source.match(/CIRCLE\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i);
    if (!match) {
      return null;
    }

    const lon = Number(match[1]);
    const lat = Number(match[2]);
    const radiusMeters = Number(match[3]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusMeters) || radiusMeters <= 0) {
      return null;
    }

    return {
      centerLat: lat,
      centerLon: lon,
      radiusMeters
    };
  }

  const items = rawItems
    .map((item, index) => {
      const polygon = Array.isArray(item?.points)
        ? item.points.map((point) => ({
            lat: Number(point?.lat ?? point?.latitude ?? point?.Lat ?? point?.Latitude),
            lon: Number(point?.lon ?? point?.longitude ?? point?.Lon ?? point?.Longitude)
          })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))
        : [];

      const areaWkt = String(item?.area ?? item?.Area ?? '').trim();
      const wktPolygon = polygon.length ? [] : parsePolygonWkt(areaWkt);
      const circleFromWkt = (!polygon.length && !wktPolygon.length) ? parseCircleWkt(areaWkt) : null;

      const centerLat = Number(item?.centerLat ?? item?.lat ?? item?.latitude ?? item?.Lat ?? item?.Latitude);
      const centerLon = Number(item?.centerLon ?? item?.lon ?? item?.longitude ?? item?.Lon ?? item?.Longitude);
      const radiusMeters = Number(item?.radiusMeters ?? item?.radius ?? item?.RadiusMeters ?? item?.Radius ?? 0);

      const finalPoints = polygon.length ? polygon : wktPolygon;
      const finalCenterLat = Number.isFinite(centerLat) ? centerLat : Number(circleFromWkt?.centerLat);
      const finalCenterLon = Number.isFinite(centerLon) ? centerLon : Number(circleFromWkt?.centerLon);
      const finalRadiusMeters = radiusMeters > 0 ? radiusMeters : Number(circleFromWkt?.radiusMeters);

      return {
        geofenceId: String(item?.geofenceId ?? item?.GeofenceId ?? item?.id ?? item?.Id ?? `geofence-${index + 1}`),
        name: item?.name ?? item?.Name ?? 'Geocerca',
        type: finalPoints.length >= 3 ? 'polygon' : 'circle',
        centerLat: finalCenterLat,
        centerLon: finalCenterLon,
        radiusMeters: finalRadiusMeters,
        points: finalPoints
      };
    })
    .filter((item) => {
      if (item.type === 'polygon') {
        return item.points.length >= 3;
      }

      return Number.isFinite(item.centerLat) && Number.isFinite(item.centerLon) && item.radiusMeters > 0;
    });

  return {
    available: items.length > 0,
    items,
    summary: {
      total: items.length
    }
  };
}

function normalizeRecentEvents(payload, limit = 30) {
  const rawItems =
    (Array.isArray(payload) ? payload : null) ||
    (Array.isArray(payload?.items) ? payload.items : null) ||
    (Array.isArray(payload?.events) ? payload.events : null) ||
    (Array.isArray(payload?.data) ? payload.data : null) ||
    (Array.isArray(payload?.rows) ? payload.rows : null) ||
    [];

  const normalized = rawItems
    .map((item, index) => {
      const latitude = Number(item?.latitude ?? item?.lat ?? item?.Latitude ?? item?.Lat);
      const longitude = Number(item?.longitude ?? item?.lon ?? item?.Longitude ?? item?.Lon);
      const speed = Number(item?.speed ?? item?.speedKmh ?? item?.Speed ?? item?.SpeedKmh ?? 0);
      const eventTime =
        item?.eventTime ??
        item?.EventTime ??
        item?.deviceTime ??
        item?.DeviceTime ??
        item?.fixTime ??
        item?.FixTime ??
        item?.serverTime ??
        item?.ServerTime ??
        null;

      return {
        eventId: String(item?.eventId ?? item?.EventId ?? item?.id ?? item?.Id ?? `event-${index + 1}`),
        deviceId: String(item?.deviceId ?? item?.DeviceId ?? item?.idDispositivo ?? item?.IdDispositivo ?? ''),
        vehicleName:
          item?.vehicleName ??
          item?.VehicleName ??
          item?.deviceName ??
          item?.DeviceName ??
          item?.name ??
          item?.Name ??
          'Unidad',
        eventType:
          item?.eventType ??
          item?.EventType ??
          item?.description ??
          item?.Description ??
          item?.type ??
          item?.Type ??
          item?.eventName ??
          item?.EventName ??
          'Evento',
        latitude,
        longitude,
        speed: Number.isFinite(speed) ? speed : 0,
        eventTime,
        address: pickAddress(item),
        iconBase: item?.iconBase ?? item?.IconBase ?? 'flecha'
      };
    })
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && item.eventTime)
    .sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime());

  return {
    items: normalized.slice(0, Math.max(1, limit)),
    summary: {
      total: normalized.length
    }
  };
}

function buildMockMonitorSummary() {
  return buildMonitorSummary(mockData.liveMonitor);
}

function buildMockAlertsSummary() {
  return buildAlertsSummary(mockData.alerts);
}

function buildMockRouteSummary() {
  return buildRouteSummary(mockData.routePoints);
}

function buildMockEventsSummary(limit) {
  return normalizeRecentEvents(mockData.recentEvents, limit);
}

function buildMockGeofencesSummary() {
  return normalizeGeofences(mockData.geofences || []);
}

function isLocalCompositeReportType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  return normalized === 'events' || normalized === 'geofences';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatReportDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || '-');
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

async function loadRecentEventsForSession(session, limit = 120) {
  if (!session) {
    return {
      ok: false,
      status: 404,
      code: 'SESSION_NOT_FOUND',
      message: 'Sesion valida no encontrada.'
    };
  }

  if (session.mode === 'mock') {
    return {
      ok: true,
      data: buildMockEventsSummary(limit)
    };
  }

  if (!hasLiveCookies(session)) {
    return {
      ok: false,
      status: 404,
      code: 'SESSION_NOT_FOUND',
      message: 'Sesion valida no encontrada.'
    };
  }

  try {
    const result = await fetchPlatform('/Monitoreo/Monitor?handler=Events', {
      headers: {
        Cookie: session.cookies.join('; ')
      }
    });

    let payload;
    try {
      payload = JSON.parse(result.text);
    } catch {
      const looksLikeLogin = looksLikePortalLogin(result.text);
      return {
        ok: false,
        status: 401,
        code: looksLikeLogin ? 'SESSION_EXPIRED' : 'INVALID_EVENTS_RESPONSE',
        message: looksLikeLogin
          ? 'La sesion del portal expiro o ya no es valida para consultar eventos.'
          : 'El modulo de eventos respondio con un contenido inesperado.'
      };
    }

    const data = normalizeRecentEvents(payload, limit);
    await fillMissingAddresses(data.items);

    return {
      ok: true,
      data
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      code: 'EVENTS_PROXY_ERROR',
      message: error?.message || 'No se pudieron cargar eventos.'
    };
  }
}

async function loadGeofencesForSession(session) {
  if (!session) {
    return {
      ok: false,
      status: 404,
      code: 'SESSION_NOT_FOUND',
      message: 'Sesion valida no encontrada.'
    };
  }

  if (session.mode === 'mock') {
    return {
      ok: true,
      data: buildMockGeofencesSummary()
    };
  }

  if (!hasLiveCookies(session)) {
    return {
      ok: false,
      status: 404,
      code: 'SESSION_NOT_FOUND',
      message: 'Sesion valida no encontrada.'
    };
  }

  try {
    const resolved = await resolveLiveGeofences(session.cookies);
    if (!resolved.ok) {
      return {
        ok: false,
        status: resolved.code === 'SESSION_EXPIRED' ? 401 : 502,
        code: resolved.code || 'GEOFENCES_ERROR',
        message: resolved.message || 'No se pudieron cargar geocercas.'
      };
    }

    return {
      ok: true,
      data: normalizeGeofences(resolved.payload)
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      code: 'GEOFENCES_PROXY_ERROR',
      message: error?.message || 'No se pudieron cargar geocercas.'
    };
  }
}

function buildLocalHtmlReportDocument({
  title,
  subtitle,
  generatedAt,
  details = [],
  headers = [],
  rows = [],
  emptyMessage = 'Sin datos disponibles para este reporte.'
}) {
  const detailMarkup = details
    .filter((item) => String(item?.label || '').trim())
    .map((item) => `
      <div class="meta-card">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value || '-')}</strong>
      </div>
    `)
    .join('');

  const tableHeaderMarkup = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('');

  const tableBodyMarkup = rows.length
    ? rows.map((row) => `
        <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>
      `).join('')
    : `<tr><td colspan="${Math.max(headers.length, 1)}">${escapeHtml(emptyMessage)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      background: #eef4fb;
      color: #10233f;
      padding: 24px;
    }
    .sheet {
      max-width: 1080px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 20px;
      padding: 28px;
      box-shadow: 0 18px 40px rgba(13, 35, 67, 0.12);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      color: #0f3b74;
    }
    .subtitle {
      margin: 0 0 22px;
      font-size: 14px;
      color: #48617f;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 22px;
    }
    .meta-card {
      padding: 14px 16px;
      border-radius: 14px;
      background: #f4f8fd;
      border: 1px solid #d8e6f5;
    }
    .meta-card span {
      display: block;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #59738f;
      margin-bottom: 6px;
    }
    .meta-card strong {
      font-size: 14px;
      color: #10233f;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      overflow: hidden;
      border-radius: 14px;
      border: 1px solid #d8e6f5;
    }
    thead {
      background: #0f3b74;
      color: #ffffff;
    }
    th, td {
      padding: 12px 14px;
      text-align: left;
      vertical-align: top;
      font-size: 13px;
      border-bottom: 1px solid #e6eef7;
    }
    tbody tr:nth-child(even) {
      background: #f9fbfe;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">${escapeHtml(subtitle)} Generado: ${escapeHtml(generatedAt)}</p>
    <section class="meta-grid">${detailMarkup}</section>
    <table>
      <thead><tr>${tableHeaderMarkup}</tr></thead>
      <tbody>${tableBodyMarkup}</tbody>
    </table>
  </div>
</body>
</html>`;
}

async function generateLocalCompositeReport(session, reportPayload = {}) {
  const type = String(reportPayload?.type || '').trim().toLowerCase();
  const title = String(reportPayload?.title || 'Reporte').trim() || 'Reporte';
  const from = String(reportPayload?.from || '').trim();
  const to = String(reportPayload?.to || '').trim();
  const selectedDeviceId = Number(Array.isArray(reportPayload?.deviceIds) ? reportPayload.deviceIds[0] : null);

  if (type === 'events') {
    const resolved = await loadRecentEventsForSession(session, 250);
    if (!resolved.ok) {
      return resolved;
    }

    const filteredItems = (resolved.data?.items || []).filter((item) => {
      const matchesDevice = Number.isFinite(selectedDeviceId)
        ? String(item.deviceId || '') === String(selectedDeviceId)
        : true;
      const eventTime = new Date(item.eventTime || '').getTime();
      const matchesFrom = from ? eventTime >= new Date(from).getTime() : true;
      const matchesTo = to ? eventTime <= new Date(to).getTime() : true;
      return matchesDevice && matchesFrom && matchesTo;
    });

    const html = buildLocalHtmlReportDocument({
      title,
      subtitle: 'Resumen operativo basado en el feed reciente de eventos disponible en el portal.',
      generatedAt: formatReportDate(new Date().toISOString()),
      details: [
        { label: 'Tipo', value: 'Eventos' },
        { label: 'Desde', value: formatReportDate(from) },
        { label: 'Hasta', value: formatReportDate(to) },
        { label: 'Total', value: String(filteredItems.length) }
      ],
      headers: ['Fecha', 'Unidad', 'Evento', 'Velocidad', 'Ubicacion'],
      rows: filteredItems.map((item) => [
        formatReportDate(item.eventTime),
        item.vehicleName || 'Unidad',
        item.eventType || 'Evento',
        `${Math.round(Number(item.speed || 0))} km/h`,
        item.address || `${Number(item.latitude).toFixed(5)}, ${Number(item.longitude).toFixed(5)}`
      ]),
      emptyMessage: 'No hay eventos recientes para el rango y dispositivo seleccionados.'
    });

    return {
      ok: true,
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: Buffer.from(html, 'utf8')
    };
  }

  if (type === 'geofences') {
    const resolved = await loadGeofencesForSession(session);
    if (!resolved.ok) {
      return resolved;
    }

    const geofences = resolved.data?.items || [];
    const html = buildLocalHtmlReportDocument({
      title,
      subtitle: 'Inventario operativo de geocercas disponible para la sesion activa.',
      generatedAt: formatReportDate(new Date().toISOString()),
      details: [
        { label: 'Tipo', value: 'Geocercas' },
        { label: 'Desde', value: formatReportDate(from) },
        { label: 'Hasta', value: formatReportDate(to) },
        { label: 'Total', value: String(geofences.length) }
      ],
      headers: ['Nombre', 'Tipo', 'Centro o vertices', 'Radio'],
      rows: geofences.map((item) => [
        item.name || 'Geocerca',
        item.type === 'polygon' ? 'Poligono' : 'Circular',
        item.type === 'polygon'
          ? `${item.points.length} vertices`
          : `${Number(item.centerLat).toFixed(5)}, ${Number(item.centerLon).toFixed(5)}`,
        item.type === 'polygon' ? '-' : `${Math.round(Number(item.radiusMeters || 0))} m`
      ]),
      emptyMessage: 'No hay geocercas disponibles en la sesion activa.'
    });

    return {
      ok: true,
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: Buffer.from(html, 'utf8')
    };
  }

  return {
    ok: false,
    status: 400,
    code: 'LOCAL_REPORT_TYPE_UNSUPPORTED',
    message: 'El tipo de reporte local solicitado no esta soportado.'
  };
}

async function resolveLiveGeofences(cookies = []) {
  const cookieHeader = cookies.join('; ');
  const platformBase = String(config.platformBaseUrl || '').replace(/\/$/, '');

  function toRelativePlatformPath(rawPath) {
    const value = String(rawPath || '').trim();
    if (!value) {
      return null;
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      try {
        const absolute = new URL(value);
        const base = new URL(platformBase);
        if (absolute.origin !== base.origin) {
          return null;
        }
        return `${absolute.pathname}${absolute.search || ''}`;
      } catch {
        return null;
      }
    }

    if (value.startsWith('/')) {
      return value;
    }

    return `/${value}`;
  }

  async function getGeofenceUrlFromMonitorConfig() {
    try {
      const monitorPage = await fetchPlatform('/Monitoreo/Monitor', {
        headers: {
          Cookie: cookieHeader
        }
      });

      const html = String(monitorPage.text || '');
      const match = html.match(/geofenceListUrl\s*:\s*['"]([^'"]+)['"]/i);
      if (!match?.[1]) {
        return null;
      }

      return toRelativePlatformPath(match[1]);
    } catch {
      return null;
    }
  }

  const monitorConfigPath = await getGeofenceUrlFromMonitorConfig();
  const candidates = [...new Set([
    monitorConfigPath,
    '/Monitoreo/Monitor?handler=GeofenceList',
    '/Monitoreo/Monitor?handler=Geofences',
    '/Geocerca?handler=List',
    '/Geocerca?handler=GeofenceList'
  ].filter(Boolean))];

  let lastError = null;

  for (const path of candidates) {
    try {
      const result = await fetchPlatform(path, {
        headers: {
          Cookie: cookieHeader
        }
      });

      const text = String(result.text || '');
      const looksLikeLogin =
        text.includes('Iniciar sesi') ||
        text.includes('class="login-form"') ||
        text.includes('placeholder="Correo electr');

      if (looksLikeLogin) {
        return {
          ok: false,
          code: 'SESSION_EXPIRED',
          message: 'La sesion del portal expiro o ya no es valida para consultar geocercas.'
        };
      }

      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }

      if (payload == null) {
        continue;
      }

      return {
        ok: true,
        payload,
        sourcePath: path
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ok: false,
    code: 'GEOFENCES_SOURCE_UNAVAILABLE',
    message: 'No fue posible obtener geocercas desde los handlers disponibles del portal.',
    error: lastError
  };
}

router.get('/platform/page', async (req, res) => {
  const sessionId = String(req.query.sessionId || '').trim();
  const path = String(req.query.path || '').trim();
  const termList = String(req.query.terms || 'combustible,fuel,reporte,L/100km,gal')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!sessionId || !path) {
    return res.status(400).json({
      ok: false,
      code: 'PLATFORM_PAGE_PARAMETERS_REQUIRED',
      message: 'sessionId y path son obligatorios.'
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return respondSessionNotFound(res);
  }

  if (!hasLiveCookies(session)) {
    return respondSessionNotFound(res);
  }

  try {
    const result = await fetchPlatform(path, {
      headers: {
        Cookie: session.cookies.join('; ')
      }
    });

    if (looksLikePortalLogin(result.text)) {
      return res.status(401).json({
        ok: false,
        code: 'SESSION_EXPIRED',
        message: 'La sesion del portal expiro o ya no es valida.'
      });
    }

    return res.json({
      ok: true,
      mode: session.mode,
      data: {
        path,
        status: result.status,
        title: extractHtmlTitle(result.text),
        links: extractMatchingLinks(result.text, termList),
        snippets: extractInterestingSnippets(result.text, termList),
        preview: String(result.text || '').slice(0, 3000)
      }
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      code: 'PLATFORM_PAGE_ERROR',
      message: error?.message || 'No se pudo consultar la pagina del portal.'
    });
  }
});

router.get('/reports/fuel-consumption', async (req, res) => {
  const sessionId = String(req.query.sessionId || '').trim();
  const deviceId = String(req.query.deviceId || '').trim();
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();

  if (!sessionId || !deviceId || !from || !to) {
    return res.status(400).json({
      ok: false,
      code: 'FUEL_REPORT_PARAMETERS_REQUIRED',
      message: 'sessionId, deviceId, from y to son obligatorios.'
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return respondSessionNotFound(res);
  }

  if (!hasLiveCookies(session)) {
    return respondSessionNotFound(res);
  }

  try {
    const resolved = await fetchFuelConsumptionReport(session, { deviceId, from, to });
    if (!resolved.ok) {
      return res.status(resolved.code === 'SESSION_EXPIRED' ? 401 : 502).json({
        ok: false,
        code: resolved.code || 'FUEL_REPORT_ERROR',
        message: resolved.message || 'No se pudo generar el reporte de combustible.'
      });
    }

    return res.json({
      ok: true,
      mode: session.mode,
      data: resolved.report
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      code: 'FUEL_REPORT_PROXY_ERROR',
      message: error?.message || 'No se pudo generar el reporte de combustible.'
    });
  }
});

router.post('/reports/generate', async (req, res) => {
  const sessionId = String(req.body?.sessionId || '').trim();
  const payload = buildReportPayloadFromRequest(req.body || {});
  const {
    type,
    format,
    title,
    from,
    to,
    deviceIds
  } = payload;

  if (!sessionId || !type || !from || !to || !deviceIds.length) {
    return res.status(400).json({
      ok: false,
      code: 'REPORT_PARAMETERS_REQUIRED',
      message: 'sessionId, type, from, to y deviceIds son obligatorios.'
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return respondSessionNotFound(res);
  }

  if (!hasLiveCookies(session)) {
    return respondSessionNotFound(res);
  }

  try {
    const generated = isLocalCompositeReportType(type)
      ? await generateLocalCompositeReport(session, payload)
      : await generatePlatformReport(session, payload);
    if (!generated.ok) {
      return res.status(generated.code === 'SESSION_EXPIRED' ? 401 : (generated.status || 502)).json({
        ok: false,
        code: generated.code || 'REPORT_GENERATION_FAILED',
        message: generated.message || generated.json?.error || generated.json?.message || 'No se pudo generar el reporte.'
      });
    }

    const contentType = String(generated.contentType || '').toLowerCase();
    if (contentType.includes('application/pdf')) {
      const fileName = `${safeReportFileName(title, 'reporte')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.send(generated.body);
    }

    if (contentType.includes('text/html')) {
      const fileName = `${safeReportFileName(title, 'reporte')}.html`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.send(generated.body);
    }

    if (generated.json) {
      return res.status(200).json({
        ok: true,
        mode: session.mode,
        data: generated.json
      });
    }

    return res.status(502).json({
      ok: false,
      code: 'UNSUPPORTED_REPORT_RESPONSE',
      message: 'El portal devolvio un formato inesperado al generar el reporte.'
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      code: 'REPORT_PROXY_ERROR',
      message: error?.message || 'No se pudo generar el reporte.'
    });
  }
});

router.get('/reports/download', async (req, res) => {
  const sessionId = String(req.query.sessionId || '').trim();
  const payload = buildReportPayloadFromRequest({
    ...req.query,
    deviceId: req.query.deviceId,
    deviceIds: req.query.deviceId ? [req.query.deviceId] : []
  });
  const {
    type,
    title,
    from,
    to,
    deviceIds
  } = payload;

  if (!sessionId || !type || !from || !to || !deviceIds.length) {
    return res.status(400).send('sessionId, type, from, to y deviceId son obligatorios.');
  }

  const session = getSession(sessionId);
  if (!session || !hasLiveCookies(session)) {
    return res.status(401).send('La sesion ya no es valida para generar el reporte.');
  }

  try {
    const generated = isLocalCompositeReportType(type)
      ? await generateLocalCompositeReport(session, payload)
      : await generatePlatformReport(session, payload);
    if (!generated.ok) {
      return res.status(generated.code === 'SESSION_EXPIRED' ? 401 : (generated.status || 502))
        .send(generated.message || generated.json?.error || generated.json?.message || 'No se pudo generar el reporte.');
    }

    const contentType = String(generated.contentType || '').toLowerCase();
    if (contentType.includes('application/pdf')) {
      const fileName = `${safeReportFileName(title, 'reporte')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.send(generated.body);
    }

    if (contentType.includes('text/html')) {
      const fileName = `${safeReportFileName(title, 'reporte')}.html`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.send(generated.body);
    }

    return res.status(502).send('El portal no devolvio un formato compatible para este reporte.');
  } catch (error) {
    return res.status(502).send(error?.message || 'No se pudo generar el reporte.');
  }
});

router.post('/share-link', async (req, res) => {
  const sessionId = String(req.body?.sessionId || '').trim();
  const rawDeviceId = req.body?.deviceId;
  const durationMinutes = Number(req.body?.durationMinutes || 0);
  const deviceName = String(req.body?.deviceName || '').trim();

  if (!sessionId) {
    return respondMissingSessionId(res);
  }

  const deviceId = Number(rawDeviceId);
  if (!Number.isFinite(deviceId) || deviceId <= 0) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_DEVICE_ID',
      message: 'deviceId es obligatorio y debe ser numerico.'
    });
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_DURATION',
      message: 'durationMinutes debe ser mayor que cero.'
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return respondSessionNotFound(res);
  }

  if (!hasLiveCookies(session)) {
    return respondSessionNotFound(res);
  }

  const token = createShareToken({
    sessionId,
    deviceId,
    deviceName: deviceName || null,
    durationMinutes
  });

  const baseFromConfig = String(config.publicShareBaseUrl || '').trim().replace(/\/$/, '');
  const baseFromRequest = `${req.protocol}://${req.get('host')}`;
  const shareBaseUrl = baseFromConfig || baseFromRequest;
  const shareUrl = `${shareBaseUrl}/share/${encodeURIComponent(token.token)}`;

  return res.json({
    ok: true,
    mode: session.mode,
    data: {
      token: token.token,
      shareUrl,
      expiresAt: token.expiresAt,
      durationMinutes: token.durationMinutes,
      deviceId: token.deviceId,
      deviceName: token.deviceName
    }
  });
});

function normalizeCommand(commandRaw) {
  const command = String(commandRaw || '').trim().toLowerCase();

  if (command === 'enginestop' || command === 'engine_stop' || command === 'engine-stop') {
    return 'engineStop';
  }

  if (
    command === 'engineresume' ||
    command === 'engine_resume' ||
    command === 'engine-resume' ||
    command === 'engine_unlock' ||
    command === 'engineunlock'
  ) {
    return 'engineResume';
  }

  return null;
}

router.get('/monitor/data', async (req, res) => {
  const sessionId = String(req.query.sessionId || '').trim();
  if (!sessionId) {
    return respondMissingSessionId(res);
  }

  const session = getSession(sessionId);
  if (!session) {
    return respondSessionNotFound(res);
  }

  if (session.mode === 'mock') {
    return res.json({
      ok: true,
      mode: 'mock',
      data: buildMockMonitorSummary()
    });
  }

  if (!hasLiveCookies(session)) {
    return respondSessionNotFound(res);
  }

  try {
    const result = await fetchPlatform('/Monitoreo/Monitor?handler=Data', {
      headers: {
        Cookie: session.cookies.join('; ')
      }
    });

    let payload;
    try {
      payload = JSON.parse(result.text);
    } catch {
      const looksLikeLogin =
        String(result.text || '').includes('Iniciar sesión - Soportecni GPS') ||
        String(result.text || '').includes('class="login-form"') ||
        String(result.text || '').includes('placeholder="Correo electrónico"');

      return res.status(401).json({
        ok: false,
        code: looksLikeLogin ? 'SESSION_EXPIRED' : 'INVALID_MONITOR_RESPONSE',
        message: looksLikeLogin
          ? 'La sesión del portal expiró o ya no es válida para consultar el monitor.'
          : 'El monitor respondió con un contenido inesperado.'
      });
    }

    const data = buildMonitorSummary(payload);
    await fillMissingAddresses(data.devices);

    return res.json({
      ok: true,
      mode: session.mode,
      data
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      message: error.message
    });
  }
});

router.get('/alerts/list', async (req, res) => {
  const sessionId = String(req.query.sessionId || '').trim();
  if (!sessionId) {
    return respondMissingSessionId(res);
  }

  const session = getSession(sessionId);
  if (!session) {
    return respondSessionNotFound(res);
  }

  if (session.mode === 'mock') {
    return res.json({
      ok: true,
      mode: 'mock',
      data: buildMockAlertsSummary()
    });
  }

  if (!hasLiveCookies(session)) {
    return respondSessionNotFound(res);
  }

  try {
    const result = await fetchPlatform('/Alertas?handler=List', {
      headers: {
        Cookie: session.cookies.join('; ')
      }
    });

    let payload;
    try {
      payload = JSON.parse(result.text);
    } catch {
      const looksLikeLogin =
        String(result.text || '').includes('Iniciar sesi') ||
        String(result.text || '').includes('class="login-form"') ||
        String(result.text || '').includes('placeholder="Correo electr');

      return res.status(401).json({
        ok: false,
        code: looksLikeLogin ? 'SESSION_EXPIRED' : 'INVALID_ALERTS_RESPONSE',
        message: looksLikeLogin
          ? 'La sesion del portal expiro o ya no es valida para consultar alertas.'
          : 'Alertas respondio con un contenido inesperado.'
      });
    }

    return res.json({
      ok: true,
      mode: session.mode,
      data: buildAlertsSummary(payload)
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      message: error.message
    });
  }
});

router.get('/monitor/route', async (req, res) => {
  const sessionId = String(req.query.sessionId || '').trim();
  const deviceId = String(req.query.deviceId || '').trim();
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();

  if (!sessionId || !deviceId || !from || !to) {
    return res.status(400).json({
      ok: false,
      code: 'ROUTE_PARAMETERS_REQUIRED',
      message: 'sessionId, deviceId, from y to son obligatorios.'
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return respondSessionNotFound(res);
  }

  if (session.mode === 'mock') {
    return res.json({
      ok: true,
      mode: 'mock',
      data: buildMockRouteSummary()
    });
  }

  if (!hasLiveCookies(session)) {
    return respondSessionNotFound(res);
  }

  const query = new URLSearchParams({
    deviceId,
    from,
    to
  });

  try {
    const result = await fetchPlatform(`/Monitoreo/Monitor?handler=Route&${query.toString()}`, {
      headers: {
        Cookie: session.cookies.join('; ')
      }
    });

    let payload;
    try {
      payload = JSON.parse(result.text);
    } catch {
      const looksLikeLogin =
        String(result.text || '').includes('Iniciar sesi') ||
        String(result.text || '').includes('class="login-form"');

      return res.status(401).json({
        ok: false,
        code: looksLikeLogin ? 'SESSION_EXPIRED' : 'INVALID_ROUTE_RESPONSE',
        message: looksLikeLogin
          ? 'La sesion del portal expiro o ya no es valida para consultar rutas.'
          : 'El modulo de rutas respondio con un contenido inesperado.'
      });
    }

    return res.json({
      ok: true,
      mode: session.mode,
      data: buildRouteSummary(payload)
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      message: error.message
    });
  }
});

router.get('/monitor/events/recent', async (req, res) => {
  const sessionId = String(req.query.sessionId || '').trim();
  const limit = Number(req.query.limit || 30);

  if (!sessionId) {
    return respondMissingSessionId(res);
  }

  const session = getSession(sessionId);
  if (!session) {
    return respondSessionNotFound(res);
  }

  if (session.mode === 'mock') {
    return res.json({
      ok: true,
      mode: 'mock',
      data: buildMockEventsSummary(limit)
    });
  }

  if (!hasLiveCookies(session)) {
    return respondSessionNotFound(res);
  }

  try {
    const resolved = await loadRecentEventsForSession(session, limit);
    if (!resolved.ok) {
      return res.status(resolved.status || 502).json({
        ok: false,
        code: resolved.code || 'EVENTS_PROXY_ERROR',
        message: resolved.message || 'No se pudieron cargar eventos.'
      });
    }

    return res.json({
      ok: true,
      mode: session.mode,
      data: resolved.data
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      message: error.message
    });
  }
});

router.get('/monitor/geofences', async (req, res) => {
  const sessionId = String(req.query.sessionId || '').trim();

  if (!sessionId) {
    return respondMissingSessionId(res);
  }

  const session = getSession(sessionId);
  if (!session) {
    return respondSessionNotFound(res);
  }

  if (session.mode === 'mock') {
    return res.json({
      ok: true,
      mode: 'mock',
      data: buildMockGeofencesSummary()
    });
  }

  if (!hasLiveCookies(session)) {
    return respondSessionNotFound(res);
  }

  try {
    const resolved = await loadGeofencesForSession(session);
    if (!resolved.ok) {
      return res.status(resolved.status || 502).json({
        ok: false,
        code: resolved.code || 'GEOFENCES_ERROR',
        message: resolved.message || 'No se pudieron cargar geocercas.'
      });
    }

    return res.json({
      ok: true,
      mode: session.mode,
      data: resolved.data
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      code: 'GEOFENCES_PROXY_ERROR',
      message: error?.message || 'No se pudieron cargar geocercas.'
    });
  }
});

router.post('/monitor/command', async (req, res) => {
  const sessionId = String(req.body?.sessionId || '').trim();
  const rawDeviceId = req.body?.deviceId;
  const rawCommand = req.body?.command;
  const authorizationKey = String(req.body?.authorizationKey || '').trim();

  if (!sessionId) {
    return respondMissingSessionId(res);
  }

  const deviceId = Number(rawDeviceId);
  if (!Number.isFinite(deviceId) || deviceId <= 0) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_DEVICE_ID',
      message: 'deviceId es obligatorio y debe ser numerico.'
    });
  }

  const command = normalizeCommand(rawCommand);
  if (!command) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_COMMAND',
      message: 'Comando invalido. Use engine_stop o engine_unlock.'
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return respondSessionNotFound(res);
  }

  if (session.mode === 'mock') {
    return res.json({
      ok: true,
      mode: 'mock',
      data: {
        ok: true,
        message: command === 'engineStop'
          ? 'Comando engineStop simulado correctamente.'
          : 'Comando engineResume simulado correctamente.'
      }
    });
  }

  if (!hasLiveCookies(session)) {
    return respondSessionNotFound(res);
  }

  try {
    const result = await sendMonitorCommand({
      deviceId,
      command,
      authorizationKey,
      cookies: session.cookies
    });

    if (Array.isArray(result.cookies) && result.cookies.length > 0) {
      updateSession(sessionId, { cookies: result.cookies });
    }

    if (result.isLoginScreen) {
      return res.status(401).json({
        ok: false,
        code: 'SESSION_EXPIRED',
        message: 'La sesion del portal expiro o ya no es valida para enviar comandos.'
      });
    }

    if (!result.payload || typeof result.payload !== 'object') {
      return res.status(502).json({
        ok: false,
        code: 'INVALID_COMMAND_RESPONSE',
        message: 'La plataforma respondio con un formato inesperado al enviar el comando.'
      });
    }

    if (!result.ok || result.payload.ok !== true) {
      const message =
        String(result.payload?.message || '').trim() ||
        'La plataforma no confirmo el envio del comando.';

      return res.status(result.status >= 400 ? result.status : 400).json({
        ok: false,
        code: 'COMMAND_REJECTED',
        message,
        data: result.payload
      });
    }

    return res.json({
      ok: true,
      mode: session.mode,
      data: {
        ok: true,
        message: String(result.payload.message || 'Comando enviado correctamente.'),
        platform: result.payload
      }
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      code: 'COMMAND_PROXY_ERROR',
      message: error?.message || 'No se pudo enviar el comando al portal.'
    });
  }
});

router.post('/monitor/device-meta', async (req, res) => {
  const sessionId = String(req.body?.sessionId || '').trim();
  const rawDeviceId = req.body?.deviceId;
  const vehicleName = String(req.body?.vehicleName || '').trim();
  const uniqueId = String(req.body?.uniqueId || '').trim();

  if (!sessionId) {
    return respondMissingSessionId(res);
  }

  const deviceId = Number(rawDeviceId);
  if (!Number.isFinite(deviceId) || deviceId <= 0) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_DEVICE_ID',
      message: 'deviceId es obligatorio y debe ser numerico.'
    });
  }

  if (!vehicleName) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_VEHICLE_NAME',
      message: 'vehicleName es obligatorio.'
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return respondSessionNotFound(res);
  }

  if (session.mode === 'mock') {
    return res.json({
      ok: true,
      mode: 'mock',
      data: {
        ok: true,
        vehicleName
      }
    });
  }

  if (!hasLiveCookies(session)) {
    return respondSessionNotFound(res);
  }

  try {
    const metaResult = await fetchConfigurationDeviceMeta({
      deviceId,
      cookies: session.cookies
    });

    if (Array.isArray(metaResult.cookies) && metaResult.cookies.length > 0) {
      updateSession(sessionId, { cookies: metaResult.cookies });
    }

    if (metaResult.isLoginScreen) {
      return res.status(401).json({
        ok: false,
        code: 'SESSION_EXPIRED',
        message: 'La sesion del portal expiro o ya no es valida para editar el dispositivo.'
      });
    }

    const meta = metaResult.payload?.meta || null;
    const imei = String(meta?.imei || uniqueId || '').trim();
    let configurationSaved = false;
    let configurationResult = null;

    if (meta && imei) {
      configurationResult = await saveConfigurationDevice({
        payload: {
          deviceId,
          companyId: Number.isFinite(Number(meta?.empresaId)) ? Number(meta.empresaId) : null,
          activo: Boolean(meta?.activo ?? true),
          nombre: vehicleName,
          imei,
          numeroSim: meta?.numeroSim ?? null,
          modeloDispositivo: meta?.modeloDispositivo ?? null,
          chasisVin: meta?.chasisVin ?? null,
          conductor: meta?.conductor ?? null,
          correo: meta?.correo ?? null,
          movil: meta?.movil ?? null,
          notas: meta?.notas ?? null,
          odometroInicialKm: meta?.odometroInicialKm ?? null,
          horasMotorInicial: meta?.horasMotorInicial ?? null
        },
        cookies: metaResult.cookies || session.cookies
      });

      if (Array.isArray(configurationResult.cookies) && configurationResult.cookies.length > 0) {
        updateSession(sessionId, { cookies: configurationResult.cookies });
      }

      if (configurationResult.isLoginScreen) {
        return res.status(401).json({
          ok: false,
          code: 'SESSION_EXPIRED',
          message: 'La sesion del portal expiro o ya no es valida para editar el dispositivo.'
        });
      }

      configurationSaved =
        configurationResult.ok === true &&
        (!configurationResult.payload || typeof configurationResult.payload !== 'object' || configurationResult.payload.ok === true);
    }

    const monitorResult = await saveMonitorMeta({
      deviceId,
      vehicleName,
      cookies:
        configurationResult?.cookies ||
        metaResult.cookies ||
        session.cookies
    });

    if (Array.isArray(monitorResult.cookies) && monitorResult.cookies.length > 0) {
      updateSession(sessionId, { cookies: monitorResult.cookies });
    }

    if (monitorResult.isLoginScreen) {
      return res.status(401).json({
        ok: false,
        code: 'SESSION_EXPIRED',
        message: 'La sesion del portal expiro o ya no es valida para editar el dispositivo.'
      });
    }

    const monitorSaved =
      monitorResult.ok === true &&
      (!monitorResult.payload || typeof monitorResult.payload !== 'object' || monitorResult.payload.ok === true);

    if (!configurationSaved && !monitorSaved) {
      return res.status(502).json({
        ok: false,
        code: 'DEVICE_META_REJECTED',
        message: 'La plataforma no confirmo la actualizacion del dispositivo.',
        data: {
          configurationStatus: configurationResult?.status || null,
          configurationPayload: configurationResult?.payload || null,
          monitorStatus: monitorResult?.status || null,
          monitorPayload: monitorResult?.payload || null
        }
      });
    }

    return res.json({
      ok: true,
      mode: session.mode,
      data: {
        ok: true,
        vehicleName,
        imei,
        savedInConfiguration: configurationSaved,
        savedInMonitor: monitorSaved,
        platform: configurationResult?.payload || monitorResult?.payload || null
      }
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      code: 'DEVICE_META_PROXY_ERROR',
      message: error?.message || 'No se pudo actualizar el dispositivo en el portal.'
    });
  }
});

router.get('/geocode/reverse', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_COORDINATES',
      message: 'lat y lon son obligatorios y deben ser numericos.'
    });
  }

  if (!config.geocodeEnabled) {
    return res.status(503).json({
      ok: false,
      code: 'GEOCODE_DISABLED',
      message: 'La geocodificacion esta deshabilitada en backend.'
    });
  }

  try {
    const address = await geocodeCacheService.getAddressAsync(lat, lon);
    return res.json({
      ok: true,
      data: {
        lat,
        lon,
        address: address || null
      }
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      code: 'GEOCODE_ERROR',
      message: error?.message || 'No fue posible resolver direccion.'
    });
  }
});

module.exports = router;
