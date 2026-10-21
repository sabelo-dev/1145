import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const seconds = (value: unknown) => typeof value === "string" && /^\d+(\.\d+)?s$/.test(value) ? Math.ceil(parseFloat(value)) : NaN;
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return json({ error: "Sign in" }, 401);
    const { rideId } = await req.json();
    if (typeof rideId !== "string" || !/^[0-9a-f-]{36}$/i.test(rideId)) return json({ error: "Invalid ride" }, 400);
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ride } = await db.from("rides").select("id,passenger_id,driver_id,status,pickup_lat,pickup_lng,pickup_latitude,pickup_longitude,dropoff_lat,dropoff_lng,dropoff_latitude,dropoff_longitude").eq("id", rideId).maybeSingle();
    if (!ride?.driver_id) return json({ error: "Driver has not been assigned" }, 404);
    const { data: driver } = await db.from("drivers").select("user_id").eq("id", ride.driver_id).single();
    if (ride.passenger_id !== user.id && driver?.user_id !== user.id) return json({ error: "Not your trip" }, 403);
    if (!["accepted", "arriving", "arrived", "in_progress"].includes(ride.status)) return json({ error: "Trip is no longer active" }, 409);
    const { data: position } = await db.from("driver_locations").select("latitude,longitude,last_updated").eq("driver_id", ride.driver_id).maybeSingle();
    if (!position || Date.now() - Date.parse(position.last_updated) > 90_000) return json({ error: "Waiting for the driver's current location" }, 503);
    const destinationKind = ride.status === "in_progress" ? "dropoff" : "pickup";
    const result = (row: { duration_seconds: number; static_duration_seconds: number; distance_meters: number; updated_at: string }) => ({
      destination: destinationKind, minutes: Math.max(1, Math.ceil(row.duration_seconds / 60)),
      durationSeconds: row.duration_seconds, distanceKm: row.distance_meters / 1000,
      trafficDelayMinutes: Math.max(0, Math.ceil((row.duration_seconds - row.static_duration_seconds) / 60)),
      arrivalAt: new Date(Date.parse(row.updated_at) + row.duration_seconds * 1000).toISOString(),
      updatedAt: row.updated_at, trafficAware: true,
    });
    const { data: cached } = await db.from("ride_arrival_estimates").select("*").eq("ride_id", rideId).maybeSingle();
    if (cached?.driver_id === ride.driver_id && cached.destination_kind === destinationKind && Date.now() - Date.parse(cached.updated_at) < 30_000) return json(result(cached));
    const key = Deno.env.get("GOOGLE_ROUTES_API_KEY");
    if (!key) return json({ error: "Live arrival estimates are not configured" }, 503);
    const lat = destinationKind === "pickup" ? ride.pickup_lat ?? ride.pickup_latitude : ride.dropoff_lat ?? ride.dropoff_latitude;
    const lng = destinationKind === "pickup" ? ride.pickup_lng ?? ride.pickup_longitude : ride.dropoff_lng ?? ride.dropoff_longitude;
    if (lat == null || lng == null) return json({ error: "Destination coordinates are unavailable" }, 422);
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST", signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters" },
      body: JSON.stringify({ origin: { location: { latLng: { latitude: Number(position.latitude), longitude: Number(position.longitude) } } }, destination: { location: { latLng: { latitude: Number(lat), longitude: Number(lng) } } }, travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE_OPTIMAL", trafficModel: "BEST_GUESS" }),
    });
    if (!response.ok) return json({ error: "Live traffic estimate is temporarily unavailable" }, 503);
    const route = (await response.json()).routes?.[0];
    const row = { ride_id: rideId, driver_id: ride.driver_id, destination_kind: destinationKind, duration_seconds: seconds(route?.duration), static_duration_seconds: seconds(route?.staticDuration), distance_meters: route?.distanceMeters, updated_at: new Date().toISOString() };
    if (!Number.isFinite(row.duration_seconds) || !Number.isFinite(row.static_duration_seconds) || !Number.isFinite(row.distance_meters)) return json({ error: "No driving route was found" }, 503);
    const { error } = await db.from("ride_arrival_estimates").upsert(row);
    if (error) return json({ error: "Could not save arrival estimate" }, 503);
    return json(result(row));
  } catch { return json({ error: "Live arrival estimate is temporarily unavailable" }, 503); }
});
