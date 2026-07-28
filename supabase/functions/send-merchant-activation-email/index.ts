import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    // Verify vendor is actually ACTIVE and belongs to caller
    const { data: vendor } = await admin
      .from("vendors")
      .select("id, business_name, business_phone, onboarding_status, user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!vendor || vendor.onboarding_status !== "ACTIVE") {
      return new Response(JSON.stringify({ error: "Vendor not active" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = user.email;
    const storeName = vendor.business_name || "your store";
    const dashboardUrl = "https://1145.io/merchant/dashboard";

    let emailStatus: "sent" | "skipped" | "failed" = "skipped";
    let emailError: string | null = null;
    let smsStatus: "sent" | "skipped" | "failed" = "skipped";
    let smsError: string | null = null;

    // Send confirmation email
    if (RESEND_API_KEY && email) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "1145 Lifestyle <no-reply@send.1145.io>",
            to: [email],
            subject: `🎉 ${storeName} is now live on 1145`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
                <h1 style="color:#000;">Your store is activated</h1>
                <p>Hi there,</p>
                <p>Congratulations — <strong>${storeName}</strong> has completed onboarding and is now live on 1145 Lifestyle.</p>
                <p>You can start listing products, receiving orders, and managing payouts from your merchant dashboard.</p>
                <p style="margin: 24px 0;">
                  <a href="${dashboardUrl}" style="background:#000;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Open Merchant Dashboard</a>
                </p>
                <p style="color:#666;font-size:12px;">If you didn't request this, please contact support@1145.io.</p>
              </div>
            `,
          }),
        });
        if (res.ok) {
          emailStatus = "sent";
        } else {
          emailStatus = "failed";
          emailError = await res.text();
          console.error("Resend error:", emailError);
        }
      } catch (e: any) {
        emailStatus = "failed";
        emailError = e?.message ?? String(e);
      }
    }

    // Optional SMS via GatewayAPI if configured
    const GATEWAYAPI_API_KEY = Deno.env.get("GATEWAYAPI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (GATEWAYAPI_API_KEY && LOVABLE_API_KEY && vendor.business_phone) {
      const digits = String(vendor.business_phone).replace(/\D/g, "");
      if (digits.length >= 10) {
        try {
          const smsRes = await fetch("https://connector-gateway.lovable.dev/gatewayapi/mobile/single", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": GATEWAYAPI_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: "1145",
              recipient: Number(digits),
              message: `${storeName} is now live on 1145. Manage your store: ${dashboardUrl}`,
            }),
          });
          if (smsRes.ok) {
            smsStatus = "sent";
          } else {
            smsStatus = "failed";
            smsError = await smsRes.text();
          }
        } catch (e: any) {
          smsStatus = "failed";
          smsError = e?.message ?? String(e);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      vendorStatus: "ACTIVE",
      email: { status: emailStatus, to: email, error: emailError },
      sms: { status: smsStatus, to: vendor.business_phone ?? null, error: smsError },
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-merchant-activation-email error:", error);
    return new Response(JSON.stringify({ error: error.message ?? "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
