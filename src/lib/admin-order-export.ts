import { isSupabaseConfigured, supabase } from "@/lib/supabase"

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
  status: string
  payment_status: string
  created_at: string
  updated_at: string
}

type ShipmentRow = {
  order_id: string
  provider_key: string
  shipment_status: string
  shipment_id: string | null
  awb_code: string | null
  tracking_url: string | null
  external_status: string | null
  external_event_at: string | null
  error_message: string | null
  created_at: string
}

type PaymentRow = {
  user_id: string | null
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  amount: number | null
  currency: string | null
  status: string | null
  created_at: string
  raw: unknown
}

type NormalizedPayment = {
  appOrderId?: string
  userId?: string
  razorpayOrderId?: string
  razorpayPaymentId?: string
  amount?: number
  currency?: string
  status?: string
  createdAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function asString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (typeof value === "number") {
    return String(value)
  }
  return undefined
}

function extractAppOrderId(raw: unknown) {
  if (!isRecord(raw)) {
    return undefined
  }

  const directNotes = isRecord(raw.notes) ? raw.notes : undefined
  const direct = asString(directNotes?.app_order_id)
  if (direct) {
    return direct
  }

  const payload = isRecord(raw.payload) ? raw.payload : undefined
  const payment = payload && isRecord(payload.payment) ? payload.payment : undefined
  const entity = payment && isRecord(payment.entity) ? payment.entity : undefined
  const entityNotes = entity && isRecord(entity.notes) ? entity.notes : undefined
  return asString(entityNotes?.app_order_id)
}

function normalizePaymentRow(row: PaymentRow): NormalizedPayment {
  return {
    appOrderId: extractAppOrderId(row.raw),
    userId: row.user_id ?? undefined,
    razorpayOrderId: row.razorpay_order_id ?? undefined,
    razorpayPaymentId: row.razorpay_payment_id ?? undefined,
    amount: row.amount ?? undefined,
    currency: row.currency ?? undefined,
    status: row.status ?? undefined,
    createdAt: row.created_at,
  }
}

function pickLatestByCreatedAt<T extends { createdAt: string }>(current: T | undefined, candidate: T) {
  if (!current) {
    return candidate
  }

  return new Date(candidate.createdAt).getTime() > new Date(current.createdAt).getTime()
    ? candidate
    : current
}

function csvEscape(value: unknown) {
  const normalized = String(value ?? "")
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`
  }
  return normalized
}

function formatItems(items: OrderRow["items"]) {
  if (!items || items.length === 0) {
    return ""
  }

  return items
    .map((item) => {
      const name = String(item.productName ?? "Item")
      const quantity = Number(item.quantity ?? 0)
      const grams = Number(item.grams ?? 0)
      const perUnit = Number(item.pricePerUnit ?? 0)
      return `${name} | qty:${quantity} | grams:${grams} | unitPrice:${perUnit}`
    })
    .join(" || ")
}

export async function downloadAdminOrdersCsv(): Promise<{ success: boolean; error?: string; rowCount?: number }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: "Supabase is not configured." }
  }

  const [ordersResult, shipmentsResult, paymentsResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, user_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_pincode, items, total_amount, status, payment_status, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("order_shipments")
      .select("order_id, provider_key, shipment_status, shipment_id, awb_code, tracking_url, external_status, external_event_at, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(10000),
    supabase
      .from("billing_payments")
      .select("user_id, razorpay_order_id, razorpay_payment_id, amount, currency, status, created_at, raw")
      .order("created_at", { ascending: false })
      .limit(10000),
  ])

  if (ordersResult.error) {
    return { success: false, error: ordersResult.error.message }
  }
  if (shipmentsResult.error) {
    return { success: false, error: shipmentsResult.error.message }
  }
  if (paymentsResult.error) {
    return { success: false, error: paymentsResult.error.message }
  }

  const orders = (ordersResult.data as OrderRow[] | null) ?? []
  const shipments = (shipmentsResult.data as ShipmentRow[] | null) ?? []
  const payments = ((paymentsResult.data as PaymentRow[] | null) ?? []).map(normalizePaymentRow)

  const shipmentByOrder = new Map<string, ShipmentRow>()
  for (const shipment of shipments) {
    if (!shipmentByOrder.has(shipment.order_id)) {
      shipmentByOrder.set(shipment.order_id, shipment)
    }
  }

  const paymentByOrder = new Map<string, NormalizedPayment>()
  const paymentByUser = new Map<string, NormalizedPayment>()
  for (const payment of payments) {
    if (payment.appOrderId) {
      paymentByOrder.set(
        payment.appOrderId,
        pickLatestByCreatedAt(paymentByOrder.get(payment.appOrderId), payment),
      )
    }

    if (payment.userId) {
      paymentByUser.set(
        payment.userId,
        pickLatestByCreatedAt(paymentByUser.get(payment.userId), payment),
      )
    }
  }

  const headers = [
    "OrderID",
    "OrderCreatedAt",
    "OrderUpdatedAt",
    "OrderStatus",
    "PaymentStatus",
    "CustomerName",
    "CustomerEmail",
    "CustomerPhone",
    "CustomerAddress",
    "CustomerCity",
    "CustomerPincode",
    "ProductsPurchased",
    "OrderTotalAmount",
    "RazorpayPaymentID",
    "RazorpayOrderID",
    "PaymentRecordStatus",
    "PaymentAmount",
    "PaymentCurrency",
    "PaymentCreatedAt",
    "ShipmentProvider",
    "ShipmentStatus",
    "ShipmentID",
    "ShipmentAWB",
    "ShipmentTrackingURL",
    "ShipmentTrackingID",
    "ShipmentExternalStatus",
    "ShipmentExternalEventAt",
    "ShipmentError",
  ]

  const rows = orders.map((order) => {
    const shipment = shipmentByOrder.get(order.id)
    const payment = paymentByOrder.get(order.id)
      ?? (order.user_id ? paymentByUser.get(order.user_id) : undefined)

    const trackingId = shipment?.awb_code || shipment?.shipment_id || ""

    return [
      order.id,
      order.created_at,
      order.updated_at,
      order.status,
      order.payment_status,
      order.customer_name,
      order.customer_email,
      order.customer_phone,
      order.customer_address,
      order.customer_city,
      order.customer_pincode,
      formatItems(order.items),
      Number(order.total_amount ?? 0).toFixed(2),
      payment?.razorpayPaymentId ?? "",
      payment?.razorpayOrderId ?? "",
      payment?.status ?? "",
      payment?.amount != null ? Number(payment.amount).toFixed(2) : "",
      payment?.currency ?? "",
      payment?.createdAt ?? "",
      shipment?.provider_key ?? "",
      shipment?.shipment_status ?? "",
      shipment?.shipment_id ?? "",
      shipment?.awb_code ?? "",
      shipment?.tracking_url ?? "",
      trackingId,
      shipment?.external_status ?? "",
      shipment?.external_event_at ?? "",
      shipment?.error_message ?? "",
    ]
  })

  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`
  const fileName = `sukhdevi-orders-export-${stamp}.csv`

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)

  return { success: true, rowCount: rows.length }
}