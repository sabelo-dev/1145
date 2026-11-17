// 1145 Logistics: daily billing automation (called by pg_cron via
// public.logistics_trigger_billing_run with the X-Logistics-Cron secret).
//
//  1. Auto-issue + email last month's drafts (if enabled in settings)
//  2. Overdue reminders on the configured days after the due date (e.g. 1, 7, 14)
//  3. Monthly statements on the 1st (if enabled)
//  4. Put accounts on hold once an invoice is N days overdue
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { billingEmailConfigured, digestEmail, invoiceEmail, sendBillingEmail, statementEmail } from "../_shared/logisticsBilling.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const daysBetween = (from: string, to: Date) => Math.floor((to.getTime() - new Date(`${from}T00:00:00+02:00`).getTime()) / 86_400_000);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: secret } = await admin.from("logistics_internal_secrets").select("value").eq("name", "billing_cron").maybeSingle();
  const presented = req.headers.get("X-Logistics-Cron") ?? "";
  if (!secret?.value || !timingSafeEqual(presented, secret.value)) return json({ error: "forbidden" }, 403);

  const { data: cfg } = await admin.from("logistics_settings").select("*").eq("id", true).single();
  const now = new Date();
  const today = new Date(now.getTime() + 2 * 3_600_000).toISOString().slice(0, 10); // SAST date
  const isFirst = today.endsWith("-01");
  const canEmail = billingEmailConfigured();
  const report = { issued: 0, emailed: 0, reminders: 0, statements: 0, held: 0, digests: 0, errors: [] as string[] };

  const audit = (action: string, entity_id: string | null, details: Record<string, unknown>) =>
    admin.from("logistics_audit_log").insert({ actor_id: null, action, entity_type: "logistics_invoices", entity_id, details: { ...details, automated: true } });

  // 1. Auto-issue drafts.
  if (cfg?.auto_issue_invoices) {
    const { data: drafts } = await admin.from("logistics_invoices").select("*, logistics_accounts(name, billing_email, vat_no, payment_terms_days)").eq("status", "draft").gt("total", 0);
    for (const inv of drafts ?? []) {
      const due = new Date(now.getTime() + (inv.logistics_accounts?.payment_terms_days ?? 30) * 86_400_000).toISOString().slice(0, 10);
      const { error } = await admin.from("logistics_invoices").update({ status: "issued", issued_at: now.toISOString(), due_date: due }).eq("id", inv.id).eq("status", "draft");
      if (error) {
        report.errors.push(`issue ${inv.number}: ${error.message}`);
        continue;
      }
      report.issued++;
      await audit("invoice_issued", inv.id, { number: inv.number, total: inv.total });
      const acct = inv.logistics_accounts;
      if (canEmail && acct?.billing_email) {
        try {
          const { data: lines } = await admin.from("logistics_invoice_lines").select("description, amount").eq("invoice_id", inv.id).order("description");
          const { subject, html } = invoiceEmail({ ...inv, status: "issued", due_date: due }, acct, lines ?? [], "invoice");
          await sendBillingEmail(acct.billing_email, subject, html);
          await admin.from("logistics_invoices").update({ emailed_at: now.toISOString() }).eq("id", inv.id);
          report.emailed++;
        } catch (e) {
          report.errors.push(`email ${inv.number}: ${(e as Error).message}`);
        }
      }
    }
  }

  // 2 & 4. Overdue handling.
  const reminderDays: number[] = cfg?.reminder_days ?? [1, 7, 14];
  const { data: openInvoices } = await admin
    .from("logistics_invoices")
    .select("*, logistics_accounts(id, name, billing_email, vat_no, status, auto_held_at)")
    .eq("status", "issued")
    .lt("due_date", today);
  for (const inv of openInvoices ?? []) {
    const overdueDays = daysBetween(inv.due_date, now);
    const acct = inv.logistics_accounts;
    // Send the next reminder whose day threshold has passed (one per day at most).
    const nextThreshold = reminderDays.sort((a, b) => a - b)[inv.reminder_count ?? 0];
    const remindedToday = inv.reminder_sent_at && new Date(inv.reminder_sent_at).toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
    if (canEmail && acct?.billing_email && nextThreshold != null && overdueDays >= nextThreshold && !remindedToday) {
      try {
        const { data: lines } = await admin.from("logistics_invoice_lines").select("description, amount").eq("invoice_id", inv.id).order("description");
        const { subject, html } = invoiceEmail(inv, acct, lines ?? [], "reminder");
        await sendBillingEmail(acct.billing_email, subject, html);
        await admin.from("logistics_invoices").update({ reminder_sent_at: now.toISOString(), reminder_count: (inv.reminder_count ?? 0) + 1 }).eq("id", inv.id);
        await audit("invoice_reminder_sent", inv.id, { number: inv.number, overdue_days: overdueDays });
        report.reminders++;
      } catch (e) {
        report.errors.push(`remind ${inv.number}: ${(e as Error).message}`);
      }
    }
    if (cfg?.auto_hold_after_days && overdueDays >= cfg.auto_hold_after_days && acct?.status === "active") {
      await admin.from("logistics_accounts").update({ status: "on_hold", auto_held_at: now.toISOString() }).eq("id", acct.id).eq("status", "active");
      await admin.from("logistics_audit_log").insert({
        actor_id: null,
        action: "account_auto_hold",
        entity_type: "logistics_accounts",
        entity_id: acct.id,
        details: { invoice: inv.number, overdue_days: overdueDays, automated: true },
      });
      acct.status = "on_hold";
      report.held++;
    }
  }

  // 3. Monthly statements on the 1st.
  if (isFirst && cfg?.send_monthly_statements && canEmail) {
    const { data: accounts } = await admin.from("logistics_accounts").select("id, name, billing_email, statement_sent_at").neq("status", "closed").not("billing_email", "is", null);
    for (const acct of accounts ?? []) {
      if (acct.statement_sent_at && acct.statement_sent_at.slice(0, 10) === now.toISOString().slice(0, 10)) continue;
      const { data: invs } = await admin.from("logistics_invoices").select("number, total, due_date, status").eq("account_id", acct.id).eq("status", "issued");
      if (!invs?.length) continue; // nothing to state
      try {
        const { subject, html } = statementEmail(acct, invs, now);
        await sendBillingEmail(acct.billing_email, subject, html);
        await admin.from("logistics_accounts").update({ statement_sent_at: now.toISOString() }).eq("id", acct.id);
        report.statements++;
      } catch (e) {
        report.errors.push(`statement ${acct.name}: ${(e as Error).message}`);
      }
    }
  }

  // 5. Daily exception digest for merchants (missed, problems, returns, at risk).
  if (canEmail) {
    const since = new Date(now.getTime() - 86_400_000).toISOString();
    const { data: accounts } = await admin
      .from("logistics_accounts")
      .select("id, name, ops_email, billing_email, digest_sent_at")
      .eq("digest_enabled", true)
      .neq("status", "closed");
    for (const acct of accounts ?? []) {
      const to = acct.ops_email ?? acct.billing_email;
      if (!to || (acct.digest_sent_at && acct.digest_sent_at > since)) continue;
      const { data: events } = await admin
        .from("shipment_events")
        .select("status, notes, created_at, shipments!inner(tracking_number, reference, recipient_name, account_id)")
        .eq("shipments.account_id", acct.id)
        .in("status", ["failed_attempt", "exception", "returning", "returned"])
        .eq("event_type", "status_change")
        .gte("created_at", since)
        .limit(200);
      const { data: risky } = await admin
        .from("shipments")
        .select("tracking_number, reference, recipient_name")
        .eq("account_id", acct.id)
        .gte("sla_risk_at", since)
        .limit(100);
      const seen = new Set<string>();
      const items = [
        ...(events ?? []).map((e: any) => ({ ...e.shipments, status: e.status, note: e.notes })),
        ...(risky ?? []).map((s: any) => ({ ...s, status: "at_risk", note: null })),
      ].filter((i) => (seen.has(i.tracking_number + i.status) ? false : (seen.add(i.tracking_number + i.status), true)));
      if (!items.length) continue;
      try {
        const { subject, html } = digestEmail(acct, items);
        await sendBillingEmail(to, subject, html);
        await admin.from("logistics_accounts").update({ digest_sent_at: now.toISOString() }).eq("id", acct.id);
        report.digests++;
      } catch (e) {
        report.errors.push(`digest ${acct.name}: ${(e as Error).message}`);
      }
    }
  }

  if (report.errors.length) console.error("logistics-billing-run", report.errors);
  return json(report);
});
