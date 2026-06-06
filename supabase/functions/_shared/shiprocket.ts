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

function getShiprocketBaseUrl() {
  const configured = Deno.env.get("SHIPROCKET_API_BASE_URL")
  return (configured && configured.trim()) || "https://apiv2.shiprocket.in/v1/external"
}

async function getShiprocketAuthToken(): Promise<{ token?: string; error?: string }> {
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

  return { token: payload.token }
}

export async function createShiprocketShipment(order: ShiprocketOrderPayload): Promise<ShiprocketShipmentResult> {
  const authResult = await getShiprocketAuthToken()
  if (!authResult.token) {
    return { ok: false, error: authResult.error }
  }

  const pickupLocation = Deno.env.get("SHIPROCKET_PICKUP_LOCATION")?.trim() || "Primary"

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
      billing_state: "Karnataka",
      billing_country: "India",
      billing_email: order.customer.email,
      billing_phone: order.customer.phone,
      shipping_is_billing: true,
      shipping_customer_name: order.customer.name,
      shipping_last_name: "",
      shipping_address: order.customer.address,
      shipping_address_2: "",
      shipping_city: order.customer.city,
      shipping_pincode: order.customer.pincode,
      shipping_country: "India",
      shipping_state: "Karnataka",
      shipping_email: order.customer.email,
      shipping_phone: order.customer.phone,
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
      weight: 0.5,
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