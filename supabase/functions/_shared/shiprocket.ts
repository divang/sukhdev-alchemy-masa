type ShiprocketOrderItem = {
  productName: string
  quantity: number
  grams: number
  pricePerUnit: number
}

type ShiprocketOrderPayload = {
  id: string
  customer: {
    name: string
    email: string
    phone: string
    address: string
    city: string
    pincode: string
  }
  items: ShiprocketOrderItem[]
  totalAmount: number
}

type ShiprocketShipmentResult = {
  ok: boolean
  shipmentId?: string
  awbCode?: string
  trackingUrl?: string
  error?: string
  rawResponse?: unknown
}

type ShiprocketTrackingResult = {
  ok: boolean
  shipmentId?: string
  awbCode?: string
  trackingUrl?: string
  externalStatus?: string
  error?: string
  rawResponse?: unknown
}

type ShiprocketTokenCache = {
  token: string
  expiresAtMs: number
}

const TOKEN_TTL_MS = 23 * 60 * 60 * 1000
let tokenCache: ShiprocketTokenCache | null = null

function normalizePhone(raw: string) {
  const digits = String(raw ?? "").replace(/\D/g, "")
  if (digits.length === 10) {
    return digits
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2)
  }

  return digits
}

function resolveShiprocketState() {
  return Deno.env.get("SHIPROCKET_DEFAULT_STATE")?.trim() || "Karnataka"
}

function buildShiprocketValidationError(order: ShiprocketOrderPayload): string | undefined {
  if (!/^[1-9]\d{5}$/.test(order.customer.pincode)) {
    return "Invalid pincode format for Shiprocket payload."
  }

  const phone = normalizePhone(order.customer.phone)
  if (!/^\d{10}$/.test(phone)) {
    return "Invalid phone format for Shiprocket payload. Expected 10-digit mobile number."
  }

  if (!order.items.length) {
    return "Shiprocket payload requires at least one order item."
  }

  for (const item of order.items) {
    if (!item.productName.trim()) {
      return "Shiprocket payload item name is missing."
    }

    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return `Invalid quantity for item ${item.productName}.`
    }

    if (!Number.isFinite(item.grams) || item.grams <= 0) {
      return `Invalid grams value for item ${item.productName}.`
    }
  }

  return undefined
}

function calculateTotalWeightKg(order: ShiprocketOrderPayload) {
  const totalGrams = order.items.reduce((sum, item) => sum + (item.grams * item.quantity), 0)
  const kg = totalGrams / 1000
  return Math.max(0.1, Number(kg.toFixed(3)))
}

function getShiprocketBaseUrl() {
  const configured = Deno.env.get("SHIPROCKET_API_BASE_URL")
  return (configured && configured.trim()) || "https://apiv2.shiprocket.in/v1/external"
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || undefined
  }

  if (typeof value === "number") {
    return String(value)
  }

  return undefined
}

async function getShiprocketAuthToken(): Promise<{ token?: string; error?: string }> {
  if (tokenCache && Date.now() < tokenCache.expiresAtMs) {
    return { token: tokenCache.token }
  }

  const email = Deno.env.get("SHIPROCKET_EMAIL")?.trim()
  const password = Deno.env.get("SHIPROCKET_PASSWORD")?.trim()

  if (!email || !password) {
    return { error: "Missing SHIPROCKET_EMAIL or SHIPROCKET_PASSWORD." }
  }

  const response = await fetch(`${getShiprocketBaseUrl()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  })

  const payload = await response.json().catch(() => ({})) as { token?: string; message?: string }

  if (!response.ok || !payload.token) {
    return {
      error: payload.message || `Shiprocket auth failed (${response.status}).`,
    }
  }

  tokenCache = {
    token: payload.token,
    expiresAtMs: Date.now() + TOKEN_TTL_MS,
  }

  return { token: payload.token }
}

export async function createShiprocketShipment(order: ShiprocketOrderPayload): Promise<ShiprocketShipmentResult> {
  const validationError = buildShiprocketValidationError(order)
  if (validationError) {
    return { ok: false, error: validationError }
  }

  const authResult = await getShiprocketAuthToken()
  if (!authResult.token) {
    return { ok: false, error: authResult.error }
  }

  const pickupLocation = Deno.env.get("SHIPROCKET_PICKUP_LOCATION")?.trim() || "Primary"
  const normalizedPhone = normalizePhone(order.customer.phone)
  const resolvedState = resolveShiprocketState()
  const totalWeightKg = calculateTotalWeightKg(order)

  const response = await fetch(`${getShiprocketBaseUrl()}/orders/create/adhoc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authResult.token}`,
    },
    body: JSON.stringify({
      order_id: order.id,
      order_date: new Date().toISOString().slice(0, 10),
      pickup_location: pickupLocation,
      channel_id: "",
      comment: "Created from Sukhdevi Alchemy payment verification flow",
      billing_customer_name: order.customer.name,
      billing_last_name: "",
      billing_address: order.customer.address,
      billing_address_2: "",
      billing_city: order.customer.city,
      billing_pincode: order.customer.pincode,
      billing_state: resolvedState,
      billing_country: "India",
      billing_email: order.customer.email,
      billing_phone: normalizedPhone,
      shipping_is_billing: true,
      shipping_customer_name: order.customer.name,
      shipping_last_name: "",
      shipping_address: order.customer.address,
      shipping_address_2: "",
      shipping_city: order.customer.city,
      shipping_pincode: order.customer.pincode,
      shipping_country: "India",
      shipping_state: resolvedState,
      shipping_email: order.customer.email,
      shipping_phone: normalizedPhone,
      order_items: order.items.map((item) => ({
        name: item.productName,
        sku: `${order.id}-${item.productName}`,
        units: item.quantity,
        selling_price: Number((item.pricePerUnit * (item.grams / 100)).toFixed(2)),
        discount: "",
        tax: "",
        hsn: "",
      })),
      payment_method: "Prepaid",
      shipping_charges: 0,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: 0,
      sub_total: Number(order.totalAmount.toFixed(2)),
      length: 12,
      breadth: 10,
      height: 8,
      weight: totalWeightKg,
    }),
  })

  const payload = await response.json().catch(() => ({})) as {
    shipment_id?: number | string
    awb_code?: string
    tracking_url?: string
    message?: string
    errors?: unknown
  }

  if (!response.ok) {
    return {
      ok: false,
      error: payload.message || `Shiprocket order creation failed (${response.status}).`,
      rawResponse: payload,
    }
  }

  return {
    ok: true,
    shipmentId: payload.shipment_id != null ? String(payload.shipment_id) : undefined,
    awbCode: payload.awb_code,
    trackingUrl: payload.tracking_url,
    rawResponse: payload,
  }
}

function parseTrackingPayload(payload: unknown): {
  shipmentId?: string
  awbCode?: string
  trackingUrl?: string
  externalStatus?: string
} {
  const root = asRecord(payload)
  const trackingData = asRecord(root.tracking_data)
  const shipmentTrack = asRecord(asArray(trackingData.shipment_track)[0])

  const shipmentId = readString(root.shipment_id) || readString(trackingData.shipment_id)
  const awbCode = readString(shipmentTrack.awb_code)
    || readString(trackingData.awb_code)
    || readString(root.awb_code)

  const trackingUrl = readString(shipmentTrack.tracking_url)
    || readString(shipmentTrack.track_url)
    || readString(trackingData.tracking_url)
    || readString(trackingData.track_url)
    || readString(root.tracking_url)

  const externalStatus = readString(shipmentTrack.current_status)
    || readString(trackingData.shipment_status)
    || readString(root.status)
    || readString(root.message)

  return {
    shipmentId,
    awbCode,
    trackingUrl: trackingUrl || (awbCode ? `https://shiprocket.co/tracking/${encodeURIComponent(awbCode)}` : undefined),
    externalStatus,
  }
}

export async function fetchShiprocketTrackingByShipmentId(shipmentId: string): Promise<ShiprocketTrackingResult> {
  const resolvedShipmentId = String(shipmentId ?? "").trim()
  if (!resolvedShipmentId) {
    return { ok: false, error: "shipmentId is required." }
  }

  const authResult = await getShiprocketAuthToken()
  if (!authResult.token) {
    return { ok: false, error: authResult.error }
  }

  const response = await fetch(`${getShiprocketBaseUrl()}/courier/track/shipment/${encodeURIComponent(resolvedShipmentId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authResult.token}`,
    },
  })

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>

  if (!response.ok) {
    return {
      ok: false,
      error: readString(payload.message) || `Shiprocket tracking fetch failed (${response.status}).`,
      rawResponse: payload,
    }
  }

  const parsed = parseTrackingPayload(payload)
  return {
    ok: true,
    shipmentId: parsed.shipmentId || resolvedShipmentId,
    awbCode: parsed.awbCode,
    trackingUrl: parsed.trackingUrl,
    externalStatus: parsed.externalStatus,
    rawResponse: payload,
  }
}