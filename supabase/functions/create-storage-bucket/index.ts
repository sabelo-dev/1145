
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the Admin key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Admin only: verify_jwt is off for this function, so check the caller here.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: callerData } = token
      ? await supabaseClient.auth.getUser(token)
      : { data: { user: null } };
    const caller = callerData?.user;
    const { data: isAdmin } = caller
      ? await supabaseClient.rpc("has_role", { _user_id: caller.id, _role: "admin" })
      : { data: false };
    if (isAdmin !== true) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Create a storage bucket for vendor documents if it doesn't exist
    const { data, error } = await supabaseClient.storage.createBucket(
      "vendor-documents",
      {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: [
          "image/png",
          "image/jpeg",
          "image/jpg",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ]
      }
    );

    if (error && !error.message.includes("already exists")) {
      throw error;
    }

    return new Response(
      JSON.stringify({ message: "Vendor documents bucket created or already exists" }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error creating bucket:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
