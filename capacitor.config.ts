import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.soportecni.gpsrastreo.app',
  appName: 'Soportecni GPS',
  webDir: 'www',
  server: {
    androidScheme: 'http'
  },
  bundledWebRuntime: false
};

export default config;
