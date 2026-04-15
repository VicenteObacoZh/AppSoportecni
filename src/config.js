window.GpsRastreoConfig = {
  appName: 'GpsRastreo',
  backendBaseUrl: 'http://localhost:4100/api',
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
