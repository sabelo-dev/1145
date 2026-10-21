import type { CapacitorConfig } from '@capacitor/cli';

// Native app (iOS / Android). The web build in `dist` is bundled into the app.
// The app ID can never change after the first store upload.
const config: CapacitorConfig = {
  appId: 'io.lifestyle1145.app',
  appName: '1145',
  webDir: 'dist',
  android: {
    // Mixed content is never needed: every API is https.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: false, // hidden by initNative() once the app has rendered
      backgroundColor: '#1e3a5f',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

// The "1145 Orders" app: the order console on its own, for shop tablets.
// Selected with CAP_APP=orders (scripts/cap-orders.mjs); its Android project
// is android-orders/ and its web build dist-orders/ (vite.orders.config.ts).
// Like the main app's, this app ID can never change after the first store upload.
const ordersConfig: CapacitorConfig = {
  appId: 'io.lifestyle1145.orders',
  appName: '1145 Orders',
  webDir: 'dist-orders',
  android: {
    path: 'android-orders',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#0f2a4d',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

const driverConfig: CapacitorConfig = {
  appId: 'io.lifestyle1145.driver', appName: '1145 Driver', webDir: 'dist-driver',
  android: { path: 'android-driver', allowMixedContent: false, useLegacyBridge: true },
  ios: { path: 'ios-driver' },
  plugins: {
    SplashScreen: { launchShowDuration: 800, launchAutoHide: true, backgroundColor: '#1e3a5f' },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
    CapacitorHttp: { enabled: true },
    Keyboard: { resize: 'body', resizeOnFullScreen: true },
  },
};
export default process.env.CAP_APP === 'driver' ? driverConfig : process.env.CAP_APP === 'orders' ? ordersConfig : config;
