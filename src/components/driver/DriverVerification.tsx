import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Car, FileCheck, Landmark, Loader2, Shield, Smartphone, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import DocumentUpload from "@/components/onboarding/DocumentUpload";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  DRIVER_DOCUMENTS,
  GAUTENG_STATES,
  driverVerification,
  type DriverDocType,
  type DriverVerificationStatus,
  type GautengLicenceStatus,
} from "@/services/driverVerificationService";

interface DriverVerificationProps {
  driver: {
    id: string;
    status: string;
    vehicle_registration: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vehicle_year: number | null;
    vehicle_color: string | null;
  } | null;
  /** Called when something here may have changed the driver's status. */
  onChange: () => void;
}

import { fleetService, type DriverFleetStatus } from "@/services/fleetService";

const KYC_BUCKET = "driver-kyc";

const day = (value: string) => format(new Date(value), "d MMM yyyy");

const ACCOUNT_STATES: Record<string, { label: string; tone: "ok" | "wait" | "stop"; text: string }> = {
  pending: { label: "Awaiting approval", tone: "wait", text: "Your application is being reviewed. You can add your documents and vehicle now so they are ready." },
  documents_expired: { label: "Suspended", tone: "stop", text: "A document has expired. Upload the renewed document below and you will be reinstated once it is approved." },
  investigation: { label: "On hold", tone: "stop", text: "Your account is on hold while we review it. You cannot go online or cash out until the review is finished. Contact support if you have information to add." },
  investigation_confirmed: { label: "Closed", tone: "stop", text: "Your driver account has been closed following a review. Contact support if you want to appeal." },
  suspended: { label: "Suspended", tone: "stop", text: "Your driver account is suspended. Contact support for help." },
  active: { label: "Active", tone: "ok", text: "Your account is in good standing." },
};

const TONE_CLASS = {
  ok: "bg-green-600 text-white border-0",
  wait: "bg-blue-600 text-white border-0",
  stop: "bg-destructive text-destructive-foreground border-0",
};

const DOC_STATES: Record<string, { label: string; className: string }> = {
  valid: { label: "Valid", className: "bg-green-600 text-white border-0" },
  expired: { label: "Expired", className: "bg-destructive text-destructive-foreground border-0" },
  pending: { label: "Being reviewed", className: "bg-blue-600 text-white border-0" },
  missing: { label: "Not uploaded", className: "" },
  transitional: { label: "Application pending", className: "bg-blue-600 text-white border-0" },
};

const DriverVerification: React.FC<DriverVerificationProps> = ({ driver, onChange }) => {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["driver-verification", driver?.id],
    queryFn: () => driverVerification.status(),
    enabled: !!driver,
  });
  const gauteng = useQuery({
    queryKey: ["driver-gauteng-licence", driver?.id],
    queryFn: () => driverVerification.gautengStatus(),
    enabled: !!driver,
  });
  // A driver with a GPTRIS record files their operating licence through it.
  const viaGptris = !!gauteng.data && gauteng.data.state !== "not_applied";
  const fleet = useQuery({
    queryKey: ["driver-fleet", driver?.id],
    queryFn: () => fleetService.driverStatus(),
    enabled: !!driver,
  });
  // On a fleet shift, the vehicle's documents are the fleet's to file.
  const onFleetVehicle = !!fleet.data?.on_fleet_vehicle;

  if (!driver || isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading verification status...</p>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data || !user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p role="alert" className="text-center text-muted-foreground">
            We couldn't load your verification status. Please try again in a moment.
          </p>
        </CardContent>
      </Card>
    );
  }

  const account =
    ACCOUNT_STATES[data.status === "suspended" ? data.suspension_reason ?? "suspended" : data.status] ??
    (data.status === "suspended" ? ACCOUNT_STATES.suspended : ACCOUNT_STATES.active);
  const refresh = () => {
    void refetch();
    void gauteng.refetch();
    void fleet.refetch();
    onChange();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="header-row">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Driver account
            </CardTitle>
            <Badge className={TONE_CLASS[account.tone]}>{account.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className={account.tone === "stop" ? "flex items-start gap-2 text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {account.tone === "stop" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            {account.text}
          </p>
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium">Identity checks</p>
              <p className="text-muted-foreground">
                You take a selfie each time you go online, and we ask for another at random while you are online. Only
                you may drive on this account.
              </p>
              <p className="mt-2 text-muted-foreground">
                {data.device
                  ? `Your account is linked to this device since ${day(data.device.first_seen_at)}. Going online from a different phone is flagged for review.`
                  : "Your account will be linked to the device you first go online from."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Documents
          </CardTitle>
          <CardDescription>
            {data.compliance_enforced
              ? "All four must be approved and in date before you can go online. If one expires, your account is suspended until the renewal is approved."
              : "Keep these in date. If one expires, your account is suspended until the renewal is approved."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DRIVER_DOCUMENTS.map((doc) => (
            <DocumentRow
              key={doc.type}
              doc={doc}
              state={data.documents.find((d) => d.doc_type === doc.type)}
              userId={user.id}
              onSubmitted={refresh}
              managedNote={
                doc.type !== "prdp" && onFleetVehicle ? "Filed by your fleet for the vehicle you are driving."
                  : doc.type === "operating_licence" && viaGptris ? "Recorded through your GPTRIS application below."
                  : undefined
              }
            />
          ))}
        </CardContent>
      </Card>

      {fleet.data && fleet.data.memberships.length > 0 && <FleetCard status={fleet.data} driverId={driver.id} onChanged={refresh} />}

      {gauteng.data && !onFleetVehicle && <GautengLicenceCard status={gauteng.data} userId={user.id} onSubmitted={refresh} />}

      <VehicleCard driver={driver} vehicle={data.vehicle} required={data.compliance_enforced} userId={user.id} onSubmitted={refresh} />
    </div>
  );
};

const shiftTime = (value: string) => format(new Date(value), "EEE d MMM, HH:mm");

/** The driver's fleets: invitations to answer, and the shifts they have been given. */
const FleetCard: React.FC<{ status: DriverFleetStatus; driverId: string; onChanged: () => void }> = ({ status, driverId, onChanged }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (action: Promise<{ ok: boolean; message?: string }>, done: string) => {
    setBusy(true);
    const result = await action;
    setBusy(false);
    if (result.ok) toast({ title: done });
    else toast({ variant: "destructive", title: "Not saved", description: result.message });
    onChanged();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Fleets
        </CardTitle>
        <CardDescription>
          A fleet gives you shifts in its vehicles. During a shift you go online in that vehicle, and the fleet looks after
          its licence, roadworthy and insurance. Your PrDP and identity checks stay yours.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.memberships.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
            <div>
              <p className="font-medium">{m.fleet_name}</p>
              <p className="text-sm text-muted-foreground">{m.status === "invited" ? "Has invited you to drive its vehicles." : "You drive for this fleet."}</p>
            </div>
            {m.status === "invited" ? (
              <div className="flex gap-2">
                <Button variant="outline" disabled={busy} onClick={() => run(fleetService.respondToInvite(m.id, false), "Invitation declined")}>Decline</Button>
                <Button disabled={busy} onClick={() => run(fleetService.respondToInvite(m.id, true), `You have joined ${m.fleet_name}`)}>Accept</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => run(fleetService.endDriver(m.fleet_id, driverId), `You have left ${m.fleet_name}`)}>
                Leave fleet
              </Button>
            )}
          </div>
        ))}

        {status.shifts.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Your shifts</p>
            {status.shifts.map((s) => (
              <div key={s.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {s.license_plate} · {s.vehicle}
                  {s.current && <Badge className="ml-2 bg-green-600 text-white border-0">Now</Badge>}
                </p>
                <p className="text-muted-foreground">
                  {s.fleet_name} · {shiftTime(s.starts_at)} to {s.ends_at ? shiftTime(s.ends_at) : "further notice"}
                </p>
                {!s.vehicle_ready && <p className="text-muted-foreground">This vehicle has not been approved by 1145 yet, so the shift does not count.</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface GautengLicenceCardProps {
  status: GautengLicenceStatus;
  userId: string;
  onSubmitted: () => void;
}

const GautengLicenceCard: React.FC<GautengLicenceCardProps> = ({ status, userId, onSubmitted }) => {
  const { toast } = useToast();
  const [form, setForm] = useState<"application" | "licence" | null>(null);
  const [saving, setSaving] = useState(false);
  const [reference, setReference] = useState("");
  const [submittedOn, setSubmittedOn] = useState("");
  const [receipt, setReceipt] = useState<string>();
  const [licence, setLicence] = useState({ number: "", expiresOn: "", operatingArea: "" });
  const [licenceFile, setLicenceFile] = useState<string>();

  const { state, application, licence: issued } = status;
  const badge = GAUTENG_STATES[state];
  const open = application && application.status !== "rejected" ? application : null;

  const finish = (result: { ok: boolean; message?: string }, done: string) => {
    setSaving(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Not submitted", description: result.message });
      return;
    }
    toast({ title: done, description: "We'll let you know once it has been checked." });
    setForm(null);
    onSubmitted();
  };

  const submitApplication = async () => {
    if (!reference.trim() || !submittedOn || !receipt) {
      toast({ variant: "destructive", title: "Almost there", description: "Add the reference number, the date and the receipt." });
      return;
    }
    setSaving(true);
    finish(await driverVerification.submitGautengApplication(reference, receipt, submittedOn), "Application recorded");
  };

  const submitLicence = async () => {
    if (!open || !licence.number.trim() || !licence.expiresOn || !licence.operatingArea.trim() || !licenceFile) {
      toast({ variant: "destructive", title: "Almost there", description: "Add the licence number, expiry date, operating area and the licence itself." });
      return;
    }
    setSaving(true);
    finish(await driverVerification.submitGautengLicence(open.id, { ...licence, path: licenceFile }), "Licence submitted");
  };

  return (
    <Card>
      <CardHeader>
        <div className="header-row">
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Gauteng operating licence (GPTRIS)
          </CardTitle>
          <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
        </div>
        <CardDescription>
          For drivers who operate in Gauteng. Record your GPTRIS application here, then the licence once it is issued.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {issued && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Licence {issued.licence_number}</p>
            <p className="text-muted-foreground">
              {state === "expired" ? "Expired" : "Valid until"} {day(issued.licence_expires_on)} · Approved area: {issued.operating_area}
            </p>
          </div>
        )}

        {application && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Application {application.gptris_reference}</p>
            <p className="text-muted-foreground">
              Submitted to GPTRIS on {day(application.submitted_on)} ·{" "}
              {application.status === "submitted" && "we are checking your receipt"}
              {application.status === "receipt_verified" && (application.licence_submitted ? "we are checking your licence" : "receipt confirmed, waiting for the licence")}
              {application.status === "rejected" && "not accepted"}
            </p>
            {application.review_notes && application.status !== "submitted" && (
              <p className={application.status === "rejected" ? "text-destructive" : "text-muted-foreground"}>{application.review_notes}</p>
            )}
          </div>
        )}

        {state === "application_pending" && (
          <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {status.may_operate && status.transitional_until
              ? `A receipt is not a licence. You may drive on a confirmed receipt only until ${day(status.transitional_until)}, so add your licence as soon as it is issued.`
              : "A receipt is not a licence. Your application does not count as an operating licence until the licence is issued and we have checked it."}
          </p>
        )}
        {state === "expired" && (
          <p className="text-sm text-destructive">Your operating licence has expired. Record your renewal application, then the renewed licence.</p>
        )}

        {form === null && (
          <div className="flex flex-wrap gap-2">
            {open && !open.licence_submitted && <Button onClick={() => setForm("licence")}>My licence has been issued</Button>}
            <Button variant="outline" onClick={() => setForm("application")}>
              {state === "not_applied" ? "Record my GPTRIS application" : open ? "Correct my application" : "Record a new application"}
            </Button>
          </div>
        )}

        {form === "application" && (
          <div className="space-y-4 border-t pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gptris-ref">GPTRIS reference number</Label>
                <Input id="gptris-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gptris-date">Date on the receipt</Label>
                <Input id="gptris-date" type="date" value={submittedOn} onChange={(e) => setSubmittedOn(e.target.value)} />
              </div>
            </div>
            <DocumentUpload label="Submission receipt" bucket={KYC_BUCKET} folder={`${userId}/gptris-receipt`} value={receipt} onChange={setReceipt} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
              <Button onClick={submitApplication} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit for checking
              </Button>
            </div>
          </div>
        )}

        {form === "licence" && (
          <div className="space-y-4 border-t pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gp-licence-number">Operating licence number</Label>
                <Input id="gp-licence-number" value={licence.number} onChange={(e) => setLicence((l) => ({ ...l, number: e.target.value }))} maxLength={60} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gp-licence-expiry">Expiry date</Label>
                <Input id="gp-licence-expiry" type="date" value={licence.expiresOn} onChange={(e) => setLicence((l) => ({ ...l, expiresOn: e.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="gp-licence-area">Approved operating area, as printed on the licence</Label>
                <Input id="gp-licence-area" value={licence.operatingArea} onChange={(e) => setLicence((l) => ({ ...l, operatingArea: e.target.value }))} maxLength={200} />
              </div>
            </div>
            <DocumentUpload label="Operating licence" bucket={KYC_BUCKET} folder={`${userId}/operating_licence`} value={licenceFile} onChange={setLicenceFile} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
              <Button onClick={submitLicence} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit for checking
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface DocumentRowProps {
  doc: (typeof DRIVER_DOCUMENTS)[number];
  state: DriverVerificationStatus["documents"][number] | undefined;
  userId: string;
  onSubmitted: () => void;
  /** Set when this document is filed somewhere else on the page, so it is not uploaded here. */
  managedNote?: string;
}

const DocumentRow: React.FC<DocumentRowProps> = ({ doc, state, userId, onSubmitted, managedNote }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<string>();
  const [expiresOn, setExpiresOn] = useState("");
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const status = DOC_STATES[state?.state ?? "missing"];
  const latest = state?.latest;
  // A renewal sent in while the current document is still valid (or has expired).
  const renewalPending = latest?.status === "pending" && state?.state !== "pending";

  const submit = async () => {
    if (!file || !expiresOn) {
      toast({ variant: "destructive", title: "Almost there", description: "Add the file and its expiry date." });
      return;
    }
    setSaving(true);
    const result = await driverVerification.submitDocument(doc.type as DriverDocType, file, expiresOn, number);
    setSaving(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Not submitted", description: result.message });
      return;
    }
    toast({ title: "Document submitted", description: "We'll let you know once it has been reviewed." });
    setOpen(false);
    setFile(undefined);
    setExpiresOn("");
    setNumber("");
    onSubmitted();
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{doc.label}</p>
          <p className="text-sm text-muted-foreground">
            {state?.expires_on
              ? `${state.state === "expired" ? "Expired" : "Valid until"} ${day(state.expires_on)}`
              : doc.hint}
          </p>
          {managedNote && <p className="mt-1 text-sm text-muted-foreground">{managedNote}</p>}
          {renewalPending && <p className="mt-1 text-sm text-muted-foreground">Your renewal is being reviewed.</p>}
          {latest?.status === "rejected" && (
            <p className="mt-1 text-sm text-destructive">Last upload not accepted: {latest.review_notes}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={status.className}>{status.label}</Badge>
          {!open && !managedNote && (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              {state?.state === "missing" ? "Upload" : state?.state === "pending" ? "Replace" : "Renew"}
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-4 border-t pt-4">
          <DocumentUpload label={doc.label} bucket={KYC_BUCKET} folder={`${userId}/${doc.type}`} value={file} onChange={setFile} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${doc.type}-expiry`}>Expiry date</Label>
              <Input id={`${doc.type}-expiry`} type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${doc.type}-number`}>Document number (optional)</Label>
              <Input id={`${doc.type}-number`} value={number} onChange={(e) => setNumber(e.target.value)} maxLength={60} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit for review
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

interface VehicleCardProps {
  driver: NonNullable<DriverVerificationProps["driver"]>;
  vehicle: DriverVerificationStatus["vehicle"];
  required: boolean;
  userId: string;
  onSubmitted: () => void;
}

const VEHICLE_STATES: Record<string, { label: string; className: string }> = {
  approved: { label: "Verified", className: "bg-green-600 text-white border-0" },
  pending: { label: "Being reviewed", className: "bg-blue-600 text-white border-0" },
  rejected: { label: "Not accepted", className: "bg-destructive text-destructive-foreground border-0" },
};

const VehicleCard: React.FC<VehicleCardProps> = ({ driver, vehicle, required, userId, onSubmitted }) => {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    licensePlate: driver.vehicle_registration ?? "",
    make: driver.vehicle_make ?? "",
    model: driver.vehicle_model ?? "",
    year: driver.vehicle_year ? String(driver.vehicle_year) : "",
    color: driver.vehicle_color ?? "",
    ownerIsSelf: true,
    ownerType: "individual" as "individual" | "company",
    ownerName: "",
    ownerIdNumber: "",
    ownerPhone: "",
  });
  const [authorisation, setAuthorisation] = useState<string>();
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setSaving(true);
    const result = await driverVerification.declareVehicle({
      ...form,
      year: parseInt(form.year, 10),
      authorisationDocPath: authorisation,
    });
    setSaving(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Not submitted", description: result.message });
      return;
    }
    toast({ title: "Vehicle submitted", description: "We'll let you know once it has been verified." });
    setEditing(false);
    onSubmitted();
  };

  const state = vehicle ? VEHICLE_STATES[vehicle.status] : null;
  const company = !form.ownerIsSelf && form.ownerType === "company";

  return (
    <Card>
      <CardHeader>
        <div className="header-row">
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Vehicle and owner
          </CardTitle>
          {state && <Badge className={state.className}>{state.label}</Badge>}
        </div>
        <CardDescription>
          We keep the vehicle's owner on record separately from its driver.
          {required ? " Your vehicle must be verified before you can go online." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {vehicle && !editing && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">
              {vehicle.year} {vehicle.make} {vehicle.model}, {vehicle.color} · {vehicle.license_plate}
            </p>
            <p className="text-muted-foreground">
              {vehicle.relationship === "owner_driver"
                ? `You are the owner (${vehicle.owner_name}).`
                : `Owned by ${vehicle.owner_name}; you drive it with the owner's permission.`}
            </p>
            {vehicle.status === "rejected" && <p className="text-destructive">Not accepted: {vehicle.review_notes}</p>}
          </div>
        )}

        {!editing ? (
          <Button variant="outline" onClick={() => setEditing(true)}>
            {vehicle ? "Change vehicle or owner" : "Add your vehicle"}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="veh-plate">Number plate</Label>
                <Input id="veh-plate" value={form.licensePlate} onChange={(e) => set("licensePlate", e.target.value)} maxLength={20} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="veh-year">Year</Label>
                <Input id="veh-year" inputMode="numeric" value={form.year} onChange={(e) => set("year", e.target.value)} maxLength={4} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="veh-make">Make</Label>
                <Input id="veh-make" value={form.make} onChange={(e) => set("make", e.target.value)} maxLength={40} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="veh-model">Model</Label>
                <Input id="veh-model" value={form.model} onChange={(e) => set("model", e.target.value)} maxLength={40} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="veh-color">Colour</Label>
                <Input id="veh-color" value={form.color} onChange={(e) => set("color", e.target.value)} maxLength={30} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Who owns this vehicle?</Label>
              <RadioGroup
                value={form.ownerIsSelf ? "self" : "other"}
                onValueChange={(v) => set("ownerIsSelf", v === "self")}
                className="flex flex-wrap gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="self" id="owner-self" />
                  <Label htmlFor="owner-self" className="font-normal">I do</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="other" id="owner-other" />
                  <Label htmlFor="owner-other" className="font-normal">Someone else, or a company</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {!form.ownerIsSelf && (
                <div className="space-y-2">
                  <Label>Owner type</Label>
                  <Select value={form.ownerType} onValueChange={(v) => set("ownerType", v as "individual" | "company")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">A person</SelectItem>
                      <SelectItem value="company">A company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="owner-name">{form.ownerIsSelf ? "Your full legal name" : company ? "Registered company name" : "Owner's full legal name"}</Label>
                <Input id="owner-name" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-id">{form.ownerIsSelf ? "Your ID number" : company ? "Company registration number" : "Owner's ID number"}</Label>
                <Input id="owner-id" value={form.ownerIdNumber} onChange={(e) => set("ownerIdNumber", e.target.value)} maxLength={30} />
              </div>
              {!form.ownerIsSelf && (
                <div className="space-y-2">
                  <Label htmlFor="owner-phone">Owner's phone number</Label>
                  <Input id="owner-phone" type="tel" value={form.ownerPhone} onChange={(e) => set("ownerPhone", e.target.value)} maxLength={20} />
                </div>
              )}
            </div>

            {!form.ownerIsSelf && (
              <DocumentUpload
                label="Owner's signed permission for you to drive this vehicle"
                bucket={KYC_BUCKET}
                folder={`${userId}/owner-permission`}
                value={authorisation}
                onChange={setAuthorisation}
              />
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              <Button onClick={submit} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit for verification
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DriverVerification;
