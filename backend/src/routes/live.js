const express = require('express');
const mockData = require('../data/mockDashboard');
const { getSession } = require('../services/sessionStore');
const { fetchPlatform } = require('../services/platformClient');

const router = express.Router();

function buildMonitorSummary(payload) {
  const devices = Array.isArray(payload?.devices) ? payload.devices : [];
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
    .map((item) => {
      const lat = Number(item?.latitude ?? item?.lat ?? item?.Latitude ?? item?.Lat);
      const lon = Number(item?.longitude ?? item?.lon ?? item?.Longitude ?? item?.Lon);
      const speedKmh = Number(item?.speedKmh ?? item?.speed ?? item?.SpeedKmh ?? item?.Speed ?? 0);

      return {
        lat,
        lon,
        speedKmh,
        fixTime: item?.fixTime ?? item?.FixTime ?? item?.deviceTime ?? item?.DeviceTime ?? null,
        address: item?.address ?? item?.Address ?? null
      };
    })
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));

  return {
    source: 'monitor-route',
    points: normalized,
    summary: {
      total: normalized.length,
      moving: normalized.filter((item) => item.speedKmh > 3).length
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
        address: item?.address ?? item?.Address ?? item?.direccion ?? item?.Direccion ?? null,
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

function hasLiveCookies(session) {
  return Array.isArray(session?.cookies) && session.cookies.length > 0;
}

router.get('/monitor/data', async (req, res) => {
  const sessionId = String(req.query.sessionId || '').trim();
  if (!sessionId) {
    return res.status(400).json({
      ok: false,
      message: 'sessionId es obligatorio.'
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      ok: false,
      message: 'Sesion valida no encontrada.'
    });
  }

  if (session.mode === 'mock') {
    return res.json({
      ok: true,
      mode: 'mock',
      data: buildMockMonitorSummary()
    });
  }

  if (!hasLiveCookies(session)) {
    return res.status(404).json({
      ok: false,
      message: 'Sesion valida no encontrada.'
    });
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

    return res.json({
      ok: true,
      mode: session.mode,
      data: buildMonitorSummary(payload)
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
    return res.status(400).json({
      ok: false,
      message: 'sessionId es obligatorio.'
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      ok: false,
      message: 'Sesion valida no encontrada.'
    });
  }

  if (session.mode === 'mock') {
    return res.json({
      ok: true,
      mode: 'mock',
      data: buildMockAlertsSummary()
    });
  }

  if (!hasLiveCookies(session)) {
    return res.status(404).json({
      ok: false,
      message: 'Sesion valida no encontrada.'
    });
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
      message: 'sessionId, deviceId, from y to son obligatorios.'
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      ok: false,
      message: 'Sesion valida no encontrada.'
    });
  }

  if (session.mode === 'mock') {
    return res.json({
      ok: true,
      mode: 'mock',
      data: buildMockRouteSummary()
    });
  }

  if (!hasLiveCookies(session)) {
    return res.status(404).json({
      ok: false,
      message: 'Sesion valida no encontrada.'
    });
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
    return res.status(400).json({
      ok: false,
      message: 'sessionId es obligatorio.'
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      ok: false,
      message: 'Sesion valida no encontrada.'
    });
  }

  if (session.mode === 'mock') {
    return res.json({
      ok: true,
      mode: 'mock',
      data: buildMockEventsSummary(limit)
    });
  }

  if (!hasLiveCookies(session)) {
    return res.status(404).json({
      ok: false,
      message: 'Sesion valida no encontrada.'
    });
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

    return res.json({
      ok: true,
      mode: session.mode,
      data: normalizeRecentEvents(payload, limit)
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      message: error.message
    });
  }
});

module.exports = router;
