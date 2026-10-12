import React, { useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DocumentUpload from "@/components/onboarding/DocumentUpload";
import { useToast } from "@/hooks/use-toast";
import { GAUTENG_STATES, type RpcResult } from "@/services/driverVerificationService";
import {
  MAINTENANCE_KINDS,
  SAFETY_DEVICES,
  VEHICLE_DOCUMENTS,
  fleetService,
  type FleetVehicle,
  type VehicleDocType,
} from "@/services/fleetService";

const KYC_BUCKET = "driver-kyc";
const day = (value: string) => format(new Date(value), "d MMM yyyy");
const today = () => format(new Date(), "yyyy-MM-dd");

export const DOC_STATE: Record<string, { label: string; className: string }> = {
  valid: { label: "Valid", className: "bg-green-600 text-white border-0" },
  expired: { label: "Expired", className: "bg-destructive text-destructive-foreground border-0" },
  pending: { label: "Being reviewed", className: "bg-blue-600 text-white border-0" },
  missing: { label: "Not uploaded", className: "" },
};

interface Props {
  vehicle: FleetVehicle | null;
  userId: string;
  onClose: () => void;
  /** Called after anything is saved, to reload the fleet. */
  onChanged: () => void;
}

/** One fleet vehicle's documents, GPTRIS record, safety devices and maintenance. */
const FleetVehicleDialog: React.FC<Props> = ({ vehicle, userId, onClose, onChanged }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<{ type: VehicleDocType; file?: string; expiresOn: string } | null>(null);
  const [gptris, setGptris] = useState<"application" | "licence" | null>(null);
  const [application, setApplication] = useState({ reference: "", submittedOn: "", receipt: undefined as string | undefined });
  const [licence, setLicence] = useState({ number: "", expiresOn: "", operatingArea: "", file: undefined as string | undefined });
  const [device, setDevice] = useState({ type: "dashcam", status: "working", serial: "", checkedOn: today() });
  const [maintenance, setMaintenance] = useState({ kind: "service", dueOn: "", description: "" });
  const [nextDue, setNextDue] = useState<Record<string, string>>({});

  if (!vehicle) return null;

  const save = async (action: Promise<RpcResult>, done: string, after?: () => void) => {
    setBusy(true);
    const result = await action;
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Not saved", description: result.message });
      return;
    }
    toast({ title: done });
    after?.();
    onChanged();
  };

  const folder = `${userId}/fleet/${vehicle.id}`;
  const openApplication = vehicle.gauteng_application?.status !== "rejected" ? vehicle.gauteng_application : null;
  const gauteng = GAUTENG_STATES[vehicle.gauteng_state];
  const viaGptris = vehicle.gauteng_state !== "not_applied";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vehicle.license_plate}</DialogTitle>
          <DialogDescription>
            {vehicle.year} {vehicle.make} {vehicle.model}, {vehicle.color}.{" "}
            {vehicle.status === "active" ? "Approved by 1145." : "Waiting for 1145 to approve this vehicle."}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="font-semibold">Documents</h3>
          <p className="text-sm text-muted-foreground">
            These cover every driver you put in this vehicle. It cannot go online while one is missing or expired.
          </p>
          {VEHICLE_DOCUMENTS.map(({ type, label }) => {
            const state = vehicle.documents.find((d) => d.doc_type === type);
            const badge = DOC_STATE[state?.state ?? "missing"];
            const managed = type === "operating_licence" && viaGptris;
            return (
              <div key={type} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-muted-foreground">
                      {state?.expires_on ? `${state.state === "expired" ? "Expired" : "Valid until"} ${day(state.expires_on)}` : ""}
                      {managed ? " Recorded through the GPTRIS application below." : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                    {!managed && doc?.type !== type && (
                      <Button size="sm" variant="outline" onClick={() => setDoc({ type, expiresOn: "" })}>
                        {state?.state === "missing" ? "Upload" : "Renew"}
                      </Button>
                    )}
                  </div>
                </div>
                {doc?.type === type && (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    <DocumentUpload label={label} bucket={KYC_BUCKET} folder={`${folder}/${type}`} value={doc.file} onChange={(file) => setDoc({ ...doc, file })} />
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`fleet-doc-${type}`}>Expiry date</Label>
                        <Input id={`fleet-doc-${type}`} type="date" value={doc.expiresOn} onChange={(e) => setDoc({ ...doc, expiresOn: e.target.value })} />
                      </div>
                      <Button variant="outline" onClick={() => setDoc(null)} disabled={busy}>Cancel</Button>
                      <Button
                        disabled={busy || !doc.file || !doc.expiresOn}
                        onClick={() => save(fleetService.submitDocument(vehicle.id, type, doc.file!, doc.expiresOn), "Submitted for review", () => setDoc(null))}
                      >
                        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit for review
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Gauteng operating licence (GPTRIS)</h3>
            <Badge variant="outline" className={gauteng.className}>{gauteng.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            For vehicles that operate in Gauteng. A receipt is not a licence: the vehicle does not count as licensed until
            the licence is issued and 1145 has checked it.
          </p>
          {vehicle.gauteng_application && (
            <p className="text-sm">
              Application {vehicle.gauteng_application.gptris_reference}:{" "}
              {vehicle.gauteng_application.status === "submitted" && "1145 is checking the receipt."}
              {vehicle.gauteng_application.status === "receipt_verified" &&
                (vehicle.gauteng_application.licence_submitted ? "1145 is checking the licence." : "receipt confirmed, waiting for the licence.")}
              {vehicle.gauteng_application.status === "rejected" && `not accepted. ${vehicle.gauteng_application.review_notes ?? ""}`}
            </p>
          )}
          {gptris === null && (
            <div className="flex flex-wrap gap-2">
              {openApplication && !openApplication.licence_submitted && (
                <Button size="sm" onClick={() => setGptris("licence")}>The licence has been issued</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setGptris("application")}>
                {openApplication ? "Correct the application" : "Record a GPTRIS application"}
              </Button>
            </div>
          )}
          {gptris === "application" && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fleet-gptris-ref">GPTRIS reference number</Label>
                  <Input id="fleet-gptris-ref" value={application.reference} onChange={(e) => setApplication({ ...application, reference: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fleet-gptris-date">Date on the receipt</Label>
                  <Input id="fleet-gptris-date" type="date" value={application.submittedOn} onChange={(e) => setApplication({ ...application, submittedOn: e.target.value })} />
                </div>
              </div>
              <DocumentUpload label="Submission receipt" bucket={KYC_BUCKET} folder={`${folder}/gptris-receipt`} value={application.receipt} onChange={(receipt) => setApplication({ ...application, receipt })} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setGptris(null)} disabled={busy}>Cancel</Button>
                <Button
                  disabled={busy || !application.reference.trim() || !application.submittedOn || !application.receipt}
                  onClick={() => save(
                    fleetService.submitGautengApplication(vehicle.id, application.reference, application.receipt!, application.submittedOn),
                    "Application recorded", () => setGptris(null))}
                >
                  Submit for checking
                </Button>
              </div>
            </div>
          )}
          {gptris === "licence" && openApplication && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fleet-licence-number">Operating licence number</Label>
                  <Input id="fleet-licence-number" value={licence.number} onChange={(e) => setLicence({ ...licence, number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fleet-licence-expiry">Expiry date</Label>
                  <Input id="fleet-licence-expiry" type="date" value={licence.expiresOn} onChange={(e) => setLicence({ ...licence, expiresOn: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="fleet-licence-area">Approved operating area, as printed on the licence</Label>
                  <Input id="fleet-licence-area" value={licence.operatingArea} onChange={(e) => setLicence({ ...licence, operatingArea: e.target.value })} />
                </div>
              </div>
              <DocumentUpload label="Operating licence" bucket={KYC_BUCKET} folder={`${folder}/operating_licence`} value={licence.file} onChange={(file) => setLicence({ ...licence, file })} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setGptris(null)} disabled={busy}>Cancel</Button>
                <Button
                  disabled={busy || !licence.number.trim() || !licence.expiresOn || !licence.operatingArea.trim() || !licence.file}
                  onClick={() => save(
                    fleetService.submitGautengLicence(openApplication.id, { ...licence, path: licence.file! }),
                    "Licence submitted", () => setGptris(null))}
                >
                  Submit for checking
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Safety devices</h3>
          <p className="text-sm text-muted-foreground">Tell us what is fitted and when you last checked it. 1145 confirms each one.</p>
          {vehicle.devices.map((d) => (
            <p key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {SAFETY_DEVICES.find((s) => s.type === d.device_type)?.label ?? d.device_type}
                {d.serial_number ? ` (${d.serial_number})` : ""}
                {d.last_checked_on ? `, checked ${day(d.last_checked_on)}` : ""}
              </span>
              <span className="flex items-center gap-2">
                <Badge variant="outline" className={d.status === "faulty" ? DOC_STATE.expired.className : d.status === "working" ? DOC_STATE.valid.className : ""}>
                  {d.status === "not_fitted" ? "Not fitted" : d.status === "faulty" ? "Faulty" : "Working"}
                </Badge>
                {d.status !== "not_fitted" && <span className="text-muted-foreground">{d.verified ? "Confirmed by 1145" : "Not confirmed yet"}</span>}
              </span>
            </p>
          ))}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
            <div className="space-y-2">
              <Label>Device</Label>
              <Select value={device.type} onValueChange={(type) => setDevice({ ...device, type })}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{SAFETY_DEVICES.map((s) => <SelectItem key={s.type} value={s.type}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={device.status} onValueChange={(status) => setDevice({ ...device, status })}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="working">Working</SelectItem>
                  <SelectItem value="faulty">Faulty</SelectItem>
                  <SelectItem value="not_fitted">Not fitted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fleet-device-serial">Serial number (optional)</Label>
              <Input id="fleet-device-serial" className="w-40" value={device.serial} onChange={(e) => setDevice({ ...device, serial: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fleet-device-checked">Last checked</Label>
              <Input id="fleet-device-checked" type="date" value={device.checkedOn} onChange={(e) => setDevice({ ...device, checkedOn: e.target.value })} />
            </div>
            <Button disabled={busy} onClick={() => save(fleetService.setSafetyDevice(vehicle.id, device), "Safety device saved")}>Save</Button>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Maintenance</h3>
          {vehicle.maintenance.length === 0 && <p className="text-sm text-muted-foreground">Nothing scheduled.</p>}
          {vehicle.maintenance.map((m) => (
            <div key={m.id} className="flex flex-wrap items-end justify-between gap-3 rounded-lg border p-3 text-sm">
              <p>
                <span className="font-medium capitalize">{m.kind}</span>
                {m.description ? `: ${m.description}` : ""} · due {day(m.due_on)}
              </p>
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`next-${m.id}`} className="text-xs">Next due (optional)</Label>
                  <Input id={`next-${m.id}`} type="date" className="h-9 w-40" value={nextDue[m.id] ?? ""} onChange={(e) => setNextDue({ ...nextDue, [m.id]: e.target.value })} />
                </div>
                <Button size="sm" disabled={busy} onClick={() => save(fleetService.completeMaintenance(m.id, today(), nextDue[m.id] || null), "Marked as done")}>
                  Mark done
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={maintenance.kind} onValueChange={(kind) => setMaintenance({ ...maintenance, kind })}>
                <SelectTrigger className="w-36 capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>{MAINTENANCE_KINDS.map((k) => <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fleet-maint-due">Due on</Label>
              <Input id="fleet-maint-due" type="date" value={maintenance.dueOn} onChange={(e) => setMaintenance({ ...maintenance, dueOn: e.target.value })} />
            </div>
            <div className="min-w-40 flex-1 space-y-2">
              <Label htmlFor="fleet-maint-note">Note (optional)</Label>
              <Input id="fleet-maint-note" value={maintenance.description} onChange={(e) => setMaintenance({ ...maintenance, description: e.target.value })} />
            </div>
            <Button
              disabled={busy || !maintenance.dueOn}
              onClick={() => save(fleetService.logMaintenance(vehicle.id, maintenance), "Maintenance scheduled", () => setMaintenance({ kind: "service", dueOn: "", description: "" }))}
            >
              Add
            </Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
};

export default FleetVehicleDialog;
