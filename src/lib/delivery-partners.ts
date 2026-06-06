import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export type DeliveryPartnerKey = "shiprocket" | "delhivery" | "nimbuspost" | "smartship"

export type ActiveDeliveryPartnerConfig = {
  providerKey: DeliveryPartnerKey
  displayName: string
  enabled: boolean
  priority: number
}

type DeliveryPartnerRow = {
  id: string
  provider_key: DeliveryPartnerKey
  display_name: string
  enabled: boolean
  priority: number
}

export type AdminDeliveryPartnerAccount = {
  id: string
  providerKey: DeliveryPartnerKey
  displayName: string
  enabled: boolean
  priority: number
}

const fallbackDeliveryPartner: ActiveDeliveryPartnerConfig = {
  providerKey: "shiprocket",
  displayName: "Shiprocket",
  enabled: true,
  priority: 1,
}

export async function fetchActiveDeliveryPartnerConfig(): Promise<{ config: ActiveDeliveryPartnerConfig; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { config: fallbackDeliveryPartner }
  }

  const { data, error } = await supabase
    .from("delivery_partner_accounts")
    .select("provider_key, display_name, enabled, priority")
    .eq("enabled", true)
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { config: fallbackDeliveryPartner, error: error.message }
  }

  if (!data) {
    return { config: fallbackDeliveryPartner, error: "No enabled delivery partners found." }
  }

  const row = data as DeliveryPartnerRow

  return {
    config: {
      providerKey: row.provider_key,
      displayName: row.display_name,
      enabled: row.enabled,
      priority: row.priority,
    },
  }
}

export async function fetchDeliveryPartnerAccountsForAdmin(): Promise<{ accounts: AdminDeliveryPartnerAccount[]; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { accounts: [], error: "Supabase is not configured." }
  }

  const { data, error } = await supabase
    .from("delivery_partner_accounts")
    .select("id, provider_key, display_name, enabled, priority")
    .order("priority", { ascending: true })

  if (error) {
    return { accounts: [], error: error.message }
  }

  const accounts = ((data as DeliveryPartnerRow[] | null) ?? []).map((row) => ({
    id: row.id,
    providerKey: row.provider_key,
    displayName: row.display_name,
    enabled: row.enabled,
    priority: row.priority,
  }))

  return { accounts }
}

export async function setPrimaryDeliveryPartnerAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: "Supabase is not configured." }
  }

  const demoteResult = await supabase
    .from("delivery_partner_accounts")
    .update({ priority: 2 })
    .eq("enabled", true)
    .neq("id", accountId)

  if (demoteResult.error) {
    return { success: false, error: demoteResult.error.message }
  }

  const promoteResult = await supabase
    .from("delivery_partner_accounts")
    .update({ priority: 1, enabled: true })
    .eq("id", accountId)

  if (promoteResult.error) {
    return { success: false, error: promoteResult.error.message }
  }

  return { success: true }
}

export async function setDeliveryPartnerEnabled(accountId: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: "Supabase is not configured." }
  }

  const { error } = await supabase
    .from("delivery_partner_accounts")
    .update({ enabled })
    .eq("id", accountId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}