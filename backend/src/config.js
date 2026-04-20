const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 4100),
  appName: process.env.APP_NAME || 'GpsRastreo Backend',
  platformBaseUrl: process.env.PLATFORM_BASE_URL || 'https://rastreo.soportecni.com',
  mockMode: String(process.env.MOCK_MODE || 'true').toLowerCase() === 'true',
  sessionTtlMinutes: Math.max(5, Number(process.env.SESSION_TTL_MINUTES || 480))
};
