import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * The logistics tables (shipments, hubs, routes…) are newer than the generated
 * Supabase types. Until `supabase gen types` is re-run, access them through an
 * untyped handle and cast results to the interfaces below.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as unknown as SupabaseClient<any>;

export type LogisticsRole = "owner" | "dispatcher" | "fleet_manager" | "hub_operator" | "viewer";

export type ShipmentStatus =
  | "created"
  | "awaiting_pickup"
  | "picked_up"
  | "at_hub"
  | "out_for_delivery"
  | "delivered"
  | "failed_attempt"
  | "returning"
  | "returned"
  | "cancelled"
  | "exception"
  | "ready_for_collection";

export type ServiceLevel = "express" | "same_day" | "next_day" | "standard";

export type DeliveryWindow = "any" | "morning" | "afternoon" | "evening";

export const DELIVERY_WINDOWS: Record<DeliveryWindow, { label: string; hours: [number, number] | null }> = {
  any: { label: "Any time", hours: null },
  morning: { label: "Morning (08:00–12:00)", hours: [8, 12] },
  afternoon: { label: "Afternoon (12:00–17:00)", hours: [12, 17] },
  evening: { label: "Evening (17:00–20:00)", hours: [17, 20] },
};

/** Services that can be booked into a delivery window. */
export const WINDOWED_SERVICES: ServiceLevel[] = ["next_day", "standard"];

/** End of a window (SAST) on the day of `promise`, or `promise` unchanged for "any". */
export function windowedPromise(promise: Date, window: DeliveryWindow): Date {
  const hours = DELIVERY_WINDOWS[window].hours;
  if (!hours) return promise;
  const day = new Date(promise.getTime() + 2 * 3_600_000).toISOString().slice(0, 10);
  return new Date(`${day}T${String(hours[1]).padStart(2, "0")}:00:00+02:00`);
}

export type Address = {
  street?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  lat?: number;
  lng?: number;
};

export interface Hub {
  id: string;
  code: string;
  name: string;
  hub_type: "hub" | "warehouse" | "depot" | "pickup_point" | "locker";
  is_public?: boolean;
  opening_hours_text?: string | null;
  address: Address;
  lat: number | null;
  lng: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  capacity_parcels: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Shipment {
  id: string;
  tracking_number: string;
  reference: string | null;
  order_id: string | null;
  delivery_job_id: string | null;
  sender_name: string;
  sender_phone: string | null;
  recipient_name: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  pickup_address: Address;
  delivery_address: Address;
  origin_hub_id: string | null;
  destination_hub_id: string | null;
  current_hub_id: string | null;
  service_level: ServiceLevel;
  status: ShipmentStatus;
  parcel_count: number;
  weight_kg: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  declared_value: number | null;
  cod_amount: number | null;
  shipping_fee: number | null;
  require_otp: boolean;
  delivery_otp: string | null;
  attempt_count: number;
  max_attempts: number;
  last_failure_reason: string | null;
  promised_by: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  source?: "ops" | "csv_import" | "marketplace" | "consumer" | "api";
  payment_status?: "not_required" | "unpaid" | "paid" | "refunded";
  delivery_preferences?: { safe_place?: string; instructions?: string };
  preferred_date?: string | null;
  rating?: number | null;
  rating_comment?: string | null;
  api_key_id?: string | null;
  otp_failures?: number;
  sla_risk_at?: string | null;
  delivery_window?: DeliveryWindow;
  requires_approval?: boolean;
  approved_at?: string | null;
  approval_note?: string | null;
  pii_redacted_at?: string | null;
  collect_by?: string | null;
  collected_at?: string | null;
  account_id?: string | null;
  return_of_shipment_id?: string | null;
  return_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  status: string;
  event_type: string;
  hub_id: string | null;
  driver_id: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  created_at: string;
}

export type RouteStatus = "draft" | "planned" | "dispatched" | "in_progress" | "completed" | "cancelled";

export interface DeliveryRoute {
  id: string;
  name: string;
  route_date: string;
  planned_start: string | null;
  hub_id: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  status: RouteStatus;
  total_stops: number;
  total_distance_km: number | null;
  total_duration_mins: number | null;
  optimized_at: string | null;
  dispatched_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  co2_kg?: number | null;
  created_at: string;
}

export type StopStatus = "pending" | "arrived" | "completed" | "failed" | "skipped";

export interface RouteStop {
  id: string;
  route_id: string;
  sequence: number;
  stop_type: "pickup" | "delivery" | "hub";
  shipment_id: string | null;
  delivery_job_id: string | null;
  hub_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  address: Address;
  lat: number | null;
  lng: number | null;
  status: StopStatus;
  eta: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  proof: Record<string, unknown> | null;
  notes: string | null;
  require_otp: boolean;
  cod_amount: number | null;
  parcel_count: number;
  window_start?: string | null;
  window_end?: string | null;
  planned_eta?: string | null;
}

export interface DriverRow {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  status: "available" | "busy" | "offline";
  rating: number | null;
  total_deliveries: number | null;
  vehicle_type: string | null;
  vehicle_registration: string | null;
}

export interface DriverLocation {
  driver_id: string;
  latitude: number;
  longitude: number;
  is_online: boolean;
  is_available: boolean;
  last_updated: string;
}

export const SHIPMENT_STATUS: Record<ShipmentStatus, { label: string; tone: string }> = {
  created: { label: "Created", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  awaiting_pickup: { label: "Awaiting pickup", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  picked_up: { label: "Picked up", tone: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  at_hub: { label: "At hub", tone: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200" },
  out_for_delivery: { label: "Out for delivery", tone: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" },
  delivered: { label: "Delivered", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  failed_attempt: { label: "Failed attempt", tone: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200" },
  returning: { label: "Returning", tone: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200" },
  returned: { label: "Returned", tone: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200" },
  cancelled: { label: "Cancelled", tone: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400" },
  exception: { label: "Exception", tone: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
  ready_for_collection: { label: "Ready to collect", tone: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200" },
};

export const ROUTE_STATUS: Record<RouteStatus, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  planned: { label: "Planned", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  dispatched: { label: "Dispatched", tone: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  in_progress: { label: "In progress", tone: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" },
  completed: { label: "Completed", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  cancelled: { label: "Cancelled", tone: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400" },
};

export const SERVICE_LEVELS: Record<ServiceLevel, string> = {
  express: "Express (2h)",
  same_day: "Same day",
  next_day: "Next day",
  standard: "Standard (2–3 days)",
};

/** Hours until the SLA promise for a service level, used as a default. */
export const SERVICE_LEVEL_HOURS: Record<ServiceLevel, number> = {
  express: 2,
  same_day: 10,
  next_day: 30,
  standard: 72,
};

/** Shipment statuses that still need work. */
export const OPEN_SHIPMENT_STATUSES: ShipmentStatus[] = [
  "created",
  "awaiting_pickup",
  "picked_up",
  "at_hub",
  "out_for_delivery",
  "failed_attempt",
  "returning",
  "exception",
  "ready_for_collection",
];

/** Statuses a shipment may be routed from. */
export const ROUTABLE_STATUSES: ShipmentStatus[] = ["created", "awaiting_pickup", "picked_up", "at_hub", "failed_attempt"];

export const ROLE_LABELS: Record<LogisticsRole, string> = {
  owner: "Owner",
  dispatcher: "Dispatcher",
  fleet_manager: "Fleet manager",
  hub_operator: "Hub operator",
  viewer: "Viewer",
};

export function formatAddress(a: Address | string | null | undefined): string {
  if (!a) return "";
  if (typeof a === "string") return a;
  return [a.street, a.suburb, a.city, a.postal_code].filter(Boolean).join(", ");
}

export function isLate(s: Pick<Shipment, "promised_by" | "status" | "delivered_at">): boolean {
  if (!s.promised_by) return false;
  const promised = new Date(s.promised_by).getTime();
  if (s.status === "delivered") return !!s.delivered_at && new Date(s.delivered_at).getTime() > promised;
  if (["cancelled", "returned"].includes(s.status)) return false;
  return Date.now() > promised;
}

const DISPATCH_ERRORS: Record<string, string> = {
  forbidden: "Your role can't run dispatch actions.",
  no_shipments: "Select at least one shipment.",
  no_routable_shipments: "None of the selected shipments can be routed in their current status.",
  shipments_already_routed: "All selected shipments are already on an open route.",
  route_has_no_driver: "Assign a driver before dispatching.",
  route_has_no_stops: "This route has no stops.",
  route_not_dispatchable: "Only draft or planned routes can be dispatched.",
  route_closed: "This route is already closed.",
  pickup_after_delivery: "A delivery can't come before its pickup. Move the pickup stop up first.",
};

/** Call the server-side dispatch edge function. */
export async function invokeDispatch<T = Record<string, unknown>>(
  action: "auto_assign" | "create_route" | "optimize_route" | "recalc_route" | "dispatch_route" | "auto_plan",
  params: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("logistics-dispatch", {
    body: { action, ...params },
  });
  if (error) {
    // FunctionsHttpError carries the JSON body on `context`.
    let code = error.message;
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error) code = body.error;
    } catch {
      /* keep generic message */
    }
    throw new Error(DISPATCH_ERRORS[code] ?? code);
  }
  return data as T;
}
