// Runtime checks of the logistics edge functions' HTTP behaviour, in Node.
// The real handlers run; Supabase (REST/auth/RPC) and outbound HTTP are served
// by an in-process mock, so auth, scopes, limits, validation and webhook
// signing are exercised without a live project.
//   node edge-functions.test.mjs <dir with bundled logistics-*.mjs>
import { pathToFileURL } from "node:url";
import crypto from "node:crypto";
import path from "node:path";

const DIR = process.argv[2];
let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures++;
};

// ---- environment + Deno shim --------------------------------------------------
const ENV = {
  SUPABASE_URL: "http://mock.supabase",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  RESEND_API_KEY: "re_test",
  GOOGLE_MAPS_API_KEY: "",
};
let currentHandler = null;
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (h) => (currentHandler = h) };

async function load(name) {
  currentHandler = null;
  await import(pathToFileURL(path.join(DIR, `${name}.mjs`)).href + `?t=${Math.random()}`);
  return currentHandler;
}

// ---- mock Supabase + outbound HTTP ---------------------------------------------
let db; // per-test fixture
const calls = [];
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

globalThis.fetch = async (input, init = {}) => {
  const req = input instanceof Request ? input : new Request(input, init);
  const url = new URL(req.url);
  const body = req.method === "GET" || req.method === "HEAD" ? null : await req.text();
  calls.push({ url: url.toString(), method: req.method, headers: Object.fromEntries(req.headers), body, redirect: init.redirect ?? req.redirect });

  if (url.host === "mock.supabase") {
    if (url.pathname === "/auth/v1/user") {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
      const user = db.users?.[token];
      return user ? json(user) : json({ msg: "invalid JWT" }, 401);
    }
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(.+)$/);
    if (rpc) {
      const fn = db.rpc?.[rpc[1]];
      return fn ? json(fn(JSON.parse(body || "{}"), req)) : json(null);
    }
    const table = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
    if (table) {
      const rows = (db.tables?.[table] ?? (() => []))(url.searchParams, req.method, body);
      const single = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object");
      if (single) return rows.length ? json(rows[0]) : json({ code: "PGRST116", message: "no rows" }, 406);
      return json(rows);
    }
    return json({ message: "unmocked " + url.pathname }, 404);
  }
  // Outbound (Resend, webhooks, Google): record and succeed.
  return json({ id: "ok" });
};

const call = (handler, method, p, { headers = {}, body } = {}) =>
  handler(new Request(`http://fn.local${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));

// ============================== logistics-api ==================================
{
  const api = await load("logistics-api");
  const key = "lx_live_" + "A".repeat(40);
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");
  const baseKey = { id: "k1", name: "Acme", scopes: ["shipments:read", "shipments:write", "quotes:read"], allowed_ips: [], rate_limit_per_min: 120, revoked_at: null, expires_at: null };
  const setup = (overrides = {}, { rateOk = true } = {}) => {
    db = {
      tables: {
        logistics_api_keys: (q, method) => (method !== "GET" ? [] : q.get("key_hash") === `eq.${keyHash}` ? [{ ...baseKey, ...overrides }] : []),
        logistics_rate_counters: () => [],
        shipments: () => [],
      },
      rpc: { logistics_rate_hit: () => rateOk },
    };
  };
  const auth = { Authorization: `Bearer ${key}`, "x-forwarded-for": "203.0.113.9" };

  setup();
  let r = await call(api, "OPTIONS", "/logistics-api/v1/shipments");
  check("api: CORS preflight answered", r.status === 200 && r.headers.get("access-control-allow-headers")?.includes("idempotency-key"));
  r = await call(api, "GET", "/logistics-api/v1/shipments");
  check("api: missing key → 401", r.status === 401 && (await r.json()).error.code === "invalid_api_key");
  r = await call(api, "GET", "/logistics-api/v1/shipments", { headers: { Authorization: "Bearer lx_live_" + "B".repeat(40) } });
  check("api: unknown key → 401", r.status === 401);
  check("api: failed auth is counted per IP", calls.some((c) => c.url.includes("rpc/logistics_rate_hit") && c.body.includes("apiauthfail")));
  r = await call(api, "GET", "/logistics-api/v1/shipments", { headers: auth });
  check("api: valid key lists shipments", r.status === 200 && Array.isArray((await r.json()).data));

  setup({ revoked_at: new Date().toISOString() });
  r = await call(api, "GET", "/logistics-api/v1/shipments", { headers: auth });
  check("api: revoked key → 401", r.status === 401);
  setup({ expires_at: "2020-01-01T00:00:00Z" });
  r = await call(api, "GET", "/logistics-api/v1/shipments", { headers: auth });
  check("api: expired key → 401 api_key_expired", r.status === 401 && (await r.json()).error.code === "api_key_expired");
  setup({ allowed_ips: ["198.51.100.0/24"] });
  r = await call(api, "GET", "/logistics-api/v1/shipments", { headers: auth });
  check("api: IP outside allowlist → 403", r.status === 403 && (await r.json()).error.code === "ip_not_allowed");
  setup({ allowed_ips: ["203.0.113.0/24"] });
  r = await call(api, "GET", "/logistics-api/v1/shipments", { headers: auth });
  check("api: IP inside CIDR allowlist → 200", r.status === 200);
  setup({ scopes: ["shipments:read"] });
  r = await call(api, "POST", "/logistics-api/v1/shipments", { headers: auth, body: {} });
  check("api: read-only key cannot create → 403 insufficient_scope", r.status === 403 && (await r.json()).error.code === "insufficient_scope");
  setup({}, { rateOk: false });
  r = await call(api, "GET", "/logistics-api/v1/shipments", { headers: auth });
  check("api: over the key's limit → 429 with Retry-After", r.status === 429 && r.headers.get("retry-after") === "60");
  setup();
  r = await call(api, "POST", "/logistics-api/v1/shipments", { headers: auth, body: { delivery_address: { street: "x" } } });
  check("api: missing recipient → 422", r.status === 422 && (await r.json()).error.code === "invalid_recipient");
  r = await call(api, "POST", "/logistics-api/v1/shipments", { headers: auth, body: { recipient: { name: "A", phone: "1" }, service_level: "teleport" } });
  check("api: unknown service level → 422", r.status === 422 && (await r.json()).error.code === "invalid_service_level");
  r = await call(api, "GET", "/logistics-api/v1/shipments/LX0000000000NOPE", { headers: auth });
  check("api: someone else's / unknown tracking number → 404", r.status === 404);
  r = await call(api, "GET", "/logistics-api/v2/whatever", { headers: auth });
  check("api: unknown version → 404", r.status === 404);
}

// ============================== logistics-dispatch =============================
{
  const dispatch = await load("logistics-dispatch");
  const setup = (role) => {
    db = { users: { "user-jwt": { id: "u1", aud: "authenticated" } }, rpc: { logistics_role: () => role }, tables: {} };
  };
  setup("dispatcher");
  let r = await call(dispatch, "POST", "/", { body: { action: "auto_assign" } });
  check("dispatch: no JWT → 401", r.status === 401);
  r = await call(dispatch, "GET", "/", { headers: { Authorization: "Bearer user-jwt" } });
  check("dispatch: GET → 405", r.status === 405);
  setup("viewer");
  r = await call(dispatch, "POST", "/", { headers: { Authorization: "Bearer user-jwt" }, body: { action: "auto_assign" } });
  check("dispatch: viewer role → 403", r.status === 403);
  setup(null);
  r = await call(dispatch, "POST", "/", { headers: { Authorization: "Bearer user-jwt" }, body: { action: "auto_assign" } });
  check("dispatch: non-staff (or MFA-gated) user → 403", r.status === 403);
  setup("dispatcher");
  r = await call(dispatch, "POST", "/", { headers: { Authorization: "Bearer user-jwt" }, body: { action: "self_destruct" } });
  check("dispatch: unknown action → 400", r.status === 400 && (await r.json()).error === "unknown_action");
  r = await call(dispatch, "POST", "/", { headers: { Authorization: "Bearer user-jwt" }, body: { action: "optimize_route" } });
  check("dispatch: missing routeId → 400", r.status === 400 && (await r.json()).error === "routeId_required");
}

// ============================== logistics-billing-run ==========================
{
  const run = await load("logistics-billing-run");
  db = {
    tables: {
      logistics_internal_secrets: () => [{ value: "s3cret-value" }],
      logistics_settings: () => [{ auto_issue_invoices: false, send_monthly_statements: false, reminder_days: [1, 7, 14], auto_hold_after_days: 0 }],
      logistics_invoices: () => [],
      logistics_accounts: () => [],
    },
  };
  let r = await call(run, "POST", "/", { headers: { "X-Logistics-Cron": "wrong" } });
  check("billing-run: wrong cron secret → 403", r.status === 403);
  r = await call(run, "POST", "/", {});
  check("billing-run: no secret → 403", r.status === 403);
  r = await call(run, "POST", "/", { headers: { "X-Logistics-Cron": "s3cret-value" } });
  const rep = await r.json();
  check("billing-run: correct secret runs and reports", r.status === 200 && rep.issued === 0 && rep.reminders === 0 && Array.isArray(rep.errors));
}

// ============================== logistics-invoice-email ========================
{
  const mail = await load("logistics-invoice-email");
  db = { users: { "owner-jwt": { id: "o1" }, "disp-jwt": { id: "d1" } }, rpc: { logistics_role: (_b, req) => (req.headers.get("authorization")?.includes("owner") ? "owner" : "dispatcher") }, tables: {} };
  let r = await call(mail, "POST", "/", { body: { invoiceId: "x" } });
  check("invoice-email: no JWT → 401", r.status === 401);
  r = await call(mail, "POST", "/", { headers: { Authorization: "Bearer disp-jwt" }, body: { invoiceId: "x" } });
  check("invoice-email: non-owner → 403", r.status === 403);
  r = await call(mail, "POST", "/", { headers: { Authorization: "Bearer owner-jwt" }, body: { invoiceId: 42 } });
  check("invoice-email: bad body → 400", r.status === 400);
}

// ============================== logistics-notify (webhooks) ====================
{
  const notify = await load("logistics-notify");
  const secret = "whsec_test_secret";
  const event = { id: "11111111-1111-4111-8111-111111111111", shipment_id: "s1", status: "out_for_delivery", event_type: "status_change", created_at: new Date().toISOString(), webhooks_processed_at: null };
  const updates = [];
  db = {
    tables: {
      shipment_events: (q, method, body) => {
        if (method === "PATCH") {
          updates.push(JSON.parse(body));
          return [];
        }
        return [event];
      },
      shipments: () => [{ id: "s1", tracking_number: "LX2611170000ABCD", reference: "ORD-9", status: "out_for_delivery", service_level: "next_day", api_key_id: "k1", attempt_count: 0, notifications_enabled: false }],
      logistics_webhooks: () => [
        { id: "w1", url: "https://merchant.example/hooks", secret, events: ["*"], api_key_id: "k1" },
        { id: "w2", url: "https://other.example/hooks", secret, events: ["*"], api_key_id: "k-other" },
      ],
      logistics_webhook_deliveries: () => [],
    },
  };
  let r = await call(notify, "GET", "/");
  check("notify: GET → 405", r.status === 405);
  r = await call(notify, "POST", "/", { body: { event_id: "not-a-uuid" } });
  check("notify: malformed event id → 400", r.status === 400);
  calls.length = 0;
  r = await call(notify, "POST", "/", { body: { event_id: event.id } });
  const hook = calls.find((c) => c.url === "https://merchant.example/hooks");
  check("notify: webhook delivered to the shipment's own key endpoint", r.status === 200 && !!hook);
  check("notify: other merchants' endpoints are not called", !calls.some((c) => c.url === "https://other.example/hooks"));
  const sig = hook?.headers["x-1145-signature"] ?? "";
  const [, t, v1] = sig.match(/^t=(\d+),v1=([0-9a-f]{64})$/) ?? [];
  const expected = t ? crypto.createHmac("sha256", secret).update(`${t}.${hook.body}`).digest("hex") : "";
  check("notify: X-1145-Signature verifies (HMAC-SHA256 of t.body)", !!v1 && v1 === expected);
  const payload = hook ? JSON.parse(hook.body) : {};
  check("notify: payload is shipment.<status> with tracking url", payload.type === "shipment.out_for_delivery" && payload.data?.tracking_number === "LX2611170000ABCD" && /\/track\/LX/.test(payload.data?.tracking_url));
  check("notify: webhook request never follows redirects", hook?.redirect === "manual", `redirect=${hook?.redirect}`);
  check("notify: event marked processed for webhooks", updates.some((u) => u.webhooks_processed_at));
  // Private targets are refused even if they reach the table.
  db.tables.logistics_webhooks = () => [{ id: "w3", url: "https://localhost/hook", secret, events: ["*"], api_key_id: null }];
  calls.length = 0;
  await call(notify, "POST", "/", { body: { event_id: event.id } });
  check("notify: private/loopback webhook target is blocked", !calls.some((c) => c.url.startsWith("https://localhost")));
}

console.log(failures ? `\n${failures} FAILED` : "\nAll edge-function checks passed");
process.exit(failures ? 1 : 0);
