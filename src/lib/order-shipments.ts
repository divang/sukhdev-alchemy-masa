import { isSupabaseConfigured, supabase } from "@/lib/supabase"

type OrderShipmentRow = {
  id: string
  order_id: string
  provider_key: string
  shipment_status: "created" | "pending" | "skipped" | "failed"
  shipment_id: string | null
  awb_code: string | null
  tracking_url: string | null
  error_message: string | null
  external_status: string | null
  external_event_at: string | null
  created_at: string
}

export type LatestOrderShipment = {
  orderId: string
  providerKey: string
  shipmentStatus: "created" | "pending" | "skipped" | "failed"
  shipmentId?: string
  awbCode?: string
  trackingUrl?: string
  errorMessage?: string
  externalStatus?: string
  externalEventAt?: string
  createdAt: string
}

export type AdminOrderShipment = {
  id: string
  orderId: string
  providerKey: string
  shipmentStatus: "created" | "pending" | "skipped" | "failed"
  shipmentId?: string
  awbCode?: string
  trackingUrl?: string
  errorMessage?: string
  externalStatus?: string
  externalEventAt?: string
  createdAt: string
}

const rawApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").trim()
const apiBaseUrl = rawApiBaseUrl.replace(/\/$/, "")

function mapShipmentRow(row: OrderShipmentRow): AdminOrderShipment {
  return {
    id: row.id,
    orderId: row.order_id,
    providerKey: row.provider_key,
    shipmentStatus: row.shipment_status,
    shipmentId: row.shipment_id ?? undefined,
    awbCode: row.awb_code ?? undefined,
    trackingUrl: row.tracking_url ?? undefined,
    errorMessage: row.error_message ?? undefined,
    externalStatus: row.external_status ?? undefined,
    externalEventAt: row.external_event_at ?? undefined,
    createdAt: row.created_at,
  }
}

async function getAuthBearerToken() {
  if (!supabase || !isSupabaseConfigured) {
    return null
  }

  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function resolveApiUrl(path: string) {
  if (apiBaseUrl) {
    const baseWithApi = apiBaseUrl.endsWith("/api") ? apiBaseUrl : `${apiBaseUrl}/api`
    return `${baseWithApi}${path}`
  }

  if (!isSupabaseConfigured) {
    return null
  }

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "")
  if (!supabaseUrl) {
    return null
  }

  return `${supabaseUrl}/functions/v1${path}`
}

export async function fetchOrderShipmentsForAdmin(limit = 30): Promise<{ shipments: AdminOrderShipment[]; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { shipments: [], error: "Supabase is not configured." }
  }

  const { data, error } = await supabase
    .from("order_shipments")
    .select("id, order_id, provider_key, shipment_status, shipment_id, awb_code, tracking_url, error_message, external_status, external_event_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    return { shipments: [], error: error.message }
  }

  return {
    shipments: ((data as OrderShipmentRow[] | null) ?? []).map(mapShipmentRow),
  }
}

export async function fetchLatestShipmentForOrder(orderId: string): Promise<{ shipment?: LatestOrderShipment; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { error: "Supabase is not configured." }
  }

  const { data, error } = await supabase
    .from("order_shipments")
    .select("order_id, provider_key, shipment_status, shipment_id, awb_code, tracking_url, error_message, external_status, external_event_at, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { error: error.message }
  }

  if (!data) {
    return { shipment: undefined }
  }

  const row = data as OrderShipmentRow
  return {
    shipment: {
      orderId: row.order_id,
      providerKey: row.provider_key,
      shipmentStatus: row.shipment_status,
      shipmentId: row.shipment_id ?? undefined,
      awbCode: row.awb_code ?? undefined,
      trackingUrl: row.tracking_url ?? undefined,
      errorMessage: row.error_message ?? undefined,
      externalStatus: row.external_status ?? undefined,
      externalEventAt: row.external_event_at ?? undefined,
      createdAt: row.created_at,
    },
  }
}

export async function triggerShipmentForOrderByAdmin(orderId: string): Promise<{
  success: boolean
  created?: boolean
  provider?: string
  reason?: string
  shipmentId?: string
  awbCode?: string
  trackingUrl?: string
  error?: string
}> {
  const token = await getAuthBearerToken()
  if (!token) {
    return { success: false, error: "Admin session is required." }
  }

  const endpoint = resolveApiUrl("/create-shipment")
  if (!endpoint) {
    return { success: false, error: "Shipment endpoint is not configured." }
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ appOrderId: orderId }),
  })

  const json = await response.json().catch(() => ({})) as {
    created?: boolean
    provider?: string
    reason?: string
    shipmentId?: string
    awbCode?: string
    trackingUrl?: string
    error?: string
  }

  if (!response.ok) {
    return { success: false, error: json.error ?? `Shipment API failed (${response.status})` }
  }

  return {
    success: true,
    created: Boolean(json.created),
    provider: json.provider,
    reason: json.reason,
    shipmentId: json.shipmentId,
    awbCode: json.awbCode,
    trackingUrl: json.trackingUrl,
  }
}
