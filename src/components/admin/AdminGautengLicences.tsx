import React, { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GAUTENG_STATES, type GautengLicenceState } from "@/services/driverVerificationService";

// These tables and functions arrive with 20261012160000_gauteng_operating_licences.sql
// and are not in the generated database types yet.
const db = supabase as any;
const KYC_BUCKET = "driver-kyc";

const day = (value: string) => format(new Date(value), "d MMM yyyy");
const today = () => format(new Date(), "yyyy-MM-dd");

interface Row {
  driver_id: string;
  driver_name: string;
  driver_status: string;
  state: GautengLicenceState;
  may_operate: boolean;
  application_id: string | null;
  gptris_reference: string | null;
  application_status: "submitted" | "receipt_verified" | "issued" | "rejected" | null;
  submitted_on: string | null;
  receipt_path: string | null;
  licence_number: string | null;
  licence_path: string | null;
  licence_expires_on: string | null;
  operating_area: string | null;
  review_notes: string | null;
  needs_review: boolean;
}

const APPLICATION_STATUS: Record<string, string> = {
  submitted: "Receipt not checked yet",
  receipt_verified: "Receipt confirmed, licence not issued",
  issued: "Licence issued",
  rejected: "Rejected",
};

const STATE_ORDER: GautengLicenceState[] = ["verified", "application_pending", "expired", "rejected", "not_applied"];

type Decision =
  | { kind: "issue"; row: Row }
  | { kind: "reject" | "send_back"; row: Row };

const AdminGautengLicences: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GautengLicenceState | "review" | "all">("all");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [until, setUntil] = useState("");
  const [basis, setBasis] = useState("");
  const [saved, setSaved] = useState<{ until: string | null; basis: string | null }>({ until: null, basis: null });

  const fail = useCallback(
    (message: string) => toast({ variant: "destructive", title: "Error", description: message }),
    [toast],
  );

  const load = useCallback(async () => {
    // Drivers' own records, then fleet vehicles' (20261012180000_fleet_operators.sql).
    const [overview, fleetVehicles, settings] = await Promise.all([
      db.rpc("gauteng_compliance_overview"),
      db.rpc("gauteng_fleet_vehicle_overview"),
      db.from("driver_verification_settings").select("gauteng_transitional_until, gauteng_transitional_basis").maybeSingle(),
    ]);
    if (overview.error) fail("Gauteng licence records could not be loaded. " + overview.error.message);
    setRows([...(overview.data ?? []), ...(fleetVehicles.data ?? [])]);
    const s = { until: settings.data?.gauteng_transitional_until ?? null, basis: settings.data?.gauteng_transitional_basis ?? null };
    setSaved(s);
    setUntil(s.until ?? "");
    setBasis(s.basis ?? "");
    setLoading(false);
  }, [fail]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: PromiseLike<{ error: { message: string } | null }>, done: string) => {
    const { error } = await action;
    if (error) {
      fail(error.message);
      return false;
    }
    toast({ title: done });
    await load();
    return true;
  };

  const review = (row: Row, decisionName: string, extra: Record<string, unknown> = {}) =>
    db.rpc("review_gauteng_application", { p_application_id: row.application_id, p_decision: decisionName, ...extra });

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from(KYC_BUCKET).createSignedUrl(path, 300);
    if (error || !data) fail("The file could not be opened.");
    else window.open(data.signedUrl, "_blank", "noopener");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const transitionalActive = !!saved.until && saved.until >= today();
  const shown = rows.filter((r) => filter === "all" || (filter === "review" ? r.needs_review : r.state === filter));
  const reviewCount = rows.filter((r) => r.needs_review).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {STATE_ORDER.map((state) => (
          <Card
            key={state}
            role="button"
            tabIndex={0}
            aria-pressed={filter === state}
            onClick={() => setFilter(filter === state ? "all" : state)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setFilter(filter === state ? "all" : state); }}
            className={filter === state ? "cursor-pointer border-foreground" : "cursor-pointer"}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{GAUTENG_STATES[state].label}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{rows.filter((r) => r.state === state).length}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="header-row">
            <div>
              <CardTitle>Gauteng operating licences</CardTitle>
              <CardDescription>
                Drivers with a GPTRIS record or a Gauteng home address, and fleet vehicles with a GPTRIS record. Check each reference against GPTRIS before
                confirming a receipt, and read the licence itself before recording it as issued.
              </CardDescription>
            </div>
            <Button variant={filter === "review" ? "default" : "outline"} onClick={() => setFilter(filter === "review" ? "all" : "review")}>
              Needs review ({reviewCount})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver or vehicle</TableHead>
                <TableHead>State</TableHead>
                <TableHead>GPTRIS application</TableHead>
                <TableHead>Licence</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No drivers to show.</TableCell>
                </TableRow>
              ) : shown.map((row) => (
                <TableRow key={row.driver_id}>
                  <TableCell className="font-medium">{row.driver_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={GAUTENG_STATES[row.state].className}>{GAUTENG_STATES[row.state].label}</Badge>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.may_operate
                        ? row.state === "verified" ? "Licensed to operate" : "May operate: transitional period"
                        : "No valid operating licence"}
                    </p>
                  </TableCell>
                  <TableCell>
                    {row.gptris_reference ? (
                      <>
                        <p>{row.gptris_reference}</p>
                        <p className="text-sm text-muted-foreground">
                          {row.submitted_on ? `Submitted ${day(row.submitted_on)} · ` : ""}
                          {APPLICATION_STATUS[row.application_status ?? ""]}
                        </p>
                        {row.review_notes && <p className="text-sm text-muted-foreground">Note: {row.review_notes}</p>}
                      </>
                    ) : <span className="text-muted-foreground">Nothing recorded</span>}
                  </TableCell>
                  <TableCell>
                    {row.licence_number ? (
                      <>
                        <p>{row.licence_number}{row.application_status !== "issued" ? " (not checked)" : ""}</p>
                        <p className="text-sm text-muted-foreground">
                          {row.licence_expires_on ? `Expires ${day(row.licence_expires_on)}` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">Area: {row.operating_area}</p>
                      </>
                    ) : <span className="text-muted-foreground">Not issued</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      {row.receipt_path && (
                        <Button size="sm" variant="outline" onClick={() => openFile(row.receipt_path!)}>
                          <ExternalLink className="mr-1 h-4 w-4" /> Receipt
                        </Button>
                      )}
                      {row.licence_path && (
                        <Button size="sm" variant="outline" onClick={() => openFile(row.licence_path!)}>
                          <ExternalLink className="mr-1 h-4 w-4" /> Licence
                        </Button>
                      )}
                      {row.application_status === "submitted" && (
                        <Button size="sm" onClick={() => act(review(row, "receipt_verified"), "Receipt confirmed")}>Confirm receipt</Button>
                      )}
                      {row.needs_review && row.licence_path && (
                        <Button size="sm" onClick={() => setDecision({ kind: "issue", row })}>Record licence</Button>
                      )}
                      {row.application_status === "receipt_verified" && row.needs_review && (
                        <Button size="sm" variant="outline" onClick={() => setDecision({ kind: "send_back", row })}>Send back</Button>
                      )}
                      {row.application_id && row.application_status !== "rejected" && (
                        <Button size="sm" variant="destructive" onClick={() => setDecision({ kind: "reject", row })}>
                          {row.application_status === "issued" ? "Licence withdrawn" : "Reject"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="header-row">
            <div>
              <CardTitle>Transitional period</CardTitle>
              <CardDescription>
                An application receipt is not a licence. Leave this empty unless a transitional rule lets operators with
                a pending application keep operating. While it runs, a driver whose receipt you have confirmed may go
                online without an issued licence, up to and including the end date.
              </CardDescription>
            </div>
            <Badge variant={transitionalActive ? "default" : "secondary"}>
              {transitionalActive ? `Running until ${day(saved.until!)}` : "Not running"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <div className="space-y-2">
              <Label htmlFor="gp-until">Last day it applies</Label>
              <Input id="gp-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gp-basis">The rule this relies on</Label>
              <Textarea
                id="gp-basis"
                rows={2}
                value={basis}
                onChange={(e) => setBasis(e.target.value)}
                placeholder="The regulation or notice, its date, and who confirmed it applies to 1145"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {saved.until && (
              <Button
                variant="outline"
                onClick={() => act(
                  db.from("driver_verification_settings").update({ gauteng_transitional_until: null, gauteng_transitional_basis: null }).eq("id", true),
                  "Transitional period ended",
                )}
              >
                End it now
              </Button>
            )}
            <Button
              disabled={!until || basis.trim().length < 10}
              onClick={() => act(
                db.from("driver_verification_settings").update({ gauteng_transitional_until: until, gauteng_transitional_basis: basis.trim() }).eq("id", true),
                "Transitional period saved",
              )}
            >
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <DecisionDialog
        decision={decision}
        onClose={() => setDecision(null)}
        onConfirm={async (values) => {
          if (!decision) return;
          const { row } = decision;
          const ok =
            decision.kind === "issue"
              ? await act(review(row, "issued", {
                  p_notes: values.notes || null, p_licence_number: values.number, p_licence_expires_on: values.expiresOn, p_operating_area: values.area,
                }), "Licence recorded")
              : decision.kind === "send_back"
                ? await act(review(row, "receipt_verified", { p_notes: values.notes }), "Sent back to the driver")
                : await act(review(row, "rejected", { p_notes: values.notes }), "Application rejected");
          if (ok) setDecision(null);
        }}
      />
    </div>
  );
};

interface DecisionValues {
  notes: string;
  number: string;
  expiresOn: string;
  area: string;
}

const DecisionDialog: React.FC<{
  decision: Decision | null;
  onClose: () => void;
  onConfirm: (values: DecisionValues) => Promise<void>;
}> = ({ decision, onClose, onConfirm }) => {
  const [values, setValues] = useState<DecisionValues>({ notes: "", number: "", expiresOn: "", area: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValues({
      notes: "",
      number: decision?.row.licence_number ?? "",
      expiresOn: decision?.row.licence_expires_on ?? "",
      area: decision?.row.operating_area ?? "",
    });
  }, [decision]);

  const set = (key: keyof DecisionValues, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const issuing = decision?.kind === "issue";
  const withdrawn = decision?.kind === "reject" && decision.row.application_status === "issued";
  const ready = issuing ? values.number.trim() && values.expiresOn && values.area.trim() : values.notes.trim();

  return (
    <Dialog open={!!decision} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {issuing ? "Record the issued licence" : decision?.kind === "send_back" ? "Send the licence details back" : withdrawn ? "Licence withdrawn" : "Reject this application"}
          </DialogTitle>
          <DialogDescription>
            {issuing
              ? "Copy these from the licence itself, not from the receipt. The driver is suspended automatically the day after the expiry date."
              : decision?.kind === "send_back"
                ? "The application stays pending. Tell the driver what to fix."
                : withdrawn
                  ? "The licence stops counting straight away. The driver is told why."
                  : "Use this when the regulator refused the application or the record is not genuine. The driver is told why."}
          </DialogDescription>
        </DialogHeader>

        {issuing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issue-number">Licence number</Label>
              <Input id="issue-number" value={values.number} onChange={(e) => set("number", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue-expiry">Expiry date</Label>
              <Input id="issue-expiry" type="date" value={values.expiresOn} onChange={(e) => set("expiresOn", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="issue-area">Approved operating area</Label>
              <Input id="issue-area" value={values.area} onChange={(e) => set("area", e.target.value)} />
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="decision-notes">{issuing ? "Notes (optional)" : "Reason"}</Label>
          <Textarea id="decision-notes" rows={3} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant={decision?.kind === "reject" ? "destructive" : "default"}
            disabled={busy || !ready}
            onClick={async () => {
              setBusy(true);
              await onConfirm({ ...values, notes: values.notes.trim(), number: values.number.trim(), area: values.area.trim() });
              setBusy(false);
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminGautengLicences;
