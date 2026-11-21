import React from "react";
import { format } from "date-fns";
import { MessageCircle, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatMinor } from "@/lib/money";
import { isNative } from "@/lib/native";
import { saleNo, TENDER_LABELS, type PosSale } from "@/services/pos";

const STATUS_TEXT: Record<PosSale["status"], string | null> = {
  completed: null,
  partially_refunded: "PART REFUNDED",
  refunded: "REFUNDED",
  voided: "VOIDED",
};

const addressLine = (a: PosSale["store"]["address"]) =>
  a ? [a.street, a.city].filter(Boolean).join(", ") : "";

/** The receipt as plain text, for sharing to WhatsApp, SMS, email or a printer app. */
export function receiptText(sale: PosSale): string {
  const w = 32;
  const row = (left: string, right: string) => {
    const space = Math.max(1, w - left.length - right.length);
    return left.length + right.length + 1 > w ? `${left}\n${" ".repeat(Math.max(0, w - right.length))}${right}` : left + " ".repeat(space) + right;
  };
  const money = (m: number) => formatMinor(m).replace(/\s/g, " ");
  const out: string[] = [];
  out.push(sale.store.name);
  if (sale.store.receipt_header) out.push(sale.store.receipt_header);
  const addr = addressLine(sale.store.address);
  if (addr) out.push(addr);
  if (sale.store.address?.phone) out.push(`Tel ${sale.store.address.phone}`);
  if (sale.store.vat_number) out.push(`VAT no. ${sale.store.vat_number}`);
  out.push(sale.store.vat_number ? "TAX INVOICE" : "RECEIPT");
  if (STATUS_TEXT[sale.status]) out.push(`*** ${STATUS_TEXT[sale.status]} ***`);
  out.push(`${saleNo(sale.sale_number)}  ${format(new Date(sale.created_at), "d MMM yyyy HH:mm")}`);
  out.push(`${sale.register_name}${sale.cashier ? ` · ${sale.cashier}` : ""}`);
  out.push("-".repeat(w));
  for (const l of sale.lines) {
    out.push(l.name);
    out.push(row(`  ${l.quantity} x ${money(l.unit_price_minor)}`, money(l.line_total_minor)));
    if (l.discount_minor > 0) out.push(`  incl. discount ${money(l.discount_minor)}`);
  }
  out.push("-".repeat(w));
  if (sale.discount_minor > 0) out.push(row("You saved", money(sale.discount_minor)));
  out.push(row("TOTAL", money(sale.total_minor)));
  if (sale.vat_minor > 0) out.push(row(`VAT ${sale.vat_rate_bp / 100}% incl.`, money(sale.vat_minor)));
  for (const p of sale.payments) out.push(row(TENDER_LABELS[p.method], money(p.tendered_minor)));
  if (sale.change_minor > 0) out.push(row("Change", money(sale.change_minor)));
  for (const r of sale.refunds) out.push(row(`Refund ${format(new Date(r.created_at), "d MMM")} (${TENDER_LABELS[r.method]})`, `-${money(r.amount_minor)}`));
  if (sale.store.receipt_footer) { out.push(""); out.push(sale.store.receipt_footer); }
  return out.join("\n");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Prints an 80 mm slip through the browser's print dialog (USB or network receipt printers). */
function printReceipt(sale: PosSale) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(saleNo(sale.sale_number))}</title>
<style>@page{size:80mm auto;margin:4mm}body{font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;margin:0;color:#000}
pre{white-space:pre-wrap;margin:0}</style></head><body><pre>${esc(receiptText(sale))}</pre></body></html>`);
  doc.close();
  const win = frame.contentWindow!;
  const cleanup = () => setTimeout(() => frame.remove(), 500);
  win.onafterprint = cleanup;
  setTimeout(() => { win.focus(); win.print(); cleanup(); }, 50);
}

async function shareReceipt(sale: PosSale) {
  const text = receiptText(sale);
  const title = `${sale.store.name} receipt ${saleNo(sale.sale_number)}`;
  try {
    if (isNative()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text, dialogTitle: "Send or print the receipt" });
      return;
    }
    if (navigator.share) { await navigator.share({ title, text }); return; }
    await navigator.clipboard.writeText(text);
    toast.success("Receipt copied");
  } catch (e) {
    if (e instanceof Error && /cancel|abort/i.test(e.message + e.name)) return;
    toast.error("Could not share the receipt");
  }
}

/** 082 123 4567 → 27821234567 for wa.me links. Null when it isn't a phone number. */
export function whatsappNumber(phone: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return `27${digits.slice(1)}`;
  if (/^27\d{9}$/.test(digits)) return digits;
  return null;
}

/** A sale's receipt as it prints, with buttons to print, share or WhatsApp it. */
const PosReceipt: React.FC<{ sale: PosSale; actions?: boolean }> = ({ sale, actions = true }) => {
  const wa = whatsappNumber(sale.customer_phone);
  return (
    <div className="space-y-3">
      <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-mono text-[13px] leading-snug">
        {receiptText(sale)}
      </pre>
      {actions && (
        <div className="flex flex-wrap gap-2">
          {!isNative() && (
            <Button variant="outline" className="h-11 flex-1 gap-2" onClick={() => printReceipt(sale)}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          )}
          <Button variant="outline" className="h-11 flex-1 gap-2" onClick={() => void shareReceipt(sale)}>
            <Share2 className="h-4 w-4" /> {isNative() ? "Share or print" : "Share"}
          </Button>
          {wa && (
            <Button variant="outline" className="h-11 flex-1 gap-2" asChild>
              <a href={`https://wa.me/${wa}?text=${encodeURIComponent(receiptText(sale))}`} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default PosReceipt;
