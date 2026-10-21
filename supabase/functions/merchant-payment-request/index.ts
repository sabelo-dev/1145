// 1145 Pay: starts PayFast checkout for a payment request (link / QR code),
// or, with action "pay_card", charges a signed-in payer's saved card.
// Public: the payer may not have a 1145 account. The link's token is the only
// input; the amount, description and store come from the database, and the
// return address is built here from an allowlist, never taken from the request.
// Payment is confirmed only by payfast-itn.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chargePayFastToken, getPayFastConfig, payfastReturnUrl, signPayFast } from "../_shared/payfast.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOKEN_PATTERN = /^[0-9a-f]{36}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Origins PayFast may send the payer back to; anything else goes to SITE_URL. */
function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const site = (Deno.env.get("SITE_URL") || "https://1145.io").replace(/\/$/, "");
  const allowed = new Set([
    site,
    "https://1145.io",
    "https://www.1145.io",
    "https://localhost",
    "capacitor://localhost",
    ...(Deno.env.get("PAYMENT_RETURN_ORIGINS") ?? "").split(",").map((o) => o.trim()).filter(Boolean),
  ]);
  return allowed.has(origin) ? origin : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const { token, action, instrument_id: instrumentId } = await req.json().catch(() => ({}));
    if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
      return json({ success: false, error: "This payment link is not valid" }, 400);
    }

    const payfast = getPayFastConfig();
    if (!payfast) {
      return json({ success: false, error: "Payments are not available right now" }, 500);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ------------------------------------------------ pay with a saved card
    // The payer must be signed in and own the card; the database opens one
    // attempt per request (so a double tap can't charge twice) and settles it
    // from PayFast's server-to-server answer.
    if (action === "pay_card") {
      const userDb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      });
      const { data: { user } } = await userDb.auth.getUser();
      if (!user) return json({ success: false, error: "Sign in to pay with a saved card" }, 401);
      if (typeof instrumentId !== "string" || !/^[0-9a-f-]{36}$/i.test(instrumentId)) {
        return json({ success: false, error: "Choose a card" }, 400);
      }

      const { data: begun, error: beginError } = await supabaseAdmin.rpc("payment_request_begin_card_charge", {
        p_token: token, p_instrument_id: instrumentId, p_payer: user.id,
      });
      if (beginError || !begun) {
        return json({ success: false, error: beginError?.message ?? "Could not start the payment" }, 400);
      }

      const itemName = `${begun.store_name}: ${begun.description}`;
      const charge = await chargePayFastToken(begun.provider_token, begun.amount_minor, itemName, payfast);
      const { data: outcome, error: finishError } = await supabaseAdmin.rpc("payment_request_finish_card_charge", {
        p_attempt_id: begun.attempt_id,
        p_result: charge.outcome,
        p_provider_reference: charge.outcome === "succeeded" ? charge.reference : null,
        p_error: charge.outcome === "succeeded" ? null : charge.error,
      });
      if (finishError) {
        // The charge result is known but could not be saved: never tell the payer to try again.
        console.error(`merchant-payment-request: could not record attempt ${begun.attempt_id} (${charge.outcome})`, finishError);
        return json({ success: false, error: "We could not confirm your payment. Please don't pay again; contact support@1145.io." }, 500);
      }

      console.log(`Saved-card payment for request ${begun.request_id}: ${charge.outcome} (${outcome})`);
      if (charge.outcome === "succeeded") return json({ success: true, status: "paid", card: begun.card });
      if (charge.outcome === "failed") return json({ success: false, error: `${begun.card}: ${charge.error}. Try another card or pay with PayFast.` }, 402);
      return json({
        success: false,
        error: "We couldn't confirm the payment with your bank. Please don't pay again yet; 1145 will check it and the store will see it if it went through.",
      }, 502);
    }

    const { data: request, error } = await supabaseAdmin
      .from("merchant_payment_requests")
      .select("id, store_id, description, reference, amount_minor, currency, status, expires_at, stores(name)")
      .eq("public_token", token)
      .maybeSingle();
    if (error) {
      console.error("Payment request lookup failed:", error);
      return json({ success: false, error: "Could not load this payment" }, 500);
    }
    if (!request) {
      return json({ success: false, error: "This payment link is not valid" }, 404);
    }

    const { data: enabled } = await supabaseAdmin.rpc("store_feature_enabled", {
      p_store_id: request.store_id,
      p_flag: "payment_requests",
    });
    if (!enabled) {
      return json({ success: false, error: "This payment link is not valid" }, 404);
    }
    if (request.status !== "pending") {
      return json({ success: false, error: request.status === "paid" ? "This has already been paid" : "This payment link is no longer open" }, 400);
    }
    if (new Date(request.expires_at).getTime() <= Date.now()) {
      return json({ success: false, error: "This payment link has expired" }, 400);
    }

    const storeName = String((request as any).stores?.name ?? "1145 store");
    const itemName = `${storeName}: ${request.description}`.slice(0, 100);
    const returnPath = `/pay/${token}`;
    const origin = allowedOrigin(req.headers.get("origin"));

    const formData: Record<string, string | number> = {
      merchant_id: payfast.merchantId,
      merchant_key: payfast.merchantKey,
      return_url: payfastReturnUrl(origin, `${returnPath}?status=returned`),
      cancel_url: payfastReturnUrl(origin, `${returnPath}?status=cancelled`),
      notify_url: payfast.notifyUrl,
      m_payment_id: `PREQ-${request.id}`,
      amount: (request.amount_minor / 100).toFixed(2),
      item_name: itemName,
      item_description: (request.reference ? `Ref ${request.reference}` : itemName).slice(0, 255),
      custom_str1: request.id,
      custom_str2: "payment_request",
    };
    const signature = await signPayFast(formData, payfast.passphrase);

    console.log(`Payment request checkout started: PREQ-${request.id} R${formData.amount}`);
    return json({ success: true, formData: { ...formData, signature }, action: payfast.processUrl });
  } catch (error) {
    console.error("Payment request checkout failed:", error);
    return json({ success: false, error: "Could not start the payment" }, 500);
  }
});
