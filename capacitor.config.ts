import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.soportecni.gpsrastreo',
  appName: 'GpsRastreo',
  webDir: 'www',
  server: {
    androidScheme: 'http'
  },
  bundledWebRuntime: false
};

export default config;
