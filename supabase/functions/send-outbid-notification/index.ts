import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OutbidNotificationRequest {
  auctionId: string;
  newBidAmount: number;
  newBidderId: string;
  productName: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Send outbid notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { auctionId, newBidAmount, newBidderId, productName }: OutbidNotificationRequest = await req.json();
    
    console.log(`Processing outbid notification for auction ${auctionId}`);

    // Get previous highest bidder (excluding the new bidder)
    const { data: previousBids, error: bidsError } = await supabase
      .from("auction_bids")
      .select("user_id, bid_amount")
      .eq("auction_id", auctionId)
      .neq("user_id", newBidderId)
      .order("bid_amount", { ascending: false })
      .limit(1);

    if (bidsError) {
      console.error("Error fetching previous bids:", bidsError);
      throw bidsError;
    }

    if (!previousBids || previousBids.length === 0) {
      console.log("No previous bidder to notify");
      return new Response(
        JSON.stringify({ message: "No previous bidder to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const previousBidder = previousBids[0];
    console.log(`Previous highest bidder: ${previousBidder.user_id}`);

    // Get the outbid user's email from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("id", previousBidder.user_id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      throw profileError || new Error("Profile not found");
    }

    console.log(`Sending outbid notification to ${profile.email}`);

    const emailResponse = await resend.emails.send({
      from: "1145 Lifestyle <no-reply@mail.1145lifestyle.com>",
      to: [profile.email],
      subject: `You've been outbid on ${productName}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .bid-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
            .amount { font-size: 24px; font-weight: bold; color: #ef4444; }
            .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You've Been Outbid!</h1>
            </div>
            <div class="content">
              <p>Hi ${profile.name || 'there'},</p>
              <p>Someone has placed a higher bid on the item you were bidding on.</p>
              
              <div class="bid-info">
                <p><strong>Product:</strong> ${productName}</p>
                <p><strong>Your Previous Bid:</strong> R${previousBidder.bid_amount.toFixed(2)}</p>
                <p><strong>New Highest Bid:</strong> <span class="amount">R${newBidAmount.toFixed(2)}</span></p>
              </div>
              
              <p>Don't let this item slip away! Place a higher bid now to stay in the running.</p>
              
              <a href="${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app')}/auctions" class="cta-button">
                Place a New Bid
              </a>
              
              <div class="footer">
                <p>Good luck!</p>
                <p>The 1145 Lifestyle Team</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-outbid-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
