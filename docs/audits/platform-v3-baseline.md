# Platform Upgrade v3: Phase 0 baseline and gap analysis

**Against:** *1145 Platform Upgrade Master Specification v3.0* (24 Oct 2026).
**Pinned commit:** `a0aabb8` on `production` (2026-10-24), plus the changes listed in section 4.
**Builds on:** [merchant-ai-discovery.md](merchant-ai-discovery.md), which covers Merchant AI, staff roles, 1145 Pay and the order console.

**Method:** read the repository (232 migrations, 44 edge functions, 99 routes), replayed every `CREATE/DROP POLICY` and
`ENABLE ROW LEVEL SECURITY` in migration order, and read every edge function deployed with `verify_jwt = false`.

**Not checked:** the live database, the Amplify console, PayFast, Resend and Google Cloud. Reading the live catalog
(policies, applied migrations, functions) was not permitted from this session. Every item that depends on live
state is marked **verify**. That read-only inventory is the first open task in section 5.

## 1. P0 actions for the owner (outside the code)

| # | Action | Why |
|---|---|---|
| A1 | **Rotate the Supabase service-role key** (Dashboard → Settings → API → *Roll*), then update it in every function secret and in AWS. | A `SUPABASE_SERVICE_ROLE_KEY` was committed in `.env` and is still in git history (removed later, never purged). It bypasses all RLS. The repo is on GitHub, so treat the key as exposed. |
| A2 | **Rotate the Resend webhook signing secret** and set the new one as `RESEND_WEBHOOK_SECRET`. | `RESEND_WEBHOOK_SECRET` is in git history too (commit `b84a758` removed it from the file, not from history). |
| A3 | Set `SEND_EMAIL_HOOK_SECRET` (the `v1,whsec_…` value shown under Auth → Hooks → Send Email) **before** deploying `auth-email-hook`. | The hook now rejects unsigned requests (finding S1). If the secret is missing, sign-up and password-reset emails stop. |
| A4 | Check that the Google Maps key returned by `maps-config` is restricted by HTTP referrer and API. | `maps-config` serves it to anyone, which is normal for a browser key only if it is restricted. |
| A5 | Decide whether to purge the secrets from git history (`git filter-repo`) after rotating. | Rotation makes the old values useless. Purging only reduces noise, and it rewrites history for every clone. |

## 2. Findings

Severity: **P0** exploitable now · **P1** wrong money, stock or data · **P2** defect or gap · **P3** hygiene.

| # | Finding | Sev | Status |
|---|---|---|---|
| S1 | `auth-email-hook` accepted unsigned requests. Anyone could POST any address plus a `confirmation_url` and get a genuine 1145 "confirm / reset password" email carrying their link: a phishing relay. It also logged full payloads, including OTP tokens. | P0 | **Fixed**: Standard Webhooks signature check (`_shared/webhookSignature.ts`), fails closed; payload no longer logged. |
| S2 | `send-order-status-email` was an open relay: unauthenticated, with the recipient and content taken from the request. | P0 | **Fixed**: takes only `orderId`; the recipient, status and tracking come from the database. |
| S3 | `send-auction-status-email` was an open relay (only admin screens call it). | P0 | **Fixed**: admins only. |
| S4 | `send-outbid-notification` accepted the product name and amount from the caller (HTML injection into a real user's inbox). | P2 | **Fixed**: the caller must be signed in and be the current top bidder; the fields are read from the database. |
| S5 | `resend-webhook` skipped verification when `RESEND_WEBHOOK_SECRET` was unset (and that secret leaked, A2). | P1 | **Fixed**: fails closed. |
| S6 | `payfast-payment` accepted any `http(s)` return or cancel URL: an open redirect after payment (discovery audit). | P2 | **Fixed**: `safeReturnUrl()` keeps allowlisted origins and moves the path onto `SITE_URL` for anything else. One allowlist is now shared with `merchant-payment-request`. |
| O1 | Customer **Cancel** deleted the order rows from the browser. No DELETE policy exists, so nothing was deleted, yet the page said "cancelled". It was offered on paid (`processing`) orders, and UCoin applied to unpaid orders was never returned. | P1 | **Fixed**: `customer_cancel_order()` cancels only unpaid `pending` orders, keeps the row, returns UCoin exactly once and logs to `order_events`. The button is hidden for paid orders. |
| O2 | Order status emails were sent twice: once by the `notify_order_status_change` trigger and again by the admin or merchant screen. | P3 | **Fixed**: duplicates within 10 minutes are skipped using `notification_log`. |
| O3 | **Oversell:** stock is decremented only when payment is confirmed, and `apply_paid_order_stock` clamps at zero (`GREATEST(q - n, 0)`). Two buyers of the last unit both get paid orders and nobody is told. This breaks spec §4.3. | P1 | **Open**: needs a design decision (section 5, item 3). It touches checkout and the ITN, so it is gated by spec §2. |
| O4 | **No working refund path.** Customers cannot request one; the merchant `RefundReturnDialog` writes `orders` directly, which RLS blocks (discovery R2, **verify**); admins have no refund queue. | P1 | **Open** (section 5, item 4). The customer **Return** button has no handler. |
| O5 | If `apply_paid_order_stock` fails after an ITN marks the order paid, the error is only logged; nothing retries it. | P2 | Open; fold into item 3. |
| D1 | Core tables (`profiles`, `vendors`, `orders`, `order_items`, `products`, `stores`, `categories`, …) are **not created by any migration**; they were made in the dashboard. The repo cannot rebuild the database, and `supabase/scripts/3_apply_pending_migrations.sql` notes that the remote migration history is out of sync. | P1 (DR) | Open (section 5, item 1). |
| D2 | RLS: every table created in the repo has RLS on. Three have RLS and no policies (`driver_dispatch_requests`, `ride_arrival_estimates`, `store_slug_history`) and are reached only through definer functions, which is intended. Policies on dashboard-made tables are unknown. | Info | **Verify** live. |
| D3 | Admin checks are mixed: `profiles.role = 'admin'` in older policies, `is_admin()` in newer ones (discovery R3). | P3 | Open. |
| L1 | `process-scheduled-posts` and `update-gold-prices` run without authentication. They only act on due posts or refresh a cache, but anyone can trigger them repeatedly. | P3 | Open: require a cron secret header. |

## 3. Coverage against the specification

✅ in place · 🟡 partial · ❌ missing · ❔ needs live verification

| Spec | Area | State | Evidence and gaps |
|---|---|---|---|
| §2 | Baseline inventory | 🟡 | Repo inventory done (this document and the discovery audit). Live schema, Amplify, providers and performance baselines are outstanding. |
| §3 | Roles and store scoping | 🟡 | `store_members` roles v2 (manager, operator, cashier) and `require_store_access()`. **No MFA anywhere** (no `mfa.enroll`/`aal2`) for admins or payouts. No support-agent role. |
| §4.3 | Invariants | 🟡 | Paid only from a verified ITN ✅. Idempotent webhooks: per branch ✅ (generic event table only for `PREQ-`). Atomic stock ❌ (O3). Cross-tenant isolation ❔. |
| §5 | Storefront and search | 🟡 | Sponsored placements exist. **No typo-tolerant search** (no `pg_trgm` or full-text index). Price and stock are re-checked server-side at checkout ✅. |
| §6 | Checkout and payments | 🟡 | Server-side pricing ✅, payment links (1145 Pay) ✅, UCoin redemption ✅. Refunds and disputes ❌ (O4). Guest checkout ❔. |
| §7 | Merchant Command Centre | 🟡 | Order console, stock audit, insights and staff exist behind flags. Offline: the console is read-only offline; queued non-financial actions are not built. |
| §8 | Merchant AI | ✅ | Allowlisted tools, the user's own JWT, drafts that need approval, quotas and an eval script. **Verify** that a conversation retention and deletion policy is written down. |
| §9 | Delivery | 🟡 | `delivery_jobs`, nearby dispatch and proof-of-delivery fields exist. The legacy `RequestDeliveryButton` hard-codes a Johannesburg pickup address; the console uses `stores.pickup_address`. |
| §10 | Marketing and loyalty | 🟡 | Promotions, referrals, influencers and UCoin exist. **No consent records** for customer messaging (POPIA, spec §10 and §15). |
| §11 | Admin console | 🟡 | Exists. No refund or dispute queue. Audit logs are split across per-domain tables (`compliance_audit_log`, `fintech_admin_audit`, `service_admin_audit`, …), with no single searchable log and no correlation IDs. |
| §15 | Regulatory | ❔ | `fintech-*` functions (deposits, withdrawals, card linking, `wallet_ledger`) and UCoin cash-out, transfers and P2P trading are **stored value**. Spec §15 requires licensed-partner and legal sign-off before any of this is expanded. Legal and accounting should confirm the current position. |
| §16 | Observability | ❌ | No error monitoring SDK, no correlation IDs, no Core Web Vitals collection. |
| §17 | Tests | 🟡 | `npm test`: 49 Node/PGlite tests (dispatch, arrival, push, customer cancel, webhook signatures), now in CI. No E2E suite, no cross-tenant RLS suite (blocked by D1). |

## 4. Changes in this pass (not deployed)

| Change | Files |
|---|---|
| Signed Supabase auth hook; Resend webhook fails closed | `_shared/webhookSignature.ts`, `auth-email-hook`, `resend-webhook` |
| Mailers no longer relay | `send-order-status-email`, `send-auction-status-email`, `send-outbid-notification`, and the callers in `AdminOrders.tsx` and `MerchantOrders.tsx` |
| Allowlisted PayFast return URLs | `_shared/payfast.ts`, `payfast-payment`, `merchant-payment-request` |
| Server-side customer cancel | migration `20261024100000_customer_cancel_order.sql`, `ConsumerOrders.tsx`, `types.ts` |
| Tests in CI | `tests/customer-cancel.test.ts`, `tests/webhook-signature.test.ts`, `package.json` (`npm test`), `.github/workflows/build.yml` |

**Deploy order (staging first):**
1. Complete A1–A3.
2. Apply the migration (additive; a single new function): `supabase db push`, or paste it into the SQL editor (see the
   note in `supabase/scripts/3_apply_pending_migrations.sql` about history drift).
3. Deploy the functions: `supabase functions deploy auth-email-hook resend-webhook send-order-status-email send-auction-status-email send-outbid-notification payfast-payment merchant-payment-request`.
4. Check: sign up a test user (the email arrives); `curl -X POST …/auth-email-hook` returns 401; pay a sandbox order
   (it returns to the right page); move an order to *shipped* (one email); cancel an unpaid order that used UCoin
   (the balance comes back once).
5. Deploy the web build.

**Rollback:** redeploy the previous function versions. The migration adds only `customer_cancel_order()`; dropping it
reverts the database (`DROP FUNCTION public.customer_cancel_order(uuid);`).

## 5. Next work, in order

1. **Live inventory (closes §2 and D1).** Run, read-only, against production: `pg_dump --schema-only`, `pg_policies`,
   `supabase_migrations.schema_migrations` and storage bucket policies. Commit the schema as a baseline migration
   so the repo can rebuild the database and a cross-tenant RLS test suite can run against the real schema.
2. **Rotate secrets (A1–A2)** and add secret scanning (for example `gitleaks`) to CI.
3. **Stock reservation (O3, O5).** Proposal: `reserve_order_stock(order)` runs in the checkout transaction with
   `UPDATE … SET quantity = quantity - n WHERE id = … AND quantity >= n`, failing the checkout when stock is short. A
   reservation expiry (for example 30 minutes, run by `pg_cron`) releases unpaid stock. The ITN converts the
   reservation; `apply_paid_order_stock` keeps working for orders placed before the change. Needs product-owner
   approval, PayFast sandbox evidence and a concurrency test before release (spec §2 gate).
4. **Refund workflow (O4).** A customer request RPC, then a merchant or admin decision RPC (role-checked and audited),
   then a manual PayFast refund recorded against the order. No automatic money movement (spec §6 and §8.2).
5. **MFA for admins and payout actions** (Supabase TOTP, `aal2` checked in the admin and payout functions).
6. **Observability:** error monitoring for web and functions, a request ID passed from the client to the functions
   and into logs, and Core Web Vitals reporting.
7. **Consent records** for marketing messages before any automated customer messaging (spec §10).
8. **Regulatory review** of the wallet and UCoin cash features (spec §15), separate from the engineering work.

After this, Phase 1 (customer commerce) can start. Search with `pg_trgm` and the refund path are the most valuable
items there.
