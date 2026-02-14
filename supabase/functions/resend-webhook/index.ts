import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Accepted domains for inbound emails
const ACCEPTED_DOMAINS = ["1145lifestyle.com", "mail.1145lifestyle.com"];

interface ResendEmailEvent {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    text?: string;
    html?: string;
    attachments?: Array<{
      filename: string;
      content: string;
      content_type: string;
    }>;
    headers?: Record<string, string>;
    // For inbound emails
    sender?: string;
    recipients?: string[];
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Resend webhook received");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the raw body for signature verification (optional but recommended)
    const body = await req.text();
    const event: ResendEmailEvent = JSON.parse(body);

    console.log("Webhook event type:", event.type);
    console.log("Event data:", JSON.stringify(event.data, null, 2));

    // Handle different event types
    switch (event.type) {
      case "email.received": {
        // Inbound email received
        const { sender, recipients, subject, text, html, attachments } = event.data;
        
        console.log(`Inbound email from: ${sender}`);
        console.log(`To: ${recipients?.join(", ")}`);
        console.log(`Subject: ${subject}`);

        // Verify the email is addressed to our domain
        const isValidRecipient = recipients?.some((r: string) => {
          const recipientLower = r.toLowerCase();
          return ACCEPTED_DOMAINS.some(domain => recipientLower.endsWith(`@${domain}`));
        });

        if (!isValidRecipient) {
          console.log(`Email not addressed to accepted domains, ignoring. Recipients: ${recipients?.join(", ")}`);
          return new Response(
            JSON.stringify({ success: true, message: "Email ignored - wrong domain" }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Store the inbound email in the database
        const { data: insertedEmail, error: insertError } = await supabase
          .from("inbound_emails")
          .insert({
            from_address: sender,
            to_addresses: recipients,
            subject: subject || "(No Subject)",
            body_text: text,
            body_html: html,
            has_attachments: attachments && attachments.length > 0,
            attachment_count: attachments?.length || 0,
            raw_payload: event.data,
            received_at: event.created_at,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error storing inbound email:", insertError);
          // Don't fail the webhook - Resend will retry
        } else {
          console.log("Inbound email stored with ID:", insertedEmail?.id);
        }

        break;
      }

      case "email.sent":
        console.log("Email sent successfully:", event.data.email_id);
        break;

      case "email.delivered":
        console.log("Email delivered:", event.data.email_id);
        break;

      case "email.bounced":
        console.log("Email bounced:", event.data.email_id);
        break;

      case "email.complained":
        console.log("Email marked as spam:", event.data.email_id);
        break;

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(
      JSON.stringify({ success: true, type: event.type }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);
