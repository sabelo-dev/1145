import { supabase } from "@/integrations/supabase/client";
import { platform } from "@/lib/native";

// The tables and functions used here arrive with
// 20261012150000_driver_continuous_verification.sql and are not in the
// generated database types yet.
const db = supabase as any;

const KYC_BUCKET = "driver-kyc";
const DEVICE_KEY = "1145.driver-device-id";

export interface RpcResult {
  ok: boolean;
  code?: string;
  message?: string;
  id?: string;
  session_id?: string;
}

export interface IdentityCheck {
  id: string;
  challenge: string;
  due_at: string;
  trigger: "go_online" | "random";
}

export interface Heartbeat {
  online: boolean;
  status?: string;
  reason?: string | null;
  check?: IdentityCheck | null;
}

export type DriverDocType = "prdp" | "operating_licence" | "roadworthy" | "insurance";

export const DRIVER_DOCUMENTS: { type: DriverDocType; label: string; hint: string }[] = [
  { type: "prdp", label: "Professional driving permit (PrDP)", hint: "Category P, for carrying passengers" },
  { type: "operating_licence", label: "Operating licence", hint: "Issued for the vehicle by the provincial regulatory entity" },
  { type: "roadworthy", label: "Roadworthy certificate", hint: "For the vehicle you drive" },
  { type: "insurance", label: "Vehicle insurance", hint: "Must cover carrying passengers for reward" },
];

export interface DriverVerificationStatus {
  status: string;
  suspension_reason: string | null;
  compliance_enforced: boolean;
  kyc_status: string | null;
  online: boolean;
  documents: {
    doc_type: DriverDocType;
    /** "transitional": no licence yet, but a verified application during a transitional period. */
    state: "valid" | "expired" | "pending" | "missing" | "transitional";
    expires_on: string | null;
    latest: { status: string; expires_on: string; review_notes: string | null; created_at: string } | null;
  }[];
  vehicle: {
    status: "pending" | "approved" | "rejected";
    relationship: "owner_driver" | "authorised_driver";
    review_notes: string | null;
    license_plate: string;
    make: string;
    model: string;
    year: number;
    color: string;
    owner_name: string;
    owner_type: "individual" | "company";
  } | null;
  device: { label: string | null; platform: string | null; first_seen_at: string; last_seen_at: string } | null;
}

export type GautengLicenceState = "verified" | "application_pending" | "expired" | "rejected" | "not_applied";

export const GAUTENG_STATES: Record<GautengLicenceState, { label: string; className: string }> = {
  verified: { label: "Verified", className: "bg-green-600 text-white border-0" },
  application_pending: { label: "Application pending", className: "bg-blue-600 text-white border-0" },
  expired: { label: "Expired", className: "bg-destructive text-destructive-foreground border-0" },
  rejected: { label: "Rejected", className: "bg-destructive text-destructive-foreground border-0" },
  not_applied: { label: "No application", className: "" },
};

export interface GautengLicenceStatus {
  state: GautengLicenceState;
  /** Whether the operating-licence requirement is met today. */
  may_operate: boolean;
  /** Set only while a transitional period is running. */
  transitional_until: string | null;
  licence: { licence_number: string; licence_expires_on: string; operating_area: string; gptris_reference: string } | null;
  application: {
    id: string;
    gptris_reference: string;
    submitted_on: string;
    status: "submitted" | "receipt_verified" | "rejected";
    review_notes: string | null;
    licence_submitted: boolean;
  } | null;
}

export interface VehicleDeclaration {
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  ownerIsSelf: boolean;
  ownerType: "individual" | "company";
  ownerName: string;
  ownerIdNumber: string;
  ownerPhone?: string;
  ownerEmail?: string;
  authorisationDocPath?: string;
}

let deviceId: Promise<string> | null = null;

/**
 * A random id created once and kept on this device. It is what the driver's
 * account is bound to; clearing the app's data makes the device look new.
 */
export function getDeviceId(): Promise<string> {
  deviceId ??= (async () => {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: DEVICE_KEY });
      if (value) return value;
      const created = crypto.randomUUID();
      await Preferences.set({ key: DEVICE_KEY, value: created });
      return created;
    } catch {
      const stored = localStorage.getItem(DEVICE_KEY);
      if (stored) return stored;
      const created = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, created);
      return created;
    }
  })();
  return deviceId;
}

const failed = (message?: string): RpcResult => ({
  ok: false,
  code: "error",
  message: message || "Something went wrong. Please try again.",
});

async function call(fn: string, args?: Record<string, unknown>): Promise<RpcResult> {
  const { data, error } = await db.rpc(fn, args);
  if (error || !data) return failed(error?.message);
  return data as RpcResult;
}

export const driverVerification = {
  async goOnline(): Promise<RpcResult> {
    return call("driver_go_online", {
      p_device_id: await getDeviceId(),
      p_platform: platform(),
      p_device_label: navigator.userAgent.slice(0, 200),
    });
  },

  goOffline(): Promise<RpcResult> {
    return call("driver_go_offline");
  },

  async heartbeat(): Promise<Heartbeat | null> {
    const { data, error } = await db.rpc("driver_session_heartbeat", { p_device_id: await getDeviceId() });
    return error ? null : (data as Heartbeat);
  },

  async requestIdentityCheck(): Promise<RpcResult & { check?: IdentityCheck }> {
    return call("driver_request_identity_check", { p_device_id: await getDeviceId() });
  },

  /** Uploads the selfie taken for a check and hands it in. */
  async submitIdentityCheck(userId: string, check: IdentityCheck, selfie: Blob): Promise<RpcResult> {
    const path = `${userId}/identity-checks/${check.id}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from(KYC_BUCKET).upload(path, selfie, { contentType: "image/jpeg" });
    if (error) return failed("The selfie did not upload. Check your connection and try again.");
    return call("driver_submit_identity_check", {
      p_check_id: check.id,
      p_selfie_path: path,
      p_device_id: await getDeviceId(),
    });
  },

  async status(): Promise<DriverVerificationStatus | null> {
    const { data, error } = await db.rpc("driver_verification_status");
    if (error) throw error;
    return data as DriverVerificationStatus | null;
  },

  submitDocument(docType: DriverDocType, filePath: string, expiresOn: string, documentNumber?: string): Promise<RpcResult> {
    return call("driver_submit_document", {
      p_doc_type: docType,
      p_file_path: filePath,
      p_expires_on: expiresOn,
      p_document_number: documentNumber || null,
    });
  },

  async gautengStatus(): Promise<GautengLicenceStatus | null> {
    const { data, error } = await db.rpc("driver_gauteng_licence_status");
    if (error) throw error;
    return data as GautengLicenceStatus | null;
  },

  submitGautengApplication(reference: string, receiptPath: string, submittedOn: string): Promise<RpcResult> {
    return call("driver_submit_gauteng_application", {
      p_gptris_reference: reference,
      p_receipt_path: receiptPath,
      p_submitted_on: submittedOn,
    });
  },

  submitGautengLicence(
    applicationId: string,
    licence: { number: string; path: string; expiresOn: string; operatingArea: string },
  ): Promise<RpcResult> {
    return call("driver_submit_gauteng_licence", {
      p_application_id: applicationId,
      p_licence_number: licence.number,
      p_licence_path: licence.path,
      p_licence_expires_on: licence.expiresOn,
      p_operating_area: licence.operatingArea,
    });
  },

  declareVehicle(v: VehicleDeclaration): Promise<RpcResult> {
    return call("driver_declare_vehicle", {
      p_license_plate: v.licensePlate,
      p_make: v.make,
      p_model: v.model,
      p_year: v.year,
      p_color: v.color,
      p_owner_is_self: v.ownerIsSelf,
      p_owner_type: v.ownerType,
      p_owner_name: v.ownerName,
      p_owner_id_number: v.ownerIdNumber,
      p_owner_phone: v.ownerPhone || null,
      p_owner_email: v.ownerEmail || null,
      p_authorisation_doc_path: v.authorisationDocPath || null,
    });
  },
};

/** Why a driver was taken offline, in words a driver would use. */
export function offlineReason(reason?: string | null): string {
  switch (reason) {
    case "identity_check_missed":
      return "We did not get your selfie in time.";
    case "frozen":
    case "status_suspended":
      return "Your account has been suspended.";
    case "device_revoked":
      return "This device has been blocked for your account.";
    case "replaced_by_new_device":
      return "Your account went online on another device.";
    default:
      return "Your session has ended.";
  }
}
