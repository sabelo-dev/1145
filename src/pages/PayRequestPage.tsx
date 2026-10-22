import React, { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Coins, CreditCard, Loader2, Lock } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SEO from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { formatMinor } from "@/lib/money";
import {
  fetchPayOptions, fetchPublicPaymentRequest, payPaymentRequest, payWithSavedCard, payWithUcoin,
} from "@/services/merchantAi";

const CONFIRM_WAIT_MS = 120_000;

type Choice = { kind: "ucoin" } | { kind: "card"; id: string; label: string };

const cardLabel = (c: { brand: string | null; last4: string | null }) => `${c.brand || "Card"} •••• ${c.last4 || "????"}`;

/**
 * Where a store's 1145 Pay link or QR code leads. Anyone can pay on PayFast;
 * a signed-in 1145 member can also pay in one tap with a card saved in their
 * 1145 Wallet or with UCoin. Nothing is shown as paid until 1145 has the
 * payment confirmed: PayFast's notification for checkout, PayFast's server
 * answer for saved cards, or the database transaction for UCoin.
 */
const PayRequestPage: React.FC = () => {
  const { token = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const returned = searchParams.get("status") === "returned";
  const cancelled = searchParams.get("status") === "cancelled";
  const [starting, setStarting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [confirm, setConfirm] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());
  const validToken = /^[0-9a-f]{36}$/.test(token);

  const request = useQuery({
    queryKey: ["payment-request-public", token],
    queryFn: () => fetchPublicPaymentRequest(token),
    enabled: validToken,
    // After PayFast, check every few seconds for up to two minutes.
    refetchInterval: (query) =>
      returned && query.state.data?.status === "pending" && Date.now() - openedAt < CONFIRM_WAIT_MS ? 3000 : false,
  });
  const waitedLong = request.dataUpdatedAt - openedAt >= CONFIRM_WAIT_MS - 5000;

  const data = request.data;
  const status = data && data.status === "pending" && new Date(data.expires_at).getTime() <= Date.now() ? "expired" : data?.status;

  const options = useQuery({
    queryKey: ["payment-request-options", token, user?.id],
    queryFn: () => fetchPayOptions(token),
    enabled: validToken && !!user && status === "pending" && !returned,
  });
  const ucoin = options.data?.ucoin;
  const cards = options.data?.cards ?? [];

  const payOnPayFast = async () => {
    setStarting(true);
    setError(null);
    try {
      await payPaymentRequest(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the payment");
      setStarting(false);
    }
  };

  const payNow = async (choice: Choice) => {
    setConfirm(null);
    setPaying(true);
    setError(null);
    try {
      if (choice.kind === "ucoin") await payWithUcoin(token);
      else await payWithSavedCard(token, choice.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The payment did not go through");
    } finally {
      setPaying(false);
      // Show what the database now says (paid, or still open after a failure).
      await queryClient.invalidateQueries({ queryKey: ["payment-request-public", token] });
      await queryClient.invalidateQueries({ queryKey: ["payment-request-options", token] });
    }
  };

  const busy = starting || paying;

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

                    {/* One-tap options for signed-in 1145 members */}
                    {user && options.isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
                    {user && options.data?.pending_attempt && (
                      <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        A card payment for this is being checked. Please don't pay again; contact support@1145.io if it doesn't update soon.
                      </p>
                    )}
                    {user && options.data?.signed_in && !options.data.pending_attempt && (
                      <div className="space-y-2 text-left">
                        {ucoin && (
                          <Button variant="outline" className="h-auto w-full justify-start gap-3 py-3" disabled={busy || !ucoin.allowed || !ucoin.enough}
                            onClick={() => setConfirm({ kind: "ucoin" })}>
                            <Coins className="h-5 w-5 shrink-0 text-amber-500" />
                            <span className="flex flex-col items-start">
                              <span className="font-medium">Pay with {ucoin.needed.toLocaleString("en-ZA")} UCoin</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                {!ucoin.allowed
                                  ? "Not available for your own store"
                                  : ucoin.enough
                                    ? `You have ${ucoin.balance.toLocaleString("en-ZA")} UCoin · R0.10 each`
                                    : `You have ${ucoin.balance.toLocaleString("en-ZA")} UCoin; ${(ucoin.needed - ucoin.balance).toLocaleString("en-ZA")} more needed`}
                              </span>
                            </span>
                          </Button>
                        )}
                        {cards.map((c) => (
                          <Button key={c.id} variant="outline" className="h-auto w-full justify-start gap-3 py-3" disabled={busy}
                            onClick={() => setConfirm({ kind: "card", id: c.id, label: cardLabel(c) })}>
                            <CreditCard className="h-5 w-5 shrink-0 text-primary" />
                            <span className="flex flex-col items-start">
                              <span className="font-medium">Pay with {cardLabel(c)}</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                Saved in your 1145 Wallet{c.exp_month && c.exp_year ? ` · expires ${String(c.exp_month).padStart(2, "0")}/${String(c.exp_year).slice(-2)}` : ""}
                              </span>
                            </span>
                          </Button>
                        ))}
                        {(ucoin || cards.length > 0) && <p className="py-1 text-center text-xs text-muted-foreground">or</p>}
                      </div>
                    )}

                    {paying ? (
                      <div className="flex items-center justify-center gap-2 py-3 text-sm"><Loader2 className="h-5 w-5 animate-spin" /> Processing your payment…</div>
                    ) : (
                      <Button size="lg" className="h-12 w-full gap-2" onClick={payOnPayFast} disabled={busy || !!options.data?.pending_attempt}>
                        {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                        Pay securely with PayFast
                      </Button>
                    )}
                    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

                    {!user && (
                      <p className="text-sm">
                        <Link to={`/login?redirect=${encodeURIComponent(`/pay/${token}`)}`} className="font-medium text-primary underline-offset-4 hover:underline">
                          Sign in to pay with your 1145 card or UCoin
                        </Link>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Card details are handled by PayFast; 1145 never sees them.
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

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm payment</AlertDialogTitle>
            <AlertDialogDescription>
              {data && confirm && (confirm.kind === "ucoin"
                ? `Pay ${formatMinor(data.amount_minor)} to ${data.store_name} with ${ucoin?.needed.toLocaleString("en-ZA")} UCoin? This can't be undone here.`
                : `Pay ${formatMinor(data.amount_minor)} to ${data.store_name} with ${confirm.label}?`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && void payNow(confirm)}>
              Pay {data ? formatMinor(data.amount_minor) : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PayRequestPage;
