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

    //try {
    //  const fromStorage = normalizeBaseUrl(window.localStorage?.getItem('gpsrastreo.backendBaseUrl'));
    //  if (fromStorage) {
    //    return fromStorage;
    //  }
    // } catch {
      // no-op
    //}

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
    const productionFallback = 'https://rastreo.soportecni.com/api';

    if (typeof window === 'undefined' || !window.location) {
      return productionFallback;
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
      return productionFallback;
    }

    return productionFallback;
  }

  function resolveBackendBaseUrlCandidates() {
    const primary = resolveBackendBaseUrl();
    const productionFallback = 'https://rastreo.soportecni.com/api';
    const configuredBaseUrl = readConfiguredBaseUrl();
    const candidates = [];

    if (configuredBaseUrl) {
      candidates.push(primary);
    } else if (typeof window !== 'undefined') {
      candidates.push(primary || 'https://rastreo.soportecni.com');
      candidates.push(productionFallback);
    } else {
      candidates.push(primary);
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
      authChangePassword: '/auth/change-password',
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
