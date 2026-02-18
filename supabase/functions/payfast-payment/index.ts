import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PayFastPaymentData {
  amount: number;
  itemName: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  customerEmail: string;
  customerFirstName?: string;
  customerLastName?: string;
  customStr1?: string;
  customStr2?: string;
  paymentMethod?: string;
  shippingAddress?: Record<string, any>;
  cartItems?: Array<{ productId: string; quantity: number; price: number; storeId?: string }>;
}

async function md5Hash(input: string): Promise<string> {
  const crypto = await import("node:crypto");
  return crypto.createHash("md5").update(input).digest("hex");
}

function phpUrlencode(str: string): string {
  let encoded = encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/~/g, "%7E")
    .replace(/%20/g, "+");
  return encoded.replace(/%[0-9a-f]{2}/gi, (match) => match.toUpperCase());
}

async function generatePayFastSignature(data: Record<string, any>, passphrase: string): Promise<string> {
  const filteredData: Record<string, any> = {};
  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (key !== "signature" && value !== "" && value !== null && value !== undefined) {
      filteredData[key] = value;
    }
  });

  const paramString = Object.keys(filteredData)
    .map((key) => {
      const value = filteredData[key].toString().trim();
      return `${key}=${phpUrlencode(value)}`;
    })
    .join("&");

  const stringToHash = `${paramString}&passphrase=${phpUrlencode(passphrase)}`;
  console.log("PayFast parameter string (field order):", paramString);
  console.log("Full string to hash:", stringToHash);

  const signature = await md5Hash(stringToHash);
  console.log("Generated signature:", signature);
  return signature;
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentData: PayFastPaymentData = await req.json();

    const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID") || "10000100";
    const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY") || "46f0cd694581a";
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "jt7NOE43FZPn";
    const payfastUrl = "https://www.payfast.co.za/eng/process";

    if (!merchantId || !merchantKey || !passphrase) {
      console.error("PayFast credentials not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Payment gateway not configured properly" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Use admin client to manage orders (bypass RLS for upsert logic)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check for existing pending order for this user — reuse instead of creating duplicate
    let orderId: string | null = null;
    const { data: existingOrder } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("user_id", user.id)
      .eq("payment_status", "pending")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const shippingAddress = paymentData.shippingAddress || {};

    if (existingOrder) {
      // Reuse existing pending order — just update timestamp and totals
      orderId = existingOrder.id;
      await supabaseAdmin.from("orders").update({
        total: paymentData.amount,
        shipping_address: shippingAddress,
        updated_at: new Date().toISOString(),
      }).eq("id", orderId);

      // Replace order items with current cart
      await supabaseAdmin.from("order_items").delete().eq("order_id", orderId);
      console.log(`Reusing existing pending order: ${orderId}`);
    } else {
      // Create new order
      const { data: newOrder, error: orderError } = await supabaseAdmin.from("orders").insert({
        user_id: user.id,
        total: paymentData.amount,
        status: "pending",
        payment_method: "payfast",
        payment_status: "pending",
        shipping_address: shippingAddress,
      }).select("id").single();

      if (orderError || !newOrder) {
        console.error("Failed to create order:", orderError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create order" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      orderId = newOrder.id;
      console.log(`Created new order: ${orderId}`);
    }

    // Insert current cart items into order_items
    if (paymentData.cartItems && paymentData.cartItems.length > 0) {
      const orderItems = paymentData.cartItems.map((item) => ({
        order_id: orderId,
        product_id: item.productId,
        quantity: item.quantity,
        price: item.price,
        store_id: item.storeId || null,
        status: "pending",
        vendor_status: "pending",
      }));
      const { error: itemsError } = await supabaseAdmin.from("order_items").insert(orderItems);
      if (itemsError) {
        console.error("Failed to insert order items:", itemsError);
      }
    }

    // Use order ID as payment reference so ITN can match it
    const mPaymentId = `ORDER-${orderId}`;

    const formData: Record<string, any> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: paymentData.returnUrl,
      cancel_url: paymentData.cancelUrl,
      notify_url: paymentData.notifyUrl,
      name_first: paymentData.customerFirstName || "",
      name_last: paymentData.customerLastName || "",
      email_address: paymentData.customerEmail,
      m_payment_id: mPaymentId,
      amount: paymentData.amount.toFixed(2),
      item_name: paymentData.itemName,
      item_description: paymentData.itemName,
    };

    if (paymentData.customStr1) formData.custom_str1 = paymentData.customStr1;
    if (paymentData.customStr2) formData.custom_str2 = paymentData.customStr2;

    formData.email_confirmation = 1;
    formData.confirmation_address = paymentData.customerEmail;

    if (paymentData.paymentMethod) {
      formData.payment_method = paymentData.paymentMethod;
    }

    const signature = await generatePayFastSignature(formData, passphrase);

    console.log(`Payment initiated by user ${user.id} for amount ${paymentData.amount}, order: ${orderId}`);

    return new Response(
      JSON.stringify({
        success: true,
        formData: { ...formData, signature },
        action: payfastUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("PayFast payment creation failed:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Payment creation failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
