import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { sendOrderNotifications } from "../_shared/order-notifications.ts";
function maskUserId(value) {
  const normalized = String(value ?? "");
  if (normalized.length < 10) {
    return "***";
  }
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error("Missing required environment variables for order-notifications function.");
}
function getAuthToken(req) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}
async function getAuthenticatedUser(req) {
  const authToken = getAuthToken(req);
  if (!authToken) {
    return {
      error: "Missing bearer token."
    };
  }
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    }
  });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) {
    return {
      error: error?.message ?? "Authentication failed."
    };
  }
  return {
    user: data.user
  };
}
function mapOrderRow(row) {
  return {
    id: row.id,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
      address: row.customer_address,
      city: row.customer_city,
      pincode: row.customer_pincode
    },
    items: (row.items ?? []).map((item)=>({
        productName: String(item.productName ?? "Item"),
        quantity: Number(item.quantity ?? 0),
        grams: Number(item.grams ?? 0),
        pricePerUnit: Number(item.pricePerUnit ?? 0)
      })),
    totalAmount: Number(row.total_amount ?? 0),
    paymentStatus: row.payment_status,
    status: row.status,
    createdAt: row.created_at
  };
}
Deno.serve(async (req)=>{
  const requestUrl = new URL(req.url);
  console.log("[order-notifications] request-received", {
    method: req.method,
    pathname: requestUrl.pathname
  });
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  if (req.method !== "POST") {
    return jsonResponse({
      error: "Method not allowed"
    }, 405);
  }
  const auth = await getAuthenticatedUser(req);
  if (auth.error) {
    console.warn("[order-notifications] auth-failed", {
      error: auth.error
    });
    return jsonResponse({
      error: auth.error
    }, 401);
  }
  console.log("[order-notifications] auth-success", {
    userId: maskUserId(auth.user.id)
  });
  const payload = await req.json().catch(()=>({}));
  const appOrderId = String(payload.appOrderId ?? "").trim();
  const eventType = payload.eventType ?? "order_created";
  console.log("[order-notifications] payload", {
    eventType,
    appOrderId,
    hasPaymentDetails: Boolean(payload.paymentDetails)
  });
  if (!appOrderId) {
    return jsonResponse({
      error: "appOrderId is required."
    }, 400);
  }
  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: orderRow, error: orderError } = await serviceClient.from("orders").select("id, user_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_pincode, items, total_amount, payment_status, status, created_at").eq("id", appOrderId).eq("user_id", auth.user.id).maybeSingle();
  if (orderError) {
    console.error("[order-notifications] order-fetch-failed", {
      appOrderId,
      userId: maskUserId(auth.user.id),
      error: orderError.message
    });
    return jsonResponse({
      error: orderError.message
    }, 500);
  }
  if (!orderRow) {
    console.warn("[order-notifications] order-not-found", {
      appOrderId,
      userId: maskUserId(auth.user.id)
    });
    return jsonResponse({
      error: "Order not found for current user."
    }, 404);
  }
  console.log("[order-notifications] order-found", {
    appOrderId,
    userId: maskUserId(auth.user.id),
    paymentStatus: orderRow.payment_status,
    status: orderRow.status
  });
  const result = await sendOrderNotifications({
    eventType,
    order: mapOrderRow(orderRow),
    paymentDetails: payload.paymentDetails
  });
  console.log("[order-notifications] response-summary", {
    appOrderId,
    eventType,
    ok: result.ok,
    attempted: result.attempted,
    sent: result.sent,
    failed: result.failed
  });
  return jsonResponse(result, result.ok ? 200 : 207);
});
