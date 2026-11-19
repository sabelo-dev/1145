import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Barcode, Loader2, Minus, PackageX, PauseCircle, PencilLine, Percent, Plus, PlayCircle, ReceiptText, Search, ShoppingCart, Trash2, UserRound, Wallet, WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import BarcodeScanner from "@/components/scanning/BarcodeScanner";
import { formatMinor, parseMinor } from "@/lib/money";
import {
  addToCart, cartTotals, discountNeedsManager, lineTotal, percentOf, setQuantity, type CartLine, type Tender,
} from "@/lib/posCart";
import { cn } from "@/lib/utils";
import { canUse, newRequestKey, variationLabel, type StoreAccess } from "@/services/merchantAi";
import {
  createSale, fetchCurrentShift, fetchPosCatalog, fetchPosSettings, findByCode, getRegisterName, type PosProduct, type PosVariation, type ShiftReport,
} from "@/services/pos";
import PosCheckout from "./PosCheckout";
import { OpenShiftCard, ShiftDialog } from "./PosShift";

const RETAIL_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return online;
}

// The cart in progress and parked carts are kept on this device, so a restart doesn't lose them.
interface CartState { lines: CartLine[]; saleDiscount: number; customerName: string; customerPhone: string; note: string }
interface Parked extends CartState { id: string; parkedAt: string; label: string }
const EMPTY: CartState = { lines: [], saleDiscount: 0, customerName: "", customerPhone: "", note: "" };
const cartKey = (storeId: string) => `1145.pos-cart.${storeId}`;
const parkedKey = (storeId: string) => `1145.pos-parked.${storeId}`;
const load = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};
const save = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

const fine = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;

/** An amount typed either as rand or as a percentage of `of`. */
const DiscountInput: React.FC<{ of: number; valueMinor: number; onChange: (minor: number) => void; label: string }> = ({ of, valueMinor, onChange, label }) => {
  const [mode, setMode] = useState<"rand" | "percent">("rand");
  const [text, setText] = useState(valueMinor ? (valueMinor / 100).toFixed(2) : "");
  useEffect(() => {
    const n = mode === "rand" ? (text.trim() === "" ? 0 : parseMinor(text)) : percentOf(of, Number(text.replace(",", ".")) || 0);
    if (n !== null) onChange(Math.min(n, of));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, mode, of]);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="0" className="h-12 flex-1 text-lg" aria-label={label} />
        <Button type="button" variant={mode === "rand" ? "default" : "outline"} className="h-12 w-14" onClick={() => setMode("rand")}>R</Button>
        <Button type="button" variant={mode === "percent" ? "default" : "outline"} className="h-12 w-14" onClick={() => setMode("percent")} aria-label="Percent"><Percent className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

const PosRegister: React.FC<{ access: StoreAccess }> = ({ access }) => {
  const storeId = access.store_id;
  const queryClient = useQueryClient();
  const online = useOnline();
  const [register, setRegister] = useState(getRegisterName);
  const canOverride = canUse(access, "operations");
  const canPay1145 = canUse(access, "payments", "payment_requests");

  const shift = useQuery({
    queryKey: ["pos-shift", storeId, register],
    queryFn: () => fetchCurrentShift(storeId, register),
    refetchOnWindowFocus: true,
  });
  const settings = useQuery({ queryKey: ["pos-settings", storeId], queryFn: () => fetchPosSettings(storeId), staleTime: 300_000 });
  const catalog = useQuery({ queryKey: ["pos-catalog", storeId], queryFn: () => fetchPosCatalog(storeId), staleTime: 60_000 });

  const [cart, setCart] = useState<CartState>(() => load(cartKey(storeId), EMPTY));
  const [parked, setParked] = useState<Parked[]>(() => load(parkedKey(storeId), []));
  useEffect(() => { setCart(load(cartKey(storeId), EMPTY)); setParked(load(parkedKey(storeId), [])); }, [storeId]);
  useEffect(() => { save(cartKey(storeId), cart); }, [storeId, cart]);
  useEffect(() => { save(parkedKey(storeId), parked); }, [storeId, parked]);

  // One request key per version of the cart, so a retried "Complete sale" can't ring it up twice.
  const saleKey = useRef(newRequestKey());
  useEffect(() => { saleKey.current = newRequestKey(); }, [cart]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [picking, setPicking] = useState<PosProduct | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState(false);
  const [saleDiscountOpen, setSaleDiscountOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [parkedOpen, setParkedOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [cartSheet, setCartSheet] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const vatRate = settings.data?.vat_registered ? settings.data.vat_rate_bp : 0;
  const limitBp = settings.data?.cashier_max_discount_bp ?? 1000;
  const totals = useMemo(() => cartTotals(cart.lines, cart.saleDiscount, vatRate), [cart.lines, cart.saleDiscount, vatRate]);
  const needsManager = !canOverride && discountNeedsManager(totals, limitBp);

  const products = useMemo(() => catalog.data ?? [], [catalog.data]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) =>
      (!category || p.category === category) &&
      (!q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.variations.some((v) => v.sku?.toLowerCase().includes(q))));
  }, [products, search, category]);

  const focusSearch = () => { if (fine()) setTimeout(() => searchRef.current?.focus(), 0); };

  const add = useCallback((product: PosProduct, variation: PosVariation | null, quantity = 1) => {
    const key = `${product.product_id}:${variation?.variation_id ?? ""}`;
    const name = variation ? `${product.name} (${variationLabel(variation.attributes, variation.sku)})` : product.name;
    setCart((c) => ({
      ...c,
      lines: addToCart(c.lines, {
        key, product_id: product.product_id, variation_id: variation?.variation_id ?? null, name,
        sku: variation?.sku ?? product.sku,
        list_price_minor: variation?.price_minor ?? product.price_minor,
        unit_price_minor: variation?.price_minor ?? product.price_minor,
        stock: product.track_stock ? (variation ? variation.stock : product.stock) : null,
      }, quantity),
    }));
    try { navigator.vibrate?.(30); } catch { /* unsupported */ }
  }, []);

  const choose = (product: PosProduct) => {
    if (product.variations.length > 0) setPicking(product);
    else add(product, null);
    focusSearch();
  };

  /** A scanned or typed code: exact SKU on a product or variant. */
  const addByCode = (code: string) => {
    const hit = findByCode(products, code);
    if (!hit) return { ok: false, message: `No product has the code ${code}` };
    if (!hit.variation && hit.product.variations.length > 0) {
      setPicking(hit.product);
      return { ok: true, message: `${hit.product.name}: choose an option` };
    }
    add(hit.product, hit.variation);
    return { ok: true, message: `Added ${hit.product.name}` };
  };

  const onSearchEnter = () => {
    const code = search.trim();
    if (!code) return;
    if (findByCode(products, code)) { addByCode(code); setSearch(""); return; }
    if (visible.length === 1) { choose(visible[0]); setSearch(""); }
  };

  const clearCart = () => setCart(EMPTY);
  const park = () => {
    if (cart.lines.length === 0) return;
    const label = cart.customerName || `${totals.items} item${totals.items === 1 ? "" : "s"} · ${formatMinor(totals.total_minor)}`;
    setParked((p) => [{ ...cart, id: newRequestKey(), parkedAt: new Date().toISOString(), label }, ...p].slice(0, 20));
    clearCart();
    toast.success("Sale parked");
  };
  const resume = (p: Parked) => {
    if (cart.lines.length > 0) park();
    setCart({ lines: p.lines, saleDiscount: p.saleDiscount, customerName: p.customerName, customerPhone: p.customerPhone, note: p.note });
    setParked((list) => list.filter((x) => x.id !== p.id));
    setParkedOpen(false);
  };

  const ringUp = async (tenders: Tender[]) => {
    const current = shift.data!;
    const sale = await createSale({
      storeId, shiftId: current.shift_id,
      lines: cart.lines.map((l) => ({
        product_id: l.product_id, variation_id: l.variation_id, quantity: l.quantity,
        ...(l.product_id ? {} : { name: l.name }),
        ...(l.unit_price_minor !== l.list_price_minor || !l.product_id ? { unit_price_minor: l.unit_price_minor } : {}),
        ...(l.discount_minor ? { discount_minor: l.discount_minor } : {}),
      })),
      saleDiscountMinor: cart.saleDiscount,
      payments: tenders.map((t) => ({ method: t.method, amount_minor: t.amount_minor, reference: t.reference, payment_request_id: t.payment_request_id })),
      customerName: cart.customerName.trim(), customerPhone: cart.customerPhone.trim(), note: cart.note.trim(),
      requestKey: saleKey.current,
    }).catch((error: Error) => {
      // The shift may have been closed on another device.
      queryClient.invalidateQueries({ queryKey: ["pos-shift", storeId] });
      throw error;
    });
    queryClient.invalidateQueries({ queryKey: ["pos-shift", storeId] });
    queryClient.invalidateQueries({ queryKey: ["pos-catalog", storeId] });
    queryClient.invalidateQueries({ queryKey: ["pos-sales", storeId] });
    queryClient.invalidateQueries({ queryKey: ["pos-day", storeId] });
    queryClient.invalidateQueries({ queryKey: ["merchant-stock", storeId] });
    return sale;
  };

  if (shift.isLoading || settings.isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (shift.error) return <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{(shift.error as Error).message}</p>;
  if (!shift.data) {
    return (
      <OpenShiftCard storeId={storeId} onOpened={(s) => {
        setRegister(s.register_name);
        queryClient.setQueryData(["pos-shift", storeId, s.register_name], s);
      }} />
    );
  }
  const currentShift: ShiftReport = shift.data;
  const editLine = cart.lines.find((l) => l.key === editing) ?? null;

  const cartPanel = (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-lg font-semibold">Sale</h2>
        {parked.length > 0 && (
          <Button variant="outline" size="sm" className="h-10 gap-1" onClick={() => setParkedOpen(true)}>
            <PlayCircle className="h-4 w-4" /> Parked <Badge variant="secondary">{parked.length}</Badge>
          </Button>
        )}
        {cart.lines.length > 0 && (
          <>
            <Button variant="outline" size="sm" className="h-10 gap-1" onClick={park}><PauseCircle className="h-4 w-4" /> Park</Button>
            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={clearCart} aria-label="Clear the sale"><Trash2 className="h-4 w-4" /></Button>
          </>
        )}
      </div>

      <div className="min-h-[8rem] flex-1 overflow-y-auto rounded-md border">
        {cart.lines.length === 0 ? (
          <p className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <ShoppingCart className="h-8 w-8" aria-hidden /> Tap a product or scan a barcode to start.
          </p>
        ) : (
          <ul className="divide-y">
            {cart.lines.map((l) => (
              <li key={l.key} className="flex items-center gap-2 p-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(l.key)}>
                  <p className="truncate font-medium">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMinor(l.unit_price_minor)}{l.unit_price_minor !== l.list_price_minor ? " (price changed)" : ""}
                    {l.discount_minor > 0 ? ` · −${formatMinor(l.discount_minor)}` : ""}
                    {l.stock !== null && l.quantity > l.stock ? ` · only ${Math.max(l.stock, 0)} in stock` : ""}
                  </p>
                </button>
                <div className="flex items-center">
                  <Button variant="outline" size="icon" className="h-10 w-10" aria-label={`One less ${l.name}`}
                    onClick={() => setCart((c) => ({ ...c, lines: setQuantity(c.lines, l.key, l.quantity - 1) }))}><Minus className="h-4 w-4" /></Button>
                  <span className="w-9 text-center tabular-nums">{l.quantity}</span>
                  <Button variant="outline" size="icon" className="h-10 w-10" aria-label={`One more ${l.name}`}
                    onClick={() => setCart((c) => ({ ...c, lines: setQuantity(c.lines, l.key, l.quantity + 1) }))}><Plus className="h-4 w-4" /></Button>
                </div>
                <span className="w-20 text-right font-medium tabular-nums">{formatMinor(lineTotal(l))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11 gap-2" disabled={cart.lines.length === 0} onClick={() => setSaleDiscountOpen(true)}>
          <Percent className="h-4 w-4" /> {cart.saleDiscount ? `−${formatMinor(totals.sale_discount_minor)}` : "Discount"}
        </Button>
        <Button variant="outline" className="h-11 gap-2 truncate" onClick={() => setCustomerOpen(true)}>
          <UserRound className="h-4 w-4 shrink-0" /> <span className="truncate">{cart.customerName || "Customer"}</span>
        </Button>
      </div>

      <div className="space-y-1 text-sm">
        {totals.discount_minor > 0 && (
          <>
            <div className="flex justify-between text-muted-foreground"><span>Before discounts</span><span className="tabular-nums">{formatMinor(totals.subtotal_minor)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Discounts</span><span className="tabular-nums">−{formatMinor(totals.discount_minor)}</span></div>
          </>
        )}
        {totals.vat_minor > 0 && (
          <div className="flex justify-between text-muted-foreground"><span>VAT included</span><span className="tabular-nums">{formatMinor(totals.vat_minor)}</span></div>
        )}
        <div className="flex items-baseline justify-between text-xl font-bold"><span>Total</span><span className="tabular-nums">{formatMinor(totals.total_minor)}</span></div>
      </div>
      {needsManager && (
        <p className="rounded-md border border-amber-400 bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Discounts over {limitBp / 100}% need a manager or operator to ring up the sale.
        </p>
      )}
      <Button className="h-16 w-full text-xl" disabled={cart.lines.length === 0 || needsManager || !online}
        onClick={() => { setCartSheet(false); setCheckout(true); }}>
        {!online ? <><WifiOff className="mr-2 h-5 w-5" /> Offline</> : `Charge ${formatMinor(totals.total_minor)}`}
      </Button>
    </div>
  );

  return (
    <div className="space-y-3 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="h-11 gap-2" onClick={() => setShiftOpen(true)}>
          <Wallet className="h-4 w-4" /> {currentShift.register_name} · {formatMinor(currentShift.net_minor)}
        </Button>
        {!online && <Badge variant="destructive" className="gap-1 px-3 py-1"><WifiOff className="h-4 w-4" /> Offline: sales are paused</Badge>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-label="Products" className="min-w-0 space-y-3">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); onSearchEnter(); }}>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search, or scan a barcode"
                className="h-12 pl-9 text-base" aria-label="Search products or scan a barcode" autoComplete="off" autoFocus={fine()} />
            </div>
            <Button type="button" variant="outline" className="h-12 w-12 shrink-0" onClick={() => setScanning(true)} aria-label="Scan with the camera">
              <Barcode className="h-5 w-5" />
            </Button>
            {(settings.data?.allow_open_items ?? true) && (
              <Button type="button" variant="outline" className="h-12 shrink-0 gap-2" onClick={() => setOpenItem(true)}>
                <PencilLine className="h-4 w-4" /> <span className="hidden sm:inline">Open item</span>
              </Button>
            )}
          </form>

          {categories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Categories">
              <Button size="sm" variant={category === null ? "default" : "outline"} className="h-9 shrink-0" onClick={() => setCategory(null)}>All</Button>
              {categories.map((c) => (
                <Button key={c} size="sm" variant={category === c ? "default" : "outline"} className="h-9 shrink-0" onClick={() => setCategory(c)}>{c}</Button>
              ))}
            </div>
          )}

          {catalog.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
          {catalog.error && <p className="text-sm text-destructive">{(catalog.error as Error).message}</p>}
          {catalog.data && visible.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {products.length === 0 ? "This store has no products yet. Add them in the merchant dashboard, or sell open items." : "Nothing matches."}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {visible.slice(0, 120).map((p) => {
              const stock = p.variations.length ? p.variations.reduce((s, v) => s + v.stock, 0) : p.stock;
              const prices = p.variations.length ? p.variations.map((v) => v.price_minor) : [p.price_minor];
              const from = Math.min(...prices);
              return (
                <button key={p.product_id} type="button" onClick={() => choose(p)}
                  className="flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="aspect-[4/3] w-full bg-muted">
                    {p.image_url
                      ? <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      : <div className="flex h-full items-center justify-center text-2xl font-semibold text-muted-foreground">{p.name.slice(0, 1).toUpperCase()}</div>}
                  </div>
                  <div className="space-y-1 p-2">
                    <p className="line-clamp-2 text-sm font-medium leading-tight">{p.name}</p>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-semibold tabular-nums">{prices.length > 1 && Math.max(...prices) !== from ? "from " : ""}{formatMinor(from)}</span>
                      {p.track_stock && stock <= 0 && <Badge variant="destructive" className="gap-1 px-1.5 text-[10px]"><PackageX className="h-3 w-3" aria-hidden /> Out</Badge>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {visible.length > 120 && <p className="text-center text-xs text-muted-foreground">Showing 120 of {visible.length}. Search to narrow it down.</p>}
        </section>

        {/* Cart beside the products on large screens */}
        <aside className="hidden lg:block">
          <Card className="sticky top-3">
            <CardContent className="h-[calc(100vh-8rem)] p-4">{cartPanel}</CardContent>
          </Card>
        </aside>
      </div>

      {/* Phones and tablets: a bar at the bottom opens the cart */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background p-3 md:left-64 lg:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <Button className="h-14 w-full justify-between text-lg" onClick={() => setCartSheet(true)}>
          <span className="flex items-center gap-2"><ReceiptText className="h-5 w-5" /> {totals.items} item{totals.items === 1 ? "" : "s"}</span>
          <span className="tabular-nums">{formatMinor(totals.total_minor)}</span>
        </Button>
      </div>
      <Sheet open={cartSheet} onOpenChange={setCartSheet}>
        <SheetContent side="bottom" className="h-[90vh] p-4">
          <SheetHeader className="sr-only"><SheetTitle>Sale</SheetTitle></SheetHeader>
          {cartPanel}
        </SheetContent>
      </Sheet>

      {/* Variant picker */}
      <Dialog open={!!picking} onOpenChange={(o) => { if (!o) { setPicking(null); focusSearch(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{picking?.name}</DialogTitle><DialogDescription>Choose an option</DialogDescription></DialogHeader>
          <div className="grid max-h-[60vh] gap-2 overflow-y-auto">
            {picking?.variations.map((v) => (
              <Button key={v.variation_id} variant="outline" className="h-14 justify-between text-base"
                onClick={() => { add(picking, v); setPicking(null); focusSearch(); }}>
                <span className="truncate">{variationLabel(v.attributes, v.sku)}</span>
                <span className="flex items-center gap-2">
                  {picking.track_stock && <span className={cn("text-xs", v.stock <= 0 ? "text-destructive" : "text-muted-foreground")}>{v.stock <= 0 ? "Out" : `${v.stock} left`}</span>}
                  <span className="tabular-nums">{formatMinor(v.price_minor)}</span>
                </span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Line editor */}
      <Dialog open={!!editLine} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          {editLine && <LineEditor line={editLine} canOverride={canOverride}
            onSave={(next) => { setCart((c) => ({ ...c, lines: c.lines.map((l) => (l.key === next.key ? next : l)) })); setEditing(null); }}
            onRemove={() => { setCart((c) => ({ ...c, lines: c.lines.filter((l) => l.key !== editLine.key) })); setEditing(null); }} />}
        </DialogContent>
      </Dialog>

      {/* Open item */}
      <Dialog open={openItem} onOpenChange={setOpenItem}>
        <DialogContent className="max-w-md">
          <OpenItemForm onAdd={(name, priceMinor, quantity) => {
            setCart((c) => ({ ...c, lines: [...c.lines, {
              key: `open:${newRequestKey()}`, product_id: null, variation_id: null, name, sku: null, quantity,
              list_price_minor: priceMinor, unit_price_minor: priceMinor, discount_minor: 0, stock: null,
            }] }));
            setOpenItem(false);
            focusSearch();
          }} />
        </DialogContent>
      </Dialog>

      {/* Sale discount */}
      <Dialog open={saleDiscountOpen} onOpenChange={setSaleDiscountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Discount on the sale</DialogTitle>
            <DialogDescription>
              Shared across the items by value, so refunds stay exact.{!canOverride && ` Up to ${limitBp / 100}% in total without a manager.`}
            </DialogDescription>
          </DialogHeader>
          <SaleDiscountForm of={totals.total_minor + totals.sale_discount_minor} value={cart.saleDiscount}
            onSave={(v) => { setCart((c) => ({ ...c, saleDiscount: v })); setSaleDiscountOpen(false); }} />
        </DialogContent>
      </Dialog>

      {/* Customer */}
      <Dialog open={customerOpen} onOpenChange={setCustomerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Customer</DialogTitle><DialogDescription>Optional. A cellphone number lets you WhatsApp the receipt.</DialogDescription></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setCustomerOpen(false); }}>
            <Input placeholder="Name" value={cart.customerName} maxLength={80} className="h-12"
              onChange={(e) => setCart((c) => ({ ...c, customerName: e.target.value }))} aria-label="Customer name" />
            <Input placeholder="Cellphone, e.g. 082 123 4567" inputMode="tel" value={cart.customerPhone} maxLength={30} className="h-12"
              onChange={(e) => setCart((c) => ({ ...c, customerPhone: e.target.value }))} aria-label="Customer cellphone" />
            <Input placeholder="Note on the sale" value={cart.note} maxLength={300} className="h-12"
              onChange={(e) => setCart((c) => ({ ...c, note: e.target.value }))} aria-label="Note" />
            <Button type="submit" className="h-12 w-full">Done</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Parked sales */}
      <Dialog open={parkedOpen} onOpenChange={setParkedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Parked sales</DialogTitle><DialogDescription>Kept on this device. Resuming one parks the current sale.</DialogDescription></DialogHeader>
          <ul className="max-h-[60vh] divide-y overflow-y-auto rounded-md border">
            {parked.map((p) => (
              <li key={p.id} className="flex items-center gap-2 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.parkedAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <Button size="sm" className="h-10" onClick={() => resume(p)}>Resume</Button>
                <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Delete parked sale"
                  onClick={() => setParked((list) => list.filter((x) => x.id !== p.id))}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <BarcodeScanner open={scanning} onClose={() => { setScanning(false); focusSearch(); }} continuous
        title="Scan products" description="Hold each barcode in the frame. Every scan adds one." formats={RETAIL_FORMATS}
        placeholder="or type the code" uppercase={false} onDetect={addByCode} />

      <ShiftDialog open={shiftOpen} onOpenChange={setShiftOpen} shift={currentShift}
        onChanged={(s) => {
          if (s) queryClient.setQueryData(["pos-shift", storeId, register], s);
          else queryClient.invalidateQueries({ queryKey: ["pos-shift", storeId, register] });
        }} />

      <PosCheckout open={checkout} onOpenChange={setCheckout} storeId={storeId} storeName={access.store_name} register={currentShift.register_name}
        totals={totals} canPay1145={canPay1145} online={online} onComplete={ringUp}
        onNewSale={() => { clearCart(); focusSearch(); }} />
    </div>
  );
};

const LineEditor: React.FC<{ line: CartLine; canOverride: boolean; onSave: (l: CartLine) => void; onRemove: () => void }> = ({ line, canOverride, onSave, onRemove }) => {
  const [qty, setQty] = useState(String(line.quantity));
  const [price, setPrice] = useState((line.unit_price_minor / 100).toFixed(2));
  const [discount, setDiscount] = useState(line.discount_minor);
  const q = Number(qty);
  const qtyOk = Number.isInteger(q) && q >= 1 && q <= 9999;
  const priceMinor = parseMinor(price);
  const priceOk = priceMinor !== null && (priceMinor === line.unit_price_minor || canOverride || !line.product_id);
  const gross = (priceMinor ?? line.unit_price_minor) * (qtyOk ? q : line.quantity);
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      if (qtyOk && priceOk) onSave({ ...line, quantity: q, unit_price_minor: priceMinor!, discount_minor: Math.min(discount, gross) });
    }}>
      <DialogHeader><DialogTitle>{line.name}</DialogTitle>{line.sku && <DialogDescription>SKU {line.sku}</DialogDescription>}</DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="pos-line-qty">Quantity</Label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-12 w-12" onClick={() => setQty(String(Math.max(1, (qtyOk ? q : 1) - 1)))} aria-label="One less"><Minus className="h-4 w-4" /></Button>
          <Input id="pos-line-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className="h-12 flex-1 text-center text-lg" />
          <Button type="button" variant="outline" className="h-12 w-12" onClick={() => setQty(String(Math.min(9999, (qtyOk ? q : 0) + 1)))} aria-label="One more"><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pos-line-price">Price each (R)</Label>
        <Input id="pos-line-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="h-12 text-lg"
          disabled={!!line.product_id && !canOverride} />
        {line.product_id && !canOverride && <p className="text-xs text-muted-foreground">Only a manager or operator can change a price.</p>}
        {line.product_id && priceMinor !== null && priceMinor !== line.list_price_minor && (
          <p className="text-xs text-muted-foreground">Catalogue price {formatMinor(line.list_price_minor)}</p>
        )}
      </div>
      <DiscountInput of={gross} valueMinor={line.discount_minor} onChange={setDiscount} label="Discount on this line" />
      <div className="flex justify-between text-lg font-semibold"><span>Line total</span><span className="tabular-nums">{formatMinor(Math.max(0, gross - discount))}</span></div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-12 gap-2 text-destructive" onClick={onRemove}><Trash2 className="h-4 w-4" /> Remove</Button>
        <Button type="submit" className="h-12 flex-1" disabled={!qtyOk || !priceOk}>Save</Button>
      </div>
    </form>
  );
};

const OpenItemForm: React.FC<{ onAdd: (name: string, priceMinor: number, quantity: number) => void }> = ({ onAdd }) => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const priceMinor = parseMinor(price);
  const q = Number(qty);
  const ok = name.trim() && priceMinor && priceMinor > 0 && Number.isInteger(q) && q >= 1 && q <= 9999;
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (ok) onAdd(name.trim(), priceMinor!, q); }}>
      <DialogHeader><DialogTitle>Open item</DialogTitle><DialogDescription>Something not in the catalogue. It doesn't change stock.</DialogDescription></DialogHeader>
      <Input placeholder="What is it?" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} className="h-12" aria-label="Item name" autoFocus />
      <div className="flex gap-2">
        <Input placeholder="Price (R)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="h-12 flex-1 text-lg" aria-label="Price" />
        <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className="h-12 w-20 text-center text-lg" aria-label="Quantity" />
      </div>
      <Button type="submit" className="h-12 w-full" disabled={!ok}>Add to sale</Button>
    </form>
  );
};

const SaleDiscountForm: React.FC<{ of: number; value: number; onSave: (minor: number) => void }> = ({ of, value, onSave }) => {
  const [discount, setDiscount] = useState(value);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(discount); }}>
      <DiscountInput of={of} valueMinor={value} onChange={setDiscount} label="Discount" />
      <p className="text-sm text-muted-foreground">New total {formatMinor(Math.max(0, of - discount))}</p>
      <div className="flex gap-2">
        {value > 0 && <Button type="button" variant="outline" className="h-12" onClick={() => onSave(0)}>Remove</Button>}
        <Button type="submit" className="h-12 flex-1">Apply</Button>
      </div>
    </form>
  );
};

export default PosRegister;
