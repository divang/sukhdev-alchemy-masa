import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { fetchShiprocketTrackingByShipmentId } from "../_shared/shiprocket.ts"

type SyncAwbPayload = {
  appOrderId?: string
}

type ShipmentRow = {
  id: string
  shipment_id: string | null
  awb_code: string | null
  tracking_url: string | null
  external_status: string | null
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error("Missing required environment variables for sync-shiprocket-awb function.")
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

function normalize(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim()
  return trimmed || undefined
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

  const payload = (await req.json().catch(() => ({}))) as SyncAwbPayload
  const appOrderId = String(payload.appOrderId ?? "").trim()
  if (!appOrderId) {
    return jsonResponse({ error: "appOrderId is required." }, 400)
  }

  const { data: latestShipment, error: latestShipmentError } = await serviceClient
    .from("order_shipments")
    .select("id, shipment_id, awb_code, tracking_url, external_status")
    .eq("order_id", appOrderId)
    .eq("provider_key", "shiprocket")
    .in("shipment_status", ["created", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestShipmentError) {
    return jsonResponse({ error: latestShipmentError.message }, 500)
  }

  if (!latestShipment) {
    return jsonResponse({
      synced: false,
      reason: "shiprocket_shipment_not_found",
      message: "No Shiprocket shipment record was found for this order.",
    })
  }

  const current = latestShipment as ShipmentRow
  const shipmentId = normalize(current.shipment_id)
  if (!shipmentId) {
    return jsonResponse({
      synced: false,
      reason: "shipment_id_missing",
      message: "Shipment exists but Shiprocket shipment_id is missing.",
    })
  }

  const trackingResult = await fetchShiprocketTrackingByShipmentId(shipmentId)
  if (!trackingResult.ok) {
    return jsonResponse({
      synced: false,
      reason: "shiprocket_api_error",
      error: trackingResult.error || "Failed to fetch shipment tracking from Shiprocket.",
      shipmentId,
    }, 502)
  }

  const nextAwbCode = normalize(trackingResult.awbCode)
  const nextTrackingUrl = normalize(trackingResult.trackingUrl)
  const nextExternalStatus = normalize(trackingResult.externalStatus)

  const currentAwbCode = normalize(current.awb_code)
  const currentTrackingUrl = normalize(current.tracking_url)
  const currentExternalStatus = normalize(current.external_status)

  const changed = (
    nextAwbCode !== currentAwbCode
    || nextTrackingUrl !== currentTrackingUrl
    || nextExternalStatus !== currentExternalStatus
  )

  if (!changed) {
    return jsonResponse({
      synced: false,
      reason: "no_change",
      shipmentId,
      awbCode: currentAwbCode || null,
      trackingUrl: currentTrackingUrl || null,
      externalStatus: currentExternalStatus || null,
    })
  }

  const { error: insertError } = await serviceClient.from("order_shipments").insert({
    order_id: appOrderId,
    provider_key: "shiprocket",
    shipment_status: "pending",
    shipment_id: shipmentId,
    awb_code: nextAwbCode || null,
    tracking_url: nextTrackingUrl || null,
    external_status: nextExternalStatus || null,
    external_event_at: new Date().toISOString(),
    raw_response: trackingResult.rawResponse,
    updated_at: new Date().toISOString(),
  })

  if (insertError) {
    return jsonResponse({ error: insertError.message }, 500)
  }

  return jsonResponse({
    synced: true,
    shipmentId,
    awbCode: nextAwbCode || null,
    trackingUrl: nextTrackingUrl || null,
    externalStatus: nextExternalStatus || null,
  })
})