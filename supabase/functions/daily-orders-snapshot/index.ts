// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"

type ExportRange = "today" | "week" | "month" | "custom" | "all"
type ExportFormat = "order-summary" | "line-item"

type ExportOptions = {
  range?: ExportRange
  format?: ExportFormat
  customStartDate?: string
  customEndDate?: string
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

type CsvResult = {
  csv: string
  rowCount: number
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() || ""
const fromEmail = Deno.env.get("ORDER_NOTIFICATION_FROM_EMAIL")?.trim() || ""
const cronToken = Deno.env.get("DAILY_EXPORT_CRON_TOKEN")?.trim() || ""
const recipientsCsv = Deno.env.get("ORDER_SNAPSHOT_RECIPIENTS")?.trim() || Deno.env.get("ORDER_NOTIFICATION_ADMIN_EMAILS")?.trim() || ""

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error("Missing required environment variables for daily-orders-snapshot function.")
}

function normalizeDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getRangeStart(options: ExportOptions) {
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

  if (options.range === "month" || !options.range) {
    return new Date(today.getFullYear(), today.getMonth(), 1)
  }

  if (options.range === "custom" && options.customStartDate) {
    const parsed = new Date(`${options.customStartDate}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }

  return undefined
}

function getRangeEnd(options: ExportOptions) {
  if (options.range !== "custom") {
    return undefined
  }
  if (!options.customEndDate) {
    return undefined
  }

  const parsed = new Date(`${options.customEndDate}T23:59:59.999`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function filterOrdersByRange(orders: OrderRow[], options: ExportOptions) {
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

function resolveTrackingId(shipment?: ShipmentRow) {
  return shipment?.awb_code || shipment?.shipment_id || ""
}

function splitRecipients(raw: string) {
  return raw.split(",").map((entry) => entry.trim()).filter(Boolean)
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("Authorization") || ""
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return ""
  }
  return authHeader.slice(7).trim()
}

async function isAuthorized(req: Request) {
  const inboundCronToken = (req.headers.get("x-cron-token") || "").trim()
  if (cronToken && inboundCronToken && inboundCronToken === cronToken) {
    return true
  }

  const token = getBearerToken(req)
  if (!token) {
    return false
  }

  const authClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const { data: authData, error: authError } = await authClient.auth.getUser()
  if (authError || !authData.user) {
    return false
  }

  const serviceClient = createClient(supabaseUrl!, supabaseServiceRoleKey!)
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle()

  return profile?.role === "admin"
}

function buildSummaryCsv(
  orders: OrderRow[],
  shipmentByOrder: Map<string, ShipmentRow>,
  paymentByOrder: Map<string, NormalizedPayment>,
  paymentByUser: Map<string, NormalizedPayment>,
): CsvResult {
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
      payment?.amount != null ? Number(payment.amount).toFixed(2) : "",
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
): CsvResult {
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

function buildFileName(format: ExportFormat) {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`
  const prefix = format === "line-item" ? "sukhdevi-orders-line-items" : "sukhdevi-orders-summary"
  return `${prefix}-${stamp}.csv`
}

async function sendEmailWithAttachment(recipients: string[], subject: string, csv: string, fileName: string) {
  if (!resendApiKey || !fromEmail || recipients.length === 0) {
    return { ok: false, error: "Email provider or recipients are not configured for snapshot delivery." }
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: recipients,
      subject,
      text: "Attached is the latest Sukhdevi orders snapshot CSV.",
      attachments: [
        {
          filename: fileName,
          content: btoa(csv),
        },
      ],
    }),
  })

  if (!response.ok) {
    const payload = await response.text()
    return { ok: false, error: payload || `Resend API failed (${response.status}).` }
  }

  return { ok: true }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const authorized = await isAuthorized(req)
  if (!authorized) {
    return jsonResponse({ error: "Unauthorized request." }, 401)
  }

  const payload = (await req.json().catch(() => ({}))) as ExportOptions
  const options: ExportOptions = {
    range: payload.range ?? "month",
    format: payload.format ?? "order-summary",
    customStartDate: payload.customStartDate,
    customEndDate: payload.customEndDate,
  }

  const serviceClient = createClient(supabaseUrl!, supabaseServiceRoleKey!)
  const [ordersResult, shipmentsResult, paymentsResult] = await Promise.all([
    serviceClient
      .from("orders")
      .select("id, user_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_pincode, items, total_amount, status, payment_status, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(10000),
    serviceClient
      .from("order_shipments")
      .select("order_id, provider_key, shipment_status, shipment_id, awb_code, tracking_url, external_status, external_event_at, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(20000),
    serviceClient
      .from("billing_payments")
      .select("user_id, razorpay_order_id, razorpay_payment_id, amount, currency, status, created_at, raw")
      .order("created_at", { ascending: false })
      .limit(20000),
  ])

  if (ordersResult.error || shipmentsResult.error || paymentsResult.error) {
    return jsonResponse({
      error: ordersResult.error?.message || shipmentsResult.error?.message || paymentsResult.error?.message || "Failed to fetch export data.",
    }, 500)
  }

  const filteredOrders = filterOrdersByRange((ordersResult.data as OrderRow[] | null) ?? [], options)
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

  const csvResult = options.format === "line-item"
    ? buildLineItemCsv(filteredOrders, shipmentByOrder, paymentByOrder, paymentByUser)
    : buildSummaryCsv(filteredOrders, shipmentByOrder, paymentByOrder, paymentByUser)

  const recipients = splitRecipients(recipientsCsv)
  const fileName = buildFileName(options.format ?? "order-summary")
  const subject = `Sukhdevi Daily Orders Snapshot (${csvResult.rowCount} rows)`
  const emailResult = await sendEmailWithAttachment(recipients, subject, csvResult.csv, fileName)

  if (!emailResult.ok) {
    return jsonResponse({ error: emailResult.error ?? "Failed to send snapshot email." }, 500)
  }

  return jsonResponse({
    ok: true,
    rowCount: csvResult.rowCount,
    fileName,
    recipients,
  })
})
