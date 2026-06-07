import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"

type ShiprocketWebhookPayload = Record<string, unknown>

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const shiprocketWebhookToken = Deno.env.get("SHIPROCKET_WEBHOOK_TOKEN")?.trim() || ""

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing required environment variables for shiprocket-webhook function.")
}

function readString(value: unknown) {
  if (typeof value === "string") {
    return value.trim()
  }
  if (typeof value === "number") {
    return String(value)
  }
  return ""
}

function mapOrderStatusFromShipmentStatus(shipmentStatus: string): "processing" | "shipped" | "delivered" | null {
  const normalized = shipmentStatus.toLowerCase()

  if (normalized.includes("delivered")) {
    return "delivered"
  }

  if (
    normalized.includes("shipped")
    || normalized.includes("in transit")
    || normalized.includes("out for delivery")
    || normalized.includes("ofd")
  ) {
    return "shipped"
  }

  if (
    normalized.includes("manifest")
    || normalized.includes("pickup")
    || normalized.includes("booked")
  ) {
    return "processing"
  }

  return null
}

function resolveWebhookFields(payload: ShiprocketWebhookPayload) {
  const directOrderId = readString(payload.order_id)
  const channelOrderId = readString(payload.channel_order_id)
  const shipmentId = readString(payload.shipment_id)
  const awbCode = readString(payload.awb_code || payload.awb)
  const trackingUrl = readString(payload.tracking_url || payload.tracking_link)
  const shipmentStatus = readString(
    payload.current_status
    || payload.shipment_status
    || payload.status
    || payload.current_status_description
  )

  const eventDateRaw = readString(payload.updated_at || payload.scan_date || payload.event_time)
  const externalEventAt = eventDateRaw ? new Date(eventDateRaw).toISOString() : new Date().toISOString()

  return {
    directOrderId,
    channelOrderId,
    shipmentId,
    awbCode,
    trackingUrl,
    shipmentStatus,
    externalEventAt,
  }
}

async function resolveOrderId(serviceClient: ReturnType<typeof createClient>, fields: ReturnType<typeof resolveWebhookFields>) {
  const candidate = fields.directOrderId || fields.channelOrderId
  if (candidate) {
    const { data } = await serviceClient
      .from("orders")
      .select("id")
      .eq("id", candidate)
      .maybeSingle()

    if (data) {
      return readString((data as { id?: string }).id)
    }
  }

  if (!fields.shipmentId && !fields.awbCode) {
    return ""
  }

  let query = serviceClient
    .from("order_shipments")
    .select("order_id")
    .eq("provider_key", "shiprocket")
    .order("created_at", { ascending: false })
    .limit(1)

  if (fields.shipmentId) {
    query = query.eq("shipment_id", fields.shipmentId)
  }

  if (fields.awbCode) {
    query = query.eq("awb_code", fields.awbCode)
  }

  const { data } = await query.maybeSingle()
  return readString((data as { order_id?: string } | null)?.order_id)
}

function isWebhookAuthorized(req: Request) {
  if (!shiprocketWebhookToken) {
    return true
  }

  const bearerToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim()
  const headerToken = (req.headers.get("x-shiprocket-token") || "").trim()
  const apiKeyToken = (req.headers.get("x-api-key") || "").trim()
  return (
    bearerToken === shiprocketWebhookToken
    || headerToken === shiprocketWebhookToken
    || apiKeyToken === shiprocketWebhookToken
  )
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  if (!isWebhookAuthorized(req)) {
    return jsonResponse({ error: "Webhook authorization failed." }, 401)
  }

  const payload = (await req.json().catch(() => ({}))) as ShiprocketWebhookPayload
  const fields = resolveWebhookFields(payload)
  const serviceClient = createClient(supabaseUrl!, supabaseServiceRoleKey!)

  const orderId = await resolveOrderId(serviceClient, fields)
  if (!orderId) {
    return jsonResponse({ ok: true, ignored: true, reason: "order_not_resolved" })
  }

  const statusLower = fields.shipmentStatus.toLowerCase()
  const shipmentStatus = (
    statusLower.includes("failed")
    || statusLower.includes("cancel")
    || statusLower.includes("rto")
  )
    ? "failed"
    : "pending"

  // Build the tracking URL if AWB is present but tracking URL is not provided
  const trackingUrl = fields.trackingUrl || (fields.awbCode ? `https://shiprocket.co/tracking/${encodeURIComponent(fields.awbCode)}` : null)

  await serviceClient.from("order_shipments").insert({
    order_id: orderId,
    provider_key: "shiprocket",
    shipment_status: shipmentStatus,
    shipment_id: fields.shipmentId || null,
    awb_code: fields.awbCode || null,
    tracking_url: trackingUrl,
    external_status: fields.shipmentStatus || null,
    external_event_at: fields.externalEventAt,
    raw_response: payload,
    updated_at: new Date().toISOString(),
  })

  const nextOrderStatus = mapOrderStatusFromShipmentStatus(fields.shipmentStatus)
  if (nextOrderStatus) {
    await serviceClient
      .from("orders")
      .update({
        status: nextOrderStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
  }

  return jsonResponse({
    ok: true,
    orderId,
    shipmentId: fields.shipmentId || null,
    awbCode: fields.awbCode || null,
    trackingUrl: trackingUrl,
    externalStatus: fields.shipmentStatus || null,
    mappedOrderStatus: nextOrderStatus,
  })
})
