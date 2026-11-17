import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInHours, format, formatDistanceToNowStrict } from "date-fns";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { db } from "../lib/db";
import { useDrivers, useRealtimeInvalidate } from "../lib/queries";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { EmptyState, PageHeader, StatCard } from "../components/common";

interface Collection {
  id: string;
  shipment_id: string;
  driver_id: string | null;
  amount: number;
  collected_at: string;
  remitted_at: string | null;
  remittance_ref: string | null;
  shipments: { tracking_number: string; recipient_name: string } | null;
}

const rands = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CodPage: React.FC = () => {
  const { can } = useLogisticsAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: drivers = [] } = useDrivers();
  const [remitFor, setRemitFor] = useState<{ driverId: string | null; items: Collection[] } | null>(null);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: outstanding = [] } = useQuery({
    queryKey: ["lx", "cod", "outstanding"],
    queryFn: async () => {
      const { data, error } = await db
        .from("cod_collections")
        .select("*, shipments(tracking_number, recipient_name)")
        .is("remitted_at", null)
        .order("collected_at")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Collection[];
    },
  });
  const { data: recent = [] } = useQuery({
    queryKey: ["lx", "cod", "recent"],
    queryFn: async () => {
      const { data, error } = await db
        .from("cod_collections")
        .select("*, shipments(tracking_number, recipient_name)")
        .not("remitted_at", "is", null)
        .order("remitted_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Collection[];
    },
  });
  useRealtimeInvalidate("lx-cod", ["shipments"], [["lx", "cod"]]);

  const byDriver = useMemo(() => {
    const m = new Map<string, Collection[]>();
    outstanding.forEach((c) => {
      const k = c.driver_id ?? "unknown";
      m.set(k, [...(m.get(k) ?? []), c]);
    });
    return [...m.entries()]
      .map(([driverId, items]) => ({
        driverId: driverId === "unknown" ? null : driverId,
        items,
        total: items.reduce((a, c) => a + Number(c.amount), 0),
        oldest: items[0]?.collected_at,
      }))
      .sort((a, b) => b.total - a.total);
  }, [outstanding]);

  const totalOutstanding = byDriver.reduce((a, d) => a + d.total, 0);
  const overdue = byDriver.filter((d) => d.oldest && differenceInHours(new Date(), new Date(d.oldest)) > 24);
  const name = (id: string | null) => (id ? drivers.find((d) => d.id === id)?.name ?? "Driver" : "Unattributed");

  const remit = async () => {
    if (!remitFor) return;
    setSaving(true);
    const { data, error } = await db.rpc("logistics_remit_cod", { p_collection_ids: remitFor.items.map((c) => c.id), p_reference: reference });
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Not recorded", description: error.message });
      return;
    }
    toast({ title: "Hand-in recorded", description: `${rands(Number(data))} from ${name(remitFor.driverId)} · ref ${reference}` });
    setRemitFor(null);
    setReference("");
    qc.invalidateQueries({ queryKey: ["lx", "cod"] });
  };

  return (
    <div>
      <PageHeader title="Cash on delivery" description="Cash collected at the door, by driver, until it's handed in or deposited." />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <StatCard label="Outstanding" value={rands(totalOutstanding)} icon={<Banknote className="h-4 w-4" />} tone={totalOutstanding ? "warn" : "default"} />
        <StatCard label="Drivers holding cash" value={byDriver.length} />
        <StatCard label="Held over 24h" value={overdue.length} tone={overdue.length ? "danger" : "default"} hint="Follow up today" />
      </div>

      {byDriver.length === 0 ? (
        <EmptyState icon={<Banknote className="h-8 w-8" />} title="All cash is accounted for" description="Collections appear here as COD parcels are delivered." />
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto mb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead className="text-right">Parcels</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden md:table-cell">Oldest</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {byDriver.map((d) => (
                <TableRow key={d.driverId ?? "unknown"}>
                  <TableCell className="font-medium">{name(d.driverId)}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.items.length}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{rands(d.total)}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {d.oldest && (
                      <span className={differenceInHours(new Date(), new Date(d.oldest)) > 24 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                        {formatDistanceToNowStrict(new Date(d.oldest), { addSuffix: true })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {can("owner", "dispatcher", "hub_operator") && (
                      <Button size="sm" variant="outline" onClick={() => setRemitFor({ driverId: d.driverId, items: d.items })}>
                        Record hand-in
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {recent.length > 0 && (
        <section className="rounded-xl border bg-card">
          <h2 className="text-sm font-semibold px-4 pt-4 pb-2">Recent hand-ins</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Parcel</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden md:table-cell">Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(c.remitted_at!), "d MMM HH:mm")}</TableCell>
                  <TableCell className="text-sm">{name(c.driver_id)}</TableCell>
                  <TableCell className="font-mono text-xs">{c.shipments?.tracking_number}</TableCell>
                  <TableCell className="text-right tabular-nums">{rands(Number(c.amount))}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{c.remittance_ref}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      <Dialog open={!!remitFor} onOpenChange={(o) => !o && setRemitFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record hand-in: {remitFor && name(remitFor.driverId)}</DialogTitle>
            <DialogDescription>
              {remitFor?.items.length} parcel(s) · {rands(remitFor?.items.reduce((a, c) => a + Number(c.amount), 0) ?? 0)}. Count the cash before confirming.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-40 overflow-y-auto text-sm divide-y rounded border">
            {remitFor?.items.map((c) => (
              <li key={c.id} className="flex justify-between px-3 py-1.5">
                <span className="font-mono text-xs">{c.shipments?.tracking_number}</span>
                <span className="tabular-nums">{rands(Number(c.amount))}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5">
            <Label htmlFor="ref">Deposit slip / receipt reference</Label>
            <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. DEP-20261116-04" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemitFor(null)}>
              Cancel
            </Button>
            <Button onClick={remit} disabled={saving || !reference.trim()}>
              {saving ? "Recording…" : "Confirm hand-in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CodPage;
