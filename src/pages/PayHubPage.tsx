import React, { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowRight, Coins, CreditCard, Lock, QrCode, ScanLine, ShieldCheck, Smartphone, Store, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import SEO from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { formatMinor } from "@/lib/money";
import { fetchMyPayPayments, fetchPayWallet, parsePayCode } from "@/services/merchantAi";
import PayQrScanner from "@/components/pay/PayQrScanner";
import { canScanInBrowser } from "@/lib/qrScan";

const PAID_WITH: Record<string, string> = { card: "Saved card", ucoin: "UCoin", payfast: "PayFast" };

const WAYS = [
  { icon: CreditCard, title: "Saved card", text: "Pay in one tap with a card from your 1145 Wallet. Your card details stay with PayFast." },
  { icon: Coins, title: "UCoin", text: "Spend the UCoin you've earned: every 10 UCoin is worth R1." },
  { icon: Lock, title: "PayFast", text: "Card, instant EFT and more on PayFast's secure page. No account needed." },
];

/**
 * 1145 Pay for everyone: scan a store's QR code or paste its link, see how you
 * can pay, and (signed in) your UCoin, saved cards and recent payments.
 */
const PayHubPage: React.FC = () => {
  const { user, isMerchant } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const wallet = useQuery({ queryKey: ["pay-wallet", user?.id], queryFn: () => fetchPayWallet(user!.id), enabled: !!user });
  const history = useQuery({ queryKey: ["my-1145-pay"], queryFn: fetchMyPayPayments, enabled: !!user, retry: false });

  const openCode = useCallback((value: string) => navigate(`/pay/${value}`), [navigate]);

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parsePayCode(code);
    if (!parsed) {
      setCodeError("Paste the full 1145 Pay link the store sent you (it contains /pay/).");
      return;
    }
    openCode(parsed);
  };

  return (
    <div className="pb-16">
      <SEO title="1145 Pay" description="Pay any 1145 store in seconds: scan the QR code, then pay with a saved card, UCoin or PayFast." />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f2a4d] via-[#173d6e] to-[#2a78d6] text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur">
              <Zap className="h-4 w-4" aria-hidden /> Fast, safe, cashless
            </p>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">1145 Pay</h1>
            <p className="max-w-md text-lg text-white/85">
              Pay any 1145 store in seconds. Scan the store's QR code, then pay with a saved card, your UCoin or PayFast.
            </p>
            <div className="flex flex-wrap gap-3">
              {canScanInBrowser ? (
                <Button size="lg" className="h-12 gap-2 bg-white text-[#0f2a4d] hover:bg-white/90" onClick={() => setScanning(true)}>
                  <ScanLine className="h-5 w-5" /> Scan to pay
                </Button>
              ) : (
                <p className="flex max-w-sm items-start gap-2 rounded-lg bg-white/10 p-3 text-sm backdrop-blur">
                  <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  Point your phone's camera at the store's 1145 Pay QR code; it opens the payment straight away.
                </p>
              )}
              {!user && (
                <Button size="lg" variant="outline" className="h-12 border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild>
                  <Link to={`/login?redirect=${encodeURIComponent("/1145pay")}`}>Sign in for one-tap pay</Link>
                </Button>
              )}
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
              <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" aria-hidden /> Secured by PayFast</li>
              <li className="flex items-center gap-1.5"><Lock className="h-4 w-4" aria-hidden /> 1145 never sees your card</li>
            </ul>
          </div>

          {/* Scanner or pay-code card */}
          <Card className="self-center border-0 bg-white/95 text-foreground shadow-2xl dark:bg-card">
            <CardContent className="space-y-4 p-5">
              {scanning ? (
                <PayQrScanner onCode={openCode} onClose={() => setScanning(false)} />
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#2a78d6]/40 bg-[#2a78d6]/5 text-center">
                  <QrCode className="h-16 w-16 text-[#2a78d6]" aria-hidden />
                  <p className="px-6 text-sm text-muted-foreground">Every 1145 store can show you a QR code or send you a link to pay.</p>
                  {canScanInBrowser && (
                    <Button variant="outline" className="gap-2" onClick={() => setScanning(true)}><ScanLine className="h-4 w-4" /> Open camera</Button>
                  )}
                </div>
              )}
              <form className="space-y-2" onSubmit={submitCode}>
                <label htmlFor="pay-code" className="text-sm font-medium">Got a payment link?</label>
                <div className="flex gap-2">
                  <Input id="pay-code" value={code} onChange={(e) => { setCode(e.target.value); setCodeError(null); }}
                    placeholder="Paste the 1145 Pay link" className="h-11" autoComplete="off" />
                  <Button type="submit" className="h-11 gap-1">Pay <ArrowRight className="h-4 w-4" /></Button>
                </div>
                {codeError && <p className="text-sm text-destructive" role="alert">{codeError}</p>}
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 pt-10">
        {/* Signed in: wallet and history */}
        {user && (
          <section className="grid gap-4 md:grid-cols-3" aria-label="Your 1145 Pay">
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <span className="rounded-full bg-amber-100 p-3 dark:bg-amber-950"><Coins className="h-6 w-6 text-amber-600" aria-hidden /></span>
                <div>
                  <p className="text-sm text-muted-foreground">Your UCoin</p>
                  <p className="text-2xl font-semibold">{wallet.data ? wallet.data.ucoin.toLocaleString("en-ZA") : "…"}</p>
                  {wallet.data && <p className="text-xs text-muted-foreground">Worth {formatMinor(wallet.data.ucoin * 10)} at 1145 stores</p>}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <span className="rounded-full bg-sky-100 p-3 dark:bg-sky-950"><CreditCard className="h-6 w-6 text-sky-600" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">Saved cards</p>
                  <p className="truncate text-2xl font-semibold">
                    {wallet.data ? (wallet.data.cards.length ? wallet.data.cards.map((c) => `•••• ${c.last4 ?? "????"}`).join(", ") : "None yet") : "…"}
                  </p>
                  <Link to="/wallet" className="text-xs font-medium text-primary hover:underline">
                    {wallet.data?.cards.length ? "Manage cards" : "Add a card for one-tap pay"}
                  </Link>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-5">
                <p className="text-sm text-muted-foreground">Recent 1145 Pay payments</p>
                {history.data?.length ? (
                  <ul className="space-y-2">
                    {history.data.slice(0, 3).map((p) => (
                      <li key={p.token} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.store_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(p.paid_at), "d MMM, HH:mm")}{p.paid_with ? ` · ${PAID_WITH[p.paid_with]}` : ""}
                          </span>
                        </span>
                        <span className="font-semibold">{formatMinor(p.amount_minor)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm">{history.isLoading ? "Loading…" : "Your payments to stores will show here."}</p>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Ways to pay */}
        <section className="space-y-6" aria-labelledby="ways-title">
          <div className="text-center">
            <h2 id="ways-title" className="text-2xl font-bold md:text-3xl">Pay your way</h2>
            <p className="text-muted-foreground">Choose how to pay on the store's payment page.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {WAYS.map((w) => (
              <Card key={w.title} className="transition-shadow hover:shadow-md">
                <CardContent className="space-y-3 p-6">
                  <span className="inline-flex rounded-xl bg-gradient-to-br from-[#0f2a4d] to-[#2a78d6] p-3 text-white"><w.icon className="h-6 w-6" aria-hidden /></span>
                  <h3 className="text-lg font-semibold">{w.title}</h3>
                  <p className="text-sm text-muted-foreground">{w.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="grid gap-6 rounded-3xl bg-muted/50 p-6 md:grid-cols-3 md:p-10" aria-label="How 1145 Pay works">
          {[
            { n: "1", title: "Scan or open the link", text: "The store shows a QR code or sends you a link with the amount." },
            { n: "2", title: "Check and choose", text: "See the store and amount, then pick a saved card, UCoin or PayFast." },
            { n: "3", title: "Done", text: "The store sees your payment as soon as it's confirmed. No cash, no change." },
          ].map((s) => (
            <div key={s.n} className="space-y-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#2a78d6] font-bold text-white">{s.n}</span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </section>

        {/* Merchants */}
        <section className="flex flex-col items-start justify-between gap-4 rounded-3xl border p-6 md:flex-row md:items-center md:p-8">
          <div className="flex items-start gap-4">
            <span className="rounded-xl bg-muted p-3"><Store className="h-6 w-6" aria-hidden /></span>
            <div>
              <h2 className="text-xl font-semibold">Take 1145 Pay in your store</h2>
              <p className="text-sm text-muted-foreground">Create a payment link or QR code in seconds and get paid by card, UCoin or PayFast.</p>
            </div>
          </div>
          <Button asChild size="lg" className="gap-2">
            <Link to={isMerchant ? "/merchant/dashboard?tab=payment-requests" : "/merchant/register"}>
              {isMerchant ? "Open 1145 Pay" : "Sell on 1145"} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
};

export default PayHubPage;
