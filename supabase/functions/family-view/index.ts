// Supabase Edge Function: family-view
// Location: supabase/functions/family-view/index.ts
// Action: PIN-protected read-only API for family members

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-family-token",
};

// Helper: HMAC SHA256 Sign Token
async function createSignedToken(payload: object, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const header = JSON.stringify({ alg: "HS256", typ: "JWT" });
  const b64Header = btoa(header).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const b64Payload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signatureInput = `${b64Header}.${b64Payload}`;
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(signatureInput));

  const b64Signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signatureInput}.${b64Signature}`;
}

// Helper: Verify Token
async function verifySignedToken(token: string, secret: string): Promise<any> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [b64Header, b64Payload, signature] = parts;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureInput = `${b64Header}.${b64Payload}`;

    // Convert base64url signature back to Uint8Array
    const rawSig = atob(signature.replace(/-/g, "+").replace(/_/g, "/"));
    const sigArray = new Uint8Array(rawSig.length);
    for (let i = 0; i < rawSig.length; i++) {
      sigArray[i] = rawSig.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify("HMAC", cryptoKey, sigArray, encoder.encode(signatureInput));
    if (!isValid) return null;

    const payloadText = atob(b64Payload.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadText);

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }

    return payload;
  } catch (_err) {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const tokenSecret = Deno.env.get("FAMILY_TOKEN_SECRET") ?? "family-secret-fallback-token-key-2026";

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "login";

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // 1. PIN Login Action
    if (action === "login") {
      const pin = body.pin;
      if (!pin) {
        return new Response(
          JSON.stringify({ error: "PIN is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check PIN in family_access
      const { data: familyAccess, error: accessError } = await supabase
        .from("family_access")
        .select("pin_hash, pin_version")
        .eq("id", 1)
        .single();

      if (accessError || !familyAccess) {
        return new Response(
          JSON.stringify({ error: "System configuration error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify PIN using pgcrypto RPC or crypt check
      const { data: isMatch } = await supabase.rpc("verify_family_pin", { p_pin: pin }).catch(() => ({ data: null }));

      // Fallback check if RPC function not defined
      let valid = isMatch === true;
      if (isMatch === null) {
        const { data: dbCheck } = await supabase
          .rpc("check_pin_match", { p_pin: pin })
          .catch(() => ({ data: false }));
        valid = !!dbCheck;
      }

      if (!valid) {
        return new Response(
          JSON.stringify({ error: "Incorrect PIN" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate token valid for 8 hours
      const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
      const token = await createSignedToken(
        { role: "family", pin_version: familyAccess.pin_version, exp },
        tokenSecret
      );

      return new Response(
        JSON.stringify({ token, pin_version: familyAccess.pin_version }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth verification for subsequent read endpoints
    const authHeader = req.headers.get("x-family-token") || req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const decodedToken = await verifySignedToken(authHeader, tokenSecret);
    if (!decodedToken || decodedToken.role !== "family") {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fund Summary Action
    if (action === "summary") {
      const { data: payments } = await supabase.from("payments").select("amount");
      const { data: cases } = await supabase.from("death_cases").select("amount, status");
      const { data: activeMembers } = await supabase.from("members").select("id").eq("status", "active");

      const collected = payments?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) || 0;
      const paidOut = cases?.filter((c: any) => c.status === "paid").reduce((acc: number, c: any) => acc + (c.amount || 0), 0) || 0;
      const balance = collected - paidOut;

      return new Response(
        JSON.stringify({
          collected,
          paid_out: paidOut,
          balance,
          active_members_count: activeMembers?.length || 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Member Directory (No CNIC or Address returned)
    if (action === "members") {
      const { data: members, error } = await supabase
        .from("members")
        .select("id, name, father_name, mobile, join_date, status, opening_balance")
        .order("name", { ascending: true });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ members: members || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Action not supported" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
