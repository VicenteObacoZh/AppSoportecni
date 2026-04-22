(function () {
  function normalizeBaseUrl(value) {
    return String(value || '').trim().replace(/\/$/, '');
  }

  function readConfiguredBaseUrl() {
    if (typeof window === 'undefined') {
      return '';
    }

    const fromGlobal = normalizeBaseUrl(window.GPSRASTREO_BACKEND_URL);
    if (fromGlobal) {
      return fromGlobal;
    }

    try {
      const fromStorage = normalizeBaseUrl(window.localStorage?.getItem('gpsrastreo.backendBaseUrl'));
      if (fromStorage) {
        return fromStorage;
      }
    } catch {
      // no-op
    }

    try {
      const currentUrl = new URL(window.location.href);
      const fromQuery = normalizeBaseUrl(currentUrl.searchParams.get('backendBaseUrl'));
      if (fromQuery) {
        return fromQuery;
      }
    } catch {
      // no-op
    }

    return '';
  }

  function resolveBackendBaseUrl() {
    const fallback = 'http://localhost:4100/api';

    if (typeof window === 'undefined' || !window.location) {
      return fallback;
    }

    const configuredBaseUrl = readConfiguredBaseUrl();
    if (configuredBaseUrl) {
      return configuredBaseUrl;
    }

    const isNativeCapacitor = Boolean(
      window.Capacitor?.isNativePlatform?.() ||
      window.CapacitorAndroid ||
      window.webkit?.messageHandlers?.bridge
    );

    const isCapacitorApp =
      isNativeCapacitor ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:';

    if (isCapacitorApp) {
      return fallback;
    }

    return fallback;
  }

  function resolveBackendBaseUrlCandidates() {
    const primary = resolveBackendBaseUrl();
    const candidates = [primary];

    if (typeof window !== 'undefined') {
      const isAndroid = Boolean(window.CapacitorAndroid) || /Android/i.test(window.navigator?.userAgent || '');
      if (isAndroid) {
        candidates.push('http://10.0.2.2:4100/api');
      }
    }

    return [...new Set(candidates.map((item) => normalizeBaseUrl(item)).filter(Boolean))];
  }

  window.GpsRastreoConfig = {
    appName: 'GpsRastreo',
    backendBaseUrl: resolveBackendBaseUrl(),
    backendBaseUrlCandidates: resolveBackendBaseUrlCandidates(),
    apiBaseUrl: 'https://rastreo.soportecni.com',
    requestMode: 'cors',
    mockMode: false,
    endpoints: {
      health: '/health',
      login: '/auth/login',
      authSession: '/auth/session',
      authLatestSession: '/auth/latest-session',
      dashboard: '/dashboard',
      liveMonitorData: '/live/monitor/data',
      liveAlertsList: '/live/alerts/list',
      liveMonitorRoute: '/live/monitor/route',
      liveMonitorCommand: '/live/monitor/command',
      liveMonitorDeviceMeta: '/live/monitor/device-meta',
      liveEventsRecent: '/live/monitor/events/recent',
      liveGeofences: '/live/monitor/geofences',
      liveFuelConsumptionReport: '/live/reports/fuel-consumption',
      liveGenerateReport: '/live/reports/generate',
      liveDownloadReport: '/live/reports/download',
      liveShareLink: '/live/share-link'
    }
  };
})();
