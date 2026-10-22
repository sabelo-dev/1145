import React, { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Loader2, QrCode, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMerchantAccess } from "@/hooks/useMerchantAccess";
import { formatMinor, parseMinor } from "@/lib/money";
import {
  cancelPaymentRequest,
  canUse,
  createPaymentRequest,
  effectiveStatus,
  fetchPaymentRequests,
  newRequestKey,
  paymentLink,
  type PaymentRequest,
} from "@/services/merchantAi";
import StoreSwitcher from "./StoreSwitcher";

const EXPIRY_OPTIONS = [
  { minutes: 30, label: "30 minutes" },
  { minutes: 120, label: "2 hours" },
  { minutes: 1440, label: "1 day" },
  { minutes: 10080, label: "7 days" },
];

const STATUS: Record<PaymentRequest["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Waiting", variant: "outline" },
  paid: { label: "Paid", variant: "default" },
  expired: { label: "Expired", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "secondary" },
  refund_due: { label: "Paid after cancelling", variant: "destructive" },
};

/**
 * Ask a customer to pay by link or QR code. The customer pays on PayFast;
 * "Paid" appears only after PayFast confirms the payment to 1145.
 */
const MerchantPaymentRequests: React.FC = () => {
  const { stores, current, setStoreId } = useMerchantAccess();
  const queryClient = useQueryClient();
  const storeId = current?.store_id;
  const allowed = canUse(current, "payments", "payment_requests");

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [expiry, setExpiry] = useState("120");
  const [showing, setShowing] = useState<PaymentRequest | null>(null);
  // Reused if the same form is submitted again after a failure.
  const requestKey = useRef(newRequestKey());

  const list = useQuery({
    queryKey: ["merchant-payment-requests", storeId],
    queryFn: () => fetchPaymentRequests(storeId!),
    enabled: !!storeId && allowed,
    refetchInterval: (query) => (query.state.data?.some((r) => effectiveStatus(r) === "pending") ? 10_000 : false),
  });

  const create = useMutation({
    mutationFn: () => {
      const amountMinor = parseMinor(amount);
      if (amountMinor === null) throw new Error("Enter an amount like 129.00");
      return createPaymentRequest({
        storeId: storeId!,
        amountMinor,
        description: description.trim(),
        reference: reference.trim() || undefined,
        expiresInMinutes: Number(expiry),
        requestKey: requestKey.current,
      });
    },
    onSuccess: (created) => {
      requestKey.current = newRequestKey();
      setAmount("");
      setDescription("");
      setReference("");
      setShowing(created);
      queryClient.invalidateQueries({ queryKey: ["merchant-payment-requests", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancel = useMutation({
    mutationFn: cancelPaymentRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["merchant-payment-requests", storeId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  // Keep the open QR dialog in step with the list, so it turns to "Paid" when PayFast confirms.
  const live = showing ? list.data?.find((r) => r.id === showing.id) ?? showing : null;

  if (!current || !allowed) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          1145 Pay is not switched on for this store, or your role does not include payments.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <StoreSwitcher stores={stores} current={current} onChange={setStoreId} />

      <Card>
        <CardHeader>
          <CardTitle>New 1145 Pay request</CardTitle>
          <CardDescription>
            Customers scan with their smartphone camera and confirm payment with UCoin, a saved card, or PayFast.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="pr-amount">Amount (R)</Label>
              <Input id="pr-amount" inputMode="decimal" placeholder="129.00" value={amount}
                onChange={(e) => setAmount(e.target.value)} className="h-12 text-lg" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-description">What it is for</Label>
              <Input id="pr-description" maxLength={100} placeholder="Haircut and wash" value={description}
                onChange={(e) => setDescription(e.target.value)} className="h-12" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-reference">Your reference (optional)</Label>
              <Input id="pr-reference" maxLength={50} placeholder="INV-1042" value={reference}
                onChange={(e) => setReference(e.target.value)} className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-expiry">Link expires after</Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger id="pr-expiry" className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((o) => <SelectItem key={o.minutes} value={String(o.minutes)}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" size="lg" className="h-12 gap-2" disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Create link and QR code
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent 1145 Pay requests</CardTitle>
          <CardDescription>
            Money collected here is recorded for your store. How and when it is paid out to you is confirmed separately by 1145.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin" />}
          {list.data?.length === 0 && <p className="text-sm text-muted-foreground">No 1145 Pay requests yet.</p>}
          {list.data?.map((r) => {
            const status = effectiveStatus(r);
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.description}{r.reference ? ` · ${r.reference}` : ""}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "d MMM, HH:mm")}
                    {status === "paid" && r.paid_at ? ` · paid ${format(new Date(r.paid_at), "d MMM, HH:mm")}` : ""}
                    {status === "pending" ? ` · expires ${format(new Date(r.expires_at), "d MMM, HH:mm")}` : ""}
                  </p>
                </div>
                <span className="font-semibold">{formatMinor(r.amount_minor)}</span>
                <Badge variant={STATUS[status].variant}>{STATUS[status].label}</Badge>
                {status === "pending" && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowing(r)}>Show QR</Button>
                    <Button variant="ghost" size="sm" aria-label="Cancel link" disabled={cancel.isPending}
                      onClick={() => cancel.mutate(r.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!live} onOpenChange={(open) => !open && setShowing(null)}>
        {live && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{formatMinor(live.amount_minor)}</DialogTitle>
              <DialogDescription>{live.description}</DialogDescription>
            </DialogHeader>
            {effectiveStatus(live) === "paid" ? (
              <p className="rounded-md bg-primary/10 p-6 text-center text-lg font-semibold">Paid. 1145 confirmed the payment.</p>
            ) : effectiveStatus(live) === "pending" ? (
              <div className="space-y-4">
                <div className="flex justify-center rounded-md bg-white p-4">
                  <QRCodeSVG value={paymentLink(live.public_token)} size={240} level="M" marginSize={2} />
                </div>
                <p className="text-center text-sm text-muted-foreground">Waiting for payment…</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-2" onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(paymentLink(live.public_token));
                      toast.success("Link copied");
                    } catch {
                      toast.error("Could not copy the link");
                    }
                  }}>
                    <Copy className="h-4 w-4" /> Copy link
                  </Button>
                  {typeof navigator.share === "function" && (
                    <Button variant="outline" className="flex-1 gap-2" onClick={() =>
                      navigator.share({ title: live.description, url: paymentLink(live.public_token) }).catch(() => undefined)}>
                      <Share2 className="h-4 w-4" /> Share
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">This link is {STATUS[effectiveStatus(live)].label.toLowerCase()}.</p>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default MerchantPaymentRequests;
