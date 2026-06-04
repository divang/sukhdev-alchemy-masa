import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"

type RazorpayWebhookEvent = {
  event?: string
  payload?: {
    payment?: {
      entity?: {
        id?: string
        order_id?: string
        amount?: number
        currency?: string
        status?: string
        notes?: Record<string, string>
      }
    }
  }
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing required environment variables for razorpay-webhook function.")
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const payload = (await req.json().catch(() => ({}))) as RazorpayWebhookEvent
  const eventType = String(payload.event ?? "")

  if (eventType !== "payment.captured") {
    return jsonResponse({ ok: true, ignored: true, event: eventType })
  }

  const payment = payload.payload?.payment?.entity
  if (!payment?.id || !payment.order_id || !payment.amount || !payment.currency) {
    return jsonResponse({ error: "Invalid payment payload." }, 400)
  }

  const notes = payment.notes ?? {}
  const userId = String(notes.supabase_user_id ?? notes.user_id ?? "").trim()
  const entitlementKey = String(notes.entitlement_key ?? "one_time_basic_access").trim() || "one_time_basic_access"

  if (!userId) {
    return jsonResponse({ error: "Missing supabase_user_id in Razorpay notes." }, 400)
  }

  const serviceClient = createClient(supabaseUrl!, supabaseServiceRoleKey!)

  const { error: paymentError } = await serviceClient
    .from("billing_payments")
    .upsert(
      {
        user_id: userId,
        amount: Number(payment.amount),
        currency: String(payment.currency).toUpperCase(),
        razorpay_order_id: payment.order_id,
        razorpay_payment_id: payment.id,
        status: "paid",
        raw: payload,
      },
      { onConflict: "razorpay_payment_id" }
    )

  if (paymentError) {
    return jsonResponse({ error: `billing_payments upsert failed: ${paymentError.message}` }, 500)
  }

  const { error: entitlementError } = await serviceClient
    .from("access_entitlements")
    .upsert(
      {
        user_id: userId,
        entitlement_key: entitlementKey,
      },
      { onConflict: "user_id,entitlement_key" }
    )

  if (entitlementError) {
    return jsonResponse({ error: `access_entitlements upsert failed: ${entitlementError.message}` }, 500)
  }

  return jsonResponse({ ok: true, granted: entitlementKey, userId })
})
