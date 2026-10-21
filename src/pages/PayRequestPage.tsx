import React, { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SEO from "@/components/SEO";
import { formatMinor } from "@/services/serviceMarketplace";
import { fetchPublicPaymentRequest, payPaymentRequest } from "@/services/merchantAi";

const CONFIRM_WAIT_MS = 120_000;

/**
 * Where a store's payment link or QR code leads. Coming back from PayFast does
 * not mark anything paid: the page waits for PayFast's confirmation to reach
 * 1145 and only then says "Paid".
 */
const PayRequestPage: React.FC = () => {
  const { token = "" } = useParams();
  const [searchParams] = useSearchParams();
  const returned = searchParams.get("status") === "returned";
  const cancelled = searchParams.get("status") === "cancelled";
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());

  const request = useQuery({
    queryKey: ["payment-request-public", token],
    queryFn: () => fetchPublicPaymentRequest(token),
    enabled: /^[0-9a-f]{36}$/.test(token),
    // After PayFast, check every few seconds for up to two minutes.
    refetchInterval: (query) =>
      returned && query.state.data?.status === "pending" && Date.now() - openedAt < CONFIRM_WAIT_MS ? 3000 : false,
  });
  const waitedLong = request.dataUpdatedAt - openedAt >= CONFIRM_WAIT_MS - 5000;

  const data = request.data;
  const status = data && data.status === "pending" && new Date(data.expires_at).getTime() <= Date.now() ? "expired" : data?.status;

  const pay = async () => {
    setStarting(true);
    setError(null);
    try {
      await payPaymentRequest(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the payment");
      setStarting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <SEO title="1145 Pay" description="Secure payment with 1145 Pay" />
      <Card className="w-full max-w-sm">
        {request.isLoading ? (
          <CardContent className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></CardContent>
        ) : !data ? (
          <CardContent className="p-8 text-center text-muted-foreground">This payment link is not valid.</CardContent>
        ) : (
          <>
            <CardHeader className="text-center">
              {data.store_logo_url && <img src={data.store_logo_url} alt="" className="mx-auto mb-2 h-14 w-14 rounded-full object-cover" />}
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">1145 Pay</p>
              <CardDescription>{data.store_name}</CardDescription>
              <CardTitle className="text-3xl">{formatMinor(data.amount_minor)}</CardTitle>
              <p className="text-sm">{data.description}{data.reference ? ` · Ref ${data.reference}` : ""}</p>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              {status === "paid" || status === "refund_due" ? (
                <div className="space-y-2">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
                  <p className="text-lg font-semibold">Paid</p>
                  {data.paid_at && <p className="text-sm text-muted-foreground">{format(new Date(data.paid_at), "d MMM yyyy, HH:mm")}</p>}
                </div>
              ) : status === "pending" ? (
                returned ? (
                  <div className="space-y-2">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                    <p>Confirming your payment with PayFast…</p>
                    {waitedLong && (
                      <p className="text-sm text-muted-foreground">
                        This is taking longer than usual. If you were charged, the store will see it shortly; you don't need to pay again.
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    {cancelled && <p className="text-sm text-muted-foreground">Payment was cancelled. You can try again.</p>}
                    <Button size="lg" className="h-12 w-full gap-2" onClick={pay} disabled={starting}>
                      {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                      Pay securely with PayFast
                    </Button>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <p className="text-xs text-muted-foreground">
                      You pay on PayFast's secure page. 1145 never sees your card details.
                      Link expires {format(new Date(data.expires_at), "d MMM, HH:mm")}.
                    </p>
                  </>
                )
              ) : (
                <p className="text-muted-foreground">
                  This payment link has {status === "cancelled" ? "been cancelled" : "expired"}. Ask {data.store_name} for a new one.
                </p>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
};

export default PayRequestPage;
