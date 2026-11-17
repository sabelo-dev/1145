// Controller checklist (guide section 11) against the real controller, with fake timers.
let now = 0;
let timers = [];
let seq = 0;
globalThis.performance = { now: () => now };
globalThis.setTimeout = (fn, ms) => {
  const id = ++seq;
  timers.push({ id, at: now + ms, fn });
  return id;
};
globalThis.clearTimeout = (id) => {
  timers = timers.filter((t) => t.id !== id);
};
const advance = async (ms) => {
  const end = now + ms;
  for (;;) {
    timers.sort((a, b) => a.at - b.at);
    const t = timers[0];
    if (!t || t.at > end) break;
    timers.shift();
    now = t.at;
    t.fn();
    await Promise.resolve();
  }
  now = end;
  await Promise.resolve();
};

import { pathToFileURL } from "node:url";
const { OfferAlertController, ALERT_CONFIG } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : "./controller.mjs");

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
};

function setup({ acceptImpl } = {}) {
  now = 0;
  timers = [];
  const log = [];
  const tone = {
    playing: false,
    starts: 0,
    stops: 0,
    start() {
      this.playing = true;
      this.starts++;
      log.push("tone.start");
    },
    stop() {
      this.playing = false;
      this.stops++;
      log.push("tone.stop");
    },
    async unlock() {},
  };
  const api = {
    accepts: 0,
    missed: [],
    accept: async (o) => {
      api.accepts++;
      if (acceptImpl) return acceptImpl(o);
    },
    reportMissed: (o) => api.missed.push(o.id),
    log: () => {},
  };
  const c = new OfferAlertController(tone, api, ALERT_CONFIG);
  const phases = [];
  let toneViolation = false;
  c.subscribe((s) => {
    phases.push(s.phase);
    log.push(`state:${s.phase}`);
    if (tone.playing && s.phase !== "RINGING") toneViolation = true;
  });
  return { c, tone, api, phases, log, toneViolation: () => toneViolation };
}

const offer = (id, remainingMs = 10_000) => ({
  id,
  kind: "order",
  createdAt: new Date(0).toISOString(),
  serverNow: new Date(1_000_000).toISOString(),
  expiresAt: new Date(1_000_000 + remainingMs).toISOString(),
  pickup: { label: "A" },
});

// 1. Offer → RINGING, tone.start once
{
  const t = setup();
  t.c.onOffer(offer("o1"));
  check("offer → RINGING", t.c.current.phase === "RINGING");
  check("tone.start called once", t.tone.starts === 1);
}
// 2. At 10 000 ms → MISSED, tone.stop before the state change
{
  const t = setup();
  t.c.onOffer(offer("o1"));
  await advance(10_000);
  check("timeout → MISSED", t.c.current.phase === "MISSED");
  const iStop = t.log.lastIndexOf("tone.stop", t.log.indexOf("state:MISSED"));
  check("tone.stop emitted before MISSED", iStop !== -1 && iStop < t.log.indexOf("state:MISSED"));
  check("missed reported", t.api.missed.includes("o1"));
  await advance(ALERT_CONFIG.missedDurationMs);
  check("MISSED → IDLE after 5 s", t.c.current.phase === "IDLE");
  check("tone never on outside RINGING", !t.toneViolation());
}
// 3. accept() at 9 999 ms → ACCEPTING, tone stopped, timeout does not fire
{
  let resolve;
  const t = setup({ acceptImpl: () => new Promise((r) => (resolve = r)) });
  t.c.onOffer(offer("o1"));
  await advance(9_999);
  const p = t.c.accept();
  check("accept at 9999 ms → ACCEPTING", t.c.current.phase === "ACCEPTING");
  check("tone stopped on accept", !t.tone.playing);
  await advance(5_000);
  check("timeout did not fire after accept", t.c.current.phase === "ACCEPTING" && t.api.missed.length === 0);
  resolve();
  await p;
  await advance(1);
  check("server ok → ACCEPTED (then IDLE)", t.phases.includes("ACCEPTED"));
}
// 4. accept() after timeout is a no-op
{
  const t = setup();
  t.c.onOffer(offer("o1"));
  await advance(10_000);
  await t.c.accept();
  check("accept after timeout is a no-op", t.api.accepts === 0 && t.c.current.phase === "MISSED");
}
// 5. Double accept calls the API once
{
  const t = setup();
  t.c.onOffer(offer("o1"));
  await Promise.all([t.c.accept(), t.c.accept()]);
  check("double accept → API called once", t.api.accepts === 1);
}
// 6. Server cancel during ring → IDLE, tone stopped
{
  const t = setup();
  t.c.onOffer(offer("o1"));
  await advance(3_000);
  t.c.onOfferCancelled("o1");
  check("server cancel → IDLE", t.c.current.phase === "IDLE");
  check("tone stopped on cancel", !t.tone.playing);
  check("cancel is not reported as missed", t.api.missed.length === 0);
}
// 7. Accept error → FAILED → IDLE after 3 s
{
  const t = setup({ acceptImpl: async () => { throw new Error("offer_expired"); } });
  t.c.onOffer(offer("o1"));
  await t.c.accept();
  check("accept error → FAILED", t.c.current.phase === "FAILED");
  check("FAILED is silent", !t.tone.playing);
  await advance(ALERT_CONFIG.failedDurationMs);
  check("FAILED → IDLE after 3 s", t.c.current.phase === "IDLE");
}
// 8. Queued offer shown after the first resolves; expired queued offer skipped
{
  const t = setup();
  t.c.onOffer(offer("o1"));
  t.c.onOffer(offer("o2", 20_000)); // long-lived second offer
  t.c.onOffer(offer("o3", 11_000)); // will have expired while waiting
  check("second offer queued, first still ringing", t.c.current.offer.id === "o1");
  await advance(10_000 + ALERT_CONFIG.missedDurationMs);
  check("queued offer rings after first resolves", t.c.current.phase === "RINGING" && t.c.current.offer.id === "o2");
  t.c.onOfferCancelled("o2");
  check("aged queued offer (o3) skipped and reported missed", t.c.current.phase === "IDLE" && t.api.missed.includes("o3"));
}
// 9. Offer arriving with <2 s left is reported missed and never shown
{
  const t = setup();
  t.c.onOffer(offer("late", 1_500));
  check("<2 s left → never shown", t.c.current.phase === "IDLE" && !t.phases.includes("RINGING"));
  check("<2 s left → reported missed", t.api.missed.includes("late"));
  check("tone never started", t.tone.starts === 0);
}
// 10. Duplicate delivery of a handled offer is ignored
{
  const t = setup();
  t.c.onOffer(offer("o1"));
  await advance(10_000 + ALERT_CONFIG.missedDurationMs);
  t.c.onOffer(offer("o1"));
  check("re-delivered handled offer ignored", t.c.current.phase === "IDLE");
}
// 11. shutdown() mid-ring stops tone and reports missed
{
  const t = setup();
  t.c.onOffer(offer("o1"));
  t.c.shutdown();
  check("going offline mid-ring → IDLE, tone off, missed", t.c.current.phase === "IDLE" && !t.tone.playing && t.api.missed.includes("o1"));
}

console.log(failures ? `\n${failures} FAILED` : "\nAll controller checks passed");
process.exit(failures ? 1 : 0);
