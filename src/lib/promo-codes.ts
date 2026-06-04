import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import type { RuntimeMode } from "@/lib/runtime-mode"

export type PromoScope = "shipping" | "subtotal" | "total"
export type PromoDiscountType = "fixed" | "percent"

export type PromoCode = {
  id: string
  code: string
  description?: string
  discountScope: PromoScope
  discountType: PromoDiscountType
  discountValue: number
  maxDiscountAmount?: number
  minOrderAmount?: number
  isActive: boolean
  validFrom?: string
  validUntil?: string
  usageLimit?: number
  usageCount: number
  createdAt: string
  updatedAt: string
}

type PromoCodeRow = {
  id: string
  code: string
  description: string | null
  discount_scope: PromoScope
  discount_type: PromoDiscountType
  discount_value: number
  max_discount_amount: number | null
  min_order_amount: number | null
  is_active: boolean
  valid_from: string | null
  valid_until: string | null
  usage_limit: number | null
  usage_count: number
  created_at: string
  updated_at: string
}

type PromoChannelStateRow = {
  key: string
  dev_enabled: boolean
  prod_enabled: boolean
  previous_prod_enabled: boolean | null
  updated_at: string
  promoted_at: string | null
}

export type PromoCodeChannelState = {
  key: string
  devEnabled: boolean
  prodEnabled: boolean
  previousProdEnabled: boolean | null
  updatedAt: string
  promotedAt?: string
}

const PROMO_CHANNEL_KEY = "promo_codes"

const defaultPromoChannelState: PromoCodeChannelState = {
  key: PROMO_CHANNEL_KEY,
  devEnabled: false,
  prodEnabled: true,
  previousProdEnabled: true,
  updatedAt: new Date(0).toISOString(),
}

export type PromoValidationResult = {
  promo?: PromoCode
  discountAmount?: number
  error?: string
}

type ConsumePromoCodeRpcRow = {
  success: boolean
  error: string | null
  usage_count: number | null
  usage_limit: number | null
}

const PROMO_TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function normalizeCode(code: string) {
  return code.trim().toUpperCase()
}

export function generatePromoCodeToken(prefix = "SDA", tokenLength = 8): string {
  const normalizedPrefix = prefix.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8) || "SDA"
  const normalizedLength = Math.min(Math.max(Math.trunc(tokenLength), 4), 20)

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const randomValues = new Uint32Array(normalizedLength)
    crypto.getRandomValues(randomValues)
    const token = Array.from(randomValues)
      .map((value) => PROMO_TOKEN_ALPHABET[value % PROMO_TOKEN_ALPHABET.length])
      .join("")
    return `${normalizedPrefix}${token}`
  }

  const token = Array.from({ length: normalizedLength }, () => {
    const index = Math.floor(Math.random() * PROMO_TOKEN_ALPHABET.length)
    return PROMO_TOKEN_ALPHABET[index]
  }).join("")

  return `${normalizedPrefix}${token}`
}

function mapPromoCodeRow(row: PromoCodeRow): PromoCode {
  return {
    id: row.id,
    code: row.code,
    description: row.description ?? undefined,
    discountScope: row.discount_scope,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    maxDiscountAmount: row.max_discount_amount != null ? Number(row.max_discount_amount) : undefined,
    minOrderAmount: row.min_order_amount != null ? Number(row.min_order_amount) : undefined,
    isActive: row.is_active,
    validFrom: row.valid_from ?? undefined,
    validUntil: row.valid_until ?? undefined,
    usageLimit: row.usage_limit ?? undefined,
    usageCount: Number(row.usage_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPromoChannelStateRow(row: PromoChannelStateRow): PromoCodeChannelState {
  return {
    key: row.key,
    devEnabled: Boolean(row.dev_enabled),
    prodEnabled: Boolean(row.prod_enabled),
    previousProdEnabled: row.previous_prod_enabled,
    updatedAt: row.updated_at,
    promotedAt: row.promoted_at ?? undefined,
  }
}

function isPromoEnabledForMode(channelState: PromoCodeChannelState, runtimeMode: RuntimeMode) {
  return runtimeMode === "dev" ? channelState.devEnabled : channelState.prodEnabled
}

export async function fetchPromoCodeChannelState(): Promise<{ state: PromoCodeChannelState; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { state: defaultPromoChannelState }
  }

  const { data, error } = await supabase
    .from("feature_channel_states")
    .select("key, dev_enabled, prod_enabled, previous_prod_enabled, updated_at, promoted_at")
    .eq("key", PROMO_CHANNEL_KEY)
    .maybeSingle()

  if (error) {
    return { state: defaultPromoChannelState, error: error.message }
  }

  if (!data) {
    return { state: defaultPromoChannelState }
  }

  return { state: mapPromoChannelStateRow(data as PromoChannelStateRow) }
}

export async function setPromoCodeDevEnabledByAdmin(enabled: boolean): Promise<{ state?: PromoCodeChannelState; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { error: "Supabase is not configured." }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from("feature_channel_states")
    .upsert(
      {
        key: PROMO_CHANNEL_KEY,
        dev_enabled: enabled,
        updated_by: user?.id ?? null,
      },
      { onConflict: "key" }
    )
    .select("key, dev_enabled, prod_enabled, previous_prod_enabled, updated_at, promoted_at")
    .single()

  if (error || !data) {
    return { error: error?.message ?? "Failed to update dev promo visibility." }
  }

  return { state: mapPromoChannelStateRow(data as PromoChannelStateRow) }
}

export async function promotePromoCodeDevToProdByAdmin(): Promise<{ state?: PromoCodeChannelState; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { error: "Supabase is not configured." }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const current = await fetchPromoCodeChannelState()
  if (current.error) {
    return { error: current.error }
  }

  const { data, error } = await supabase
    .from("feature_channel_states")
    .upsert(
      {
        key: PROMO_CHANNEL_KEY,
        dev_enabled: current.state.devEnabled,
        previous_prod_enabled: current.state.prodEnabled,
        prod_enabled: current.state.devEnabled,
        promoted_at: new Date().toISOString(),
        promoted_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      },
      { onConflict: "key" }
    )
    .select("key, dev_enabled, prod_enabled, previous_prod_enabled, updated_at, promoted_at")
    .single()

  if (error || !data) {
    return { error: error?.message ?? "Failed to promote dev promo visibility to prod." }
  }

  return { state: mapPromoChannelStateRow(data as PromoChannelStateRow) }
}

export async function rollbackPromoCodeProdByAdmin(): Promise<{ state?: PromoCodeChannelState; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { error: "Supabase is not configured." }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const current = await fetchPromoCodeChannelState()
  if (current.error) {
    return { error: current.error }
  }

  if (current.state.previousProdEnabled == null) {
    return { error: "No previous production state available for rollback." }
  }

  const { data, error } = await supabase
    .from("feature_channel_states")
    .update({
      prod_enabled: current.state.previousProdEnabled,
      updated_by: user?.id ?? null,
    })
    .eq("key", PROMO_CHANNEL_KEY)
    .select("key, dev_enabled, prod_enabled, previous_prod_enabled, updated_at, promoted_at")
    .single()

  if (error || !data) {
    return { error: error?.message ?? "Failed to rollback production promo visibility." }
  }

  return { state: mapPromoChannelStateRow(data as PromoChannelStateRow) }
}

export function calculatePromoDiscountAmount(promo: PromoCode, subtotal: number, shipping: number): number {
  const subtotalAmount = Math.max(0, subtotal)
  const shippingAmount = Math.max(0, shipping)
  const totalAmount = subtotalAmount + shippingAmount

  const baseAmount = promo.discountScope === "shipping"
    ? shippingAmount
    : promo.discountScope === "subtotal"
      ? subtotalAmount
      : totalAmount

  if (baseAmount <= 0) {
    return 0
  }

  let discount = promo.discountType === "percent"
    ? (baseAmount * promo.discountValue) / 100
    : promo.discountValue

  if (promo.maxDiscountAmount != null) {
    discount = Math.min(discount, promo.maxDiscountAmount)
  }

  if (promo.discountScope === "shipping") {
    discount = Math.min(discount, shippingAmount)
  }

  discount = Math.min(discount, totalAmount)
  return Math.max(0, Number(discount.toFixed(2)))
}

export async function fetchActivePromoCodesForAdmin(): Promise<{ promoCodes: PromoCode[]; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { promoCodes: [], error: "Supabase is not configured." }
  }

  const { data, error } = await supabase
    .from("promo_codes")
    .select("id, code, description, discount_scope, discount_type, discount_value, max_discount_amount, min_order_amount, is_active, valid_from, valid_until, usage_limit, usage_count, created_at, updated_at")
    .order("created_at", { ascending: false })

  if (error) {
    return { promoCodes: [], error: error.message }
  }

  return { promoCodes: ((data as PromoCodeRow[] | null) ?? []).map(mapPromoCodeRow) }
}

export type UpsertPromoCodeInput = {
  id?: string
  code: string
  description?: string
  discountScope: PromoScope
  discountType: PromoDiscountType
  discountValue: number
  maxDiscountAmount?: number
  minOrderAmount?: number
  validFrom?: string
  validUntil?: string
  usageLimit?: number
  isActive: boolean
}

export async function upsertPromoCodeByAdmin(input: UpsertPromoCodeInput): Promise<{ promoCode?: PromoCode; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { error: "Supabase is not configured." }
  }

  const normalizedCode = normalizeCode(input.code)
  if (!normalizedCode) {
    return { error: "Promo code is required." }
  }

  const id = input.id ?? (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

  const payload = {
    id,
    code: normalizedCode,
    description: input.description?.trim() || null,
    discount_scope: input.discountScope,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    max_discount_amount: input.maxDiscountAmount ?? null,
    min_order_amount: input.minOrderAmount ?? null,
    valid_from: input.validFrom ?? null,
    valid_until: input.validUntil ?? null,
    usage_limit: input.usageLimit ?? null,
    is_active: input.isActive,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("promo_codes")
    .upsert(payload, { onConflict: "id" })
    .select("id, code, description, discount_scope, discount_type, discount_value, max_discount_amount, min_order_amount, is_active, valid_from, valid_until, usage_limit, usage_count, created_at, updated_at")
    .single()

  if (error || !data) {
    return { error: error?.message ?? "Failed to save promo code." }
  }

  return { promoCode: mapPromoCodeRow(data as PromoCodeRow) }
}

export async function consumePromoCodeUsage(inputCode: string): Promise<{ success: boolean; error?: string; usageCount?: number; usageLimit?: number }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: "Supabase is not configured." }
  }

  const code = normalizeCode(inputCode)
  if (!code) {
    return { success: false, error: "Please enter a promo code." }
  }

  const { data, error } = await supabase
    .rpc("consume_promo_code_usage", { p_code: code })
    .maybeSingle()

  if (error) {
    return { success: false, error: error.message }
  }

  const result = data as ConsumePromoCodeRpcRow | null
  if (!result) {
    return { success: false, error: "Promo code could not be consumed." }
  }

  if (!result.success) {
    return { success: false, error: result.error ?? "Promo code is no longer available." }
  }

  return {
    success: true,
    usageCount: result.usage_count ?? undefined,
    usageLimit: result.usage_limit ?? undefined,
  }
}

export async function validatePromoCode(
  inputCode: string,
  subtotal: number,
  shipping: number,
  runtimeMode: RuntimeMode = "prod"
): Promise<PromoValidationResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { error: "Supabase is not configured." }
  }

  const channelStateResult = await fetchPromoCodeChannelState()
  if (!isPromoEnabledForMode(channelStateResult.state, runtimeMode)) {
    return {
      error: runtimeMode === "dev"
        ? "Promo codes are disabled in dev mode. Enable it in Admin -> Promo Channel Controls."
        : "Promo codes are currently unavailable.",
    }
  }

  const code = normalizeCode(inputCode)
  if (!code) {
    return { error: "Please enter a promo code." }
  }

  const { data, error } = await supabase
    .from("promo_codes")
    .select("id, code, description, discount_scope, discount_type, discount_value, max_discount_amount, min_order_amount, is_active, valid_from, valid_until, usage_limit, usage_count, created_at, updated_at")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    return { error: error.message }
  }

  if (!data) {
    return { error: "Invalid or inactive promo code." }
  }

  const promo = mapPromoCodeRow(data as PromoCodeRow)
  const now = Date.now()

  if (promo.validFrom && now < new Date(promo.validFrom).getTime()) {
    return { error: "This promo code is not active yet." }
  }

  if (promo.validUntil && now > new Date(promo.validUntil).getTime()) {
    return { error: "This promo code has expired." }
  }

  if (promo.usageLimit != null && promo.usageCount >= promo.usageLimit) {
    return { error: "This promo code has reached its usage limit." }
  }

  if (promo.minOrderAmount != null && subtotal < promo.minOrderAmount) {
    return { error: `Promo code is valid on orders above Rs${promo.minOrderAmount}.` }
  }

  const discountAmount = calculatePromoDiscountAmount(promo, subtotal, shipping)
  if (discountAmount <= 0) {
    return { error: "Promo code does not apply to this cart." }
  }

  return { promo, discountAmount }
}
