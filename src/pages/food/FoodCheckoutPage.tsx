import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useFoodCart } from "@/contexts/FoodCartContext";
import { payForFoodOrder, placeFoodOrder } from "@/services/food";
import { formatCurrency } from "@/lib/utils";
import type { FoodAddress } from "@/types/food";

type Field = keyof FoodAddress;
const REQUIRED: Field[] = ["name", "street", "city", "phone"];
const LABELS: Record<Field, string> = {
  name: "Full name", street: "Street address", city: "City or suburb", postal_code: "Postal code", phone: "Phone number",
};

const FoodCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const basket = useFoodCart();
  const [address, setAddress] = useState<FoodAddress>({
    name: user?.name ?? "", street: "", city: "", postal_code: "", phone: user?.phone ?? "",
  });
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!basket.eatery || basket.lines.length === 0) {
    // The basket is emptied as soon as the order exists, just before the hand-off to PayFast.
    return submitting ? (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-text-secondary" role="status">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p>Taking you to payment…</p>
      </div>
    ) : <Navigate to="/food" replace />;
  }
  const eatery = basket.eatery;
  const total = basket.subtotal + eatery.delivery_fee;

  const validate = () => {
    const next: Partial<Record<Field, string>> = {};
    for (const field of REQUIRED) if (!address[field].trim()) next[field] = `Enter your ${LABELS[field].toLowerCase()}`;
    if (address.phone.trim() && address.phone.replace(/\D/g, "").length < 9) next.phone = "Enter a phone number the driver can reach you on";
    setErrors(next);
    const first = (Object.keys(next) as Field[])[0];
    if (first) document.getElementById(`food-${first}`)?.focus();
    return !first;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFailure(null);
    if (!validate()) return;
    setSubmitting(true);

    let orderId: string;
    try {
      orderId = await placeFoodOrder({
        eateryId: eatery.id,
        items: basket.lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
        address: { ...address, name: address.name.trim(), street: address.street.trim(), city: address.city.trim(), phone: address.phone.trim() },
        notes: notes.trim() || undefined,
      });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "We couldn't place your order. Please try again.");
      setSubmitting(false);
      return;
    }

    // The order now exists; from here the order page can always retry the payment.
    basket.clear();
    try {
      const [firstName, ...rest] = address.name.trim().split(/\s+/);
      await payForFoodOrder(orderId, { email: user?.email, firstName, lastName: rest.join(" ") });
    } catch {
      navigate(`/food/orders/${orderId}`, { replace: true });
    }
  };

  const field = (name: Field, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className={name === "street" || name === "name" ? "sm:col-span-2" : undefined}>
      <Label htmlFor={`food-${name}`}>{LABELS[name]}{REQUIRED.includes(name) ? "" : " (optional)"}</Label>
      <Input
        id={`food-${name}`}
        value={address[name]}
        onChange={(e) => setAddress((prev) => ({ ...prev, [name]: e.target.value }))}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `food-${name}-error` : undefined}
        required={REQUIRED.includes(name)}
        className="mt-1.5 h-12"
        {...props}
      />
      {errors[name] && <p id={`food-${name}-error`} className="mt-1 text-sm text-destructive">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Food checkout | 1145" noindex />
      <div className="page-container py-6 md:py-10">
        <Link to={`/food/${eatery.slug}`} className="link-arrow min-h-[44px] text-text-secondary"><ArrowLeft aria-hidden /> Back to {eatery.name}</Link>
        <h1 className="type-headline mt-2">Checkout</h1>

        <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-8">
            <fieldset>
              <legend className="type-title">Delivery details</legend>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {field("name", { autoComplete: "name" })}
                {field("street", { autoComplete: "street-address", placeholder: "House number, street, complex or unit" })}
                {field("city", { autoComplete: "address-level2" })}
                {field("postal_code", { autoComplete: "postal-code", inputMode: "numeric" })}
                {field("phone", { autoComplete: "tel", type: "tel", inputMode: "tel" })}
              </div>
            </fieldset>

            <div>
              <Label htmlFor="food-notes">Notes for the eatery or driver (optional)</Label>
              <Textarea id="food-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3} className="mt-1.5" placeholder="Allergies, gate code, where to leave it…" />
            </div>
          </div>

          <aside aria-label="Order summary">
            <div className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-24">
              <h2 className="type-title">Your order from {eatery.name}</h2>
              <ul className="mt-4 space-y-3">
                {basket.lines.map((line) => (
                  <li key={line.menuItemId} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0"><span className="tabular-nums">{line.quantity} ×</span> {line.name}</span>
                    <span className="shrink-0 font-medium tabular-nums">{formatCurrency(line.price * line.quantity)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm tabular-nums">
                <div className="flex justify-between"><dt className="text-text-secondary">Subtotal</dt><dd>{formatCurrency(basket.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-text-secondary">Delivery</dt><dd>{eatery.delivery_fee > 0 ? formatCurrency(eatery.delivery_fee) : "Free"}</dd></div>
                <div className="flex justify-between pt-1 text-base font-semibold"><dt>Total</dt><dd>{formatCurrency(total)}</dd></div>
              </dl>

              {failure && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{failure}</p>}

              <Button type="submit" variant="cta" size="lg" className="mt-5 w-full rounded-full" disabled={submitting}>
                {submitting ? <><Loader2 className="animate-spin" aria-hidden /> Placing your order…</> : `Pay ${formatCurrency(total)}`}
              </Button>
              <p className="mt-3 text-xs text-text-secondary">
                You'll pay securely with PayFast. The eatery starts preparing once your payment is confirmed. Prices are confirmed against the live menu when you pay.
              </p>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
};

export default FoodCheckoutPage;
