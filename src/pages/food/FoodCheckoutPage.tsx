import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useFoodCart } from "@/contexts/FoodCartContext";
import { checkDeliveryAddress, fetchEateryBySlug, payForFoodOrder, placeFoodOrder } from "@/services/food";
import { formatCurrency } from "@/lib/utils";

type Field = "name" | "street" | "city" | "postal_code" | "phone";
const REQUIRED: Field[] = ["name", "street", "city", "phone"];
const LABELS: Record<Field, string> = {
  name: "Full name", street: "Street address", city: "City or suburb", postal_code: "Postal code", phone: "Phone number",
};

const FoodCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const basket = useFoodCart();
  const [address, setAddress] = useState<Record<Field, string>>({
    name: user?.name ?? "", street: "", city: "", postal_code: "", phone: user?.phone ?? "",
  });
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitting, setSubmitting] = useState<false | "checking" | "placing">(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Shown only when the server can't find the address on the map and asks the customer to choose.
  const [askArea, setAskArea] = useState<{ message: string; areas: string[] } | null>(null);
  const [area, setArea] = useState("");

  // The basket only remembers the eatery's name and prices; its delivery areas are read fresh.
  const eaterySlug = basket.eatery?.slug;
  const { data: liveEatery, isLoading: loadingEatery } = useQuery({
    queryKey: ["eatery", eaterySlug], queryFn: () => fetchEateryBySlug(eaterySlug!), enabled: !!eaterySlug, staleTime: 60_000,
  });
  const deliveryAreas = liveEatery?.delivery_areas ?? [];

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
    const street = address.street.trim();
    const city = address.city.trim();

    // Eateries with delivery areas: the server locates the address on the map first.
    let checkId: string | undefined;
    if (deliveryAreas.length > 0) {
      setSubmitting("checking");
      const check = await checkDeliveryAddress({
        eateryId: eatery.id, street, city, postalCode: address.postal_code.trim() || undefined, area: askArea && area ? area : undefined,
      });
      if (check.ok === false) {
        setSubmitting(false);
        if (check.reason === "choose_area") {
          setAskArea({ message: check.message, areas: check.areas?.length ? check.areas : deliveryAreas });
          window.setTimeout(() => document.getElementById("food-area")?.focus(), 0);
        } else {
          setFailure(check.message);
        }
        return;
      }
      if (check.required === true) checkId = check.checkId;
    }

    setSubmitting("placing");
    let orderId: string;
    try {
      orderId = await placeFoodOrder({
        eateryId: eatery.id,
        items: basket.lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
        address: {
          name: address.name.trim(), street, city, postal_code: address.postal_code.trim(), phone: address.phone.trim(),
          ...(checkId ? { check_id: checkId } : {}),
        },
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
              {deliveryAreas.length > 0 && (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface-muted p-3 text-sm text-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  <span>
                    {eatery.name} delivers to {deliveryAreas.slice(0, 8).join(", ")}{deliveryAreas.length > 8 ? ` and ${deliveryAreas.length - 8} more` : ""}.
                    We check your address against these areas when you place the order, so enter the full street name and number.
                  </span>
                </p>
              )}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {field("name", { autoComplete: "name" })}
                {field("street", { autoComplete: "street-address", placeholder: "House number and street name" })}
                {field("city", { autoComplete: "address-level2" })}
                {field("postal_code", { autoComplete: "postal-code", inputMode: "numeric" })}
                {field("phone", { autoComplete: "tel", type: "tel", inputMode: "tel" })}
                {askArea && (
                  <div className="sm:col-span-2 rounded-xl border border-border p-4">
                    <p role="alert" className="text-sm font-medium text-foreground">{askArea.message}</p>
                    <Label htmlFor="food-area" className="mt-3 block">Your area</Label>
                    <select
                      id="food-area" value={area} onChange={(e) => setArea(e.target.value)} aria-describedby="food-area-help"
                      className="mt-1.5 h-12 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground focus:border-foreground focus:outline-none"
                    >
                      <option value="">Choose your area</option>
                      {askArea.areas.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <p id="food-area-help" className="mt-1 text-xs text-text-secondary">
                      If your area isn't listed, {eatery.name} can't deliver to you. The eatery is told your address couldn't be checked on the map and may confirm it with you.
                    </p>
                  </div>
                )}
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

              <Button type="submit" variant="cta" size="lg" className="mt-5 w-full rounded-full" disabled={!!submitting || loadingEatery}>
                {submitting === "checking" ? <><Loader2 className="animate-spin" aria-hidden /> Checking your address…</>
                  : submitting === "placing" ? <><Loader2 className="animate-spin" aria-hidden /> Placing your order…</>
                    : `Pay ${formatCurrency(total)}`}
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
