import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import type { Order } from "@/lib/types"

type OrderNotificationEventType = "order_created" | "payment_verified"

type TriggerOrderNotificationOptions = {
  eventType: OrderNotificationEventType
  appOrderId: string
  paymentDetails?: {
    razorpayOrderId?: string
    razorpayPaymentId?: string
    gatewayStatus?: string
  }
}

const rawApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").trim()
const apiBaseUrl = rawApiBaseUrl.replace(/\/$/, "")

async function getAuthBearerToken() {
  if (!supabase || !isSupabaseConfigured) {
    return null
  }

  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function resolveNotificationApiUrl(path: string) {
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

export async function triggerOrderNotification(options: TriggerOrderNotificationOptions) {
  const token = await getAuthBearerToken()
  if (!token) {
    return { ok: false, error: "User session is required to send order notifications." }
  }

  const primaryEndpoint = resolveNotificationApiUrl("/order-notifications")
  if (!primaryEndpoint) {
    return { ok: false, error: "Order notification endpoint is not configured." }
  }

  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(options),
  }

  let response = await fetch(primaryEndpoint, requestInit)

  if (
    response.status === 404
    && Boolean(apiBaseUrl)
    && isSupabaseConfigured
  ) {
    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "")
    if (supabaseUrl) {
      response = await fetch(`${supabaseUrl}/functions/v1/order-notifications`, requestInit)
    }
  }

  const json = await response.json().catch(() => ({})) as {
    ok?: boolean
    failed?: number
    reports?: Array<{ provider?: string; recipient?: string; ok?: boolean; error?: string }>
    error?: unknown
  }

  if (!response.ok) {
    return {
      ok: false,
      error: String(json.error ?? `Notification API failed (${response.status})`),
    }
  }

  if (json.ok === false) {
    const failedReports = (json.reports ?? []).filter((report) => report.ok === false)
    const firstFailure = failedReports[0]
    const failedLabel = firstFailure
      ? `${String(firstFailure.provider ?? "provider")} to ${String(firstFailure.recipient ?? "recipient")}`
      : "notification delivery"

    return {
      ok: false,
      error: firstFailure?.error
        ? `${failedLabel} failed: ${firstFailure.error}`
        : `Notification dispatch failed for ${json.failed ?? failedReports.length} recipient(s).`,
      data: json,
    }
  }

  return { ok: true, data: json }
}

export async function triggerOrderCreatedNotification(order: Order) {
  return triggerOrderNotification({
    eventType: "order_created",
    appOrderId: order.id,
  })
}
