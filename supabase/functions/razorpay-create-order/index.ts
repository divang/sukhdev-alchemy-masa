import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"

type CreateOrderPayload = {
  amount?: number
  currency?: string
  receipt?: string
  appOrderId?: string
  entitlementKey?: string
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")
const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")

if (!supabaseUrl || !supabaseAnonKey || !razorpayKeyId || !razorpayKeySecret) {
  throw new Error("Missing required environment variables for razorpay-create-order function.")
}

function getAuthToken(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? ""
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return null
  }
  return authHeader.slice(7)
}

async function getAuthenticatedUser(req: Request) {
  const authToken = getAuthToken(req)
  if (!authToken) {
    return { error: "Missing bearer token." }
  }

  const authClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  })

  const { data, error } = await authClient.auth.getUser()
  if (error || !data.user) {
    return { error: error?.message ?? "Authentication failed." }
  }

  return { user: data.user, client: authClient }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const auth = await getAuthenticatedUser(req)
  if (auth.error) {
    return jsonResponse({ error: auth.error }, 401)
  }

  const payload = (await req.json().catch(() => ({}))) as CreateOrderPayload
  const amount = Number(payload.amount)
  const currency = String(payload.currency ?? "INR").trim().toUpperCase()
  const appOrderId = String(payload.appOrderId ?? "").trim()
  const receipt = String(payload.receipt ?? appOrderId ?? "").trim() || `rcpt_${Date.now()}`
  const entitlementKey = String(payload.entitlementKey ?? "one_time_basic_access").trim() || "one_time_basic_access"

  if (!appOrderId) {
    return jsonResponse({ error: "appOrderId is required." }, 400)
  }

  if (!Number.isFinite(amount) || amount < 100) {
    return jsonResponse({ error: "Amount must be at least 100 paise." }, 400)
  }

  const { data: orderRow, error: orderError } = await auth.client
    .from("orders")
    .select("id, total_amount, payment_status")
    .eq("id", appOrderId)
    .eq("user_id", auth.user!.id)
    .maybeSingle()

  if (orderError) {
    return jsonResponse({ error: `Unable to validate order before payment: ${orderError.message}` }, 500)
  }

  if (!orderRow) {
    return jsonResponse({ error: "Order not found for the signed-in user." }, 404)
  }

  if (String(orderRow.payment_status ?? "").toLowerCase() === "paid") {
    return jsonResponse({ error: "Order is already paid." }, 409)
  }

  const expectedAmountPaise = Math.round(Number(orderRow.total_amount ?? 0) * 100)
  if (!Number.isFinite(expectedAmountPaise) || expectedAmountPaise < 100 || expectedAmountPaise !== Math.round(amount)) {
    return jsonResponse({ error: "Amount mismatch for this order." }, 400)
  }

  const gatewayResponse = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      receipt,
      notes: {
        supabase_user_id: auth.user!.id,
        entitlement_key: entitlementKey,
        app_order_id: appOrderId,
      },
    }),
  })

  const gatewayPayload = await gatewayResponse.json().catch(() => ({}))
  if (!gatewayResponse.ok) {
    return jsonResponse(
      {
        error:
          (gatewayPayload as { error?: { description?: string } })?.error?.description ||
          "Failed to create Razorpay order.",
      },
      gatewayResponse.status === 401 || gatewayResponse.status === 403 ? 401 : 500
    )
  }

  return jsonResponse({
    order_id: (gatewayPayload as { id?: string }).id,
    amount: (gatewayPayload as { amount?: number }).amount,
    currency: (gatewayPayload as { currency?: string }).currency,
  })
})
