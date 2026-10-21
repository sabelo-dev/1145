// Adds a team member to a store by email, creating their 1145 account if
// they don't have one.
//
//   POST { action: "invite", store_id, email, role }
//   POST { action: "resend", member_id }
//
// New accounts get a random temporary password, which is emailed with the
// invitation. The account is flagged (user_metadata.must_change_password) and
// the app makes the person choose their own password at first sign-in, so
// the emailed one only works once. Someone who already has an account is
// added and told by email, with no password involved.
//
// Only the store owner (the "settings" permission) may invite; the database
// checks that with the caller's own session.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES: Record<string, string> = {
  manager: "Manager",
  cashier: "Cashier",
  catalog_editor: "Catalogue editor",
  finance: "Finance",
};
const ROLE_ACCESS: Record<string, string> = {
  manager: "orders, products, 1145 Pay and insights",
  cashier: "orders and 1145 Pay",
  catalog_editor: "products and AI drafts",
  finance: "1145 Pay and insights",
};

const DAILY_INVITES_PER_STORE = 20;
const RESEND_GAP_MS = 2 * 60 * 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** 14 characters with upper, lower, digit and symbol; no look-alike characters. */
function temporaryPassword(): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!$%*?"];
  // No @ or #: some email apps turn text around them into links, which breaks copying.
  const all = sets.join("");
  const pick = (chars: string) => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  const chars = [...sets.map(pick), ...Array.from({ length: 10 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function siteUrl() {
  return (Deno.env.get("SITE_URL") || "https://1145.io").replace(/\/$/, "");
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.error("store-member-invite: RESEND_API_KEY is not set");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: "1145 Lifestyle <no-reply@1145.io>", to: [to], reply_to: "support@1145.io", subject, html }),
  });
  if (!res.ok) console.error("store-member-invite: Resend returned", res.status, await res.text().catch(() => ""));
  return res.ok;
}

function layout(body: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">${body}
    <p style="color:#666;font-size:12px;margin-top:32px">If you weren't expecting this, you can ignore this email or contact support@1145.io.</p></div>`;
}

function inviteEmail(storeName: string, role: string, email: string, password: string) {
  const store = escapeHtml(storeName);
  const loginUrl = `${siteUrl()}/login`;
  return {
    subject: `You've been invited to ${storeName} on 1145`,
    html: layout(`
      <h1 style="font-size:22px">You're on the team at ${store}</h1>
      <p>${store} has added you as <strong>${ROLES[role]}</strong> on 1145 Lifestyle, so you can work with ${ROLE_ACCESS[role]}.</p>
      <p>An account has been created for you. Sign in with:</p>
      <p style="margin:12px 0 4px;color:#666">Email</p>
      <p style="margin:0;font-size:16px"><strong>${escapeHtml(email)}</strong></p>
      <p style="margin:16px 0 4px;color:#666">Temporary password (exactly ${password.length} characters)</p>
      <p style="margin:0"><span style="display:inline-block;font-family:Consolas,Menlo,monospace;font-size:20px;letter-spacing:1px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px">${escapeHtml(password)}</span></p>
      <p style="color:#666;font-size:13px">Copy only the password itself, without spaces before or after it.</p>
      <p>When you first sign in you'll be asked to choose your own password. The temporary one stops working after that.</p>
      <p style="margin:24px 0"><a href="${loginUrl}" style="background:#0f2a4d;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">Sign in to 1145</a></p>
      <p style="color:#666;font-size:13px">After signing in you'll find the store's order console at ${escapeHtml(siteUrl())}/merchant/console.</p>`),
  };
}

function addedEmail(storeName: string, role: string) {
  const store = escapeHtml(storeName);
  return {
    subject: `You've been added to ${storeName} on 1145`,
    html: layout(`
      <h1 style="font-size:22px">You're on the team at ${store}</h1>
      <p>${store} has added you as <strong>${ROLES[role]}</strong>, so you can work with ${ROLE_ACCESS[role]}.</p>
      <p>Sign in with your existing 1145 account and open the order console.</p>
      <p style="margin:24px 0"><a href="${siteUrl()}/merchant/console" style="background:#0f2a4d;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">Open the order console</a></p>`),
  };
}

async function storeName(adminDb: SupabaseClient, storeId: string) {
  const { data } = await adminDb.from("stores").select("name").eq("id", storeId).maybeSingle();
  return String(data?.name ?? "A 1145 store");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const userDb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: authError } = await userDb.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const adminDb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const body = await req.json().catch(() => ({}));

    // ---------------------------------------------------------------- resend
    if (body.action === "resend") {
      const memberId = String(body.member_id ?? "");
      if (!UUID.test(memberId)) return json({ error: "Unknown team member" }, 400);
      const { data: member } = await adminDb.from("store_members")
        .select("id, store_id, user_id, role, invited_at").eq("id", memberId).maybeSingle();
      if (!member) return json({ error: "Unknown team member" }, 404);

      const { data: allowed } = await userDb.rpc("store_has_permission", { p_store_id: member.store_id, p_permission: "settings" });
      if (!allowed) return json({ error: "Only the store owner can manage the team" }, 403);

      const { data: target } = await adminDb.auth.admin.getUserById(member.user_id);
      if (!target?.user?.email) return json({ error: "Unknown team member" }, 404);
      if (target.user.user_metadata?.must_change_password !== true) {
        return json({ error: "They have already set their own password. Ask them to use “Forgot password” if they're locked out." }, 400);
      }
      if (member.invited_at && Date.now() - new Date(member.invited_at).getTime() < RESEND_GAP_MS) {
        return json({ error: "An invitation was just sent. Wait a couple of minutes before sending another." }, 429);
      }

      const password = temporaryPassword();
      const { error: pwError } = await adminDb.auth.admin.updateUserById(member.user_id, { password });
      if (pwError) {
        console.error("store-member-invite: could not reset password", pwError);
        return json({ error: "Could not create a new invitation" }, 500);
      }
      const { subject, html } = inviteEmail(await storeName(adminDb, member.store_id), member.role, target.user.email, password);
      const sent = await sendEmail(target.user.email, subject, html);
      await adminDb.from("store_members").update({ invited_at: new Date().toISOString() }).eq("id", member.id);
      return json({ status: "resent", email_sent: sent });
    }

    // ---------------------------------------------------------------- invite
    const storeId = String(body.store_id ?? "");
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role ?? "");
    if (!UUID.test(storeId)) return json({ error: "Choose a store" }, 400);
    if (!EMAIL.test(email) || email.length > 254) return json({ error: "Enter a valid email address" }, 400);
    if (!ROLES[role]) return json({ error: "Choose a role" }, 400);
    if (email === user.email?.toLowerCase()) return json({ error: "You already own this store" }, 400);

    const { data: allowed } = await userDb.rpc("store_has_permission", { p_store_id: storeId, p_permission: "settings" });
    if (!allowed) return json({ error: "Only the store owner can manage the team" }, 403);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await adminDb.from("store_members").select("id", { count: "exact", head: true })
      .eq("store_id", storeId).gte("invited_at", since);
    if ((count ?? 0) >= DAILY_INVITES_PER_STORE) {
      return json({ error: `You can send up to ${DAILY_INVITES_PER_STORE} invitations a day. Try again tomorrow.` }, 429);
    }

    const name = await storeName(adminDb, storeId);
    // Case-insensitive exact match: escape ILIKE's wildcards, which are legal in email addresses.
    const { data: existing } = await adminDb.from("profiles").select("id")
      .ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`)).limit(1).maybeSingle();

    if (existing) {
      // Already on 1145: add them through the same database rule the dashboard uses.
      const { error: addError } = await userDb.rpc("store_member_upsert", { p_store_id: storeId, p_email: email, p_role: role });
      if (addError) return json({ error: addError.message }, 400);
      const { subject, html } = addedEmail(name, role);
      const sent = await sendEmail(email, subject, html);
      await adminDb.from("store_members").update({ invited_at: new Date().toISOString() })
        .eq("store_id", storeId).eq("user_id", existing.id);
      return json({ status: "added", email_sent: sent });
    }

    const password = temporaryPassword();
    const { data: created, error: createError } = await adminDb.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // they prove the address by using the emailed password
      user_metadata: { name: "", must_change_password: true, invited_by_store: storeId },
    });
    if (createError || !created?.user) {
      console.error("store-member-invite: could not create user", createError);
      const taken = /already|registered|exists/i.test(createError?.message ?? "");
      return json({ error: taken ? "That email is already registered. Ask them to sign in once, then add them again." : "Could not create the account" }, taken ? 409 : 500);
    }

    const { error: addError } = await userDb.rpc("store_member_upsert", { p_store_id: storeId, p_email: email, p_role: role });
    if (addError) {
      // Don't leave an account behind that nobody knows the password to.
      await adminDb.auth.admin.deleteUser(created.user.id);
      return json({ error: addError.message }, 400);
    }

    const { subject, html } = inviteEmail(name, role, email, password);
    const sent = await sendEmail(email, subject, html);
    await adminDb.from("store_members").update({ invited_at: new Date().toISOString() })
      .eq("store_id", storeId).eq("user_id", created.user.id);

    console.log(`store-member-invite: invited a ${role} to store ${storeId} (email ${sent ? "sent" : "FAILED"})`);
    return json({ status: "invited", email_sent: sent });
  } catch (error) {
    console.error("store-member-invite failed:", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
