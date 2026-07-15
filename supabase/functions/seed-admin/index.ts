import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = "admin@1145.io";
  const password = "Lifestyle@1145";
  const name = "TS Mkhatshwa";

  try {
    // Find existing
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let user = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;

    if (user) {
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
        user_metadata: { name, full_name: name },
      });
      if (error) throw error;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, full_name: name },
      });
      if (error) throw error;
      user = data.user;
    }

    if (!user) throw new Error("No user");

    await admin.from("profiles").upsert({
      id: user.id,
      email,
      name,
      role: "admin",
      updated_at: new Date().toISOString(),
    });

    await admin.from("user_roles").upsert(
      { user_id: user.id, role: "admin" },
      { onConflict: "user_id,role" }
    );

    return new Response(JSON.stringify({ success: true, user_id: user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
