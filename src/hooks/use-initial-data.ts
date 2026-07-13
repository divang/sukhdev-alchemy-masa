import { useEffect, useState } from 'react'
import { useKV } from '@/hooks/use-kv'
import type { Category, Product, Review, Testimonial } from '@/lib/types'
import { loadCatalogFromSupabase } from '@/lib/catalog'
import { CATALOG_SEED_CATEGORIES, CATALOG_SEED_PRODUCTS } from '@/lib/catalog-seed'

const CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CATALOG_CACHE_FALLBACK_BUSTER = 'catalog-v2'

type CatalogCacheMeta = {
  fetchedAt: number
  buster: string
}

export function useInitialData() {
  const [categories, setCategories] = useKV<Category[]>('categories', CATALOG_SEED_CATEGORIES)
  const [products, setProducts] = useKV<Product[]>('products', CATALOG_SEED_PRODUCTS)
  const [reviews, setReviews] = useKV<Review[]>('reviews', [])
  const [testimonials, setTestimonials] = useKV<Testimonial[]>('testimonials', [])
  const [dataVersion, setDataVersion] = useKV<number>('data-version', 0)
  const [catalogCacheMeta, setCatalogCacheMeta] = useKV<CatalogCacheMeta | null>('catalog-cache-meta', null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    const initializeData = async () => {
      const currentVersion = 25
      const isLocalDev = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost'
        || window.location.hostname === '127.0.0.1'
        || window.location.hostname === '::1'
      )
      const forceRemoteRefresh = import.meta.env.DEV || isLocalDev
      const cacheBuster = (import.meta.env.VITE_CATALOG_CACHE_BUSTER as string | undefined)?.trim() || CATALOG_CACHE_FALLBACK_BUSTER
      const now = Date.now()
      const hasLocalCatalog = Boolean(categories?.length) && Boolean(products?.length)
      const isVersionCurrent = (dataVersion ?? 0) >= currentVersion
      const isFreshByTtl = Boolean(catalogCacheMeta?.fetchedAt) && now - (catalogCacheMeta?.fetchedAt ?? 0) < CATALOG_CACHE_TTL_MS
      const isBusterCurrent = catalogCacheMeta?.buster === cacheBuster
      const canUseLocalCache = hasLocalCatalog && isVersionCurrent && isFreshByTtl && isBusterCurrent && !forceRemoteRefresh

      if (canUseLocalCache) {
        setIsHydrated(true)
      }
      
      if (!categories || categories.length === 0) {
        setCategories([
          {
            id: 'premium-masala',
            name: 'Premium Blended Masala',
            slug: 'premium-masala',
            enabled: true,
          },
          {
            id: 'tea-masala',
            name: 'Tea Masala',
            slug: 'tea-masala',
            enabled: true,
          },
          {
            id: 'combo-pack-masala',
            name: 'Combo Pack Masala',
            slug: 'combo-pack-masala',
            enabled: true,
          },
          {
            id: 'raw-organic-spices',
            name: 'Raw Organic Spices',
            slug: 'raw-organic-spices',
            enabled: false,
          },
        ])
      }

      if (!products || products.length === 0) {
        setProducts(CATALOG_SEED_PRODUCTS)
      setIsHydrated(true)
      }

      if (!testimonials || testimonials.length === 0) {
        setTestimonials([])
      }

      if (!reviews || reviews.length === 0) {
        setReviews([
          {
            id: 'review-geetika-bharwa',
            productId: 'bharwa-masala-premium',
            customerName: 'Geetika',
            rating: 5,
            comment: 'Being a working professional and managing work-from-home responsibilities, I often look for ways to prepare delicious meals without spending hours in the kitchen. Sukhdevi Alchemy spices have been a game-changer for me. Their Chhole Masala, Garam Masala, Chat Masala, and Bharwa Masala help me create authentic, homemade flavors in a fraction of the time. Earlier, achieving that rich aroma and balanced taste required preparing and blending multiple spices. With Sukhdevi Alchemy, I can enjoy the same homemade taste and aroma effortlessly. The Chhole Masala gives my chhole the perfect Punjabi flavor, the Garam Masala adds warmth and depth to curries, the Chat Masala instantly enhances snacks and salads, and the Bharwa Masala makes stuffed vegetables incredibly flavorful. These masalas have helped me save valuable time while ensuring my family enjoys restaurant-quality dishes with the comfort and authenticity of home-cooked food.',
            date: '2026-01-29',
            verified: true,
          },
        ])
      }

      // After a fast local/fallback paint, refresh from DB and replace if remote data is available.
      const remoteCatalog = await loadCatalogFromSupabase()
      if (remoteCatalog.source === 'supabase' && remoteCatalog.products.length > 0) {
        setCategories(remoteCatalog.categories)
        setProducts(remoteCatalog.products)
        setReviews(remoteCatalog.reviews)
        setTestimonials(remoteCatalog.testimonials)
        setDataVersion(currentVersion)
        setCatalogCacheMeta({ fetchedAt: Date.now(), buster: cacheBuster })
        setIsHydrated(true)
        return
      }

      if (remoteCatalog.source === 'supabase' && remoteCatalog.products.length === 0) {
        console.warn('[catalog] Supabase returned empty products. Serving stale/local snapshot to avoid empty storefront.')
      }

      setDataVersion(currentVersion)
      setCatalogCacheMeta({ fetchedAt: Date.now(), buster: cacheBuster })
      setIsHydrated(true)
    }
    
    void initializeData()
    // This initializer is intended to run once per app mount.
    // Including hydrated catalog values in deps can cause recursive updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { categories, products, isHydrated }
}
