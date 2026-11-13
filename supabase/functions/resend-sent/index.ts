// Admin-only: emails 1145 has sent through Resend, for the admin Email Inbox
// "Sent" tab. Resend keeps them, so nothing is copied into the database.
//   POST { action: "list", after?: string }  -> one page, newest first
//   POST { action: "get", id: string }        -> one email with its body
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const RESEND_API = "https://api.resend.com";
const PAGE_SIZE = 50;

async function resend(path: string): Promise<Record<string, unknown>> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch(`${RESEND_API}${path}`, { headers: { Authorization: `Bearer ${key}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A sending-only API key cannot read emails back.
    const msg = (body as { message?: string })?.message || `Resend returned ${res.status}`;
    throw new Error(res.status === 401 || res.status === 403 ? `${msg} (the Resend API key needs full access to list sent emails)` : msg);
  }
  return body as Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await supabase.auth.getUser(token);
  if (!auth?.user) return respond({ success: false, error: "Unauthorized" }, 401);
  const { data: role } = await supabase
    .from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "admin").maybeSingle();
  if (!role) return respond({ success: false, error: "Admins only" }, 403);

  const body = await req.json().catch(() => ({})) as { action?: string; after?: string; id?: string };
  try {
    if (body.action === "get") {
      if (!body.id || !/^[\w-]+$/.test(body.id)) return respond({ success: false, error: "Missing email id" }, 400);
      const email = await resend(`/emails/${encodeURIComponent(body.id)}`);
      return respond({ success: true, email });
    }
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (body.after && /^[\w-]+$/.test(body.after)) params.set("after", body.after);
    const page = await resend(`/emails?${params.toString()}`);
    return respond({
      success: true,
      emails: Array.isArray(page.data) ? page.data : [],
      has_more: !!page.has_more,
    });
  } catch (e) {
    return respond({ success: false, error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
