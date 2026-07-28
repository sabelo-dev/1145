# 1145 Lifestyle — Play Store / App Store Release Checklist

This checklist is what to do **on your own machine** after exporting the
project from Lovable. The Lovable sandbox cannot build native binaries.

---

## 1. App identity (already set here)

| Field           | Value                                              |
| --------------- | -------------------------------------------------- |
| App name        | `1145 Lifestyle`                                   |
| App ID          | `app.lovable.d08594899381447fa1862612cdbf9227`     |
| Web dir         | `dist`                                             |
| Version (web)   | `package.json → version` — bump before every release |

Configured in `capacitor.config.ts`. Change `appId` only if you are
publishing under your **own** developer account with your **own** package
name (e.g. `com.lifestyle1145.app`) — you cannot change it after the app
has shipped to the store.

---

## 2. Version number + version code (Android)

Play Store requires **two** version identifiers. They live in
`android/app/build.gradle` after you run `npx cap add android`:

```gradle
android {
  defaultConfig {
    applicationId "app.lovable.d08594899381447fa1862612cdbf9227"
    versionCode 2       // integer, +1 every upload (Play Store dedupes on this)
    versionName "1.0.1" // human-readable, matches package.json
  }
}
```

**Rule:** every upload to Play Console must have a **higher `versionCode`**
than the previous upload, even for internal testing tracks.

For iOS, edit `ios/App/App/Info.plist` → `CFBundleShortVersionString`
(`versionName`) and `CFBundleVersion` (`versionCode`).

---

## 3. App icon + splash screen

Sources are pre-seeded at:

- `resources/icon.png`   (1024×1024 recommended, PNG, no transparency)
- `resources/splash.png` (2732×2732 recommended, PNG, centered logo on brand colour)

Replace those two files with polished art at those sizes, then regenerate
every platform asset with the official Capacitor Assets CLI:

```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#1e3a5f' \
                              --iconBackgroundColorDark '#1e3a5f' \
                              --splashBackgroundColor '#1e3a5f' \
                              --splashBackgroundColorDark '#1e3a5f'
```

This writes `android/app/src/main/res/mipmap-*/` icons and `drawable-*/splash.png`.

Splash timing is already configured in `capacitor.config.ts`
(`launchShowDuration: 1500`, hidden by `initNative()`).

---

## 4. Android permissions

After `npx cap add android`, open
`android/app/src/main/AndroidManifest.xml` and confirm the following
`<uses-permission>` entries exist inside `<manifest>` (add any missing):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.location.gps" android:required="false" />
```

For iOS, add the matching purpose strings to `ios/App/App/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>1145 uses your location to show nearby stores, rides and deliveries.</string>
<key>NSCameraUsageDescription</key>
<string>1145 uses the camera so you can upload product and profile photos.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>1145 needs photo access so you can upload images from your library.</string>
```

In the Play Console **Data safety** form, declare Location, Camera,
Photos, and Push Notifications — matching the manifest.

---

## 5. Privacy Policy & Terms of Service (required by Play Store)

Both live in the app and are publicly accessible:

- Privacy Policy: `https://1145.io/privacy`
- Terms of Service: `https://1145.io/terms`

Paste those URLs into **Play Console → App content → Privacy Policy** and
into **App Store Connect → App Privacy**.

---

## 6. Google Maps API key

The web app reads `VITE_GOOGLE_MAPS_API_KEY` from `.env` at build time.
No key is hardcoded anywhere in the codebase.

For a store build you **must** supply your own key:

1. Google Cloud Console → APIs & Services → Credentials → Create API key.
2. Enable: Maps JavaScript API, Places API (New), Geocoding, Routes.
3. Restrict the key by **Application → Android apps** (package name +
   SHA-1 fingerprint) and **iOS apps** (bundle ID). Add HTTP referrers
   `https://1145.io/*` and `https://*.lovable.app/*` for web.
4. Add to `.env` before `npm run build`:
   ```
   VITE_GOOGLE_MAPS_API_KEY=AIzaSy...
   ```

---

## 7. Push notifications

Capacitor plugin `@capacitor/push-notifications` is installed and wired in
`src/lib/native.ts` (`registerPush()`).

To finish the pipeline:

- **Android** — create a Firebase project, download `google-services.json`,
  drop it into `android/app/`. Add the Google services plugin to
  `android/build.gradle` and `android/app/build.gradle` per the FCM docs.
- **iOS** — enable the **Push Notifications** capability in Xcode, upload
  an APNs auth key in Firebase, and add `GoogleService-Info.plist` to the
  iOS target.

Test by calling `registerPush()` on device — the token appears in the
console; send a test push from the FCM console.

---

## 8. Production Supabase URL and keys

Values already live in `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

These are the **production project** (project ref `hipomusjocacncjsvgfa`)
and are safe to ship in the bundle — RLS enforces access. Never bundle
`SUPABASE_SERVICE_ROLE_KEY`; it stays in edge-function secrets only.

---

## 9. Debug logs

`vite.config.ts` now strips **all** `console.*` and `debugger` statements
from production builds via esbuild's `drop` option. Preview and
development builds keep them for troubleshooting.

Verify after building:

```bash
npm run build
grep -c "console.log" dist/assets/*.js   # should be 0 (or only inside library comments)
```

---

## 10. Build & upload

```bash
git pull
npm ci
npm run build
npx cap sync
# Android
npx cap open android         # then Build → Generate Signed Bundle → .aab
# iOS
npx cap open ios             # then Product → Archive → Distribute to App Store
```

Upload the `.aab` to Play Console → Internal testing first; promote to
Production after QA.
