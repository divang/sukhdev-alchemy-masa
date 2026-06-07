import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { createShipmentForPaidOrder } from "../_shared/shipping.ts"

type CreateShipmentPayload = {
  appOrderId?: string
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
  payment_status: string
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error("Missing required environment variables for create-shipment function.")
}

function getAuthToken(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? ""
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return null
  }
  return authHeader.slice(7)
}

async function getAuthenticatedUser(req: Request) {
  const authToken = getAuthToken(req)
  if (!authToken) {
    return { error: "Missing bearer token." }
  }

  const authClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  })

  const { data, error } = await authClient.auth.getUser()
  if (error || !data.user) {
    return { error: error?.message ?? "Authentication failed." }
  }

  return { user: data.user }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const auth = await getAuthenticatedUser(req)
  if (auth.error) {
    return jsonResponse({ error: auth.error }, 401)
  }

  const serviceClient = createClient(supabaseUrl!, supabaseServiceRoleKey!)

  const { data: profileRow, error: profileError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", auth.user!.id)
    .maybeSingle()

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500)
  }

  if (!profileRow || profileRow.role !== "admin") {
    return jsonResponse({ error: "Admin access required." }, 403)
  }

  const payload = (await req.json().catch(() => ({}))) as CreateShipmentPayload
  const appOrderId = String(payload.appOrderId ?? "").trim()
  if (!appOrderId) {
    return jsonResponse({ error: "appOrderId is required." }, 400)
  }

  const { data: orderRow, error: orderError } = await serviceClient
    .from("orders")
    .select("id, user_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_pincode, items, total_amount, payment_status")
    .eq("id", appOrderId)
    .maybeSingle()

  if (orderError) {
    return jsonResponse({ error: orderError.message }, 500)
  }

  if (!orderRow) {
    return jsonResponse({ error: "Order not found." }, 404)
  }

  if (orderRow.payment_status !== "paid") {
    return jsonResponse({ error: "Shipment can be created only for paid orders." }, 400)
  }

  const result = await createShipmentForPaidOrder(serviceClient, {
    id: orderRow.id,
    customer: {
      name: orderRow.customer_name,
      email: orderRow.customer_email,
      phone: orderRow.customer_phone,
      address: orderRow.customer_address,
      city: orderRow.customer_city,
      pincode: orderRow.customer_pincode,
    },
    items: ((orderRow as OrderRow).items ?? []).map((item) => ({
      productName: String(item.productName ?? "Item"),
      quantity: Number(item.quantity ?? 0),
      grams: Number(item.grams ?? 0),
      pricePerUnit: Number(item.pricePerUnit ?? 0),
    })),
    totalAmount: Number(orderRow.total_amount ?? 0),
  })

  return jsonResponse({
    attempted: result.attempted,
    created: result.created,
    provider: result.provider,
    reason: result.reason,
    shipmentId: result.shipmentId,
    awbCode: result.awbCode,
    trackingUrl: result.trackingUrl,
  })
})
