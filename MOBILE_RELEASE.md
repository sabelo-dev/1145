# 1145 — iOS & Android release runbook

The native apps are the web app (`dist`) packaged with Capacitor 8. This is
what to do on your own machine to build, configure and ship them.

You need: **Android Studio** (JDK 17+, Android SDK 36) for Android, and a
**Mac with Xcode 16+** plus an Apple Developer account for iOS.

---

## 1. App identity

| Field | Value | Where |
| --- | --- | --- |
| App ID / bundle ID | `io.lifestyle1145.app` | `capacitor.config.ts`, `android/app/build.gradle`, Xcode target |
| Name under the icon | `1145` | `capacitor.config.ts`, `strings.xml`, `Info.plist` |
| App link scheme | `io.lifestyle1145.app://` | `AndroidManifest.xml`, `Info.plist` (CFBundleURLTypes) |

The app ID **can never change** after the first store upload.

## 2. Versions — bump before every upload

- **Android** `android/app/build.gradle`: `versionCode` (integer, +1 on every
  upload, even to internal testing) and `versionName` (e.g. `1.0.1`).
- **iOS** Xcode → target → General: *Version* (`MARKETING_VERSION`) and
  *Build* (`CURRENT_PROJECT_VERSION`, +1 on every upload).

## 3. Icon and splash screen

Put a 1024×1024 PNG icon (no transparency) at `resources/icon.png` and a
2732×2732 splash at `resources/splash.png`, then:

```bash
npx capacitor-assets generate --iconBackgroundColor '#1e3a5f' --splashBackgroundColor '#1e3a5f'
```

The launcher icon now points at `@mipmap/ic_launcher` (it previously used
the splash image).

## 4. Supabase settings (once)

1. **Authentication → URL Configuration → Redirect URLs**: add
   `io.lifestyle1145.app://**`. Google/Facebook sign-in in the apps returns
   there (without it Supabase falls back to the website).
2. Run `20261001140000_push_notifications.sql` and
   `20261001150000_account_deletion_requests.sql` (in `supabase/migrations`)
   in the SQL Editor.
3. Create the push secret (any long random string, same value twice):
   ```sql
   select vault.create_secret('<random string>', 'push_webhook_secret');
   ```
   ```bash
   npx supabase secrets set PUSH_WEBHOOK_SECRET=<same random string> --project-ref hipomusjocacncjsvgfa
   ```
4. Deploy the functions touched for the apps:
   ```bash
   npx supabase functions deploy send-push social-oauth social-oauth-callback fintech-deposit fintech-link-card merchant-subscription payfast-payment --project-ref hipomusjocacncjsvgfa
   ```

## 5. Push notifications

Every in-app notification (UC rewards, orders, …) is also pushed to the
user's phones. Devices register after sign-in (`src/lib/push.ts`); the
`send-push` function delivers via Firebase (Android) and Apple (iOS).

**Android (Firebase Cloud Messaging)**
1. Firebase console → add an Android app with package `io.lifestyle1145.app`.
2. Download `google-services.json` into `android/app/` (the build applies
   the Google services plugin automatically when the file exists).
3. Project settings → Service accounts → *Generate new private key*, then:
   ```bash
   npx supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)" --project-ref hipomusjocacncjsvgfa
   ```

**iOS (Apple Push Notification service, no Firebase SDK needed)**
1. Apple Developer → Keys → create a key with *Apple Push Notifications
   service (APNs)*; note the Key ID and your Team ID; download the `.p8`.
2. ```bash
   npx supabase secrets set APNS_KEY_P8="$(cat AuthKey_XXXX.p8)" APNS_KEY_ID=XXXX APNS_TEAM_ID=YYYY --project-ref hipomusjocacncjsvgfa
   ```
   Add `APNS_PRODUCTION=true` once you test TestFlight / App Store builds
   (debug builds from Xcode use Apple's sandbox).
3. In Xcode, the target already uses `App/App.entitlements` (push). Under
   *Signing & Capabilities* confirm **Push Notifications** shows, and select
   your team.

Test: sign in on a phone, allow notifications, then trigger a reward (e.g.
daily check-in); a push arrives within seconds.

## 6. Sign-in, account connections and payments in the apps

- Google / Facebook **sign-in** and Facebook / Instagram **account
  connection** open in the system browser (both providers block sign-in
  inside app web views) and come back through `io.lifestyle1145.app://`.
- **PayFast** payments open in the system browser via `1145.io/pay`, and
  PayFast returns to `1145.io/app-return`, which reopens the app on the
  right page. Deploy the website before shipping an app that relies on it.
- **Paid UC tiers are not sold in the apps.** Apple and Google require their
  own in-app purchase for digital subscriptions, so the apps show tiers and
  referral progress only (no prices or buy buttons). Tiers bought on
  1145.io apply in the apps too.

## 7. Permissions declared

| | Android | iOS (purpose text in Info.plist) |
| --- | --- | --- |
| Location (nearby stores, rides, deliveries) | fine + coarse | When in use |
| Camera (profile, products, posts, KYC) | `CAMERA` | `NSCameraUsageDescription` |
| Photos | system photo picker on Android 13+; `READ_EXTERNAL_STORAGE` only up to Android 12 | library read + add |
| Notifications | `POST_NOTIFICATIONS` | asked at sign-in |
| Face ID (biometric sign-in) | — | `NSFaceIDUsageDescription` |

Declare the same in Play Console → **Data safety** and App Store Connect →
**App Privacy**.

## 8. Store listing requirements

- Privacy policy: `https://1145.io/privacy` · Terms: `https://1145.io/terms`
- **Account deletion** (required by both stores): Settings / Profile →
  Delete account records a request in `account_deletion_requests`
  (migration `20261001150000_account_deletion_requests.sql`) and signs the
  user out. Process pending requests within 30 days (delete the user in
  Supabase → Authentication after keeping any records the law requires),
  then set the request's status to `completed`.
- App Review: provide a test account (email + password) with sample data.
- Wording: avoid presenting UCoin as cryptocurrency or "mining" crypto on
  the device; it is a loyalty reward (Apple guideline 3.1.5).

## 9. Build & upload

```bash
git pull
npm ci
npm run build
npx cap sync
npx cap open android   # Build → Generate Signed Bundle → .aab → Play Console (internal testing first)
npx cap open ios       # Product → Archive → Distribute → App Store Connect (TestFlight first)
```

Keep the Android upload keystore and its passwords safe: losing them
means you cannot update the app.
