import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

function response(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

serve(async (req: Request) => {
  // ---------------------------------------------------------
  // CORS
  // ---------------------------------------------------------
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only POST is allowed
  if (req.method !== "POST") {
    return response(
      {
        success: false,
        error: "Method not allowed",
      },
      405,
    );
  }

  try {
    // ---------------------------------------------------------
    // Environment variables
    // ---------------------------------------------------------
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");

      return response(
        {
          success: false,
          error: "Server configuration error",
        },
        500,
      );
    }

    // ---------------------------------------------------------
    // Admin Supabase client
    // ---------------------------------------------------------
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // ---------------------------------------------------------
    // Authenticate requesting user
    // ---------------------------------------------------------
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return response(
        {
          success: false,
          error: "No authorization header",
        },
        401,
      );
    }

    if (!authHeader.startsWith("Bearer ")) {
      return response(
        {
          success: false,
          error: "Invalid authorization header",
        },
        401,
      );
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return response(
        {
          success: false,
          error: "Missing access token",
        },
        401,
      );
    }

    const {
      data: { user: requestingUser },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      console.error("Authentication failed:", authError);

      return response(
        {
          success: false,
          error: "Invalid or expired authentication token",
        },
        401,
      );
    }

    // ---------------------------------------------------------
    // Verify requesting user is an administrator
    // ---------------------------------------------------------
    const { data: roleData, error: roleError } =
      await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", requestingUser.id)
        .eq("role", "admin")
        .maybeSingle();

    if (roleError) {
      console.error("Failed to verify administrator role:", roleError);

      return response(
        {
          success: false,
          error: "Unable to verify administrator privileges",
        },
        500,
      );
    }

    if (!roleData) {
      console.warn(
        `Unauthorized deletion attempt by user ${requestingUser.id}`,
      );

      return response(
        {
          success: false,
          error: "Unauthorized - Admin access required",
        },
        403,
      );
    }

    // ---------------------------------------------------------
    // Parse request body
    // ---------------------------------------------------------
    let body: { userId?: string };

    try {
      body = await req.json();
    } catch {
      return response(
        {
          success: false,
          error: "Invalid JSON request body",
        },
        400,
      );
    }

    const userId = body.userId?.trim();

    if (!userId) {
      return response(
        {
          success: false,
          error: "User ID is required",
        },
        400,
      );
    }

    // Basic UUID validation
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(userId)) {
      return response(
        {
          success: false,
          error: "Invalid user ID format",
        },
        400,
      );
    }

    // ---------------------------------------------------------
    // Prevent administrator self-deletion
    // ---------------------------------------------------------
    if (userId === requestingUser.id) {
      return response(
        {
          success: false,
          error: "Cannot delete your own administrator account",
        },
        400,
      );
    }

    // ---------------------------------------------------------
    // Verify target user exists
    // ---------------------------------------------------------
    const {
      data: targetUser,
      error: targetUserError,
    } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (targetUserError) {
      console.error(
        "Failed to retrieve target user:",
        targetUserError,
      );

      return response(
        {
          success: false,
          error: "Unable to verify target user",
        },
        500,
      );
    }

    if (!targetUser?.user) {
      return response(
        {
          success: false,
          error: "User not found",
        },
        404,
      );
    }

    console.log(
      `Admin ${requestingUser.id} starting deletion for user ${userId}`,
    );

    // ---------------------------------------------------------
    // Helper for safe database deletion
    // ---------------------------------------------------------
    async function deleteByUserId(
      table: string,
      column: string,
    ) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(column, userId);

      if (error) {
        console.error(
          `Failed deleting from ${table}:`,
          error,
        );

        throw new Error(
          `Failed to delete related data from ${table}: ${error.message}`,
        );
      }

      console.log(`Deleted related records from ${table}`);
    }

    // ---------------------------------------------------------
    // Delete application-owned data
    //
    // IMPORTANT:
    // Only include tables here that are safe to delete.
    // Financial/audit records should generally NOT be deleted.
    // ---------------------------------------------------------

    await deleteByUserId("user_roles", "user_id");

    await deleteByUserId("influencer_profiles", "user_id");

    await deleteByUserId(
      "approved_social_accounts",
      "user_id",
    );

    await deleteByUserId(
      "social_media_posts",
      "created_by",
    );

    // ---------------------------------------------------------
    // Delete profile
    // ---------------------------------------------------------
    const {
      error: profileDeleteError,
    } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileDeleteError) {
      console.error(
        "Failed deleting profile:",
        profileDeleteError,
      );

      throw new Error(
        `Failed to delete user profile: ${profileDeleteError.message}`,
      );
    }

    console.log(`Deleted profile for user ${userId}`);

    // ---------------------------------------------------------
    // Finally delete auth.users
    // ---------------------------------------------------------
    const {
      error: authDeleteError,
    } = await supabaseAdmin.auth.admin.deleteUser(
      userId,
    );

    if (authDeleteError) {
      console.error(
        "Failed deleting authentication user:",
        authDeleteError,
      );

      return response(
        {
          success: false,
          error:
            "Application data was removed, but the authentication account could not be deleted",
          details: authDeleteError.message,
          userId,
        },
        500,
      );
    }

    console.log(
      `Successfully deleted auth user ${userId}`,
    );

    // ---------------------------------------------------------
    // Final response
    // ---------------------------------------------------------
    return response({
      success: true,
      message: "User deleted successfully",
      userId,
    });
  } catch (error: unknown) {
    console.error(
      "Unexpected error in delete-user function:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred";

    return response(
      {
        success: false,
        error: message,
      },
      500,
    );
  }
});