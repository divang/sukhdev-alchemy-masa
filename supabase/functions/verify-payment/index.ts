import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { sendOrderNotifications } from "../_shared/order-notifications.ts"
import { fetchNormalizedOrderItems, preferNormalizedItems } from "../_shared/order-items.ts"
import { createShipmentForPaidOrder } from "../_shared/shipping.ts"

type VerifyPaymentPayload = {
  appOrderId?: string
  razorpay_order_id?: string
  razorpay_payment_id?: string
  razorpay_signature?: string
}

type OrderRow = {
  id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_address: string
  customer_city: string
  customer_pincode: string
  items: Array<{
    productName?: string
    quantity?: number
    grams?: number
    pricePerUnit?: number
  }> | null
  total_amount: number
  payment_status: string
  status: string
  created_at: string
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")
const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !razorpayKeyId || !razorpayKeySecret) {
  throw new Error("Missing required environment variables for verify-payment function.")
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

  return { user: data.user }
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function signHmacSha256(payload: string, secret: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  )
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  return toHex(signed)
}

function signaturesEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false
  }

  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return mismatch === 0
}

function mapGatewayStatus(status: string) {
  if (status === "captured") {
    return "paid"
  }
  if (status === "failed") {
    return "failed"
  }
  return "created"
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

  const payload = (await req.json().catch(() => ({}))) as VerifyPaymentPayload
  const appOrderId = String(payload.appOrderId ?? "").trim()
  const razorpayOrderId = String(payload.razorpay_order_id ?? "").trim()
  const razorpayPaymentId = String(payload.razorpay_payment_id ?? "").trim()
  const razorpaySignature = String(payload.razorpay_signature ?? "").trim()

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return jsonResponse({ error: "Missing required payment verification fields." }, 400)
  }

  const expected = await signHmacSha256(`${razorpayOrderId}|${razorpayPaymentId}`, razorpayKeySecret!)
  if (!signaturesEqual(expected, razorpaySignature)) {
    return jsonResponse({ verified: false, error: "Signature mismatch." }, 400)
  }

  const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${razorpayPaymentId}`, {
    headers: {
      Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
    },
  })
  const paymentPayload = await paymentResponse.json().catch(() => ({}))

  if (!paymentResponse.ok) {
    return jsonResponse({ error: "Unable to fetch payment details from Razorpay." }, 500)
  }

  const serviceClient = createClient(supabaseUrl!, supabaseServiceRoleKey!)
  const gatewayStatus = mapGatewayStatus(String((paymentPayload as { status?: string }).status ?? ""))
  const amount = Number((paymentPayload as { amount?: number }).amount ?? 0)
  const currency = String((paymentPayload as { currency?: string }).currency ?? "INR").toUpperCase()

  const paymentRecord = {
    order_id: appOrderId || null,
    user_id: auth.user!.id,
    amount,
    currency,
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    status: gatewayStatus,
    raw: paymentPayload,
  }

  const { error: paymentInsertError } = await serviceClient
    .from("billing_payments")
    .upsert(paymentRecord, { onConflict: "razorpay_payment_id" })

  if (paymentInsertError) {
    return jsonResponse({ error: `Unable to persist payment record: ${paymentInsertError.message}` }, 500)
  }

  const isPaid = gatewayStatus === "paid"
  if (isPaid && appOrderId) {
    await serviceClient
      .from("orders")
      .update({
        payment_status: "paid",
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", appOrderId)
      .eq("user_id", auth.user!.id)

    const { data: orderRow, error: orderFetchError } = await serviceClient
      .from("orders")
      .select("id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_pincode, total_amount, payment_status, status, created_at")
      .eq("id", appOrderId)
      .eq("user_id", auth.user!.id)
      .maybeSingle()

    if (!orderFetchError && orderRow) {
      const normalizedItemsByOrder = await fetchNormalizedOrderItems(serviceClient, [orderRow.id])
      const mappedOrder = {
        id: orderRow.id,
        customer: {
          name: orderRow.customer_name,
          email: orderRow.customer_email,
          phone: orderRow.customer_phone,
          address: orderRow.customer_address,
          city: orderRow.customer_city,
          pincode: orderRow.customer_pincode,
        },
        items: preferNormalizedItems(orderRow.id, normalizedItemsByOrder, undefined),
        totalAmount: Number(orderRow.total_amount ?? 0),
        paymentStatus: "paid",
        status: "processing",
        createdAt: orderRow.created_at,
      }

      const notificationResult = await sendOrderNotifications({
        eventType: "payment_verified",
        order: mappedOrder,
        paymentDetails: {
          razorpayOrderId,
          razorpayPaymentId,
          gatewayStatus,
        },
      })

      console.log("[verify-payment] payment_verified-notification-result", {
        appOrderId,
        ok: notificationResult.ok,
        attempted: notificationResult.attempted,
        sent: notificationResult.sent,
        failed: notificationResult.failed,
      })

      if (!notificationResult.ok) {
        console.warn("[verify-payment] payment_verified-notification-failed", {
          appOrderId,
          failedReports: notificationResult.reports
            .filter((entry) => !entry.ok)
            .map((entry) => ({ provider: entry.provider, recipient: entry.recipient, error: entry.error })),
        })
      }

      const shipmentResult = await createShipmentForPaidOrder(serviceClient, {
        id: mappedOrder.id,
        customer: mappedOrder.customer,
        items: mappedOrder.items,
        totalAmount: mappedOrder.totalAmount,
      })

      console.log("[verify-payment] shipment-attempt-result", {
        appOrderId,
        attempted: shipmentResult.attempted,
        created: shipmentResult.created,
        provider: shipmentResult.provider ?? null,
        reason: shipmentResult.reason ?? null,
        shipmentId: shipmentResult.shipmentId ?? null,
        awbCode: shipmentResult.awbCode ?? null,
      })
    }
  }

  return jsonResponse({
    verified: true,
    paymentStatus: isPaid ? "paid" : "pending",
    orderStatus: isPaid ? "processing" : "pending",
    message: isPaid ? "Payment verified successfully." : "Payment is not captured yet.",
  })
})
