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
