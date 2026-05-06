(function () {
  const config = window.GpsRastreoConfig || {};
  const DEBUG_PERFORMANCE = Boolean(config.debugPerformance || window.DEBUG_PERFORMANCE === true);
  const MONITOR_CACHE_TTL_MS = Number(config.monitorCacheTtlMs || 12000);
  const monitorCache = {
    sessionId: '',
    timestamp: 0,
    payload: null,
    promise: null
  };
  const reverseGeocodeCacheByKey = new Map();
  const reverseGeocodePendingByKey = new Map();

  function perfLog(label, detail = {}) {
    if (!DEBUG_PERFORMANCE) {
      return;
    }

    console.debug(`[Perf] ${label}`, detail);
  }

  function perfNow() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  function perfMeasure(label, start, detail = {}) {
    perfLog(label, {
      ...detail,
      ms: Math.round(perfNow() - start)
    });
  }

  function parseDeviceDateTime(value) {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    let raw = String(value || '').trim();
    if (!raw) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)) {
      raw = `${raw.replace(' ', 'T')}Z`;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDeviceDateTime(value) {
    const parsed = parseDeviceDateTime(value);
    if (!parsed) {
      return '--';
    }

    return new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(parsed);
  }

  function syncRuntimeMode(payload) {
    const mode = String(payload?.mode || '').trim().toLowerCase();
    if (!mode) {
      return;
    }

    config.mockMode = mode === 'mock';
    config.runtimeMode = mode;

    if (payload?.sessionTtlMinutes) {
      config.sessionTtlMinutes = Number(payload.sessionTtlMinutes);
    }

    if (payload?.capabilities && typeof payload.capabilities === 'object') {
      config.capabilities = payload.capabilities;
    }
  }

  function normalizeBaseUrl(value) {
    return String(value || '').trim().replace(/\/$/, '');
  }

  function isLoopbackBaseUrl(value) {
    const normalized = normalizeBaseUrl(value);
    if (!normalized) {
      return false;
    }

    try {
      const parsed = new URL(normalized);
      const host = String(parsed.hostname || '').toLowerCase();
      return host === 'localhost' || host === '127.0.0.1';
    } catch {
      return false;
    }
  }

  function getBackendBaseUrls() {
    const candidates = [];
    const configuredCandidates = Array.isArray(config.backendBaseUrlCandidates)
      ? config.backendBaseUrlCandidates
      : [];

    configuredCandidates.forEach((item) => {
      const normalized = normalizeBaseUrl(item);
      if (normalized) {
        candidates.push(normalized);
      }
    });

    const primary = normalizeBaseUrl(config.backendBaseUrl);
    if (primary) {
      candidates.unshift(primary);
    }

    return [...new Set(candidates)];
  }

  function resolveReportDownloadBaseUrl() {
    const candidates = getBackendBaseUrls();
    const primary = candidates[0] || '';
    const isNativeCapacitor = Boolean(
      window.Capacitor?.isNativePlatform?.() ||
      window.CapacitorAndroid ||
      window.webkit?.messageHandlers?.bridge
    );

    if (!isNativeCapacitor) {
      return primary;
    }

    const preferred = candidates.find((item) => !isLoopbackBaseUrl(item));
    return preferred || primary;
  }

  function buildUrl(path, baseUrl) {
    const base = normalizeBaseUrl(baseUrl || config.backendBaseUrl);
    const cleanPath = (path || '').startsWith('/') ? path : `/${path || ''}`;
    return `${base}${cleanPath}`;
  }

  function getStoredSessionId() {
    try {
      return window.localStorage.getItem('gpsrastreo.sessionId');
    } catch {
      return null;
    }
  }

  function storeSessionId(sessionId) {
    try {
      if (sessionId) {
        window.localStorage.setItem('gpsrastreo.sessionId', sessionId);
      }
    } catch {
      // no-op
    }
  }

  function clearStoredSessionId() {
    try {
      window.localStorage.removeItem('gpsrastreo.sessionId');
    } catch {
      // no-op
    }
  }

  function storeSelectedEvent(eventItem) {
    try {
      if (eventItem) {
        window.localStorage.setItem('gpsrastreo.selectedEvent', JSON.stringify(eventItem));
      }
    } catch {
      // no-op
    }
  }

  function getSelectedEvent() {
    try {
      const raw = window.localStorage.getItem('gpsrastreo.selectedEvent');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearSelectedEvent() {
    try {
      window.localStorage.removeItem('gpsrastreo.selectedEvent');
    } catch {
      // no-op
    }
  }

  function storeSelectedDevice(device) {
    try {
      if (device) {
        window.localStorage.setItem('gpsrastreo.selectedDevice', JSON.stringify(device));
      }
    } catch {
      // no-op
    }
  }

  function getSelectedDevice() {
    try {
      const raw = window.localStorage.getItem('gpsrastreo.selectedDevice');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearSelectedDevice() {
    try {
      window.localStorage.removeItem('gpsrastreo.selectedDevice');
    } catch {
      // no-op
    }
  }

  function storeRouteContext(routeContext) {
    try {
      if (routeContext) {
        window.localStorage.setItem('gpsrastreo.routeContext', JSON.stringify(routeContext));
      }
    } catch {
      // no-op
    }
  }

  function getRouteContext() {
    try {
      const raw = window.localStorage.getItem('gpsrastreo.routeContext');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearRouteContext() {
    try {
      window.localStorage.removeItem('gpsrastreo.routeContext');
    } catch {
      // no-op
    }
  }

  function clearOperationalState() {
    clearStoredSessionId();
    clearSelectedEvent();
    clearSelectedDevice();
    clearRouteContext();
  }

  function clearSavedCredentials() {
    try {
      window.localStorage.removeItem('gpsrastreo.savedCredentials');
    } catch {
      // no-op
    }
  }

  function markManualLogout() {
    try {
      window.localStorage.setItem('gpsrastreo.manualLogout', '1');
    } catch {
      // no-op
    }
  }

  function clearManualLogout() {
    try {
      window.localStorage.removeItem('gpsrastreo.manualLogout');
    } catch {
      // no-op
    }
  }

  function hasManualLogout() {
    try {
      return window.localStorage.getItem('gpsrastreo.manualLogout') === '1';
    } catch {
      return false;
    }
  }

  async function changePasswordBySession(sessionId, payload = {}) {
    return request(config.endpoints.authChangePassword || '/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId,
        ...payload
      })
    });
  }

  function emitClientEvent(name, detail = {}) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
      return;
    }

    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch {
      // no-op
    }
  }

  function normalizeClientError(rawError, fallbackCode = 'REQUEST_FAILED') {
    const source = rawError || {};
    const error = source instanceof Error
      ? source
      : new Error(String(source.message || source || 'Error de solicitud.'));

    if (!error.code) {
      error.code = source.code || source?.payload?.code || fallbackCode;
    }
    if (typeof error.status !== 'number' && typeof source.status === 'number') {
      error.status = source.status;
    }
    if (!error.payload && source.payload) {
      error.payload = source.payload;
    }

    return error;
  }

  function isSessionError(error) {
    const code = String(error?.code || error?.payload?.code || '').toUpperCase();
    if (code === 'SESSION_EXPIRED' || code === 'SESSION_NOT_FOUND' || code === 'SESSION_REQUIRED') {
      return true;
    }

    return error?.status === 401 || error?.status === 404;
  }

  function isNetworkError(error) {
    const code = String(error?.code || '').toUpperCase();
    return code === 'BACKEND_UNAVAILABLE' || code === 'FETCH_FAILED';
  }

  function getUserMessageFromError(error) {
    if (isSessionError(error)) {
      return 'Tu sesion expiro o no es valida. Vuelve a iniciar sesion.';
    }

    if (isNetworkError(error)) {
      return 'No se pudo conectar con el backend del servicio. Verifica internet y servidor.';
    }

    return String(error?.payload?.message || error?.message || 'No fue posible completar la solicitud.');
  }

  function handleClientError(rawError, options = {}) {
    const {
      context = 'request',
      emit = true,
      clearOnSession = true
    } = options;

    const error = normalizeClientError(rawError);
    const userMessage = getUserMessageFromError(error);
    error.userMessage = userMessage;

    if (isSessionError(error) && clearOnSession) {
      clearOperationalState();
    }

    if (emit) {
      if (isSessionError(error)) {
        emitClientEvent('gpsrastreo:session-expired', {
          context,
          code: error.code || 'SESSION_EXPIRED',
          status: error.status || null,
          message: userMessage
        });
      } else if (isNetworkError(error)) {
        emitClientEvent('gpsrastreo:network-error', {
          context,
          code: error.code || 'BACKEND_UNAVAILABLE',
          status: error.status || null,
          message: userMessage
        });
      } else {
        emitClientEvent('gpsrastreo:request-error', {
          context,
          code: error.code || 'REQUEST_FAILED',
          status: error.status || null,
          message: userMessage
        });
      }
    }

    return error;
  }

  function ensureSessionId() {
    const sessionId = getStoredSessionId();
    if (!sessionId) {
      const error = normalizeClientError({
        code: 'SESSION_REQUIRED',
        status: 401,
        message: 'Necesitas iniciar sesion para continuar.'
      });
      throw handleClientError(error, {
        context: 'ensure-session',
        emit: true,
        clearOnSession: true
      });
    }

    return sessionId;
  }

  async function requestJson(path, options) {
    const backendBaseUrls = getBackendBaseUrls();
    let lastNetworkError = null;

    for (const baseUrl of backendBaseUrls) {
      const requestUrl = buildUrl(path, baseUrl);
      let response;

      try {
        response = await fetch(requestUrl, {
          method: 'GET',
          mode: config.requestMode || 'cors',
          headers: {
            'Content-Type': 'application/json'
          },
          ...options
        });
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw error;
        }
        lastNetworkError = { error, requestUrl };
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        error.payload = payload;
        error.code = payload?.code || '';
        error.context = 'http';
        throw error;
      }

      config.backendBaseUrl = baseUrl;
      return payload;
    }

    if (lastNetworkError) {
      const networkError = new Error(`No se pudo conectar con ${lastNetworkError.requestUrl}. ${lastNetworkError.error?.message || 'Revisa backend y red del servicio.'}`);
      networkError.code = 'BACKEND_UNAVAILABLE';
      networkError.cause = lastNetworkError.error;
      networkError.context = 'network';
      throw networkError;
    }

    throw new Error('No hay backendBaseUrl configurado para la aplicacion.');
  }

  async function request(path, options) {
    return requestJson(path, options);
  }

  function parseFileNameFromDisposition(disposition) {
    const source = String(disposition || '');
    const utfMatch = source.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) {
      try {
        return decodeURIComponent(utfMatch[1]);
      } catch {
        return utfMatch[1];
      }
    }

    const basicMatch = source.match(/filename="?([^";]+)"?/i);
    return basicMatch?.[1] ? basicMatch[1].trim() : null;
  }

  async function requestBinary(path, options) {
    const backendBaseUrls = getBackendBaseUrls();
    let lastNetworkError = null;

    for (const baseUrl of backendBaseUrls) {
      const requestUrl = buildUrl(path, baseUrl);
      let response;

      try {
        response = await fetch(requestUrl, {
          method: 'GET',
          mode: config.requestMode || 'cors',
          ...options
        });
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw error;
        }
        lastNetworkError = { error, requestUrl };
        continue;
      }

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!response.ok) {
        let payload = null;
        if (contentType.includes('application/json')) {
          try {
            payload = await response.json();
          } catch {
            payload = null;
          }
        } else {
          try {
            payload = await response.text();
          } catch {
            payload = null;
          }
        }

        const error = new Error(
          String(payload?.message || payload?.error || payload || `HTTP ${response.status}`)
        );
        error.status = response.status;
        error.payload = payload;
        error.code = payload?.code || '';
        error.context = 'http';
        throw error;
      }

      config.backendBaseUrl = baseUrl;
      return {
        blob: await response.blob(),
        contentType,
        fileName: parseFileNameFromDisposition(response.headers.get('content-disposition')),
        status: response.status
      };
    }

    if (lastNetworkError) {
      const networkError = new Error(`No se pudo conectar con ${lastNetworkError.requestUrl}. ${lastNetworkError.error?.message || 'Revisa backend y red del servicio.'}`);
      networkError.code = 'BACKEND_UNAVAILABLE';
      networkError.cause = lastNetworkError.error;
      networkError.context = 'network';
      throw networkError;
    }

    throw new Error('No hay backendBaseUrl configurado para la aplicacion.');
  }

  async function getLiveAlerts(sessionId, options = {}) {
    const { allowSessionMiss = false } = options;
    try {
      const payload = await request(`${config.endpoints.liveAlertsList || '/live/alerts/list'}?sessionId=${encodeURIComponent(sessionId)}`);
      return payload?.data || null;
    } catch (error) {
      if (allowSessionMiss && (error.status === 404 || error.status === 401)) {
        return null;
      }

      throw error;
    }
  }

  async function getLiveRoute(sessionId, deviceId, from, to) {
    const query = new URLSearchParams({
      sessionId,
      deviceId: String(deviceId),
      from,
      to
    });

    const payload = await request(`${config.endpoints.liveMonitorRoute || '/live/monitor/route'}?${query.toString()}`);
    return payload?.data || null;
  }

  async function getRecentEventsBySession(sessionId, limit = 30) {
    const query = new URLSearchParams({
      sessionId,
      limit: String(limit)
    });

    const payload = await request(`${config.endpoints.liveEventsRecent || '/live/monitor/events/recent'}?${query.toString()}`);
    return payload?.data || {
      items: [],
      summary: { total: 0 }
    };
  }

  async function getGeofencesBySession(sessionId) {
    const query = new URLSearchParams({
      sessionId
    });

    const payload = await request(`${config.endpoints.liveGeofences || '/live/monitor/geofences'}?${query.toString()}`);
    return payload?.data || {
      available: false,
      items: [],
      summary: { total: 0 }
    };
  }

  async function getFuelConsumptionReportBySession(sessionId, deviceId, from, to) {
    const query = new URLSearchParams({
      sessionId,
      deviceId: String(deviceId),
      from,
      to
    });

    const payload = await request(`${config.endpoints.liveFuelConsumptionReport || '/live/reports/fuel-consumption'}?${query.toString()}`);
    return payload?.data || null;
  }

  async function getMonitorPayloadBySession(sessionId, options = {}) {
    const force = Boolean(options.force);
    const now = Date.now();

    if (
      !force &&
      monitorCache.sessionId === sessionId &&
      monitorCache.payload &&
      now - monitorCache.timestamp < MONITOR_CACHE_TTL_MS
    ) {
      perfLog('monitor/data cache hit', {
        ageMs: now - monitorCache.timestamp
      });
      return monitorCache.payload;
    }

    if (!force && monitorCache.sessionId === sessionId && monitorCache.promise) {
      perfLog('monitor/data pending reuse');
      return monitorCache.promise;
    }

    const query = new URLSearchParams({
      sessionId,
      resolveAddresses: 'false',
      mobile: 'true'
    });
    const started = perfNow();

    monitorCache.sessionId = sessionId;
    monitorCache.promise = request(`${config.endpoints.liveMonitorData || '/live/monitor/data'}?${query.toString()}`)
      .then((payload) => {
        monitorCache.payload = payload;
        monitorCache.timestamp = Date.now();
        syncRuntimeMode(payload);
        perfMeasure('monitor/data request', started, {
          devices: payload?.data?.devices?.length || 0
        });
        return payload;
      })
      .finally(() => {
        monitorCache.promise = null;
      });

    return monitorCache.promise;
  }

  function buildDashboardFromMonitor(live, sessionId, liveAlerts = null) {
    const alertItems = Array.isArray(liveAlerts?.items) ? liveAlerts.items : [];
    const activeAlerts = alertItems.filter((item) => item?.activo);
    const topAlert = activeAlerts[0] || alertItems[0] || null;

    return {
      kpis: [
        { label: 'Unidades visibles', value: String(live.summary.total), detail: 'Dispositivos cargados desde Monitor?handler=Data.' },
        { label: 'En movimiento', value: String(live.summary.moving), detail: 'Velocidad mayor a 3 km/h en la ultima lectura.' },
        { label: 'Con ubicacion', value: String(live.summary.withLocation), detail: 'Unidades con latitud y longitud disponibles.' },
        { label: 'Empresas', value: String(live.summary.companies), detail: 'Empresas visibles dentro del alcance del usuario.' },
        { label: 'Alertas activas', value: String(liveAlerts?.summary?.active ?? 0), detail: 'Configuraciones activas detectadas en el modulo Alertas.' },
        { label: 'Tipos de alerta', value: String(liveAlerts?.summary?.types ?? 0), detail: 'Variedad de reglas activas disponibles para la operacion.' }
      ],
      alerts: (alertItems.length > 0
        ? alertItems.slice(0, 6).map((item) => ({
            time: item.activo ? 'activa' : 'inactiva',
            title: item.nombre || 'Alerta',
            detail: `${item.tipo || 'Sin tipo'} | ${item.dispositivos || 0} dispositivos vinculados`,
            badge: item.activo ? 'Activa' : 'Inactiva',
            tone: item.activo ? 'success' : 'muted'
          }))
        : [
            { time: 'live', title: `Usuario autenticado: ${live.userName || 'sin nombre visible'}` },
            { time: 'live', title: `Empresa activa: ${live.empresaNombre || 'sin empresa'}` },
            { time: 'live', title: `Cliente portal: ${live.clienteId || 'sin cliente'}` },
            { time: 'live', title: `Dispositivos procesados: ${live.afterCount || live.summary.total}` }
          ]),
      roadmap: [
        { area: 'Monitor', detail: 'Sesion real conectada al handler Data del monitor.' },
        { area: 'Alertas', detail: liveAlerts ? 'Modulo Alertas conectado con handler List.' : 'Alertas diferidas para no bloquear dispositivos/mapa.' },
        { area: 'Mapa', detail: 'Pintando dispositivos reales sobre Leaflet en la nueva interfaz.' },
        { area: 'Siguiente paso', detail: 'Consumir rutas, eventos detallados y geocercas reales con la misma sessionId.' }
      ],
      devices: live.devices || [],
      highlightedUnit: live.devices?.[0]
        ? {
            name: live.devices[0].vehicleName || live.devices[0].name || 'Primera unidad visible',
            detail: `IMEI ${live.devices[0].uniqueId || '-'} | ${live.devices[0].groupName || 'Sin empresa'}`
          }
        : {
            name: 'Sin unidades',
            detail: 'La sesion esta activa pero no devolvio dispositivos.'
          },
      latestAlert: {
        title: topAlert
          ? `${topAlert.nombre || 'Alerta'}`
          : 'Monitor real conectado',
        detail: topAlert
          ? `${topAlert.tipo || 'Sin tipo'} | ${topAlert.dispositivos || 0} dispositivos | ${topAlert.activo ? 'Activa' : 'Inactiva'}`
          : `La sesion ${sessionId.slice(0, 8)}... ya puede consultar datos autenticados del portal.`
      },
      alertSummary: liveAlerts?.summary || null
    };
  }

  async function getMonitorDashboard(options = {}) {
    const sessionId = ensureSessionId();
    let payload;

    try {
      payload = await getMonitorPayloadBySession(sessionId, options);
    } catch (error) {
      throw handleClientError(error, {
        context: 'dashboard-monitor-data',
        emit: true,
        clearOnSession: true
      });
    }

    if (payload?.ok && payload?.data) {
      return buildDashboardFromMonitor(payload.data, sessionId, null);
    }

    const fallback = await request(config.endpoints.dashboard || '/dashboard');
    return fallback.data || fallback;
  }

  async function reverseGeocode(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  if (reverseGeocodeCacheByKey.has(cacheKey)) {
    perfLog('reverse geocode cache hit', { key: cacheKey });
    return reverseGeocodeCacheByKey.get(cacheKey);
  }
  if (reverseGeocodePendingByKey.has(cacheKey)) {
    perfLog('reverse geocode pending reuse', { key: cacheKey });
    return reverseGeocodePendingByKey.get(cacheKey);
  }

  const query = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude)
  });

  const sessionId = getStoredSessionId();
  if (sessionId) {
    query.set('sessionId', sessionId);
  }

  function readAddressFromPayload(payload) {
    if (typeof payload === 'string') {
      const text = payload.trim();

      if (
        text &&
        text !== '[object Object]' &&
        !text.startsWith('{') &&
        !text.startsWith('<')
      ) {
        return text;
      }

      return null;
    }

    const candidates = [
      payload?.data?.address,
      payload?.data?.direccion,
      payload?.data?.formattedAddress,
      payload?.address,
      payload?.direccion,
      payload?.formattedAddress,
      payload?.result,
      payload?.data
    ];

    for (const value of candidates) {
      const text = String(value || '').trim();

      if (
        text &&
        text !== '[object Object]' &&
        !text.startsWith('{') &&
        !text.startsWith('<')
      ) {
        return text;
      }
    }

    return null;
  }

  async function tryResolve(path) {
    try {
      const payload = await request(`${path}?${query.toString()}`);
      return readAddressFromPayload(payload);
    } catch {
      return null;
    }
  }

  const started = perfNow();
  const pending = (async () => {
    const resolved = await tryResolve('/live/geocode/reverse')
      || await tryResolve('/geocode/reverse')
      || null;
    if (resolved) {
      reverseGeocodeCacheByKey.set(cacheKey, resolved);
    }
    perfMeasure('reverse geocode', started, {
      key: cacheKey,
      hit: Boolean(resolved)
    });
    return resolved;
  })();

  reverseGeocodePendingByKey.set(cacheKey, pending);
  try {
    return await pending;
  } finally {
    reverseGeocodePendingByKey.delete(cacheKey);
  }
}
 
async function sendCommandBySession(sessionId, { deviceId, command, authorizationKey }) {
    const payload = await request(config.endpoints.liveMonitorCommand || '/live/monitor/command', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        deviceId,
        command,
        authorizationKey
      })
    });

    return payload?.data || payload || null;
  }

  async function updateDeviceMetaBySession(sessionId, { deviceId, vehicleName, uniqueId, signal }) {
    const payload = await request(config.endpoints.liveMonitorDeviceMeta || '/live/monitor/device-meta', {
      method: 'POST',
      signal,
      body: JSON.stringify({
        sessionId,
        deviceId,
        vehicleName,
        uniqueId
      })
    });

    return payload?.data || payload || null;
  }

  async function createShareLinkBySession(sessionId, { deviceId, deviceName, durationMinutes }) {
    const payload = await request(config.endpoints.liveShareLink || '/live/share-link', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        deviceId,
        deviceName,
        durationMinutes
      })
    });

    return payload?.data || null;
  }

  async function generateReportBySession(sessionId, reportRequest = {}) {
    return requestBinary(config.endpoints.liveGenerateReport || '/live/reports/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId,
        ...reportRequest
      })
    });
  }

  function buildReportDownloadUrlBySession(sessionId, reportRequest = {}) {
    const query = new URLSearchParams({
      sessionId,
      type: String(reportRequest?.type || ''),
      format: String(reportRequest?.format || 'PDF'),
      title: String(reportRequest?.title || 'Reporte'),
      from: String(reportRequest?.from || ''),
      to: String(reportRequest?.to || ''),
      fromLabel: String(reportRequest?.fromLabel || ''),
      toLabel: String(reportRequest?.toLabel || ''),
      deviceId: String(
        Array.isArray(reportRequest?.deviceIds)
          ? reportRequest.deviceIds[0]
          : (reportRequest?.deviceId || '')
      ),
      stopMinMinutes: String(reportRequest?.stopMinMinutes ?? 3),
      stopSpeedKmh: String(reportRequest?.stopSpeedKmh ?? 1)
    });

    const baseUrl = resolveReportDownloadBaseUrl();
    return buildUrl(`${config.endpoints.liveDownloadReport || '/live/reports/download'}?${query.toString()}`, baseUrl);
  }

  window.GpsRastreoApi = {
    async checkPlatform() {
      const payload = await request(config.endpoints.health || '/health', { method: 'GET' });
      syncRuntimeMode(payload);
      return {
        isAvailable: payload.ok,
        isLoginScreen: Boolean(payload.isLoginScreen ?? true),
        mode: payload.mode || (config.mockMode ? 'mock' : 'live'),
        capabilities: payload.capabilities || null,
        sessionTtlMinutes: payload.sessionTtlMinutes || null
      };
    },

    async login(credentials) {
      const payload = await request(config.endpoints.login || '/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      syncRuntimeMode(payload);
      if (payload?.sessionId) {
        clearManualLogout();
        storeSessionId(payload.sessionId);
      }
      return payload;
    },

    async changePassword(passwordData) {
      const sessionId = ensureSessionId();

      try {
        return await changePasswordBySession(sessionId, passwordData || {});
      } catch (error) {
        throw handleClientError(error, {
          context: 'change-password',
          emit: true,
          clearOnSession: true
        });
      }
    },

    async getMonitorDashboard(options = {}) {
      return getMonitorDashboard(options);
    },

    async getDashboard() {
      const sessionId = ensureSessionId();

      if (sessionId) {
        let payload;
        try {
          payload = await getMonitorPayloadBySession(sessionId);
        } catch (error) {
          throw handleClientError(error, {
            context: 'dashboard-monitor-data',
            emit: true,
            clearOnSession: true
          });
        }

        if (payload?.ok && payload?.data) {
          const live = payload.data;
          let liveAlerts = null;
          try {
            liveAlerts = await getLiveAlerts(sessionId, { allowSessionMiss: true });
          } catch {
            liveAlerts = null;
          }
          return buildDashboardFromMonitor(live, sessionId, liveAlerts);
        }
      }

      const payload = await request(config.endpoints.dashboard || '/dashboard');
      return payload.data || payload;
    },

    async getAlerts() {
      const sessionId = ensureSessionId();

      let liveAlerts;
      try {
        liveAlerts = await getLiveAlerts(sessionId);
      } catch (error) {
        throw handleClientError(error, {
          context: 'alerts-list',
          emit: true,
          clearOnSession: true
        });
      }

      return liveAlerts || {
        summary: {
          total: 0,
          active: 0,
          inactive: 0,
          types: 0
        },
        items: []
      };
    },

    async getRoute(deviceId, from, to) {
      const sessionId = ensureSessionId();

      try {
        return await getLiveRoute(sessionId, deviceId, from, to);
      } catch (error) {
        throw handleClientError(error, {
          context: 'route-history',
          emit: true,
          clearOnSession: true
        });
      }
    },

    async sendCommand(commandData) {
      const sessionId = ensureSessionId();

      try {
        return await sendCommandBySession(sessionId, commandData || {});
      } catch (error) {
        throw handleClientError(error, {
          context: 'command-send',
          emit: true,
          clearOnSession: true
        });
      }
    },

    async updateDeviceName(deviceId, vehicleName, uniqueId, signal) {
      const sessionId = ensureSessionId();

      try {
        return await updateDeviceMetaBySession(sessionId, {
          deviceId,
          vehicleName,
          uniqueId,
          signal
        });
      } catch (error) {
        if (error?.name === 'AbortError') {
          const aborted = new Error('Operacion cancelada.');
          aborted.code = 'REQUEST_ABORTED';
          aborted.userMessage = 'Operacion cancelada.';
          throw aborted;
        }
        throw handleClientError(error, {
          context: 'device-meta-update',
          emit: true,
          clearOnSession: true
        });
      }
    },

    async getRecentEvents(limit = 30) {
      const sessionId = ensureSessionId();

      try {
        return await getRecentEventsBySession(sessionId, limit);
      } catch (error) {
        throw handleClientError(error, {
          context: 'events-recent',
          emit: true,
          clearOnSession: true
        });
      }
    },

    async getGeofences() {
      const sessionId = ensureSessionId();

      try {
        return await getGeofencesBySession(sessionId);
      } catch (error) {
        const handled = handleClientError(error, {
          context: 'geofences',
          emit: true,
          clearOnSession: true
        });

        if (handled.status === 501) {
          return {
            available: false,
            items: [],
            summary: { total: 0 }
          };
        }

        throw handled;
      }
    },

    async getFuelConsumptionReport(deviceId, from, to) {
      const sessionId = ensureSessionId();

      try {
        return await getFuelConsumptionReportBySession(sessionId, deviceId, from, to);
      } catch (error) {
        throw handleClientError(error, {
          context: 'fuel-consumption-report',
          emit: true,
          clearOnSession: true
        });
      }
    },

    async createShareLink(shareData) {
      const sessionId = ensureSessionId();

      try {
        return await createShareLinkBySession(sessionId, shareData || {});
      } catch (error) {
        throw handleClientError(error, {
          context: 'share-link',
          emit: true,
          clearOnSession: true
        });
      }
    },

    async generateReport(reportRequest) {
      const sessionId = ensureSessionId();

      try {
        return await generateReportBySession(sessionId, reportRequest || {});
      } catch (error) {
        throw handleClientError(error, {
          context: 'report-generate',
          emit: true,
          clearOnSession: true
        });
      }
    },

    buildReportDownloadUrl(reportRequest) {
      const sessionId = ensureSessionId();
      return buildReportDownloadUrlBySession(sessionId, reportRequest || {});
    },

    async reverseGeocode(lat, lon) {
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
        return null;
      }

      try {
        return await reverseGeocode(lat, lon);
      } catch {
        return null;
      }
    },

    async getSessionInfo() {
      const started = perfNow();
      const sessionId = getStoredSessionId();
      if (!sessionId) {
      if (hasManualLogout()) {
        return null;
      }
      try {
        const latest = await request(config.endpoints.authLatestSession || '/auth/latest-session');
        if (latest?.id) {
          syncRuntimeMode(latest);
          storeSessionId(latest.id);
          perfMeasure('session load', started, { source: 'latest-session' });
          return latest;
          }
        } catch (error) {
          // Si el backend no responde, propagamos error para que UI pueda mostrar estado de red.
          const handled = handleClientError(error, {
            context: 'session-latest',
            emit: true,
            clearOnSession: false
          });
          if (isSessionError(handled)) {
            return null;
          }
          throw handled;
        }

        return null;
      }

      try {
        const payload = await request(`${config.endpoints.authSession || '/auth/session'}/${encodeURIComponent(sessionId)}`);
        syncRuntimeMode(payload);
        perfMeasure('session load', started, { source: 'stored-session' });
        return payload;
      } catch (error) {
        const handled = handleClientError(error, {
          context: 'session-info',
          emit: true,
          clearOnSession: true
        });

        if (isSessionError(handled)) {
          return null;
        }
        throw handled;
      }
    },

    getStoredSessionId,
    storeSessionId,
    clearStoredSessionId,
    storeSelectedEvent,
    getSelectedEvent,
    clearSelectedEvent,
    storeSelectedDevice,
    getSelectedDevice,
    clearSelectedDevice,
    storeRouteContext,
    getRouteContext,
    clearRouteContext,
    clearOperationalState,
    clearSavedCredentials,
    markManualLogout,
    clearManualLogout,
    isSessionError,
    isNetworkError,
    getUserMessageFromError,
    formatDeviceDateTime
  };
})();
