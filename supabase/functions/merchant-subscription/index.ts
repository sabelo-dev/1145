import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client",
};

type Tier = "starter" | "bronze" | "silver" | "gold";
const TIERS: Tier[] = ["starter", "bronze", "silver", "gold"];

const PRICING: Record<Tier, { monthly: number; yearly: number }> = {
  starter: { monthly: 0, yearly: 0 },
  bronze: { monthly: 99, yearly: 990 },
  silver: { monthly: 249, yearly: 2490 },
  gold: { monthly: 499, yearly: 4990 },
};

async function md5Hash(input: string): Promise<string> {
  const crypto = await import("node:crypto");
  return crypto.createHash("md5").update(input).digest("hex");
}

function phpUrlencode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/~/g, "%7E")
    .replace(/%20/g, "+")
    .replace(/%[0-9a-f]{2}/gi, (m) => m.toUpperCase());
}

async function signPayFast(fields: Record<string, string>, passphrase: string): Promise<string> {
  const paramString = Object.keys(fields)
    .filter((k) => fields[k] !== "" && fields[k] !== null && fields[k] !== undefined)
    .map((k) => `${k}=${phpUrlencode(String(fields[k]).trim())}`)
    .join("&");
  const stringToHash = passphrase
    ? `${paramString}&passphrase=${phpUrlencode(passphrase)}`
    : paramString;
  return await md5Hash(stringToHash);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "change";
    const origin = req.headers.get("origin") || body.origin || "";

    // Resolve the caller's vendor record
    const { data: vendor, error: vendorError } = await admin
      .from("vendors")
      .select("id, user_id, business_name, email, subscription_tier, subscription_status, subscription_expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (vendorError) return json({ error: vendorError.message }, 500);
    if (!vendor) return json({ error: "No merchant account found for this user" }, 403);

    const currentTier = (vendor.subscription_tier as Tier) ?? "starter";

    // ---------- STATUS ----------
    if (action === "status") {
      const { data: payments } = await admin
        .from("subscription_payments")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return json({
        tier: currentTier,
        status: vendor.subscription_status,
        expiresAt: vendor.subscription_expires_at,
        pricing: PRICING,
        payments: payments ?? [],
      });
    }

    // ---------- CANCEL ----------
    if (action === "cancel") {
      const { error } = await admin
        .from("vendors")
        .update({ subscription_status: "cancelled" })
        .eq("id", vendor.id);
      if (error) return json({ error: error.message }, 500);

      await admin.from("vendor_subscription_audit_log").insert({
        vendor_id: vendor.id,
        changed_by: user.id,
        change_type: "cancellation",
        old_tier: currentTier,
        new_tier: currentTier,
        old_status: vendor.subscription_status,
        new_status: "cancelled",
        reason: body.reason ?? "Cancelled by merchant",
      });

      await admin.from("user_notifications").insert({
        user_id: user.id,
        type: "subscription_cancelled",
        title: "Subscription cancelled",
        message: vendor.subscription_expires_at
          ? `Your ${currentTier} plan stays active until ${new Date(vendor.subscription_expires_at).toLocaleDateString()}.`
          : "Your subscription has been cancelled.",
      });

      return json({ applied: true, tier: currentTier, status: "cancelled" });
    }

    // ---------- CHANGE (upgrade / downgrade) ----------
    const targetTier = body.tier as Tier;
    const billing: "monthly" | "yearly" = body.billing_period === "yearly" ? "yearly" : "monthly";

    if (!TIERS.includes(targetTier)) return json({ error: "Invalid tier" }, 400);
    if (targetTier === currentTier && vendor.subscription_status === "active") {
      return json({ error: "You are already on this plan" }, 400);
    }

    const isUpgrade = TIERS.indexOf(targetTier) > TIERS.indexOf(currentTier);
    const amount = PRICING[targetTier][billing];

    // Free tier or downgrade → apply immediately, no payment
    if (!isUpgrade || amount === 0) {
      const expiresAt =
        targetTier === "starter"
          ? null
          : vendor.subscription_expires_at ?? new Date(Date.now() + 30 * 864e5).toISOString();

      const { error } = await admin
        .from("vendors")
        .update({
          subscription_tier: targetTier,
          subscription_status: "active",
          subscription_expires_at: expiresAt,
        })
        .eq("id", vendor.id);
      if (error) return json({ error: error.message }, 500);

      await admin.from("vendor_subscription_audit_log").insert({
        vendor_id: vendor.id,
        changed_by: user.id,
        change_type: isUpgrade ? "upgrade" : "downgrade",
        old_tier: currentTier,
        new_tier: targetTier,
        old_status: vendor.subscription_status,
        new_status: "active",
        reason: body.reason ?? `Merchant ${isUpgrade ? "upgraded" : "downgraded"} to ${targetTier}`,
      });

      await admin.from("subscription_payments").insert({
        vendor_id: vendor.id,
        tier: targetTier,
        billing_period: billing,
        amount: 0,
        payment_method: "none",
        status: "completed",
        paid_at: new Date().toISOString(),
        notes: `Plan change ${currentTier} → ${targetTier}`,
      });

      await admin.from("user_notifications").insert({
        user_id: user.id,
        type: "subscription_changed",
        title: `Plan changed to ${targetTier}`,
        message: `Your merchant plan is now ${targetTier.toUpperCase()}.`,
      });

      return json({ applied: true, tier: targetTier, requiresPayment: false });
    }

    // Paid upgrade → create pending payment + PayFast checkout
    const reference = `SUB-${vendor.id.slice(0, 8)}-${Date.now()}`;
    const { data: payment, error: payError } = await admin
      .from("subscription_payments")
      .insert({
        vendor_id: vendor.id,
        tier: targetTier,
        billing_period: billing,
        amount,
        payment_method: "payfast",
        status: "pending",
        reference,
        notes: `Upgrade ${currentTier} → ${targetTier} (${billing})`,
      })
      .select()
      .single();
    if (payError || !payment) return json({ error: payError?.message ?? "Failed to create payment" }, 500);

    const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID") || "10000100";
    const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY") || "46f0cd694581a";
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "jt7NOE43FZPn";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    const billingDate = new Date();
    billingDate.setDate(billingDate.getDate() + (billing === "yearly" ? 365 : 30));

    const fields: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${origin}/merchant/dashboard?subscription=success&ref=${reference}`,
      cancel_url: `${origin}/merchant/dashboard?subscription=cancelled`,
      notify_url: `${supabaseUrl}/functions/v1/payfast-itn`,
      name_first: (vendor.business_name || "Merchant").slice(0, 100),
      email_address: vendor.email || user.email || "",
      m_payment_id: reference,
      amount: amount.toFixed(2),
      item_name: `1145 ${targetTier.toUpperCase()} plan (${billing})`,
      custom_str1: payment.id,
      custom_str2: "subscription",
      subscription_type: "1",
      billing_date: billingDate.toISOString().slice(0, 10),
      recurring_amount: amount.toFixed(2),
      frequency: billing === "yearly" ? "6" : "3",
      cycles: "0",
    };

    const signature = await signPayFast(fields, passphrase);

    return json({
      requiresPayment: true,
      paymentId: payment.id,
      reference,
      amount,
      paymentUrl: "https://www.payfast.co.za/eng/process",
      formData: { ...fields, signature },
    });
  } catch (err) {
    console.error("merchant-subscription error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
