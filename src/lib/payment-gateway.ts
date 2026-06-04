import type { Order } from "@/lib/types"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

const rawApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").trim()
const apiBaseUrl = rawApiBaseUrl.replace(/\/$/, "")
const razorpayKeyId = String(import.meta.env.VITE_RAZORPAY_KEY_ID ?? "").trim()

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance
  }
}

type RazorpayCheckoutSuccessPayload = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

type RazorpayCheckoutOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
  notes?: Record<string, string>
  modal?: {
    ondismiss?: () => void
  }
  handler: (payload: RazorpayCheckoutSuccessPayload) => void
}

type RazorpayCheckoutInstance = {
  open: () => void
  on: (eventName: string, callback: (payload: RazorpayPaymentFailedEvent) => void) => void
}

type RazorpayPaymentFailedEvent = {
  error?: {
    description?: string
    reason?: string
    metadata?: {
      order_id?: string
      payment_id?: string
    }
  }
}

type ResultBase = {
  error?: string
}

type GatewayCreateOrderResponse = {
  order_id?: string
  amount?: number
  currency?: string
  message?: string
}

type GatewayVerifyResponse = {
  verified?: boolean
  paymentStatus?: Order["paymentStatus"]
  orderStatus?: Order["status"]
  message?: string
}

type GatewayCheckoutResult = {
  verified: boolean
  cancelled?: boolean
  paymentStatus?: Order["paymentStatus"]
  orderStatus?: Order["status"]
  error?: string
}

function hasGatewayConfig() {
  return Boolean(razorpayKeyId) && (Boolean(apiBaseUrl) || isSupabaseConfigured)
}

async function getAuthBearerToken(): Promise<string | null> {
  if (!supabase || !isSupabaseConfigured) {
    return null
  }

  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function resolvePaymentApiUrl(path: string) {
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

async function postJson<TResponse>(
  path: string,
  payload: unknown
): Promise<{ data?: TResponse; error?: string; statusCode?: number }> {
  const endpointUrl = resolvePaymentApiUrl(path)
  if (!endpointUrl) {
    return { error: "Payment API endpoint is not configured." }
  }

  const token = await getAuthBearerToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })

    const json = (await response.json().catch(() => ({}))) as TResponse & { error?: string; message?: string }

    if (!response.ok) {
      return {
        error: json.error || json.message || `Payment API failed (${response.status})`,
        statusCode: response.status,
      }
    }

    return { data: json }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Payment API request failed",
    }
  }
}

export function isPaymentGatewayEnabled() {
  return hasGatewayConfig()
}

async function createGatewayOrderForCheckout(order: Order): Promise<ResultBase & GatewayCreateOrderResponse> {
  if (!hasGatewayConfig()) {
    return { error: "Payment gateway integration is disabled. Set VITE_RAZORPAY_KEY_ID and backend endpoint." }
  }

  const amountPaise = Math.round(order.totalAmount * 100)
  if (amountPaise < 100) {
    return { error: "Minimum amount is 100 paise (Rs 1)." }
  }

  const payload = {
    amount: amountPaise,
    currency: "INR",
    receipt: order.id,
    appOrderId: order.id,
  }

  const preferredResult = await postJson<GatewayCreateOrderResponse>("/razorpay-create-order", payload)
  const shouldFallbackToLegacyEndpoint = preferredResult.statusCode === 404
  const result = shouldFallbackToLegacyEndpoint
    ? await postJson<GatewayCreateOrderResponse>("/create-order", payload)
    : preferredResult

  if (result.error) {
    if (result.statusCode === 401) {
      return {
        error: "Please sign in before starting payment.",
      }
    }

    if (result.statusCode === 404) {
      return {
        error: `${result.error}. Deploy either razorpay-create-order or create-order Supabase function.`,
      }
    }

    return {
      error: result.error,
    }
  }

  return {
    order_id: result.data?.order_id,
    amount: result.data?.amount,
    currency: result.data?.currency,
    message: result.data?.message,
  }
}

async function requestPaymentVerification(
  order: Order,
  paymentPayload: RazorpayCheckoutSuccessPayload
): Promise<ResultBase & GatewayVerifyResponse> {
  if (!hasGatewayConfig()) {
    return { error: "Payment gateway integration is disabled." }
  }

  const payload = {
    appOrderId: order.id,
    razorpay_order_id: paymentPayload.razorpay_order_id,
    razorpay_payment_id: paymentPayload.razorpay_payment_id,
    razorpay_signature: paymentPayload.razorpay_signature,
  }

  const result = await postJson<GatewayVerifyResponse>("/verify-payment", payload)
  if (result.error) {
    return { error: result.error }
  }

  return {
    verified: result.data?.verified,
    paymentStatus: result.data?.paymentStatus,
    orderStatus: result.data?.orderStatus,
    message: result.data?.message,
  }
}

function loadRazorpayCheckoutScript() {
  if (typeof window === "undefined") {
    return Promise.resolve(false)
  }

  if (window.Razorpay) {
    return Promise.resolve(true)
  }

  return new Promise<boolean>((resolve) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout="true"]')
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(Boolean(window.Razorpay)), { once: true })
      existingScript.addEventListener("error", () => resolve(false), { once: true })
      return
    }

    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.dataset.razorpayCheckout = "true"
    script.onload = () => resolve(Boolean(window.Razorpay))
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export async function startRazorpayCheckout(order: Order): Promise<GatewayCheckoutResult> {
  if (!hasGatewayConfig()) {
    return {
      verified: false,
      error: "Payment gateway is not configured. Add VITE_RAZORPAY_KEY_ID and backend payment endpoints.",
    }
  }

  const scriptLoaded = await loadRazorpayCheckoutScript()
  if (!scriptLoaded || !window.Razorpay) {
    return { verified: false, error: "Unable to load Razorpay checkout script." }
  }

  const orderResult = await createGatewayOrderForCheckout(order)
  if (orderResult.error || !orderResult.order_id || !orderResult.amount || !orderResult.currency) {
    return { verified: false, error: orderResult.error || "Failed to create payment order." }
  }

  return new Promise<GatewayCheckoutResult>((resolve) => {
    let settled = false

    const settle = (result: GatewayCheckoutResult) => {
      if (settled) {
        return
      }
      settled = true
      resolve(result)
    }

    const checkout = new window.Razorpay!({
      key: razorpayKeyId,
      amount: orderResult.amount,
      currency: orderResult.currency,
      name: "Sukhdevi Alchemy",
      description: `Order ${order.id}`,
      order_id: orderResult.order_id,
      prefill: {
        name: order.customer.name,
        email: order.customer.email,
        contact: order.customer.phone,
      },
      notes: {
        app_order_id: order.id,
      },
      modal: {
        ondismiss: () => {
          settle({
            verified: false,
            cancelled: true,
            error: "Payment was cancelled before completion.",
          })
        },
      },
      handler: async (payload) => {
        const verification = await requestPaymentVerification(order, payload)
        if (verification.error) {
          settle({
            verified: false,
            error: verification.error,
          })
          return
        }

        settle({
          verified: Boolean(verification.verified),
          paymentStatus: verification.paymentStatus,
          orderStatus: verification.orderStatus,
          error: verification.verified ? undefined : verification.message || "Payment signature validation failed.",
        })
      },
    })

    checkout.on("payment.failed", (event) => {
      settle({
        verified: false,
        error: event.error?.description || event.error?.reason || "Payment failed.",
      })
    })

    checkout.open()
  })
}
