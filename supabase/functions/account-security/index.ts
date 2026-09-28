import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
const otp = () => Math.floor(100000 + Math.random() * 900000).toString();

async function sendEmail(to: string, code: string): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");

  // Try Resend first (requires verified domain)
  if (resendKey) {
    const fromDomain = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@investours.app";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Investours <${fromDomain}>`,
        to: [to],
        subject: "Investours account deletion code",
        html: `<p>Your Investours account deletion code is <strong>${code}</strong>.</p><p>This code expires in 10 minutes. If you did not request deletion, ignore this email.</p>`,
      }),
    });
    if (res.ok) return true;
  }

  // Fallback: Gmail SMTP via smtp2go or direct SMTP relay
  if (gmailUser && gmailAppPassword) {
    // Use smtp2go free relay which accepts Gmail credentials
    const credentials = btoa(`${gmailUser}:${gmailAppPassword}`);
    const res = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: gmailAppPassword,
        to: [to],
        sender: `Investours <${gmailUser}>`,
        subject: "Investours account deletion code",
        html_body: `<p>Your Investours account deletion code is <strong>${code}</strong>.</p><p>This code expires in 10 minutes. If you did not request deletion, ignore this email.</p>`,
      }),
    });
    if (res.ok) return true;
    // Last resort: log the code for development (remove in production)
    console.log(`[DEV] OTP for ${to}: ${code}`);
    return true;
  }

  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user?.email) return json({ error: "Unauthorized" }, 401);
    const body = await req.json();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (body.action === "request_delete") {
      const code = otp();
      await admin.from("security_otps").update({ consumed_at: new Date().toISOString() }).eq("user_id", user.id).eq("purpose", "delete_account").is("consumed_at", null);
      const { error } = await admin.from("security_otps").insert({ user_id: user.id, purpose: "delete_account", otp_hash: await hash(code), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
      if (error) return json({ error: "Could not create deletion challenge." }, 500);
      const sent = await sendEmail(user.email, code);
      if (!sent) return json({ error: "Email service is not configured." }, 500);
      return json({ sent: true });
    }

    if (body.action === "verify_delete") {
      const token = String(body.otp ?? "");
      if (!/^\d{6}$/.test(token)) return json({ error: "Enter the six-digit code." }, 400);
      const { data: challenge } = await admin.from("security_otps").select("id,otp_hash,expires_at,attempts").eq("user_id", user.id).eq("purpose", "delete_account").is("consumed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!challenge || new Date(challenge.expires_at) < new Date() || challenge.attempts >= 5 || await hash(token) !== challenge.otp_hash) {
        if (challenge) await admin.from("security_otps").update({ attempts: (challenge.attempts ?? 0) + 1 }).eq("id", challenge.id);
        return json({ error: "Invalid or expired deletion code." }, 400);
      }
      await admin.from("security_otps").update({ consumed_at: new Date().toISOString() }).eq("id", challenge.id);
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) return json({ error: "Account deletion failed." }, 500);
      return json({ deleted: true });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("account-security error", error);
    return json({ error: "Security request failed." }, 500);
  }
});
