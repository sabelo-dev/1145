import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Banknote, CheckCircle2, CreditCard, Landmark, Loader2, QrCode, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatMinor, parseMinor } from "@/lib/money";
import { quickCash, tenderState, type CartTotals, type Tender, type TenderMethod } from "@/lib/posCart";
import { cancelPaymentRequest, createPaymentRequest, newRequestKey, paymentLink, type PaymentRequest } from "@/services/merchantAi";
import { fetchPayRequestStatus, saleNo, TENDER_LABELS, type PosSale } from "@/services/pos";
import PosReceipt from "./PosReceipt";

const METHOD_ICONS: Record<TenderMethod, React.ElementType> = { cash: Banknote, card: CreditCard, eft: Landmark, pay_1145: QrCode };
const PAY_MIN = 500; // PayFast's smallest payment

/** Shows a 1145 Pay QR code for the amount and waits until the customer has paid. */
const Pay1145: React.FC<{
  storeId: string;
  storeName: string;
  amountMinor: number;
  register: string;
  onPaid: (request: PaymentRequest) => void;
  onCancel: () => void;
}> = ({ storeId, storeName, amountMinor, register, onPaid, onCancel }) => {
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createPaymentRequest({
      storeId, amountMinor, description: `Purchase at ${storeName}`.slice(0, 100), reference: register.slice(0, 50),
      expiresInMinutes: 15, requestKey: newRequestKey(),
    }).then(setRequest, (e: Error) => setError(e.message));
  }, [storeId, storeName, amountMinor, register]);

  const status = useQuery({
    queryKey: ["pos-pay-request", request?.id],
    queryFn: () => fetchPayRequestStatus(request!.id),
    enabled: !!request,
    refetchInterval: (q) => (q.state.data?.status === "pending" || !q.state.data ? 3000 : false),
  });

  const reported = useRef(false);
  useEffect(() => {
    if (request && status.data?.status === "paid" && !reported.current) {
      reported.current = true;
      onPaid(request);
    }
  }, [request, status.data?.status, onPaid]);

  const cancel = async () => {
    if (request && status.data?.status !== "paid") await cancelPaymentRequest(request.id).catch(() => undefined);
    onCancel();
  };

  const state = status.data?.status;
  return (
    <div className="space-y-3 rounded-lg border p-4 text-center">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !request ? (
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
      ) : (
        <>
          <p className="text-lg font-semibold">Scan to pay {formatMinor(amountMinor)}</p>
          <div className="mx-auto w-fit rounded-md bg-white p-2"><QRCodeSVG value={paymentLink(request.public_token)} size={220} level="M" marginSize={2} /></div>
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {state === "expired" || state === "cancelled" ? "This code has expired. Cancel and try again."
              : <><Loader2 className="h-4 w-4 animate-spin" /> Waiting for the payment… it appears here by itself.</>}
          </p>
        </>
      )}
      <Button variant="outline" className="h-11 w-full gap-2" onClick={() => void cancel()}><X className="h-4 w-4" /> Cancel 1145 Pay</Button>
    </div>
  );
};

export interface CheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  register: string;
  totals: CartTotals;
  canPay1145: boolean;
  online: boolean;
  /** Rings the sale up with these tenders; the parent sends the cart. */
  onComplete: (tenders: Tender[]) => Promise<PosSale>;
  onNewSale: () => void;
}

/** Taking payment: one or more tenders until the total is covered, then the receipt. */
const PosCheckout: React.FC<CheckoutProps> = ({ open, onOpenChange, storeId, storeName, register, totals, canPay1145, online, onComplete, onNewSale }) => {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [method, setMethod] = useState<TenderMethod>("cash");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paying1145, setPaying1145] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [sale, setSale] = useState<PosSale | null>(null);
  const total = totals.total_minor;
  const state = tenderState(total, tenders);
  const typed = amount.trim() === "" ? state.due_minor : parseMinor(amount);

  // Start fresh each time the dialog opens on a new cart.
  useEffect(() => {
    if (open && !sale) { setTenders([]); setAmount(""); setReference(""); setMethod("cash"); setPaying1145(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const add = (m: TenderMethod, amountMinor: number, extra: Partial<Tender> = {}) => {
    if (amountMinor <= 0) return;
    if (m !== "cash" && amountMinor > state.due_minor) {
      toast.error(`${TENDER_LABELS[m]} can't be more than the ${formatMinor(state.due_minor)} still due. Only cash gives change.`);
      return;
    }
    setTenders((t) => [...t, { id: newRequestKey(), method: m, amount_minor: amountMinor, ...extra }]);
    setAmount(""); setReference("");
  };

  const complete = async (list: Tender[]) => {
    setBusy(true);
    try {
      const done = await onComplete(list);
      setSale(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The sale didn't go through. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const close = (o: boolean) => {
    if (o) return onOpenChange(true);
    if (paying1145 !== null) { toast.error("Finish or cancel the 1145 Pay payment first"); return; }
    if (sale) { setSale(null); onNewSale(); }
    onOpenChange(false);
  };

  // 1145 Pay tenders can't be undone from here (the customer has paid), so keep them.
  const removable = (t: Tender) => t.method !== "pay_1145";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[94vh] max-w-lg overflow-y-auto">
        {sale ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl"><CheckCircle2 className="h-7 w-7 text-green-600" aria-hidden /> Sale {saleNo(sale.sale_number)} done</DialogTitle>
              <DialogDescription>{sale.repeated ? "This sale had already gone through; here is its receipt." : "Hand over the receipt or send it to the customer."}</DialogDescription>
            </DialogHeader>
            {sale.change_minor > 0 && (
              <div className="rounded-lg border-2 border-green-600 p-4 text-center">
                <p className="text-sm text-muted-foreground">Change to give</p>
                <p className="text-4xl font-bold tabular-nums">{formatMinor(sale.change_minor)}</p>
              </div>
            )}
            <PosReceipt sale={sale} />
            <Button className="h-14 w-full text-lg" onClick={() => close(false)}>New sale</Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Charge {formatMinor(total)}</DialogTitle>
              <DialogDescription>
                {totals.items} item{totals.items === 1 ? "" : "s"}{totals.vat_minor > 0 ? ` · VAT ${formatMinor(totals.vat_minor)} included` : ""}
              </DialogDescription>
            </DialogHeader>

            {tenders.length > 0 && (
              <ul className="divide-y rounded-md border text-sm">
                {tenders.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>{TENDER_LABELS[t.method]}{t.reference ? ` · ${t.reference}` : ""}</span>
                    <span className="flex items-center gap-2 tabular-nums">
                      {formatMinor(t.amount_minor)}
                      {removable(t) && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove ${TENDER_LABELS[t.method]} payment`}
                          onClick={() => setTenders((list) => list.filter((x) => x.id !== t.id))}><X className="h-4 w-4" /></Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-baseline justify-between rounded-md bg-muted p-3">
              <span className="font-medium">{state.due_minor > 0 ? "Still to pay" : state.change_minor > 0 ? "Change" : "Paid"}</span>
              <span className="text-2xl font-bold tabular-nums">{formatMinor(state.due_minor > 0 ? state.due_minor : state.change_minor)}</span>
            </div>
            {state.problem && <p className="text-sm text-destructive">{state.problem}</p>}

            {paying1145 !== null ? (
              <Pay1145 storeId={storeId} storeName={storeName} amountMinor={paying1145} register={register}
                onPaid={(r) => {
                  setPaying1145(null);
                  const next = [...tenders, { id: r.id, method: "pay_1145" as const, amount_minor: r.amount_minor, payment_request_id: r.id }];
                  setTenders(next);
                  toast.success("1145 Pay payment received");
                  if (tenderState(total, next).complete) void complete(next);
                }}
                onCancel={() => setPaying1145(null)} />
            ) : state.due_minor > 0 && (
              <div className="space-y-3">
                <div className={`grid gap-2 ${canPay1145 ? "grid-cols-4" : "grid-cols-3"}`}>
                  {(["cash", "card", "eft", ...(canPay1145 ? ["pay_1145"] : [])] as TenderMethod[]).map((m) => {
                    const Icon = METHOD_ICONS[m];
                    return (
                      <Button key={m} type="button" variant={method === m ? "default" : "outline"} className="h-16 flex-col gap-1 px-1 text-xs sm:text-sm"
                        onClick={() => setMethod(m)} aria-pressed={method === m}>
                        <Icon className="h-5 w-5" aria-hidden /> {TENDER_LABELS[m]}
                      </Button>
                    );
                  })}
                </div>

                {method === "cash" && (
                  <div className="flex flex-wrap gap-2">
                    {quickCash(state.due_minor).map((q) => (
                      <Button key={q} variant="secondary" className="h-12 min-w-[5.5rem] flex-1 text-base" onClick={() => add("cash", q)}>
                        {q === state.due_minor ? "Exact" : formatMinor(q).replace(/[.,]00$/, "")}
                      </Button>
                    ))}
                  </div>
                )}

                {method === "pay_1145" ? (
                  <Button className="h-14 w-full text-lg" disabled={!online || state.due_minor < PAY_MIN}
                    onClick={() => setPaying1145(state.due_minor)}>
                    {state.due_minor < PAY_MIN ? "1145 Pay needs at least R5" : `Show QR for ${formatMinor(state.due_minor)}`}
                  </Button>
                ) : (
                  <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (typed) add(method, typed, reference.trim() ? { reference: reference.trim() } : {}); }}>
                    <div className="flex gap-2">
                      <Input inputMode="decimal" placeholder={`${formatMinor(state.due_minor)}`} value={amount} onChange={(e) => setAmount(e.target.value)}
                        className="h-12 flex-1 text-lg" aria-label={`${TENDER_LABELS[method]} amount`} aria-invalid={typed === null} />
                      <Button type="submit" className="h-12 px-5" disabled={!typed}>Add {TENDER_LABELS[method]}</Button>
                    </div>
                    {method !== "cash" && (
                      <Input placeholder={method === "card" ? "Card machine slip no. (optional)" : "EFT reference (optional)"} value={reference}
                        maxLength={60} onChange={(e) => setReference(e.target.value)} className="h-11" aria-label="Reference" />
                    )}
                    {method === "card" && <p className="text-xs text-muted-foreground">Take the card on your card machine first, then add it here.</p>}
                  </form>
                )}
              </div>
            )}

            {paying1145 === null && (
              <Button className="h-14 w-full bg-green-600 text-lg hover:bg-green-700" disabled={!state.complete || busy || !online}
                onClick={() => void complete(tenders)}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : !online ? "Offline: waiting for the connection" : "Complete sale"}
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PosCheckout;
