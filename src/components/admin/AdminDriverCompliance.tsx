import React, { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ExternalLink, Loader2, Lock, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DRIVER_DOCUMENTS } from "@/services/driverVerificationService";
import AdminGautengLicences from "./AdminGautengLicences";
import AdminFleets from "./AdminFleets";

// These tables and functions arrive with 20261012150000_driver_continuous_verification.sql
// and are not in the generated database types yet.
const db = supabase as any;
const KYC_BUCKET = "driver-kyc";

const when = (value: string) => format(new Date(value), "d MMM yyyy, HH:mm");
const docLabel = (type: string) => DRIVER_DOCUMENTS.find((d) => d.type === type)?.label ?? type;

const ALERT_LABELS: Record<string, string> = {
  new_device: "Went online from a new device",
  device_change_limit: "Changed devices again within 30 days",
  shared_device: "Tried a device bound to another driver",
  revoked_device: "Tried a blocked device",
  sim_changed: "SIM card changed",
  concurrent_session: "Tried to go online on a second device",
  vehicle_in_use: "Vehicle already online with another driver",
  identity_check_missed: "Did not answer a selfie request",
  identity_check_failed: "Selfie did not match",
};

const EVENT_LABELS: Record<string, string> = {
  opened: "Opened",
  frozen: "Account frozen",
  note: "Note",
  alert_linked: "Alert attached",
  cleared: "Cleared",
  confirmed: "Confirmed",
  reinstated: "Driver reinstated",
};

const SEVERITY_CLASS: Record<string, string> = {
  high: "bg-destructive text-destructive-foreground border-0",
  medium: "bg-gold/20 text-foreground border-0",
  low: "",
};

interface Settings {
  compliance_enforced: boolean;
  check_response_minutes: number;
  random_check_min_minutes: number;
  random_check_max_minutes: number;
}

interface Prompt {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  notesRequired?: boolean;
  /** Offers the "freeze the account" switch. */
  freezeOption?: boolean;
  run: (notes: string, freeze: boolean) => PromiseLike<{ error: { message: string } | null }>;
}

async function openFile(path: string, onError: (message: string) => void) {
  const { data, error } = await supabase.storage.from(KYC_BUCKET).createSignedUrl(path, 300);
  if (error || !data) onError("The file could not be opened.");
  else window.open(data.signedUrl, "_blank", "noopener");
}

const AdminDriverCompliance: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [vehicleModes, setVehicleModes] = useState<Record<string, string>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [expiry, setExpiry] = useState<Record<string, string>>({});
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [investigation, setInvestigation] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const fail = useCallback(
    (message: string) => toast({ variant: "destructive", title: "Error", description: message }),
    [toast],
  );

  const load = useCallback(async () => {
    const [c, d, a, al, dev, inv, drv, s] = await Promise.all([
      db.from("driver_identity_checks").select("*, drivers(name, user_id)").eq("status", "submitted").order("submitted_at").limit(100),
      db.from("driver_documents").select("*, drivers(name), vehicles(license_plate)").eq("status", "pending").order("created_at").limit(100),
      db.from("vehicle_driver_assignments")
        .select("*, drivers(name, vehicle_type), vehicles(license_plate, make, model, year, color, owner_id, transport_mode), vehicle_owners(legal_name, owner_type, id_number, phone, verified_at)")
        .eq("status", "pending").order("created_at").limit(100),
      db.from("driver_security_alerts").select("*, drivers(name)").eq("status", "open").order("created_at", { ascending: false }).limit(100),
      db.from("driver_devices").select("*, drivers(name)").eq("status", "pending_approval").order("first_seen_at"),
      db.from("driver_investigations").select("*, drivers(name, status)").order("opened_at", { ascending: false }).limit(100),
      supabase.from("drivers").select("id, name").order("name"),
      db.from("driver_verification_settings").select("*").maybeSingle(),
    ]);
    const error = [c, d, a, al, dev, inv, drv, s].find((r) => r.error)?.error;
    if (error) fail("Driver verification data could not be loaded. " + error.message);
    setChecks(c.data ?? []);
    setDocuments(d.data ?? []);
    setAssignments(a.data ?? []);
    setAlerts(al.data ?? []);
    setDevices(dev.data ?? []);
    setInvestigations(inv.data ?? []);
    setDrivers(drv.data ?? []);
    setSettings(s.data ?? null);
    setLoading(false);
  }, [fail]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs an admin action, reports a failure, and reloads the queues. */
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

  const saveSettings = (patch: Partial<Settings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...patch });
    void act(db.from("driver_verification_settings").update(patch).eq("id", true), "Settings saved");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const openInvestigations = investigations.filter((i) => i.status === "open");
  const empty = (cols: number, text: string) => (
    <TableRow>
      <TableCell colSpan={cols} className="text-center py-8 text-muted-foreground">{text}</TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="checks">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="checks">Selfie checks ({checks.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles ({assignments.length})</TabsTrigger>
          <TabsTrigger value="alerts">Alerts ({alerts.length + devices.length})</TabsTrigger>
          <TabsTrigger value="investigations">Investigations ({openInvestigations.length})</TabsTrigger>
          <TabsTrigger value="gauteng">Gauteng licences</TabsTrigger>
          <TabsTrigger value="fleets">Fleets</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="checks">
          <Card>
            <CardHeader>
              <CardTitle>Selfies waiting for review</CardTitle>
              <CardDescription>
                Compare each selfie with the driver's registration photo. Drivers stay online while a selfie waits here,
                so work through the oldest first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>Taken</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checks.length === 0 ? empty(4, "No selfies are waiting.") : checks.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.drivers?.name}</TableCell>
                      <TableCell>{c.trigger === "random" ? "During a shift" : "Going online"}</TableCell>
                      <TableCell>{when(c.submitted_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => setReviewing(c)}>Review</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents waiting for review</CardTitle>
              <CardDescription>
                Check the expiry date against the document before approving: the driver is suspended automatically the
                day after it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver or vehicle</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Expiry date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 ? empty(4, "No documents are waiting.") : documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        {doc.drivers?.name ?? `${doc.vehicles?.license_plate ?? "Vehicle"} (fleet vehicle)`}
                      </TableCell>
                      <TableCell>
                        <p>{docLabel(doc.doc_type)}</p>
                        {doc.document_number && <p className="text-sm text-muted-foreground">No. {doc.document_number}</p>}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          aria-label="Expiry date"
                          className="w-40"
                          value={expiry[doc.id] ?? doc.expires_on}
                          onChange={(e) => setExpiry((x) => ({ ...x, [doc.id]: e.target.value }))}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openFile(doc.file_path, fail)}>
                            <ExternalLink className="mr-1 h-4 w-4" /> View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => act(db.rpc("review_driver_document", {
                              p_document_id: doc.id, p_approve: true, p_expires_on: expiry[doc.id] ?? doc.expires_on,
                            }), "Document approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setPrompt({
                              title: "Reject this document?",
                              description: "The driver is told why, so they can upload the right one.",
                              confirmLabel: "Reject document",
                              destructive: true,
                              notesRequired: true,
                              run: (notes) => db.rpc("review_driver_document", { p_document_id: doc.id, p_approve: false, p_notes: notes }),
                            })}
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles">
          <Card>
            <CardHeader>
              <CardTitle>Vehicles and owners waiting for verification</CardTitle>
              <CardDescription>
                Confirm the owner against the vehicle's registration papers. For a driver who is not the owner, read the
                owner's signed permission.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.length === 0 ? empty(4, "No vehicles are waiting.") : assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.drivers?.name}</TableCell>
                      <TableCell>
                        <p>{a.vehicles?.license_plate}</p>
                        <p className="text-sm text-muted-foreground">
                          {a.vehicles?.year} {a.vehicles?.make} {a.vehicles?.model}, {a.vehicles?.color}
                        </p>
                        <Label htmlFor={`vehicle-mode-${a.id}`}>Confirm physical vehicle type</Label>
                        <select id={`vehicle-mode-${a.id}`} className="mt-1 block w-full rounded-md border bg-background p-2" value={vehicleModes[a.id] ?? a.vehicles?.transport_mode ?? ""} onChange={e => setVehicleModes(current => ({ ...current, [a.id]: e.target.value }))}>
                          <option value="">Select vehicle type</option>
                          {["car", "van", "scooter", "motorcycle", "bicycle", "truck"].map(mode => <option key={mode} value={mode}>{mode}</option>)}
                        </select>
                        <p className="text-xs text-muted-foreground">Scooters cannot carry passengers. Verify against the vehicle papers.</p>
                      </TableCell>
                      <TableCell>
                        <p>{a.vehicle_owners?.legal_name} ({a.vehicle_owners?.owner_type === "company" ? "company" : "person"})</p>
                        <p className="text-sm text-muted-foreground">
                          {a.vehicle_owners?.id_number}{a.vehicle_owners?.phone ? ` · ${a.vehicle_owners.phone}` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {a.relationship === "owner_driver" ? "Driver says they are the owner" : "Driver is not the owner"}
                          {a.vehicle_owners?.verified_at ? " · owner already verified" : ""}
                        </p>
                        {a.vehicles?.owner_id && a.vehicles.owner_id !== a.owner_id && (
                          <p className="text-sm text-destructive">This vehicle is on record under a different owner.</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {a.authorisation_doc_path && (
                            <Button size="sm" variant="outline" onClick={() => openFile(a.authorisation_doc_path, fail)}>
                              <ExternalLink className="mr-1 h-4 w-4" /> Permission
                            </Button>
                          )}
                          <Button size="sm" disabled={!(vehicleModes[a.id] ?? a.vehicles?.transport_mode)} onClick={() => act(db.rpc("review_vehicle_assignment_services", { p_assignment_id: a.id, p_approve: true, p_mode: vehicleModes[a.id] ?? a.vehicles?.transport_mode }), "Vehicle verified")}>
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setPrompt({
                              title: "Reject this vehicle?",
                              description: "The driver is told why.",
                              confirmLabel: "Reject vehicle",
                              destructive: true,
                              notesRequired: true,
                              run: (notes) => db.rpc("review_vehicle_assignment", { p_assignment_id: a.id, p_approve: false, p_notes: notes }),
                            })}
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          {devices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Devices waiting for approval</CardTitle>
                <CardDescription>
                  These drivers changed device more often than allowed and cannot go online until you decide.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {devices.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.drivers?.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.platform} · {d.label}</TableCell>
                        <TableCell>{when(d.first_seen_at)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => act(db.rpc("set_driver_device_status", { p_device_row_id: d.id, p_status: "active" }), "Device approved")}>
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => act(db.rpc("set_driver_device_status", { p_device_row_id: d.id, p_status: "revoked" }), "Device blocked")}>
                              Block
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Open alerts</CardTitle>
              <CardDescription>Signs that an account may be shared. Dismiss an alert with a note, or investigate it.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>What happened</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.length === 0 ? empty(4, "No open alerts.") : alerts.map((al) => (
                    <TableRow key={al.id}>
                      <TableCell className="font-medium">{al.drivers?.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={SEVERITY_CLASS[al.severity]}>{al.severity}</Badge>
                          {ALERT_LABELS[al.alert_type] ?? al.alert_type}
                        </div>
                        {al.details?.label && <p className="text-sm text-muted-foreground">{al.details.label}</p>}
                        {al.details?.other_driver_id && (
                          <p className="text-sm text-muted-foreground">
                            Device belongs to {drivers.find((d) => d.id === al.details.other_driver_id)?.name ?? "another driver"}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{when(al.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPrompt({
                              title: "Dismiss this alert?",
                              description: "Say what you checked, for the record.",
                              confirmLabel: "Dismiss alert",
                              notesRequired: true,
                              run: (notes) => db.rpc("resolve_driver_alert", { p_alert_id: al.id, p_notes: notes }),
                            })}
                          >
                            Dismiss
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setPrompt({
                              title: `Investigate ${al.drivers?.name ?? "this driver"}?`,
                              description: "Opens an investigation with this alert attached. Describe what you are looking into.",
                              confirmLabel: "Open investigation",
                              notesRequired: true,
                              freezeOption: true,
                              run: (notes, freeze) => db.rpc("open_driver_investigation", {
                                p_driver_id: al.driver_id, p_category: "profile_sharing", p_summary: notes, p_freeze: freeze, p_alert_id: al.id,
                              }),
                            })}
                          >
                            Investigate
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investigations">
          <Card>
            <CardHeader>
              <div className="header-row">
                <div>
                  <CardTitle>Investigations</CardTitle>
                  <CardDescription>Every step is kept on the investigation's timeline.</CardDescription>
                </div>
                <Button onClick={() => setCreating(true)}>
                  <ShieldAlert className="mr-2 h-4 w-4" /> New investigation
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>About</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investigations.length === 0 ? empty(5, "No investigations yet.") : investigations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.drivers?.name}</TableCell>
                      <TableCell className="max-w-xs truncate">{inv.summary}</TableCell>
                      <TableCell>{when(inv.opened_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={inv.status === "open" ? "default" : "secondary"} className="capitalize">{inv.status}</Badge>
                          {inv.status === "open" && inv.account_frozen && <Lock className="h-4 w-4 text-destructive" aria-label="Account frozen" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setInvestigation(inv)}>Open</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gauteng">
          <AdminGautengLicences />
        </TabsContent>

        <TabsContent value="fleets">
          <AdminFleets />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Verification settings</CardTitle>
            </CardHeader>
            {settings && (
              <CardContent className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label htmlFor="enforce">Require documents and a verified vehicle to go online</Label>
                    <p className="text-sm text-muted-foreground">
                      When off, drivers are only stopped by a document that has expired. Turn this on once drivers have
                      had time to upload: anyone without all four approved documents and a verified vehicle will not be
                      able to go online.
                    </p>
                  </div>
                  <Switch id="enforce" checked={settings.compliance_enforced} onCheckedChange={(v) => saveSettings({ compliance_enforced: v })} />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {([
                    ["random_check_min_minutes", "Shortest gap between random selfies (minutes)"],
                    ["random_check_max_minutes", "Longest gap between random selfies (minutes)"],
                    ["check_response_minutes", "Time to answer a selfie request (minutes)"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key}>{label}</Label>
                      <Input
                        id={key}
                        type="number"
                        min={2}
                        defaultValue={settings[key]}
                        onBlur={(e) => {
                          const value = parseInt(e.target.value, 10);
                          if (value && value !== settings[key]) saveSettings({ [key]: value });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <NotesDialog
        prompt={prompt}
        onClose={() => setPrompt(null)}
        onConfirm={async (notes, freeze) => {
          if (prompt && (await act(prompt.run(notes, freeze), "Done"))) setPrompt(null);
        }}
      />

      <SelfieReviewDialog
        check={reviewing}
        onClose={() => setReviewing(null)}
        onDecide={async (passed, notes) => {
          const ok = await act(
            db.rpc("review_driver_identity_check", { p_check_id: reviewing.id, p_passed: passed, p_notes: notes || null }),
            passed ? "Selfie passed" : "Account frozen and investigation opened",
          );
          if (ok) setReviewing(null);
        }}
      />

      <InvestigationDialog
        investigation={investigation}
        onClose={() => setInvestigation(null)}
        onNote={(body) => act(db.rpc("add_driver_investigation_note", { p_investigation_id: investigation.id, p_body: body }), "Note added")}
        onCloseCase={async (outcome, notes) => {
          const ok = await act(
            db.rpc("close_driver_investigation", { p_investigation_id: investigation.id, p_outcome: outcome, p_notes: notes }),
            outcome === "cleared" ? "Investigation cleared" : "Investigation confirmed",
          );
          if (ok) setInvestigation(null);
          return ok;
        }}
      />

      <NewInvestigationDialog
        open={creating}
        drivers={drivers}
        onClose={() => setCreating(false)}
        onCreate={async (driverId, summary, freeze) => {
          const ok = await act(
            db.rpc("open_driver_investigation", { p_driver_id: driverId, p_category: "profile_sharing", p_summary: summary, p_freeze: freeze }),
            "Investigation opened",
          );
          if (ok) setCreating(false);
        }}
      />
    </div>
  );
};

const NotesDialog: React.FC<{
  prompt: Prompt | null;
  onClose: () => void;
  onConfirm: (notes: string, freeze: boolean) => Promise<void>;
}> = ({ prompt, onClose, onConfirm }) => {
  const [notes, setNotes] = useState("");
  const [freeze, setFreeze] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNotes("");
    setFreeze(true);
  }, [prompt]);

  return (
    <Dialog open={!!prompt} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{prompt?.title}</DialogTitle>
          <DialogDescription>{prompt?.description}</DialogDescription>
        </DialogHeader>
        <Textarea aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
        {prompt?.freezeOption && (
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="freeze">Freeze the account now</Label>
              <p className="text-sm text-muted-foreground">The driver is taken offline and cannot go online or cash out until you close the investigation.</p>
            </div>
            <Switch id="freeze" checked={freeze} onCheckedChange={setFreeze} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant={prompt?.destructive ? "destructive" : "default"}
            disabled={busy || (prompt?.notesRequired && !notes.trim())}
            onClick={async () => {
              setBusy(true);
              await onConfirm(notes.trim(), freeze);
              setBusy(false);
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {prompt?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SelfieReviewDialog: React.FC<{
  check: any | null;
  onClose: () => void;
  onDecide: (passed: boolean, notes: string) => Promise<void>;
}> = ({ check, onClose, onDecide }) => {
  const [photos, setPhotos] = useState<{ selfie?: string; enrolment?: string }>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPhotos({});
    setNotes("");
    if (!check) return;
    let cancelled = false;
    (async () => {
      const sign = async (path?: string | null) =>
        path ? (await supabase.storage.from(KYC_BUCKET).createSignedUrl(path, 600)).data?.signedUrl : undefined;
      const { data: kyc } = await supabase.from("driver_kyc").select("selfie_url").eq("user_id", check.drivers?.user_id).maybeSingle();
      const [selfie, enrolment] = await Promise.all([sign(check.selfie_path), sign(kyc?.selfie_url)]);
      if (!cancelled) setPhotos({ selfie, enrolment });
    })();
    return () => {
      cancelled = true;
    };
  }, [check]);

  const decide = async (passed: boolean) => {
    setBusy(true);
    await onDecide(passed, notes.trim());
    setBusy(false);
  };

  const photo = (title: string, src?: string) => (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="aspect-[4/3] overflow-hidden rounded-lg bg-muted">
        {src ? <img src={src} alt={title} className="h-full w-full object-cover" /> : (
          <p className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">Not available</p>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={!!check} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Is this {check?.drivers?.name}?</DialogTitle>
          <DialogDescription>
            The driver was asked to: {check?.challenge?.toLowerCase()}. A selfie without that pose may be an old photo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {photo("Registration photo", photos.enrolment)}
          {photo(check ? `Selfie, ${when(check.submitted_at)}` : "Selfie", photos.selfie)}
        </div>
        <div className="space-y-2">
          <Label htmlFor="selfie-notes">Notes (needed if it does not match)</Label>
          <Textarea id="selfie-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          <p className="text-sm text-muted-foreground">
            "Does not match" freezes the account straight away and opens an investigation.
          </p>
        </div>
        <DialogFooter>
          <Button variant="destructive" disabled={busy || !notes.trim()} onClick={() => decide(false)}>Does not match</Button>
          <Button disabled={busy} onClick={() => decide(true)}>Same person</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const InvestigationDialog: React.FC<{
  investigation: any | null;
  onClose: () => void;
  onNote: (body: string) => Promise<boolean>;
  onCloseCase: (outcome: "cleared" | "confirmed", notes: string) => Promise<boolean>;
}> = ({ investigation, onClose, onNote, onCloseCase }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<{ devices: any[]; sessions: any[]; checks: any[] }>({ devices: [], sessions: [], checks: [] });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!investigation) return;
    const { data } = await db.from("driver_investigation_events").select("*").eq("investigation_id", investigation.id).order("created_at");
    setEvents(data ?? []);
  }, [investigation]);

  useEffect(() => {
    setEvents([]);
    setEvidence({ devices: [], sessions: [], checks: [] });
    setText("");
    void loadEvents();
    if (!investigation) return;
    let cancelled = false;
    Promise.all([
      db.from("driver_devices").select("*").eq("driver_id", investigation.driver_id).order("first_seen_at", { ascending: false }),
      db.from("driver_sessions").select("*, driver_devices(label, platform)").eq("driver_id", investigation.driver_id).order("started_at", { ascending: false }).limit(10),
      db.from("driver_identity_checks").select("id, trigger, status, requested_at").eq("driver_id", investigation.driver_id).order("requested_at", { ascending: false }).limit(10),
    ]).then(([devices, sessions, checks]) => {
      if (!cancelled) setEvidence({ devices: devices.data ?? [], sessions: sessions.data ?? [], checks: checks.data ?? [] });
    });
    return () => {
      cancelled = true;
    };
  }, [investigation, loadEvents]);

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    if (await action()) {
      setText("");
      await loadEvents();
    }
    setBusy(false);
  };

  const open = investigation?.status === "open";

  return (
    <Dialog open={!!investigation} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Investigation: {investigation?.drivers?.name}</DialogTitle>
          <DialogDescription>
            {open
              ? investigation?.account_frozen ? "Open. The account is frozen." : "Open. The account is not frozen."
              : `Closed as ${investigation?.status}${investigation?.closed_at ? ` on ${when(investigation.closed_at)}` : ""}.`}
          </DialogDescription>
        </DialogHeader>

        <ol className="max-h-72 space-y-3 overflow-y-auto">
          {events.map((e) => (
            <li key={e.id} className="rounded-lg border p-3 text-sm">
              <p className="flex justify-between gap-4 font-medium">
                <span>{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                <span className="font-normal text-muted-foreground">{when(e.created_at)}{e.actor_id ? "" : " · automatic"}</span>
              </p>
              {e.body && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{e.body}</p>}
            </li>
          ))}
        </ol>

        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Devices ({evidence.devices.length}), recent sessions and selfie checks
          </summary>
          <div className="mt-3 max-h-56 space-y-3 overflow-y-auto text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Devices</p>
              {evidence.devices.length === 0 ? <p>None yet.</p> : evidence.devices.map((d) => (
                <p key={d.id}>{d.status.replace("_", " ")} · first used {when(d.first_seen_at)} · {d.platform} · {d.label}</p>
              ))}
            </div>
            <div>
              <p className="font-medium text-foreground">Sessions</p>
              {evidence.sessions.length === 0 ? <p>None yet.</p> : evidence.sessions.map((s) => (
                <p key={s.id}>
                  {when(s.started_at)} to {s.ended_at ? when(s.ended_at) : "now"}
                  {s.end_reason ? ` · ended: ${s.end_reason.replace(/_/g, " ")}` : ""} · {s.driver_devices?.platform}
                </p>
              ))}
            </div>
            <div>
              <p className="font-medium text-foreground">Selfie checks</p>
              {evidence.checks.length === 0 ? <p>None yet.</p> : evidence.checks.map((c) => (
                <p key={c.id}>{when(c.requested_at)} · {c.trigger === "random" ? "during a shift" : "going online"} · {c.status}</p>
              ))}
            </div>
          </div>
        </details>

        {open && (
          <>
            <div className="space-y-2">
              <Label htmlFor="inv-text">Note, or the reason for your decision</Label>
              <Textarea id="inv-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" disabled={busy || !text.trim()} onClick={() => run(() => onNote(text.trim()))}>Add note</Button>
              <div className="flex gap-2">
                <Button disabled={busy || !text.trim()} onClick={() => run(() => onCloseCase("cleared", text.trim()))}>
                  Clear and reinstate
                </Button>
                <Button variant="destructive" disabled={busy || !text.trim()} onClick={() => run(() => onCloseCase("confirmed", text.trim()))}>
                  Confirm and close account
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

const NewInvestigationDialog: React.FC<{
  open: boolean;
  drivers: { id: string; name: string }[];
  onClose: () => void;
  onCreate: (driverId: string, summary: string, freeze: boolean) => Promise<void>;
}> = ({ open, drivers, onClose, onCreate }) => {
  const [driverId, setDriverId] = useState("");
  const [summary, setSummary] = useState("");
  const [freeze, setFreeze] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDriverId("");
      setSummary("");
      setFreeze(true);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New investigation</DialogTitle>
          <DialogDescription>For a report that did not come from an alert, such as a rider saying the driver was not the person in the app.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Driver</Label>
          <Select value={driverId} onValueChange={setDriverId}>
            <SelectTrigger><SelectValue placeholder="Choose a driver" /></SelectTrigger>
            <SelectContent>
              {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-inv-summary">What is being investigated?</Label>
          <Textarea id="new-inv-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="new-inv-freeze">Freeze the account now</Label>
            <p className="text-sm text-muted-foreground">The driver is taken offline and cannot go online or cash out until you close the investigation.</p>
          </div>
          <Switch id="new-inv-freeze" checked={freeze} onCheckedChange={setFreeze} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            disabled={busy || !driverId || !summary.trim()}
            onClick={async () => {
              setBusy(true);
              await onCreate(driverId, summary.trim(), freeze);
              setBusy(false);
            }}
          >
            Open investigation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminDriverCompliance;
