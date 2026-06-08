import type { Category, Product, Review, Testimonial } from "@/lib/types"
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
  user_id: string
  rating: number
  comment: string
  verified_purchase: boolean
  created_at: string
}

type ProfileRow = {
  id: string
  full_name: string
}

type TestimonialRow = {
  id: string
  customer_name: string
  rating: number
  comment: string
  testimonial_date: string
  location: string
}

type CatalogSnapshot = {
  categories: Category[]
  products: Product[]
  reviews: Review[]
  testimonials: Testimonial[]
  source: "supabase" | "fallback"
}

const CANONICAL_PREMIUM_PRODUCT_NAMES: Record<string, string> = {
  "garam-masala-premium": "Mix Masala Premium Blend",
  "bharwa-masala-premium": "Bharwa Masala Premium",
  "chat-masala-premium": "Chaat Masala Premium",
  "chhole-masala-premium": "Chole Masala Premium",
}

function normalizeCategoryName(id: string, name: string) {
  if (id === "premium-masala") {
    return "Premium Blended Masala"
  }

  return name
}

function normalizeProductName(id: string, name: string) {
  return CANONICAL_PREMIUM_PRODUCT_NAMES[id] ?? name
}

function inferPackGrams(row: Pick<ProductRow, "id" | "tags" | "sku">) {
  if (Array.isArray(row.tags) && row.tags.includes("combo-pack")) {
    return 200
  }

  if (row.id === "sukhdevi-combo-pack" || row.sku === "PM-COMBO-001") {
    return 200
  }

  return 50
}

export async function loadCatalogFromSupabase(): Promise<CatalogSnapshot> {
  if (!supabase || !isSupabaseConfigured) {
    return { categories: [], products: [], reviews: [], testimonials: [], source: "fallback" }
  }

  const { data: categoriesData, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, slug, enabled")
    .order("sort_order", { ascending: true })

  if (categoriesError) {
    console.error("[catalog] failed to load categories", categoriesError.message)
    return { categories: [], products: [], reviews: [], testimonials: [], source: "fallback" }
  }

  const { data: productsData, error: productsError } = await supabase
    .from("products")
    .select("id, category_id, name, sku, price_per_100g, image_path, rating_avg, review_count, description, ingredients, youtube_url, in_stock, tags")
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (productsError) {
    console.error("[catalog] failed to load products", productsError.message)
    return { categories: [], products: [], reviews: [], testimonials: [], source: "fallback" }
  }

  const { data: reviewsData, error: reviewsError } = await supabase
    .from("product_reviews")
    .select("id, product_id, user_id, rating, comment, verified_purchase, created_at")
    .order("created_at", { ascending: false })

  if (reviewsError) {
    console.error("[catalog] failed to load reviews", reviewsError.message)
  }

  const { data: testimonialsData, error: testimonialsError } = await supabase
    .from("testimonials")
    .select("id, customer_name, rating, comment, testimonial_date, location")
    .eq("is_active", true)
    .order("testimonial_date", { ascending: false })

  if (testimonialsError) {
    console.error("[catalog] failed to load testimonials", testimonialsError.message)
  }

  const reviewUserIds = Array.from(new Set((((reviewsData as ReviewRow[] | null) ?? []).map((row) => row.user_id))))
  const { data: profilesData } = reviewUserIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", reviewUserIds)
    : { data: [] }
  const profileMap = new Map(((profilesData as ProfileRow[] | null) ?? []).map((p) => [p.id, p.full_name]))

  const categories = ((categoriesData as CategoryRow[] | null) ?? []).map((row) => ({
    id: row.id,
    name: normalizeCategoryName(row.id, row.name),
    slug: row.slug,
    enabled: row.enabled,
  }))

  const hasComboCategory = categories.some((category) => category.id === "combo-pack-masala")
  if (!hasComboCategory) {
    categories.push({
      id: "combo-pack-masala",
      name: "Combo Pack Masala",
      slug: "combo-pack-masala",
      enabled: true,
    })
  }

  const products = ((productsData as ProductRow[] | null) ?? []).map((row) => ({
    id: row.id,
    category: row.id === "sukhdevi-combo-pack" || row.sku === "PM-COMBO-001"
      ? "combo-pack-masala"
      : row.category_id,
    name: normalizeProductName(row.id, row.name),
    price: Number(row.price_per_100g),
    packGrams: inferPackGrams(row),
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
    userId: row.user_id,
    productId: row.product_id,
    customerName: profileMap.get(row.user_id)?.trim() || "Verified Customer",
    rating: row.rating,
    comment: row.comment,
    date: row.created_at,
    verified: row.verified_purchase,
  }))

  const testimonials = ((testimonialsData as TestimonialRow[] | null) ?? []).map((row) => ({
    id: row.id,
    customerName: row.customer_name,
    rating: row.rating,
    comment: row.comment,
    date: row.testimonial_date,
    location: row.location,
  }))

  return {
    categories,
    products,
    reviews,
    testimonials,
    source: "supabase",
  }
}

type SubmitReviewInput = {
  productId: string
  rating: number
  comment: string
}

type SubmitReviewResult = {
  review?: Review
  error?: string
}

type PurchasedOrderRow = {
  items: Array<{ productId?: string }>
}

async function hasPaidPurchaseForProduct(userId: string, productId: string) {
  if (!supabase || !isSupabaseConfigured) {
    return { canReview: false, error: "Supabase is not configured." }
  }

  const { data, error } = await supabase
    .from("orders")
    .select("items")
    .eq("user_id", userId)
    .eq("payment_status", "paid")

  if (error) {
    return { canReview: false, error: error.message }
  }

  const canReview = ((data as PurchasedOrderRow[] | null) ?? []).some((order) =>
    Array.isArray(order.items) && order.items.some((item) => item.productId === productId)
  )

  return { canReview }
}

export async function submitProductReview(input: SubmitReviewInput): Promise<SubmitReviewResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { error: "Supabase is not configured." }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: userError?.message ?? "Please sign in to submit a review." }
  }

  const trimmedComment = input.comment.trim()
  if (!trimmedComment) {
    return { error: "Review comment cannot be empty." }
  }

  const purchaseStatus = await hasPaidPurchaseForProduct(user.id, input.productId)
  if (purchaseStatus.error) {
    return { error: purchaseStatus.error }
  }

  if (!purchaseStatus.canReview) {
    return { error: "Only signed-in customers who purchased this item can review it." }
  }

  const { data, error } = await supabase
    .from("product_reviews")
    .upsert(
      {
        product_id: input.productId,
        user_id: user.id,
        rating: input.rating,
        comment: trimmedComment,
      },
      { onConflict: "product_id,user_id" }
    )
    .select("id, product_id, user_id, rating, comment, verified_purchase, created_at")
    .single()

  if (error || !data) {
    return { error: error?.message ?? "Failed to submit review." }
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle()

  const reviewRow = data as ReviewRow
  return {
    review: {
      id: reviewRow.id,
      userId: reviewRow.user_id,
      productId: reviewRow.product_id,
      customerName: (profileRow?.full_name as string | undefined)?.trim() || "Verified Customer",
      rating: reviewRow.rating,
      comment: reviewRow.comment,
      date: reviewRow.created_at,
      verified: reviewRow.verified_purchase,
    },
  }
}

export type AdminProductInput = {
  id: string
  categoryId: string
  sku: string
  name: string
  description: string
  pricePer100g: number
  imagePath: string
  ingredients: string[]
  tags: string[]
  youtubeUrl?: string
  inStock: boolean
  isActive?: boolean
}

type AdminProductResult = {
  product?: Product
  error?: string
}

function mapProductRowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    category: row.category_id,
    name: normalizeProductName(row.id, row.name),
    price: Number(row.price_per_100g),
    packGrams: inferPackGrams(row),
    image: row.image_path,
    rating: Number(row.rating_avg),
    reviewCount: Number(row.review_count),
    description: row.description,
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
    youtubeUrl: row.youtube_url ?? undefined,
    inStock: row.in_stock,
    tags: Array.isArray(row.tags) ? row.tags : [],
    sku: row.sku,
  }
}

export async function updateProductByAdmin(input: AdminProductInput): Promise<AdminProductResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { error: "Supabase is not configured." }
  }

  const { data, error } = await supabase
    .from("products")
    .update({
      category_id: input.categoryId,
      sku: input.sku,
      name: input.name,
      description: input.description,
      price_per_100g: input.pricePer100g,
      image_path: input.imagePath,
      ingredients: input.ingredients,
      tags: input.tags,
      youtube_url: input.youtubeUrl?.trim() || null,
      in_stock: input.inStock,
      is_active: input.isActive ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("id, category_id, name, sku, price_per_100g, image_path, rating_avg, review_count, description, ingredients, youtube_url, in_stock, tags")
    .single()

  if (error || !data) {
    return { error: error?.message ?? "Failed to update product." }
  }

  return { product: mapProductRowToProduct(data as ProductRow) }
}

export async function createProductByAdmin(input: AdminProductInput): Promise<AdminProductResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { error: "Supabase is not configured." }
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      id: input.id,
      category_id: input.categoryId,
      sku: input.sku,
      name: input.name,
      description: input.description,
      price_per_100g: input.pricePer100g,
      image_path: input.imagePath,
      ingredients: input.ingredients,
      tags: input.tags,
      youtube_url: input.youtubeUrl?.trim() || null,
      in_stock: input.inStock,
      is_active: input.isActive ?? true,
    })
    .select("id, category_id, name, sku, price_per_100g, image_path, rating_avg, review_count, description, ingredients, youtube_url, in_stock, tags")
    .single()

  if (error || !data) {
    return { error: error?.message ?? "Failed to create product." }
  }

  return { product: mapProductRowToProduct(data as ProductRow) }
}

type AdminCategoryResult = {
  success: boolean
  category?: Category
  error?: string
}

export async function setCategoryEnabledByAdmin(categoryId: string, enabled: boolean): Promise<AdminCategoryResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: "Supabase is not configured." }
  }

  const { data, error } = await supabase
    .from("categories")
    .update({ enabled })
    .eq("id", categoryId)
    .select("id, name, slug, enabled")
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to update category." }
  }

  const row = data as CategoryRow
  return {
    success: true,
    category: {
      id: row.id,
      name: normalizeCategoryName(row.id, row.name),
      slug: row.slug,
      enabled: row.enabled,
    },
  }
}
