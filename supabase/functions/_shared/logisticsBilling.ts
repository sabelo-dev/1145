// Shared invoice / reminder / statement emails for 1145 Logistics billing.
// Used by logistics-invoice-email (manual) and logistics-billing-run (daily cron).
// deno-lint-ignore-file no-explicit-any

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM = Deno.env.get("LOGISTICS_BILLING_FROM") || Deno.env.get("LOGISTICS_EMAIL_FROM") || "1145 Logistics Billing <billing@1145.io>";
const PORTAL_URL = (Deno.env.get("LOGISTICS_PORTAL_URL") || "https://logistics.1145.io/portal").replace(/\/+$/, "");

export const billingEmailConfigured = () => !!RESEND_KEY;

export const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const rands = (n: number) => `R ${Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const day = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Johannesburg" }) : "";

function shell(title: string, body: string, cta: { href: string; label: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:640px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#1e3a5f;color:#fff;padding:18px 24px;font-weight:600">${esc(title)}</td></tr>
<tr><td style="padding:24px;font-size:14px;line-height:1.5">${body}
<p style="margin:20px 0 0"><a href="${esc(cta.href)}" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">${esc(cta.label)}</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

export function invoiceEmail(inv: any, acct: any, lines: Array<{ description: string; amount: number }>, kind: "invoice" | "reminder") {
  const overdue = inv.status === "issued" && inv.due_date && new Date(inv.due_date) < new Date();
  const subject =
    kind === "reminder"
      ? `${overdue ? "Overdue" : "Reminder"}: invoice ${inv.number} (${rands(inv.total)})`
      : `Invoice ${inv.number} from 1145 Logistics (${rands(inv.total)})`;
  const intro =
    kind === "reminder"
      ? overdue
        ? "The invoice below is now overdue. New bookings on your account are paused until it's settled."
        : "A friendly reminder about the invoice below."
      : `Please find your invoice for ${day(inv.period_start)} to ${day(inv.period_end)} below.`;
  const rows = lines
    .map((l) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(l.description)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${rands(l.amount)}</td></tr>`)
    .join("");
  const body = `<p style="margin:0 0 12px">Hi ${esc(acct.name)},</p><p style="margin:0 0 16px">${esc(intro)}</p>
<p style="margin:0 0 4px"><strong>Total due: ${rands(inv.total)}</strong>${inv.due_date ? ` · due ${esc(day(inv.due_date))}` : ""}</p>
<p style="margin:0 0 16px;color:#555">Use <strong>${esc(inv.number)}</strong> as your payment reference.</p>
<table width="100%" style="border-collapse:collapse;font-size:13px">${rows}
<tr><td style="padding:8px 0;text-align:right">Subtotal</td><td style="padding:8px 0;text-align:right">${rands(inv.subtotal)}</td></tr>
<tr><td style="text-align:right">VAT 15%</td><td style="text-align:right">${rands(inv.vat)}</td></tr>
<tr><td style="padding-top:6px;text-align:right;font-weight:600">Total</td><td style="padding-top:6px;text-align:right;font-weight:600">${rands(inv.total)}</td></tr></table>
${acct.vat_no ? `<p style="margin:16px 0 0;color:#777;font-size:12px">Customer VAT no. ${esc(acct.vat_no)}</p>` : ""}`;
  return { subject, html: shell(`1145 Logistics · Tax invoice ${inv.number}`, body, { href: `${PORTAL_URL}/invoices`, label: "View in your business portal" }) };
}

export function statementEmail(acct: any, invoices: any[], asOf: Date) {
  const open = invoices.filter((i) => i.status === "issued");
  const total = open.reduce((a, i) => a + Number(i.total), 0);
  const overdue = open.filter((i) => i.due_date && new Date(i.due_date) < asOf).reduce((a, i) => a + Number(i.total), 0);
  const rows = open
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(i.number)}</td><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(day(i.due_date))}${
          i.due_date && new Date(i.due_date) < asOf ? ' <span style="color:#b91c1c">overdue</span>' : ""
        }</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${rands(i.total)}</td></tr>`,
    )
    .join("");
  const body = `<p style="margin:0 0 12px">Hi ${esc(acct.name)},</p>
<p style="margin:0 0 16px">Here is your account statement as at ${esc(day(asOf.toISOString()))}.</p>
<p style="margin:0 0 4px"><strong>Balance: ${rands(total)}</strong>${overdue ? ` · <span style="color:#b91c1c">${rands(overdue)} overdue</span>` : ""}</p>
${
  open.length
    ? `<table width="100%" style="border-collapse:collapse;font-size:13px;margin-top:12px"><tr><th align="left">Invoice</th><th align="left">Due</th><th align="right">Amount</th></tr>${rows}</table>`
    : `<p style="color:#555">Nothing outstanding. Thank you!</p>`
}`;
  return {
    subject: `Statement for ${acct.name}: ${rands(total)} outstanding`,
    html: shell("1145 Logistics · Account statement", body, { href: `${PORTAL_URL}/invoices`, label: "View invoices" }),
  };
}

export function digestEmail(acct: any, items: Array<{ tracking_number: string; reference: string | null; recipient_name: string; status: string; note: string | null }>) {
  const label: Record<string, string> = {
    failed_attempt: "Missed delivery",
    exception: "Problem",
    returning: "Returning to you",
    returned: "Returned",
    at_risk: "At risk of being late",
  };
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-family:ui-monospace,monospace;font-size:12px">${esc(i.tracking_number)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${esc(
          i.reference ?? "",
        )}</td><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(i.recipient_name)}</td><td style="padding:6px 0;border-bottom:1px solid #eee"><strong>${esc(label[i.status] ?? i.status)}</strong>${
          i.note ? `<br><span style="color:#555">${esc(i.note)}</span>` : ""
        }</td></tr>`,
    )
    .join("");
  const body = `<p style="margin:0 0 12px">Hi ${esc(acct.name)},</p>
<p style="margin:0 0 16px">${items.length} of your parcels need attention from the last 24 hours. Most missed deliveries are resolved by confirming the address or phone number with your customer.</p>
<table width="100%" style="border-collapse:collapse;font-size:13px"><tr><th align="left">Tracking</th><th align="left">Ref</th><th align="left">Recipient</th><th align="left">What happened</th></tr>${rows}</table>`;
  return {
    subject: `${items.length} parcel${items.length === 1 ? "" : "s"} need attention · ${acct.name}`,
    html: shell("1145 Logistics · Daily delivery exceptions", body, { href: `${PORTAL_URL}/shipments`, label: "Open your shipments" }),
  };
}

export async function sendBillingEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend [${res.status}]: ${(await res.text()).slice(0, 200)}`);
}
