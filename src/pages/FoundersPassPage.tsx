import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { withRedirect } from "@/lib/authRedirect";
import { isNative } from "@/lib/native";
import {
  claimFoundersPass,
  getFoundersAvailability,
  getMyFoundersPass,
  hasFoundersRefundDue,
  type FoundersAvailability,
  type FoundersPass,
} from "@/services/foundersPass";

const PERKS = [
  "A members-only deal from every shop, every month.",
  "Your own founder number, shown on your profile.",
  "Pay once. No monthly charge.",
];

/** PayFast usually confirms within seconds; keep checking for about 40 seconds. */
const CONFIRM_POLL_MS = 2000;
const CONFIRM_POLL_TRIES = 20;

const passNumber = (n: number) => String(n).padStart(4, "0");
const count = (n: number) => n.toLocaleString("en-ZA");
const rand = (amount: number) => `R${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" })
    .format(new Date(iso));

/**
 * /founders — where the "Scan to claim your number" poster QR code lands.
 * Shows how many passes are left, takes the payment through PayFast and then
 * shows the buyer their founder number. The number itself is assigned by the
 * database when payfast-itn confirms the payment, so this page only starts
 * the payment and waits for the pass to appear.
 */
const FoundersPassPage: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const claim = searchParams.get("claim");
  // Which poster the visitor scanned (the QR link's utm_content), kept on the order.
  const source = (searchParams.get("utm_content") || searchParams.get("src") || "").slice(0, 100) || null;
  const here = `/founders${source ? `?utm_content=${encodeURIComponent(source)}` : ""}`;

  const [availability, setAvailability] = useState<FoundersAvailability | null>(null);
  const [pass, setPass] = useState<FoundersPass | null>(null);
  const [refundDue, setRefundDue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  // After PayFast sends the buyer back, the confirmation can take a few seconds.
  const [confirming, setConfirming] = useState(claim === "success");
  const unmounted = useRef(false);
  const userId = user?.id ?? null;

  /** Loads the counter and the user's pass. Returns true once the payment has an outcome. */
  const load = useCallback(async (): Promise<boolean> => {
    const [nextAvailability, nextPass, nextRefundDue] = await Promise.all([
      getFoundersAvailability(),
      userId ? getMyFoundersPass(userId) : Promise.resolve(null),
      userId ? hasFoundersRefundDue(userId) : Promise.resolve(false),
    ]);
    if (unmounted.current) return true;
    setAvailability(nextAvailability);
    setPass(nextPass);
    setRefundDue(nextRefundDue);
    setLoading(false);
    return Boolean(nextPass) || nextRefundDue;
  }, [userId]);

  useEffect(() => {
    unmounted.current = false;
    return () => { unmounted.current = true; };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let tries = 0;

    const run = async () => {
      const settled = await load();
      if (stopped) return;
      tries += 1;
      // Back from PayFast: keep checking until the pass (or a refund) shows up.
      if (claim === "success" && userId && !settled && tries < CONFIRM_POLL_TRIES) {
        timer = setTimeout(run, CONFIRM_POLL_MS);
      } else {
        setConfirming(false);
      }
    };
    void run();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [authLoading, claim, userId, load]);

  useEffect(() => {
    if (claim === "cancelled") {
      toast({ title: "Payment cancelled", description: "No pass was bought and you were not charged." });
    }
    // Runs once for the visit that returned from PayFast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startClaim = async () => {
    setPaying(true);
    try {
      await claimFoundersPass(source);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not start the payment",
        description: error instanceof Error ? error.message : "Something went wrong",
      });
      setPaying(false);
      void load();
    }
  };

  const total = availability?.total ?? 1000;
  const price = availability?.price ?? 0;
  const remaining = availability?.remaining ?? 0;
  const soldOut = availability !== null && availability.remaining <= 0;
  const onSale = availability !== null && availability.is_open && !soldOut;
  // Store billing rules: digital memberships are not sold inside the iOS / Android apps.
  const native = isNative();

  let action: React.ReactNode;
  if (native) {
    action = <p className="mt-6 text-sm text-text-secondary">Founders Passes cannot be bought in the app.</p>;
  } else if (soldOut) {
    action = <p className="mt-6 text-sm text-text-secondary">All passes have been claimed. No more are issued.</p>;
  } else if (!onSale) {
    action = <p className="mt-6 text-sm text-text-secondary">Founders Passes are not on sale right now. Check back soon.</p>;
  } else if (claim === "success") {
    action = null; // A payment is already on its way; do not invite a second one.
  } else if (!user) {
    action = (
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link to={withRedirect("/login", here)}>Sign in to claim for {rand(price)}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to={withRedirect("/register", here)}>Create an account</Link>
        </Button>
      </div>
    );
  } else {
    action = (
      <Button size="lg" className="mt-6" onClick={startClaim} disabled={paying}>
        {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
        Claim your number for {rand(price)}
      </Button>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <SEO
        title="Founders Pass | 1145"
        description={`Be one of the first ${count(total)} members of 1145. Pay once for a numbered pass and members-only deals.`}
      />
      <div className="page-container max-w-2xl py-10 md:py-14">
        <Link to="/" className="link-arrow mb-6 text-foreground"><ArrowLeft aria-hidden /> Home</Link>
        <p className="eyebrow text-gold">1145 Founders Pass</p>
        <h1 className="type-headline mt-3">Be one of the first {count(total)}.</h1>

        {loading || authLoading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        ) : pass ? (
          <section className="mt-8 rounded-2xl bg-card p-6 md:p-8" aria-live="polite">
            <p className="text-sm font-medium uppercase tracking-wide text-text-secondary">You are</p>
            <p className="mt-1 text-5xl font-bold tracking-tight tabular-nums md:text-6xl">
              Founder No. {passNumber(pass.pass_number)}
            </p>
            <p className="mt-2 text-text-secondary">of {count(total)}</p>
            <p className="mt-6 text-sm text-text-secondary">
              Claimed {longDate(pass.claimed_at)}. Member deals run until {longDate(pass.expires_at)}. The number stays yours.
            </p>
            <Button asChild className="mt-6"><Link to="/shop">Start shopping</Link></Button>
          </section>
        ) : refundDue ? (
          <section className="mt-8 rounded-2xl bg-card p-6 md:p-8" aria-live="polite">
            <h2 className="text-xl font-semibold">Your payment will be refunded</h2>
            <p className="mt-2 text-text-secondary">
              Your payment arrived, but no Founders Pass could be issued. You will be refunded in full.{" "}
              <Link to="/contact" className="underline">Contact us</Link> if you have not heard from us within a few days.
            </p>
          </section>
        ) : confirming ? (
          <section className="mt-8 rounded-2xl bg-card p-6 md:p-8" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">Confirming your payment</h2>
            <p className="mt-2 text-text-secondary">This usually takes a few seconds. Your founder number will appear here.</p>
          </section>
        ) : (
          <>
            {claim === "success" && (
              <section className="mt-8 rounded-2xl bg-card p-6" aria-live="polite">
                <h2 className="text-lg font-semibold">Still waiting for PayFast</h2>
                <p className="mt-2 text-text-secondary">
                  {user
                    ? "PayFast has not confirmed the payment yet. Refresh this page in a minute. You will also get a notification as soon as your number is assigned."
                    : "Sign in to see your founder number."}
                </p>
                {!user && (
                  <Button asChild className="mt-4"><Link to={withRedirect("/login", "/founders?claim=success")}>Sign in</Link></Button>
                )}
              </section>
            )}

            <section className="mt-8 rounded-2xl bg-card p-6 md:p-8">
              {onSale && (
                <p className="text-sm font-medium uppercase tracking-wide tabular-nums text-text-secondary" aria-live="polite">
                  {count(remaining)} of {count(total)} left
                </p>
              )}
              <ul className="mt-4 space-y-3">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
              {action}
            </section>

            <p className="mt-4 text-xs text-text-secondary">
              One deal per shop per month, while stocks last. The pass is a membership, not a share in 1145.{" "}
              <Link to="/terms" className="underline">Terms apply</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default FoundersPassPage;
