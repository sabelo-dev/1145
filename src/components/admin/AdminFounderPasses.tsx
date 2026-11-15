import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Settings {
  price: number;
  total: number;
  claimed: number;
  is_open: boolean;
  valid_months: number;
}

interface PassRow {
  pass_number: number;
  user_id: string;
  email: string | null;
  claimed_at: string;
  expires_at: string;
  source: string | null;
}

interface RefundRow {
  id: string;
  user_id: string;
  email: string | null;
  amount: number;
  status: "refund_due" | "refunded";
  paid_at: string | null;
  payfast_payment_id: string | null;
}

interface Overview {
  settings: Settings | null;
  passes: PassRow[];
  refunds: RefundRow[];
}

// The founder pass functions are not in the generated types yet.
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc(fn, args);

const SETTINGS_ERRORS: Record<string, string> = {
  price_too_low: "The price must be at least R5 (PayFast's minimum payment).",
  total_below_claimed: "The total cannot be lower than the number of passes already claimed.",
};

/**
 * Founders Passes: open or close sales, set the price and the cap, see who
 * holds which number, and close off refunds. A refund is owed when someone
 * paid but no pass could be issued (sold out, or they already had one):
 * refund the payment in the PayFast dashboard first, then mark it refunded here.
 */
export default function AdminFounderPasses() {
  const { toast } = useToast();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [total, setTotal] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await rpc("founder_pass_admin_overview");
    if (error) {
      toast({ variant: "destructive", title: "Could not load Founders Passes", description: error.message });
    } else {
      const next = data as Overview;
      setOverview(next);
      if (next.settings) {
        setIsOpen(next.settings.is_open);
        setPrice(String(Number(next.settings.price)));
        setTotal(String(next.settings.total));
      }
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setSaving(true);
    const { data, error } = await rpc("founder_pass_admin_update_settings", {
      p_is_open: isOpen,
      p_price: Number(price),
      p_total: Math.trunc(Number(total)),
    });
    setSaving(false);
    if (error || data !== "saved") {
      toast({
        variant: "destructive",
        title: "Settings not saved",
        description: error?.message ?? SETTINGS_ERRORS[String(data)] ?? "Check the price and the total.",
      });
      return;
    }
    toast({ title: "Settings saved", description: isOpen ? "Founders Passes are on sale." : "Sales are closed." });
    load();
  };

  const markRefunded = async (row: RefundRow) => {
    setBusy(row.id);
    const { data, error } = await rpc("founder_pass_admin_mark_refunded", { p_order_id: row.id });
    setBusy(null);
    if (error || (data !== "refunded" && data !== "already_refunded")) {
      toast({ variant: "destructive", title: "Update failed", description: error?.message ?? "This order is not waiting for a refund." });
      return;
    }
    toast({ title: "Marked as refunded", description: "The buyer has been notified." });
    load();
  };

  if (loading && !overview) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" aria-label="Loading" /></div>;
  }

  const settings = overview?.settings ?? null;
  const passes = overview?.passes ?? [];
  const refunds = overview?.refunds ?? [];
  const refundsDue = refunds.filter((r) => r.status === "refund_due");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Founders Passes</CardTitle>
          <CardDescription>
            {settings
              ? `${settings.claimed.toLocaleString()} of ${settings.total.toLocaleString()} claimed. Each pass gives ${settings.valid_months} months of member deals.`
              : "Settings could not be loaded."}
          </CardDescription>
        </CardHeader>
        {settings && (
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch id="founders-open" checked={isOpen} onCheckedChange={setIsOpen} />
              <Label htmlFor="founders-open">On sale at /founders</Label>
            </div>
            <div className="grid max-w-md grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="founders-price">Price (R)</Label>
                <Input id="founders-price" type="number" min={5} step="1" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="founders-total">Total passes</Label>
                <Input id="founders-total" type="number" min={Math.max(settings.claimed, 1)} step="1" value={total} onChange={(e) => setTotal(e.target.value)} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              A new price applies to payments started after you save. Posters that print the price or the total need reprinting if you change them.
            </p>
            <Button onClick={saveSettings} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Save settings
            </Button>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Refunds</CardTitle>
          <CardDescription>
            Paid, but no pass could be issued. Refund each payment in the PayFast dashboard, then mark it refunded
            here. {refundsDue.length} waiting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {refunds.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">No refunds.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>PayFast reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.email ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.paid_at ? format(new Date(r.paid_at), "d MMM yyyy HH:mm") : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">R{Number(r.amount).toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.payfast_payment_id ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "refund_due" ? "destructive" : "secondary"}>
                          {r.status === "refund_due" ? "Refund due" : "Refunded"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "refund_due" && (
                          <Button size="sm" onClick={() => markRefunded(r)} disabled={busy === r.id}>
                            <Check className="mr-1 h-4 w-4" aria-hidden /> Mark refunded
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Founders</CardTitle>
          <CardDescription>Newest first. Source is the poster or link the buyer came from.</CardDescription>
        </CardHeader>
        <CardContent>
          {passes.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">No passes claimed yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Claimed</TableHead>
                    <TableHead>Deals until</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {passes.map((p) => (
                    <TableRow key={p.pass_number}>
                      <TableCell className="font-medium tabular-nums">{String(p.pass_number).padStart(4, "0")}</TableCell>
                      <TableCell>{p.email ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(p.claimed_at), "d MMM yyyy")}</TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(p.expires_at), "d MMM yyyy")}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.source ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
