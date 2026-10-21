# 1145 Driver

The separate Android app uses application ID `io.lifestyle1145.driver`, the
`android-driver/` project and the `dist-driver/` web build. It can coexist with
the consumer app. The driver web build is also installable as a PWA when served
on its own HTTPS origin with SPA rewrites to `index.html`.

## Build and configuration

- `npm run test:dispatch`: embedded PostgreSQL dispatch tests and mocked Routes
  API endpoint tests (requires Node 22.18+ or Node 24).
- `npm run build:driver`: standalone web assets.
- `npm run driver:sync`: build and sync Android plugins and web assets.
- `npm run driver:open`: open Android Studio. Build/sign the APK or app bundle
  there, using Java 21 and the Android SDK required by Capacitor 8.

Add a Firebase Android application for `io.lifestyle1145.driver` in the same
Firebase project used by `send-push`. Put its configuration at
`android-driver/app/google-services.json`, then rebuild. The configuration for
the consumer package cannot be reused. Without this file registration is
intentionally disabled; foreground offer cards and polling still work.

## Server rollout

1. Apply `20261022120000_driver_nearby_dispatch.sql` after the existing driver
   verification, dispatch, food delivery and merchant delivery migrations.
2. Confirm the `nearby-driver-dispatch` pg_cron job is active at a 15-second
   interval. If pg_cron is unavailable, an external scheduler must call the
   service-only `run_nearby_dispatch()` function at that interval. It continues
   expired-offer searches even after the rider closes the app.
3. Deploy `ride-arrival` and the updated `send-push` functions.
4. Set `GOOGLE_ROUTES_API_KEY` to a server-only Google key with Routes API and
   billing enabled. Do not reuse the browser key exposed by `maps-config`.
5. Verify the existing `push_webhook_secret` Vault entry,
   `PUSH_WEBHOOK_SECRET`, `FIREBASE_SERVICE_ACCOUNT` and notification trigger.
6. Publish the main web app too: it contains the rider arrival display and the
   browser return bridge for the separate driver app. Build/sync the driver app
   again after Firebase configuration is present.

Coordinate server/frontend release during a dispatch maintenance window. The
migration blocks old direct trip claims, so older installed driver apps must
be updated. Existing pending requests created before rollout are not backfilled
into the new dispatch queue; cancel/re-request these during cutover. No live
migration, charge, app signing or store publication is performed by this change.

## Passenger, food and parcel services

Also apply `20261022130000_driver_service_preferences.sql` after the dispatch
migration, and publish both the updated driver and main/admin builds. Drivers
use **Services I accept** in the sidebar (also in Settings) to toggle passenger,
food, and parcel/goods work independently. All-off pauses new offers; accepted
work is finished normally. Incompatible outstanding offers expire immediately.

Scooters are delivery-only, even if the driver edits their profile label to
"car". Passenger work requires a verified physical car/van classification on
the session vehicle, as well as the existing vehicle-tier and session checks.
Motorcycles, bicycles and trucks are also delivery vehicles. A driver in a car
can select passengers only, deliveries only, food only, parcels only, or a mix.
Food jobs are identified by `delivery_jobs.food_order_id`; other delivery jobs
are parcels/goods. The server checks this before notifying and again when an
offer is accepted. The 5/10/15 km radius rules apply after service eligibility.

During cutover, review `vehicles.transport_mode`: known existing physical types
are copied once from the recorded driver profile, and unknown types remain
unclassified. The classification is thereafter protected from driver edits.
New vehicle verifications require the admin to confirm the physical type
against the registration papers in **Driver Compliance > Vehicles**. A vehicle
must be offline for reclassification; unknown vehicles cannot receive passenger
offers until reviewed. Existing ride service tiers are separate from physical
types and are still required to match the customer's selected ride category.

Test a scooter against all three request kinds, a passenger-only car, a
food-only car, a parcel-only car, and mixed preferences; verify that disabling
an offered service blocks acceptance while an accepted trip can still finish.

## Matching and arrival behavior

Drivers sign in, go online using the existing device/selfie verification flow,
and grant location and notification permission. GPS is shared across all driver
screens, including Android background operation through a foreground location
service. Going offline or signing out stops tracking. Device force-stop,
permission revocation and OS battery restrictions can stop updates; positions
older than 90 seconds are excluded rather than treated as current. The PWA can
track while open; native Android is required for reliable background operation.

A request first offers to eligible drivers within 5 km of its pickup. If none
are eligible it checks 10 km, then 15 km, never farther. Offers expire after 45
seconds. Declines/expiry exclude that driver's previous offer and allow the next
search. Available, verified, fresh-location drivers without an active job are
eligible; ride vehicle type must match the verified session vehicle. Acceptance
is transactional and checks the account, bound device, expiry, current radius,
existing trip and unclaimed request. Radius is geographic distance from pickup;
arrival estimates use driving distance along roads.

Merchant/eatery pickup coordinates must be set. Address-only delivery jobs
cannot be matched by radius and are not broadcast to arbitrary drivers. Confirm
pickup pins before enabling the new delivery flow.

Once a driver accepts, riders see a fresh arrival estimate to pickup, switching
to destination after trip start. The estimate uses Google Routes
`TRAFFIC_AWARE_OPTIMAL`/`BEST_GUESS`, refreshed every 30 seconds with a short
server cache. Live traffic and road delays reflected by Google influence it;
this does not provide a separate accident-alert feed or promise every incident
is known. Stale GPS, missing keys and routing failures show an unavailable
message instead of a fabricated estimate.

## Validation and device acceptance

The local tests run the actual migration functions in embedded PostgreSQL with
minimal schema/identity fixtures. They cover radius boundaries, stale supply,
notifications, expiry, authorization and one-winner acceptance. The endpoint
tests mock Google; they do not prove live coverage, current Google billing or
multi-connection database contention.

Before release test two real driver devices and one rider: permission denial,
stationary and moving GPS, navigation in another app, screen lock for more than
five minutes, force-stop, token refresh, going offline, device/account changes,
45-second offer expiry, concurrent acceptance, cancellation and trip completion.
Verify a nearby delivery, traffic delays and the no-route/error display. Native
APK compilation and real-device/background push checks require an Android SDK,
Firebase configuration and devices; they have not been run in this workspace.

Google Routes reference: https://developers.google.com/maps/documentation/routes/config_trade_offs
Background plugin: https://github.com/capacitor-community/background-geolocation
