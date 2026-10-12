import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Car, Clock, Loader2, TrendingUp, Upload, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { GAUTENG_STATES, type RpcResult } from "@/services/driverVerificationService";
import { fleetService, parseVehicleSheet, type BulkResult, type FleetOverview } from "@/services/fleetService";
import FleetVehicleDialog, { DOC_STATE } from "./FleetVehicleDialog";

const rand = (value: number) => `R${Number(value).toFixed(2)}`;
const dateTime = (value: string) => format(new Date(value), "EEE d MMM, HH:mm");
const isoDay = (date: Date) => format(date, "yyyy-MM-dd");

const SHEET_EXAMPLE = "plate,make,model,year,colour,vin\nJZ 11 AA GP,Toyota,Corolla Quest,2022,White,\nJZ 22 BB GP,Suzuki,Dzire,2023,Silver,";

const FleetManagement: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const fleetId = useQuery({
    queryKey: ["my-fleet", user?.id],
    queryFn: () => fleetService.myFleetId(user!.id),
    enabled: !!user,
  });
  const overview = useQuery({
    queryKey: ["fleet-overview", fleetId.data],
    queryFn: () => fleetService.overview(fleetId.data!),
    enabled: !!fleetId.data,
  });

  if (!user || fleetId.isLoading || (fleetId.data && overview.isLoading)) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (!fleetId.data) {
    return <RegisterFleet onRegistered={() => fleetId.refetch()} />;
  }
  if (overview.isError || !overview.data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground" role="alert">
          We couldn't load your fleet right now. Please try again in a moment.
        </CardContent>
      </Card>
    );
  }

  const report = (result: RpcResult, done: string) => {
    if (result.ok) toast({ title: done });
    else toast({ variant: "destructive", title: "Not saved", description: result.message });
    if (result.ok) void overview.refetch();
    return result.ok;
  };

  return <FleetDashboard data={overview.data} userId={user.id} reload={() => void overview.refetch()} report={report} />;
};

const RegisterFleet: React.FC<{ onRegistered: () => void }> = ({ onRegistered }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", ownerType: "company" as "individual" | "company", legalName: "", registrationNumber: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const company = form.ownerType === "company";

  const submit = async () => {
    setSaving(true);
    const result = await fleetService.register(form);
    setSaving(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Not registered", description: result.message });
      return;
    }
    toast({ title: "Fleet registered", description: "You can add vehicles now. 1145 will verify your fleet before they go on the road." });
    onRegistered();
  };

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Register your fleet</CardTitle>
        <CardDescription>
          For owners who put drivers in their vehicles. You manage the vehicles, their licences and who drives when; your
          drivers each keep their own 1145 driver account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fleet-name">Fleet name</Label>
            <Input id="fleet-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label>The vehicles are owned by</Label>
            <Select value={form.ownerType} onValueChange={(v) => set("ownerType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="company">A company</SelectItem>
                <SelectItem value="individual">Me, in my own name</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fleet-legal">{company ? "Registered company name" : "Your full legal name"}</Label>
            <Input id="fleet-legal" value={form.legalName} onChange={(e) => set("legalName", e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fleet-reg">{company ? "Company registration number" : "Your ID number"}</Label>
            <Input id="fleet-reg" value={form.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} maxLength={30} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fleet-phone">Contact phone</Label>
            <Input id="fleet-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={20} />
          </div>
        </div>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Register fleet
        </Button>
      </CardContent>
    </Card>
  );
};

interface DashboardProps {
  data: FleetOverview;
  userId: string;
  reload: () => void;
  /** Shows the outcome of an action and reloads on success. */
  report: (result: RpcResult, done: string) => boolean;
}

const FleetDashboard: React.FC<DashboardProps> = ({ data, userId, reload, report }) => {
  const { fleet, vehicles, drivers, shifts, alerts } = data;
  const [openVehicle, setOpenVehicle] = useState<string | null>(null);
  const vehicleName = (id: string) => vehicles.find((v) => v.id === id)?.license_plate ?? "Vehicle";
  const driverName = (id: string) => drivers.find((d) => d.driver_id === id)?.name ?? "Driver";
  const activeDrivers = drivers.filter((d) => d.membership === "active");
  const urgent = alerts.filter((a) => a.severity === "high").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{fleet.name}</h2>
          <p className="text-sm text-muted-foreground">
            {vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"} · {activeDrivers.length} {activeDrivers.length === 1 ? "driver" : "drivers"} ·{" "}
            {vehicles.filter((v) => v.online).length} online now
          </p>
        </div>
        <Badge className={fleet.verification_status === "verified" ? DOC_STATE.valid.className : fleet.verification_status === "rejected" ? DOC_STATE.expired.className : DOC_STATE.pending.className}>
          {fleet.verification_status === "verified" ? "Verified" : fleet.verification_status === "rejected" ? "Not accepted" : "Being verified"}
        </Badge>
      </div>

      {fleet.verification_status !== "verified" && (
        <p className="rounded-lg bg-muted p-3 text-sm">
          {fleet.verification_status === "rejected"
            ? `1145 did not accept this fleet: ${fleet.verification_notes ?? "contact support."}`
            : "1145 is verifying your fleet. You can add vehicles, documents and drivers in the meantime; nothing goes on the road until the fleet is verified."}
        </p>
      )}

      {alerts.length > 0 && (
        <Card className={urgent > 0 ? "border-destructive" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5" /> Needs attention ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setOpenVehicle(a.vehicle_id)}
                className="flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm hover:bg-muted/50"
              >
                <Badge variant="outline" className={a.severity === "high" ? DOC_STATE.expired.className : ""}>{a.license_plate}</Badge>
                <span>{a.message}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="vehicles">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="vehicles"><Car className="mr-2 h-4 w-4" />Vehicles</TabsTrigger>
          <TabsTrigger value="upload"><Upload className="mr-2 h-4 w-4" />Add vehicles</TabsTrigger>
          <TabsTrigger value="drivers"><Users className="mr-2 h-4 w-4" />Drivers</TabsTrigger>
          <TabsTrigger value="shifts"><Clock className="mr-2 h-4 w-4" />Shifts</TabsTrigger>
          <TabsTrigger value="earnings"><TrendingUp className="mr-2 h-4 w-4" />Earnings</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Gauteng licence</TableHead>
                    <TableHead>Now</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No vehicles yet. Add them under "Add vehicles".</TableCell></TableRow>
                  ) : vehicles.map((v) => {
                    const shift = shifts.find((s) => s.vehicle_id === v.id && s.current);
                    return (
                      <TableRow key={v.id}>
                        <TableCell>
                          <p className="font-medium">{v.license_plate}</p>
                          <p className="text-sm text-muted-foreground">{v.year} {v.make} {v.model}</p>
                          {v.status !== "active" && <p className="text-sm text-muted-foreground">{v.status === "pending" ? "Waiting for approval" : "Not approved"}</p>}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {v.documents.map((d) => (
                              <Badge key={d.doc_type} variant="outline" className={DOC_STATE[d.state].className}>
                                {d.doc_type === "operating_licence" ? "Licence" : d.doc_type === "roadworthy" ? "Roadworthy" : "Insurance"}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={GAUTENG_STATES[v.gauteng_state].className}>{GAUTENG_STATES[v.gauteng_state].label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {shift ? driverName(shift.driver_id) : <span className="text-muted-foreground">No driver</span>}
                          {v.online && <Badge className="ml-2 bg-green-600 text-white border-0">Online</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setOpenVehicle(v.id)}>Manage</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload">
          <BulkUpload fleetId={fleet.id} onAdded={reload} />
        </TabsContent>

        <TabsContent value="drivers">
          <DriversTab fleetId={fleet.id} drivers={drivers} report={report} />
        </TabsContent>

        <TabsContent value="shifts">
          <ShiftsTab
            fleetId={fleet.id}
            vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.license_plate} · ${v.make} ${v.model}` }))}
            drivers={activeDrivers.map((d) => ({ id: d.driver_id, label: d.name }))}
            shifts={shifts}
            vehicleName={vehicleName}
            driverName={driverName}
            report={report}
          />
        </TabsContent>

        <TabsContent value="earnings">
          <EarningsTab fleet={fleet} reload={reload} />
        </TabsContent>
      </Tabs>

      <FleetVehicleDialog
        key={openVehicle ?? "none"}
        vehicle={vehicles.find((v) => v.id === openVehicle) ?? null}
        userId={userId}
        onClose={() => setOpenVehicle(null)}
        onChanged={reload}
      />
    </div>
  );
};

const BulkUpload: React.FC<{ fleetId: string; onAdded: () => void }> = ({ fleetId, onAdded }) => {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const parsed = useMemo(() => (text.trim() ? parseVehicleSheet(text) : null), [text]);

  const upload = async () => {
    if (!parsed || parsed.error) return;
    setBusy(true);
    const outcome = await fleetService.addVehicles(fleetId, parsed.rows);
    setBusy(false);
    if (!outcome.ok) {
      toast({ variant: "destructive", title: "Not added", description: outcome.message });
      return;
    }
    setResult(outcome);
    toast({ title: `${outcome.added} ${outcome.added === 1 ? "vehicle" : "vehicles"} added` });
    if (outcome.added) onAdded();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add vehicles in bulk</CardTitle>
        <CardDescription>
          Paste rows from a spreadsheet, or choose a CSV file. The first row names the columns: plate, make, model and
          year are needed; colour and VIN are optional. Up to 500 at a time. 1145 approves each vehicle before it can go
          online.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="file"
          accept=".csv,.txt,text/csv"
          aria-label="CSV file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) setText(await file.text());
          }}
        />
        <Textarea aria-label="Vehicles" rows={8} className="font-mono text-sm" placeholder={SHEET_EXAMPLE} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} />
        {parsed?.error && <p role="alert" className="text-sm text-destructive">{parsed.error}</p>}
        <div className="flex items-center gap-3">
          <Button onClick={upload} disabled={busy || !parsed || !!parsed.error}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {parsed && !parsed.error ? `Add ${parsed.rows.length} ${parsed.rows.length === 1 ? "vehicle" : "vehicles"}` : "Add vehicles"}
          </Button>
        </div>
        {result?.results && result.results.some((r) => !r.ok) && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">These rows were not added:</p>
            {result.results.filter((r) => !r.ok).map((r) => (
              <p key={r.row} className="text-destructive">Row {r.row}{r.license_plate ? ` (${r.license_plate})` : ""}: {r.message}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const DriversTab: React.FC<{ fleetId: string; drivers: FleetOverview["drivers"]; report: DashboardProps["report"] }> = ({ fleetId, drivers, report }) => {
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);

  const invite = async () => {
    setBusy(true);
    const result = await fleetService.inviteDriver(fleetId, contact);
    setBusy(false);
    if (report(result, `Invitation sent to ${result.driver_name ?? "the driver"}`)) setContact("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Drivers</CardTitle>
        <CardDescription>
          Invite a driver using the phone number or email on their 1145 driver account. They must have signed up as a
          driver themselves: 1145 checks each driver's identity, and only they may drive on their account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-2">
            <Label htmlFor="fleet-invite">Driver's phone number or email</Label>
            <Input id="fleet-invite" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <Button onClick={invite} disabled={busy || contact.trim().length < 5}>Send invitation</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Driver</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No drivers yet.</TableCell></TableRow>
            ) : drivers.map((d) => (
              <TableRow key={d.driver_id}>
                <TableCell>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-sm text-muted-foreground">{d.phone}</p>
                </TableCell>
                <TableCell className="text-sm">
                  {d.membership === "invited" ? "Invitation not answered yet"
                    : d.driver_status === "suspended" ? "Suspended by 1145"
                    : d.driver_status === "pending" ? "Waiting for 1145 to approve them"
                    : d.online ? "Online" : "Offline"}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" disabled={busy} onClick={async () => report(await fleetService.endDriver(fleetId, d.driver_id), "Driver removed")}>
                    {d.membership === "invited" ? "Withdraw" : "Remove"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

interface ShiftsProps {
  fleetId: string;
  vehicles: { id: string; label: string }[];
  drivers: { id: string; label: string }[];
  shifts: FleetOverview["shifts"];
  vehicleName: (id: string) => string;
  driverName: (id: string) => string;
  report: DashboardProps["report"];
}

const ShiftsTab: React.FC<ShiftsProps> = ({ fleetId, vehicles, drivers, shifts, vehicleName, driverName, report }) => {
  const [form, setForm] = useState({ vehicleId: "", driverId: "", startsAt: "", endsAt: "", repeatDays: "1" });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const schedule = async () => {
    setBusy(true);
    const result = await fleetService.scheduleShift(fleetId, {
      vehicleId: form.vehicleId,
      driverId: form.driverId,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      repeatDays: parseInt(form.repeatDays, 10) || 1,
    });
    setBusy(false);
    const skipped = result.skipped?.length ?? 0;
    report(result, skipped ? `${result.created} scheduled, ${skipped} skipped because of a clash` : "Shift scheduled");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Shifts</CardTitle>
        <CardDescription>
          A shift puts one driver in one vehicle for a set time. Several drivers can share a vehicle across the day, never
          at once. During their shift this is the vehicle the driver goes online in; when it ends they are taken offline
          once any trip is finished. Leave the end empty for a driver who has the vehicle until further notice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label>Vehicle</Label>
            <Select value={form.vehicleId} onValueChange={(v) => set("vehicleId", v)}>
              <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Driver</Label>
            <Select value={form.driverId} onValueChange={(v) => set("driverId", v)}>
              <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-start">Starts</Label>
            <Input id="shift-start" type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-end">Ends</Label>
            <Input id="shift-end" type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-repeat">Repeat for (days)</Label>
            <Input id="shift-repeat" type="number" min={1} max={31} value={form.repeatDays} disabled={!form.endsAt} onChange={(e) => set("repeatDays", e.target.value)} />
          </div>
        </div>
        <Button onClick={schedule} disabled={busy || !form.vehicleId || !form.driverId || !form.startsAt}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Schedule
        </Button>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No shifts scheduled.</TableCell></TableRow>
            ) : shifts.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{vehicleName(s.vehicle_id)}</TableCell>
                <TableCell>{driverName(s.driver_id)}</TableCell>
                <TableCell className="text-sm">
                  {dateTime(s.starts_at)} to {s.ends_at ? dateTime(s.ends_at) : "further notice"}
                  {s.current && <Badge className="ml-2 bg-green-600 text-white border-0">Now</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" disabled={busy} onClick={async () => report(await fleetService.cancelShift(s.id), s.current ? "Shift ended" : "Shift cancelled")}>
                    {s.current ? "End now" : "Cancel"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const EarningsTab: React.FC<{ fleet: FleetOverview["fleet"]; reload: () => void }> = ({ fleet, reload }) => {
  const { toast } = useToast();
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 6 * 86_400_000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const earnings = useQuery({
    queryKey: ["fleet-earnings", fleet.id, from, to],
    queryFn: () => fleetService.earnings(fleet.id, from, to),
    enabled: !!from && !!to,
  });
  const rows = earnings.data ?? [];
  const total = (key: "trips" | "fares" | "commission" | "payout" | "driver_share") => rows.reduce((sum, r) => sum + Number(r[key] ?? 0), 0);
  const split = fleet.driver_share_pct != null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Earnings</CardTitle>
        <CardDescription>
          Completed trips in your vehicles. The payout is the fares less 1145's commission, plus any fuel adjustment.{" "}
          {fleet.payout_mode === "operator" ? "1145 pays it to you, and you pay your drivers." : "1145 pays it to the driver."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="earn-from">From</Label>
            <Input id="earn-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="earn-to">To</Label>
            <Input id="earn-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="earn-share">Drivers' share of the payout (%)</Label>
            <Input
              id="earn-share"
              type="number"
              min={0}
              max={100}
              className="w-40"
              placeholder="Not set"
              defaultValue={fleet.driver_share_pct ?? ""}
              onBlur={async (e) => {
                const value = e.target.value === "" ? null : parseFloat(e.target.value);
                if (value === (fleet.driver_share_pct ?? null) || (value !== null && !(value >= 0 && value <= 100))) return;
                const { error } = await fleetService.saveDriverShare(fleet.id, value);
                if (error) toast({ variant: "destructive", title: "Not saved", description: error.message });
                else {
                  reload();
                  void earnings.refetch();
                }
              }}
            />
          </div>
        </div>

        {earnings.isError ? (
          <p role="alert" className="text-sm text-destructive">Earnings could not be loaded.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead className="text-right">Trips</TableHead>
                <TableHead className="text-right">Fares</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Payout</TableHead>
                {split && <TableHead className="text-right">Drivers' share</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={split ? 7 : 6} className="py-8 text-center text-muted-foreground">{earnings.isLoading ? "Loading..." : "No completed trips in these dates."}</TableCell></TableRow>
              ) : (
                <>
                  {rows.map((r) => (
                    <TableRow key={`${r.vehicle_id}-${r.driver_id}`}>
                      <TableCell className="font-medium">{r.license_plate}</TableCell>
                      <TableCell>{r.driver_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.trips}</TableCell>
                      <TableCell className="text-right tabular-nums">{rand(r.fares)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rand(r.commission)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rand(r.payout)}</TableCell>
                      {split && <TableCell className="text-right tabular-nums">{rand(r.driver_share ?? 0)}</TableCell>}
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right tabular-nums">{total("trips")}</TableCell>
                    <TableCell className="text-right tabular-nums">{rand(total("fares"))}</TableCell>
                    <TableCell className="text-right tabular-nums">{rand(total("commission"))}</TableCell>
                    <TableCell className="text-right tabular-nums">{rand(total("payout"))}</TableCell>
                    {split && <TableCell className="text-right tabular-nums">{rand(total("driver_share"))}</TableCell>}
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default FleetManagement;
