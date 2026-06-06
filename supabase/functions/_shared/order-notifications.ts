export type OrderNotificationEventType = "order_created" | "payment_verified"

type OrderNotificationItem = {
  productName: string
  quantity: number
  grams: number
  pricePerUnit: number
}

export type OrderNotificationOrder = {
  id: string
  customer: {
    name: string
    email: string
    phone: string
    address: string
    city: string
    pincode: string
  }
  items: OrderNotificationItem[]
  totalAmount: number
  paymentStatus: string
  status: string
  createdAt: string
  promoCode?: string | null
}

export type OrderPaymentDetails = {
  razorpayOrderId?: string
  razorpayPaymentId?: string
  gatewayStatus?: string
}

type NotificationDispatchReport = {
  provider: "email" | "whatsapp"
  recipient: string
  ok: boolean
  error?: string
}

function maskEmail(value: string) {
  const normalized = String(value ?? "").trim().toLowerCase()
  const atIndex = normalized.indexOf("@")
  if (atIndex <= 1) {
    return "***"
  }

  const name = normalized.slice(0, atIndex)
  const domain = normalized.slice(atIndex + 1)
  return `${name[0]}***@${domain}`
}

function maskPhone(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "")
  if (digits.length <= 4) {
    return "***"
  }
  return `${digits.slice(0, 2)}******${digits.slice(-2)}`
}

function truncateForLog(value: string, maxLength = 220) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

const DEFAULT_ADMIN_EMAILS = [
  "divang.s@gmail.com",
  "poonam.om.107@gmail.com",
  "poonam@sukhdevialchemy.com",
  "divang@sukhdevialchemy.com",
]

const DEFAULT_ADMIN_WHATSAPP_NUMBERS = ["9241797239", "7889480171"]

function splitCsv(raw: string | undefined) {
  return String(raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizeWhatsappPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  if (!digits) {
    return null
  }

  if (digits.length === 10) {
    return `91${digits}`
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits
  }

  return digits
}

function dedupe(values: string[]) {
  return [...new Set(values)]
}

function formatCurrency(amount: number) {
  return `Rs ${Number(amount || 0).toFixed(2)}`
}

function formatItems(items: OrderNotificationItem[]) {
  if (items.length === 0) {
    return "No items"
  }

  return items
    .map((item) => `${item.productName} x ${item.quantity} (${item.grams}g)`) 
    .join(", ")
}

function buildTextSummary(eventType: OrderNotificationEventType, order: OrderNotificationOrder, paymentDetails?: OrderPaymentDetails) {
  const eventLabel = eventType === "payment_verified" ? "Payment confirmed" : "Order placed"
  const paymentLine = paymentDetails?.razorpayPaymentId
    ? `Payment ID: ${paymentDetails.razorpayPaymentId}`
    : "Payment ID: pending"
  const gatewayOrderLine = paymentDetails?.razorpayOrderId
    ? `Gateway Order ID: ${paymentDetails.razorpayOrderId}`
    : "Gateway Order ID: pending"

  return [
    `Sukhdevi Alchemy - ${eventLabel}`,
    `Order ID: ${order.id}`,
    `Customer: ${order.customer.name}`,
    `Email: ${order.customer.email}`,
    `Phone: ${order.customer.phone}`,
    `Amount: ${formatCurrency(order.totalAmount)}`,
    `Order Status: ${order.status}`,
    `Payment Status: ${order.paymentStatus}`,
    paymentLine,
    gatewayOrderLine,
    `Items: ${formatItems(order.items)}`,
  ].join("\n")
}

function buildEmailBody(eventType: OrderNotificationEventType, order: OrderNotificationOrder, paymentDetails?: OrderPaymentDetails) {
  const eventLabel = eventType === "payment_verified" ? "Payment Confirmed" : "Order Confirmation"
  return [
    `${eventLabel}`,
    "",
    `Order ID: ${order.id}`,
    `Customer: ${order.customer.name}`,
    `Email: ${order.customer.email}`,
    `Phone: ${order.customer.phone}`,
    `Delivery: ${order.customer.address}, ${order.customer.city} - ${order.customer.pincode}`,
    `Amount: ${formatCurrency(order.totalAmount)}`,
    `Order Status: ${order.status}`,
    `Payment Status: ${order.paymentStatus}`,
    `Gateway Order ID: ${paymentDetails?.razorpayOrderId ?? "pending"}`,
    `Payment ID: ${paymentDetails?.razorpayPaymentId ?? "pending"}`,
    `Promo Code: ${order.promoCode || "none"}`,
    `Items: ${formatItems(order.items)}`,
  ].join("\n")
}

async function sendEmail(
  recipients: string[],
  subject: string,
  body: string
): Promise<NotificationDispatchReport[]> {
  const apiKey = Deno.env.get("RESEND_API_KEY")
  const fromEmail = Deno.env.get("ORDER_NOTIFICATION_FROM_EMAIL")

  console.log("[order-notifications] email-dispatch-start", {
    recipients: recipients.map(maskEmail),
    hasApiKey: Boolean(apiKey),
    fromEmail: fromEmail ? maskEmail(fromEmail) : null,
    subject,
  })

  if (!apiKey || !fromEmail || recipients.length === 0) {
    console.warn("[order-notifications] email-provider-not-configured", {
      hasApiKey: Boolean(apiKey),
      hasFromEmail: Boolean(fromEmail),
      recipientCount: recipients.length,
    })

    return recipients.map((recipient) => ({
      provider: "email",
      recipient,
      ok: false,
      error: "Email provider is not configured.",
    }))
  }

  const reports: NotificationDispatchReport[] = []
  for (const recipient of recipients) {
    console.log("[order-notifications] email-send-attempt", {
      recipient: maskEmail(recipient),
      subject,
    })

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject,
        text: body,
      }),
    })

    if (!response.ok) {
      const payload = await response.text()
      console.error("[order-notifications] email-send-failed", {
        recipient: maskEmail(recipient),
        status: response.status,
        payload: truncateForLog(payload),
      })

      reports.push({
        provider: "email",
        recipient,
        ok: false,
        error: payload || `Email API failed (${response.status})`,
      })
      continue
    }

    console.log("[order-notifications] email-send-success", {
      recipient: maskEmail(recipient),
    })

    reports.push({ provider: "email", recipient, ok: true })
  }

  return reports
}

type WhatsappApiError = {
  code?: number
  message?: string
}

function parseWhatsappApiError(payload: string): WhatsappApiError {
  try {
    const parsed = JSON.parse(payload) as { error?: { code?: unknown; message?: unknown } }
    return {
      code: typeof parsed.error?.code === "number" ? parsed.error.code : undefined,
      message: typeof parsed.error?.message === "string" ? parsed.error.message : undefined,
    }
  } catch {
    return {}
  }
}

function shouldRetryWithTemplate(error: WhatsappApiError) {
  const message = String(error.message ?? "").toLowerCase()
  if (!message) {
    return false
  }

  return (
    message.includes("outside") && message.includes("window")
  ) || message.includes("template")
}

async function sendWhatsappTemplateMessage(params: {
  token: string
  phoneNumberId: string
  apiVersion: string
  phone: string
  templateName: string
  templateLanguage: string
}) {
  return fetch(`https://graph.facebook.com/${params.apiVersion}/${params.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.phone,
      type: "template",
      template: {
        name: params.templateName,
        language: {
          code: params.templateLanguage,
        },
      },
    }),
  })
}

async function sendWhatsappMessage(phone: string, text: string): Promise<NotificationDispatchReport> {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN")
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")
  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v22.0"
  const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME") || "hello_world"
  const templateLanguage = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "en_US"

  console.log("[order-notifications] whatsapp-send-start", {
    recipient: maskPhone(phone),
    hasToken: Boolean(token),
    hasPhoneNumberId: Boolean(phoneNumberId),
    apiVersion,
    templateName,
    templateLanguage,
  })

  if (!token || !phoneNumberId) {
    console.warn("[order-notifications] whatsapp-provider-not-configured", {
      hasToken: Boolean(token),
      hasPhoneNumberId: Boolean(phoneNumberId),
      recipient: maskPhone(phone),
    })

    return {
      provider: "whatsapp",
      recipient: phone,
      ok: false,
      error: "WhatsApp provider is not configured.",
    }
  }

  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: {
        preview_url: false,
        body: text,
      },
    }),
  })

  if (!response.ok) {
    const payload = await response.text()
    const parsedError = parseWhatsappApiError(payload)

    console.warn("[order-notifications] whatsapp-text-failed", {
      recipient: maskPhone(phone),
      status: response.status,
      errorCode: parsedError.code ?? null,
      errorMessage: truncateForLog(parsedError.message ?? payload),
    })

    if (shouldRetryWithTemplate(parsedError)) {
      console.log("[order-notifications] whatsapp-template-retry", {
        recipient: maskPhone(phone),
        templateName,
        templateLanguage,
      })

      const templateResponse = await sendWhatsappTemplateMessage({
        token,
        phoneNumberId,
        apiVersion,
        phone,
        templateName,
        templateLanguage,
      })

      if (templateResponse.ok) {
        console.log("[order-notifications] whatsapp-template-success", {
          recipient: maskPhone(phone),
        })
        return { provider: "whatsapp", recipient: phone, ok: true }
      }

      const templatePayload = await templateResponse.text()
      console.error("[order-notifications] whatsapp-template-failed", {
        recipient: maskPhone(phone),
        status: templateResponse.status,
        payload: truncateForLog(templatePayload),
      })

      return {
        provider: "whatsapp",
        recipient: phone,
        ok: false,
        error: `WhatsApp text+template send failed. text=${payload} template=${templatePayload}`,
      }
    }

    return {
      provider: "whatsapp",
      recipient: phone,
      ok: false,
      error: payload || `WhatsApp API failed (${response.status})`,
    }
  }

  console.log("[order-notifications] whatsapp-text-success", {
    recipient: maskPhone(phone),
  })

  return { provider: "whatsapp", recipient: phone, ok: true }
}

export async function sendOrderNotifications(input: {
  eventType: OrderNotificationEventType
  order: OrderNotificationOrder
  paymentDetails?: OrderPaymentDetails
}) {
  const { eventType, order, paymentDetails } = input

  const adminEmails = dedupe([
    ...DEFAULT_ADMIN_EMAILS,
    ...splitCsv(Deno.env.get("ORDER_NOTIFICATION_ADMIN_EMAILS")),
  ].map(normalizeEmail))

  const customerEmail = normalizeEmail(order.customer.email)
  const emailRecipientsForUser = customerEmail ? [customerEmail] : []
  const emailRecipientsForAdmin = adminEmails

  const adminPhones = dedupe([
    ...DEFAULT_ADMIN_WHATSAPP_NUMBERS,
    ...splitCsv(Deno.env.get("ORDER_NOTIFICATION_ADMIN_WHATSAPP_NUMBERS")),
  ])
    .map(normalizeWhatsappPhone)
    .filter((value): value is string => Boolean(value))

  const customerPhone = normalizeWhatsappPhone(order.customer.phone)
  const whatsappRecipientsForUser = customerPhone ? [customerPhone] : []
  const whatsappRecipientsForAdmin = adminPhones

  console.log("[order-notifications] dispatch-plan", {
    eventType,
    orderId: order.id,
    amount: order.totalAmount,
    paymentStatus: order.paymentStatus,
    userEmailRecipients: emailRecipientsForUser.map(maskEmail),
    adminEmailRecipients: emailRecipientsForAdmin.map(maskEmail),
    userWhatsappRecipients: whatsappRecipientsForUser.map(maskPhone),
    adminWhatsappRecipients: whatsappRecipientsForAdmin.map(maskPhone),
    hasPaymentDetails: Boolean(paymentDetails),
  })

  const summaryText = buildTextSummary(eventType, order, paymentDetails)
  const userSubject = eventType === "payment_verified"
    ? `Payment confirmed for order ${order.id}`
    : `Order confirmation ${order.id}`
  const adminSubject = eventType === "payment_verified"
    ? `Payment update ${order.id}`
    : `New order ${order.id}`

  const userBody = buildEmailBody(eventType, order, paymentDetails)
  const adminBody = buildEmailBody(eventType, order, paymentDetails)

  const reports: NotificationDispatchReport[] = []
  reports.push(...await sendEmail(emailRecipientsForUser, userSubject, userBody))
  reports.push(...await sendEmail(emailRecipientsForAdmin, adminSubject, adminBody))

  for (const recipient of whatsappRecipientsForUser) {
    reports.push(await sendWhatsappMessage(recipient, summaryText))
  }

  for (const recipient of whatsappRecipientsForAdmin) {
    reports.push(await sendWhatsappMessage(recipient, summaryText))
  }

  const sent = reports.filter((entry) => entry.ok)
  const failed = reports.filter((entry) => !entry.ok)

  console.log("[order-notifications] dispatch-result", {
    orderId: order.id,
    eventType,
    attempted: reports.length,
    sent: sent.length,
    failed: failed.length,
    failedReports: failed.map((entry) => ({
      provider: entry.provider,
      recipient: entry.provider === "email" ? maskEmail(entry.recipient) : maskPhone(entry.recipient),
      error: truncateForLog(String(entry.error ?? "unknown error")),
    })),
  })

  return {
    ok: failed.length === 0,
    attempted: reports.length,
    sent: sent.length,
    failed: failed.length,
    reports,
  }
}
