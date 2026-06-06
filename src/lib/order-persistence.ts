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

type OrderRow = {
  id: string
  user_id: string | null
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_address: string
  customer_city: string
  customer_pincode: string
  items: Order["items"]
  total_amount: number
  status: Order["status"]
  payment_status: Order["paymentStatus"]
  created_at: string
  updated_at: string
}

function assertClient() {
  if (!supabase || !isSupabaseConfigured) {
    return null
  }
  return supabase
}

function mapOrderRow(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id,
    items: row.items,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
      address: row.customer_address,
      city: row.customer_city,
      pincode: row.customer_pincode,
    },
    totalAmount: Number(row.total_amount),
    status: row.status,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
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

  const client = assertClient()
  if (!client) {
    return { persisted: false, reason: "not-configured" }
  }

  const { error } = await client.from("orders").insert({
    id: order.id,
    user_id: order.userId ?? null,
    customer_name: order.customer.name,
    customer_email: order.customer.email,
    customer_phone: order.customer.phone,
    customer_address: order.customer.address,
    customer_city: order.customer.city,
    customer_pincode: order.customer.pincode,
    items: order.items,
    total_amount: order.totalAmount,
    status: order.status,
    payment_status: order.paymentStatus,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  })

  if (error) {
    return { persisted: false, reason: "error", error: error.message }
  }

  return { persisted: true, provider: "supabase" }
}

export async function fetchOrdersForCurrentUser(): Promise<OrdersLoadResult> {
  const client = assertClient()
  if (!client) {
    return { orders: [], error: "Supabase is not configured." }
  }

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser()

  if (userError || !user) {
    return { orders: [], error: userError?.message ?? "No signed-in user found." }
  }

  const { data, error } = await client
    .from("orders")
    .select("id, user_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_pincode, items, total_amount, status, payment_status, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return { orders: [], error: error.message }
  }

  return { orders: (data as OrderRow[] | null)?.map(mapOrderRow) ?? [] }
}

export async function fetchOrdersForAdmin(): Promise<OrdersLoadResult> {
  const client = assertClient()
  if (!client) {
    return { orders: [], error: "Supabase is not configured." }
  }

  const { data, error } = await client
    .from("orders")
    .select("id, user_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_pincode, items, total_amount, status, payment_status, created_at, updated_at")
    .order("created_at", { ascending: false })

  if (error) {
    return { orders: [], error: error.message }
  }

  return { orders: (data as OrderRow[] | null)?.map(mapOrderRow) ?? [] }
}

export async function updateSupabaseOrderPayment(
  orderId: string,
  paymentStatus: Order["paymentStatus"],
  status?: Order["status"]
): Promise<PersistenceResult> {
  if (!allowClientOrderUpdates) {
    return { persisted: false, reason: "not-configured" }
  }

  if (isGoogleSheetsConfigured) {
    try {
      await postToGoogleSheets({
        action: "update_payment",
        orderId,
        paymentStatus,
        status,
        updatedAt: new Date().toISOString(),
      })
      return { persisted: true, provider: "google-sheets" }
    } catch (error) {
      return {
        persisted: false,
        reason: "error",
        provider: "google-sheets",
        error: error instanceof Error ? error.message : "Google Sheets payment sync failed",
      }
    }
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
  if (!allowClientOrderUpdates) {
    return { persisted: false, reason: "not-configured" }
  }

  if (isGoogleSheetsConfigured) {
    try {
      await postToGoogleSheets({
        action: "update_status",
        orderId,
        status,
        updatedAt: new Date().toISOString(),
      })
      return { persisted: true, provider: "google-sheets" }
    } catch (error) {
      return {
        persisted: false,
        reason: "error",
        provider: "google-sheets",
        error: error instanceof Error ? error.message : "Google Sheets status sync failed",
      }
    }
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
