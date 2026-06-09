import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

export type NormalizedOrderItem = {
  productId: string
  productName: string
  quantity: number
  grams: number
  pricePerUnit: number
}

type OrderItemRow = {
  order_id: string
  product_id: string | null
  product_name: string
  quantity: number | null
  pack_grams: number | null
  unit_price: number | null
}

export async function fetchNormalizedOrderItems(
  client: SupabaseClient,
  orderIds: string[],
): Promise<Map<string, NormalizedOrderItem[]>> {
  const itemsByOrder = new Map<string, NormalizedOrderItem[]>()

  if (orderIds.length === 0) {
    return itemsByOrder
  }

  const { data, error } = await client
    .from("order_items")
    .select("order_id, product_id, product_name, quantity, pack_grams, unit_price")
    .in("order_id", orderIds)
    .order("legacy_item_ordinal", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    return itemsByOrder
  }

  for (const row of (data as OrderItemRow[] | null) ?? []) {
    const items = itemsByOrder.get(row.order_id) ?? []
    items.push({
      productId: row.product_id ?? "",
      productName: String(row.product_name ?? "Item"),
      quantity: Number(row.quantity ?? 0),
      grams: Number(row.pack_grams ?? 0),
      pricePerUnit: Number(row.unit_price ?? 0),
    })
    itemsByOrder.set(row.order_id, items)
  }

  return itemsByOrder
}

export function preferNormalizedItems<T extends { productName?: string; quantity?: number; grams?: number; pricePerUnit?: number }>(
  orderId: string,
  normalized: Map<string, NormalizedOrderItem[]>,
  legacyItems: T[] | null | undefined,
): NormalizedOrderItem[] {
  const normalizedItems = normalized.get(orderId)
  if (normalizedItems && normalizedItems.length > 0) {
    return normalizedItems
  }

  return (legacyItems ?? []).map((item) => ({
    productId: "",
    productName: String(item.productName ?? "Item"),
    quantity: Number(item.quantity ?? 0),
    grams: Number(item.grams ?? 0),
    pricePerUnit: Number(item.pricePerUnit ?? 0),
  }))
}