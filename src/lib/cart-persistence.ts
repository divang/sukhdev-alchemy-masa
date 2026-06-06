import type { CartItem } from "@/lib/types"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

type CartRow = {
  product_id: string
  quantity: number
  grams: number
  updated_at?: string
}

type CartLoadResult = {
  cartItems: CartItem[]
  error?: string
}

type CartPersistenceResult = {
  persisted: boolean
  error?: string
}

function getCartItemKey(productId: string, grams: number) {
  return `${productId}:${grams}`
}

function dedupeCartRows(rows: CartRow[] | null | undefined): CartItem[] {
  const merged = new Map<string, CartItem>()

  for (const row of rows ?? []) {
    const productId = row.product_id
    const grams = Number(row.grams)
    const quantity = Number(row.quantity)
    const key = getCartItemKey(productId, grams)
    const existing = merged.get(key)

    if (existing) {
      merged.set(key, {
        ...existing,
        quantity: Math.max(existing.quantity, quantity),
      })
      continue
    }

    merged.set(key, {
      productId,
      quantity,
      grams,
    })
  }

  return [...merged.values()]
}

function assertClient() {
  if (!supabase || !isSupabaseConfigured) {
    return null
  }

  return supabase
}

async function getSignedInUserId() {
  const client = assertClient()
  if (!client) {
    return { userId: null as string | null, error: "Supabase is not configured." }
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser()

  return {
    userId: user?.id ?? null,
    error: error?.message,
  }
}

export async function fetchCartForCurrentUser(): Promise<CartLoadResult> {
  const client = assertClient()
  if (!client) {
    return { cartItems: [], error: "Supabase is not configured." }
  }

  const { userId, error: userError } = await getSignedInUserId()
  if (!userId) {
    return { cartItems: [], error: userError ?? "No signed-in user found." }
  }

  const { data, error } = await client
    .from("cart_items")
    .select("product_id, quantity, grams, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    return { cartItems: [], error: error.message }
  }

  return {
    cartItems: dedupeCartRows(data as CartRow[] | null),
  }
}

export async function upsertCartItemForCurrentUser(item: CartItem): Promise<CartPersistenceResult> {
  const client = assertClient()
  if (!client) {
    return { persisted: false, error: "Supabase is not configured." }
  }

  const { userId, error: userError } = await getSignedInUserId()
  if (!userId) {
    return { persisted: false, error: userError ?? "No signed-in user found." }
  }

  const { error } = await client.from("cart_items").upsert(
    {
      user_id: userId,
      product_id: item.productId,
      quantity: item.quantity,
      grams: item.grams,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,product_id,grams" }
  )

  if (error) {
    return { persisted: false, error: error.message }
  }

  return { persisted: true }
}

export async function removeCartItemForCurrentUser(productId: string, grams: number): Promise<CartPersistenceResult> {
  const client = assertClient()
  if (!client) {
    return { persisted: false, error: "Supabase is not configured." }
  }

  const { userId, error: userError } = await getSignedInUserId()
  if (!userId) {
    return { persisted: false, error: userError ?? "No signed-in user found." }
  }

  const { error } = await client
    .from("cart_items")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId)
    .eq("grams", grams)

  if (error) {
    return { persisted: false, error: error.message }
  }

  return { persisted: true }
}

export async function replaceCartForCurrentUser(cartItems: CartItem[]): Promise<CartPersistenceResult> {
  const client = assertClient()
  if (!client) {
    return { persisted: false, error: "Supabase is not configured." }
  }

  const { userId, error: userError } = await getSignedInUserId()
  if (!userId) {
    return { persisted: false, error: userError ?? "No signed-in user found." }
  }

  const deleteResult = await client.from("cart_items").delete().eq("user_id", userId)
  if (deleteResult.error) {
    return { persisted: false, error: deleteResult.error.message }
  }

  if (cartItems.length === 0) {
    return { persisted: true }
  }

  const { error } = await client.from("cart_items").insert(
    cartItems.map((item) => ({
      user_id: userId,
      product_id: item.productId,
      quantity: item.quantity,
      grams: item.grams,
      updated_at: new Date().toISOString(),
    }))
  )

  if (error) {
    return { persisted: false, error: error.message }
  }

  return { persisted: true }
}