import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Only a signed-in admin may change another account's credentials.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: callerData } = await callerClient.auth.getUser();
  const caller = callerData?.user;
  if (!caller) return json({ error: "Unauthorized" }, 401);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
  if (isAdmin !== true) return json({ error: "Forbidden" }, 403);

  const { user_id, email, password } = await req.json();

  if (!user_id || !email || !password) {
    return json({ error: "Missing fields" }, 400);
  }

  // Update auth user
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
    email,
    password,
  });

  if (authError) {
    return json({ error: authError.message }, 500);
  }

  // Update profile email
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ email })
    .eq("id", user_id);

  if (profileError) {
    return json({ error: profileError.message }, 500);
  }

  console.log(`Admin ${caller.id} updated credentials for user ${user_id}`);

  return json({ success: true });
});
