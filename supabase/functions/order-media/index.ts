import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const GATEWAY = "https://connector-gateway.lovable.dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const s3Key = Deno.env.get("AWS_S3_API_KEY");
    if (!lovableKey || !s3Key) {
      return json({ error: "Amazon S3 is not connected yet for this project." }, 503);
    }

    const { orderId, mode = "write", fileName, contentType } = await req.json().catch(() => ({}));
    if (!orderId || typeof orderId !== "string") return json({ error: "orderId is required" }, 400);
    if (mode !== "write" && mode !== "read") return json({ error: "mode must be read or write" }, 400);

    const { data: order } = await admin.from("orders").select("id, user_id, status").eq("id", orderId).maybeSingle();
    if (!order) return json({ error: "Order not found" }, 404);

    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: user.id });
    const { data: isDriver } = await admin.rpc("is_driver", { _user_id: user.id });
    if (order.user_id !== user.id && !isAdmin && !isDriver) return json({ error: "Forbidden" }, 403);

    const safeName = String(fileName || `proof-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectPath = `orders/${orderId}/${safeName}`;

    const signRes = await fetch(`${GATEWAY}/api/v1/sign_storage_url?provider=aws_s3&mode=${mode}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": s3Key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ object_path: objectPath }),
    });

    if (!signRes.ok) {
      const details = await signRes.text();
      console.error(`S3 signing failed [${signRes.status}]: ${details}`);
      return json({ error: "Storage request failed", status: signRes.status, details }, signRes.status);
    }

    const signed = await signRes.json();
    const cdn = Deno.env.get("AWS_CLOUDFRONT_DOMAIN");
    const publicUrl = cdn ? `https://${cdn.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/${objectPath}` : null;

    if (mode === "write") {
      await admin.from("order_events").insert({
        order_id: orderId,
        event_type: "media_upload",
        status: order.status,
        title: "Photo attached",
        description: "A photo was attached to this order.",
        metadata: { object_path: objectPath, cdn_url: publicUrl, content_type: contentType || null },
      });
    }

    return json({
      success: true,
      url: signed.url,
      method: signed.method,
      expires_in: signed.expires_in,
      object_path: objectPath,
      cdn_url: publicUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media request failed";
    console.error("order-media error:", message);
    return json({ error: message }, 500);
  }
});
