const express = require('express');
const mockData = require('../data/mockDashboard');
const { getSession } = require('../services/sessionStore');
const { fetchPlatform } = require('../services/platformClient');
const config = require('../config');
const geocodeCacheService = require('../services/geocodeCacheService');

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

  const items = rawItems
    .map((item, index) => {
      const polygon = Array.isArray(item?.points)
        ? item.points.map((point) => ({
            lat: Number(point?.lat ?? point?.latitude ?? point?.Lat ?? point?.Latitude),
            lon: Number(point?.lon ?? point?.longitude ?? point?.Lon ?? point?.Longitude)
          })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))
        : [];

      const centerLat = Number(item?.centerLat ?? item?.lat ?? item?.latitude ?? item?.Lat ?? item?.Latitude);
      const centerLon = Number(item?.centerLon ?? item?.lon ?? item?.longitude ?? item?.Lon ?? item?.Longitude);
      const radiusMeters = Number(item?.radiusMeters ?? item?.radius ?? item?.RadiusMeters ?? item?.Radius ?? 0);

      return {
        geofenceId: String(item?.geofenceId ?? item?.GeofenceId ?? item?.id ?? item?.Id ?? `geofence-${index + 1}`),
        name: item?.name ?? item?.Name ?? 'Geocerca',
        type: polygon.length >= 3 ? 'polygon' : 'circle',
        centerLat,
        centerLon,
        radiusMeters,
        points: polygon
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

function hasLiveCookies(session) {
  return Array.isArray(session?.cookies) && session.cookies.length > 0;
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
    const result = await fetchPlatform('/Monitoreo/Monitor?handler=Events', {
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
        code: looksLikeLogin ? 'SESSION_EXPIRED' : 'INVALID_EVENTS_RESPONSE',
        message: looksLikeLogin
          ? 'La sesion del portal expiro o ya no es valida para consultar eventos.'
          : 'El modulo de eventos respondio con un contenido inesperado.'
      });
    }

    const data = normalizeRecentEvents(payload, limit);
    await fillMissingAddresses(data.items);

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

  return res.status(501).json({
    ok: false,
    code: 'GEOFENCES_NOT_IMPLEMENTED',
    message: 'La carga real de geocercas aun no esta conectada al portal.'
  });
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
