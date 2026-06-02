import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export type ActiveUpiConfig = {
  displayName: string
  upiId: string
  payeeName: string
}

type PaymentUpiRow = {
  display_name: string
  upi_id: string
  payee_name: string
}

export const fallbackUpiConfig: ActiveUpiConfig = {
  displayName: "Primary UPI",
  upiId: "poonam.om.107@okicici",
  payeeName: "Sukhdevi Alchemy",
}

export async function fetchActiveUpiConfig(): Promise<{ config: ActiveUpiConfig; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { config: fallbackUpiConfig }
  }

  const { data, error } = await supabase
    .from("payment_upi_accounts")
    .select("display_name, upi_id, payee_name")
    .eq("enabled", true)
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { config: fallbackUpiConfig, error: error.message }
  }

  if (!data) {
    return { config: fallbackUpiConfig, error: "No enabled UPI accounts found." }
  }

  const row = data as PaymentUpiRow

  return {
    config: {
      displayName: row.display_name,
      upiId: row.upi_id,
      payeeName: row.payee_name,
    },
  }
}
