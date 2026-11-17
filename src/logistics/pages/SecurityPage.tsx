import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { db } from "../lib/db";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { PageHeader } from "../components/common";
import MfaSetup from "../components/MfaSetup";

interface Settings {
  require_mfa: boolean;
  idle_timeout_minutes: number;
  sla_warning_minutes: number;
  approval_declared_value: number;
  approval_cod_amount: number;
  pii_retention_days: number;
  auto_issue_invoices: boolean;
  send_monthly_statements: boolean;
  reminder_days: number[];
  auto_hold_after_days: number;
  updated_at: string;
}

interface AuditRow {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  created_at: string;
}

const SecurityPage: React.FC = () => {
  const { can, aal, refresh } = useLogisticsAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isOwner = can("owner");
  const [enrolling, setEnrolling] = useState(false);

  const { data: factors = [], refetch: refetchFactors } = useQuery({
    queryKey: ["lx", "mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data.totp.filter((f) => f.status === "verified");
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["lx", "settings"],
    queryFn: async () => {
      const { data, error } = await db.from("logistics_settings").select("*").maybeSingle();
      if (error) throw error;
      return data as Settings | null;
    },
  });
  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => setForm(settings ?? null), [settings]);

  const { data: audit = [] } = useQuery({
    queryKey: ["lx", "audit"],
    enabled: isOwner,
    queryFn: async () => {
      const { data, error } = await db.from("logistics_audit_log").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });
  const { data: members = [] } = useQuery({
    queryKey: ["lx", "members"],
    enabled: isOwner,
    queryFn: async () => {
      const { data } = await db.rpc("logistics_list_members");
      return (data ?? []) as Array<{ user_id: string; email: string }>;
    },
  });

  const save = async () => {
    if (!form) return;
    const {
      require_mfa, idle_timeout_minutes, sla_warning_minutes,
      approval_declared_value, approval_cod_amount, pii_retention_days,
      auto_issue_invoices, send_monthly_statements, reminder_days, auto_hold_after_days,
    } = form;
    const { error } = await db
      .from("logistics_settings")
      .update({
        require_mfa, idle_timeout_minutes, sla_warning_minutes,
        approval_declared_value, approval_cod_amount, pii_retention_days,
        auto_issue_invoices, send_monthly_statements, reminder_days, auto_hold_after_days,
      })
      .eq("id", true);
    if (error) {
      toast({
        variant: "destructive",
        title: "Not saved",
        description: error.message.includes("enable_mfa_yourself_first") ? "Turn on two-factor for your own account (above) before requiring it for everyone." : error.message,
      });
      return;
    }
    toast({ title: "Settings saved" });
    qc.invalidateQueries({ queryKey: ["lx", "settings"] });
    qc.invalidateQueries({ queryKey: ["lx", "audit"] });
    refresh();
  };

  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => (f ? { ...f, [k]: Number(e.target.value) } : f));
  const who = (id: string | null) => (id ? members.find((m) => m.user_id === id)?.email ?? id.slice(0, 8) : "system");

  return (
    <div className="space-y-4">
      <PageHeader title="Security & dispatch" description="Account protection, automated dispatch rules and an audit trail of sensitive changes." />

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          {factors.length ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldAlert className="h-4 w-4 text-amber-600" />}
          Your two-factor authentication
        </h2>
        {factors.length ? (
          <p className="text-sm text-muted-foreground">
            On ({factors.length} authenticator{factors.length > 1 ? "s" : ""}). This session is {aal === "aal2" ? "verified with a second factor" : "not yet verified with a second factor"}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Off. Protect dispatch, customer data and API keys with an authenticator app.</p>
        )}
        {enrolling || (factors.length > 0 && aal !== "aal2") ? (
          <MfaSetup
            forceEnroll={enrolling}
            onVerified={async () => {
              await supabase.auth.refreshSession();
              setEnrolling(false);
              refetchFactors();
              refresh();
            }}
          />
        ) : (
          !factors.length && (
            <Button size="sm" onClick={() => setEnrolling(true)}>
              Set up two-factor
            </Button>
          )
        )}
      </section>

      {isOwner && form && (
        <section className="rounded-xl border bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold">Team policy</h2>
          <label className="flex items-start gap-3">
            <Switch checked={form.require_mfa} onCheckedChange={(v) => setForm({ ...form, require_mfa: v })} />
            <span>
              <span className="text-sm font-medium block">Require two-factor for all logistics staff</span>
              <span className="text-xs text-muted-foreground">Enforced in the database: without a verified second factor, a session sees no logistics data.</span>
            </span>
          </label>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Idle sign-out (minutes)</Label>
              <Input type="number" min={5} max={480} value={form.idle_timeout_minutes} onChange={num("idle_timeout_minutes")} />
            </div>
          </div>

          <h2 className="text-sm font-semibold flex items-center gap-2 pt-2">
            <Zap className="h-4 w-4" /> Delivery promises
          </h2>
          <p className="text-xs text-muted-foreground -mt-2">
            On-demand jobs are offered to nearby drivers by 1145 dispatch. Jobs on a planned route or awaiting approval are never offered.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Flag SLA risk this long before promise (min)</Label>
              <Input type="number" min={10} max={480} value={form.sla_warning_minutes} onChange={num("sla_warning_minutes")} />
            </div>
          </div>
          <h2 className="text-sm font-semibold pt-2">High-value controls</h2>
          <p className="text-xs text-muted-foreground -mt-2">
            Parcels at or above these amounts are held until a second person approves them (the booker cannot approve their own).
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Declared value (R)</Label>
              <Input type="number" min={0} value={form.approval_declared_value} onChange={num("approval_declared_value")} />
            </div>
            <div className="space-y-1.5">
              <Label>Cash on delivery (R)</Label>
              <Input type="number" min={0} value={form.approval_cod_amount} onChange={num("approval_cod_amount")} />
            </div>
          </div>

          <h2 className="text-sm font-semibold pt-2">Billing automation</h2>
          <label className="flex items-start gap-3">
            <Switch checked={form.auto_issue_invoices} onCheckedChange={(v) => setForm({ ...form, auto_issue_invoices: v })} />
            <span>
              <span className="text-sm font-medium block">Issue and email invoices automatically</span>
              <span className="text-xs text-muted-foreground">Monthly drafts are issued at 06:00 on the 1st and emailed to each billing contact. Off: you review and issue them.</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <Switch checked={form.send_monthly_statements} onCheckedChange={(v) => setForm({ ...form, send_monthly_statements: v })} />
            <span className="text-sm font-medium">Email monthly statements to accounts with open invoices</span>
          </label>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Overdue reminders (days after due)</Label>
              <Input
                value={(form.reminder_days ?? []).join(", ")}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reminder_days: e.target.value
                      .split(/[,\s]+/)
                      .map(Number)
                      .filter((n) => Number.isInteger(n) && n > 0 && n <= 120)
                      .slice(0, 6),
                  })
                }
                placeholder="1, 7, 14"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Put account on hold after (days overdue)</Label>
              <Input type="number" min={0} max={180} value={form.auto_hold_after_days} onChange={num("auto_hold_after_days")} />
              <p className="text-xs text-muted-foreground">0 = never automatically.</p>
            </div>
          </div>

          <h2 className="text-sm font-semibold pt-2">Privacy (POPIA)</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Keep personal data for (days after close)</Label>
              <Input type="number" min={30} max={3650} value={form.pii_retention_days} onChange={num("pii_retention_days")} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Nightly, names are cut to first names, and phones, emails, exact addresses, notes, codes and proof photos are removed. City and
            approximate area (about 1 km) are kept for reporting. Parcels with unremitted cash are kept until settled.
          </p>

          <div className="flex items-center gap-3">
            <Button onClick={save}>Save</Button>
            {settings?.updated_at && <span className="text-xs text-muted-foreground">Last changed {format(new Date(settings.updated_at), "d MMM yyyy, HH:mm")}</span>}
          </div>
        </section>
      )}

      {isOwner && <PrivacyRequests />}

      {isOwner && (
        <section className="rounded-xl border bg-card">
          <h2 className="text-sm font-semibold px-4 pt-4 pb-2">Audit log</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden md:table-cell">Details</TableHead>
                  <TableHead className="hidden lg:table-cell">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      Nothing recorded yet.
                    </TableCell>
                  </TableRow>
                )}
                {audit.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-xs">{format(new Date(a.created_at), "d MMM HH:mm:ss")}</TableCell>
                    <TableCell className="text-sm">{who(a.actor_id)}</TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium">{a.action.replace(/_/g, " ")}</span>{" "}
                      <span className="text-muted-foreground">{a.entity_type.replace("logistics_", "").replace(/_/g, " ")}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-[380px]">
                      <code className="text-xs text-muted-foreground line-clamp-2 break-all">{JSON.stringify(a.details)}</code>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{a.ip ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
};


/** Data-subject access & erasure requests, plus purging expired proof files. */
const PrivacyRequests: React.FC = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [ref, setRef] = useState("");
  const [results, setResults] = useState<Array<{ id: string; tracking_number: string; role: string; status: string; created_at: string; redacted: boolean }> | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: purge = [] } = useQuery({
    queryKey: ["lx", "purge-queue"],
    queryFn: async () => {
      const { data, error } = await db.from("logistics_storage_purge").select("path, bucket").is("purged_at", null).limit(1000);
      if (error) throw error;
      return (data ?? []) as Array<{ path: string; bucket: string }>;
    },
  });

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await db.rpc("logistics_find_personal_data", { p_phone: phone || null, p_email: email || null });
    setBusy(false);
    if (error) {
      toast({ variant: "destructive", title: "Search failed", description: error.message.includes("phone_or_email") ? "Enter a full phone number or an email." : error.message });
      return;
    }
    setResults(data ?? []);
  };

  const erase = async () => {
    if (!results?.length) return;
    if (!window.confirm(`Erase personal data from ${results.filter((r) => !r.redacted).length} shipment(s)? This cannot be undone.`)) return;
    setBusy(true);
    const { data, error } = await db.rpc("logistics_erase_personal_data", { p_shipment_ids: results.map((r) => r.id), p_request_ref: ref });
    setBusy(false);
    if (error) {
      toast({ variant: "destructive", title: "Erase failed", description: error.message });
      return;
    }
    const res = data as { redacted: number; still_open: number };
    toast({
      title: `Erased ${res.redacted} shipment(s)`,
      description: res.still_open ? `${res.still_open} still in progress. Erase them once they're delivered or cancelled.` : undefined,
    });
    setResults(null);
    qc.invalidateQueries({ queryKey: ["lx", "purge-queue"] });
  };

  const purgeFiles = async () => {
    setBusy(true);
    let removed = 0;
    for (let i = 0; i < purge.length; i += 100) {
      const batch = purge.slice(i, i + 100).map((p) => p.path);
      const { error } = await supabase.storage.from("delivery-proofs").remove(batch);
      if (error) {
        toast({ variant: "destructive", title: "Purge stopped", description: error.message });
        break;
      }
      await db.from("logistics_storage_purge").update({ purged_at: new Date().toISOString() }).in("path", batch);
      removed += batch.length;
    }
    setBusy(false);
    toast({ title: `Deleted ${removed} file(s)` });
    qc.invalidateQueries({ queryKey: ["lx", "purge-queue"] });
  };

  return (
    <section className="rounded-xl border bg-card p-4 space-y-4">
      <h2 className="text-sm font-semibold">Privacy requests</h2>
      <form onSubmit={search} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" type="tel" />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="or email" type="email" />
        <Button type="submit" variant="outline" disabled={busy || (!phone.trim() && !email.trim())}>
          Find data
        </Button>
      </form>
      {results && (
        <div className="space-y-3">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shipments hold this person's data.</p>
          ) : (
            <>
              <ul className="divide-y rounded-lg border text-sm max-h-56 overflow-y-auto">
                {results.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="font-mono text-xs">{r.tracking_number}</span>
                    <span className="text-muted-foreground">{r.role}</span>
                    <span className="text-muted-foreground">{r.status.replace(/_/g, " ")}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{format(new Date(r.created_at), "d MMM yyyy")}</span>
                    {r.redacted && <span className="text-xs text-emerald-700 dark:text-emerald-400">erased</span>}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Request reference (e.g. POPIA-2026-014)" className="sm:w-72" />
                <Button variant="destructive" disabled={busy || !ref.trim() || results.every((r) => r.redacted)} onClick={erase}>
                  Erase personal data
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      <div className="flex items-center gap-3 border-t pt-3">
        <p className="text-sm text-muted-foreground flex-1">
          {purge.length ? `${purge.length} proof photo/signature file(s) are past retention and queued for deletion.` : "No proof files are waiting for deletion."}
        </p>
        {purge.length > 0 && (
          <Button size="sm" variant="outline" disabled={busy} onClick={purgeFiles}>
            Delete files
          </Button>
        )}
      </div>
    </section>
  );
};

export default SecurityPage;
