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
const MAX_PROMO_CODE_LENGTH = 50;

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
  promoCode?: string;
  /** Price the cart (with any promo code) and return the totals without creating an order. */
  quoteOnly?: boolean;
}

interface AppliedPromo {
  code: string;
  /** Rand taken off the pre-VAT subtotal. */
  discount: number;
  freeShipping: boolean;
  promotionIds: string[];
}

interface PricedLine {
  productId: string;
  variationId: string | null;
  storeId: string | null;
  quantity: number;
  unitPrice: number;
  downloadable: boolean;
  /** Bought while out of stock from a store that allows pre-orders. */
  preorder: boolean;
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
  const now = new Date().toISOString();

  const [productsRes, variationsRes, flashRes] = await Promise.all([
    db.from("products").select("id, name, brand, price, quantity, store_id, status, product_type, stores(allow_preorders)").in("id", productIds),
    // All options of these products: needed for stock, not just the selected ones.
    db.from("product_variations").select("id, product_id, price, quantity").in("product_id", productIds),
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

  // Units requested per stock bucket (a variation, or the product as a whole),
  // so two cart lines for the same item can't each claim the last unit.
  const demand = new Map<string, number>();

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

    // Stock: the chosen option's stock, or (no option chosen) the product's own
    // stock plus all its options — the same rule the storefront uses for "In stock".
    const downloadable = product.product_type === "downloadable";
    const selectedVariation = variation && variation.product_id === product.id ? variation : undefined;
    const bucket = selectedVariation ? `v:${selectedVariation.id}` : `p:${product.id}`;
    const available = selectedVariation
      ? Number(selectedVariation.quantity ?? 0)
      : Number(product.quantity ?? 0) + [...variations.values()]
          .filter((v: any) => v.product_id === product.id)
          .reduce((sum: number, v: any) => sum + Number(v.quantity ?? 0), 0);
    const wanted = (demand.get(bucket) ?? 0) + Number(item.quantity);
    demand.set(bucket, wanted);

    let preorder = false;
    if (!downloadable && wanted > available) {
      // Pre-orders are strictly for XIXLV products on stores an admin enabled (the Marketplace).
      if (product.stores?.allow_preorders && String(product.brand ?? "").toUpperCase() === "XIXLV") {
        preorder = true; // paid now, shipped when restocked
      } else if (available <= 0) {
        return { error: `${product.name} is out of stock.` };
      } else {
        return { error: `Only ${available} of ${product.name} left in stock.` };
      }
    }

    lines.push({
      productId: product.id,
      variationId: selectedVariation?.id ?? null,
      storeId: product.store_id ?? null,
      quantity: Number(item.quantity),
      unitPrice,
      downloadable,
      preorder,
    });
  }

  return { lines };
}

/**
 * Validates a vendor promo code against the priced cart. Codes belong to a
 * store, so a code only discounts that store's lines (and, if the promotion
 * lists products, only those products).
 */
async function applyPromoCode(
  db: SupabaseClient,
  rawCode: string,
  lines: PricedLine[],
): Promise<AppliedPromo | { error: string }> {
  const code = rawCode.trim().toUpperCase();
  if (!code || code.length > MAX_PROMO_CODE_LENGTH) return { error: "That promo code is not valid." };

  const { data: promos, error } = await db
    .from("promotions")
    .select("id, store_id, type, value, min_order_value, usage_limit, usage_count, start_date, end_date, status, products")
    .eq("code", code);
  if (error) {
    console.error("Promo lookup failed:", error);
    return { error: "Could not check that promo code. Please try again." };
  }

  const now = Date.now();
  const live = (promos ?? []).filter((p: any) =>
    p.status === "active" && new Date(p.start_date).getTime() <= now && new Date(p.end_date).getTime() >= now);
  if (!live.length) return { error: "That promo code is not valid or has expired." };

  const applied: AppliedPromo = { code, discount: 0, freeShipping: false, promotionIds: [] };
  let failure = "That promo code doesn't apply to the items in your cart.";

  for (const promo of live as any[]) {
    const productIds: string[] = Array.isArray(promo.products) ? promo.products.map(String) : [];
    const eligible = lines.filter((l) =>
      l.storeId === promo.store_id && (productIds.length === 0 || productIds.includes(l.productId)));
    if (!eligible.length) continue;

    if (promo.usage_limit != null && Number(promo.usage_count ?? 0) >= Number(promo.usage_limit)) {
      failure = "That promo code has reached its usage limit.";
      continue;
    }
    const eligibleSubtotal = eligible.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const minOrder = Number(promo.min_order_value ?? 0);
    if (eligibleSubtotal < minOrder) {
      failure = `Spend at least R${minOrder.toFixed(2)} on the qualifying items to use this code.`;
      continue;
    }

    const value = Number(promo.value) || 0;
    if (promo.type === "free_shipping") {
      applied.freeShipping = true;
    } else if (promo.type === "percentage") {
      applied.discount += eligibleSubtotal * Math.min(Math.max(value, 0), 100) / 100;
    } else {
      applied.discount += Math.min(Math.max(value, 0), eligibleSubtotal);
    }
    applied.promotionIds.push(promo.id);
  }

  if (!applied.promotionIds.length) return { error: failure };
  applied.discount = round2(applied.discount);
  return applied;
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
    // Paid UCoin tiers bill monthly via PayFast recurring billing.
    let isTierSubscription = false;
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
    } else if (paymentData.customStr2 === "service_order") {
      // Priced by service_create_order() from the package; the amount is read from that row in cents.
      const serviceOrderId = String(paymentData.customStr1 || "");
      const { data: serviceOrder } = await supabaseAdmin
        .from("service_orders")
        .select("id, state, order_number, listing_title, gross_amount_minor")
        .eq("id", serviceOrderId)
        .eq("customer_user_id", user.id)
        .maybeSingle();

      if (!serviceOrder) return json({ success: false, error: "Order not found" }, 404);
      if (serviceOrder.state !== "pending_payment") {
        return json({ success: false, error: "This order is not awaiting payment" }, 400);
      }
      amountDue = round2(Number(serviceOrder.gross_amount_minor) / 100);
      mPaymentId = `SVC-${serviceOrder.id}`;
      itemName = `${serviceOrder.order_number} ${serviceOrder.listing_title}`.slice(0, 100);
    } else if (paymentData.customStr2 === "food_order") {
      // The order was priced by place_food_order(); the amount comes from that row, never the client.
      const foodOrderId = String(paymentData.customStr1 || "");
      const { data: foodOrder } = await supabaseAdmin
        .from("food_orders")
        .select("id, status, payment_status, total, eatery:eateries(name, status, accepting_orders)")
        .eq("id", foodOrderId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!foodOrder) return json({ success: false, error: "Order not found" }, 404);
      if (foodOrder.payment_status !== "pending" || foodOrder.status !== "pending_payment") {
        return json({ success: false, error: "This order is not awaiting payment" }, 400);
      }
      const eatery = (foodOrder as any).eatery;
      if (eatery?.status !== "approved" || !eatery?.accepting_orders) {
        return json({ success: false, error: "This eatery is not taking orders right now" }, 400);
      }
      amountDue = round2(Number(foodOrder.total || 0));
      mPaymentId = `FOOD-${foodOrder.id}`;
      itemName = `Food order from ${eatery.name}`.slice(0, 100);
    } else if (paymentData.customStr2 === "tier_subscription") {
      const tierName = String(paymentData.customStr1 || "").toLowerCase();
      const { data: tier } = await supabaseAdmin
        .from("affiliate_tiers")
        .select("id, name, display_name, level, monthly_price")
        .eq("name", tierName)
        .maybeSingle();
      const price = Number((tier as any)?.monthly_price || 0);
      if (!tier || !(price > 0)) {
        return json({ success: false, error: "That tier is not available as a subscription" }, 400);
      }

      // No second subscription at the same or a higher tier.
      const { data: current } = await supabaseAdmin
        .from("uc_tier_subscriptions")
        .select("id, status, current_period_end, tier:affiliate_tiers(level, display_name)")
        .eq("user_id", user.id)
        .in("status", ["active", "cancelled"])
        .gt("current_period_end", new Date().toISOString());
      const higher = (current ?? []).find((s: any) => Number(s.tier?.level) >= Number((tier as any).level) && s.status === "active");
      if (higher) {
        return json({
          success: false,
          error: `You already have the ${(higher as any).tier?.display_name} tier. Cancel it first to change to a lower tier.`,
        }, 400);
      }

      // Reuse an unpaid sign-up for the same tier instead of piling up rows.
      const { data: pending } = await supabaseAdmin
        .from("uc_tier_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("tier_id", (tier as any).id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let subscriptionId = pending?.id as string | undefined;
      if (!subscriptionId) {
        const { data: created, error: createError } = await supabaseAdmin
          .from("uc_tier_subscriptions")
          .insert({ user_id: user.id, tier_id: (tier as any).id, amount: price, status: "pending" })
          .select("id")
          .single();
        if (createError || !created) {
          return json({ success: false, error: "Could not start the subscription" }, 500);
        }
        subscriptionId = created.id;
      }

      amountDue = round2(price);
      mPaymentId = `TIER-${subscriptionId}`;
      itemName = `1145 ${(tier as any).display_name} tier (monthly)`;
      isTierSubscription = true;
    } else {
      // Regular cart checkout.
      const priced = await priceCart(supabaseAdmin, paymentData.cartItems ?? []);
      if ("error" in priced) return json({ success: false, error: priced.error }, 400);

      const subtotal = priced.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
      const baseShipping = await calculateShipping(supabaseAdmin, subtotal, priced.lines.every((l) => l.downloadable));

      // Errors come back as 200 so the checkout page can show the reason.
      let promo: AppliedPromo | null = null;
      if (paymentData.promoCode && String(paymentData.promoCode).trim()) {
        const result = await applyPromoCode(supabaseAdmin, String(paymentData.promoCode), priced.lines);
        if ("error" in result) return json({ success: false, error: result.error });
        promo = result;
      }

      // The promo comes off the subtotal before VAT; shipping bands use the full subtotal.
      const discountedSubtotal = Math.max(subtotal - (promo?.discount ?? 0), 0);
      const shipping = promo?.freeShipping ? 0 : baseShipping;
      const tax = discountedSubtotal * VAT_RATE;
      const total = round2(discountedSubtotal + shipping + tax);
      const promoSavings = promo ? round2(round2(subtotal + baseShipping + subtotal * VAT_RATE) - total) : 0;

      if (paymentData.quoteOnly) {
        return json({
          success: true,
          quote: {
            total,
            promo: promo
              ? { code: promo.code, discount: promo.discount, freeShipping: promo.freeShipping, savings: promoSavings }
              : null,
          },
        });
      }

      const promoFields = {
        promo_code: promo?.code ?? null,
        promo_discount: promoSavings,
        promotion_ids: promo?.promotionIds ?? [],
      };
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
        const { error: reuseError } = await supabaseAdmin.from("orders").update({
          total,
          ...promoFields,
          shipping_address: shippingAddress,
          updated_at: new Date().toISOString(),
        }).eq("id", orderId);
        if (reuseError) {
          // Never carry on with a stale total: the customer would be charged a different amount.
          console.error("Failed to update pending order:", reuseError);
          return json({ success: false, error: "Failed to update your order" }, 500);
        }
        await supabaseAdmin.from("order_items").delete().eq("order_id", orderId);
        console.log(`Reusing existing pending order: ${orderId}`);
      } else {
        const { data: newOrder, error: orderError } = await supabaseAdmin.from("orders").insert({
          user_id: user.id,
          total,
          ...promoFields,
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
          variation_id: line.variationId,
          is_preorder: line.preorder,
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
        await supabaseAdmin.rpc("apply_paid_order_stock", { p_order_id: orderId });

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
        metadata: { ucoin_discount: ucoinDiscount, subtotal, shipping, tax, promo_code: promo?.code ?? null, promo_savings: promoSavings },
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

    // Recurring billing fields come last in PayFast's field order.
    if (isTierSubscription) {
      formData.subscription_type = 1;
      formData.billing_date = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
      formData.recurring_amount = amountDue.toFixed(2);
      formData.frequency = 3; // monthly
      formData.cycles = 0;    // until cancelled
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
