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

export default config;
