import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { invokeDispatch } from "../lib/db";
import { useHubs } from "../lib/queries";

interface PlanResult {
  routeDate: string;
  dryRun: boolean;
  routes: Array<{ routeId?: string; name: string; hub: string; stops: number; shipments: number; driver?: string; totalDistanceKm?: number }>;
  shipmentsPlanned: number;
  unassignedRoutes: number;
  skipped: Array<{ id: string; reason: string }>;
}

const AutoPlanDialog: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void; defaultDate: string }> = ({ open, onOpenChange, defaultDate }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: hubs = [] } = useHubs();
  const [form, setForm] = useState({ routeDate: defaultDate, hubId: "all", maxStops: "25", maxWeightKg: "600", startTime: "08:00", assignDrivers: true });
  const [preview, setPreview] = useState<PlanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setPreview(null);
  };

  const run = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const res = await invokeDispatch<PlanResult>("auto_plan", {
        routeDate: form.routeDate,
        hubId: form.hubId === "all" ? null : form.hubId,
        maxStops: Number(form.maxStops),
        maxWeightKg: Number(form.maxWeightKg),
        startTime: form.startTime,
        assignDrivers: form.assignDrivers,
        dryRun,
      });
      if (dryRun) {
        setPreview(res);
      } else {
        toast({
          title: `Planned ${res.routes.length} route${res.routes.length === 1 ? "" : "s"}`,
          description: `${res.shipmentsPlanned} shipments${res.unassignedRoutes ? ` · ${res.unassignedRoutes} route(s) still need a driver` : ""}. Review, then dispatch.`,
        });
        qc.invalidateQueries({ queryKey: ["lx"] });
        setPreview(null);
        onOpenChange(false);
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Planning failed", description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Plan my day
          </DialogTitle>
          <DialogDescription>
            Groups every routable parcel into balanced, optimised routes per hub and assigns the nearest free drivers. Rescheduled parcels wait
            for their chosen day. On-demand jobs stay on Dispatch.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={form.routeDate} onChange={(e) => set("routeDate", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Start time</Label>
            <Input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Hub</Label>
            <Select value={form.hubId} onValueChange={(v) => set("hubId", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All hubs</SelectItem>
                {hubs.filter((h) => h.is_active).map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.code} · {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Max stops per route</Label>
            <Input type="number" min={4} max={80} value={form.maxStops} onChange={(e) => set("maxStops", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Max load (kg)</Label>
            <Input type="number" min={20} max={5000} value={form.maxWeightKg} onChange={(e) => set("maxWeightKg", e.target.value)} />
          </div>
          <label className="col-span-2 flex items-center gap-3 rounded-lg border px-3 py-2">
            <Switch checked={form.assignDrivers} onCheckedChange={(v) => set("assignDrivers", v)} />
            <span className="text-sm">Assign the nearest free drivers</span>
          </label>
        </div>

        {preview && (
          <div className="rounded-lg border">
            <div className="px-3 py-2 border-b text-sm font-medium">
              Preview: {preview.routes.length} routes · {preview.shipmentsPlanned} shipments
              {preview.skipped.length > 0 && <span className="text-amber-600"> · {preview.skipped.length} skipped (no coordinates)</span>}
            </div>
            {preview.routes.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Nothing to plan for this day.</p>
            ) : (
              <ul className="divide-y max-h-60 overflow-y-auto text-sm">
                {preview.routes.map((r) => (
                  <li key={r.name} className="flex items-center justify-between px-3 py-2">
                    <span className="font-mono text-xs">{r.name}</span>
                    <span className="text-muted-foreground">
                      {r.shipments} parcels · {r.stops} stops
                    </span>
                    <span className={r.driver ? "" : "text-amber-600"}>{r.driver ?? "No driver"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={() => run(true)} disabled={busy}>
            {busy && !preview ? "Working…" : "Preview"}
          </Button>
          <Button onClick={() => run(false)} disabled={busy || !preview || preview.routes.length === 0}>
            {busy && preview ? "Creating…" : "Create routes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AutoPlanDialog;
