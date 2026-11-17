// 1145 Logistics — server-side dispatch.
//
// Actions (POST { action, ...params }):
//   auto_assign     { jobIds?, maxRadiusKm? }   nearest available driver per pending delivery job
//   create_route    { name, hubId?, routeDate?, plannedStart?, driverId?, vehicleId?, shipmentIds[] }
//   optimize_route  { routeId }                  re-sequence stops (pickup-before-delivery aware)
//   dispatch_route  { routeId }                  hand a planned route to its driver
//
// The caller's JWT is checked against public.logistics_role(); all writes use
// the service role so assignment logic cannot be bypassed from the browser.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DISPATCH_ROLES = ["owner", "dispatcher"];
const ROAD_FACTOR = 1.3; // straight-line → road distance
const AVG_SPEED_KMH = 30; // urban average
const SERVICE_MINS_PER_STOP = 5;

type Point = { lat: number; lng: number };

// Tank-to-wheel kg CO₂ per km (DEFRA-style averages). EVs use SA grid intensity.
function co2FactorFor(vehicleType?: string): number {
  const t = (vehicleType ?? "").toLowerCase();
  if (/electric|\bev\b/.test(t)) return 0.09;
  if (/bike|scooter|moto/.test(t)) return 0.1;
  if (/truck|lorry/.test(t)) return 0.6;
  if (/van|bakkie|panel|cargo/.test(t)) return 0.25;
  if (/car|sedan|hatch|comfort|economy/.test(t)) return 0.17;
  return 0.21;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Delivery windows (SAST, UTC+2 all year).
const WINDOWS: Record<string, [string, string]> = { morning: ["08:00", "12:00"], afternoon: ["12:00", "17:00"], evening: ["17:00", "20:00"] };
function windowBounds(window: string | null | undefined, day: string): { start: string; end: string } | null {
  const w = window ? WINDOWS[window] : undefined;
  if (!w) return null;
  return { start: new Date(`${day}T${w[0]}:00+02:00`).toISOString(), end: new Date(`${day}T${w[1]}:00+02:00`).toISOString() };
}

function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function coordsOf(address: unknown): Point | null {
  if (!address || typeof address !== "object") return null;
  const a = address as Record<string, unknown>;
  const lat = Number(a.lat ?? a.latitude);
  const lng = Number(a.lng ?? a.lon ?? a.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return { lat, lng };
  return null;
}

// ---------------------------------------------------------------------------
// auto_assign
// ---------------------------------------------------------------------------
async function autoAssign(admin: SupabaseClient, params: { jobIds?: string[]; maxRadiusKm?: number }) {
  const maxRadius = Math.min(Math.max(Number(params.maxRadiusKm) || 15, 1), 100);

  let jobsQuery = admin
    .from("delivery_jobs")
    .select("id, pickup_address, priority, created_at")
    .eq("status", "pending")
    .is("driver_id", null)
    .order("created_at", { ascending: true })
    .limit(100);
  if (params.jobIds?.length) jobsQuery = jobsQuery.in("id", params.jobIds);
  const { data: jobs, error: jobsError } = await jobsQuery;
  if (jobsError) throw jobsError;

  const { data: locations, error: locError } = await admin
    .from("driver_locations")
    .select("driver_id, latitude, longitude, drivers!inner(id, name, status, rating)")
    .eq("is_online", true)
    .eq("is_available", true);
  if (locError) throw locError;

  // Urgent first, then oldest.
  const ordered = [...(jobs ?? [])].sort((a, b) => {
    const pa = a.priority === "urgent" ? 0 : 1;
    const pb = b.priority === "urgent" ? 0 : 1;
    return pa - pb || a.created_at.localeCompare(b.created_at);
  });

  const pool = (locations ?? [])
    .filter((l: any) => l.drivers?.status === "available")
    .map((l: any) => ({
      driverId: l.driver_id as string,
      name: l.drivers.name as string,
      rating: Number(l.drivers.rating) || 5,
      point: { lat: Number(l.latitude), lng: Number(l.longitude) },
    }));
  const taken = new Set<string>();
  const assignments: Array<{ jobId: string; driverId: string; driverName: string; distanceKm: number }> = [];
  const unassigned: Array<{ jobId: string; reason: string }> = [];

  for (const job of ordered) {
    const pickup = coordsOf(job.pickup_address);
    if (!pickup) {
      unassigned.push({ jobId: job.id, reason: "pickup_not_geocoded" });
      continue;
    }
    let best: { driverId: string; name: string; score: number; distanceKm: number } | null = null;
    for (const d of pool) {
      if (taken.has(d.driverId)) continue;
      const km = haversineKm(pickup, d.point);
      if (km > maxRadius) continue;
      // Distance dominates; rating breaks near-ties (0.5 km per rating star below 5).
      const score = km + (5 - d.rating) * 0.5;
      if (!best || score < best.score) best = { driverId: d.driverId, name: d.name, score, distanceKm: km };
    }
    if (!best) {
      unassigned.push({ jobId: job.id, reason: "no_driver_in_radius" });
      continue;
    }
    // Optimistic claim: only succeeds if nobody else took it meanwhile.
    const { data: claimed } = await admin
      .from("delivery_jobs")
      .update({ driver_id: best.driverId, status: "accepted" })
      .eq("id", job.id)
      .eq("status", "pending")
      .is("driver_id", null)
      .select("id");
    if (claimed?.length) {
      taken.add(best.driverId);
      assignments.push({
        jobId: job.id,
        driverId: best.driverId,
        driverName: best.name,
        distanceKm: Math.round(best.distanceKm * 10) / 10,
      });
    } else {
      unassigned.push({ jobId: job.id, reason: "already_claimed" });
    }
  }

  return { assigned: assignments.length, assignments, unassigned, driversAvailable: pool.length };
}

// ---------------------------------------------------------------------------
// Route optimisation: precedence-constrained nearest neighbour + 2-opt.
// ---------------------------------------------------------------------------
interface StopRow {
  id: string;
  stop_type: "pickup" | "delivery" | "hub";
  shipment_id: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  sequence: number;
  window_start?: string | null;
}

function isValidOrder(order: StopRow[]): boolean {
  // Windowed stops must be visited in window order.
  let lastWindow = "";
  for (const s of order) {
    if (s.window_start) {
      if (s.window_start < lastWindow) return false;
      lastWindow = s.window_start;
    }
  }
  const seenPickup = new Set<string>();
  const pickupsNeeded = new Set(order.filter((s) => s.stop_type === "pickup" && s.shipment_id).map((s) => s.shipment_id!));
  for (const s of order) {
    if (s.stop_type === "pickup" && s.shipment_id) seenPickup.add(s.shipment_id);
    if (s.stop_type === "delivery" && s.shipment_id && pickupsNeeded.has(s.shipment_id) && !seenPickup.has(s.shipment_id)) {
      return false;
    }
  }
  return true;
}

function pathKm(start: Point | null, order: StopRow[]): number {
  let km = 0;
  let prev: Point | null = start;
  for (const s of order) {
    if (s.lat == null || s.lng == null) continue;
    const p = { lat: Number(s.lat), lng: Number(s.lng) };
    if (prev) km += haversineKm(prev, p);
    prev = p;
  }
  return km;
}

function optimizeOrder(start: Point | null, stops: StopRow[]): StopRow[] {
  const located = stops.filter((s) => s.lat != null && s.lng != null);
  const unlocated = stops.filter((s) => s.lat == null || s.lng == null);
  const pickupShipments = new Set(located.filter((s) => s.stop_type === "pickup" && s.shipment_id).map((s) => s.shipment_id!));

  // Nearest neighbour respecting pickup → delivery precedence.
  const remaining = [...located];
  const order: StopRow[] = [];
  const pickedUp = new Set<string>();
  let current: Point | null = start ?? (remaining[0] ? { lat: Number(remaining[0].lat), lng: Number(remaining[0].lng) } : null);
  while (remaining.length) {
    // Earliest open window first; unwindowed stops can slot in anywhere.
    const minWindow = remaining.reduce<string | null>((m, s) => (s.window_start && (!m || s.window_start < m) ? s.window_start : m), null);
    const eligible = remaining.filter(
      (s) =>
        !(s.stop_type === "delivery" && s.shipment_id && pickupShipments.has(s.shipment_id) && !pickedUp.has(s.shipment_id)) &&
        (!s.window_start || s.window_start === minWindow),
    );
    const pickFrom = eligible.length ? eligible : remaining;
    let bestIdx = 0;
    let bestKm = Infinity;
    pickFrom.forEach((s, i) => {
      const km = current ? haversineKm(current, { lat: Number(s.lat), lng: Number(s.lng) }) : 0;
      if (km < bestKm) {
        bestKm = km;
        bestIdx = i;
      }
    });
    const next = pickFrom[bestIdx];
    remaining.splice(remaining.indexOf(next), 1);
    order.push(next);
    if (next.stop_type === "pickup" && next.shipment_id) pickedUp.add(next.shipment_id);
    current = { lat: Number(next.lat), lng: Number(next.lng) };
  }

  // 2-opt improvement, rejecting reversals that break precedence.
  let improved = true;
  let best = order;
  let bestKm = pathKm(start, best);
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        if (!isValidOrder(candidate)) continue;
        const km = pathKm(start, candidate);
        if (km + 1e-6 < bestKm) {
          best = candidate;
          bestKm = km;
          improved = true;
        }
      }
    }
  }

  return [...best, ...unlocated];
}

async function optimizeRoute(admin: SupabaseClient, routeId: string, keepOrder = false) {
  const { data: route, error } = await admin
    .from("delivery_routes")
    .select("id, status, planned_start, started_at, hub_id, vehicle_id, logistics_hubs(lat, lng), vehicles(vehicle_types(name))")
    .eq("id", routeId)
    .single();
  if (error || !route) throw new Error("route_not_found");
  if (["completed", "cancelled"].includes(route.status)) throw new Error("route_closed");

  const { data: stops, error: stopsError } = await admin
    .from("route_stops")
    .select("id, stop_type, shipment_id, lat, lng, status, sequence, window_start")
    .eq("route_id", routeId)
    .order("sequence");
  if (stopsError) throw stopsError;

  const closed = (stops ?? []).filter((s: StopRow) => s.status !== "pending" && s.status !== "arrived");
  const open = (stops ?? []).filter((s: StopRow) => s.status === "pending" || s.status === "arrived");

  const hub = (route as any).logistics_hubs;
  const hubPoint = hub?.lat != null ? { lat: Number(hub.lat), lng: Number(hub.lng) } : null;
  const lastClosed = [...closed].reverse().find((s) => s.lat != null);
  const start = lastClosed ? { lat: Number(lastClosed.lat), lng: Number(lastClosed.lng) } : hubPoint;

  // keepOrder: a dispatcher reordered stops by hand, so only refresh ETAs and
  // distance, after checking that every pickup still precedes its delivery.
  if (keepOrder && !isValidOrder([...closed, ...(open as StopRow[])])) throw new Error("pickup_after_delivery");
  const ordered = [...closed, ...(keepOrder ? (open as StopRow[]) : optimizeOrder(start, open as StopRow[]))];
  const totalKm = pathKm(hubPoint, ordered) * ROAD_FACTOR;

  // ETAs from planned start (or now once the route is live), using the speed and
  // dwell time learned from this hub's history (logistics_train_eta).
  const startTime = new Date(route.started_at ?? route.planned_start ?? Date.now()).getTime();
  const { data: learned } = await admin.rpc("logistics_eta_params", { p_hub: route.hub_id, p_at: new Date(startTime).toISOString() });
  const speedKmh = Number(learned?.[0]?.kmh) || AVG_SPEED_KMH;
  const serviceMins = Number(learned?.[0]?.service_mins) || SERVICE_MINS_PER_STOP;
  let clock = Math.max(startTime, route.status === "in_progress" ? Date.now() : startTime);
  let prev: Point | null = start;
  const updates = ordered.map((s, idx) => {
    let eta: string | null = null;
    if (s.status === "pending" || s.status === "arrived") {
      if (s.lat != null && prev) {
        const leg = haversineKm(prev, { lat: Number(s.lat), lng: Number(s.lng) }) * ROAD_FACTOR;
        clock += (leg / speedKmh) * 3_600_000;
      }
      if (s.window_start && clock < new Date(s.window_start).getTime()) clock = new Date(s.window_start).getTime();
      eta = new Date(clock).toISOString();
      clock += serviceMins * 60_000;
    }
    if (s.lat != null) prev = { lat: Number(s.lat), lng: Number(s.lng) };
    return { id: s.id, sequence: idx + 1, eta };
  });

  for (const u of updates) {
    const patch: Record<string, unknown> = { sequence: u.sequence };
    if (u.eta) patch.eta = u.eta;
    const { error: upErr } = await admin.from("route_stops").update(patch).eq("id", u.id);
    if (upErr) throw upErr;
  }

  const durationMins = Math.round((totalKm / speedKmh) * 60 + ordered.length * serviceMins);
  const vehicleType = (route as any).vehicles?.vehicle_types?.name as string | undefined;
  const co2Kg = Math.round(totalKm * co2FactorFor(vehicleType) * 100) / 100;
  await admin
    .from("delivery_routes")
    .update({
      total_distance_km: Math.round(totalKm * 100) / 100,
      total_duration_mins: durationMins,
      co2_kg: co2Kg,
      optimized_at: new Date().toISOString(),
      status: route.status === "draft" ? "planned" : route.status,
    })
    .eq("id", routeId);

  return { routeId, stops: updates.length, totalDistanceKm: Math.round(totalKm * 10) / 10, totalDurationMins: durationMins, co2Kg };
}

// ---------------------------------------------------------------------------
// create_route
// ---------------------------------------------------------------------------
async function createRoute(
  admin: SupabaseClient,
  userId: string,
  params: {
    name?: string;
    hubId?: string | null;
    routeDate?: string;
    plannedStart?: string | null;
    driverId?: string | null;
    vehicleId?: string | null;
    shipmentIds?: string[];
  },
) {
  const shipmentIds = [...new Set(params.shipmentIds ?? [])];
  if (!shipmentIds.length) throw new Error("no_shipments");
  if (shipmentIds.length > 150) throw new Error("too_many_shipments");

  const { data: shipments, error } = await admin
    .from("shipments")
    .select("id, status, sender_name, sender_phone, recipient_name, recipient_phone, pickup_address, delivery_address, delivery_job_id, notes, require_otp, cod_amount, parcel_count, delivery_window, requires_approval, approved_at, destination_hub_id, logistics_hubs!shipments_destination_hub_id_fkey(id, name, hub_type, address, lat, lng)")
    .in("id", shipmentIds);
  if (error) throw error;

  const routable = (shipments ?? []).filter(
    (s: any) =>
      ["created", "awaiting_pickup", "picked_up", "at_hub", "failed_attempt"].includes(s.status) &&
      !(s.requires_approval && !s.approved_at), // high-value parcels wait for review
  );
  if (!routable.length) throw new Error("no_routable_shipments");

  // Refuse shipments already on an open route.
  const { data: busy } = await admin
    .from("route_stops")
    .select("shipment_id, delivery_routes!inner(status)")
    .in("shipment_id", routable.map((s: any) => s.id))
    .in("delivery_routes.status", ["draft", "planned", "dispatched", "in_progress"])
    .in("status", ["pending", "arrived"]);
  const busyIds = new Set((busy ?? []).map((b: any) => b.shipment_id));
  const free = routable.filter((s: any) => !busyIds.has(s.id));
  if (!free.length) throw new Error("shipments_already_routed");

  const { data: route, error: routeError } = await admin
    .from("delivery_routes")
    .insert({
      name: params.name?.trim() || `Route ${new Date().toISOString().slice(0, 10)}`,
      hub_id: params.hubId || null,
      route_date: params.routeDate || new Date().toISOString().slice(0, 10),
      planned_start: params.plannedStart || null,
      driver_id: params.driverId || null,
      vehicle_id: params.vehicleId || null,
      created_by: userId,
      status: "draft",
    })
    .select("id")
    .single();
  if (routeError) throw routeError;

  const stops: Record<string, unknown>[] = [];
  for (const s of free as any[]) {
    // Parcels not yet collected need a pickup stop first.
    if (["created", "awaiting_pickup"].includes(s.status)) {
      const p = coordsOf(s.pickup_address);
      stops.push({
        route_id: route.id,
        stop_type: "pickup",
        shipment_id: s.id,
        delivery_job_id: s.delivery_job_id,
        contact_name: s.sender_name,
        contact_phone: s.sender_phone,
        address: s.pickup_address,
        lat: p?.lat ?? null,
        lng: p?.lng ?? null,
        parcel_count: s.parcel_count ?? 1,
      });
    }
    // Pickup-point / locker parcels end with a hub drop at that point.
    const point = s.logistics_hubs && ["pickup_point", "locker"].includes(s.logistics_hubs.hub_type) ? s.logistics_hubs : null;
    if (point) {
      stops.push({
        route_id: route.id,
        stop_type: "hub",
        hub_id: point.id,
        shipment_id: s.id,
        delivery_job_id: s.delivery_job_id,
        contact_name: point.name,
        address: point.address ?? {},
        lat: point.lat,
        lng: point.lng,
        notes: `Drop at collection point for ${s.recipient_name}`,
        parcel_count: s.parcel_count ?? 1,
      });
      continue;
    }
    const d = coordsOf(s.delivery_address);
    const win = windowBounds(s.delivery_window, params.routeDate || new Date().toISOString().slice(0, 10));
    stops.push({
      window_start: win?.start ?? null,
      window_end: win?.end ?? null,
      route_id: route.id,
      stop_type: "delivery",
      shipment_id: s.id,
      delivery_job_id: s.delivery_job_id,
      contact_name: s.recipient_name,
      contact_phone: s.recipient_phone,
      address: s.delivery_address,
      lat: d?.lat ?? null,
      lng: d?.lng ?? null,
      notes: s.notes ?? null,
      require_otp: !!s.require_otp,
      cod_amount: s.cod_amount ?? null,
      parcel_count: s.parcel_count ?? 1,
    });
  }
  const { error: stopsError } = await admin.from("route_stops").insert(stops);
  if (stopsError) throw stopsError;

  await admin
    .from("shipments")
    .update({ status: "awaiting_pickup" })
    .in("id", free.filter((s: any) => s.status === "created").map((s: any) => s.id));

  const jobIds = free.map((s: any) => s.delivery_job_id).filter(Boolean);
  if (jobIds.length) await admin.from("delivery_jobs").update({ route_id: route.id }).in("id", jobIds);

  const optimized = await optimizeRoute(admin, route.id);
  return { ...optimized, skipped: shipmentIds.length - free.length };
}

// ---------------------------------------------------------------------------
// auto_plan: turn the routable backlog into balanced routes per hub.
// Sweep clustering (polar angle around the hub, starting at the widest gap)
// chunked by stop count and weight; each chunk goes through create_route,
// which adds pickups and optimises the stop order.
// ---------------------------------------------------------------------------
interface PlanItem {
  id: string;
  point: Point;
  weight: number;
  stops: number;
  urgent: boolean;
}

async function autoPlan(
  admin: SupabaseClient,
  userId: string,
  params: {
    routeDate?: string;
    hubId?: string | null;
    maxStops?: number;
    maxWeightKg?: number;
    assignDrivers?: boolean;
    startTime?: string;
    dryRun?: boolean;
  },
) {
  const routeDate = /^\d{4}-\d{2}-\d{2}$/.test(params.routeDate ?? "") ? params.routeDate! : new Date().toISOString().slice(0, 10);
  const maxStops = Math.min(Math.max(Number(params.maxStops) || 25, 4), 80);
  const maxWeight = Math.min(Math.max(Number(params.maxWeightKg) || 600, 20), 5000);
  const startTime = /^\d{2}:\d{2}$/.test(params.startTime ?? "") ? params.startTime! : "08:00";
  const endOfDay = new Date(`${routeDate}T23:59:59+02:00`).getTime();

  const { data: hubs } = await admin.from("logistics_hubs").select("id, code, lat, lng").eq("is_active", true);
  const hubList = (hubs ?? []).filter((h: any) => h.lat != null);

  const { data: candidates, error } = await admin
    .from("shipments")
    .select("id, status, pickup_address, delivery_address, current_hub_id, origin_hub_id, weight_kg, preferred_date, promised_by, delivery_window, requires_approval, approved_at")
    .in("status", ["created", "awaiting_pickup", "picked_up", "at_hub", "failed_attempt"])
    .is("delivery_job_id", null) // on-demand jobs live on the Dispatch board
    .or(`preferred_date.is.null,preferred_date.lte.${routeDate}`)
    .limit(2000);
  if (error) throw error;

  // Shipments already on an open route are left alone.
  const ids = (candidates ?? []).map((c: any) => c.id);
  const busy = new Set<string>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await admin
      .from("route_stops")
      .select("shipment_id, delivery_routes!inner(status)")
      .in("shipment_id", ids.slice(i, i + 300))
      .in("delivery_routes.status", ["draft", "planned", "dispatched", "in_progress"])
      .in("status", ["pending", "arrived"]);
    (data ?? []).forEach((b: any) => busy.add(b.shipment_id));
  }

  const nearestHub = (p: Point | null): any | null => {
    if (!p || !hubList.length) return null;
    let best: any = null;
    let bestKm = Infinity;
    for (const h of hubList) {
      const km = haversineKm(p, { lat: Number(h.lat), lng: Number(h.lng) });
      if (km < bestKm) {
        best = h;
        bestKm = km;
      }
    }
    return best;
  };

  const skipped: Array<{ id: string; reason: string }> = [];
  const groups = new Map<string, { hub: any | null; items: PlanItem[]; wave: string }>();
  for (const c of (candidates ?? []) as any[]) {
    if (busy.has(c.id)) continue;
    if (c.requires_approval && !c.approved_at) {
      skipped.push({ id: c.id, reason: "awaiting_approval" });
      continue;
    }
    const point = coordsOf(c.delivery_address);
    if (!point) {
      skipped.push({ id: c.id, reason: "delivery_not_geocoded" });
      continue;
    }
    const needsPickup = ["created", "awaiting_pickup"].includes(c.status);
    const hubId: string =
      c.current_hub_id ?? c.origin_hub_id ?? nearestHub(needsPickup ? coordsOf(c.pickup_address) ?? point : point)?.id ?? "none";
    if (params.hubId && hubId !== params.hubId) continue;
    // One set of routes per hub per window; "any" rides with the day (morning) wave.
    const wave = c.delivery_window === "afternoon" || c.delivery_window === "evening" ? c.delivery_window : "day";
    const groupKey = `${hubId}|${wave}`;
    if (!groups.has(groupKey)) groups.set(groupKey, { hub: hubList.find((h: any) => h.id === hubId) ?? null, items: [], wave });
    groups.get(groupKey)!.items.push({
      id: c.id,
      point,
      weight: Number(c.weight_kg) || 2,
      stops: needsPickup ? 2 : 1,
      urgent: !!c.promised_by && new Date(c.promised_by).getTime() <= endOfDay,
    });
  }

  // Drivers without a route that day, nearest to each hub first.
  const { data: busyDrivers } = await admin
    .from("delivery_routes")
    .select("driver_id")
    .eq("route_date", routeDate)
    .in("status", ["draft", "planned", "dispatched", "in_progress"])
    .not("driver_id", "is", null);
  const taken = new Set((busyDrivers ?? []).map((r: any) => r.driver_id));
  const pool: any[] =
    params.assignDrivers === false
      ? []
      : (((await admin.from("drivers").select("id, name, status, driver_locations(latitude, longitude)").in("status", ["available", "busy"])).data ?? []) as any[]).filter(
          (d) => !taken.has(d.id),
        );
  const driverKm = (d: any, origin: Point) => {
    const loc = Array.isArray(d.driver_locations) ? d.driver_locations[0] : d.driver_locations;
    return loc?.latitude != null ? haversineKm(origin, { lat: Number(loc.latitude), lng: Number(loc.longitude) }) : 9999;
  };

  const planned: Array<{ routeId?: string; name: string; hub: string; stops: number; shipments: number; driver?: string; totalDistanceKm?: number }> = [];

  const WAVE_START: Record<string, string> = { day: startTime, afternoon: "12:00", evening: "17:00" };
  for (const [groupKey, { hub, items, wave }] of groups) {
    const hubId = groupKey.split("|")[0];
    const origin: Point = hub
      ? { lat: Number(hub.lat), lng: Number(hub.lng) }
      : { lat: items.reduce((a, i) => a + i.point.lat, 0) / items.length, lng: items.reduce((a, i) => a + i.point.lng, 0) / items.length };
    const angle = (p: Point) => Math.atan2(p.lat - origin.lat, p.lng - origin.lng);
    const sorted = [...items].sort((a, b) => angle(a.point) - angle(b.point));

    let start = 0;
    let widest = -1;
    for (let i = 0; i < sorted.length; i++) {
      const next = sorted[(i + 1) % sorted.length];
      const d = (angle(next.point) - angle(sorted[i].point) + 2 * Math.PI) % (2 * Math.PI);
      if (d > widest) {
        widest = d;
        start = (i + 1) % sorted.length;
      }
    }
    const sweep = [...sorted.slice(start), ...sorted.slice(0, start)];

    const chunks: PlanItem[][] = [];
    let cur: PlanItem[] = [];
    let stops = 0;
    let weight = 0;
    for (const it of sweep) {
      if (cur.length && (stops + it.stops > maxStops || weight + it.weight > maxWeight)) {
        chunks.push(cur);
        cur = [];
        stops = 0;
        weight = 0;
      }
      cur.push(it);
      stops += it.stops;
      weight += it.weight;
    }
    if (cur.length) chunks.push(cur);
    // Routes carrying parcels due today get the nearest drivers.
    chunks.sort((a, b) => Number(b.some((i) => i.urgent)) - Number(a.some((i) => i.urgent)));

    for (let n = 0; n < chunks.length; n++) {
      const chunk = chunks[n];
      pool.sort((a, b) => driverKm(a, origin) - driverKm(b, origin));
      const driver = pool.shift();
      const name = `${hub?.code ?? "RT"}-${routeDate.slice(5)}${wave === "day" ? "" : wave === "afternoon" ? "-PM" : "-EVE"}-${String(n + 1).padStart(2, "0")}`;
      const stopCount = chunk.reduce((a, i) => a + i.stops, 0);
      if (params.dryRun) {
        planned.push({ name, hub: hub?.code ?? "—", stops: stopCount, shipments: chunk.length, driver: driver?.name });
        continue;
      }
      const res = await createRoute(admin, userId, {
        name,
        hubId: hubId === "none" ? null : hubId,
        routeDate,
        plannedStart: `${routeDate}T${WAVE_START[wave] ?? startTime}:00+02:00`,
        driverId: driver?.id ?? null,
        shipmentIds: chunk.map((i) => i.id),
      });
      planned.push({ routeId: res.routeId, name, hub: hub?.code ?? "—", stops: res.stops, shipments: chunk.length, driver: driver?.name, totalDistanceKm: res.totalDistanceKm });
    }
  }

  return {
    routeDate,
    dryRun: !!params.dryRun,
    routes: planned,
    shipmentsPlanned: planned.reduce((a, r) => a + r.shipments, 0),
    unassignedRoutes: planned.filter((r) => !r.driver).length,
    skipped,
  };
}

// ---------------------------------------------------------------------------
// dispatch_route
// ---------------------------------------------------------------------------
async function dispatchRoute(admin: SupabaseClient, routeId: string) {
  const { data: route, error } = await admin
    .from("delivery_routes")
    .select("id, status, driver_id, total_stops")
    .eq("id", routeId)
    .single();
  if (error || !route) throw new Error("route_not_found");
  if (!route.driver_id) throw new Error("route_has_no_driver");
  if (!["draft", "planned"].includes(route.status)) throw new Error("route_not_dispatchable");
  if (!route.total_stops) throw new Error("route_has_no_stops");

  const { error: upErr } = await admin
    .from("delivery_routes")
    .update({ status: "dispatched", dispatched_at: new Date().toISOString() })
    .eq("id", routeId);
  if (upErr) throw upErr;

  // Linked delivery jobs belong to the route driver now.
  await admin
    .from("delivery_jobs")
    .update({ driver_id: route.driver_id, status: "accepted" })
    .eq("route_id", routeId)
    .in("status", ["pending", "failed"]);

  return { routeId, status: "dispatched" };
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth } = await userClient.auth.getUser();
    if (!auth?.user) return json({ error: "unauthorized" }, 401);

    const { data: role } = await userClient.rpc("logistics_role", { _user: auth.user.id });
    if (!role || !DISPATCH_ROLES.includes(role as string)) return json({ error: "forbidden" }, 403);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    switch (body.action) {
      case "auto_assign":
        return json(await autoAssign(admin, body));
      case "create_route":
        return json(await createRoute(admin, auth.user.id, body));
      case "auto_plan":
        return json(await autoPlan(admin, auth.user.id, body));
      case "recalc_route":
        if (!body.routeId) return json({ error: "routeId_required" }, 400);
        return json(await optimizeRoute(admin, body.routeId, true));
      case "optimize_route":
        if (!body.routeId) return json({ error: "routeId_required" }, 400);
        return json(await optimizeRoute(admin, body.routeId));
      case "dispatch_route":
        if (!body.routeId) return json({ error: "routeId_required" }, 400);
        return json(await dispatchRoute(admin, body.routeId));
      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String((err as any)?.message ?? err);
    console.error("logistics-dispatch error:", message);
    return json({ error: message }, 400);
  }
});
