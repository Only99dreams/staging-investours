import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { email, amount, reference, metadata = {}, callback_url } = body;
    if (!email || !amount || !reference) return json({ error: "email, amount, and reference are required" }, 400);
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secret) return json({ error: "Paystack is not configured" }, 500);
    const response = await fetch("https://api.paystack.co/transaction/initialize", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, amount, reference, currency: "NGN", metadata, callback_url }) });
    const data = await response.json();
    if (!response.ok || data.status !== true) return json({ error: data.message ?? "Paystack initialization failed" }, 502);
    return json({ authorization_url: data.data.authorization_url, access_code: data.data.access_code, reference: data.data.reference });
  } catch (error) {
    console.error("paystack-initialize error", error);
    return json({ error: "Payment initialization failed" }, 500);
  }
});
