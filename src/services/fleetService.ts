import { supabase } from "@/integrations/supabase/client";
import type { GautengLicenceState, RpcResult } from "@/services/driverVerificationService";

// The tables and functions used here arrive with 20261012180000_fleet_operators.sql
// and are not in the generated database types yet.
const db = supabase as any;

export type VehicleDocType = "operating_licence" | "roadworthy" | "insurance";

export const VEHICLE_DOCUMENTS: { type: VehicleDocType; label: string }[] = [
  { type: "operating_licence", label: "Operating licence" },
  { type: "roadworthy", label: "Roadworthy certificate" },
  { type: "insurance", label: "Insurance" },
];

export const SAFETY_DEVICES: { type: string; label: string }[] = [
  { type: "dashcam", label: "Dashcam" },
  { type: "gps_tracker", label: "GPS tracker" },
  { type: "panic_button", label: "Panic button" },
  { type: "fire_extinguisher", label: "Fire extinguisher" },
  { type: "first_aid_kit", label: "First-aid kit" },
];

export const MAINTENANCE_KINDS = ["service", "tyres", "brakes", "inspection", "other"] as const;

export interface FleetVehicle {
  id: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  /** "pending" until 1145 approves it, then "active". */
  status: string;
  online: boolean;
  documents: { doc_type: VehicleDocType; state: "valid" | "expired" | "pending" | "missing"; expires_on: string | null }[];
  gauteng_state: GautengLicenceState;
  gauteng_application: {
    id: string;
    gptris_reference: string;
    status: "submitted" | "receipt_verified" | "rejected";
    review_notes: string | null;
    licence_submitted: boolean;
  } | null;
  devices: {
    id: string;
    device_type: string;
    status: "working" | "faulty" | "not_fitted";
    serial_number: string | null;
    last_checked_on: string | null;
    verified: boolean;
  }[];
  maintenance: { id: string; kind: string; description: string | null; due_on: string }[];
}

export interface FleetOverview {
  fleet: {
    id: string;
    name: string;
    legal_name: string | null;
    verification_status: "pending" | "verified" | "rejected";
    verification_notes: string | null;
    payout_mode: "operator" | "driver";
    driver_share_pct: number | null;
  };
  vehicles: FleetVehicle[];
  drivers: {
    driver_id: string;
    name: string;
    phone: string | null;
    membership: "invited" | "active";
    driver_status: string;
    online: boolean;
  }[];
  shifts: { id: string; vehicle_id: string; driver_id: string; starts_at: string; ends_at: string | null; current: boolean }[];
  alerts: { severity: "high" | "medium" | "info"; vehicle_id: string; license_plate: string; message: string }[];
}

export interface FleetEarningsRow {
  vehicle_id: string;
  license_plate: string;
  driver_id: string;
  driver_name: string;
  trips: number;
  fares: number;
  fuel_adjustments: number;
  commission: number;
  payout: number;
  driver_share: number | null;
}

export interface VehicleRow {
  license_plate: string;
  make: string;
  model: string;
  year: string;
  color?: string;
  vin_number?: string;
}

export interface BulkResult extends RpcResult {
  added?: number;
  results?: { row: number; license_plate: string; ok: boolean; message: string | null }[];
}

export interface DriverFleetStatus {
  /** True while a fleet shift decides which vehicle the driver goes online in. */
  on_fleet_vehicle: boolean;
  memberships: { id: string; fleet_id: string; fleet_name: string; status: "invited" | "active" }[];
  shifts: {
    id: string;
    fleet_name: string;
    license_plate: string;
    vehicle: string;
    starts_at: string;
    ends_at: string | null;
    current: boolean;
    vehicle_ready: boolean;
  }[];
}

const failed = (message?: string): RpcResult => ({ ok: false, message: message || "Something went wrong. Please try again." });

/** For functions that return {ok, message}. */
async function call<T extends RpcResult = RpcResult>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error || !data) return failed(error?.message) as T;
  return data as T;
}

/** For functions that return nothing and raise on failure. */
async function run(fn: string, args?: Record<string, unknown>): Promise<RpcResult> {
  const { error } = await db.rpc(fn, args);
  return error ? failed(error.message) : { ok: true };
}

const COLUMN_ALIASES: Record<string, keyof VehicleRow> = {
  license_plate: "license_plate", licence_plate: "license_plate", plate: "license_plate", registration: "license_plate",
  number_plate: "license_plate", make: "make", model: "model", year: "year", color: "color", colour: "color",
  vin: "vin_number", vin_number: "vin_number",
};

/**
 * Reads vehicles from spreadsheet text: one per line, columns separated by
 * commas, semicolons or tabs, with a header row naming the columns.
 */
export function parseVehicleSheet(text: string): { rows: VehicleRow[]; error?: string } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], error: "Add a header row and at least one vehicle." };
  const separator = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const cells = (line: string) => line.split(separator).map((c) => c.trim().replace(/^"|"$/g, ""));
  const header = cells(lines[0]).map((h) => COLUMN_ALIASES[h.toLowerCase().replace(/[\s-]+/g, "_")]);
  if (!header.includes("license_plate") || !header.includes("make") || !header.includes("model") || !header.includes("year")) {
    return { rows: [], error: "The header row needs these columns: plate, make, model, year. Colour and VIN are optional." };
  }
  const rows = lines.slice(1).map((line) => {
    const row: Partial<VehicleRow> = {};
    cells(line).forEach((value, i) => {
      if (header[i]) row[header[i]] = value;
    });
    return row as VehicleRow;
  });
  return { rows };
}

export const fleetService = {
  /** The signed-in operator's fleet, if they have one. */
  async myFleetId(userId: string): Promise<string | null> {
    const { data } = await supabase.from("fleets").select("id").eq("owner_id", userId).maybeSingle();
    return data?.id ?? null;
  },

  register(f: { name: string; ownerType: "individual" | "company"; legalName: string; registrationNumber: string; phone: string }) {
    return call("register_fleet", {
      p_name: f.name, p_owner_type: f.ownerType, p_legal_name: f.legalName,
      p_registration_number: f.registrationNumber, p_contact_phone: f.phone,
    });
  },

  async overview(fleetId: string): Promise<FleetOverview> {
    const { data, error } = await db.rpc("fleet_overview", { p_fleet_id: fleetId });
    if (error) throw error;
    return data as FleetOverview;
  },

  addVehicles: (fleetId: string, vehicles: VehicleRow[]) =>
    call<BulkResult>("fleet_add_vehicles", { p_fleet_id: fleetId, p_vehicles: vehicles }),

  inviteDriver: (fleetId: string, contact: string) =>
    call<RpcResult & { driver_name?: string }>("fleet_invite_driver", { p_fleet_id: fleetId, p_contact: contact }),

  endDriver: (fleetId: string, driverId: string) => run("fleet_end_driver", { p_fleet_id: fleetId, p_driver_id: driverId }),

  scheduleShift: (fleetId: string, s: { vehicleId: string; driverId: string; startsAt: string; endsAt: string | null; repeatDays: number }) =>
    call<RpcResult & { created?: number; skipped?: { starts_at: string; reason: string }[] }>("fleet_schedule_shift", {
      p_fleet_id: fleetId, p_vehicle_id: s.vehicleId, p_driver_id: s.driverId,
      p_starts_at: s.startsAt, p_ends_at: s.endsAt, p_repeat_days: s.repeatDays,
    }),

  cancelShift: (shiftId: string) => run("fleet_cancel_shift", { p_shift_id: shiftId }),

  submitDocument: (vehicleId: string, docType: VehicleDocType, filePath: string, expiresOn: string, documentNumber?: string) =>
    call("fleet_submit_vehicle_document", {
      p_vehicle_id: vehicleId, p_doc_type: docType, p_file_path: filePath, p_expires_on: expiresOn, p_document_number: documentNumber || null,
    }),

  submitGautengApplication: (vehicleId: string, reference: string, receiptPath: string, submittedOn: string) =>
    call("fleet_submit_gauteng_application", {
      p_vehicle_id: vehicleId, p_gptris_reference: reference, p_receipt_path: receiptPath, p_submitted_on: submittedOn,
    }),

  submitGautengLicence: (applicationId: string, l: { number: string; path: string; expiresOn: string; operatingArea: string }) =>
    call("fleet_submit_gauteng_licence", {
      p_application_id: applicationId, p_licence_number: l.number, p_licence_path: l.path,
      p_licence_expires_on: l.expiresOn, p_operating_area: l.operatingArea,
    }),

  setSafetyDevice: (vehicleId: string, d: { type: string; status: string; serial: string; checkedOn: string }) =>
    run("fleet_set_safety_device", {
      p_vehicle_id: vehicleId, p_device_type: d.type, p_status: d.status,
      p_serial_number: d.serial || null, p_last_checked_on: d.checkedOn || null,
    }),

  logMaintenance: (vehicleId: string, m: { kind: string; dueOn: string; description: string }) =>
    run("fleet_log_maintenance", { p_vehicle_id: vehicleId, p_kind: m.kind, p_due_on: m.dueOn, p_description: m.description || null }),

  completeMaintenance: (maintenanceId: string, completedOn: string, nextDueOn: string | null) =>
    run("fleet_complete_maintenance", { p_maintenance_id: maintenanceId, p_completed_on: completedOn, p_next_due_on: nextDueOn }),

  async earnings(fleetId: string, from: string, to: string): Promise<FleetEarningsRow[]> {
    const { data, error } = await db.rpc("fleet_earnings", { p_fleet_id: fleetId, p_from: from, p_to: to });
    if (error) throw error;
    return (data ?? []) as FleetEarningsRow[];
  },

  saveDriverShare: (fleetId: string, pct: number | null) =>
    db.from("fleets").update({ driver_share_pct: pct }).eq("id", fleetId) as PromiseLike<{ error: { message: string } | null }>,

  // --- the driver's side
  async driverStatus(): Promise<DriverFleetStatus | null> {
    const { data, error } = await db.rpc("driver_fleet_status");
    return error ? null : (data as DriverFleetStatus | null);
  },

  respondToInvite: (inviteId: string, accept: boolean) =>
    call("driver_respond_fleet_invite", { p_invite_id: inviteId, p_accept: accept }),
};
