// Admin-only: import emails Resend has received for @1145.io that are not in
// inbound_emails yet (mail that arrived before the webhook existed, or while
// it was failing). Used by the admin Email Inbox "Refresh" button.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { isForOurDomain, isStored, listReceivedEmails, storeReceivedEmail } from "../_shared/resendInbound.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_PAGES = 5;            // up to 500 emails per run
const RESEND_PACING_MS = 550;   // Resend allows ~2 requests per second

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await supabase.auth.getUser(token);
  if (!auth?.user) return respond({ success: false, error: "Unauthorized" }, 401);
  const { data: role } = await supabase
    .from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "admin").maybeSingle();
  if (!role) return respond({ success: false, error: "Admins only" }, 403);

  const counts = { stored: 0, duplicate: 0, ignored: 0, failed: 0 };
  try {
    let after: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, has_more } = await listReceivedEmails(after);
      for (const email of data) {
        // The list already has the recipients: skip other domains without
        // spending a rate-limited fetch on them.
        if (Array.isArray(email.to) && !isForOurDomain(email.to)) {
          counts.ignored++;
          continue;
        }
        if (await isStored(supabase, email.id)) {
          counts.duplicate++;
          continue;
        }
        try {
          counts[await storeReceivedEmail(supabase, { ...email, email_id: email.id })]++;
        } catch (e) {
          console.error(`Could not import ${email.id}:`, e);
          counts.failed++;
        }
        await new Promise((r) => setTimeout(r, RESEND_PACING_MS));
      }
      if (!has_more || data.length === 0) break;
      after = data[data.length - 1].id;
      await new Promise((r) => setTimeout(r, RESEND_PACING_MS));
    }
  } catch (e) {
    return respond({ success: false, error: e instanceof Error ? e.message : String(e), ...counts }, 502);
  }

  return respond({ success: true, ...counts });
});
