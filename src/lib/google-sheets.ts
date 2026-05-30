import type { Order } from "@/lib/types"

const googleSheetsWebhookUrl = import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL

export const isGoogleSheetsConfigured = Boolean(googleSheetsWebhookUrl)

type GoogleSheetsAction = "create_order" | "update_payment" | "update_status"

type GoogleSheetsPayload = {
  action: GoogleSheetsAction
  order?: Order
  orderId?: string
  paymentStatus?: Order["paymentStatus"]
  status?: Order["status"]
  updatedAt?: string
}

export async function postToGoogleSheets(payload: GoogleSheetsPayload): Promise<void> {
  if (!googleSheetsWebhookUrl) {
    throw new Error("Google Sheets webhook is not configured")
  }

  const response = await fetch(googleSheetsWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Google Sheets webhook failed with ${response.status}`)
  }
}
