# Deploying 1145 Logistics to the live project

The logistics code on this branch calls new database functions (for example
Package Send calls `quote_parcel` and `book_parcel`). **Do these steps in
order, before merging into `production`.** If the website deploys first,
parcel booking breaks until the database step is done.

Live project: `hipomusjocacncjsvgfa`.

## 1. Pre-flight check (read-only)

Supabase dashboard → SQL Editor → paste `logistics_preflight.sql` → Run.

Every row must say `ok`. It checks that production's migrations this builds on
are applied (merchant rename, nearby dispatch, wallets), that `pg_net` and
`pg_cron` are available, and that logistics isn't already installed.

## 2. Apply the database changes (one transaction)

SQL Editor → paste `logistics_apply.sql` → Run.

- It runs all ten logistics migrations as **one transaction**: if any
  statement fails, nothing is changed. Fix the cause and run it again.
- It refuses to run a second time once logistics is installed.
- It records the ten migrations in `supabase_migrations.schema_migrations`,
  so `supabase db push` never runs them again.
- It waits at most 15 s for a table lock and then stops, rather than queueing
  behind live traffic. If that happens, run it again at a quieter time.

`logistics_apply.sql` is generated from `supabase/migrations/2026111*_logistics_*.sql`:

```bash
node supabase/deploy/build-logistics-deploy.mjs
```

## 3. Deploy the edge functions

```bash
npx supabase login
npx supabase functions deploy logistics-api logistics-dispatch logistics-notify logistics-invoice-email logistics-billing-run --project-ref hipomusjocacncjsvgfa
```

They use secrets the project already has (`RESEND_API_KEY`, Infobip SMS,
Google Maps). Optional:

| Secret | Default | Used for |
| --- | --- | --- |
| `LOGISTICS_TRACK_URL` | `https://1145.io/track` | Tracking links in SMS, email and the API. `1145.io/track/LX…` opens the website's tracking page. |
| `LOGISTICS_EMAIL_FROM` | `1145 Logistics <no-reply@1145.io>` | Notification emails |
| `LOGISTICS_BILLING_FROM` | `1145 Logistics Billing <billing@1145.io>` | Invoices and statements |
| `LOGISTICS_PORTAL_URL` | `https://logistics.1145.io/portal` | Link in business billing emails. Set it once the Logistics app is hosted. |

## 4. Merge into production

Merge `logistics-on-production` into `production`. After it deploys:

1. Sign in to the Logistics console as an admin and add your team under **Team**.
2. Add hubs and pickup points under **Hubs**.
3. Book a test parcel on Package Send and follow it on `1145.io/track/<LX number>`.

## What it changes in existing data

- **No existing rows are changed.** It adds new tables and functions, new
  columns with defaults on `delivery_jobs` and `drivers`, and triggers.
- **Open marketplace deliveries get a shipment.** Jobs that are pending,
  accepted, picked up or in transit when you run it get a matching shipment, so
  they show in tracking and on the dispatch board. Delivered and cancelled jobs
  are skipped.
- **No messages are sent** for those backfilled shipments. Notifications start
  with the next status change.
- **Production's nearby dispatch is unchanged** for existing jobs.

(Rehearsed on a copy of production's schema with open and delivered orders:
three shipments created, no SMS or email calls, dispatch state unchanged.)

## Undo

Contact the developer before removing anything: dropping the logistics tables
deletes shipments, invoices and proof-of-delivery records.
