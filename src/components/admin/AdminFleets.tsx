import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { SAFETY_DEVICES } from "@/services/fleetService";

// These tables and functions arrive with 20261012180000_fleet_operators.sql and
// are not in the generated database types yet.
const db = supabase as any;

const AdminFleets: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fleets, setFleets] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [payout, setPayout] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [f, v, d] = await Promise.all([
      db.from("fleets").select("*").order("created_at", { ascending: false }),
      db.from("vehicles").select("id, license_plate, make, model, year, color, vin_number, fleets(name, verification_status)")
        .not("fleet_id", "is", null).eq("status", "pending").order("created_at"),
      db.from("vehicle_safety_devices").select("*, vehicles(license_plate)").is("verified_at", null).neq("status", "not_fitted").order("updated_at"),
    ]);
    const error = [f, v, d].find((r) => r.error)?.error;
    if (error) toast({ variant: "destructive", title: "Error", description: "Fleets could not be loaded. " + error.message });
    setFleets(f.data ?? []);
    setVehicles(v.data ?? []);
    setDevices(d.data ?? []);
    setSelected([]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: PromiseLike<{ error: { message: string } | null }>, done: string) => {
    setBusy(true);
    const { error } = await action;
    setBusy(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return false;
    }
    toast({ title: done });
    await load();
    return true;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fleets</CardTitle>
          <CardDescription>
            Check the owner's company registration or ID before verifying. Nothing in a fleet goes on the road until the
            fleet is verified. Choose who 1145 pays for trips in the fleet's vehicles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fleet</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Vehicles</TableHead>
                <TableHead>Trips are paid to</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fleets.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No fleets have registered yet.</TableCell></TableRow>
              ) : fleets.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <p className="font-medium">{f.name}</p>
                    <Badge variant={f.verification_status === "verified" ? "default" : "secondary"} className="capitalize">{f.verification_status}</Badge>
                  </TableCell>
                  <TableCell>
                    <p>{f.legal_name ?? "Not given"}</p>
                    <p className="text-sm text-muted-foreground">{f.registration_number}{f.contact_phone ? ` · ${f.contact_phone}` : ""}</p>
                  </TableCell>
                  <TableCell>{f.active_vehicles} approved of {f.total_vehicles}</TableCell>
                  <TableCell>
                    <Select value={payout[f.id] ?? f.payout_mode} onValueChange={(v) => setPayout((p) => ({ ...p, [f.id]: v }))}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operator">The operator</SelectItem>
                        <SelectItem value="driver">The driver</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={busy || (f.verification_status === "verified" && (payout[f.id] ?? f.payout_mode) === f.payout_mode)}
                        onClick={() => act(
                          db.rpc("review_fleet", { p_fleet_id: f.id, p_approve: true, p_payout_mode: payout[f.id] ?? f.payout_mode }),
                          f.verification_status === "verified" ? "Fleet updated" : "Fleet verified",
                        )}
                      >
                        {f.verification_status === "verified" ? "Save" : "Verify"}
                      </Button>
                      {f.verification_status !== "rejected" && (
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => { setNotes(""); setRejecting(f); }}>
                          {f.verification_status === "verified" ? "Withdraw" : "Reject"}
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
              <CardTitle>Fleet vehicles waiting for approval</CardTitle>
              <CardDescription>Check each plate and VIN against the vehicle's registration papers.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy || selected.length === 0} onClick={() => act(db.rpc("review_fleet_vehicles", { p_vehicle_ids: selected, p_approve: false }), "Vehicles declined")}>
                Decline
              </Button>
              <Button disabled={busy || selected.length === 0} onClick={() => act(db.rpc("review_fleet_vehicles", { p_vehicle_ids: selected, p_approve: true }), "Vehicles approved")}>
                Approve {selected.length || ""}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all"
                    checked={vehicles.length > 0 && selected.length === vehicles.length}
                    onCheckedChange={(v) => setSelected(v ? vehicles.map((x) => x.id) : [])}
                  />
                </TableHead>
                <TableHead>Plate</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>VIN</TableHead>
                <TableHead>Fleet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No vehicles are waiting.</TableCell></TableRow>
              ) : vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell><Checkbox aria-label={`Select ${v.license_plate}`} checked={selected.includes(v.id)} onCheckedChange={() => toggle(v.id)} /></TableCell>
                  <TableCell className="font-medium">{v.license_plate}</TableCell>
                  <TableCell>{v.year} {v.make} {v.model}, {v.color}</TableCell>
                  <TableCell>{v.vin_number ?? "Not given"}</TableCell>
                  <TableCell>
                    {v.fleets?.name}
                    {v.fleets?.verification_status !== "verified" && <span className="text-sm text-muted-foreground"> (fleet not verified)</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {devices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Safety devices to confirm</CardTitle>
            <CardDescription>What operators say is fitted. Confirm once you have seen proof that it is there and working.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {devices.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.vehicles?.license_plate}</TableCell>
                    <TableCell>{SAFETY_DEVICES.find((s) => s.type === d.device_type)?.label ?? d.device_type}{d.serial_number ? ` (${d.serial_number})` : ""}</TableCell>
                    <TableCell className="capitalize">{d.status}{d.last_checked_on ? `, checked ${d.last_checked_on}` : ""}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" disabled={busy} onClick={() => act(db.rpc("verify_safety_device", { p_device_id: d.id }), "Device confirmed")}>Confirm</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rejecting?.verification_status === "verified" ? "Withdraw this fleet's verification?" : "Reject this fleet?"}</DialogTitle>
            <DialogDescription>Its vehicles stop counting for shifts straight away. The operator is told why.</DialogDescription>
          </DialogHeader>
          <Textarea aria-label="Reason" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={busy}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={busy || !notes.trim()}
              onClick={async () => {
                if (await act(db.rpc("review_fleet", { p_fleet_id: rejecting.id, p_approve: false, p_notes: notes.trim() }), "Fleet rejected")) setRejecting(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFleets;
