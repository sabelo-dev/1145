// UCoin Proof-of-Action mining engine
// Actions: emit | worker | admin/decision | admin/reverse
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- rules engine ----------

type Ctx = {
  admin: ReturnType<typeof createClient>;
  request: any;
  activity: any;
};

async function orderDeliveredAndReturnClosed(ctx: Ctx): Promise<{ ok: boolean; reason?: string; defer?: number }> {
  const orderId = ctx.request.reference_id;
  if (!orderId) return { ok: false, reason: "Missing order reference" };
  const { data: order } = await ctx.admin
    .from("orders")
    .select("id,status,updated_at,user_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, reason: "Order not found" };
  if (order.user_id !== ctx.request.user_id) return { ok: false, reason: "Order owner mismatch" };
  if (!["delivered", "completed"].includes(order.status))
    return { ok: false, defer: 3600, reason: "Awaiting delivery" };
  const days = Number(ctx.activity.rules?.return_window_days ?? 7);
  const deliveredAt = new Date(order.updated_at).getTime();
  const eligibleAt = deliveredAt + days * 86400_000;
  if (Date.now() < eligibleAt) return { ok: false, defer: Math.max(3600, Math.floor((eligibleAt - Date.now()) / 1000)), reason: "Return window open" };
  return { ok: true };
}

async function referralCompleted(ctx: Ctx): Promise<{ ok: boolean; reason?: string; defer?: number }> {
  const refId = ctx.request.reference_id;
  if (!refId) return { ok: false, reason: "Missing referral reference" };
  const { data: ref } = await ctx.admin
    .from("referrals")
    .select("id,status,referred_id,referrer_id")
    .eq("id", refId)
    .maybeSingle();
  if (!ref) return { ok: false, reason: "Referral not found" };
  if (ref.status !== "completed") return { ok: false, defer: 3600, reason: "Referral not yet completed" };
  return { ok: true };
}

async function driverPodComplete(ctx: Ctx): Promise<{ ok: boolean; reason?: string; defer?: number }> {
  const jobId = ctx.request.reference_id;
  if (!jobId) return { ok: false, reason: "Missing delivery reference" };
  const { data: job } = await ctx.admin
    .from("delivery_jobs")
    .select("id,status,driver_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { ok: false, reason: "Delivery not found" };
  if (job.status !== "delivered") return { ok: false, defer: 900, reason: "Delivery not yet completed" };
  const ev = ctx.request.evidence ?? {};
  if (!ev.otp_verified || !ev.photo_url) return { ok: false, reason: "Missing POD (OTP/photo)" };
  return { ok: true };
}

async function kycVerified(ctx: Ctx): Promise<{ ok: boolean; reason?: string; defer?: number }> {
  const { data } = await ctx.admin
    .from("driver_kyc")
    .select("status")
    .eq("user_id", ctx.request.user_id)
    .maybeSingle();
  if (!data || data.status !== "verified") return { ok: false, defer: 3600, reason: "KYC not verified" };
  return { ok: true };
}

function checkReview(ctx: Ctx): { ok: boolean; reason?: string } {
  const ev = ctx.request.evidence ?? {};
  const minWords = Number(ctx.activity.rules?.min_words ?? 20);
  if (!ev.verified_purchase) return { ok: false, reason: "Not a verified purchase" };
  const words = String(ev.text ?? "").trim().split(/\s+/).filter(Boolean).length;
  if (words < minWords) return { ok: false, reason: `Review too short (${words}/${minWords} words)` };
  return { ok: true };
}

function checkSocialShare(ctx: Ctx): { ok: boolean; reason?: string } {
  const ev = ctx.request.evidence ?? {};
  const minDwell = Number(ctx.activity.rules?.min_dwell_seconds ?? 10);
  if (!ev.click_recorded) return { ok: false, reason: "No verified click on share link" };
  if (Number(ev.dwell_seconds ?? 0) < minDwell) return { ok: false, reason: "Visitor left too quickly" };
  if (ev.bot_detected) return { ok: false, reason: "Bot traffic detected" };
  return { ok: true };
}

function checkVideo(ctx: Ctx): { ok: boolean; reason?: string } {
  const ev = ctx.request.evidence ?? {};
  const minPct = Number(ctx.activity.rules?.min_watched_percent ?? 95);
  if (Number(ev.watched_percent ?? 0) < minPct) return { ok: false, reason: `Only watched ${ev.watched_percent}%` };
  if (ctx.activity.rules?.require_quiz && !ev.quiz_passed) return { ok: false, reason: "Quiz not passed" };
  return { ok: true };
}

async function checkDailyLogin(ctx: Ctx): Promise<{ ok: boolean; reason?: string }> {
  // Cooldown already enforced by dedupe (reference = date)
  const { count } = await ctx.admin
    .from("mining_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.request.user_id)
    .eq("activity_code", "daily_login")
    .in("status", ["approved", "credited"])
    .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  if ((count ?? 0) > 1) return { ok: false, reason: "Already rewarded today" };
  return { ok: true };
}

async function runRules(ctx: Ctx): Promise<{ ok: boolean; reason?: string; defer?: number }> {
  switch (ctx.request.activity_code) {
    case "purchase": return await orderDeliveredAndReturnClosed(ctx);
    case "referral": return await referralCompleted(ctx);
    case "delivery": return await driverPodComplete(ctx);
    case "kyc_complete": return await kycVerified(ctx);
    case "review": {
      const r = checkReview(ctx);
      // moderation required -> flip to awaiting_verification handled outside
      return r;
    }
    case "social_share": return checkSocialShare(ctx);
    case "video_watch": return checkVideo(ctx);
    case "daily_login": return await checkDailyLogin(ctx);
    default: return { ok: true };
  }
}

// ---------- fraud scoring ----------

async function fraudScore(admin: any, req: any): Promise<number> {
  let score = 0;
  const { data: user } = await admin
    .from("profiles").select("created_at").eq("id", req.user_id).maybeSingle();
  if (user) {
    const ageDays = (Date.now() - new Date(user.created_at).getTime()) / 86400_000;
    if (ageDays < 1) score += 40;
    else if (ageDays < 7) score += 15;
  }
  const { count: velocity } = await admin
    .from("mining_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", req.user_id)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((velocity ?? 0) > 50) score += 40;
  else if ((velocity ?? 0) > 20) score += 20;
  return Math.min(score, 100);
}

// ---------- worker ----------

async function processRequest(admin: any, requestId: string) {
  const { data: req } = await admin.from("mining_requests").select("*").eq("id", requestId).maybeSingle();
  if (!req) return { skipped: true };
  if (!["pending", "validating", "awaiting_verification"].includes(req.status))
    return { skipped: true, status: req.status };

  const { data: activity } = await admin.from("mining_activities").select("*").eq("code", req.activity_code).maybeSingle();
  if (!activity) return { error: "unknown_activity" };

  // Expiry
  if (req.expires_at && new Date(req.expires_at).getTime() < Date.now()) {
    await admin.from("mining_requests").update({ status: "expired", rejection_reason: "Expired" }).eq("id", requestId);
    await admin.from("mining_events").insert({ request_id: requestId, stage: "expired", actor: "system", payload: {} });
    return { status: "expired" };
  }

  // Mark validating
  if (req.status === "pending") {
    await admin.from("mining_requests").update({ status: "validating" }).eq("id", requestId);
    await admin.from("mining_events").insert({ request_id: requestId, stage: "validating", actor: "system", payload: {} });
  }

  const rules = await runRules({ admin, request: req, activity });
  if (!rules.ok) {
    if (rules.defer) {
      await admin.from("mining_requests").update({ status: "awaiting_verification" }).eq("id", requestId);
      await admin.from("mining_events").insert({
        request_id: requestId, stage: "awaiting_verification", actor: "system",
        payload: { reason: rules.reason },
      });
      return { status: "awaiting_verification", defer: rules.defer };
    }
    await admin.from("mining_requests").update({ status: "rejected", rejection_reason: rules.reason ?? "Rules failed" }).eq("id", requestId);
    await admin.from("mining_events").insert({
      request_id: requestId, stage: "rejected", actor: "system",
      payload: { reason: rules.reason },
    });
    return { status: "rejected", reason: rules.reason };
  }

  // Fraud
  const score = await fraudScore(admin, req);
  await admin.from("fraud_signals").insert({
    request_id: requestId, user_id: req.user_id, score, signals: {},
  });
  await admin.from("mining_requests").update({ fraud_score: score }).eq("id", requestId);

  if (score >= 81) {
    await admin.from("mining_requests").update({ status: "rejected", rejection_reason: "High fraud score" }).eq("id", requestId);
    await admin.from("mining_events").insert({ request_id: requestId, stage: "fraud_reject", actor: "system", payload: { score } });
    return { status: "rejected", reason: "fraud" };
  }

  // Moderation gate
  if ((activity.requires_moderation || score >= 41) && !req.metadata?.moderation_approved) {
    await admin.from("mining_requests").update({ status: "awaiting_verification" }).eq("id", requestId);
    await admin.from("mining_events").insert({
      request_id: requestId, stage: "awaiting_moderation", actor: "system",
      payload: { score, moderation_required: true },
    });
    return { status: "awaiting_verification" };
  }

  // Approve + credit
  await admin.from("mining_requests").update({
    status: "approved", validated_at: new Date().toISOString(), validator: "auto",
  }).eq("id", requestId);
  await admin.from("mining_events").insert({ request_id: requestId, stage: "approved", actor: "system", payload: {} });

  const { error: creditErr } = await admin.rpc("mining_credit_request", { p_request_id: requestId });
  if (creditErr) {
    await admin.from("mining_requests").update({ status: "failed", rejection_reason: creditErr.message }).eq("id", requestId);
    return { status: "failed", error: creditErr.message };
  }
  return { status: "credited" };
}

async function drainQueue(admin: any, limit = 25) {
  const { data: jobs } = await admin
    .from("mining_queue_jobs")
    .select("*")
    .in("status", ["queued", "deferred"])
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(limit);
  const results: any[] = [];
  for (const job of jobs ?? []) {
    await admin.from("mining_queue_jobs").update({
      status: "running", attempts: (job.attempts ?? 0) + 1, locked_at: new Date().toISOString(),
    }).eq("id", job.id);
    try {
      const r = await processRequest(admin, job.request_id);
      const done = r.status && ["credited", "rejected", "expired", "failed"].includes(r.status);
      await admin.from("mining_queue_jobs").update({
        status: done ? "done" : "deferred",
        next_run_at: done ? new Date().toISOString() : new Date(Date.now() + (r.defer ?? 900) * 1000).toISOString(),
        last_error: null,
      }).eq("id", job.id);
      results.push({ id: job.id, ...r });
    } catch (e: any) {
      await admin.from("mining_queue_jobs").update({
        status: (job.attempts ?? 0) + 1 >= (job.max_attempts ?? 5) ? "failed" : "deferred",
        next_run_at: new Date(Date.now() + 300_000).toISOString(),
        last_error: String(e?.message ?? e),
      }).eq("id", job.id);
      results.push({ id: job.id, error: String(e?.message ?? e) });
    }
  }
  return results;
}

// ---------- handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? (await req.clone().json().catch(() => ({}))).action;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (action === "worker") {
      const results = await drainQueue(admin);
      return json({ processed: results.length, results });
    }

    // Authenticated actions
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthenticated" }, 401);

    const body = await req.json().catch(() => ({}));

    if (action === "emit") {
      const { activity, evidence, reference_type, reference_id, idempotency_key, metadata } = body;
      if (!activity || !idempotency_key) return json({ error: "activity and idempotency_key required" }, 400);
      const { data, error } = await admin.rpc("mining_emit_action", {
        p_user_id: user.id,
        p_activity_code: activity,
        p_idempotency_key: idempotency_key,
        p_evidence: evidence ?? {},
        p_reference_type: reference_type ?? null,
        p_reference_id: reference_id ?? null,
        p_metadata: metadata ?? {},
      });
      if (error) return json({ error: error.message }, 400);
      return json({ request_id: data });
    }

    // Admin-only from here
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    if (action === "admin/decision") {
      const { request_id, decision, reason } = body;
      if (!request_id || !["approve", "reject"].includes(decision))
        return json({ error: "request_id and decision required" }, 400);
      if (decision === "approve") {
        await admin.from("mining_requests").update({
          metadata: { moderation_approved: true, moderator: user.id },
          status: "pending",
        }).eq("id", request_id);
        await admin.from("mining_events").insert({
          request_id, stage: "moderation_approved", actor: user.id, payload: { reason },
        });
        await admin.from("mining_queue_jobs").insert({ request_id });
        return json({ ok: true });
      } else {
        await admin.from("mining_requests").update({
          status: "rejected", rejection_reason: reason ?? "Rejected by admin",
        }).eq("id", request_id);
        await admin.from("mining_events").insert({
          request_id, stage: "rejected", actor: user.id, payload: { reason },
        });
        return json({ ok: true });
      }
    }

    if (action === "admin/reverse") {
      const { request_id, reason } = body;
      if (!request_id || !reason) return json({ error: "request_id and reason required" }, 400);
      const { data, error } = await admin.rpc("mining_reverse_request", {
        p_request_id: request_id, p_reason: reason,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: data });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
