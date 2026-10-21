# Merchant AI: integration discovery (Gate G0)

**Pinned commit:** `ec071ec` on `production` (2026-10-21). Work branch: `feature/merchant-ai`.
**Method:** read the repository: migrations, generated types, edge functions, React routes and components.
**Not checked:** the live Supabase database, the AWS Amplify console and the PayFast merchant account. The AWS MCP
connection failed in this session, and there is no database access from this machine. Everything below that depends
on the live system is marked **verify**.

## 1. Stack (MAI-001)

| Item | Found | Notes |
|---|---|---|
| Frontend | React 18.3.1, Vite ^7.3.6, react-router-dom ^6.30.4, TanStack Query 5.56.2, Tailwind 3.4, Radix/shadcn | Routes live in `src/App.tsx` (lazy pages). Merchant UI is a tabbed dashboard: `src/components/merchant/MerchantDashboard.tsx`, with tabs under `dashboard/`. |
| Mobile | Capacitor 8.4 with `android/` and `ios/` | PayFast in the native app goes through `/pay` (PayBridgePage) and `/app-return`. |
| Backend | Supabase Postgres, 215 migrations, 38 Deno edge functions | Conventions: `SECURITY DEFINER` functions with `SET search_path`, `REVOKE … FROM PUBLIC, anon`, money worked out in SQL. |
| Supabase client | `src/integrations/supabase/client.ts` hard-codes the URL and anon (publishable) key | The anon key is public by design; isolation depends entirely on RLS. |
| `.env` (tracked) | `SITE_URL`, `VITE_SITE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` | No secrets among these names. **Verify** git history for any secret committed earlier. |
| Amplify | `@aws-amplify/backend` dev dependencies; no `amplify.yml` in the repo | Build settings and rewrites live in the Amplify console. **Verify** that the SPA rewrite covers `/pay/*` and `/merchant/console`. |
| LLM provider | None in the codebase | `influencer_ai_suggestions` is not backed by a model. |
| Tests | No test runner in `package.json` | Lint and build only. |

## 2. Ownership and roles (MAI-002)

```
auth.users ─1:1─ profiles (role: app_role)          user_roles (app_role)   is_admin(uuid)
     │
     └─1:1─ merchants (user_id, status: pending|approved|suspended|rejected, subscription_*)
                 └─1:n─ stores (merchant_id, slug)
                            ├─ products (store_id)  ─ product_variations
                            └─ order_items (store_id, merchant_status) ─n:1─ orders (user_id, payment_status, status)
```

* One user owns at most one merchant. There was **no staff or delegated access** before this work.
* An order can span stores; each store's part is its `order_items` rows (`merchant_status`: pending, processing,
  shipped, out_for_delivery, delivered).
* Money is `numeric` rand (`orders.total`, `order_items.price`). Newer modules (service marketplace) use integer cents.

### RLS findings

| # | Finding | Severity | Status |
|---|---|---|---|
| R1 | The policy `"Vendors can update order items from their stores"` lets a merchant UPDATE **any column** of their own lines, with no WITH CHECK beyond ownership and no guarding trigger. `merchant_payout_balance()` sums `order_items.price × quantity`, so a merchant can raise the price on delivered lines through the REST API and inflate their withdrawable balance. | **High** | **Fixed** in `20261021090400_guard_order_item_edits`: for API callers who are not admins, a `BEFORE UPDATE` trigger allows only `merchant_status` and `updated_at` to change. The existing dashboard changes only `merchant_status`; database functions are not limited. |
| R2 | The migrations contain no merchant SELECT or UPDATE policy on `public.orders`. `MerchantOrders.updateOrderStatus` writes `orders.status` and `tracking_number`; under RLS these writes would match no rows and fail silently. `MerchantOverview` filters through `orders!inner`, which would then return nothing. | Medium | **Verify** against the live policies (`select * from pg_policies where tablename = 'orders'`). If confirmed, the tracking numbers that merchants see are never saved. The new console avoids the issue by moving orders through `merchant_order_advance()`. |
| R3 | Admin policies on older tables check `profiles.role = 'admin'`; newer ones use `is_admin(uid)`. | Low | Noted. The new tables use `is_admin`. |
| R5 | `ConsumerOrders.handleCancelOrder` deletes `order_items`, `order_history` and `order_insurance` from the browser, but no DELETE policy exists for customers, so "cancel" probably removes nothing while reporting success. | Medium | **Verify** and fix separately; not touched here. |
| R4 | Supabase grants table privileges to `anon` by default, so on tables without an anon policy RLS is the only barrier. | Info | New tables also `REVOKE ALL … FROM anon`. |

## 3. Payments and order lifecycle (MAI-003)

* **Provider:** PayFast only (`_shared/payfast.ts`). Hosted checkout: `payfast-payment` signs the form and `payfast-itn`
  verifies the signature, the merchant id and PayFast's server-side `validate` call, then dispatches on the
  `m_payment_id` prefix (`ORDER-`, `SVC-`, `FOOD-`, `AUCREG-`, `AUCWIN-`, `TIER-`, `ADC-`, `DEPOSIT-`, `LINKCARD-`).
* **Amounts** are worked out on the server for every purpose, and ITN amounts are compared in cents. Repeated ITNs
  are handled per branch (status checks or `pf_payment_id` lookups); there was no general event table.
* **Return URLs:** `payfast-payment` accepts any `http(s)` `returnUrl` from the client (`safeUrl`). That allows an
  open redirect after payment. Low impact, but worth limiting to an allowlist like the one in `merchant-payment-request`.
* **Stock** is taken when payment is confirmed (`apply_paid_order_stock`), not reserved at checkout. Pre-orders are
  allowed only for XIXLV products on flagged stores.
* **Order status** (`orders.status`): pending → processing (paid) → shipped → out_for_delivery → delivered, or cancelled.
  Merchants set per-line `merchant_status` from `MerchantOrders.tsx`, which writes the table directly.
* **Delivery:** `RequestDeliveryButton` inserts `delivery_jobs` from the browser (pickup address is hard-coded to
  Johannesburg). Drivers and dispatch take over from there.
* **Refunds and returns:** `orders.refund_status` / `return_status` through `RefundReturnDialog`, then admin.
* **Merchant payouts:** `merchant_payout_balance()` / `request_merchant_payout()`, from delivered order lines less the
  plan's commission.
* **Realtime:** `orders` is in `supabase_realtime`; `order_items` is not. Merchants cannot read `orders` under RLS (R2),
  so the console polls instead.

## 4. What already existed (to avoid duplicates)

Merchant onboarding with KYC steps, subscriptions with `FeatureGate`, the shopfront and storefront builder, products
and variations, inventory settings, promotions, payouts, the new-order chime (`useNewOrderAlert`), the order event
timeline (`order_events`), lodging bookings and a service marketplace with bookings and escrow. **Bookings (spec 5.6)
are therefore already covered** by `service_*` and `lodging_bookings`; a third booking model was not added.

## 5. Gate G0

The entity map above is the basis for the migrations in `supabase/migrations/20261021090000…090600`. They add tables
and functions. They touch existing objects in only three places: a nullable `stores.pickup_address` column, a
`BEFORE UPDATE` trigger on `order_items` (the R1 fix), and a new `PREQ-` branch in `payfast-itn`. No existing policy or
function is changed. **They have not been applied to any environment.** Approval of this document, plus a staging run of
`supabase/tests/merchant_ai_test.sql`, is the G0 exit.
