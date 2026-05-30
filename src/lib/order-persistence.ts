import type { Order } from "@/lib/types"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { isGoogleSheetsConfigured, postToGoogleSheets } from "@/lib/google-sheets"

const allowClientOrderUpdates = import.meta.env.VITE_ALLOW_CLIENT_ORDER_UPDATES === "true"

type PersistenceResult = {
  persisted: boolean
  reason?: "not-configured" | "error"
  provider?: "google-sheets" | "supabase"
  error?: string
}

function assertClient() {
  if (!supabase || !isSupabaseConfigured) {
    return null
  }
  return supabase
}

export async function persistOrderToSupabase(order: Order): Promise<PersistenceResult> {
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
