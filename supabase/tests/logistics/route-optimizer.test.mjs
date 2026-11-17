// Route optimiser checks (logistics-dispatch helpers), run under Node.
//   node route-optimizer.test.mjs <bundled dispatch.mjs>
// The runner bundles supabase/functions/logistics-dispatch with its helpers exported.
import { pathToFileURL } from "node:url";

globalThis.Deno = { env: { get: () => "" }, serve: () => {} };
const m = await import(pathToFileURL(process.argv[2]).href);
const { optimizeOrder, isValidOrder, pathKm, windowBounds, co2FactorFor } = m;

let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures++;
};

// Deterministic PRNG so failures are reproducible.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const HUB = { lat: -26.2, lng: 28.04 };
const pt = () => ({ lat: -26.2 + (rand() - 0.5) * 0.3, lng: 28.04 + (rand() - 0.5) * 0.3 });
let idc = 0;
const stop = (type, shipment, p = pt(), extra = {}) => ({ id: `s${++idc}`, stop_type: type, shipment_id: shipment, lat: p.lat, lng: p.lng, status: "pending", sequence: 0, ...extra });

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  return arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]));
}

// 1. Validity rules
{
  const p = stop("pickup", "A"), d = stop("delivery", "A");
  check("pickup before delivery is valid", isValidOrder([p, d]));
  check("delivery before its pickup is invalid", !isValidOrder([d, p]));
  const m1 = stop("delivery", "B", pt(), { window_start: "2026-11-18T06:00:00.000Z" });
  const a1 = stop("delivery", "C", pt(), { window_start: "2026-11-18T10:00:00.000Z" });
  check("morning before afternoon is valid", isValidOrder([m1, a1]));
  check("afternoon before morning is invalid", !isValidOrder([a1, m1]));
}

// 2. Collinear points are visited in order
{
  const line = [0.08, 0.02, 0.06, 0.04].map((dx) => stop("delivery", null, { lat: HUB.lat, lng: HUB.lng + dx }));
  const order = optimizeOrder(HUB, line).map((s) => s.lng - HUB.lng);
  check("collinear stops visited nearest-first", order.every((v, i) => i === 0 || v > order[i - 1]), order.map((v) => v.toFixed(2)).join(" → "));
}

// 3. Random routes: always valid, never worse than the input order
{
  let allValid = true, neverWorse = true, worst = 0, totalGain = 0, n = 0;
  for (let t = 0; t < 300; t++) {
    const stops = [];
    const k = 3 + Math.floor(rand() * 10);
    for (let i = 0; i < k; i++) {
      const sid = `S${t}-${i}`;
      if (rand() < 0.5) stops.push(stop("pickup", sid));
      const w = rand();
      stops.push(stop("delivery", sid, pt(), w < 0.2 ? { window_start: "2026-11-18T06:00:00.000Z" } : w < 0.35 ? { window_start: "2026-11-18T10:00:00.000Z" } : {}));
    }
    // shuffle as a naive baseline that still respects the rules
    const naive = [...stops].sort(() => rand() - 0.5);
    const out = optimizeOrder(HUB, stops);
    if (!isValidOrder(out) || out.length !== stops.length) allValid = false;
    if (isValidOrder(naive)) {
      const a = pathKm(HUB, out), b = pathKm(HUB, naive);
      if (a > b + 1e-9) {
        neverWorse = false;
        worst = Math.max(worst, a / b - 1);
      }
      totalGain += 1 - a / b;
      n++;
    }
  }
  check("300 random routes: every output respects pickup/delivery and window order", allValid);
  check("optimised distance never worse than a valid random order", neverWorse, worst ? `worst +${(worst * 100).toFixed(1)}%` : "");
  check("average saving vs. random valid order", totalGain / Math.max(n, 1) > 0.25, `${((totalGain / Math.max(n, 1)) * 100).toFixed(0)}% shorter over ${n} comparisons`);
}

// 4. Near-optimality vs. brute force on small unconstrained routes
{
  let worstGap = 0, sumGap = 0;
  const T = 60;
  for (let t = 0; t < T; t++) {
    const stops = Array.from({ length: 7 }, () => stop("delivery", null));
    const best = Math.min(...permutations(stops).map((p) => pathKm(HUB, p)));
    const gap = pathKm(HUB, optimizeOrder(HUB, stops)) / best - 1;
    worstGap = Math.max(worstGap, gap);
    sumGap += gap;
  }
  check("7-stop routes within 10% of the true optimum on average", sumGap / T < 0.1, `avg ${((sumGap / T) * 100).toFixed(1)}%, worst ${(worstGap * 100).toFixed(1)}% over ${T} routes`);
}

// 5. Ungeocoded stops are kept, at the end
{
  const s = [stop("delivery", null), { ...stop("delivery", null), lat: null, lng: null }, stop("delivery", null)];
  const out = optimizeOrder(HUB, s);
  check("stops without coordinates are kept and placed last", out.length === 3 && out[2].lat == null);
}

// 6. Delivery windows in SAST (UTC+2)
{
  const w = windowBounds("morning", "2026-11-18");
  check("morning window = 08:00–12:00 SAST", w.start === "2026-11-18T06:00:00.000Z" && w.end === "2026-11-18T10:00:00.000Z");
  check("'any' has no window", windowBounds("any", "2026-11-18") === null);
}

// 7. CO₂ factors
{
  check("EV < motorbike < car < van < truck", co2FactorFor("Electric van") < co2FactorFor("Motorbike") && co2FactorFor("Motorbike") < co2FactorFor("Sedan") && co2FactorFor("Sedan") < co2FactorFor("Panel van") && co2FactorFor("Panel van") < co2FactorFor("Truck"));
  check("unknown vehicle uses the default factor", co2FactorFor(undefined) === 0.21);
}

console.log(failures ? `\n${failures} FAILED` : "\nAll route optimizer checks passed");
process.exit(failures ? 1 : 0);
