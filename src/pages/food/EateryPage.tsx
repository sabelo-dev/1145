import React, { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, MapPin, Minus, Phone, Plus, UtensilsCrossed } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fetchEateryBySlug, fetchMenu } from "@/services/food";
import { useFoodCart } from "@/contexts/FoodCartContext";
import { formatCurrency } from "@/lib/utils";
import type { MenuItem } from "@/types/food";

/** − 2 + stepper, or a single "Add" button when the item isn't in the basket yet. */
const QuantityControl: React.FC<{
  name: string; quantity: number; disabled?: boolean; onAdd: () => void; onChange: (quantity: number) => void;
}> = ({ name, quantity, disabled, onAdd, onChange }) =>
  quantity === 0 ? (
    <Button type="button" variant="outline" size="sm" className="h-10 rounded-full px-4" disabled={disabled} onClick={onAdd} aria-label={`Add ${name}`}>
      <Plus aria-hidden /> Add
    </Button>
  ) : (
    <div className="flex items-center rounded-full border border-border" role="group" aria-label={`${name} quantity`}>
      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-hover" onClick={() => onChange(quantity - 1)} aria-label={`Remove one ${name}`}>
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span className="w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">{quantity}</span>
      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-hover" onClick={onAdd} aria-label={`Add one more ${name}`}>
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );

const EateryPage: React.FC = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const basket = useFoodCart();
  // An item waiting on "start a new basket?" confirmation.
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);

  const { data: eatery, isLoading } = useQuery({ queryKey: ["eatery", slug], queryFn: () => fetchEateryBySlug(slug), staleTime: 60_000 });
  const { data: menu, isLoading: menuLoading } = useQuery({
    queryKey: ["eatery-menu", eatery?.id],
    queryFn: () => fetchMenu(eatery!.id),
    enabled: !!eatery,
    staleTime: 60_000,
  });

  // Sections in order, then anything without a section under "More".
  const groups = useMemo(() => {
    if (!menu) return [];
    const bySection = menu.sections.map((s) => ({ id: s.id, name: s.name, items: menu.items.filter((i) => i.section_id === s.id) }));
    const known = new Set(menu.sections.map((s) => s.id));
    const loose = menu.items.filter((i) => !i.section_id || !known.has(i.section_id));
    if (loose.length) bySection.push({ id: "other", name: bySection.length ? "More" : "Menu", items: loose });
    return bySection.filter((g) => g.items.length > 0);
  }, [menu]);

  if (isLoading) {
    return (
      <div className="page-container py-8" aria-busy>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="mt-6 h-8 w-64" />
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!eatery || eatery.status !== "approved") {
    return (
      <div className="page-container py-20 text-center">
        <UtensilsCrossed className="mx-auto h-10 w-10 text-text-secondary" aria-hidden />
        <h1 className="type-title mt-4">This eatery isn't available</h1>
        <Link to="/food" className="link-arrow mt-4 justify-center text-foreground"><ArrowLeft aria-hidden /> All eateries</Link>
      </div>
    );
  }

  const mine = basket.eatery?.id === eatery.id;
  const quantityOf = (id: string) => (mine ? basket.lines.find((l) => l.menuItemId === id)?.quantity ?? 0 : 0);
  const add = (item: MenuItem) => { if (!basket.addItem(eatery, item)) setPendingItem(item); };
  const belowMinimum = mine && basket.subtotal < eatery.min_order;

  return (
    <div className="min-h-screen bg-background pb-28 lg:pb-12">
      <SEO title={`${eatery.name} | Food delivery | 1145`} description={eatery.description || `Order from ${eatery.name} on 1145.`} />

      <div className="page-container pt-4">
        <Link to="/food" className="link-arrow min-h-[44px] text-text-secondary"><ArrowLeft aria-hidden /> All eateries</Link>
      </div>

      <header className="page-container">
        {eatery.cover_url && (
          <img src={eatery.cover_url} alt="" className="aspect-[3/1] max-h-72 w-full rounded-2xl bg-surface-muted object-cover" />
        )}
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="type-headline">{eatery.name}</h1>
            {eatery.cuisines.length > 0 && <p className="mt-1 text-text-secondary">{eatery.cuisines.join(" · ")}</p>}
          </div>
          <span className={eatery.accepting_orders
            ? "rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success"
            : "rounded-full bg-foreground px-3 py-1 text-sm font-semibold text-background"}>
            {eatery.accepting_orders ? "Taking orders" : "Closed right now"}
          </span>
        </div>
        {eatery.description && <p className="mt-3 max-w-2xl text-text-secondary">{eatery.description}</p>}
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary tabular-nums">
          <li className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden /> About {eatery.prep_time_min} min to prepare{eatery.opening_hours ? ` · ${eatery.opening_hours}` : ""}</li>
          <li className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden /> {eatery.address}, {eatery.city}</li>
          {eatery.phone && <li className="inline-flex items-center gap-1.5"><Phone className="h-4 w-4" aria-hidden /> <a href={`tel:${eatery.phone}`} className="underline underline-offset-4">{eatery.phone}</a></li>}
          <li>{eatery.delivery_fee > 0 ? `${formatCurrency(eatery.delivery_fee)} delivery` : "Free delivery"}{eatery.min_order > 0 ? ` · ${formatCurrency(eatery.min_order)} minimum` : ""}</li>
        </ul>
      </header>

      <div className="page-container mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Menu */}
        <div className="min-w-0 space-y-10">
          {menuLoading ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : groups.length === 0 ? (
            <p className="rounded-2xl border border-border p-8 text-center text-text-secondary">This eatery hasn't added its menu yet.</p>
          ) : groups.map((group) => (
            <section key={group.id} aria-labelledby={`section-${group.id}`}>
              <h2 id={`section-${group.id}`} className="type-title mb-3">{group.name}</h2>
              <ul className="divide-y divide-border rounded-2xl border border-border">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 p-4">
                    {item.image_url && (
                      <img src={item.image_url} alt="" loading="lazy" decoding="async" className="h-20 w-20 shrink-0 rounded-xl bg-surface-muted object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-sans text-base font-semibold tracking-normal text-foreground">{item.name}</h3>
                      {item.description && <p className="mt-0.5 line-clamp-2 text-sm text-text-secondary">{item.description}</p>}
                      <p className="mt-1 font-semibold tabular-nums text-foreground">{formatCurrency(item.price)}</p>
                    </div>
                    {item.is_available ? (
                      <QuantityControl
                        name={item.name}
                        quantity={quantityOf(item.id)}
                        disabled={!eatery.accepting_orders}
                        onAdd={() => add(item)}
                        onChange={(q) => basket.setQuantity(item.id, q)}
                      />
                    ) : (
                      <span className="shrink-0 text-sm font-medium text-text-secondary">Unavailable</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Basket (desktop) */}
        <aside className="hidden lg:block" aria-label="Your basket">
          <div className="sticky top-24 rounded-2xl border border-border bg-card p-5">
            <h2 className="type-title">Your basket</h2>
            {!mine || basket.lines.length === 0 ? (
              <p className="mt-3 text-sm text-text-secondary">
                {eatery.accepting_orders ? "Add items from the menu to start your order." : "This eatery isn't taking orders right now."}
              </p>
            ) : (
              <>
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
                  <div className="flex justify-between pt-1 text-base font-semibold"><dt>Total</dt><dd>{formatCurrency(basket.subtotal + eatery.delivery_fee)}</dd></div>
                </dl>
                {belowMinimum && (
                  <p className="mt-3 text-sm text-text-secondary" role="status">
                    Add {formatCurrency(eatery.min_order - basket.subtotal)} more to reach the {formatCurrency(eatery.min_order)} minimum.
                  </p>
                )}
                <Button variant="cta" size="lg" className="mt-4 w-full rounded-full" disabled={belowMinimum || !eatery.accepting_orders} onClick={() => navigate("/food/checkout")}>
                  Go to checkout
                </Button>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Basket bar (phones and tablets): sits above the bottom navigation */}
      {mine && basket.itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+0.75rem)] z-40 px-4 md:bottom-6 lg:hidden">
          <div className="mx-auto max-w-md">
            {belowMinimum && (
              <p className="mb-2 rounded-full bg-background px-4 py-2 text-center text-sm text-text-secondary shadow-soft" role="status">
                Add {formatCurrency(eatery.min_order - basket.subtotal)} more to reach the minimum order
              </p>
            )}
            <Button variant="cta" className="h-14 w-full justify-between rounded-full px-6 text-base shadow-float" disabled={belowMinimum || !eatery.accepting_orders} onClick={() => navigate("/food/checkout")}>
              <span>Checkout · {basket.itemCount} {basket.itemCount === 1 ? "item" : "items"}</span>
              <span className="tabular-nums">{formatCurrency(basket.subtotal + eatery.delivery_fee)}</span>
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!pendingItem} onOpenChange={(open) => !open && setPendingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new basket?</AlertDialogTitle>
            <AlertDialogDescription>
              Your basket has items from {basket.eatery?.name}. An order can only come from one eatery, so adding this will clear it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my basket</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingItem) basket.startNewBasket(eatery, pendingItem); setPendingItem(null); }}>
              Start new basket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EateryPage;
