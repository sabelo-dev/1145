
# 1145 Fintech Platform — Implementation Plan

Build a secure wallet + payments layer on top of the existing PayFast integration. 1145 never touches PAN/CVV/passwords — only provider tokens and non-sensitive metadata.

## Scope (this phase)

1. Data model for tokenized payment instruments, verified bank accounts, wallet ledger, KYC state, fraud signals, admin audit.
2. Edge functions that broker every card link / deposit / withdrawal / settlement through PayFast (tokenization + ITN webhook).
3. Wallet UI (consumer, driver, influencer, vendor) with balances, transactions, linked cards, linked bank accounts, deposit, withdraw.
4. Admin fintech console: transactions, flagged items, settlements, freeze account, audit log, financial report export.
5. Notifications for every card/link/payment/withdrawal event.
6. KYC gate before withdrawals and higher limits.

Out of scope this phase: multi-provider abstraction beyond PayFast (architecture supports it via `provider` column, but only PayFast wired now), AML SAR filing tooling, dispute chargeback workflow beyond flagging.

## Architecture

```text
Browser ──► PayFast hosted card capture (tokenization) ──► issuing bank (3DS/SCA)
   │                                                              │
   │             token + last4/brand                               │
   ▼                                                              ▼
Edge fn: fintech-* ──► Supabase (tokens, ledger, kyc, fraud)  PayFast ITN webhook
                              │
                              ▼
                        Admin console
```

- All fintech mutations go through edge functions (`verify_jwt=true`) that validate the caller, enforce RLS-bypassing writes with `service_role`, and append immutable ledger rows.
- `wallet_transactions` already exists — extend it as the single ledger; add a Postgres trigger that blocks UPDATE/DELETE (append-only).
- Card / bank rows store only `provider`, `provider_token`, `brand`, `last4`, `exp_month`, `exp_year`, `holder_name`, `verified_at`. No PAN, no CVV, no password.

## Database (single migration)

New tables (all with GRANTs, RLS, self-owner policies + admin read via `has_role`):

- `payment_instruments` — linked cards. Cols: `user_id`, `provider` ('payfast'), `provider_token`, `brand`, `last4`, `exp_month`, `exp_year`, `holder_name`, `is_default`, `status` ('active'|'removed'|'expired'), `verified_at`.
- `linked_bank_accounts` — payout targets. Cols: `user_id`, `provider`, `provider_account_ref`, `bank_name`, `account_last4`, `account_holder_name`, `verification_status` ('pending'|'verified'|'failed'), `verified_at`. Never store full account number — encrypt or drop after verification returns.
- `wallets` — per user. Cols: `user_id UNIQUE`, `available_balance`, `pending_balance`, `withdrawal_balance`, `currency` (default 'ZAR'), `status` ('active'|'frozen'). Auto-created by trigger on `profiles` insert.
- `wallet_ledger` — immutable append-only. Cols: `wallet_id`, `user_id`, `direction` ('credit'|'debit'), `bucket` ('available'|'pending'|'withdrawal'), `amount`, `currency`, `type` ('deposit'|'purchase'|'refund'|'vendor_payout'|'driver_earning'|'influencer_commission'|'referral_reward'|'subscription'|'withdrawal_request'|'withdrawal_completed'|'reversal'), `status`, `provider_reference`, `bank_reference`, `related_entity_type`, `related_entity_id`, `metadata jsonb`. Trigger blocks UPDATE/DELETE.
- `withdrawal_requests` — cols: `user_id`, `bank_account_id`, `amount`, `currency`, `status` ('pending'|'approved'|'processing'|'completed'|'rejected'|'failed'), `fraud_score`, `reviewer_id`, `reviewed_at`, `provider_reference`, `rejection_reason`.
- `kyc_profiles` — cols: `user_id UNIQUE`, `legal_name`, `dob`, `id_number_hash`, `id_document_ref`, `address_line1..postal_code`, `mobile_verified`, `email_verified`, `selfie_ref`, `liveness_passed`, `level` ('none'|'basic'|'enhanced'), `status` ('pending'|'approved'|'rejected'), `reviewed_by`, `reviewed_at`. Documents stored in private `kyc-documents` bucket (per-user path).
- `fintech_fraud_events` — cols: `user_id`, `event_type`, `risk_score`, `signals jsonb`, `ip`, `device_fingerprint`, `resolved`.
- `fintech_admin_audit` — cols: `admin_id`, `action`, `target_type`, `target_id`, `details jsonb`.
- `transaction_limits` — cols: `kyc_level`, `daily_deposit`, `daily_withdrawal`, `single_withdrawal_max`, `monthly_withdrawal`. Seed rows for none/basic/enhanced.

Helper functions:
- `credit_wallet(user_id, bucket, amount, type, ...)` / `debit_wallet(...)` — SECURITY DEFINER, atomic balance update + ledger insert.
- `move_wallet_bucket(user_id, from_bucket, to_bucket, amount, ...)` — for pending→available on ITN COMPLETE.
- `get_wallet_summary(user_id)` — returns balances + limits + KYC state.
- Reuse existing `has_role`, `is_admin` for admin RLS.

## Edge functions (all `verify_jwt=true` except webhook)

- `fintech-link-card` — creates a PayFast tokenization session (uses PayFast recurring/tokenization flow), returns hosted redirect URL. On ITN callback with `token`, stores `payment_instruments` row.
- `fintech-remove-card` — soft-delete, notifies user.
- `fintech-link-bank` — records pending bank account, kicks off provider verification (initially: manual verification job for admin — flagged so we can swap to a provider like Stitch/Ozow later without schema change).
- `fintech-deposit` — creates PayFast payment, on success credits wallet `available_balance`.
- `fintech-withdraw` — validates KYC ≥ basic, checks limits, runs fraud checks, creates `withdrawal_requests` row (pending admin approval for now; provider payout API pluggable).
- `fintech-pay-order` — internal helper used by checkout/subscription/marketplace/vendor settlement flows to debit wallet or charge card via PayFast token.
- `fintech-admin-freeze` / `fintech-admin-review-withdrawal` — admin-only, writes to audit table.
- `payfast-itn` (already exists) — extend to route wallet deposits and card tokenization callbacks into the new tables.

All edge functions:
- Validate JWT and re-fetch `getUser()`.
- Zod-validate input.
- Emit `fintech_fraud_events` on suspicious signals (velocity, IP change, device fingerprint change, multiple failed attempts, duplicate token across users).
- Return provider errors verbatim with status.

## Frontend

- `src/services/fintech.ts` — thin client wrapping `supabase.functions.invoke`.
- `src/hooks/useWallet.ts` — subscribes to wallet + ledger realtime, exposes balances + txns.
- `src/hooks/useKyc.ts` — KYC state + submit.
- `src/pages/wallet/WalletPage.tsx` (exists) — rebuild into tabs: Overview, Cards, Bank Accounts, Transactions, Withdrawals.
  - Cards tab: list of linked cards (brand icon + last4 only), "Add card" opens PayFast hosted flow in new tab / iframe redirect, remove card.
  - Bank Accounts tab: list, add (form → provider verification), remove.
  - Withdraw dialog: amount + bank account picker, shows limits, KYC gate.
  - Deposit dialog: amount + card picker → PayFast redirect.
- `src/pages/AccountPage.tsx` + new `src/components/kyc/KycWizard.tsx` — collects legal name, DOB, ID upload (private bucket), selfie (reuse `SelfieCapture`), address, mobile OTP (reuse existing), email (already).
- Consumer/Driver/Influencer/Vendor dashboards: replace their bespoke earnings/payout UIs with a shared `<WalletSummaryCard>` + link to `/wallet`.
- Admin: new `src/pages/admin/AdminFintechPage.tsx` with sub-tabs: Transactions, Withdrawals queue, Flagged events, Frozen accounts, Audit log, Report export (CSV). Admin never sees PAN — cards render as `•••• 4242`.
- Notifications: extend `user_notifications` writer to emit for each fintech event; toast + `NotificationCenter` already renders them.

## Security & compliance

- PCI: no PAN/CVV ever hits our servers — capture always in PayFast hosted page.
- SCA/3DS: enforced by PayFast at bank layer.
- Encryption at rest: Supabase default (AES-256). Sensitive columns (`id_number_hash`) stored hashed with `pgcrypto` `digest(..., 'sha256')`.
- Encryption in transit: HTTPS enforced.
- RLS: users see only their own wallet/cards/banks/ledger; admins read via `is_admin()`; ledger is INSERT-only via SECURITY DEFINER helpers (no direct client insert).
- Immutable ledger: trigger `raise exception` on UPDATE/DELETE.
- Rate limiting: per the platform rule, no built-in primitive — I will note the gap in the wallet edge functions and only add an ad-hoc limit if you confirm.
- Fraud: velocity check (>N attempts / 10min), device-fingerprint mismatch, high-risk IP list (start with a small allowlist of country codes = ZA; anything else flagged).
- KYC gate blocks `fintech-withdraw` and raises deposit limits at enhanced level.
- Admin actions all write `fintech_admin_audit`.

## Migrations run

One `supabase--migration` call creating all new tables + GRANTs + RLS + policies + helper functions + triggers + seed `transaction_limits` rows + private `kyc-documents` storage bucket policies.

## Verification

- Typecheck.
- Playwright: open `/wallet` signed in, confirm balances render, open Add Card dialog, confirm redirect to PayFast sandbox URL is built correctly (do not complete payment).
- Manual: admin console lists a seeded flagged event.

## Files to add / change (high level)

- Migration (new).
- `supabase/functions/fintech-link-card/index.ts`, `fintech-remove-card`, `fintech-link-bank`, `fintech-deposit`, `fintech-withdraw`, `fintech-pay-order`, `fintech-admin-actions` (new).
- Extend `supabase/functions/payfast-itn/index.ts` for tokenization + wallet deposit routing.
- `src/services/fintech.ts`, `src/hooks/useWallet.ts`, `src/hooks/useKyc.ts` (new).
- Rebuild `src/pages/wallet/WalletPage.tsx`; add `src/components/wallet/*` (CardsTab, BanksTab, TransactionsTab, WithdrawDialog, DepositDialog, WalletSummaryCard).
- `src/components/kyc/KycWizard.tsx`.
- `src/pages/admin/AdminFintechPage.tsx` + admin route in `src/App.tsx`.
- Update `supabase/config.toml` for new functions.

## Open questions before I build

1. **Provider for bank-account verification and payouts.** PayFast handles card capture and once-off card payments today, but it does not do arbitrary bank-account ownership verification or push payouts to third-party accounts. Options:
   - (a) Ship now with **manual admin-approved withdrawals** (admin runs the actual EFT in their bank portal, marks the request completed). Fastest, no new integration.
   - (b) Integrate **Stitch** or **Ozow** for account verification + payouts. Adds a new provider credential.
2. **Where to expose the wallet**: single `/wallet` for all roles (recommended, one UI), or keep separate dashboards per role and just embed a summary card?
3. **Should subscriptions and vendor settlements be migrated to the new wallet ledger in this phase**, or only new transactions from cutover forward (existing rows stay in their current tables)?

I will proceed with (1a), option "single /wallet", and "new transactions only" unless you say otherwise — this keeps the scope shippable in one pass.
