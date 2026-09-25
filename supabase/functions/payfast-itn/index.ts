import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { amountsMatch, getPayFastConfig, validateItn } from "../_shared/payfast.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = () => new Response("OK", { status: 200, headers: corsHeaders });

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("PayFast ITN webhook received");

  try {
    const payfast = getPayFastConfig();
    if (!payfast) {
      return new Response("PayFast not configured", { status: 500, headers: corsHeaders });
    }

    // Parse form data from PayFast, keeping the order it was sent in (the
    // signature and the validation postback both depend on it).
    const formData = await req.formData();
    const entries: Array<[string, string]> = [];
    formData.forEach((value, key) => entries.push([key, value.toString()]));
    const data: Record<string, string> = Object.fromEntries(entries);

    const validation = await validateItn(entries, payfast);
    if (!validation.ok) {
      console.error("Rejected ITN:", validation.reason);
      return new Response("Invalid ITN", { status: 400, headers: corsHeaders });
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Extract payment details
    const paymentStatus = data.payment_status;
    const paymentId = data.m_payment_id ?? "";
    const pfPaymentId = data.pf_payment_id;
    const amountGross = parseFloat(data.amount_gross || "0");
    const customStr1 = data.custom_str1;
    const customStr2 = data.custom_str2;

    console.log(`Processing payment: ${paymentId} (${pfPaymentId}), Status: ${paymentStatus}, Type: ${customStr2}, R${amountGross}`);

    // Handle auction registration payments — AUCREG-{registrationId}
    if (customStr2 === "auction_registration" && customStr1 && paymentId === `AUCREG-${customStr1}`) {
      if (paymentStatus === "COMPLETE") {
        const { data: pending } = await supabaseAdmin
          .from("auction_registrations")
          .select("id, payment_status, auction:auctions(registration_fee)")
          .eq("id", customStr1)
          .maybeSingle();

        if (!pending) {
          console.error(`Auction registration ${customStr1} not found`);
          return ok();
        }
        if (pending.payment_status === "paid") {
          console.log(`Auction registration ${customStr1} already paid; ignoring duplicate ITN`);
          return ok();
        }
        const expected = Number((pending as any).auction?.registration_fee || 0);
        if (!amountsMatch(amountGross, expected)) {
          console.error(`Amount mismatch for registration ${customStr1}: paid R${amountGross}, expected R${expected}`);
          return ok();
        }

        const { error: updateError } = await supabaseAdmin
          .from("auction_registrations")
          .update({ payment_status: "paid", registration_fee_paid: expected })
          .eq("id", customStr1)
          .eq("payment_status", "pending");

        if (updateError) {
          console.error("Failed to update auction registration:", updateError);
          return new Response("Database error", { status: 500, headers: corsHeaders });
        }
        console.log(`Auction registration ${customStr1} confirmed`);
      } else if (paymentStatus === "CANCELLED" || paymentStatus === "FAILED") {
        // Delete the pending registration
        const { error: deleteError } = await supabaseAdmin
          .from("auction_registrations")
          .delete()
          .eq("id", customStr1)
          .eq("payment_status", "pending");

        if (deleteError) {
          console.error("Failed to delete pending registration:", deleteError);
        }
      }
      return ok();
    }

    // Handle auction winner payments — AUCWIN-{auctionId}
    if (customStr2 === "auction_winner_payment" && customStr1 && paymentId === `AUCWIN-${customStr1}`) {
      const auctionId = customStr1;

      if (paymentStatus === "COMPLETE") {
        const { data: auction } = await supabaseAdmin
          .from("auctions")
          .select("id, status, winner_id, winning_bid, product:products(id, name, store_id)")
          .eq("id", auctionId)
          .maybeSingle();

        if (!auction) {
          console.error(`Auction ${auctionId} not found`);
          return ok();
        }
        if (auction.status !== "sold") {
          console.log(`Auction ${auctionId} is ${auction.status}; ignoring duplicate ITN`);
          return ok();
        }

        const { data: registration } = await supabaseAdmin
          .from("auction_registrations")
          .select("registration_fee_paid, payment_status")
          .eq("auction_id", auctionId)
          .eq("user_id", auction.winner_id)
          .maybeSingle();
        const deposit = registration?.payment_status === "paid" ? Number(registration.registration_fee_paid || 0) : 0;
        const expected = Number(auction.winning_bid || 0) - deposit;
        if (!amountsMatch(amountGross, expected)) {
          console.error(`Amount mismatch for auction ${auctionId}: paid R${amountGross}, expected R${expected}`);
          return ok();
        }

        // Only the first ITN to flip sold -> completed creates the order.
        const { data: completed, error: auctionError } = await supabaseAdmin
          .from("auctions")
          .update({ status: "completed" })
          .eq("id", auctionId)
          .eq("status", "sold")
          .select("id");

        if (auctionError) {
          console.error("Failed to update auction:", auctionError);
          return new Response("Database error", { status: 500, headers: corsHeaders });
        }
        if (!completed?.length) return ok();

        console.log(`Auction ${auctionId} marked as completed`);
        const product = (auction as any).product;

        // Mark deposit as applied
        await supabaseAdmin
          .from("auction_registrations")
          .update({ deposit_applied: true })
          .eq("auction_id", auctionId)
          .eq("user_id", auction.winner_id);

        // Get user's default address
        const { data: address } = await supabaseAdmin
          .from("user_addresses")
          .select("*")
          .eq("user_id", auction.winner_id)
          .eq("is_default", true)
          .maybeSingle();

        const shippingAddress = address ? {
          name: address.name,
          street: address.street,
          city: address.city,
          province: address.province,
          postal_code: address.postal_code,
          country: address.country,
          phone: address.phone,
        } : {};

        // Create order
        const { data: order, error: orderError } = await supabaseAdmin
          .from("orders")
          .insert({
            user_id: auction.winner_id,
            total: auction.winning_bid,
            status: "processing",
            payment_status: "paid",
            payment_method: "payfast",
            shipping_address: shippingAddress,
            notes: `Auction win: ${product?.name}`,
          })
          .select()
          .single();

        if (!orderError && order) {
          await supabaseAdmin
            .from("order_items")
            .insert({
              order_id: order.id,
              product_id: product?.id,
              store_id: product?.store_id,
              quantity: 1,
              price: auction.winning_bid,
              status: "pending",
              vendor_status: "pending",
            });

          console.log(`Order ${order.id} created for auction winner`);
        } else {
          console.error("Failed to create auction order:", orderError);
        }
      }
      return ok();
    }

    // Handle regular order payments — ORDER-{uuid} format
    if (paymentId.startsWith("ORDER-")) {
      const orderId = paymentId.replace("ORDER-", "");

      if (paymentStatus === "COMPLETE") {
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, total, ucoin_value_zar, payment_status")
          .eq("id", orderId)
          .maybeSingle();

        if (!order) {
          console.error(`Order ${orderId} not found`);
          return ok();
        }
        if (order.payment_status === "paid") {
          console.log(`Order ${orderId} already paid; ignoring duplicate ITN`);
          return ok();
        }
        const expected = Math.max(Number(order.total || 0) - Number(order.ucoin_value_zar || 0), 0);
        if (!amountsMatch(amountGross, expected)) {
          console.error(`Amount mismatch for order ${orderId}: paid R${amountGross}, expected R${expected}`);
          return ok();
        }

        const { data: updated, error: orderError } = await supabaseAdmin
          .from("orders")
          .update({
            payment_status: "paid",
            status: "processing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .neq("payment_status", "paid")
          .select("id");

        if (orderError) {
          console.error("Failed to update order:", orderError);
          return new Response("Database error", { status: 500, headers: corsHeaders });
        }
        if (!updated?.length) return ok();

        console.log(`Order ${orderId} payment confirmed`);
      } else if (paymentStatus === "CANCELLED" || paymentStatus === "FAILED") {
        const { error: cancelError } = await supabaseAdmin
          .from("orders")
          .update({
            payment_status: paymentStatus.toLowerCase(),
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .eq("payment_status", "pending");

        if (cancelError) {
          console.error("Failed to cancel order:", cancelError);
        } else {
          console.log(`Order ${orderId} cancelled/failed`);
        }
      }
      return ok();
    }

    // Handle wallet deposits — DEPOSIT-{userId}-{ts}
    if (paymentId.startsWith("DEPOSIT-") && customStr1 === "wallet_deposit" && customStr2
        && paymentId.startsWith(`DEPOSIT-${customStr2}-`)) {
      const userId = customStr2;
      if (paymentStatus === "COMPLETE") {
        // PayFast retries ITNs; credit each pf_payment_id only once.
        const { count: alreadyCredited } = await supabaseAdmin
          .from("wallet_ledger")
          .select("id", { count: "exact", head: true })
          .eq("provider", "payfast")
          .eq("provider_reference", pfPaymentId);
        if ((alreadyCredited ?? 0) > 0) {
          console.log(`Deposit ${pfPaymentId} already credited; ignoring duplicate ITN`);
          return ok();
        }

        const { error: creditError } = await supabaseAdmin.rpc("credit_wallet", {
          p_user_id: userId,
          p_bucket: "available",
          p_amount: amountGross,
          p_type: "deposit",
          p_provider: "payfast",
          p_provider_reference: pfPaymentId,
          p_related_type: "deposit",
          p_related_id: paymentId,
          p_metadata: { m_payment_id: paymentId },
        });
        if (creditError) {
          console.error("Failed to credit wallet:", creditError);
          return new Response("Database error", { status: 500, headers: corsHeaders });
        }

        await supabaseAdmin.from("user_notifications").insert({
          user_id: userId, type: "deposit_completed",
          title: "Deposit successful",
          message: `R${amountGross.toFixed(2)} added to your 1145 Wallet.`,
        });
        // Capture the token if provided (subscription_type=1/2 attaches a token on future ITNs)
        if (data.token) {
          await supabaseAdmin.from("payment_instruments").upsert({
            user_id: userId, provider: "payfast", provider_token: data.token,
            brand: data.card_type || null, last4: data.card_last_four || null,
            status: "active", verified_at: new Date().toISOString(),
          }, { onConflict: "provider,provider_token" });
        }
        console.log(`Wallet credited: ${userId} +R${amountGross}`);
      }
      return ok();
    }

    // Handle merchant subscription payments (recurring: one ITN per billing cycle)
    if (customStr2 === "subscription" && customStr1) {
      const paymentRecordId = customStr1;
      const { data: subPayment } = await supabaseAdmin
        .from("subscription_payments")
        .select("*")
        .eq("id", paymentRecordId)
        .maybeSingle();

      if (!subPayment || subPayment.reference !== paymentId) {
        console.error(`Subscription payment ${paymentRecordId} not found for ${paymentId}`);
        return ok();
      }

      if (paymentStatus === "COMPLETE") {
        if (subPayment.payfast_payment_id === pfPaymentId) {
          console.log(`Subscription payment ${pfPaymentId} already applied; ignoring duplicate ITN`);
          return ok();
        }
        if (!amountsMatch(amountGross, Number(subPayment.amount))) {
          console.error(`Amount mismatch for subscription ${paymentRecordId}: paid R${amountGross}, expected R${subPayment.amount}`);
          return ok();
        }

        const months = subPayment.billing_period === "yearly" ? 12 : 1;
        const expires = new Date();
        expires.setMonth(expires.getMonth() + months);

        await supabaseAdmin
          .from("subscription_payments")
          .update({
            status: "completed",
            paid_at: new Date().toISOString(),
            payfast_payment_id: pfPaymentId,
          })
          .eq("id", paymentRecordId);

        const { data: vendorRow } = await supabaseAdmin
          .from("vendors")
          .select("id, user_id, subscription_tier, subscription_status")
          .eq("id", subPayment.vendor_id)
          .maybeSingle();

        await supabaseAdmin
          .from("vendors")
          .update({
            subscription_tier: subPayment.tier,
            subscription_status: "active",
            subscription_expires_at: expires.toISOString(),
          })
          .eq("id", subPayment.vendor_id);

        await supabaseAdmin.from("vendor_subscription_audit_log").insert({
          vendor_id: subPayment.vendor_id,
          changed_by: vendorRow?.user_id ?? subPayment.vendor_id,
          change_type: "upgrade",
          old_tier: vendorRow?.subscription_tier ?? null,
          new_tier: subPayment.tier,
          old_status: vendorRow?.subscription_status ?? null,
          new_status: "active",
          reason: `PayFast subscription payment ${pfPaymentId}`,
        });

        if (vendorRow?.user_id) {
          await supabaseAdmin.from("user_notifications").insert({
            user_id: vendorRow.user_id,
            type: "subscription_activated",
            title: `${String(subPayment.tier).toUpperCase()} plan active`,
            message: `Your payment of R${amountGross.toFixed(2)} was successful. Your plan renews on ${expires.toLocaleDateString()}.`,
          });
        }

        console.log(`Subscription ${paymentRecordId} activated for vendor ${subPayment.vendor_id}`);
      } else if (paymentStatus === "CANCELLED" || paymentStatus === "FAILED") {
        await supabaseAdmin
          .from("subscription_payments")
          .update({ status: paymentStatus.toLowerCase(), payfast_payment_id: pfPaymentId })
          .eq("id", paymentRecordId)
          .eq("status", "pending");
        console.log(`Subscription payment ${paymentRecordId} ${paymentStatus}`);
      }
      return ok();
    }

    // Handle card linking — LINKCARD-{userId}-{ts}
    if (paymentId.startsWith("LINKCARD-") && customStr1 === "link_card" && customStr2
        && paymentId.startsWith(`LINKCARD-${customStr2}-`)) {
      const userId = customStr2;
      if (paymentStatus === "COMPLETE" && data.token) {
        const { error: linkError } = await supabaseAdmin.from("payment_instruments").upsert({
          user_id: userId, provider: "payfast", provider_token: data.token,
          brand: data.card_type || null, last4: data.card_last_four || null,
          holder_name: data.name_first ? `${data.name_first} ${data.name_last || ""}`.trim() : null,
          status: "active", verified_at: new Date().toISOString(),
        }, { onConflict: "provider,provider_token" });
        if (linkError) {
          console.error("Failed to store card token:", linkError);
          return new Response("Database error", { status: 500, headers: corsHeaders });
        }
        await supabaseAdmin.from("user_notifications").insert({
          user_id: userId, type: "card_linked",
          title: "Card linked", message: `Card ending ${data.card_last_four || "••••"} was added to your wallet.`,
        });
        console.log(`Card linked for ${userId}`);
      }
      return ok();
    }

    console.warn(`Unhandled ITN reference: ${paymentId}`);
    return ok();
  } catch (error) {
    console.error("PayFast ITN processing error:", error);
    return new Response(
      error instanceof Error ? error.message : "Internal server error",
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
});
