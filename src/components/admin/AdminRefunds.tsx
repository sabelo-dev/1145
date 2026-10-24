import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  REFUND_STATUS_LABELS,
  type RefundRequest,
  type RefundRequestItem,
  completeRefundRequest,
  decideRefundRequest,
  formatRand,
  listRefundRequests,
  reasonLabel,
} from "@/services/refunds";

type Action = { kind: "approve" | "reject" | "complete"; request: RefundRequest };

interface OrderInfo {
  total: number;
  ucoin_value_zar: number;
  payment_gateway: string | null;
}

/**
 * Refund and return requests from customers. Approving takes the order out of
 * merchant payouts. The money itself is refunded by hand in the PayFast
 * dashboard; then record the PayFast reference here with "Mark refunded".
 */
export default function AdminRefunds() {
  const { toast } = useToast();
  const [status, setStatus] = useState("requested");
  const [rows, setRows] = useState<RefundRequest[]>([]);
  const [customers, setCustomers] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<Record<string, OrderInfo>>({});
  const [products, setProducts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<Action | null>(null);
  const [amount, setAmount] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRefundRequests({ status });
      setRows(data);
      const userIds = [...new Set(data.map((r) => r.user_id))];
      const orderIds = [...new Set(data.map((r) => r.order_id))];
      const productIds = [
        ...new Set(data.flatMap((r) => (r.items as unknown as RefundRequestItem[]).map((i) => i.product_id))),
      ];
      const [profilesRes, ordersRes, productsRes] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("id, email, name").in("id", userIds) : { data: [] },
        orderIds.length
          ? supabase.from("orders").select("id, total, ucoin_value_zar, payment_gateway").in("id", orderIds)
          : { data: [] },
        productIds.length ? supabase.from("products").select("id, name").in("id", productIds) : { data: [] },
      ]);
      setCustomers(Object.fromEntries((profilesRes.data ?? []).map((p) => [p.id, p.email ?? p.name ?? p.id])));
      setOrders(Object.fromEntries((ordersRes.data ?? []).map((o) => [o.id, o as OrderInfo])));
      setProducts(Object.fromEntries((productsRes.data ?? []).map((p) => [p.id, p.name])));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not load requests",
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const open = (kind: Action["kind"], request: RefundRequest) => {
    setAction({ kind, request });
    setAmount(String(request.amount_approved ?? request.amount_requested));
    setText("");
  };

  const submit = async () => {
    if (!action) return;
    setBusy(true);
    try {
      if (action.kind === "approve") await decideRefundRequest(action.request.id, true, text, Number(amount));
      if (action.kind === "reject") await decideRefundRequest(action.request.id, false, text);
      if (action.kind === "complete") await completeRefundRequest(action.request.id, text);
      toast({
        title: { approve: "Request approved", reject: "Request declined", complete: "Marked as refunded" }[action.kind],
      });
      setAction(null);
      load();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  };

  const itemsText = (r: RefundRequest) =>
    (r.items as unknown as RefundRequestItem[])
      .map((i) => `${products[i.product_id] ?? "Item"} × ${i.quantity}`)
      .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Refunds &amp; Returns</CardTitle>
        <CardDescription>
          Approve or decline customer requests. After approving, refund the money in the PayFast dashboard, then mark
          the request refunded with the PayFast reference. Approved and refunded orders are left out of merchant payouts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList className="flex-wrap h-auto">
            {["requested", "approved", "rejected", "completed", "withdrawn"].map((s) => (
              <TabsTrigger key={s} value={s}>
                {REFUND_STATUS_LABELS[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No requests here.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type and reason</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const order = orders[r.order_id];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(r.created_at), "d MMM yyyy HH:mm")}</TableCell>
                      <TableCell className="font-mono text-xs">#{r.order_id.slice(0, 8).toUpperCase()}</TableCell>
                      <TableCell>{customers[r.user_id] ?? "Unknown"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="mr-2 capitalize">
                          {r.kind}
                        </Badge>
                        {reasonLabel(r.reason)}
                        {r.note && <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>}
                        {r.decision_note && <p className="mt-1 text-xs">Decision: {r.decision_note}</p>}
                        {r.refund_reference && <p className="mt-1 text-xs">PayFast ref: {r.refund_reference}</p>}
                      </TableCell>
                      <TableCell className="max-w-[16rem] text-sm">{itemsText(r)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="font-medium">{formatRand(r.amount_approved ?? r.amount_requested)}</div>
                        {order && (
                          <div className="text-xs text-muted-foreground">
                            of {formatRand(order.total)}
                            {Number(order.ucoin_value_zar) > 0 && <>, {formatRand(order.ucoin_value_zar)} in UCoin</>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right space-x-2">
                        {(r.status === "requested" || r.status === "rejected") && (
                          <>
                            <Button size="sm" onClick={() => open("approve", r)}>
                              Approve
                            </Button>
                            {r.status === "requested" && (
                              <Button size="sm" variant="outline" onClick={() => open("reject", r)}>
                                Decline
                              </Button>
                            )}
                          </>
                        )}
                        {r.status === "approved" && (
                          <Button size="sm" onClick={() => open("complete", r)}>
                            Mark refunded
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action?.kind === "approve" && "Approve refund"}
              {action?.kind === "reject" && "Decline request"}
              {action?.kind === "complete" && "Mark as refunded"}
            </DialogTitle>
            <DialogDescription>
              {action?.kind === "approve" &&
                "The customer is told the money is on its way. Refund it in PayFast next."}
              {action?.kind === "reject" && "The customer sees this reason and can send a new request."}
              {action?.kind === "complete" &&
                `Refund ${formatRand(action.request.amount_approved)} in the PayFast dashboard first, then enter its reference.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {action?.kind === "approve" && (
              <div className="space-y-1">
                <Label htmlFor="refund-amount">Amount to refund (R)</Label>
                <Input
                  id="refund-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            )}
            {action?.kind === "complete" ? (
              <div className="space-y-1">
                <Label htmlFor="refund-reference">PayFast refund reference</Label>
                <Input id="refund-reference" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="refund-note">
                  {action?.kind === "reject" ? "Reason (shown to the customer)" : "Note (optional, shown to the customer)"}
                </Label>
                <Textarea id="refund-note" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={busy}>
              Back
            </Button>
            <Button
              onClick={submit}
              disabled={busy || (action?.kind !== "approve" && !text.trim()) || (action?.kind === "approve" && !(Number(amount) > 0))}
            >
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
