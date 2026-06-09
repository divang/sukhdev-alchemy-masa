import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createShiprocketShipment } from "./shiprocket.ts"

type DeliveryPartnerKey = "shiprocket" | "delhivery" | "nimbuspost" | "smartship"

type PaidOrderItem = {
  productName: string
  quantity: number
  grams: number
  pricePerUnit: number
}

type PaidOrder = {
  id: string
  customer: {
    name: string
    email: string
    phone: string
    address: string
    city: string
    pincode: string
  }
  items: PaidOrderItem[]
  totalAmount: number
}

type ShipmentAttemptResult = {
  attempted: boolean
  created: boolean
  provider?: DeliveryPartnerKey
  reason?: string
  shipmentId?: string
  awbCode?: string
  trackingUrl?: string
}

function parsePrefixList(raw: string | undefined) {
  return String(raw ?? "")
    .split(",")
    .map((entry) => entry.trim().replace(/\D/g, ""))
    .filter(Boolean)
}

function shouldSkipShiprocketForSelfDelivery(order: PaidOrder) {
  const enabled = String(Deno.env.get("SHIPROCKET_SKIP_SELF_DELIVERY") ?? "").trim().toLowerCase() === "true"
  if (!enabled) {
    return false
  }

  const prefixes = parsePrefixList(Deno.env.get("SHIPROCKET_SELF_DELIVERY_PIN_PREFIXES"))
  if (!prefixes.length) {
    return false
  }

  const pincodeDigits = String(order.customer.pincode ?? "").replace(/\D/g, "")
  if (!pincodeDigits) {
    return false
  }

  return prefixes.some((prefix) => pincodeDigits.startsWith(prefix))
}

async function isFeatureEnabled(client: SupabaseClient, key: string) {
  const { data, error } = await client
    .from("feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle()

  if (error || !data) {
    return false
  }

  return Boolean((data as { enabled?: boolean }).enabled)
}

async function getActiveDeliveryPartner(client: SupabaseClient): Promise<DeliveryPartnerKey | null> {
  const { data, error } = await client
    .from("delivery_partner_accounts")
    .select("provider_key")
    .eq("enabled", true)
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return String((data as { provider_key?: string }).provider_key ?? "") as DeliveryPartnerKey
}

async function persistShipmentResult(client: SupabaseClient, input: {
  orderId: string
  provider: DeliveryPartnerKey
  status: "created" | "pending" | "skipped" | "failed"
  shipmentId?: string
  awbCode?: string
  trackingUrl?: string
  errorMessage?: string
  rawResponse?: unknown
}) {
  await client.from("order_shipments").insert({
    order_id: input.orderId,
    provider_key: input.provider,
    shipment_status: input.status,
    shipment_id: input.shipmentId,
    awb_code: input.awbCode,
    tracking_url: input.trackingUrl,
    error_message: input.errorMessage,
    raw_response: input.rawResponse,
    updated_at: new Date().toISOString(),
  })
}

async function getExistingCreatedShipment(client: SupabaseClient, orderId: string, provider: DeliveryPartnerKey) {
  const { data, error } = await client
    .from("order_shipments")
    .select("shipment_id, awb_code, tracking_url")
    .eq("order_id", orderId)
    .eq("provider_key", provider)
    .eq("shipment_status", "created")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  const row = data as { shipment_id?: string | null; awb_code?: string | null; tracking_url?: string | null }
  return {
    shipmentId: row.shipment_id ?? undefined,
    awbCode: row.awb_code ?? undefined,
    trackingUrl: row.tracking_url ?? undefined,
  }
}

export async function createShipmentForPaidOrder(client: SupabaseClient, order: PaidOrder): Promise<ShipmentAttemptResult> {
  const featureEnabled = await isFeatureEnabled(client, "enable_shiprocket_integration")
  if (!featureEnabled) {
    return { attempted: false, created: false, reason: "feature_disabled" }
  }

  if (shouldSkipShiprocketForSelfDelivery(order)) {
    await persistShipmentResult(client, {
      orderId: order.id,
      provider: "shiprocket",
      status: "skipped",
      errorMessage: "self_delivery_zone",
    })

    return {
      attempted: false,
      created: false,
      provider: "shiprocket",
      reason: "self_delivery_zone",
    }
  }

  const activeProvider = await getActiveDeliveryPartner(client)
  if (!activeProvider) {
    return { attempted: false, created: false, reason: "no_active_provider" }
  }

  if (activeProvider !== "shiprocket") {
    await persistShipmentResult(client, {
      orderId: order.id,
      provider: activeProvider,
      status: "skipped",
      errorMessage: `Active provider ${activeProvider} adapter not implemented yet.`,
    })
    return {
      attempted: false,
      created: false,
      provider: activeProvider,
      reason: "provider_adapter_missing",
    }
  }

  const existing = await getExistingCreatedShipment(client, order.id, "shiprocket")
  if (existing) {
    return {
      attempted: false,
      created: true,
      provider: "shiprocket",
      reason: "shipment_already_created",
      shipmentId: existing.shipmentId,
      awbCode: existing.awbCode,
      trackingUrl: existing.trackingUrl,
    }
  }

  const shiprocketResult = await createShiprocketShipment(order)

  if (!shiprocketResult.ok) {
    await persistShipmentResult(client, {
      orderId: order.id,
      provider: "shiprocket",
      status: "failed",
      errorMessage: shiprocketResult.error,
      rawResponse: shiprocketResult.rawResponse,
    })
    return {
      attempted: true,
      created: false,
      provider: "shiprocket",
      reason: shiprocketResult.error,
    }
  }

  await persistShipmentResult(client, {
    orderId: order.id,
    provider: "shiprocket",
    status: "created",
    shipmentId: shiprocketResult.shipmentId,
    awbCode: shiprocketResult.awbCode,
    trackingUrl: shiprocketResult.trackingUrl,
    rawResponse: shiprocketResult.rawResponse,
  })

  return {
    attempted: true,
    created: true,
    provider: "shiprocket",
    shipmentId: shiprocketResult.shipmentId,
    awbCode: shiprocketResult.awbCode,
    trackingUrl: shiprocketResult.trackingUrl,
  }
}