import type { Order } from "@/lib/types"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { isGoogleSheetsConfigured, postToGoogleSheets } from "@/lib/google-sheets"
import { validateIndianShippingAddress } from "@/lib/validation"

const allowClientOrderUpdates = import.meta.env.VITE_ALLOW_CLIENT_ORDER_UPDATES === "true"

type PersistenceResult = {
  persisted: boolean
  reason?: "not-configured" | "error"
  provider?: "google-sheets" | "supabase"
  error?: string
}

type OrdersLoadResult = {
  orders: Order[]
  error?: string
}

type CreateOrderV2RpcRow = {
  order_id: string
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
  subtotal_amount?: number | null
  shipping_amount?: number | null
  discount_amount?: number | null
  promo_code?: string | null
  total_amount: number
  status: Order["status"]
  payment_status: Order["paymentStatus"]
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
}

type GoogleSheetsSyncPayload = {
  action: "create_order" | "update_payment" | "update_status"
  order?: Order
  orderId?: string
  paymentStatus?: Order["paymentStatus"]
  status?: Order["status"]
  updatedAt?: string
}

function assertClient() {
  if (!supabase || !isSupabaseConfigured) {
    return null
  }
  return supabase
}

function syncToGoogleSheetsInBackground(action: GoogleSheetsSyncPayload["action"], payload: Omit<GoogleSheetsSyncPayload, "action">) {
  if (!isGoogleSheetsConfigured) {
    return
  }

  void postToGoogleSheets({ action, ...payload }).catch((error) => {
    console.warn(`[order-sync] Google Sheets ${action} sync failed`, error)
  })
}

async function getSignedInUserId() {
  const client = assertClient()
  if (!client) {
    return { userId: null as string | null, error: "Supabase is not configured." }
  }

  const { data: sessionData } = await client.auth.getSession()
  if (sessionData.session?.user?.id) {
    return { userId: sessionData.session.user.id, error: undefined }
  }

  const { data: userData, error: userError } = await client.auth.getUser()
  return {
    userId: userData.user?.id ?? null,
    error: userError?.message,
  }
}

function mapOrderRow(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id,
    items: [],
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
      address: row.customer_address,
      city: row.customer_city,
      pincode: row.customer_pincode,
    },
    subtotalAmount: row.subtotal_amount != null ? Number(row.subtotal_amount) : undefined,
    shippingAmount: row.shipping_amount != null ? Number(row.shipping_amount) : undefined,
    discountAmount: row.discount_amount != null ? Number(row.discount_amount) : undefined,
    promoCode: row.promo_code ?? undefined,
    totalAmount: Number(row.total_amount),
    status: row.status,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function buildOrderItemsMap(rows: OrderItemRow[] | null) {
  const itemsByOrder = new Map<string, Order["items"]>()

  for (const row of rows ?? []) {
    const existing = itemsByOrder.get(row.order_id) ?? []
    existing.push({
      productId: row.product_id ?? "",
      productName: row.product_name,
      quantity: Number(row.quantity ?? 0),
      grams: Number(row.pack_grams ?? 0),
      pricePerUnit: Number(row.unit_price ?? 0),
    })
    itemsByOrder.set(row.order_id, existing)
  }

  return itemsByOrder
}

function hydrateOrdersWithNormalizedItems(orderRows: OrderRow[] | null, orderItemRows: OrderItemRow[] | null) {
  const itemsByOrder = buildOrderItemsMap(orderItemRows)

  return (orderRows ?? []).map((row) => {
    const mapped = mapOrderRow(row)
    const normalizedItems = itemsByOrder.get(row.id)
    if (normalizedItems && normalizedItems.length > 0) {
      mapped.items = normalizedItems
    }
    return mapped
  })
}

export async function persistOrderToSupabase(order: Order): Promise<PersistenceResult> {
  const shippingValidationError = validateIndianShippingAddress({
    address: order.customer.address,
    city: order.customer.city,
    pincode: order.customer.pincode,
    country: order.customer.country ?? "India",
  })

  if (shippingValidationError) {
    return {
      persisted: false,
      reason: "error",
      error: shippingValidationError,
    }
  }

  const client = assertClient()
  if (!client) {
    if (isGoogleSheetsConfigured) {
      try {
        await postToGoogleSheets({ action: "create_order", order })
        return { persisted: true, provider: "google-sheets" }
      } catch (error) {
        return {
          persisted: false,
          reason: "error",
          provider: "google-sheets",
          error: error instanceof Error ? error.message : "Google Sheets order sync failed",
        }
      }
    }

    return { persisted: false, reason: "not-configured" }
  }

  const payload = {
    id: order.id,
    customer: {
      name: order.customer.name,
      email: order.customer.email,
      phone: order.customer.phone,
      address: order.customer.address,
      city: order.customer.city,
      pincode: order.customer.pincode,
      country: order.customer.country ?? "India",
    },
    items: order.items,
    subtotalAmount: order.subtotalAmount ?? 0,
    shippingAmount: order.shippingAmount ?? 0,
    discountAmount: order.discountAmount ?? 0,
    promoCode: order.promoCode ?? null,
    totalAmount: order.totalAmount,
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }

  const rpcResult = await client.rpc("create_order_v2", { p_payload: payload })
  if (!rpcResult.error) {
    if (isGoogleSheetsConfigured) {
      syncToGoogleSheetsInBackground("create_order", { order })
    }
    return { persisted: true, provider: "supabase" }
  }

  if (isGoogleSheetsConfigured) {
    try {
      await postToGoogleSheets({ action: "create_order", order })
      return { persisted: true, provider: "google-sheets" }
    } catch (error) {
      return {
        persisted: false,
        reason: "error",
        provider: "google-sheets",
        error: error instanceof Error ? error.message : "Google Sheets order sync failed",
      }
    }
  }

  return {
    persisted: false,
    reason: "error",
    error: rpcResult.error?.message ?? "Failed to create order with V2 write path.",
  }
}

export async function fetchOrdersForCurrentUser(): Promise<OrdersLoadResult> {
  const client = assertClient()
  if (!client) {
    return { orders: [], error: "Supabase is not configured." }
  }

  const { userId, error: userError } = await getSignedInUserId()
  if (!userId) {
    return { orders: [], error: userError ?? "No signed-in user found." }
  }

  const [ordersResult, itemsResult] = await Promise.all([
    client
      .from("orders")
      .select("id, user_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_pincode, subtotal_amount, shipping_amount, discount_amount, promo_code, total_amount, status, payment_status, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    client
      .from("order_items")
      .select("order_id, product_id, product_name, quantity, pack_grams, unit_price")
      .order("created_at", { ascending: true }),
  ])

  if (ordersResult.error) {
    return { orders: [], error: ordersResult.error.message }
  }

  if (itemsResult.error) {
    return {
      orders: ((ordersResult.data as OrderRow[] | null) ?? []).map(mapOrderRow),
      error: itemsResult.error.message,
    }
  }

  const userOrderIds = new Set(((ordersResult.data as OrderRow[] | null) ?? []).map((row) => row.id))
  const normalizedRows = ((itemsResult.data as OrderItemRow[] | null) ?? []).filter((row) => userOrderIds.has(row.order_id))

  return {
    orders: hydrateOrdersWithNormalizedItems(ordersResult.data as OrderRow[] | null, normalizedRows),
  }
}

export async function fetchOrdersForAdmin(): Promise<OrdersLoadResult> {
  const client = assertClient()
  if (!client) {
    return { orders: [], error: "Supabase is not configured." }
  }

  const [ordersResult, itemsResult] = await Promise.all([
    client
      .from("orders")
      .select("id, user_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_pincode, subtotal_amount, shipping_amount, discount_amount, promo_code, total_amount, status, payment_status, created_at, updated_at")
      .order("created_at", { ascending: false }),
    client
      .from("order_items")
      .select("order_id, product_id, product_name, quantity, pack_grams, unit_price")
      .order("created_at", { ascending: true }),
  ])

  if (ordersResult.error) {
    return { orders: [], error: ordersResult.error.message }
  }

  if (itemsResult.error) {
    return {
      orders: ((ordersResult.data as OrderRow[] | null) ?? []).map(mapOrderRow),
      error: itemsResult.error.message,
    }
  }

  const userOrderIds = new Set(((ordersResult.data as OrderRow[] | null) ?? []).map((row) => row.id))
  const normalizedRows = ((itemsResult.data as OrderItemRow[] | null) ?? []).filter((row) => userOrderIds.has(row.order_id))

  return {
    orders: hydrateOrdersWithNormalizedItems(ordersResult.data as OrderRow[] | null, normalizedRows),
  }
}

export async function fetchOrdersForUser(userId: string): Promise<OrdersLoadResult> {
  const client = assertClient()
  if (!client) {
    return { orders: [], error: "Supabase is not configured." }
  }

  const [ordersResult, itemsResult] = await Promise.all([
    client
      .from("orders")
      .select("id, user_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_pincode, subtotal_amount, shipping_amount, discount_amount, promo_code, total_amount, status, payment_status, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    client
      .from("order_items")
      .select("order_id, product_id, product_name, quantity, pack_grams, unit_price")
      .order("created_at", { ascending: true }),
  ])

  if (ordersResult.error) {
    return { orders: [], error: ordersResult.error.message }
  }

  if (itemsResult.error) {
    return {
      orders: ((ordersResult.data as OrderRow[] | null) ?? []).map(mapOrderRow),
      error: itemsResult.error.message,
    }
  }

  const userOrderIds = new Set(((ordersResult.data as OrderRow[] | null) ?? []).map((row) => row.id))
  const normalizedRows = ((itemsResult.data as OrderItemRow[] | null) ?? []).filter((row) => userOrderIds.has(row.order_id))

  return {
    orders: hydrateOrdersWithNormalizedItems(ordersResult.data as OrderRow[] | null, normalizedRows),
  }
}

export async function updateSupabaseOrderPayment(
  orderId: string,
  paymentStatus: Order["paymentStatus"],
  status?: Order["status"]
): Promise<PersistenceResult> {
  if (isGoogleSheetsConfigured) {
    try {
      await postToGoogleSheets({
        action: "update_payment",
        orderId,
        paymentStatus,
        status,
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.warn("Google Sheets payment sync failed", error)
    }
  }

  if (!allowClientOrderUpdates) {
    return isGoogleSheetsConfigured
      ? { persisted: true, provider: "google-sheets" }
      : { persisted: false, reason: "not-configured" }
  }

  const client = assertClient()
  if (!client) {
    return { persisted: false, reason: "not-configured" }
  }

  const payload: Record<string, unknown> = {
    payment_status: paymentStatus,
    updated_at: new Date().toISOString(),
  }

  if (status) payload.status = status

  const { error } = await client.from("orders").update(payload).eq("id", orderId)

  if (error) {
    return { persisted: false, reason: "error", error: error.message }
  }

  return { persisted: true, provider: "supabase" }
}

export async function updateSupabaseOrderStatus(
  orderId: string,
  status: Order["status"]
): Promise<PersistenceResult> {
  if (isGoogleSheetsConfigured) {
    try {
      await postToGoogleSheets({
        action: "update_status",
        orderId,
        status,
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.warn("Google Sheets status sync failed", error)
    }
  }

  if (!allowClientOrderUpdates) {
    return isGoogleSheetsConfigured
      ? { persisted: true, provider: "google-sheets" }
      : { persisted: false, reason: "not-configured" }
  }

  const client = assertClient()
  if (!client) {
    return { persisted: false, reason: "not-configured" }
  }

  const { error } = await client
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId)

  if (error) {
    return { persisted: false, reason: "error", error: error.message }
  }

  return { persisted: true, provider: "supabase" }
}
