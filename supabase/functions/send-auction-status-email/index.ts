import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AuctionStatusEmailRequest {
  userEmail: string;
  userName: string;
  productName: string;
  auctionId: string;
  newStatus: string;
  currentBid?: number;
  winningBid?: number;
  startDate?: string;
  endDate?: string;
  isWinnerNotification?: boolean;
}

const getStatusDetails = (status: string, isWinnerNotification?: boolean) => {
  if (isWinnerNotification) {
    return {
      subject: "Congratulations! You Won the Auction!",
      heading: "You're the Winner!",
      message: "Congratulations! You have won this auction. Your registration deposit will be applied to your purchase. Please proceed to complete the payment for the remaining amount.",
      color: "#22c55e",
    };
  }

  switch (status) {
    case "approved":
      return {
        subject: "Your Auction Has Been Approved!",
        heading: "Auction Approved",
        message: "Great news! Your auction has been reviewed and approved by our team. It will go live at the scheduled start date.",
        color: "#22c55e",
      };
    case "active":
      return {
        subject: "Your Auction Is Now Live!",
        heading: "Auction Started",
        message: "Your auction is now live and accepting bids. Good luck!",
        color: "#3b82f6",
      };
    case "ended":
      return {
        subject: "Your Auction Has Ended",
        heading: "Auction Ended",
        message: "Your auction has ended. Check your dashboard for the final results.",
        color: "#6b7280",
      };
    case "sold":
      return {
        subject: "Congratulations! Your Auction Item Sold!",
        heading: "Item Sold",
        message: "Your auction item has been sold! Please proceed with fulfillment.",
        color: "#22c55e",
      };
    case "unsold":
      return {
        subject: "Auction Ended Without a Sale",
        heading: "Auction Unsold",
        message: "Unfortunately, your auction ended without meeting the reserve or receiving bids. You can relist the item if you wish.",
        color: "#ef4444",
      };
    case "rejected":
      return {
        subject: "Auction Submission Update",
        heading: "Auction Not Approved",
        message: "We were unable to approve your auction submission. Please review our guidelines and consider resubmitting.",
        color: "#ef4444",
      };
    default:
      return {
        subject: "Auction Status Update",
        heading: "Status Update",
        message: `Your auction status has been updated to: ${status}`,
        color: "#6b7280",
      };
  }
};

const generateEmailHtml = (
  userName: string,
  productName: string,
  statusDetails: ReturnType<typeof getStatusDetails>,
  currentBid?: number,
  winningBid?: number,
  startDate?: string,
  endDate?: string,
  isWinnerNotification?: boolean
) => {
  const bidInfo = winningBid
    ? `<p style="font-size: 16px; color: #333; margin: 10px 0;"><strong>Winning Bid:</strong> R${winningBid.toLocaleString()}</p>`
    : currentBid
    ? `<p style="font-size: 16px; color: #333; margin: 10px 0;"><strong>Current Bid:</strong> R${currentBid.toLocaleString()}</p>`
    : "";

  const dateInfo = startDate || endDate
    ? `<div style="margin: 15px 0; padding: 10px; background-color: #f9fafb; border-radius: 8px;">
        ${startDate ? `<p style="margin: 5px 0; color: #666;"><strong>Start Date:</strong> ${new Date(startDate).toLocaleDateString()}</p>` : ""}
        ${endDate ? `<p style="margin: 5px 0; color: #666;"><strong>End Date:</strong> ${new Date(endDate).toLocaleDateString()}</p>` : ""}
      </div>`
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, ${statusDetails.color} 0%, ${statusDetails.color}dd 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">${statusDetails.heading}</h1>
      </div>
      
      <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 16px; color: #333;">Hello ${userName || "there"},</p>
        
        <p style="font-size: 16px; color: #333;">${statusDetails.message}</p>
        
        <div style="margin: 20px 0; padding: 20px; background-color: #f3f4f6; border-radius: 8px; border-left: 4px solid ${statusDetails.color};">
          <h3 style="margin: 0 0 10px 0; color: #1f2937;">Product: ${productName}</h3>
          ${bidInfo}
        </div>
        
        ${dateInfo}
        
        <div style="margin-top: 30px; text-align: center;">
          <a href="${Deno.env.get("SITE_URL") || "https://your-site.com"}${isWinnerNotification ? "/dashboard" : "/vendor/dashboard"}" 
             style="display: inline-block; background-color: ${statusDetails.color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            ${isWinnerNotification ? "Complete Purchase" : "View Dashboard"}
          </a>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        
        <p style="font-size: 14px; color: #6b7280; text-align: center;">
          If you have any questions, please contact our support team.
        </p>
      </div>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-auction-status-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      userEmail,
      userName,
      productName,
      auctionId,
      newStatus,
      currentBid,
      winningBid,
      startDate,
      endDate,
      isWinnerNotification,
    }: AuctionStatusEmailRequest = await req.json();

    console.log(`Processing auction status email for auction ${auctionId}, status: ${newStatus}, email: ${userEmail}, isWinner: ${isWinnerNotification}`);

    if (!userEmail) {
      console.error("No email provided");
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const statusDetails = getStatusDetails(newStatus, isWinnerNotification);
    const html = generateEmailHtml(
      userName,
      productName,
      statusDetails,
      currentBid,
      winningBid,
      startDate,
      endDate,
      isWinnerNotification
    );

    const emailResponse = await resend.emails.send({
      from: "Auctions <onboarding@resend.dev>",
      to: [userEmail],
      subject: statusDetails.subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending auction status email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
