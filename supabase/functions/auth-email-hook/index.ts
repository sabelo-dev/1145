import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AuthEmailRequest {
  user: {
    email: string;
    user_metadata?: {
      name?: string;
      full_name?: string;
    };
  };
  email_data: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    confirmation_url?: string;
    email_action_type: string;
  };
}

const getEmailTemplate = (
  actionType: string,
  userName: string,
  actionUrl: string
): { subject: string; html: string } => {
  const templates: Record<string, { subject: string; html: string }> = {
    signup: {
      subject: "Confirm your 1145 Lifestyle account",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #1a365d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to 1145 Lifestyle!</h1>
            </div>
            <div class="content">
              <p>Hi ${userName},</p>
              <p>Thank you for signing up! Please confirm your email address to get started.</p>
              <p style="text-align: center;">
                <a href="${actionUrl}" class="button" style="color: white;">Confirm Email</a>
              </p>
              <p>If you didn't create an account, you can safely ignore this email.</p>
              <p>Best regards,<br>The 1145 Lifestyle Team</p>
            </div>
            <div class="footer">
              <p>© 2024 1145 Lifestyle. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    },
    recovery: {
      subject: "Reset your 1145 Lifestyle password",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #1a365d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hi ${userName},</p>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              <p style="text-align: center;">
                <a href="${actionUrl}" class="button" style="color: white;">Reset Password</a>
              </p>
              <p>This link will expire in 24 hours.</p>
              <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
              <p>Best regards,<br>The 1145 Lifestyle Team</p>
            </div>
            <div class="footer">
              <p>© 2024 1145 Lifestyle. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    },
    magiclink: {
      subject: "Your 1145 Lifestyle login link",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #1a365d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Magic Login Link</h1>
            </div>
            <div class="content">
              <p>Hi ${userName},</p>
              <p>Click the button below to log in to your account:</p>
              <p style="text-align: center;">
                <a href="${actionUrl}" class="button" style="color: white;">Log In</a>
              </p>
              <p>This link will expire in 1 hour.</p>
              <p>If you didn't request this link, you can safely ignore this email.</p>
              <p>Best regards,<br>The 1145 Lifestyle Team</p>
            </div>
            <div class="footer">
              <p>© 2024 1145 Lifestyle. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    },
    email_change: {
      subject: "Confirm your new email address",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #1a365d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Confirm Email Change</h1>
            </div>
            <div class="content">
              <p>Hi ${userName},</p>
              <p>Please confirm your new email address by clicking the button below:</p>
              <p style="text-align: center;">
                <a href="${actionUrl}" class="button" style="color: white;">Confirm Email</a>
              </p>
              <p>If you didn't request this change, please contact support immediately.</p>
              <p>Best regards,<br>The 1145 Lifestyle Team</p>
            </div>
            <div class="footer">
              <p>© 2024 1145 Lifestyle. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    },
    invite: {
      subject: "You're invited to join 1145 Lifestyle",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #1a365d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You're Invited!</h1>
            </div>
            <div class="content">
              <p>Hi ${userName},</p>
              <p>You've been invited to join 1145 Lifestyle! Click the button below to accept your invitation:</p>
              <p style="text-align: center;">
                <a href="${actionUrl}" class="button" style="color: white;">Accept Invitation</a>
              </p>
              <p>Best regards,<br>The 1145 Lifestyle Team</p>
            </div>
            <div class="footer">
              <p>© 2024 1145 Lifestyle. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    },
  };

  return templates[actionType] || templates.signup;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: AuthEmailRequest = await req.json();
    console.log("Auth email hook received:", JSON.stringify(payload, null, 2));

    const { user, email_data } = payload;
    const userName =
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email.split("@")[0];

    // Build the action URL
    const actionUrl = email_data.confirmation_url || "";

    const { subject, html } = getEmailTemplate(
      email_data.email_action_type,
      userName,
      actionUrl
    );

    console.log(`Sending ${email_data.email_action_type} email to ${user.email}`);

    const emailResponse = await resend.emails.send({
      from: "1145 Lifestyle <no-reply@mail.1145lifestyle.com>",
      to: [user.email],
      subject: subject,
      html: html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in auth-email-hook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
