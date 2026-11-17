// 1145 Logistics: email an issued invoice (or a payment reminder) to the
// account's billing contact. Owners only (logistics_role = 'owner').
//
// POST { invoiceId, kind: "invoice" | "reminder" }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { billingEmailConfigured, invoiceEmail, sendBillingEmail } from "../_shared/logisticsBilling.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth?.user) return json({ error: "unauthorized" }, 401);
  const { data: role } = await userClient.rpc("logistics_role", { _user: auth.user.id });
  if (role !== "owner") return json({ error: "forbidden" }, 403);
  if (!billingEmailConfigured()) return json({ error: "email_not_configured" }, 503);

  const { invoiceId, kind = "invoice" } = await req.json().catch(() => ({}));
  if (typeof invoiceId !== "string" || !["invoice", "reminder"].includes(kind)) return json({ error: "invalid_request" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: inv } = await admin.from("logistics_invoices").select("*, logistics_accounts(name, billing_email, vat_no)").eq("id", invoiceId).maybeSingle();
  if (!inv) return json({ error: "not_found" }, 404);
  if (!["issued", "paid"].includes(inv.status)) return json({ error: "invoice_not_issued" }, 409);
  if (kind === "reminder" && inv.status !== "issued") return json({ error: "nothing_to_remind" }, 409);
  const acct = inv.logistics_accounts;
  if (!acct?.billing_email) return json({ error: "no_billing_email" }, 422);

  const { data: lines } = await admin.from("logistics_invoice_lines").select("description, amount").eq("invoice_id", inv.id).order("description");
  const { subject, html } = invoiceEmail(inv, acct, lines ?? [], kind);
  try {
    await sendBillingEmail(acct.billing_email, subject, html);
  } catch (e) {
    return json({ error: "send_failed", detail: (e as Error).message }, 502);
  }

  await admin
    .from("logistics_invoices")
    .update(kind === "reminder" ? { reminder_sent_at: new Date().toISOString(), reminder_count: (inv.reminder_count ?? 0) + 1 } : { emailed_at: new Date().toISOString() })
    .eq("id", inv.id);
  await admin.from("logistics_audit_log").insert({
    actor_id: auth.user.id,
    action: kind === "reminder" ? "invoice_reminder_sent" : "invoice_emailed",
    entity_type: "logistics_invoices",
    entity_id: inv.id,
    details: { number: inv.number, to: acct.billing_email },
  });
  return json({ ok: true, to: acct.billing_email });
});
