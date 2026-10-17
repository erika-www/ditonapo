// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashDeviceKey(key: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key.trim()));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: "Direction command service is not configured." }, 500);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (req.method === "GET") {
      const deviceKey = req.headers.get("x-device-key");
      if (!deviceKey) return json({ error: "Missing x-device-key header." }, 401);

      const { data: device, error: deviceError } = await serviceClient
        .from("device_keys")
        .select("bus_id,revoked_at")
        .eq("key_hash", await hashDeviceKey(deviceKey))
        .maybeSingle();
      if (deviceError || !device) return json({ error: "Invalid device key." }, 401);
      if (device.revoked_at) return json({ error: "Device key has been revoked." }, 403);

      const url = new URL(req.url);
      const hasCursor = url.searchParams.has("after_id");
      const afterId = Number(url.searchParams.get("after_id") || 0);
      if (!Number.isSafeInteger(afterId) || afterId < 0) return json({ error: "Invalid after_id." }, 400);

      let query = serviceClient.from("bus_direction_commands")
        .select("id,direction,issued_at")
        .eq("bus_id", device.bus_id);
      query = hasCursor
        ? query.gt("id", afterId).order("id", { ascending: true }).limit(50)
        : query.order("id", { ascending: false }).limit(1);
      const { data: commands, error } = await query;
      if (error) throw error;

      const orderedCommands = hasCursor ? commands || [] : [...(commands || [])].reverse();
      return json({
        success: true,
        commands: orderedCommands,
        next_after_id: orderedCommands.at(-1)?.id ?? afterId,
      });
    }

    if (req.method !== "POST") return json({ error: "Use GET to poll or POST to send a direction." }, 405);

    const authorization = req.headers.get("authorization") || "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    if (!accessToken) return json({ error: "Admin authentication is required." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser(accessToken);
    if (authError || !user) return json({ error: "Admin authentication is invalid." }, 401);

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("role,is_active")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== "admin" || !profile.is_active) {
      return json({ error: "An active admin profile is required." }, 403);
    }

    const body = await req.json();
    const busId = String(body.bus_id || "");
    const direction = body.direction;
    if (!/^[0-9a-f-]{36}$/i.test(busId) || !["Northbound", "Southbound"].includes(direction)) {
      return json({ error: "Provide a valid bus_id and Northbound or Southbound direction." }, 400);
    }

    const { data: command, error } = await serviceClient
      .from("bus_direction_commands")
      .insert({ bus_id: busId, direction })
      .select("id,bus_id,direction,issued_at")
      .single();
    if (error) throw error;

    return json({ success: true, command });
  } catch (error) {
    console.error("Bus direction request failed:", error);
    return json({ error: "Could not process bus direction request." }, 500);
  }
});