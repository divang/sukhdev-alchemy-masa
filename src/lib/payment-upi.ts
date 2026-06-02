import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export type ActiveUpiConfig = {
  displayName: string
  upiId: string
  payeeName: string
}

type PaymentUpiRow = {
  id: string
  display_name: string
  upi_id: string
  payee_name: string
  enabled: boolean
  priority: number
}

export type AdminPaymentUpiAccount = {
  id: string
  displayName: string
  upiId: string
  payeeName: string
  enabled: boolean
  priority: number
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

export async function fetchPaymentUpiAccountsForAdmin(): Promise<{ accounts: AdminPaymentUpiAccount[]; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { accounts: [], error: "Supabase is not configured." }
  }

  const { data, error } = await supabase
    .from("payment_upi_accounts")
    .select("id, display_name, upi_id, payee_name, enabled, priority")
    .order("priority", { ascending: true })

  if (error) {
    return { accounts: [], error: error.message }
  }

  const accounts = ((data as PaymentUpiRow[] | null) ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    upiId: row.upi_id,
    payeeName: row.payee_name,
    enabled: row.enabled,
    priority: row.priority,
  }))

  return { accounts }
}

export async function setPrimaryPaymentUpiAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: "Supabase is not configured." }
  }

  const demoteResult = await supabase
    .from("payment_upi_accounts")
    .update({ priority: 2 })
    .eq("enabled", true)
    .neq("id", accountId)

  if (demoteResult.error) {
    return { success: false, error: demoteResult.error.message }
  }

  const promoteResult = await supabase
    .from("payment_upi_accounts")
    .update({ priority: 1, enabled: true })
    .eq("id", accountId)

  if (promoteResult.error) {
    return { success: false, error: promoteResult.error.message }
  }

  return { success: true }
}

export async function setPaymentUpiAccountEnabled(accountId: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: "Supabase is not configured." }
  }

  const { error } = await supabase
    .from("payment_upi_accounts")
    .update({ enabled })
    .eq("id", accountId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
