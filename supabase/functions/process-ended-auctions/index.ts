import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessAuctionRequest {
  auctionId?: string; // Process specific auction
  processAll?: boolean; // Process all ended auctions
}

serve(async (req) => {
  console.log("process-ended-auctions function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: ProcessAuctionRequest = await req.json().catch(() => ({}));
    const { auctionId, processAll } = body;

    let auctionsToProcess: any[] = [];

    if (auctionId) {
      // Process specific auction
      const { data: auction, error } = await supabaseAdmin
        .from("auctions")
        .select(`
          *,
          product:products(id, name, store_id, stores(vendor_id, vendors(user_id, business_email)))
        `)
        .eq("id", auctionId)
        .single();

      if (error) throw error;
      if (auction) auctionsToProcess = [auction];
    } else if (processAll) {
      // Find all auctions that have ended but not yet processed
      const { data: auctions, error } = await supabaseAdmin
        .from("auctions")
        .select(`
          *,
          product:products(id, name, store_id, stores(vendor_id, vendors(user_id, business_email)))
        `)
        .in("status", ["approved", "active"])
        .lt("end_date", new Date().toISOString());

      if (error) throw error;
      auctionsToProcess = auctions || [];
    }

    console.log(`Processing ${auctionsToProcess.length} ended auctions`);

    const results = [];

    for (const auction of auctionsToProcess) {
      try {
        console.log(`Processing auction ${auction.id}`);

        // Get highest bid
        const { data: bids } = await supabaseAdmin
          .from("auction_bids")
          .select("*")
          .eq("auction_id", auction.id)
          .order("bid_amount", { ascending: false })
          .limit(1);

        if (bids && bids.length > 0) {
          const winningBid = bids[0];
          console.log(`Winner found: ${winningBid.user_id} with bid R${winningBid.bid_amount}`);

          // Update auction with winner
          await supabaseAdmin
            .from("auctions")
            .update({
              status: "sold",
              winner_id: winningBid.user_id,
              winning_bid: winningBid.bid_amount,
            })
            .eq("id", auction.id);

          // Get winner's registration
          const { data: registration } = await supabaseAdmin
            .from("auction_registrations")
            .select("*")
            .eq("auction_id", auction.id)
            .eq("user_id", winningBid.user_id)
            .single();

          // Mark registration as winner
          await supabaseAdmin
            .from("auction_registrations")
            .update({ is_winner: true })
            .eq("auction_id", auction.id)
            .eq("user_id", winningBid.user_id);

          // Get winner's profile
          const { data: winnerProfile } = await supabaseAdmin
            .from("profiles")
            .select("email, name")
            .eq("id", winningBid.user_id)
            .single();

          // Calculate remaining amount
          const depositAmount = registration?.registration_fee_paid || 0;
          const remainingAmount = winningBid.bid_amount - depositAmount;

          // Send winner notification email
          if (winnerProfile?.email) {
            const siteUrl = Deno.env.get("SITE_URL") || "https://your-site.com";
            const checkoutUrl = `${siteUrl}/auction-checkout?auctionId=${auction.id}`;

            const emailHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
                  <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">You Won the Auction!</p>
                </div>
                
                <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                  <p style="font-size: 16px;">Hello ${winnerProfile.name || "there"},</p>
                  
                  <p style="font-size: 16px;">Great news! You've won the auction for <strong>${auction.product?.name || "this item"}</strong>!</p>
                  
                  <div style="margin: 25px 0; padding: 20px; background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
                    <h3 style="margin: 0 0 15px 0; color: #166534;">Payment Summary</h3>
                    <table style="width: 100%; font-size: 16px;">
                      <tr>
                        <td style="padding: 8px 0; color: #666;">Winning Bid:</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: bold;">R${winningBid.bid_amount.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666;">Your Deposit (Registration Fee):</td>
                        <td style="padding: 8px 0; text-align: right; color: #16a34a;">-R${depositAmount.toLocaleString()}</td>
                      </tr>
                      <tr style="border-top: 2px solid #dcfce7;">
                        <td style="padding: 12px 0; font-weight: bold; font-size: 18px;">Amount Due:</td>
                        <td style="padding: 12px 0; text-align: right; font-weight: bold; font-size: 18px; color: #166534;">R${remainingAmount.toLocaleString()}</td>
                      </tr>
                    </table>
                  </div>
                  
                  <p style="font-size: 14px; color: #666; margin-bottom: 25px;">
                    Please complete your payment within 48 hours to secure your item. Your registration fee has been applied as a deposit.
                  </p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${checkoutUrl}" 
                       style="display: inline-block; background-color: #22c55e; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Complete Payment
                    </a>
                  </div>
                  
                  <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                  
                  <p style="font-size: 14px; color: #6b7280; text-align: center;">
                    Questions? Contact our support team for assistance.
                  </p>
                </div>
              </body>
              </html>
            `;

            try {
              await resend.emails.send({
                from: "Auctions <onboarding@resend.dev>",
                to: [winnerProfile.email],
                subject: `🎉 Congratulations! You won: ${auction.product?.name}`,
                html: emailHtml,
              });
              console.log(`Winner notification email sent to ${winnerProfile.email}`);
            } catch (emailError) {
              console.error("Failed to send winner email:", emailError);
            }
          }

          // Get vendor email and notify them
          const vendorEmail = auction.product?.stores?.vendors?.business_email;
          if (vendorEmail) {
            try {
              await resend.emails.send({
                from: "Auctions <onboarding@resend.dev>",
                to: [vendorEmail],
                subject: `Your auction item sold: ${auction.product?.name}`,
                html: `
                  <h1>Your Auction Item Sold!</h1>
                  <p>Great news! Your auction for <strong>${auction.product?.name}</strong> has ended with a winning bid.</p>
                  <p><strong>Winning Bid:</strong> R${winningBid.bid_amount.toLocaleString()}</p>
                  <p>The buyer has been notified to complete their payment. You'll receive fulfillment instructions once payment is confirmed.</p>
                `,
              });
              console.log(`Vendor notification sent to ${vendorEmail}`);
            } catch (emailError) {
              console.error("Failed to send vendor email:", emailError);
            }
          }

          results.push({
            auctionId: auction.id,
            status: "sold",
            winnerId: winningBid.user_id,
            winningBid: winningBid.bid_amount,
          });
        } else {
          // No bids - mark as unsold
          console.log(`No bids for auction ${auction.id}, marking as unsold`);
          
          await supabaseAdmin
            .from("auctions")
            .update({ status: "unsold" })
            .eq("id", auction.id);

          results.push({
            auctionId: auction.id,
            status: "unsold",
          });
        }
      } catch (auctionError: any) {
        console.error(`Error processing auction ${auction.id}:`, auctionError);
        results.push({
          auctionId: auction.id,
          status: "error",
          error: auctionError.message,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error processing ended auctions:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
