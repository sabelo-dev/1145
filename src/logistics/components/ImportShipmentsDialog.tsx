import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addHours } from "date-fns";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db, SERVICE_LEVEL_HOURS, SERVICE_LEVELS, type ServiceLevel } from "../lib/db";
import { parseCsv, resolveAddress } from "../lib/address";

const COLUMNS = [
  "reference",
  "sender_name",
  "sender_phone",
  "pickup_address",
  "recipient_name",
  "recipient_phone",
  "delivery_address",
  "service_level",
  "parcel_count",
  "weight_kg",
  "cod_amount",
  "notes",
] as const;
const REQUIRED = ["sender_name", "pickup_address", "recipient_name", "delivery_address"];
const MAX_ROWS = 200;

const TEMPLATE =
  COLUMNS.join(",") +
  "\nINV-1001,Acme Store,0110000000,\"1 Main Rd, Sandton\",Thandi M,0820000000,\"22 Long St, Cape Town\",next_day,1,2.5,,Leave at reception\n";

const ImportShipmentsDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<number | null>(null);

  const parsed = useMemo(() => {
    if (!text.trim()) return { rows: [] as Record<string, string>[], errors: [] as string[] };
    const table = parseCsv(text);
    const header = table[0].map((h) => h.trim().toLowerCase());
    const missing = REQUIRED.filter((c) => !header.includes(c));
    if (missing.length) return { rows: [], errors: [`Missing columns: ${missing.join(", ")}`] };
    const errors: string[] = [];
    const rows = table.slice(1).map((cells, i) => {
      const row: Record<string, string> = {};
      header.forEach((h, idx) => (row[h] = (cells[idx] ?? "").trim()));
      const blank = REQUIRED.filter((c) => !row[c]);
      if (blank.length) errors.push(`Row ${i + 2}: missing ${blank.join(", ")}`);
      if (row.service_level && !(row.service_level in SERVICE_LEVELS)) errors.push(`Row ${i + 2}: unknown service_level "${row.service_level}"`);
      return row;
    });
    if (rows.length > MAX_ROWS) errors.push(`Up to ${MAX_ROWS} rows per import (got ${rows.length}).`);
    return { rows, errors };
  }, [text]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setText(await f.text());
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "1145-logistics-shipments-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    const { rows } = parsed;
    setProgress(0);
    let notGeocoded = 0;
    try {
      const records = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const level = (r.service_level || "standard") as ServiceLevel;
        const [pickup, delivery] = await Promise.all([resolveAddress(r.pickup_address), resolveAddress(r.delivery_address)]);
        if (pickup.lat == null || delivery.lat == null) notGeocoded++;
        records.push({
          reference: r.reference || null,
          sender_name: r.sender_name,
          sender_phone: r.sender_phone || null,
          pickup_address: pickup,
          recipient_name: r.recipient_name,
          recipient_phone: r.recipient_phone || null,
          delivery_address: delivery,
          service_level: level,
          promised_by: addHours(new Date(), SERVICE_LEVEL_HOURS[level]).toISOString(),
          parcel_count: Math.max(1, Number(r.parcel_count) || 1),
          weight_kg: r.weight_kg ? Number(r.weight_kg) : null,
          cod_amount: r.cod_amount ? Number(r.cod_amount) : null,
          notes: r.notes || null,
          status: "awaiting_pickup",
          metadata: { source: "csv_import" },
        });
        setProgress(Math.round(((i + 1) / rows.length) * 90));
      }
      const { error } = await db.from("shipments").insert(records);
      if (error) throw error;
      setProgress(100);
      toast({
        title: `Imported ${records.length} shipments`,
        description: notGeocoded ? `${notGeocoded} address${notGeocoded > 1 ? "es" : ""} could not be geocoded, so check them before routing.` : undefined,
      });
      qc.invalidateQueries({ queryKey: ["lx", "shipments"] });
      setText("");
      onOpenChange(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Import failed", description: err instanceof Error ? err.message : String(err) });
    } finally {
      setProgress(null);
    }
  };

  const canImport = parsed.rows.length > 0 && parsed.errors.length === 0 && progress === null;

  return (
    <Dialog open={open} onOpenChange={(o) => progress === null && onOpenChange(o)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import shipments</DialogTitle>
          <DialogDescription>Paste CSV or upload a file. Addresses are geocoded automatically.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-1.5" /> Upload CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
            </label>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1.5" /> Template
          </Button>
        </div>
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={COLUMNS.join(",")}
          className="font-mono text-xs"
        />
        {parsed.errors.length > 0 && (
          <ul className="text-sm text-destructive space-y-0.5 max-h-28 overflow-y-auto">
            {parsed.errors.slice(0, 10).map((e) => (
              <li key={e}>{e}</li>
            ))}
            {parsed.errors.length > 10 && <li>…and {parsed.errors.length - 10} more</li>}
          </ul>
        )}
        {parsed.rows.length > 0 && parsed.errors.length === 0 && (
          <p className="text-sm text-muted-foreground">{parsed.rows.length} shipments ready to import.</p>
        )}
        {progress !== null && <Progress value={progress} />}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={progress !== null}>
            Cancel
          </Button>
          <Button onClick={runImport} disabled={!canImport}>
            {progress !== null ? "Importing…" : `Import ${parsed.rows.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportShipmentsDialog;
