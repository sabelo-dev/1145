## Goal

When a new user registers as **merchant**, **driver**, or **influencer**, force a role-specific onboarding flow before they can use the dashboard. Each flow collects only what that role needs. The **driver** flow adds strong anti-fraud controls (ID verification, document uploads, selfie liveness, uniqueness checks).

## Routing & gate

- Add routes `/driver/onboarding` and `/influencer/onboarding`. Merchant already has `/merchant/onboarding`.
- New `RoleOnboardingGate` wrapper (used inside `ProtectedRoute` for role dashboards) checks the user's role and the completion flag for their profile row. If incomplete → redirect to the matching onboarding route.
- After login/verify-email redirect logic: if role ∈ {merchant, driver, influencer} and onboarding incomplete, land on the onboarding page instead of the dashboard.

## Merchant onboarding (already exists)

Keep the current multi-step `MerchantOnboardingPage` — no functional changes beyond ensuring the gate uses `vendors.status != 'PENDING_PROFILE'` as the "complete" signal.

## Driver onboarding (new, multi-step + anti-fraud)

Steps in `DriverOnboardingPage`:
1. **Personal** — full legal name, phone (OTP verified via existing Supabase phone), date of birth (must be 18+), residential address.
2. **Government ID** — SA ID / passport number + upload front & back to `driver-kyc` bucket (private).
3. **Driver's licence** — licence number, expiry, upload front & back; expiry must be in the future.
4. **Vehicle** — type, make/model/year, colour, registration plate, upload vehicle photo + registration papers + insurance certificate + roadworthy certificate.
5. **Selfie liveness** — capture a selfie via `getUserMedia`, uploaded to `driver-kyc`; stored hash compared to reject duplicates.
6. **Banking + agreements** — payout bank account (SA banks list), tax number optional, accept driver code of conduct + background-check consent + FIC declaration.

### Driver anti-fraud measures

- New private storage bucket `driver-kyc` (owner-only read, admin read via RLS).
- DB constraints: `UNIQUE(license_number)` on `drivers`; `UNIQUE(id_number)` on new `driver_kyc` table; `UNIQUE(vehicle_registration)` on `drivers`.
- New table `driver_kyc` (user_id PK, id_number, id_document_urls, license_urls, vehicle_doc_urls, selfie_url, selfie_hash, bank_account_last4, verification_status: pending/approved/rejected, submitted_at, reviewed_by, review_notes, ip_address, device_fingerprint). RLS: driver reads/writes own, admin all.
- Driver status stays `pending` until an admin approves; `RoleOnboardingGate` allows access to a limited "pending review" dashboard state but blocks going online / accepting rides until approved.
- Record submission `ip_address` and `device_fingerprint` (FingerprintJS-lite via `navigator.userAgent` + canvas hash) for admin fraud review.
- Reject signup if `id_number`, `license_number`, plate, phone, or selfie hash already exists on another driver (uniqueness pre-check via edge function `driver-kyc-precheck`).
- 18+ age check enforced client-side and by a DB trigger on `driver_kyc.date_of_birth`.

## Influencer onboarding (new)

`InfluencerOnboardingPage` steps:
1. **Public identity** — display name, username (unique on `influencer_profiles`), bio, profile photo.
2. **Contact & niche** — first/last name, phone, primary niche (multi-select from fashion/beauty/tech/food/travel/fitness/lifestyle), audience size band, primary country.
3. **Social profiles** — connect at least one social account through the existing OAuth flow (Instagram / TikTok / X / YouTube / Facebook). Manual URL fallback if OAuth fails; those go to admin verification queue.
4. **Payout details** — payout method (bank / UCoin wallet), agree to influencer terms + FTC disclosure policy.

Completion flag: `influencer_profiles.username IS NOT NULL AND phone IS NOT NULL AND at least one row in social_accounts`.

## Post-registration redirect

In `RegisterPage.onSubmit` and `verify-email` success handler, after account creation with a non-consumer role, navigate to the role's onboarding path once the email is verified.

## Technical section

- **New DB migration**
  - `driver_kyc` table with GRANTs, RLS, and update-timestamp trigger.
  - Add `onboarding_completed_at timestamptz` to `drivers`, `influencer_profiles`; helper view is not needed — gates check the column.
  - Unique indexes on `drivers.license_number`, `drivers.vehicle_registration`, `driver_kyc.id_number`, `driver_kyc.selfie_hash`, `influencer_profiles.username`.
  - Private storage bucket `driver-kyc` with per-user-folder policies (`{auth.uid()}/...`).
  - Trigger on `driver_kyc` enforcing age >= 18.
- **New edge function** `driver-kyc-precheck` — validates uniqueness of id/licence/plate/phone before final submit; uses service role, JWT-verified caller.
- **New components**
  - `src/pages/driver/DriverOnboardingPage.tsx` (stepper).
  - `src/pages/influencer/InfluencerOnboardingPage.tsx` (stepper).
  - `src/components/auth/RoleOnboardingGate.tsx` used inside role-protected routes.
  - Shared `src/components/onboarding/Stepper.tsx`, `DocumentUpload.tsx`, `SelfieCapture.tsx`.
- **App.tsx** — add new routes; wrap `DriverDashboardPage` and `InfluencerDashboardPage` with `RoleOnboardingGate`.
- **AuthContext / LoginForm** — extend post-login redirect to detect incomplete onboarding for the three roles.
- All uploads go through validated Zod schemas (mime type, size ≤ 5 MB per file, ≤ 15 MB total).

```text
register → verify-email → role check
                        ├─ merchant → /merchant/onboarding → dashboard
                        ├─ driver   → /driver/onboarding (6 steps + KYC) → pending review → dashboard
                        └─ influencer → /influencer/onboarding (4 steps) → dashboard
```
