const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const defaultApkPath = path.resolve(__dirname, '../../android/app/build/outputs/apk/debug/app-debug.apk');

module.exports = {
  port: Number(process.env.PORT || 4100),
  appName: process.env.APP_NAME || 'GpsRastreo Backend',
  platformBaseUrl: process.env.PLATFORM_BASE_URL || 'https://rastreo.soportecni.com',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || process.env.PUBLIC_SHARE_BASE_URL || '',
  publicShareBaseUrl: process.env.PUBLIC_SHARE_BASE_URL || '',
  apkFilePath: process.env.APK_FILE_PATH || defaultApkPath,
  apkDisplayName: process.env.APK_DISPLAY_NAME || 'GpsRastreo.apk',
  mockMode: String(process.env.MOCK_MODE || 'false').toLowerCase() === 'true',
  sessionTtlMinutes: Math.max(5, Number(process.env.SESSION_TTL_MINUTES || 480)),
  geocodeEnabled: String(process.env.GEOCODE_ENABLED || 'true').toLowerCase() === 'true',
  geocodeMaxPerRequest: Math.max(1, Number(process.env.GEOCODE_MAX_PER_REQUEST || 25))
};
