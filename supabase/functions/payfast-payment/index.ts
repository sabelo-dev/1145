import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPayFastConfig, signPayFast } from "../_shared/payfast.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Keep in sync with src/utils/pricingMarkup.ts and CheckoutForm (15% VAT).
const PLATFORM_MARKUP_PERCENTAGE = 5;
const VAT_RATE = 0.15;
const MAX_CART_LINES = 100;
const MAX_LINE_QUANTITY = 99;

interface CartItemInput {
  productId: string;
  quantity: number;
  variationId?: string;
}

interface PayFastPaymentData {
  itemName?: string;
  returnUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customStr1?: string;
  customStr2?: string;
  paymentMethod?: string;
  shippingAddress?: Record<string, unknown>;
  cartItems?: CartItemInput[];
  ucoinToApply?: number;
}

interface PricedLine {
  productId: string;
  storeId: string | null;
  quantity: number;
  unitPrice: number;
  downloadable: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Prices every cart line from the database; client-sent prices are ignored. */
async function priceCart(
  db: SupabaseClient,
  items: CartItemInput[],
): Promise<{ lines: PricedLine[] } | { error: string }> {
  if (!Array.isArray(items) || items.length === 0) return { error: "Your cart is empty." };
  if (items.length > MAX_CART_LINES) return { error: "Too many items in cart." };
  for (const item of items) {
    const qty = Number(item?.quantity);
    if (!item?.productId || !Number.isInteger(qty) || qty < 1 || qty > MAX_LINE_QUANTITY) {
      return { error: "Invalid cart item." };
    }
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const variationIds = [...new Set(items.map((i) => i.variationId).filter(Boolean))] as string[];
  const now = new Date().toISOString();

  const [productsRes, variationsRes, flashRes] = await Promise.all([
    db.from("products").select("id, price, store_id, status, product_type").in("id", productIds),
    variationIds.length
      ? db.from("product_variations").select("id, product_id, price").in("id", variationIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("flash_deals").select("product_id, flash_price, discount_value")
      .in("product_id", productIds).eq("is_active", true).lte("start_time", now).gt("end_time", now),
  ]);

  const firstError = [productsRes, variationsRes, flashRes].find((r) => r.error)?.error;
  if (firstError) {
    console.error("Cart pricing query failed:", firstError);
    return { error: "Could not price your cart. Please try again." };
  }

  const products = new Map((productsRes.data ?? []).map((p: any) => [p.id, p]));
  const variations = new Map((variationsRes.data ?? []).map((v: any) => [v.id, v]));
  const flashDeals = new Map((flashRes.data ?? []).map((d: any) => [d.product_id, d]));

  const lines: PricedLine[] = [];
  for (const item of items) {
    const product = products.get(item.productId);
    if (!product) return { error: "An item in your cart is no longer available." };

    if (!["approved", "active"].includes(product.status)) {
      return { error: "An item in your cart is no longer available." };
    }
    const variation = item.variationId ? variations.get(item.variationId) : undefined;
    const base = variation && variation.product_id === product.id && Number(variation.price) > 0
      ? Number(variation.price)
      : Number(product.price);
    let unitPrice = round2(base * (1 + PLATFORM_MARKUP_PERCENTAGE / 100));

    const deal = flashDeals.get(product.id);
    if (deal) {
      const flashPrice = Number(deal.flash_price) || Number(product.price) * (1 - Number(deal.discount_value) / 100);
      if (flashPrice > 0) unitPrice = Math.min(unitPrice, round2(flashPrice));
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { error: "An item in your cart has no valid price." };
    }

    lines.push({
      productId: product.id,
      storeId: product.store_id ?? null,
      quantity: Number(item.quantity),
      unitPrice,
      downloadable: product.product_type === "downloadable",
    });
  }

  return { lines };
}

/** Mirrors src/utils/shippingCalculator.ts. */
async function calculateShipping(db: SupabaseClient, subtotal: number, allDownloadable: boolean): Promise<number> {
  if (allDownloadable) return 0;
  const { data: rates, error } = await db
    .from("shipping_rates")
    .select("*")
    .eq("is_active", true)
    .order("min_order_value", { ascending: true });
  if (error || !rates?.length) return 0;

  const rate = rates.find((r: any) =>
    subtotal >= r.min_order_value && (r.max_order_value === null || subtotal <= r.max_order_value));
  if (!rate) return 0;
  if (rate.free_shipping_threshold !== null && subtotal >= rate.free_shipping_threshold) return 0;

  const type = String(rate.rate_type).toLowerCase();
  if (type === "order_value" || type === "percentage") return (subtotal * Number(rate.price)) / 100;
  return Number(rate.price);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const payfast = getPayFastConfig();
    if (!payfast) {
      return json({ success: false, error: "Payment gateway not configured properly" }, 500);
    }

    const paymentData: PayFastPaymentData = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Each purpose computes its own amount server-side and gets its own
    // m_payment_id prefix so payfast-itn can verify what was paid.
    let amountDue: number;
    let mPaymentId: string;
    let itemName = String(paymentData.itemName || "1145 Lifestyle order").slice(0, 100);

    if (paymentData.customStr2 === "auction_registration") {
      const registrationId = String(paymentData.customStr1 || "");
      const { data: registration } = await supabaseAdmin
        .from("auction_registrations")
        .select("id, user_id, payment_status, auction:auctions(registration_fee)")
        .eq("id", registrationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!registration) return json({ success: false, error: "Registration not found" }, 404);
      if (registration.payment_status === "paid") {
        return json({ success: false, error: "This registration is already paid" }, 400);
      }
      amountDue = round2(Number((registration as any).auction?.registration_fee || 0));
      mPaymentId = `AUCREG-${registration.id}`;
    } else if (paymentData.customStr2 === "auction_winner_payment") {
      const auctionId = String(paymentData.customStr1 || "");
      const { data: auction } = await supabaseAdmin
        .from("auctions")
        .select("id, status, winner_id, winning_bid")
        .eq("id", auctionId)
        .eq("winner_id", user.id)
        .maybeSingle();

      if (!auction) return json({ success: false, error: "Auction not found" }, 404);
      if (auction.status !== "sold") {
        return json({ success: false, error: "This auction is not awaiting payment" }, 400);
      }
      const { data: registration } = await supabaseAdmin
        .from("auction_registrations")
        .select("registration_fee_paid, payment_status")
        .eq("auction_id", auction.id)
        .eq("user_id", user.id)
        .maybeSingle();

      const deposit = registration?.payment_status === "paid" ? Number(registration.registration_fee_paid || 0) : 0;
      amountDue = round2(Number(auction.winning_bid || 0) - deposit);
      mPaymentId = `AUCWIN-${auction.id}`;
    } else {
      // Regular cart checkout.
      const priced = await priceCart(supabaseAdmin, paymentData.cartItems ?? []);
      if ("error" in priced) return json({ success: false, error: priced.error }, 400);

      const subtotal = priced.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
      const shipping = await calculateShipping(supabaseAdmin, subtotal, priced.lines.every((l) => l.downloadable));
      const tax = subtotal * VAT_RATE;
      const total = round2(subtotal + shipping + tax);
      const shippingAddress = paymentData.shippingAddress || {};

      // Reuse the user's latest pending order instead of creating duplicates.
      let orderId: string;
      const { data: existingOrder } = await supabaseAdmin
        .from("orders")
        .select("id, ucoin_spent, ucoin_value_zar")
        .eq("user_id", user.id)
        .eq("payment_status", "pending")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingOrder) {
        orderId = existingOrder.id;
        await supabaseAdmin.from("orders").update({
          total,
          shipping_address: shippingAddress,
          updated_at: new Date().toISOString(),
        }).eq("id", orderId);
        await supabaseAdmin.from("order_items").delete().eq("order_id", orderId);
        console.log(`Reusing existing pending order: ${orderId}`);
      } else {
        const { data: newOrder, error: orderError } = await supabaseAdmin.from("orders").insert({
          user_id: user.id,
          total,
          status: "pending",
          payment_method: "payfast",
          payment_status: "pending",
          shipping_address: shippingAddress,
        }).select("id").single();

        if (orderError || !newOrder) {
          console.error("Failed to create order:", orderError);
          return json({ success: false, error: "Failed to create order" }, 500);
        }
        orderId = newOrder.id;
      }

      const { error: itemsError } = await supabaseAdmin.from("order_items").insert(
        priced.lines.map((line) => ({
          order_id: orderId,
          product_id: line.productId,
          quantity: line.quantity,
          price: line.unitPrice,
          store_id: line.storeId,
          status: "pending",
          vendor_status: "pending",
        })),
      );
      if (itemsError) {
        console.error("Failed to insert order items:", itemsError);
        return json({ success: false, error: "Failed to save your order" }, 500);
      }

      // Apply UCoin exactly once per order, then charge only the remaining Rand amount.
      let ucoinDiscount = Number(existingOrder?.ucoin_value_zar || 0);
      const requestedUcoin = Math.max(0, Math.floor(Number(paymentData.ucoinToApply || 0)));
      const alreadyRedeemed = Number(existingOrder?.ucoin_spent || 0);

      if (requestedUcoin > 0 && alreadyRedeemed <= 0) {
        const { data: redeemResult, error: redeemError } = await supabaseClient.rpc(
          "redeem_ucoin_for_order",
          { p_order_id: orderId, p_ucoin: requestedUcoin },
        );
        const redeem = redeemResult as any;
        if (redeemError || !redeem?.success) {
          console.error("UCoin redemption failed:", redeemError, redeem);
          return json({
            success: false,
            error: redeem?.error || redeemError?.message || "Could not use your UCoin for this order",
          }, 400);
        }
        ucoinDiscount = Number(redeem.zar_amount ?? redeem.ucoin_value_zar ?? requestedUcoin * 0.1);
        console.log(`Applied ${requestedUcoin} UCoin (R${ucoinDiscount}) to order ${orderId}`);
      }

      amountDue = Math.max(round2(total - ucoinDiscount), 0);
      mPaymentId = `ORDER-${orderId}`;
      itemName = `Order for ${priced.lines.length} item${priced.lines.length === 1 ? "" : "s"}`;

      // Fully covered by UCoin — no gateway redirect needed.
      if (amountDue <= 0) {
        await supabaseAdmin.from("orders").update({
          payment_status: "paid",
          status: "processing",
          payment_method: "ucoin",
          payment_gateway: "ucoin",
          updated_at: new Date().toISOString(),
        }).eq("id", orderId);

        await supabaseAdmin.from("order_payment_attempts").insert({
          order_id: orderId,
          user_id: user.id,
          gateway: "ucoin",
          method: "ucoin",
          amount: ucoinDiscount,
          status: "paid",
          reference: mPaymentId,
        });

        return json({ success: true, paidWithUcoin: true, orderId, ucoinDiscount });
      }

      await supabaseAdmin.from("order_payment_attempts").insert({
        order_id: orderId,
        user_id: user.id,
        gateway: "payfast",
        method: paymentData.paymentMethod || null,
        amount: amountDue,
        status: "initiated",
        reference: mPaymentId,
        metadata: { ucoin_discount: ucoinDiscount, subtotal, shipping, tax },
      });

      await supabaseAdmin.from("orders").update({ payment_gateway: "payfast" }).eq("id", orderId);
    }

    if (!(amountDue > 0)) {
      return json({ success: false, error: "Nothing to pay for this request" }, 400);
    }

    const customerEmail = user.email || paymentData.customerEmail || "";
    const formData: Record<string, string | number> = {
      merchant_id: payfast.merchantId,
      merchant_key: payfast.merchantKey,
      return_url: safeUrl(paymentData.returnUrl) ?? "",
      cancel_url: safeUrl(paymentData.cancelUrl) ?? "",
      notify_url: payfast.notifyUrl,
      name_first: paymentData.customerFirstName || "",
      name_last: paymentData.customerLastName || "",
      email_address: customerEmail,
      m_payment_id: mPaymentId,
      amount: amountDue.toFixed(2),
      item_name: itemName,
      item_description: itemName,
    };

    if (paymentData.customStr1) formData.custom_str1 = String(paymentData.customStr1);
    if (paymentData.customStr2) formData.custom_str2 = String(paymentData.customStr2);

    formData.email_confirmation = 1;
    formData.confirmation_address = customerEmail;

    if (paymentData.paymentMethod) {
      formData.payment_method = paymentData.paymentMethod;
    }

    const signature = await signPayFast(formData, payfast.passphrase);

    console.log(`Payment initiated by user ${user.id}: ${mPaymentId} R${amountDue.toFixed(2)}`);

    return json({
      success: true,
      formData: { ...formData, signature },
      action: payfast.processUrl,
      amount: amountDue,
    });
  } catch (error) {
    console.error("PayFast payment creation failed:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Payment creation failed",
    }, 500);
  }
});
