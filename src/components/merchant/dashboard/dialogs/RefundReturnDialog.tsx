import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  REFUND_STATUS_LABELS,
  type RefundRequest,
  decideRefundRequest,
  formatRand,
  listRefundRequests,
  reasonLabel,
} from "@/services/refunds";

interface RefundReturnDialogProps {
  order: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated: () => void;
}

/**
 * The customer's refund or return request for this order. Store owners and
 * managers approve or decline it; 1145 then refunds the payment. Merchants
 * cannot start a refund themselves.
 */
const RefundReturnDialog: React.FC<RefundReturnDialogProps> = ({ order, open, onOpenChange, onOrderUpdated }) => {
  const { toast } = useToast();
  const [request, setRequest] = useState<RefundRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open || !order?.id) return;
    setLoading(true);
    setNote("");
    listRefundRequests({ orderIds: [order.id] })
      .then((rows) => {
        setRequest(rows[0] ?? null);
        setAmount(String(rows[0]?.amount_requested ?? ""));
      })
      .catch(() => setRequest(null))
      .finally(() => setLoading(false));
  }, [open, order?.id]);

  const decide = async (approve: boolean) => {
    if (!request) return;
    setBusy(true);
    try {
      await decideRefundRequest(request.id, approve, note, approve ? Number(amount) : undefined);
      toast({ title: approve ? "Request approved" : "Request declined" });
      onOrderUpdated();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Refunds &amp; Returns</DialogTitle>
          <DialogDescription>Order #{String(order?.id ?? "").slice(0, 8).toUpperCase()}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !request ? (
          <p className="text-sm text-muted-foreground">
            The customer hasn't asked for a refund or return on this order. Customers request one from My Orders, and
            it appears here for you to review.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Request</span>
              <span className="capitalize">
                {request.kind} · <Badge variant="secondary">{REFUND_STATUS_LABELS[request.status] ?? request.status}</Badge>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reason</span>
              <span>{reasonLabel(request.reason)}</span>
            </div>
            {request.note && <p className="rounded-md bg-muted p-3">{request.note}</p>}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{formatRand(request.amount_approved ?? request.amount_requested)}</span>
            </div>
            {request.decision_note && <p>Decision: {request.decision_note}</p>}

            {request.status === "requested" && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="merchant-refund-amount">Amount to refund (R)</Label>
                  <Input
                    id="merchant-refund-amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="merchant-refund-note">Note to the customer (needed to decline)</Label>
                  <Textarea
                    id="merchant-refund-note"
                    value={note}
                    maxLength={1000}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Only the store owner or a manager can decide. Approved refunds are left out of your payouts.
                </p>
              </>
            )}
          </div>
        )}

        {request?.status === "requested" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => decide(false)} disabled={busy || !note.trim()}>
              Decline
            </Button>
            <Button onClick={() => decide(true)} disabled={busy || !(Number(amount) > 0)}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RefundReturnDialog;
