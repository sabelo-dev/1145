// Resend webhook: stores inbound mail for @1145.io in inbound_emails (the
// admin Email Inbox) and logs delivery events.
//
// Resend's email.received webhook carries only metadata ("Webhooks do not
// include the email body, headers, or attachments"), so the full message is
// fetched from GET https://api.resend.com/emails/receiving/{email_id}.
//
// Requests are verified with the webhook's signing secret (Svix scheme) in
// RESEND_WEBHOOK_SECRET; without it every request is refused.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { storeReceivedEmail } from "../_shared/resendInbound.ts";
import { verifyWebhookSignature } from "../_shared/webhookSignature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

interface ResendEvent {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    text?: string;
    html?: string;
    attachments?: Array<Record<string, unknown>>;
    sender?: string;
    recipients?: string[];
    [key: string]: unknown;
  };
}

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const body = await req.text();

  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    console.error("RESEND_WEBHOOK_SECRET is not set; refusing unverified webhook.");
    return respond({ error: "Webhook not configured" }, 503);
  }
  const problem = await verifyWebhookSignature(secret, req.headers, body, "svix");
  if (problem) {
    console.error("Rejected webhook:", problem);
    return respond({ error: "Invalid signature" }, 401);
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return respond({ error: "Invalid JSON" }, 400);
  }

  if (event.type !== "email.received") {
    console.log(`Resend event ${event.type}:`, event.data?.email_id ?? "");
    return respond({ success: true, type: event.type });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    // Resend retries deliveries; storeReceivedEmail keeps one copy per email.
    const result = await storeReceivedEmail(supabase, event.data ?? {}, event.created_at);
    console.log(`Inbound email ${event.data?.email_id}: ${result}`);
    return respond({ success: true, result });
  } catch (e) {
    console.error("Error storing inbound email:", e);
    // 500 so Resend retries later.
    return respond({ error: "Could not store email" }, 500);
  }
});
