# Merchant AI: as built

What exists on `feature/merchant-ai`, how to deploy it, and what is still to decide. The integration audit is in
[../audits/merchant-ai-discovery.md](../audits/merchant-ai-discovery.md).

Everything is **off by default**. A platform admin switches features on per merchant under
**Admin → Merchant AI**: order console, payment links and 1145 AI.

## What it does

| Area | Merchant sees | Built from |
|---|---|---|
| Staff and permissions (MAI-004) | Dashboard **Team** tab: the owner adds existing 1145 accounts as manager, cashier, catalogue editor or finance. | `store_members`, `store_role()`, `store_has_permission()`, `merchant_my_access()` |
| Feature flags (MAI-004) | New tabs appear only when switched on | `merchant_feature_flags`, `admin_set_merchant_feature()`, `AdminMerchantAI.tsx` |
| Order console (MAI-005) | **Order Console** tab and full-screen `/merchant/console` for tablets. Columns New → Accepted → Preparing → Ready → Dispatched, a chime for new orders, large buttons, offline banner, polling every 15 s. **Request driver** on Ready orders, collecting from the store's pickup address. | `merchant_order_queue()`, `merchant_order_advance()`, `merchant_order_request_delivery()` + `stores.pickup_address` (one step at a time, row locks, request keys, `order_events` for the customer timeline), `merchant_order_actions` |
| Payment links (MAI-006) | **Payment Links** tab: amount, description, reference, expiry, then a QR code and link. The payer opens `/pay/<token>` and pays on PayFast. | `merchant_payment_requests`, `merchant_payment_events` (one per PayFast payment), `merchant_payment_ledger` (append-only), the `merchant-payment-request` function, the `PREQ-` branch in `payfast-itn` |
| Insights (MAI-007) | Used by the assistant, and callable from future reports | `merchant_sales_summary`, `merchant_top_products`, `merchant_stock_alerts`, `merchant_fulfillment_metrics`, `merchant_find_products` |
| 1145 AI (MAI-008/009) | **Ask 1145 AI** tab: questions about the store, plus drafted product descriptions and promotion copy, which wait under **AI drafts** for approval | the `merchant-ai` function (Claude Opus 5.5 with a fixed tool list), `merchant_ai_*` tables, `merchant_ai_draft_decide()` |

### Rules the code enforces

* **Access is decided in the database.** Every function calls `require_store_access(store, permission, flag)`.
  The UI hides tabs only for convenience.
* **Money:** amounts are integer cents in ZAR. A payment link's amount is fixed when it is created; the pay page and
  PayFast cannot change it. A link is marked paid only by `payment_request_mark_paid()`, called from a verified ITN, and
  only when the amount matches. Repeated ITNs are ignored (`unique (provider, provider_event_id, event_type)`). Coming
  back from PayFast only shows "Confirming…".
* **Return URLs** are built on the server from an allowlist (`SITE_URL`, 1145.io, the Capacitor origins and
  `PAYMENT_RETURN_ORIGINS`).
* **The assistant:** the store comes from the caller's session and is checked with `store_has_permission`. The model
  never sees or chooses a store id. Tools are the allowlisted functions above, run with the **user's own JWT**, so RLS
  and permission checks apply. The model has no SQL and no direct writes; it can only save drafts. Approving a product
  description is a separate human action. Every tool call is logged with a parameter digest, outcome and duration.
  Each store has a daily question allowance (`MERCHANT_AI_DAILY_LIMIT`, default 50), and token use is recorded per day.
  No customer names, phones or addresses are sent to the model.
* **The console** never changes an order until the server confirms the change, and its buttons are disabled offline.

## Deploying (staging first)

1. Back up the database (PITR or a dump).
2. Apply the migrations: `supabase db push`. They are additive; review them first:
   `20261021090000_merchant_ai_foundation`, `…090100_merchant_order_console`, `…090200_merchant_payment_requests`,
   `…090300_merchant_insights_ai`, `…090400_guard_order_item_edits` (closes audit R1), `…090500_merchant_console_delivery`,
   `…090600_merchant_ai_pilot_metrics`.
3. Run the tests: `psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/merchant_ai_test.sql`. The script
   should end with `merchant ai tests passed` and roll back. It has been run only on PGlite with stand-in tables, not
   on a real Supabase schema, so expect to adjust fixture columns if your tables have extra NOT NULL columns.
4. Set the function secrets:
   `supabase secrets set ANTHROPIC_API_KEY=… MERCHANT_AI_DAILY_LIMIT=50 MERCHANT_AI_EFFORT=medium`.
   Optionally set `PAYMENT_RETURN_ORIGINS=https://staging.example` for staging hosts.
5. Deploy the functions: `supabase functions deploy merchant-ai merchant-payment-request payfast-itn`.
6. Check that the Amplify SPA rewrite sends `/pay/<token>` and `/merchant/console` to `index.html`.
7. Use the PayFast sandbox (`PAYFAST_SANDBOX=true`) to create a link, pay it, and confirm it turns Paid only after the
   ITN arrives; then repeat the ITN and confirm the ledger still has one row.
8. Run the assistant eval against staging (it costs money; see `scripts/merchant-ai-eval.mjs` for the variables):
   `node scripts/merchant-ai-eval.mjs`. Every case should pass, and the saved answers should be read by a person before the pilot.
9. Switch features on for internal test merchants, then for the pilot cohort (cohort label `mbombela-pilot`).

**Rollback:** first switch the flags off, which hides everything immediately. To remove the schema, use
`supabase/rollback/20261021_merchant_ai_down.sql` (read its header: it deletes Merchant AI data). Then revert the
`payfast-itn` branch and the frontend.

## Decision records

**ADR-1: Staff are rows in `store_members`, not a new identity store.** Staff sign in with ordinary 1145 accounts.
Roles map to permissions in `store_role_permissions()`, in one place. `/merchant/console` requires sign-in only,
because staff do not have the `merchant` app role; the database decides what they see.

**ADR-2: Payment links use the existing PayFast integration.** There is no new provider adapter yet; the `PREQ-`
prefix follows the existing ITN pattern. The ledger records what was collected and is **not** added to
`merchant_payout_balance()`, because fees and settlement for link payments are not decided (see below).

**ADR-3: Claude Opus 5.5 through the official Anthropic SDK (`npm:@anthropic-ai/sdk@0.133.0`) in a Supabase edge
function**, with a manual tool loop so every call can be authorized and audited on the server. Server-side refusal
fallback (`fallbacks: "default"`) is on. The system prompt is cached. Effort defaults to `medium` and is configurable.
Merchant data goes to Anthropic for processing; see the POPIA item below.

**ADR-4: `qrcode.react@4.2.0` for QR codes.** It is small, has no dependencies, and renders the code in the browser, so
payment URLs are never sent to a third-party QR service.

**ADR-5: Polling, not Realtime, for the console.** Merchants cannot subscribe to `orders` under the current RLS, and
`order_items` is not published. Polling every 15 s with refetch on focus and reconnect works on unreliable connections.
Realtime can be added later through a narrow per-store channel.

## Work packages

| ID | Status |
|---|---|
| MAI-001 to 003 discovery | Done: see the audit. Live DB, Amplify and PayFast account still to **verify**. |
| MAI-004 permissions and flags | Built and tested (PGlite) |
| MAI-005 tablet console | Built. Not yet tried on real tablet hardware. |
| MAI-006 payment links | Built. Needs a PayFast sandbox end-to-end run. |
| MAI-007 analytics | Built and tested (PGlite) |
| MAI-008 read-only AI | Built. Eval harness `scripts/merchant-ai-eval.mjs` (traceable amounts, isolation, drafts) written, not yet run. |
| MAI-009 AI drafts | Built (product descriptions publish on approval; promotions are copy only) |
| MAI-010 bookings | Not built: `service_*` and `lodging_bookings` already cover bookings (see the audit, section 4) |
| MAI-011 pilot onboarding and telemetry | Built: cohort labels and the admin **Pilot measurement** panel (`admin_merchant_ai_pilot_metrics`). Training material not written. |
| MAI-012 NFC Tap to Pay | Not started (needs provider and regulatory clearance) |

## Decisions needed before the pilot

1. **Settlement of payment-link money:** what fee applies, when it is paid out, and whether it joins
   `merchant_payout_balance()`. Until then, link takings are recorded but not withdrawable.
2. **Refunds for `refund_due` links** (paid after cancelling): today this is a manual support process.
3. **AI provider terms and POPIA:** an operator agreement and a cross-border transfer assessment for Anthropic,
   retention of `merchant_ai_*` rows, and the monthly budget behind `MERCHANT_AI_DAILY_LIMIT`.
4. **Multi-store orders and delivery:** "Request driver" handles orders from one store only, because `delivery_jobs` allows one job per order. Orders that span stores still go through the Orders page, which has a hard-coded Johannesburg pickup address.
5. **Pilot success thresholds:** the panel reports activation, weekly actives, acceptance time, link completion and exceptions; the targets for each still need agreeing.
