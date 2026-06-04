import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export type AdminNotification = {
  id: string
  eventType: "new_user" | "new_order"
  title: string
  message: string
  payload: Record<string, unknown>
  createdAt: string
  whatsappSentAt?: string
  emailSentAt?: string
}

type AdminNotificationRow = {
  id: string
  event_type: "new_user" | "new_order"
  title: string
  message: string
  payload: Record<string, unknown> | null
  created_at: string
  whatsapp_sent_at: string | null
  email_sent_at: string | null
}

function mapAdminNotificationRow(row: AdminNotificationRow): AdminNotification {
  return {
    id: row.id,
    eventType: row.event_type,
    title: row.title,
    message: row.message,
    payload: row.payload ?? {},
    createdAt: row.created_at,
    whatsappSentAt: row.whatsapp_sent_at ?? undefined,
    emailSentAt: row.email_sent_at ?? undefined,
  }
}

export async function fetchAdminNotifications(limit = 50): Promise<{ notifications: AdminNotification[]; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { notifications: [], error: "Supabase is not configured." }
  }

  const { data, error } = await supabase
    .from("admin_notifications")
    .select("id, event_type, title, message, payload, created_at, whatsapp_sent_at, email_sent_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    return { notifications: [], error: error.message }
  }

  return {
    notifications: ((data as AdminNotificationRow[] | null) ?? []).map(mapAdminNotificationRow),
  }
}

export async function markAdminNotificationWhatsappSent(id: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: "Supabase is not configured." }
  }

  const { error } = await supabase
    .from("admin_notifications")
    .update({ whatsapp_sent_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function markAdminNotificationEmailSent(id: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: "Supabase is not configured." }
  }

  const { error } = await supabase
    .from("admin_notifications")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
