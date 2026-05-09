import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { user_id, email, password } = await req.json();

  if (!user_id || !email || !password) {
    return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Update auth user
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
    email,
    password,
  });

  if (authError) {
    return new Response(JSON.stringify({ error: authError.message }), { status: 500 });
  }

  // Update profile email
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ email })
    .eq("id", user_id);

  if (profileError) {
    return new Response(JSON.stringify({ error: profileError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
