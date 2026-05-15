# Mobile App Store Release Guide

This project ships **three** distribution channels:

1. **Web** — `vite build` → `dist/`
2. **PWA** (installable web app) — same build, with service worker
3. **Native iOS / Android** — Capacitor wrapping `dist/`

---

## PWA (auto-enabled in production builds)

- Installable from any modern mobile browser (Add to Home Screen).
- Service worker is **disabled** in the Lovable preview iframe and on
  `*.lovableproject.com` / `*.lovable.app` hosts to prevent stale caches.
  It only activates on your published custom domain.
- Manifest: `1145 Lifestyle`, theme `#1e3a5f`, standalone, portrait.
- Icons: `public/pwa-icon-192.png`, `public/pwa-icon-512.png`.
- Visit `/install` in production for a guided install screen.

## Native iOS & Android (Capacitor 8)

### One-time setup (after Export to GitHub)

```bash
git pull
npm install
npx cap add ios
npx cap add android
```

### Hot-reload during development (loads from Lovable sandbox)

```bash
CAP_ENV=development npx cap sync
npx cap run ios       # needs Xcode (macOS)
npx cap run android   # needs Android Studio
```

### Production / store build (loads bundled `dist/`)

```bash
npm run build
npx cap sync          # CAP_ENV unset → no remote server URL is written
```

Then archive:

- **iOS**: `npx cap open ios` → Xcode → Product → Archive → upload to App Store Connect.
- **Android**: `npx cap open android` → Android Studio → Build → Generate Signed Bundle (`.aab`) → upload to Google Play Console.

### App identity

- App ID: `app.lovable.d08594899381447fa1862612cdbf9227`
- App name: `1145 Lifestyle`
- Splash bg: `#1e3a5f`, status bar style: light
- Splash hides via `initNative()` after React mounts.

### Required iOS `Info.plist` usage strings

Apple **rejects** apps that request these permissions without a usage string. Add to `ios/App/App/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>1145 Lifestyle uses your location to match you with nearby drivers, deliveries, and stores.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Background location lets us track your active rides and deliveries.</string>
<key>NSCameraUsageDescription</key>
<string>The camera is used for profile photos, KYC verification, and product images.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Choose photos to upload as your profile picture or KYC documents.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Save receipts and order confirmations to your photo library.</string>
<key>NSFaceIDUsageDescription</key>
<string>Face ID secures your wallet and high-value transactions.</string>
<key>NSContactsUsageDescription</key>
<string>Optionally invite friends from your contacts to earn UCoin referral bonuses.</string>
<key>NSUserTrackingUsageDescription</key>
<string>We use this to personalize promotions. You can decline without losing app features.</string>
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
  <string>location</string>
</array>
```

### Required Android permissions

`android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### Push notifications

- iOS: enable **Push Notifications** capability in Xcode + create an APNs key.
- Android: add `google-services.json` from Firebase to `android/app/`.
- Call `registerPush()` from `src/lib/native.ts` after the user signs in.

### Store assets checklist

| Asset | Required size |
|---|---|
| iOS app icon | 1024×1024 (PNG, no alpha) |
| iOS screenshots | 6.7" + 6.5" + 5.5" iPhone, 12.9" iPad |
| Android icon | 512×512 (PNG) |
| Android feature graphic | 1024×500 |
| Android screenshots | min 2 per form factor |
| Privacy policy URL | `https://1145lifestyle.com/privacy` |
| Terms URL | `https://1145lifestyle.com/terms` |

### Compliance

- South Africa POPIA / FIC covered by existing privacy & KYC flows.
- Apple App Tracking Transparency: prompt before any analytics SDK.
- Google Play Data Safety form: declare Location, Camera, Photos, Push, Financial info.
