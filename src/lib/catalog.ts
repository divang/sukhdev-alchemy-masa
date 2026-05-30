import type { Category, Product, Review } from "@/lib/types"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

type CategoryRow = {
  id: string
  name: string
  slug: string
  enabled: boolean
}

type ProductRow = {
  id: string
  category_id: string
  name: string
  sku: string
  price_per_100g: number
  image_path: string
  rating_avg: number
  review_count: number
  description: string
  ingredients: string[]
  youtube_url: string | null
  in_stock: boolean
  tags: string[]
}

type ReviewRow = {
  id: string
  product_id: string
  rating: number
  comment: string
  verified_purchase: boolean
  created_at: string
  profiles?: {
    full_name: string
  } | null
}

type CatalogSnapshot = {
  categories: Category[]
  products: Product[]
  reviews: Review[]
  source: "supabase" | "fallback"
}

export async function loadCatalogFromSupabase(): Promise<CatalogSnapshot> {
  if (!supabase || !isSupabaseConfigured) {
    return { categories: [], products: [], reviews: [], source: "fallback" }
  }

  const { data: categoriesData, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, slug, enabled")
    .order("sort_order", { ascending: true })

  if (categoriesError) {
    console.error("[catalog] failed to load categories", categoriesError.message)
    return { categories: [], products: [], reviews: [], source: "fallback" }
  }

  const { data: productsData, error: productsError } = await supabase
    .from("products")
    .select("id, category_id, name, sku, price_per_100g, image_path, rating_avg, review_count, description, ingredients, youtube_url, in_stock, tags")
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (productsError) {
    console.error("[catalog] failed to load products", productsError.message)
    return { categories: [], products: [], reviews: [], source: "fallback" }
  }

  const { data: reviewsData, error: reviewsError } = await supabase
    .from("product_reviews")
    .select("id, product_id, rating, comment, verified_purchase, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })

  if (reviewsError) {
    console.error("[catalog] failed to load reviews", reviewsError.message)
  }

  const categories = ((categoriesData as CategoryRow[] | null) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    enabled: row.enabled,
  }))

  const products = ((productsData as ProductRow[] | null) ?? []).map((row) => ({
    id: row.id,
    category: row.category_id,
    name: row.name,
    price: Number(row.price_per_100g),
    image: row.image_path,
    rating: Number(row.rating_avg),
    reviewCount: Number(row.review_count),
    description: row.description,
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
    youtubeUrl: row.youtube_url ?? undefined,
    inStock: row.in_stock,
    tags: Array.isArray(row.tags) ? row.tags : [],
    sku: row.sku,
  }))

  const reviews = ((reviewsData as ReviewRow[] | null) ?? []).map((row) => ({
    id: row.id,
    productId: row.product_id,
    customerName: row.profiles?.full_name?.trim() || "Verified Customer",
    rating: row.rating,
    comment: row.comment,
    date: row.created_at,
    verified: row.verified_purchase,
  }))

  return {
    categories,
    products,
    reviews,
    source: "supabase",
  }
}
