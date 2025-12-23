import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderStatusEmailRequest {
  orderId: string;
  newStatus: string;
  customerEmail: string;
  customerName?: string;
  trackingNumber?: string;
  courierCompany?: string;
  estimatedDelivery?: string;
  siteUrl?: string;
}

const getStatusDetails = (status: string) => {
  switch (status) {
    case 'shipped':
      return {
        subject: 'Your order has been shipped! 📦',
        heading: 'Your Order is On Its Way!',
        message: 'Great news! Your order has been shipped and is on its way to you.',
        color: '#3b82f6'
      };
    case 'out_for_delivery':
      return {
        subject: 'Your order is out for delivery! 🚚',
        heading: 'Almost There!',
        message: 'Exciting news! Your order is out for delivery and will arrive today.',
        color: '#f59e0b'
      };
    case 'delivered':
      return {
        subject: 'Your order has been delivered! ✅',
        heading: 'Order Delivered!',
        message: 'Your order has been successfully delivered. We hope you love it!',
        color: '#10b981'
      };
    default:
      return {
        subject: `Order status update: ${status}`,
        heading: 'Order Status Update',
        message: `Your order status has been updated to: ${status}`,
        color: '#6b7280'
      };
  }
};

const generateEmailHtml = (
  statusDetails: ReturnType<typeof getStatusDetails>,
  orderId: string,
  customerName: string,
  trackingNumber?: string,
  courierCompany?: string,
  estimatedDelivery?: string,
  siteUrl?: string
) => {
  const trackingUrl = trackingNumber && siteUrl 
    ? `${siteUrl}/track-order?tracking=${encodeURIComponent(trackingNumber)}`
    : null;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, ${statusDetails.color} 0%, ${statusDetails.color}dd 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">${statusDetails.heading}</h1>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hi ${customerName || 'Valued Customer'},</p>
        
        <p style="font-size: 16px; margin-bottom: 20px;">${statusDetails.message}</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Order Details</h3>
          <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderId.slice(0, 8).toUpperCase()}</p>
          ${trackingNumber ? `<p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>` : ''}
          ${courierCompany ? `<p style="margin: 5px 0;"><strong>Courier:</strong> ${courierCompany}</p>` : ''}
          ${estimatedDelivery ? `<p style="margin: 5px 0;"><strong>Estimated Delivery:</strong> ${new Date(estimatedDelivery).toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
        </div>
        
        ${trackingUrl ? `
        <div style="text-align: center; margin: 25px 0;">
          <a href="${trackingUrl}" style="display: inline-block; background: ${statusDetails.color}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Track Your Order
          </a>
        </div>
        <p style="text-align: center; font-size: 12px; color: #6b7280; margin-bottom: 20px;">
          Or copy this link: <a href="${trackingUrl}" style="color: ${statusDetails.color};">${trackingUrl}</a>
        </p>
        ` : ''}
        
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
          Thank you for shopping with us!<br>
          <strong>1145 Lifestyle Team</strong>
        </p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Order status email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      orderId,
      newStatus,
      customerEmail,
      customerName,
      trackingNumber,
      courierCompany,
      estimatedDelivery,
      siteUrl
    }: OrderStatusEmailRequest = await req.json();

    console.log(`Processing email for order ${orderId} with status ${newStatus}`);
    console.log(`Site URL: ${siteUrl}, Tracking Number: ${trackingNumber}`);

    if (!customerEmail) {
      throw new Error("Customer email is required");
    }

    const statusDetails = getStatusDetails(newStatus);

    const html = generateEmailHtml(
      statusDetails,
      orderId,
      customerName || 'Valued Customer',
      trackingNumber,
      courierCompany,
      estimatedDelivery,
      siteUrl || 'https://hipomusjocacncjsvgfa.lovableproject.com'
    );

    const emailResponse = await resend.emails.send({
      from: "1145 Lifestyle <onboarding@resend.dev>",
      to: [customerEmail],
      subject: statusDetails.subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-order-status-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
