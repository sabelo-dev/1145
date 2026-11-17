import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { Building2, FileText, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "../lib/db";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { EmptyState, PageHeader } from "../components/common";
import AccountTeam from "../components/AccountTeam";
import { supabase } from "@/integrations/supabase/client";

export interface Account {
  id: string;
  name: string;
  registration_no: string | null;
  vat_no: string | null;
  billing_email: string | null;
  billing_address: string | null;
  payment_terms_days: number;
  credit_limit: number;
  discount_pct: number;
  status: "active" | "on_hold" | "closed";
  notes: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  number: string;
  account_id: string;
  period_start: string;
  period_end: string;
  subtotal: number;
  vat: number;
  total: number;
  status: "draft" | "issued" | "paid" | "void";
  issued_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  payment_ref: string | null;
  emailed_at?: string | null;
  reminder_sent_at?: string | null;
}

interface Standing {
  status: string;
  credit_limit: number;
  invoiced_unpaid: number;
  overdue: number;
  unbilled: number;
}

const rands = (n: number) => `R ${Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const STATUS_TONE: Record<Invoice["status"], string> = {
  draft: "text-muted-foreground",
  issued: "text-blue-700 dark:text-blue-300",
  paid: "text-emerald-700 dark:text-emerald-400",
  void: "text-muted-foreground line-through",
};

export async function printInvoice(inv: Invoice, account: Account | undefined) {
  const { data: lines } = await db.from("logistics_invoice_lines").select("description, amount").eq("invoice_id", inv.id).order("description");
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) return;
  const rows = (lines ?? [])
    .map((l: { description: string; amount: number }) => `<tr><td>${esc(l.description)}</td><td class="r">${rands(l.amount)}</td></tr>`)
    .join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.number)}</title>
<style>body{font-family:system-ui,sans-serif;color:#111;margin:40px}h1{margin:0 0 4px;font-size:22px}table{width:100%;border-collapse:collapse;margin-top:24px;font-size:13px}
td,th{padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:left}.r{text-align:right}.muted{color:#666;font-size:13px}.tot td{border:none;font-weight:600}
.grid{display:flex;justify-content:space-between;gap:24px;margin-top:20px;font-size:14px}</style></head><body>
<h1>Tax invoice ${esc(inv.number)}</h1><div class="muted">1145 Logistics · LSI</div>
<div class="grid"><div><strong>Bill to</strong><br>${esc(account?.name)}<br>${esc(account?.billing_address).replace(/\n/g, "<br>")}
${account?.vat_no ? `<br>VAT no. ${esc(account.vat_no)}` : ""}${account?.registration_no ? `<br>Reg. ${esc(account.registration_no)}` : ""}</div>
<div class="r">Period ${esc(format(new Date(inv.period_start), "d MMM yyyy"))} to ${esc(format(new Date(inv.period_end), "d MMM yyyy"))}<br>
${inv.issued_at ? `Issued ${esc(format(new Date(inv.issued_at), "d MMM yyyy"))}<br>` : "DRAFT<br>"}${inv.due_date ? `Due ${esc(format(new Date(inv.due_date), "d MMM yyyy"))}` : ""}</div></div>
<table><thead><tr><th>Shipment</th><th class="r">Amount (excl. VAT)</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr class="tot"><td class="r">Subtotal</td><td class="r">${rands(inv.subtotal)}</td></tr><tr class="tot"><td class="r">VAT 15%</td><td class="r">${rands(inv.vat)}</td></tr>
<tr class="tot"><td class="r">Total</td><td class="r">${rands(inv.total)}</td></tr></tfoot></table>
<p class="muted" style="margin-top:32px">Payment terms: ${account?.payment_terms_days ?? 30} days. Quote ${esc(inv.number)} as your payment reference.</p>
<script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

const AccountsPage: React.FC = () => {
  const { can } = useLogisticsAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [month, setMonth] = useState(format(subMonths(new Date(), 1), "yyyy-MM"));
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [payRef, setPayRef] = useState("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["lx", "accounts"],
    enabled: can("owner"),
    queryFn: async () => {
      const { data, error } = await db.from("logistics_accounts").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });
  const { data: standings = {} } = useQuery({
    queryKey: ["lx", "account-standing", accounts.map((a) => a.id).join(",")],
    enabled: accounts.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        accounts.map(async (a) => [a.id, (await db.rpc("logistics_account_standing", { p_account_id: a.id })).data as Standing] as const),
      );
      return Object.fromEntries(entries) as Record<string, Standing>;
    },
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["lx", "invoices"],
    enabled: can("owner"),
    queryFn: async () => {
      const { data, error } = await db.from("logistics_invoices").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
  });

  if (!can("owner")) return <Navigate to="/" replace />;

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";
  const refresh = () => qc.invalidateQueries({ queryKey: ["lx"] });

  const generate = async () => {
    const start = startOfMonth(new Date(`${month}-01T12:00:00`));
    const { data, error } = await db.rpc("logistics_generate_invoices", {
      p_period_start: format(start, "yyyy-MM-dd"),
      p_period_end: format(endOfMonth(start), "yyyy-MM-dd"),
    });
    if (error) toast({ variant: "destructive", title: "Could not generate", description: error.message });
    else toast({ title: `${data} draft invoice${data === 1 ? "" : "s"} prepared`, description: "Review, then issue." });
    refresh();
  };

  const email = async (inv: Invoice, kind: "invoice" | "reminder") => {
    const { data, error } = await supabase.functions.invoke("logistics-invoice-email", { body: { invoiceId: inv.id, kind } });
    let code = (data as { error?: string } | null)?.error;
    if (error) {
      try {
        code = (await (error as { context?: Response }).context?.json())?.error ?? error.message;
      } catch {
        code = error.message;
      }
    }
    if (code) {
      const msg: Record<string, string> = {
        no_billing_email: "Add a billing email to the account first.",
        email_not_configured: "Email isn't configured (RESEND_API_KEY).",
        invoice_not_issued: "Issue the invoice before emailing it.",
      };
      toast({ variant: "destructive", title: "Not sent", description: msg[code] ?? code });
      return;
    }
    toast({ title: kind === "reminder" ? "Reminder sent" : "Invoice emailed", description: (data as { to?: string })?.to });
    refresh();
  };

  const setStatus = async (inv: Invoice, status: "issued" | "paid" | "void", ref?: string) => {
    if (status === "void" && !window.confirm(`Void ${inv.number}? Its shipments become billable again.`)) return;
    const { error } = await db.rpc("logistics_set_invoice_status", { p_invoice_id: inv.id, p_status: status, p_payment_ref: ref ?? null });
    if (error) toast({ variant: "destructive", title: "Update failed", description: error.message });
    else toast({ title: `${inv.number} ${status}` });
    setPaying(null);
    setPayRef("");
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Business accounts"
        description="Merchants and companies billed monthly on credit."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New account
          </Button>
        }
      />
      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          {accounts.length === 0 ? (
            <EmptyState icon={<Building2 className="h-8 w-8" />} title="No business accounts" description="Create one, then link API keys or pick it when booking." />
          ) : (
            <div className="rounded-xl border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Credit used</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Overdue</TableHead>
                    <TableHead className="hidden md:table-cell">Terms</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a) => {
                    const st = standings[a.id];
                    const used = st ? Number(st.invoiced_unpaid) + Number(st.unbilled) : 0;
                    const pct = a.credit_limit ? Math.min(100, Math.round((used / a.credit_limit) * 100)) : 0;
                    return (
                      <TableRow key={a.id} className="cursor-pointer" onClick={() => setEditing(a)}>
                        <TableCell>
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.billing_email ?? "no billing email"}
                            {a.discount_pct > 0 ? ` · ${a.discount_pct}% discount` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="tabular-nums text-sm">
                            {rands(used)} <span className="text-muted-foreground">/ {rands(a.credit_limit)}</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className={`h-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                          </div>
                        </TableCell>
                        <TableCell className={`text-right hidden md:table-cell tabular-nums ${st && Number(st.overdue) > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                          {st ? rands(st.overdue) : "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{a.payment_terms_days} days</TableCell>
                        <TableCell className="text-sm capitalize">{a.status.replace("_", " ")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            New API bookings are refused automatically when an account is on hold, has overdue invoices, or would go over its credit limit.
          </p>
        </TabsContent>

        <TabsContent value="invoices">
          <div className="flex flex-wrap items-end gap-2 mb-3">
            <div className="space-y-1.5">
              <Label>Billing month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
            </div>
            <Button variant="outline" onClick={generate}>
              <FileText className="h-4 w-4 mr-1.5" /> Prepare drafts
            </Button>
            <p className="text-xs text-muted-foreground">Drafts are also prepared automatically on the 1st of each month.</p>
          </div>
          {invoices.length === 0 ? (
            <EmptyState icon={<FileText className="h-8 w-8" />} title="No invoices yet" />
          ) : (
            <div className="rounded-xl border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const overdue = inv.status === "issued" && inv.due_date && new Date(inv.due_date) < new Date();
                    return (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <div className="font-mono text-xs">{inv.number}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(inv.period_start), "d MMM")} – {format(new Date(inv.period_end), "d MMM yyyy")}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{accountName(inv.account_id)}</TableCell>
                        <TableCell className="text-right tabular-nums">{rands(inv.total)}</TableCell>
                        <TableCell className={`text-sm capitalize ${STATUS_TONE[inv.status]}`}>
                          {overdue ? <span className="text-red-600 font-medium">Overdue</span> : inv.status}
                          {inv.due_date && inv.status === "issued" && <div className="text-xs text-muted-foreground">due {format(new Date(inv.due_date), "d MMM")}</div>}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => printInvoice(inv, accounts.find((a) => a.id === inv.account_id))} aria-label="Print">
                            <Printer className="h-4 w-4" />
                          </Button>
                          {inv.status === "draft" && (
                            <Button size="sm" variant="outline" onClick={() => setStatus(inv, "issued")}>
                              Issue
                            </Button>
                          )}
                          {(inv.status === "issued" || inv.status === "paid") && (
                            <Button size="sm" variant="ghost" onClick={() => email(inv, "invoice")} title={inv.emailed_at ? `Emailed ${format(new Date(inv.emailed_at), "d MMM HH:mm")}` : "Email to billing contact"}>
                              {inv.emailed_at ? "Re-send" : "Email"}
                            </Button>
                          )}
                          {inv.status === "issued" && (
                            <Button size="sm" variant="ghost" onClick={() => email(inv, "reminder")} title={inv.reminder_sent_at ? `Last reminder ${format(new Date(inv.reminder_sent_at), "d MMM")}` : "Send payment reminder"}>
                              Remind
                            </Button>
                          )}
                          {inv.status === "issued" && (
                            <Button size="sm" variant="outline" onClick={() => setPaying(inv)}>
                              Mark paid
                            </Button>
                          )}
                          {(inv.status === "draft" || inv.status === "issued") && (
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setStatus(inv, "void")}>
                              Void
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {editing && <AccountDialog account={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record payment: {paying?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Bank reference</Label>
            <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="EFT / POP reference" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaying(null)}>
              Cancel
            </Button>
            <Button disabled={!payRef.trim()} onClick={() => paying && setStatus(paying, "paid", payRef)}>
              Mark paid {paying ? rands(paying.total) : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AccountDialog: React.FC<{ account: Account | null; onClose: () => void; onSaved: () => void }> = ({ account, onClose, onSaved }) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: account?.name ?? "",
    registration_no: account?.registration_no ?? "",
    vat_no: account?.vat_no ?? "",
    billing_email: account?.billing_email ?? "",
    billing_address: account?.billing_address ?? "",
    payment_terms_days: String(account?.payment_terms_days ?? 30),
    credit_limit: String(account?.credit_limit ?? 10000),
    discount_pct: String(account?.discount_pct ?? 0),
    status: account?.status ?? ("active" as Account["status"]),
    notes: account?.notes ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const row = {
      name: form.name.trim(),
      registration_no: form.registration_no || null,
      vat_no: form.vat_no || null,
      billing_email: form.billing_email || null,
      billing_address: form.billing_address || null,
      payment_terms_days: Number(form.payment_terms_days) || 30,
      credit_limit: Number(form.credit_limit) || 0,
      discount_pct: Number(form.discount_pct) || 0,
      status: form.status,
      notes: form.notes || null,
    };
    const { error } = account ? await db.from("logistics_accounts").update(row).eq("id", account.id) : await db.from("logistics_accounts").insert(row);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Not saved", description: error.message });
      return;
    }
    toast({ title: account ? "Account updated" : "Account created" });
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account ? account.name : "New business account"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Company name</Label>
            <Input required value={form.name} onChange={set("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Registration no.</Label>
              <Input value={form.registration_no} onChange={set("registration_no")} />
            </div>
            <div className="space-y-1.5">
              <Label>VAT no.</Label>
              <Input value={form.vat_no} onChange={set("vat_no")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Billing email</Label>
            <Input type="email" value={form.billing_email} onChange={set("billing_email")} />
          </div>
          <div className="space-y-1.5">
            <Label>Billing address</Label>
            <Textarea rows={2} value={form.billing_address} onChange={set("billing_address")} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Terms (days)</Label>
              <Input type="number" min={0} max={120} value={form.payment_terms_days} onChange={set("payment_terms_days")} />
            </div>
            <div className="space-y-1.5">
              <Label>Credit limit (R)</Label>
              <Input type="number" min={0} value={form.credit_limit} onChange={set("credit_limit")} />
            </div>
            <div className="space-y-1.5">
              <Label>Discount %</Label>
              <Input type="number" min={0} max={60} step="0.5" value={form.discount_pct} onChange={set("discount_pct")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as Account["status"] }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On hold (no new bookings)</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Internal notes</Label>
            <Textarea rows={2} value={form.notes} onChange={set("notes")} />
          </div>
          {account && (
            <div className="space-y-1.5 border-t pt-3">
              <Label>Business portal users</Label>
              <p className="text-xs text-muted-foreground">They sign in to the same app and see only this account's shipments, invoices and API keys.</p>
              <AccountTeam accountId={account.id} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AccountsPage;
