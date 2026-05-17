import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.CAP_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'app.lovable.d08594899381447fa1862612cdbf9227',
  appName: '1145 Lifestyle',
  webDir: 'dist',
  // For production store builds, leave `server` undefined so the bundled
  // `dist/` is loaded. Set CAP_ENV=development to get hot-reload from the
  // Lovable sandbox (run: CAP_ENV=development npx cap sync).
  ...(isDev
    ? {
        server: {
          url: 'https://d0859489-9381-447f-a186-2612cdbf9227.lovableproject.com?forceHideBadge=true',
          cleartext: true,
        },
      }
    : {}),
  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: '#ffffff',
  },
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: false, // hidden manually by initNative()
      backgroundColor: '#1e3a5f',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#1e3a5f',
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
