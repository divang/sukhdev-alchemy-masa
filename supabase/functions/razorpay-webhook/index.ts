import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { fetchNormalizedOrderItems, preferNormalizedItems } from "../_shared/order-items.ts"
import { createShipmentForPaidOrder } from "../_shared/shipping.ts"

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

type OrderRow = {
  id: string
  user_id: string | null
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
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing required environment variables for razorpay-webhook function.")
}

function normalizeOrderId(rawValue: unknown) {
  const value = String(rawValue ?? "").trim()
  return value.startsWith("ORD-") ? value : ""
}

async function resolveAppOrderIdFromPendingOrder(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  amountPaise: number,
) {
  const amountRupees = Number((amountPaise / 100).toFixed(2))
  const { data, error } = await serviceClient
    .from("orders")
    .select("id, total_amount, payment_status, created_at")
    .eq("user_id", userId)
    .eq("payment_status", "pending")
    .order("created_at", { ascending: false })
    .limit(8)

  if (error || !data) {
    return ""
  }

  const exactMatches = (data as Array<{ id?: string; total_amount?: number }>).filter((row) => {
    const total = Number(row.total_amount ?? 0)
    return Math.abs(total - amountRupees) < 0.01
  })

  if (exactMatches.length !== 1) {
    return ""
  }

  return normalizeOrderId(exactMatches[0].id)
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
  const appOrderIdFromNotes = normalizeOrderId(notes.app_order_id)
  const entitlementKey = String(notes.entitlement_key ?? "one_time_basic_access").trim() || "one_time_basic_access"

  if (!userId) {
    return jsonResponse({ error: "Missing supabase_user_id in Razorpay notes." }, 400)
  }

  const serviceClient = createClient(supabaseUrl!, supabaseServiceRoleKey!)

  let resolvedAppOrderId = appOrderIdFromNotes
  if (!resolvedAppOrderId && userId) {
    resolvedAppOrderId = await resolveAppOrderIdFromPendingOrder(serviceClient, userId, Number(payment.amount ?? 0))
  }

  const { error: paymentError } = await serviceClient
    .from("billing_payments")
    .upsert(
      {
        order_id: resolvedAppOrderId || null,
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

  if (resolvedAppOrderId) {
    const { data: orderRow, error: orderFetchError } = await serviceClient
      .from("orders")
      .select("id, user_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_pincode, items, total_amount, payment_status")
      .eq("id", resolvedAppOrderId)
      .maybeSingle()

    if (!orderFetchError && orderRow) {
      const normalizedItemsByOrder = await fetchNormalizedOrderItems(serviceClient, [orderRow.id])
      if (orderRow.payment_status !== "paid") {
        await serviceClient
          .from("orders")
          .update({
            payment_status: "paid",
            status: "processing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", resolvedAppOrderId)
      }

      const shipmentResult = await createShipmentForPaidOrder(serviceClient, {
        id: orderRow.id,
        customer: {
          name: orderRow.customer_name,
          email: orderRow.customer_email,
          phone: orderRow.customer_phone,
          address: orderRow.customer_address,
          city: orderRow.customer_city,
          pincode: orderRow.customer_pincode,
        },
        items: preferNormalizedItems(orderRow.id, normalizedItemsByOrder, (orderRow as OrderRow).items),
        totalAmount: Number(orderRow.total_amount ?? 0),
      })

      console.log("[razorpay-webhook] order-reconciled", {
        appOrderId: resolvedAppOrderId,
        shipmentAttempted: shipmentResult.attempted,
        shipmentCreated: shipmentResult.created,
        shipmentReason: shipmentResult.reason ?? null,
      })
    }
  }

  return jsonResponse({
    ok: true,
    granted: entitlementKey,
    userId,
    appOrderId: resolvedAppOrderId || null,
  })
})
