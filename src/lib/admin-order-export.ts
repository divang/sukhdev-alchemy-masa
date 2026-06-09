import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export type OrderExportRange = "today" | "week" | "month" | "custom" | "all"
export type OrderExportFormat = "order-summary" | "line-item"

export type OrderExportOptions = {
  range: OrderExportRange
  format: OrderExportFormat
  customStartDate?: string
  customEndDate?: string
}

const viteEnv = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {})
const supabaseUrl = String(viteEnv.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "")
const supabaseAnonKey = String(viteEnv.VITE_SUPABASE_ANON_KEY ?? "").trim()

type OrderRow = {
  id: string
  user_id: string | null
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_address: string
  customer_city: string
  customer_pincode: string
  items?: Array<{
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

type OrderItemRow = {
  order_id: string
  product_id: string | null
  product_name: string
  quantity: number
  pack_grams: number
  unit_price: number
  line_total: number | null
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

type CsvBuildResult = {
  csv: string
  rowCount: number
}

type AdminExportData = {
  error?: string
  orders: OrderRow[]
  itemsByOrder: Map<string, OrderRow["items"]>
  shipmentByOrder: Map<string, ShipmentRow>
  paymentByOrder: Map<string, NormalizedPayment>
  paymentByUser: Map<string, NormalizedPayment>
}

function buildItemsByOrder(rows: OrderItemRow[] | null) {
  const itemsByOrder = new Map<string, OrderRow["items"]>()

  for (const row of rows ?? []) {
    const items = itemsByOrder.get(row.order_id) ?? []
    items.push({
      productName: row.product_name,
      quantity: Number(row.quantity ?? 0),
      grams: Number(row.pack_grams ?? 0),
      pricePerUnit: Number(row.unit_price ?? 0),
    })
    itemsByOrder.set(row.order_id, items)
  }

  return itemsByOrder
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

  const extractFromDescription = (value: unknown) => {
    const text = asString(value)
    if (!text) {
      return undefined
    }

    const match = text.match(/ORD-\d+/i)
    return match?.[0]?.toUpperCase()
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
  const fromEntityNotes = asString(entityNotes?.app_order_id)
  if (fromEntityNotes) {
    return fromEntityNotes
  }

  const fromEntityDescription = extractFromDescription(entity?.description)
  if (fromEntityDescription) {
    return fromEntityDescription
  }

  return extractFromDescription(raw.description)
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

function formatPaymentAmount(amount: number | undefined, currency: string | undefined) {
  if (amount == null) {
    return ""
  }

  const normalizedCurrency = String(currency ?? "").toUpperCase()
  if (normalizedCurrency === "INR") {
    return (Number(amount) / 100).toFixed(2)
  }

  return Number(amount).toFixed(2)
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

function normalizeDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getRangeStart(options: OrderExportOptions) {
  const now = new Date()
  const today = normalizeDateOnly(now)

  if (options.range === "all") {
    return undefined
  }

  if (options.range === "today") {
    return today
  }

  if (options.range === "week") {
    const day = today.getDay()
    const diff = day === 0 ? 6 : day - 1
    const start = new Date(today)
    start.setDate(today.getDate() - diff)
    return start
  }

  if (options.range === "month") {
    return new Date(today.getFullYear(), today.getMonth(), 1)
  }

  if (options.range === "custom" && options.customStartDate) {
    const parsed = new Date(`${options.customStartDate}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }

  return undefined
}

function getRangeEnd(options: OrderExportOptions) {
  if (options.range !== "custom") {
    return undefined
  }

  if (!options.customEndDate) {
    return undefined
  }

  const parsed = new Date(`${options.customEndDate}T23:59:59.999`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function filterOrdersByRange(orders: OrderRow[], options: OrderExportOptions) {
  const start = getRangeStart(options)
  const end = getRangeEnd(options)

  return orders.filter((order) => {
    const createdAt = new Date(order.created_at)
    if (Number.isNaN(createdAt.getTime())) {
      return false
    }

    if (start && createdAt < start) {
      return false
    }

    if (end && createdAt > end) {
      return false
    }

    return true
  })
}

function resolveTrackingId(shipment?: ShipmentRow) {
  return shipment?.awb_code || shipment?.shipment_id || ""
}

function buildOrderSummaryCsv(
  orders: OrderRow[],
  shipmentByOrder: Map<string, ShipmentRow>,
  paymentByOrder: Map<string, NormalizedPayment>,
  paymentByUser: Map<string, NormalizedPayment>,
): CsvBuildResult {
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
      formatPaymentAmount(payment?.amount, payment?.currency),
      payment?.currency ?? "",
      payment?.createdAt ?? "",
      shipment?.provider_key ?? "",
      shipment?.shipment_status ?? "",
      shipment?.shipment_id ?? "",
      shipment?.awb_code ?? "",
      shipment?.tracking_url ?? "",
      resolveTrackingId(shipment),
      shipment?.external_status ?? "",
      shipment?.external_event_at ?? "",
      shipment?.error_message ?? "",
    ]
  })

  return {
    csv: [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n"),
    rowCount: rows.length,
  }
}

function buildLineItemCsv(
  orders: OrderRow[],
  shipmentByOrder: Map<string, ShipmentRow>,
  paymentByOrder: Map<string, NormalizedPayment>,
  paymentByUser: Map<string, NormalizedPayment>,
): CsvBuildResult {
  const headers = [
    "OrderID",
    "OrderCreatedAt",
    "OrderStatus",
    "PaymentStatus",
    "CustomerName",
    "CustomerPhone",
    "CustomerCity",
    "CustomerPincode",
    "ProductName",
    "ProductQuantity",
    "ProductGrams",
    "ProductUnitPrice",
    "LineItemAmount",
    "OrderTotalAmount",
    "RazorpayPaymentID",
    "RazorpayOrderID",
    "PaymentRecordStatus",
    "ShipmentProvider",
    "ShipmentStatus",
    "ShipmentID",
    "ShipmentAWB",
    "ShipmentTrackingURL",
    "ShipmentTrackingID",
  ]

  const rows: string[][] = []

  for (const order of orders) {
    const shipment = shipmentByOrder.get(order.id)
    const payment = paymentByOrder.get(order.id)
      ?? (order.user_id ? paymentByUser.get(order.user_id) : undefined)

    const items = order.items && order.items.length > 0
      ? order.items
      : [{ productName: "", quantity: 0, grams: 0, pricePerUnit: 0 }]

    for (const item of items) {
      const quantity = Number(item.quantity ?? 0)
      const unitPrice = Number(item.pricePerUnit ?? 0)
      const lineAmount = Number((quantity * unitPrice).toFixed(2))

      rows.push([
        order.id,
        order.created_at,
        order.status,
        order.payment_status,
        order.customer_name,
        order.customer_phone,
        order.customer_city,
        order.customer_pincode,
        String(item.productName ?? ""),
        String(quantity),
        String(Number(item.grams ?? 0)),
        unitPrice.toFixed(2),
        lineAmount.toFixed(2),
        Number(order.total_amount ?? 0).toFixed(2),
        payment?.razorpayPaymentId ?? "",
        payment?.razorpayOrderId ?? "",
        payment?.status ?? "",
        shipment?.provider_key ?? "",
        shipment?.shipment_status ?? "",
        shipment?.shipment_id ?? "",
        shipment?.awb_code ?? "",
        shipment?.tracking_url ?? "",
        resolveTrackingId(shipment),
      ])
    }
  }

  return {
    csv: [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n"),
    rowCount: rows.length,
  }
}

function triggerCsvDownload(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function buildExportFileName(prefix: string) {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`
  return `${prefix}-${stamp}.csv`
}

async function fetchAdminExportData() {
  if (!supabase || !isSupabaseConfigured) {
    return {
      error: "Supabase is not configured.",
      orders: [],
      itemsByOrder: new Map<string, OrderRow["items"]>(),
      shipmentByOrder: new Map<string, ShipmentRow>(),
      paymentByOrder: new Map<string, NormalizedPayment>(),
      paymentByUser: new Map<string, NormalizedPayment>(),
    } satisfies AdminExportData
  }

  const [ordersResult, orderItemsResult, shipmentsResult, paymentsResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, user_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_pincode, total_amount, status, payment_status, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("order_items")
      .select("order_id, product_id, product_name, quantity, pack_grams, unit_price, line_total")
      .order("created_at", { ascending: true })
      .limit(20000),
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
    return {
      error: ordersResult.error.message,
      orders: [],
      itemsByOrder: new Map<string, OrderRow["items"]>(),
      shipmentByOrder: new Map<string, ShipmentRow>(),
      paymentByOrder: new Map<string, NormalizedPayment>(),
      paymentByUser: new Map<string, NormalizedPayment>(),
    } satisfies AdminExportData
  }
  if (orderItemsResult.error) {
    return {
      error: orderItemsResult.error.message,
      orders: [],
      itemsByOrder: new Map<string, OrderRow["items"]>(),
      shipmentByOrder: new Map<string, ShipmentRow>(),
      paymentByOrder: new Map<string, NormalizedPayment>(),
      paymentByUser: new Map<string, NormalizedPayment>(),
    } satisfies AdminExportData
  }
  if (shipmentsResult.error) {
    return {
      error: shipmentsResult.error.message,
      orders: [],
      itemsByOrder: new Map<string, OrderRow["items"]>(),
      shipmentByOrder: new Map<string, ShipmentRow>(),
      paymentByOrder: new Map<string, NormalizedPayment>(),
      paymentByUser: new Map<string, NormalizedPayment>(),
    } satisfies AdminExportData
  }
  if (paymentsResult.error) {
    return {
      error: paymentsResult.error.message,
      orders: [],
      itemsByOrder: new Map<string, OrderRow["items"]>(),
      shipmentByOrder: new Map<string, ShipmentRow>(),
      paymentByOrder: new Map<string, NormalizedPayment>(),
      paymentByUser: new Map<string, NormalizedPayment>(),
    } satisfies AdminExportData
  }

  const orders = (ordersResult.data as OrderRow[] | null) ?? []
  const itemsByOrder = buildItemsByOrder((orderItemsResult.data as OrderItemRow[] | null) ?? [])
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

  return {
    orders,
    itemsByOrder,
    shipmentByOrder,
    paymentByOrder,
    paymentByUser,
  } satisfies AdminExportData
}

export async function downloadAdminOrdersCsv(options: OrderExportOptions): Promise<{ success: boolean; error?: string; rowCount?: number }> {
  const result = await fetchAdminExportData()
  if (result.error) {
    return { success: false, error: result.error }
  }

  const filteredOrders = filterOrdersByRange(result.orders, options)
  const normalizedOrders = filteredOrders.map((order) => ({
    ...order,
    items: result.itemsByOrder.get(order.id) ?? [],
  }))

  const csvResult = options.format === "line-item"
    ? buildLineItemCsv(normalizedOrders, result.shipmentByOrder, result.paymentByOrder, result.paymentByUser)
    : buildOrderSummaryCsv(normalizedOrders, result.shipmentByOrder, result.paymentByOrder, result.paymentByUser)

  const prefix = options.format === "line-item"
    ? "sukhdevi-orders-line-items"
    : "sukhdevi-orders-summary"
  triggerCsvDownload(csvResult.csv, buildExportFileName(prefix))

  return { success: true, rowCount: csvResult.rowCount }
}

export async function sendDailySnapshotEmailNow(options: OrderExportOptions): Promise<{
  success: boolean
  error?: string
  recipients?: string[]
  rowCount?: number
  fileName?: string
}> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: "Supabase is not configured." }
  }

  const { data, error } = await supabase.functions.invoke("daily-orders-snapshot", {
    body: options,
  })

  if (!error && data?.ok) {
    return {
      success: true,
      recipients: Array.isArray(data?.recipients) ? data.recipients.map((entry: unknown) => String(entry)) : undefined,
      rowCount: typeof data?.rowCount === "number" ? data.rowCount : undefined,
      fileName: typeof data?.fileName === "string" ? data.fileName : undefined,
    }
  }

  // Fallback to direct HTTP call when functions.invoke transport fails in some browser/network setups.
  if (supabaseUrl && supabaseAnonKey) {
    const sessionResult = await supabase.auth.getSession()
    const accessToken = sessionResult.data.session?.access_token

    if (accessToken) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/daily-orders-snapshot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(options),
        })

        const payload = await response.json().catch(() => ({})) as {
          ok?: boolean
          error?: string
          recipients?: unknown[]
          rowCount?: number
          fileName?: string
        }
        if (response.ok && payload.ok) {
          return {
            success: true,
            recipients: Array.isArray(payload?.recipients) ? payload.recipients.map((entry: unknown) => String(entry)) : undefined,
            rowCount: typeof payload?.rowCount === "number" ? payload.rowCount : undefined,
            fileName: typeof payload?.fileName === "string" ? payload.fileName : undefined,
          }
        }

        return {
          success: false,
          error: String(payload.error ?? `Snapshot email API failed (${response.status}).`),
        }
      } catch (fetchError) {
        return {
          success: false,
          error: fetchError instanceof Error ? fetchError.message : "Failed to send request to snapshot API.",
        }
      }
    }
  }

  if (error) {
    return {
      success: false,
      error: error.message || "Failed to send a request to the Edge Function. Please sign out/in and retry.",
    }
  }

  if (!data?.ok) {
    return { success: false, error: String(data?.error ?? "Failed to send snapshot email.") }
  }

  return { success: false, error: "Failed to send snapshot email." }
}
