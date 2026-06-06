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

export async function createShipmentForPaidOrder(client: SupabaseClient, order: PaidOrder): Promise<ShipmentAttemptResult> {
  const featureEnabled = await isFeatureEnabled(client, "enable_shiprocket_integration")
  if (!featureEnabled) {
    return { attempted: false, created: false, reason: "feature_disabled" }
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