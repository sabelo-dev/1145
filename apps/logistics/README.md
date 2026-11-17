# 1145 Logistics

Standalone operations console for dispatchers, fleet managers and hub staff. It is
a separate SPA with its own build and domain, and it shares the Supabase
backend, UI kit and maps with the main 1145 app (`src/`).

App code lives in `src/logistics/`. This folder holds only the HTML entry and
bootstrap.

## Run and build

```bash
npm run dev:logistics       # http://localhost:8090
npm run build:logistics     # → dist-logistics/ (deploy as a static SPA, rewrite all paths to index.html)
npm run preview:logistics   # serve the build on :8091
```

It uses the same `.env` as the main app (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, optionally `VITE_GOOGLE_MAPS_API_KEY`). To serve
it under a sub-path instead of its own domain, set
`VITE_LOGISTICS_BASE_PATH=/logistics` at build time.

## Backend setup (one-off)

1. Apply the migrations `20261116100000_logistics_platform.sql`,
   `20261116130000_logistics_upgrades.sql`, `20261116150000_logistics_future.sql` and
   `20261116170000_logistics_security_speed.sql` and `20261116190000_logistics_windows_cod_privacy_eta.sql` and
   `20261116210000_logistics_pudo_accounts_returns.sql` and
   `20261116230000_logistics_portal_pieces_billing.sql`, `20261117010000_logistics_scanning_dunning.sql`
   and `20261117030000_logistics_pod_branding_digest.sql` (`supabase db push`). These schedule `logistics_dispatch_sweep()` every minute and the
   retention and ETA-training jobs nightly with pg_cron.
2. Deploy the functions: `supabase functions deploy logistics-dispatch logistics-notify logistics-api logistics-invoice-email logistics-billing-run`.
   `logistics-api` geocodes with the existing `GOOGLE_MAPS_API_KEY` secret.
   `logistics-notify` reuses the existing `INFOBIP_*` (SMS) and `RESEND_API_KEY`
   (email) secrets. Optionally set `LOGISTICS_TRACK_URL` (default
   `https://logistics.1145.io/track`) and `LOGISTICS_EMAIL_FROM`.
3. Sign in with a platform admin account. Admins are logistics owners automatically.
   Add the rest of the team on the **Team** page. Each person needs an existing
   1145 account.
4. Add at least one hub on **Hubs** so routes have a start point.
5. Optional: `supabase gen types typescript` to type the new tables. After that,
   `src/logistics/lib/db.ts` can use the typed client.

## Roles

| Role | Can |
| --- | --- |
| owner | everything, including Team and Hubs |
| dispatcher | shipments, routes, dispatch |
| fleet_manager | vehicles, fleets, hubs |
| hub_operator | book shipments, scan in at hub |
| viewer | read-only |

## Flow

1. Book a shipment (single entry or CSV import). It is geocoded and gets a tracking
   number (`LX…`).
2. Plan a route from the selected shipments. The server adds pickup stops for
   parcels not yet collected and optimises the stop order: pickup always comes
   before its delivery, using nearest-neighbour then 2-opt.
3. Dispatch the route. The driver sees it under **My Route** in the driver app and
   works it stop by stop: arrive, then collected / delivered (with name, OTP and
   photo) or failed (with a reason).
4. Every change is written to `shipment_events`. Customers follow progress at
   `/track/<tracking number>`, which shows no PII beyond first name and city.

On-demand jobs (`delivery_jobs` from marketplace orders) appear on **Dispatch**.
There they can be auto-assigned to the nearest available driver on the server,
or assigned by hand.

## Connected flows

- **Marketplace orders.** When a merchant clicks *Request Delivery*, a shipment is
  created automatically with a tracking number, timeline and recipient SMS. It
  is collected from the vendor's business address. On-demand driver progress
  keeps the shipment status in sync.
- **Consumer parcels.** `/package/send` in the main app gives a live
  server-side quote (`quote_parcel`) and books through `book_parcel`. Express
  and same-day bookings go to the Dispatch queue; next-day and economy bookings
  are planned onto routes. Senders can cancel until the parcel is collected.
- **Tracking.** The main app's `/track-order` accepts `LX…` tracking numbers.
- **Notifications.** Recipients get SMS/email when a parcel is booked, out for
  delivery (with the OTP when required), delivered, missed, or returned. Each
  event is sent at most once.
- **Proof of delivery.** OTPs are only verified on the server
  (`driver_complete_job` / `driver_update_stop`). A database trigger blocks marking an
  OTP-protected job delivered any other way. Photos and signatures are stored
  in the private `delivery-proofs` bucket.
- **Driver presence.** `drivers.current_location`/`status` are mirrored into
  `driver_locations`, which feeds the live map, auto-assign and ride dispatch.

## Console extras

- **Scan station** (`/scan`): USB/Bluetooth barcode scanners (or typing) to receive
  parcels at a hub, close returns, or look up status. It beeps on each scan.
- **Labels**: 100×150 mm with a Code 128 barcode. Print them one at a time or in bulk from Shipments.
- **Reports** (`/reports`): on-time trend, first-attempt success, failure reasons,
  per-service performance, CSV export.
- **Route reordering**: move stops by hand. ETAs are recalculated on the server, and a delivery can't be moved ahead of its pickup.

## Platform capabilities

- **Plan my day** (Routes): turns the backlog into routes per hub. Parcels are grouped
  by direction from the hub, capped by stops and load, ordered with parcels due today
  first, optimised, and given the nearest free drivers. You preview the plan before
  anything is created.
- **Live tracking**: once out for delivery, the tracking page shows how many stops are
  before yours and your stop's ETA. The driver's position (rounded to about 100 m and
  only if fresh) appears only within 3 stops.
- **Recipient self-service** (no account needed; confirmed with the last 4 digits of
  their phone, locked after 5 misses): set a safe place and instructions (drivers see
  them on the stop), reschedule up to 7 days ahead (the planner respects it), and rate
  the delivery.
- **Business API** (`/functions/v1/logistics-api/v1`): API keys are created on
  **Developers** (stored only as SHA-256 hashes). Create, list, get, cancel and quote
  shipments. Supports `Idempotency-Key`, and addresses are geocoded on the server.
- **Webhooks**: every status change and hub scan is POSTed to your endpoints with
  `X-1145-Signature: t=…,v1=HMAC-SHA256(secret, "t.body")`. Each event is delivered
  once per endpoint, with up to 3 retries, and a delivery log is kept.
- **Driver pay**: on-demand deliveries use the existing `calculate_delivery_earnings`
  (it was never called before). Routed stops earn R12 per delivery, R5 per pickup and
  R4/km from the previous stop. Both land in `delivery_earnings`.
- **Offline route runs**: with no signal, stop actions are queued on the device with the
  real time they happened, replayed in order when online, and checked by the server as
  if live.
- **Wallet payments**: consumers can pay for parcels from their 1145 Wallet. Cancelling
  refunds the wallet automatically.
- **Sustainability**: each route stores an estimated CO₂ figure based on distance and
  vehicle type. Reports show total CO₂ and grams per delivered parcel.

## Security

- **Two-factor (TOTP).** Staff can turn it on under **Security**. Owners can require it
  for everyone. This is enforced in the database: `logistics_role()` returns nothing for
  sessions without a second factor (`aal2`), so RLS, RPCs and the dispatch function all
  refuse them. Owners must verify their own second factor before switching it on.
- **Idle sign-out** for shared depot terminals (default 30 minutes).
- **Audit log** (owners): team, API key, webhook, settings and hub changes, plus staff
  cancellations, exceptions, returns, route dispatch/cancel and OTP resets. Each entry
  records the actor and IP. Secrets are never logged.
- **Delivery-code brute-force lock.** 5 wrong codes lock the parcel. Dispatch issues a
  new code after confirming the recipient.
- **Rate limits.** Public tracking allows 60 lookups/min per IP, self-service 10/min per IP,
  and quotes 120/min per IP. Each API key has its own limit (default 120/min, returns `429` with
  `Retry-After`). Failed API authentication is throttled per IP.
- **API keys.** Each key has scopes (`shipments:read`, `shipments:write`, `quotes:read`),
  optional IP allowlists (exact IPs or IPv4 CIDR) and an optional expiry.
- **Webhooks.** Private, loopback and link-local targets are rejected (database constraint and
  DNS check at send time), and redirects are never followed.
- **Tracking numbers** have 8 random characters per day (about 4.3 billion possible numbers per day).

## Speed of service

- **Instant dispatch.** New on-demand jobs are offered to the nearest available
  driver (by distance and rating) as soon as they're created. A decline goes to the next
  driver straight away, and an expired offer moves on within a minute. Jobs stay
  claimable from the open pool throughout.
- **Dispatch sweep** (every minute): re-offers jobs as drivers come online, releases
  accepted jobs whose driver went offline before pickup, flags parcels at risk of
  missing their promise (shown on Overview and the shipment), and keeps live ETAs current.
- **Live ETAs** are recalculated from the driver's real position after every stop and every minute.
- **Auto-arrive.** The driver app marks a stop as arrived within about 100 m (when GPS
  accuracy is 80 m or better).
- **Indexes** on the hot paths: open jobs, offers, route stops, SLA scans and API idempotency.

## Customer and B2B controls

- **Delivery windows**: morning (08:00-12:00), afternoon (12:00-17:00) or evening (17:00-20:00) for
  next-day and economy services. Customers choose one at booking (consumer, ops or API
  `delivery_window`) or when rescheduling. The planner builds separate waves per window, the
  optimiser visits stops in window order, and ETAs wait for the window to open.
- **High-value review**: parcels at or above the declared-value or cash-on-delivery thresholds
  (Security page) are held. They cannot be offered, claimed, routed or dispatched until someone
  other than the booker approves them.
- **Cash on delivery**: every delivered COD parcel creates a collection owed by the delivering
  driver. The **Cash on delivery** page shows cash held per driver (flagging anything held over 24 h)
  and records hand-ins with a deposit reference (audited). Drivers see their balance in My Route.
- **POPIA**: personal data is removed nightly once a parcel has been closed for longer than the
  retention period (default 90 days). Parcels with unremitted cash are kept until settled. The
  Security page handles data-subject access and erasure requests and deletes expired proof photos.
- **Learned ETAs**: each night, per-hub, per-hour driving speed and stop time are learned
  from the last 30 days of stops (medians, outliers removed). Live ETAs and the optimiser use them.
  Reports show ETA accuracy (median error of the first promised ETA, and the share within 15 minutes).

## Collection points, business accounts, returns

- **Pickup points and lockers**: hubs of type *pickup point* or *locker*, marked *public*, are
  offered to customers on Package Send (20% cheaper; not for Express) and through the API
  (`pickup_point_code`, `GET /v1/pickup-points`). Routes end with a hub drop at the point, and the
  parcel becomes *Ready to collect*. The customer gets an SMS with the code and the collect-by date (7 days).
  Staff hand it over in **Scan station > Hand over to customer** (code + name, 5-try lock).
  Uncollected parcels go back to the sender automatically.
- **Business accounts** (owners, **Business accounts** page): company details, payment terms,
  credit limit and discount. API keys and ops bookings can be billed to an account.
  - New bookings through the API are refused (HTTP 402) when the account is on hold, has
    overdue invoices, or would exceed its credit limit.
  - Monthly VAT invoices (15%, fees treated as VAT-inclusive) are drafted on the 1st, or on demand.
  - Owners then issue, mark paid (with a bank reference), void or print them. Every invoice action is audited.
- **Returns**: recipients can book a return from the tracking page within 14 days of delivery
  (last-4 phone check), staff from the shipment sheet, and merchants through
  `POST /v1/shipments/:tn/return`. A reverse shipment is created (economy service, 90% of the original fee,
  billed like the original), with one open return per parcel.

## Business portal, pieces, invoice email

- **Business portal** (`/portal` in the same app): users linked to a business account
  (added on the account in **Business accounts**, or by the account admin under *Team*) sign in
  and see only their account. Access is enforced by row-level security:
  - **Users** can view the overview and shipments (search, timeline, labels, CSV export, cancel,
    return) and book deliveries.
  - **Admins** additionally get invoices (PDF), their own API keys and webhooks, and team management.
  - Portal bookings use the same pricing, account discount, credit control and high-value review as the API.
- **Multi-parcel shipments**: every box gets its own label and barcode (`LX…-1`, `LX…-2`, …),
  shown as "2/3". At the scan station each piece is scanned. The shipment moves to the hub only
  once all its pieces have arrived there (partial receipts show as warnings, e.g. "2/3 here").
- **Invoice email** (`logistics-invoice-email`): owners email issued invoices and payment reminders
  to the account's billing contact from **Business accounts > Invoices**. Sends are logged.
  Optional secrets: `LOGISTICS_BILLING_FROM` and `LOGISTICS_PORTAL_URL`.

## Scanning & billing automation

- **Camera scanning** (`src/components/scanning/BarcodeScanner.tsx`) uses the browser's
  built-in BarcodeDetector (Android app WebView, Chrome), so no extra libraries are needed.
  It falls back to typed entry (for example on iOS Safari).
  - **Drivers** scan every box at pickup and delivery from **My Route** and see progress like "2/3".
    Completing a stop with unscanned boxes requires a "counted by hand" confirmation, which is
    recorded in the proof and shown to dispatch.
  - The **Scan station** has a camera button for hub phones.
- **Daily billing run** (`logistics-billing-run`, 06:00 SAST via pg_cron, authenticated with a
  database-held secret, so no extra configuration):
  - optionally issues and emails monthly drafts
  - sends overdue reminders on the configured days (default 1, 7 and 14)
  - emails monthly statements on the 1st
  - puts accounts on hold after N days overdue (default 30)

  Configure it under **Security > Billing automation**. Every action is audited.
- **Portal performance**: on-time %, first-attempt success, lead time, spend, returns, daily
  deliveries, reasons for missed deliveries, and per-service results, with CSV export.

## Proof of delivery, branding, daily exceptions

- **Proof of delivery** is available to staff, the booking business account, and the consumer
  who booked the parcel. It shows when, who received it, how (code, photo, signature or
  collection point), the GPS position at handover, box-scan count, and the photo/signature
  (signed links valid for 10 minutes).
  - Shown in the console shipment sheet and the portal shipment view.
  - API: `GET /v1/shipments/:tn/pod`.
  - Storage access is limited by `logistics_can_read_proof()` to people who can see the shipment.
- **Branded tracking**: account admins set brand name, logo (https), colour, support phone
  and email, and a short message under **Portal > Settings**. Their customers see that branding
  on the tracking page (both apps), labelled "delivered by 1145 Logistics".
- **Daily exceptions email**: each morning (with the billing run), accounts receive a list of
  their parcels from the last 24 hours that were missed, had a problem, are returning, or are at
  risk of being late. It goes to the ops email (or the billing email if none is set), is only
  sent when something needs action, and can be turned off in portal settings.

## Testing

```bash
bash supabase/tests/logistics/run.sh
```

This starts a throwaway local PostgreSQL (port 55432; set `PG_BIN` if your binaries live elsewhere).
It builds the base schema from `src/integrations/supabase/types.ts` (the migration history doesn't
contain the original tables), stubs Supabase (roles, `auth.uid()/jwt()`, storage, `pg_net`),
replays **all** migrations, and then runs:

- `10_e2e.sql`: 81 end-to-end checks across bookings, row-level security isolation, instant dispatch,
  idempotent accept, OTP lockout and reset, the 3-miss auto-offline rule, routes with box scans,
  locker handover, COD, public tracking (no PII, rate-limited), self-service returns, portal
  credit control, four-eyes approval, invoicing with VAT, MFA enforcement, sweep/ETA/retention/POPIA
- `offer-alert-controller.test.mjs`: the 27-point offer-alert state-machine checklist

- `contract-check.mjs`: every literal `rpc()` / `.from()` call in logistics code (frontend and edge
  functions) checked against the real schema (function names, parameter names, tables, columns)
- `route-optimizer.test.mjs`: pickup-before-delivery and window ordering on 300 random routes,
  savings against random order, and the gap to the brute-force optimum on 7-stop routes
- a strict type-check of the five logistics edge functions (Deno globals stubbed)
- `edge-functions.test.mjs`: runs the real edge-function handlers in Node, with Supabase and
  outbound HTTP mocked in-process. It covers CORS, API-key auth (revoked, expired, IP allowlist/CIDR,
  scopes), 429 rate limiting, input validation, dispatch role checks, the billing cron secret,
  owner-only invoice email, and webhook routing, HMAC signature, redirect and private-target blocking

`perf.sql` measures the cost of row-level security on a large shipments table.
Policies wrap per-query constants in `(SELECT …)` so they're evaluated once per query, not per row.
