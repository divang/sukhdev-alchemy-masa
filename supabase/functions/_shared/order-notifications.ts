function maskEmail(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 1) {
    return "***";
  }
  const name = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  return `${name[0]}***@${domain}`;
}
function maskPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length <= 4) {
    return "***";
  }
  return `${digits.slice(0, 2)}******${digits.slice(-2)}`;
}
function truncateForLog(value, maxLength = 220) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
const DEFAULT_ADMIN_EMAILS = [
  "divang.s@gmail.com",
  "poonam.om.107@gmail.com",
  "poonam@sukhdevialchemy.com",
  "divang@sukhdevialchemy.com"
];
function splitCsv(raw) {
  return String(raw ?? "").split(",").map((entry)=>entry.trim()).filter(Boolean);
}
function normalizeEmail(value) {
  return value.trim().toLowerCase();
}
function normalizeWhatsappPhone(value) {
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return null;
  }
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }
  return digits;
}
function normalizeSecretValue(value: string | undefined) {
  return String(value ?? "").trim().replace(/^['"]|['"]$/g, "")
}

function normalizeWhatsappAccessToken(rawValue: string | undefined) {
  const normalized = normalizeSecretValue(rawValue)
  return normalized.replace(/^bearer\s+/i, "")
}
function dedupe(values) {
  return [
    ...new Set(values)
  ];
}
function formatCurrency(amount) {
  return `Rs ${Number(amount || 0).toFixed(2)}`;
}
function formatItems(items) {
  if (items.length === 0) {
    return "No items";
  }
  return items.map((item)=>`${item.productName} x ${item.quantity} (${item.grams}g)`).join(", ");
}
function buildTextSummary(eventType, order, paymentDetails) {
  const eventLabel = eventType === "payment_verified" ? "Payment confirmed" : "Order placed";
  const paymentLine = paymentDetails?.razorpayPaymentId ? `Payment ID: ${paymentDetails.razorpayPaymentId}` : "Payment ID: pending";
  const gatewayOrderLine = paymentDetails?.razorpayOrderId ? `Gateway Order ID: ${paymentDetails.razorpayOrderId}` : "Gateway Order ID: pending";
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
    `Items: ${formatItems(order.items)}`
  ].join("\n");
}
function buildEmailBody(eventType, order, paymentDetails) {
  const eventLabel = eventType === "payment_verified" ? "Payment Confirmed" : "Order Confirmation";
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
    `Items: ${formatItems(order.items)}`
  ].join("\n");
}
async function sendEmail(recipients, subject, body) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("ORDER_NOTIFICATION_FROM_EMAIL");
  console.log("[order-notifications] email-dispatch-start", {
    recipients: recipients.map(maskEmail),
    hasApiKey: Boolean(apiKey),
    fromEmail: fromEmail ? maskEmail(fromEmail) : null,
    subject
  });
  if (!apiKey || !fromEmail || recipients.length === 0) {
    console.warn("[order-notifications] email-provider-not-configured", {
      hasApiKey: Boolean(apiKey),
      hasFromEmail: Boolean(fromEmail),
      recipientCount: recipients.length
    });
    return recipients.map((recipient)=>({
        provider: "email",
        recipient,
        ok: false,
        error: "Email provider is not configured."
      }));
  }
  const reports = [];
  for (const recipient of recipients){
    console.log("[order-notifications] email-send-attempt", {
      recipient: maskEmail(recipient),
      subject
    });
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [
          recipient
        ],
        subject,
        text: body
      })
    });
    if (!response.ok) {
      const payload = await response.text();
      console.error("[order-notifications] email-send-failed", {
        recipient: maskEmail(recipient),
        status: response.status,
        payload: truncateForLog(payload)
      });
      reports.push({
        provider: "email",
        recipient,
        ok: false,
        error: payload || `Email API failed (${response.status})`
      });
      continue;
    }
    console.log("[order-notifications] email-send-success", {
      recipient: maskEmail(recipient)
    });
    reports.push({
      provider: "email",
      recipient,
      ok: true
    });
  }
  return reports;
}
function parseWhatsappApiError(payload) {
  try {
    const parsed = JSON.parse(payload);
    return {
      type: typeof parsed.error?.type === "string" ? parsed.error.type : undefined,
      code: typeof parsed.error?.code === "number" ? parsed.error.code : undefined,
      subcode: typeof parsed.error?.error_subcode === "number" ? parsed.error.error_subcode : undefined,
      message: typeof parsed.error?.message === "string" ? parsed.error.message : undefined
    };
  } catch  {
    return {};
  }
}
function parseWhatsappApiSuccess(payload) {
  try {
    const parsed = JSON.parse(payload);
    const messageId = typeof parsed.messages?.[0]?.id === "string" ? parsed.messages[0].id : null;
    const waId = typeof parsed.contacts?.[0]?.wa_id === "string" ? parsed.contacts[0].wa_id : null;
    return {
      messageId,
      waId
    };
  } catch  {
    return {
      messageId: null,
      waId: null
    };
  }
}
function isWhatsappTokenExpiredError(error) {
  return error.code === 190 && (error.subcode === 463 || String(error.message ?? "").toLowerCase().includes("session has expired"));
}
function shouldRetryWithTemplate(error) {
  const message = String(error.message ?? "").toLowerCase();
  if (!message) {
    return false;
  }
  return message.includes("outside") && message.includes("window") || message.includes("template");
}
async function sendWhatsappTemplateMessage(params) {
  return fetch(`https://graph.facebook.com/${params.apiVersion}/${params.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.phone,
      type: "template",
      template: {
        name: params.templateName,
        language: {
          code: params.templateLanguage
        }
      }
    })
  });
}
async function sendWhatsappMessage(phone, text) {
  const token = normalizeWhatsappAccessToken(Deno.env.get("WHATSAPP_ACCESS_TOKEN"));
  const phoneNumberId = normalizeSecretValue(Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"));
  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v22.0";
  const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME") || "hello_world";
  const templateLanguage = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "en_US";
  console.log("[order-notifications] whatsapp-send-start", {
    recipient: maskPhone(phone),
    hasToken: Boolean(token),
    hasPhoneNumberId: Boolean(phoneNumberId),
    tokenLooksJwtLike: token.split(".").length === 3,
    apiVersion,
    templateName,
    templateLanguage
  });
  if (!token || !phoneNumberId) {
    console.warn("[order-notifications] whatsapp-provider-not-configured", {
      hasToken: Boolean(token),
      hasPhoneNumberId: Boolean(phoneNumberId),
      recipient: maskPhone(phone)
    });
    return {
      provider: "whatsapp",
      recipient: phone,
      ok: false,
      error: "WhatsApp provider is not configured."
    };
  }
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: {
        preview_url: false,
        body: text
      }
    })
  });
  if (!response.ok) {
    const payload = await response.text();
    const parsedError = parseWhatsappApiError(payload);
    console.warn("[order-notifications] whatsapp-text-failed", {
      recipient: maskPhone(phone),
      status: response.status,
      errorType: parsedError.type ?? null,
      errorCode: parsedError.code ?? null,
      errorSubcode: parsedError.subcode ?? null,
      errorMessage: truncateForLog(parsedError.message ?? payload)
    });
    if (isWhatsappTokenExpiredError(parsedError)) {
      return {
        provider: "whatsapp",
        recipient: phone,
        ok: false,
        error: "WhatsApp access token expired (OAuth 190/463). Rotate WHATSAPP_ACCESS_TOKEN secret with a fresh long-lived system-user token."
      };
    }
    if (shouldRetryWithTemplate(parsedError)) {
      console.log("[order-notifications] whatsapp-template-retry", {
        recipient: maskPhone(phone),
        templateName,
        templateLanguage
      });
      const templateResponse = await sendWhatsappTemplateMessage({
        token,
        phoneNumberId,
        apiVersion,
        phone,
        templateName,
        templateLanguage
      });
      if (templateResponse.ok) {
        const templatePayload = await templateResponse.text();
        const successMeta = parseWhatsappApiSuccess(templatePayload);
        console.log("[order-notifications] whatsapp-template-success", {
          recipient: maskPhone(phone),
          messageId: successMeta.messageId,
          waId: successMeta.waId,
          fbTraceId: templateResponse.headers.get("x-fb-trace-id")
        });
        return {
          provider: "whatsapp",
          recipient: phone,
          ok: true
        };
      }
      const templatePayload = await templateResponse.text();
      console.error("[order-notifications] whatsapp-template-failed", {
        recipient: maskPhone(phone),
        status: templateResponse.status,
        payload: truncateForLog(templatePayload)
      });
      return {
        provider: "whatsapp",
        recipient: phone,
        ok: false,
        error: `WhatsApp text+template send failed. text=${payload} template=${templatePayload}`
      };
    }
    return {
      provider: "whatsapp",
      recipient: phone,
      ok: false,
      error: payload || `WhatsApp API failed (${response.status})`
    };
  }
  const payload = await response.text();
  const successMeta = parseWhatsappApiSuccess(payload);
  console.log("[order-notifications] whatsapp-text-success", {
    recipient: maskPhone(phone),
    messageId: successMeta.messageId,
    waId: successMeta.waId,
    fbTraceId: response.headers.get("x-fb-trace-id")
  });
  return {
    provider: "whatsapp",
    recipient: phone,
    ok: true
  };
}
export async function sendOrderNotifications(input) {
  const { eventType, order, paymentDetails } = input;
  const adminEmails = dedupe([
    ...DEFAULT_ADMIN_EMAILS,
    ...splitCsv(Deno.env.get("ORDER_NOTIFICATION_ADMIN_EMAILS"))
  ].map(normalizeEmail));
  const customerEmail = normalizeEmail(order.customer.email);
  const emailRecipientsForUser = customerEmail ? [
    customerEmail
  ] : [];
  const emailRecipientsForAdmin = adminEmails;
  const customerPhone = normalizeWhatsappPhone(order.customer.phone);
  const whatsappRecipientsForUser = customerPhone ? [
    customerPhone
  ] : [];
  console.log("[order-notifications] dispatch-plan", {
    eventType,
    orderId: order.id,
    amount: order.totalAmount,
    paymentStatus: order.paymentStatus,
    userEmailRecipients: emailRecipientsForUser.map(maskEmail),
    adminEmailRecipients: emailRecipientsForAdmin.map(maskEmail),
    userWhatsappRecipients: whatsappRecipientsForUser.map(maskPhone),
    adminWhatsappRecipients: [],
    hasPaymentDetails: Boolean(paymentDetails)
  });
  const summaryText = buildTextSummary(eventType, order, paymentDetails);
  const userSubject = eventType === "payment_verified" ? `Payment confirmed for order ${order.id}` : `Order confirmation ${order.id}`;
  const adminSubject = eventType === "payment_verified" ? `Payment update ${order.id}` : `New order ${order.id}`;
  const userBody = buildEmailBody(eventType, order, paymentDetails);
  const adminBody = buildEmailBody(eventType, order, paymentDetails);
  const reports = [];
  reports.push(...await sendEmail(emailRecipientsForUser, userSubject, userBody));
  reports.push(...await sendEmail(emailRecipientsForAdmin, adminSubject, adminBody));
  for (const recipient of whatsappRecipientsForUser){
    reports.push(await sendWhatsappMessage(recipient, summaryText));
  }
  const sent = reports.filter((entry)=>entry.ok);
  const failed = reports.filter((entry)=>!entry.ok);
  console.log("[order-notifications] dispatch-result", {
    orderId: order.id,
    eventType,
    attempted: reports.length,
    sent: sent.length,
    failed: failed.length,
    failedReports: failed.map((entry)=>({
        provider: entry.provider,
        recipient: entry.provider === "email" ? maskEmail(entry.recipient) : maskPhone(entry.recipient),
        error: truncateForLog(String(entry.error ?? "unknown error"))
      }))
  });
  return {
    ok: failed.length === 0,
    attempted: reports.length,
    sent: sent.length,
    failed: failed.length,
    reports
  };
}
