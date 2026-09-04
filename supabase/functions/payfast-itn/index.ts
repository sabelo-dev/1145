import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// MD5 hash implementation
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
    .replace(/%[0-9a-f]{2}/gi, (match) => match.toUpperCase());
}

// Verify PayFast signature
async function verifySignature(data: Record<string, string>, passphrase: string): Promise<boolean> {
  const receivedSignature = data.signature;

  const paramString = Object.keys(data)
    .filter((key) => key !== "signature" && data[key] !== "" && data[key] !== null && data[key] !== undefined)
    .sort()
    .map((key) => `${key}=${phpUrlencode(String(data[key]).trim())}`)
    .join("&");

  const stringToHash = passphrase
    ? `${paramString}&passphrase=${phpUrlencode(passphrase)}`
    : paramString;

  const calculatedSignature = await md5Hash(stringToHash);

  console.log("Received signature:", receivedSignature);
  console.log("Calculated signature:", calculatedSignature);

  return calculatedSignature === receivedSignature;
}

// Validate PayFast server IP
function validatePayFastIP(ip: string): boolean {
  const validIPs = [
    "197.97.145.144",
    "197.97.145.145",
    "197.97.145.146",
    "197.97.145.147",
    "197.97.145.148",
    "197.97.145.149",
    "41.74.179.194",
    "41.74.179.195",
    "41.74.179.196",
    "41.74.179.197",
    "41.74.179.198",
    "41.74.179.199",
    "41.74.179.200",
    "41.74.179.201",
    "41.74.179.202",
    "41.74.179.203",
    "41.74.179.204",
    "41.74.179.205",
    "41.74.179.206",
    "41.74.179.207",
    "41.74.179.208",
    "41.74.179.209",
    "41.74.179.210",
    "41.74.179.211",
    "41.74.179.212",
    "41.74.179.213",
    "41.74.179.214",
    "41.74.179.215",
    "41.74.179.216",
  ];
  
  // In development/testing, skip IP validation
  if (Deno.env.get("PAYFAST_SANDBOX") === "true") {
    return true;
  }
  
  return validIPs.includes(ip);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("PayFast ITN webhook received");
  
  try {
    // Get client IP for validation
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") ||
                     "unknown";
    
    console.log("Request from IP:", clientIP);
    
    // Parse form data from PayFast
    const formData = await req.formData();
    const data: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });
    
    console.log("ITN Data received:", JSON.stringify(data, null, 2));
    
    // Get PayFast credentials
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";
    
    // Verify signature
    const isValidSignature = await verifySignature(data, passphrase);
    if (!isValidSignature) {
      console.error("Invalid PayFast signature");
      return new Response("Invalid signature", { 
        status: 400,
        headers: corsHeaders 
      });
    }
    
    console.log("Signature verified successfully");
    
    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    // Extract payment details
    const paymentStatus = data.payment_status;
    const paymentId = data.m_payment_id;
    const pfPaymentId = data.pf_payment_id;
    const amountGross = parseFloat(data.amount_gross || "0");
    const customStr1 = data.custom_str1; // Registration ID for auction registrations
    const customStr2 = data.custom_str2; // Payment type identifier
    
    console.log(`Processing payment: ${paymentId}, Status: ${paymentStatus}, Type: ${customStr2}`);
    console.log(`Registration ID: ${customStr1}`);
    
    // Handle auction registration payments
    if (customStr2 === "auction_registration" && customStr1) {
      if (paymentStatus === "COMPLETE") {
        console.log(`Confirming auction registration: ${customStr1}`);
        
        // Update registration status to paid
        const { data: registration, error: updateError } = await supabaseAdmin
          .from("auction_registrations")
          .update({ 
            payment_status: "paid"
          })
          .eq("id", customStr1)
          .select()
          .single();
        
        if (updateError) {
          console.error("Failed to update auction registration:", updateError);
          return new Response("Database error", { 
            status: 500,
            headers: corsHeaders 
          });
        }
        
        console.log(`Auction registration ${customStr1} confirmed successfully`);
        console.log("Updated registration:", registration);
        
        // Optionally send confirmation email
        try {
          // Get user details
          const { data: userProfile } = await supabaseAdmin
            .from("profiles")
            .select("email, name")
            .eq("id", registration.user_id)
            .single();
          
          // Get auction details
          const { data: auction } = await supabaseAdmin
            .from("auctions")
            .select(`
              *,
              product:products(name)
            `)
            .eq("id", registration.auction_id)
            .single();
          
          if (userProfile && auction) {
            console.log(`Registration confirmed for ${userProfile.email} on auction: ${auction.product?.name}`);
            // Could invoke email function here
          }
        } catch (emailError) {
          console.error("Failed to send confirmation email:", emailError);
          // Don't fail the webhook for email errors
        }
        
      } else if (paymentStatus === "CANCELLED" || paymentStatus === "FAILED") {
        console.log(`Payment failed/cancelled for registration: ${customStr1}`);
        
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
    }
    
    // Handle auction winner payments
    if (customStr2 === "auction_winner_payment" && customStr1) {
      const auctionId = customStr1;
      
      if (paymentStatus === "COMPLETE") {
        console.log(`Processing auction winner payment for auction: ${auctionId}`);
        
        // Update auction status to completed
        const { data: auction, error: auctionError } = await supabaseAdmin
          .from("auctions")
          .update({ status: "completed" })
          .eq("id", auctionId)
          .select(`
            *,
            product:products(id, name, store_id)
          `)
          .single();
        
        if (auctionError) {
          console.error("Failed to update auction:", auctionError);
        } else {
          console.log(`Auction ${auctionId} marked as completed`);
          
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
              notes: `Auction win: ${auction.product?.name}`,
            })
            .select()
            .single();
          
          if (!orderError && order) {
            // Create order item
            await supabaseAdmin
              .from("order_items")
              .insert({
                order_id: order.id,
                product_id: auction.product?.id,
                store_id: auction.product?.store_id,
                quantity: 1,
                price: auction.winning_bid,
                status: "pending",
                vendor_status: "pending",
              });
            
            console.log(`Order ${order.id} created for auction winner`);
          }
        }
      }
    }
    
    // Handle regular order payments — ORDER-{uuid} format
    if (paymentId && paymentId.startsWith("ORDER-")) {
      const orderId = paymentId.replace("ORDER-", "");
      
      if (paymentStatus === "COMPLETE") {
        const { error: orderError } = await supabaseAdmin
          .from("orders")
          .update({ 
            payment_status: "paid",
            status: "processing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);
        
        if (orderError) {
          console.error("Failed to update order:", orderError);
        } else {
          console.log(`Order ${orderId} payment confirmed`);

          // Payment confirmed -> hand any dropshipping items to their suppliers.
          try {
            const fulfillRes = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/dropship-fulfill`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({ order_id: orderId }),
              },
            );
            console.log("Dropship fulfilment result:", await fulfillRes.text());
          } catch (dropErr) {
            console.error("Dropship fulfilment dispatch failed:", dropErr);
          }
        }
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
    }

    // Handle wallet deposits — DEPOSIT-{userId}-{ts}
    if (paymentId && paymentId.startsWith("DEPOSIT-") && customStr1 === "wallet_deposit" && customStr2) {
      const userId = customStr2;
      if (paymentStatus === "COMPLETE") {
        try {
          await supabaseAdmin.rpc("credit_wallet", {
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
        } catch (err) {
          console.error("Failed to credit wallet:", err);
        }
      }
    }

    // Handle merchant subscription payments — SUB-{vendorId}-{ts}
    if (customStr2 === "subscription" && customStr1) {
      const paymentRecordId = customStr1;
      const { data: subPayment } = await supabaseAdmin
        .from("subscription_payments")
        .select("*")
        .eq("id", paymentRecordId)
        .maybeSingle();

      if (subPayment) {
        if (paymentStatus === "COMPLETE") {
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
      }
    }

    // Handle card linking — LINKCARD-{userId}-{ts}

    if (paymentId && paymentId.startsWith("LINKCARD-") && customStr1 === "link_card" && customStr2) {
      const userId = customStr2;
      if (paymentStatus === "COMPLETE" && data.token) {
        try {
          await supabaseAdmin.from("payment_instruments").upsert({
            user_id: userId, provider: "payfast", provider_token: data.token,
            brand: data.card_type || null, last4: data.card_last_four || null,
            holder_name: data.name_first ? `${data.name_first} ${data.name_last || ""}`.trim() : null,
            status: "active", verified_at: new Date().toISOString(),
          }, { onConflict: "provider,provider_token" });
          await supabaseAdmin.from("user_notifications").insert({
            user_id: userId, type: "card_linked",
            title: "Card linked", message: `Card ending ${data.card_last_four || "••••"} was added to your wallet.`,
          });
          console.log(`Card linked for ${userId}`);
        } catch (err) {
          console.error("Failed to store card token:", err);
        }
      }
    }
    
    
    // Return OK to PayFast
    return new Response("OK", { 
      status: 200,
      headers: corsHeaders 
    });
    
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
