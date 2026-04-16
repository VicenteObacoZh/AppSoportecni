(function () {
  function resolveBackendBaseUrl() {
    const fallback = 'http://localhost:4100/api';

    if (typeof window === 'undefined' || !window.location) {
      return fallback;
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
      return 'http://localhost:4100/api';
    }

    return fallback;
  }

  window.GpsRastreoConfig = {
    appName: 'GpsRastreo',
    backendBaseUrl: resolveBackendBaseUrl(),
    apiBaseUrl: 'https://rastreo.soportecni.com',
    requestMode: 'cors',
    mockMode: false,
    endpoints: {
      health: '/health',
      login: '/auth/login',
      dashboard: '/dashboard',
      liveMonitorData: '/live/monitor/data'
    }
  };
})();
