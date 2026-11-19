import React, { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, LockKeyhole, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMinor, parseMinor } from "@/lib/money";
import { isNative } from "@/lib/native";
import { newRequestKey } from "@/services/merchantAi";
import {
  closeShift, getRegisterName, openShift, recordCashMovement, setRegisterName, TENDER_LABELS, type ShiftReport,
} from "@/services/pos";

/** Starts a shift on this device's till with the float in the drawer. */
export const OpenShiftCard: React.FC<{ storeId: string; onOpened: (s: ShiftReport) => void }> = ({ storeId, onOpened }) => {
  const [register, setRegister] = useState(getRegisterName);
  const [float, setFloat] = useState("");
  const key = useRef(newRequestKey());
  const floatMinor = float.trim() === "" ? 0 : parseMinor(float);
  const open = useMutation({
    mutationFn: () => openShift(storeId, register.trim(), floatMinor ?? 0, key.current),
    onSuccess: (shift) => {
      setRegisterName(register);
      key.current = newRequestKey();
      toast.success(`Shift open on ${shift.register_name}`);
      onOpened(shift);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" aria-hidden /> Open the till</CardTitle>
        <CardDescription>Count the cash in the drawer to start a shift. Sales, refunds and cash in or out are kept per shift for the cash-up.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (floatMinor !== null) open.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="pos-register">Till name</Label>
            <Input id="pos-register" value={register} maxLength={40} onChange={(e) => setRegister(e.target.value)} className="h-12" required />
            <p className="text-xs text-muted-foreground">This device remembers its till. Use a different name on each device.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pos-float">Cash float (R)</Label>
            <Input id="pos-float" inputMode="decimal" placeholder="0.00" value={float} onChange={(e) => setFloat(e.target.value)}
              className="h-12 text-lg" aria-invalid={floatMinor === null} />
            {floatMinor === null && <p className="text-sm text-destructive">Enter an amount like 500 or 500.00</p>}
          </div>
          <Button type="submit" className="h-14 w-full text-lg" disabled={open.isPending || floatMinor === null || !register.trim()}>
            {open.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Open shift"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const Row: React.FC<{ label: string; value: React.ReactNode; strong?: boolean }> = ({ label, value, strong }) => (
  <div className={`flex items-baseline justify-between gap-3 py-1 ${strong ? "font-semibold" : ""}`}>
    <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

/** The figures on an X report (open shift) or Z report (closed shift). */
export const ShiftReportView: React.FC<{ report: ShiftReport }> = ({ report }) => (
  <div className="divide-y text-sm">
    <div className="pb-2">
      <Row label="Till" value={<span className="flex items-center gap-2">{report.register_name}
        <Badge variant={report.status === "open" ? "default" : "secondary"}>{report.status === "open" ? "Open" : "Closed"}</Badge></span>} />
      <Row label="Opened" value={`${format(new Date(report.opened_at), "d MMM HH:mm")}${report.opened_by ? ` · ${report.opened_by}` : ""}`} />
      {report.closed_at && <Row label="Closed" value={`${format(new Date(report.closed_at), "d MMM HH:mm")}${report.closed_by ? ` · ${report.closed_by}` : ""}`} />}
    </div>
    <div className="py-2">
      <Row label={`Sales (${report.sales_count})`} value={formatMinor(report.gross_minor)} />
      <Row label={`Refunds (${report.refunds_count})`} value={`−${formatMinor(report.refunds_minor)}`} />
      <Row label="Net sales" value={formatMinor(report.net_minor)} strong />
      {report.discount_minor > 0 && <Row label="Discounts given" value={formatMinor(report.discount_minor)} />}
      {report.vat_minor > 0 && <Row label="VAT included" value={formatMinor(report.vat_minor)} />}
      {report.voids_count > 0 && <Row label={`Voided (${report.voids_count})`} value={formatMinor(report.voids_minor)} />}
    </div>
    <div className="py-2">
      {(Object.keys(TENDER_LABELS) as Array<keyof typeof TENDER_LABELS>).map((m) => (
        <Row key={m} label={TENDER_LABELS[m]} value={formatMinor(report.by_method[m] ?? 0)} />
      ))}
    </div>
    <div className="pt-2">
      <Row label="Float" value={formatMinor(report.opening_float_minor)} />
      <Row label="+ Cash sales" value={formatMinor(report.by_method.cash ?? 0)} />
      <Row label="− Cash refunds" value={formatMinor(report.refunds_by_method.cash ?? 0)} />
      <Row label="+ Cash in" value={formatMinor(report.pay_ins_minor)} />
      <Row label="− Cash out" value={formatMinor(report.pay_outs_minor)} />
      <Row label="Cash expected in drawer" value={formatMinor(report.expected_cash_minor)} strong />
      {report.counted_cash_minor !== null && (
        <>
          <Row label="Cash counted" value={formatMinor(report.counted_cash_minor)} strong />
          <Row label={report.variance_minor === 0 ? "Balanced" : (report.variance_minor ?? 0) > 0 ? "Over" : "Short"}
            value={<span className={report.variance_minor ? "text-destructive" : ""}>{formatMinor(Math.abs(report.variance_minor ?? 0))}</span>} strong />
        </>
      )}
      {report.close_note && <p className="pt-1 text-muted-foreground">“{report.close_note}”</p>}
    </div>
    {report.cash_movements.length > 0 && (
      <ul className="pt-2 text-xs text-muted-foreground">
        {report.cash_movements.map((m, i) => (
          <li key={i}>{format(new Date(m.created_at), "HH:mm")} · {m.kind === "pay_in" ? "In" : "Out"} {formatMinor(m.amount_minor)} · {m.reason}</li>
        ))}
      </ul>
    )}
  </div>
);

export function shiftReportText(r: ShiftReport): string {
  const m = (n: number) => formatMinor(n).replace(/\s/g, " ");
  return [
    `${r.status === "open" ? "X" : "Z"} REPORT · ${r.register_name}`,
    `Opened ${format(new Date(r.opened_at), "d MMM yyyy HH:mm")}${r.opened_by ? ` by ${r.opened_by}` : ""}`,
    r.closed_at ? `Closed ${format(new Date(r.closed_at), "d MMM yyyy HH:mm")}${r.closed_by ? ` by ${r.closed_by}` : ""}` : "",
    `Sales (${r.sales_count}): ${m(r.gross_minor)}`,
    `Refunds (${r.refunds_count}): -${m(r.refunds_minor)}`,
    `Net: ${m(r.net_minor)}`,
    r.vat_minor ? `VAT incl.: ${m(r.vat_minor)}` : "",
    r.voids_count ? `Voided (${r.voids_count}): ${m(r.voids_minor)}` : "",
    ...(Object.keys(TENDER_LABELS) as Array<keyof typeof TENDER_LABELS>).map((k) => `${TENDER_LABELS[k]}: ${m(r.by_method[k] ?? 0)}`),
    `Float ${m(r.opening_float_minor)} · cash in ${m(r.pay_ins_minor)} · cash out ${m(r.pay_outs_minor)}`,
    `Expected cash: ${m(r.expected_cash_minor)}`,
    r.counted_cash_minor !== null ? `Counted: ${m(r.counted_cash_minor)} (${(r.variance_minor ?? 0) >= 0 ? "+" : "-"}${m(Math.abs(r.variance_minor ?? 0))})` : "",
    r.close_note ? `Note: ${r.close_note}` : "",
  ].filter(Boolean).join("\n");
}

export async function shareShiftReport(r: ShiftReport) {
  const text = shiftReportText(r);
  try {
    if (isNative()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: "Shift report", text });
    } else if (navigator.share) {
      await navigator.share({ title: "Shift report", text });
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Report copied");
    }
  } catch { /* cancelled */ }
}

/** The shift on this till: X report, cash in and out, and closing with a count. */
export const ShiftDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: ShiftReport;
  onChanged: (shift: ShiftReport | null) => void;
}> = ({ open, onOpenChange, shift, onChanged }) => {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"pay_in" | "pay_out">("pay_out");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [closed, setClosed] = useState<ShiftReport | null>(null);
  const moveKey = useRef(newRequestKey());
  const amountMinor = parseMinor(amount);
  const countedMinor = parseMinor(counted);

  const move = useMutation({
    mutationFn: () => recordCashMovement(shift.shift_id, kind, amountMinor!, reason.trim(), moveKey.current),
    onSuccess: (r) => {
      moveKey.current = newRequestKey();
      setAmount(""); setReason("");
      toast.success(kind === "pay_in" ? "Cash in recorded" : "Cash out recorded");
      onChanged(r);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const close = useMutation({
    mutationFn: () => closeShift(shift.shift_id, countedMinor!, note.trim()),
    onSuccess: (r) => {
      setClosed(r);
      queryClient.invalidateQueries({ queryKey: ["pos-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["pos-day"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finish = () => {
    setClosed(null); setCounted(""); setNote("");
    onChanged(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && closed) finish(); else onOpenChange(o); }}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{closed ? "Shift closed" : `Shift on ${shift.register_name}`}</DialogTitle>
          <DialogDescription>{closed ? "Z report for the cash-up." : "X report so far. Nothing here closes the shift until you count the drawer."}</DialogDescription>
        </DialogHeader>
        {closed ? (
          <div className="space-y-4">
            <ShiftReportView report={closed} />
            <div className="flex gap-2">
              <Button variant="outline" className="h-12 flex-1 gap-2" onClick={() => void shareShiftReport(closed)}><Share2 className="h-4 w-4" /> Share report</Button>
              <Button className="h-12 flex-1" onClick={finish}>Done</Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="report">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="report">Report</TabsTrigger>
              <TabsTrigger value="cash">Cash in/out</TabsTrigger>
              <TabsTrigger value="close">Close</TabsTrigger>
            </TabsList>
            <TabsContent value="report" className="space-y-3">
              <ShiftReportView report={shift} />
              <Button variant="outline" className="h-11 w-full gap-2" onClick={() => void shareShiftReport(shift)}><Share2 className="h-4 w-4" /> Share X report</Button>
            </TabsContent>
            <TabsContent value="cash">
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (amountMinor && reason.trim()) move.mutate(); }}>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={kind === "pay_out" ? "default" : "outline"} className="h-12" onClick={() => setKind("pay_out")}>Cash out</Button>
                  <Button type="button" variant={kind === "pay_in" ? "default" : "outline"} className="h-12" onClick={() => setKind("pay_in")}>Cash in</Button>
                </div>
                <Input inputMode="decimal" placeholder="Amount (R)" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-lg" aria-label="Amount" />
                <Input placeholder={kind === "pay_out" ? "What for? e.g. milk, cash drop to safe" : "Where from? e.g. change from bank"} value={reason}
                  maxLength={200} onChange={(e) => setReason(e.target.value)} className="h-12" aria-label="Reason" />
                <Button type="submit" className="h-12 w-full" disabled={!amountMinor || !reason.trim() || move.isPending}>
                  {move.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="close">
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (countedMinor !== null) close.mutate(); }}>
                <p className="text-sm text-muted-foreground">
                  Count all the cash in the drawer, including the float. The Z report then shows whether the drawer is over or short.
                </p>
                <Input inputMode="decimal" placeholder="Cash counted (R)" value={counted} onChange={(e) => setCounted(e.target.value)} className="h-12 text-lg" aria-label="Cash counted" />
                <Input placeholder="Note (optional)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className="h-12" aria-label="Note" />
                <Button type="submit" variant="destructive" className="h-12 w-full" disabled={countedMinor === null || close.isPending}>
                  {close.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Close shift"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
