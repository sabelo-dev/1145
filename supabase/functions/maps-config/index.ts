// Serves the public (referrer-restricted) Google Maps browser key so web and
// native (Capacitor) builds can load Maps without a build-time VITE_ variable.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY") ?? "";

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Google Maps key is not configured" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ apiKey }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
