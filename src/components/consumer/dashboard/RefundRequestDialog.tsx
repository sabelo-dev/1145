import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  REFUND_REASONS,
  REFUND_STATUS_LABELS,
  type RefundRequest,
  formatRand,
  reasonLabel,
  requestRefund,
  withdrawRefundRequest,
} from "@/services/refunds";

interface OrderProduct {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface RefundRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: { id: string; status: string; total: number; products: OrderProduct[] } | null;
  /** The latest request for this order, if any. */
  request: RefundRequest | null;
  onChanged: () => void;
}

const RefundRequestDialog: React.FC<RefundRequestDialogProps> = ({ open, onOpenChange, order, request, onChanged }) => {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && order) {
      setReason("");
      setNote("");
      setSelected(order.products.map((p) => p.id));
    }
  }, [open, order]);

  const isReturn = order?.status === "delivered";
  // A declined or withdrawn request can be followed by a new one.
  const showStatus = request && !["rejected", "withdrawn"].includes(request.status);
  const amount = useMemo(
    () =>
      Math.min(
        (order?.products ?? []).filter((p) => selected.includes(p.id)).reduce((sum, p) => sum + p.price * p.quantity, 0),
        order?.total ?? 0,
      ),
    [order, selected],
  );

  if (!order) return null;

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));

  const submit = async () => {
    setBusy(true);
    try {
      await requestRefund(order.id, reason, note, selected);
      toast({
        title: isReturn ? "Return requested" : "Refund requested",
        description: "We'll let you know once it has been reviewed.",
      });
      onChanged();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not send your request",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!request) return;
    setBusy(true);
    try {
      await withdrawRefundRequest(request.id);
      toast({ title: "Request withdrawn" });
      onChanged();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not withdraw",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isReturn ? "Return items" : "Request a refund"}</DialogTitle>
          <DialogDescription>Order #{order.id.slice(0, 8).toUpperCase()}</DialogDescription>
        </DialogHeader>

        {showStatus ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={request.status === "completed" ? "default" : "secondary"}>
                {REFUND_STATUS_LABELS[request.status] ?? request.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reason</span>
              <span>{reasonLabel(request.reason)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{formatRand(request.amount_approved ?? request.amount_requested)}</span>
            </div>
            {request.decision_note && (
              <p className="rounded-md bg-muted p-3">{request.decision_note}</p>
            )}
            {request.status === "approved" && (
              <p className="text-muted-foreground">
                The refund goes back to the card or account you paid with. It can take a few working days to show.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {request?.status === "rejected" && (
              <p className="rounded-md bg-muted p-3 text-sm">
                Your last request was declined{request.decision_note ? `: ${request.decision_note}` : "."} You can send a new one.
              </p>
            )}
            <div className="space-y-2">
              <Label>Which items?</Label>
              {order.products.map((p) => (
                <label key={p.id} className="flex items-center gap-3 text-sm">
                  <Checkbox checked={selected.includes(p.id)} onCheckedChange={(on) => toggle(p.id, on === true)} />
                  <span className="flex-1">
                    {p.name} × {p.quantity}
                  </span>
                  <span className="text-muted-foreground">{formatRand(p.price * p.quantity)}</span>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund-reason">Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="refund-reason">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REFUND_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund-note">Anything else we should know? (optional)</Label>
              <Textarea id="refund-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">You'll ask for</span>
              <span className="font-semibold">{formatRand(amount)}</span>
            </div>
            {isReturn && (
              <p className="text-xs text-muted-foreground">
                Returns are accepted up to 30 days after delivery. Once approved, we'll tell you how to send the items back.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {showStatus ? (
            request.status === "requested" && (
              <Button variant="outline" onClick={withdraw} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Withdraw request
              </Button>
            )
          ) : (
            <Button onClick={submit} disabled={busy || !reason || selected.length === 0}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send request
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RefundRequestDialog;
