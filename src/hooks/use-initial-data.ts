import { useEffect, useState } from 'react'
import { useKV } from '@/hooks/use-kv'
import type { Category, Product, Review, Testimonial } from '@/lib/types'
import { loadCatalogFromSupabase } from '@/lib/catalog'
import { CATALOG_SEED_CATEGORIES, CATALOG_SEED_PRODUCTS } from '@/lib/catalog-seed'

const CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CATALOG_CACHE_FALLBACK_BUSTER = 'catalog-v1'

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
      const currentVersion = 18
      const cacheBuster = (import.meta.env.VITE_CATALOG_CACHE_BUSTER as string | undefined)?.trim() || CATALOG_CACHE_FALLBACK_BUSTER
      const now = Date.now()
      const hasLocalCatalog = Boolean(categories?.length) && Boolean(products?.length)
      const isVersionCurrent = (dataVersion ?? 0) >= currentVersion
      const isFreshByTtl = Boolean(catalogCacheMeta?.fetchedAt) && now - (catalogCacheMeta?.fetchedAt ?? 0) < CATALOG_CACHE_TTL_MS
      const isBusterCurrent = catalogCacheMeta?.buster === cacheBuster
      const canUseLocalCache = hasLocalCatalog && isVersionCurrent && isFreshByTtl && isBusterCurrent

      if (canUseLocalCache) {
        setIsHydrated(true)
        return
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
        setProducts([
          {
            id: 'garam-masala-premium',
            name: 'Mix Masala Premium Blend',
            category: 'premium-masala',
            price: 210,
            packGrams: 50,
            image: 'images/products/garam-masala-premium.png',
            rating: 4.8,
            reviewCount: 0,
            description: 'Our flagship, rich, and highly aromatic blend crafted with rare and expensive spices like Stone Flower, Long Pepper, and Mace. No added salt or fillers.',
            ingredients: [
              'Cumin (Jeera)',
              'Caraway Seeds (Shahi Jeera)',
              'Black Cardamom (Badi Elaichi)',
              'Coriander (Dhaniya)',
              'Black Pepper (Kali Mirch)',
              'White Pepper (Safed Mirch)',
              'Cloves (Laung)',
              'Green Cardamom (Choti Elaichi)',
              'Mace (Javitri)',
              'Turmeric (Haldi)',
              'Poppy Seeds (Khas Khas)',
              'Dried Fenugreek Leaves (Kasuri Methi)',
              'Cinnamon (Dalchini)',
              'Nutmeg (Jaiphal)',
              'Long Pepper (Pipali)',
              'Star Anise (Chakra Phool)',
              'Stone Flower (Patthar Phool)',
              'Bay Leaf (Tej Patta)'
            ],
            youtubeUrl: 'https://youtu.be/pDOFN9OEKt4?si=RyDFBeFCk1LY0ZHi',
            inStock: true,
            tags: ['bestseller', 'premium', 'aromatic'],
          },
        {
          id: 'bharwa-masala-premium',
          name: 'Bharwa Masala Premium',
          category: 'premium-masala',
          price: 125,
          packGrams: 50,
          image: 'images/products/bharwa-masala-premium.png',
          rating: 4.7,
          reviewCount: 0,
          description: 'A fragrant, coarsely ground blend dominated by roasted cumin and fennel. Designed specifically to bring out the best in stuffed karela, bhindi, or baingan.',
          ingredients: [
            'Cumin (Jeera)',
            'Fennel (Saunf)',
            'Coriander (Dhaniya)',
            'Dry Mango Powder (Amchoor)',
            'Red Chilli (Lal Mirch)',
            'Edible Common Salt',
            'Turmeric (Haldi)'
          ],
          youtubeUrl: 'https://youtu.be/pDOFN9OEKt4?si=RyDFBeFCk1LY0ZHi',
          inStock: true,
          tags: ['premium', 'stuffed-veggies', 'tangy'],
        },
        {
          id: 'chat-masala-premium',
          name: 'Chaat Masala Premium',
          category: 'premium-masala',
          price: 145,
          packGrams: 50,
          image: 'images/products/chat-masala-premium.png',
          rating: 4.9,
          reviewCount: 0,
          description: 'A highly addictive, lip-smacking blend that balances tartness with a spicy kick. Perfect for sprinkling on fruits, salads, and street-style snacks.',
          ingredients: [
            'Cumin (Jeera)',
            'Dry Mango Powder (Amchoor)',
            'Coriander (Dhaniya)',
            'Black Salt (Kala Namak)',
            'Edible Common Salt',
            'Black Pepper (Kali Mirch)',
            'White Pepper (Safed Mirch)',
            'Red Chilli (Lal Mirch)',
            'Dry Ginger (Sonth)',
            'Tartaric Acid (Tatri)',
            'Sugar',
            'Dried Gooseberry (Amla)',
            'Carom Seeds (Ajwain)'
          ],
          youtubeUrl: 'https://youtu.be/pDOFN9OEKt4?si=RyDFBeFCk1LY0ZHi',
          inStock: true,
          tags: ['bestseller', 'premium', 'tangy', 'street-food'],
        },
        {
          id: 'chhole-masala-premium',
          name: 'Chole Masala Premium',
          category: 'premium-masala',
          price: 160,
          packGrams: 50,
          image: 'images/products/chhole-masala-premium.png',
          rating: 4.8,
          reviewCount: 0,
          description: 'A perfectly balanced, dark, and tangy blend featuring premium Bedgi chillies and Anardana for that authentic Punjabi Chole flavor.',
          ingredients: [
            'Coriander (Dhaniya)',
            'Cumin (Jeera)',
            'Dry Mango Powder (Amchoor)',
            'Fennel (Saunf)',
            'Pomegranate Seeds (Anardana)',
            'Black Pepper (Kali Mirch)',
            'Bedgi Red Chilli',
            'Black Cardamom (Badi Elaichi)',
            'Cinnamon (Dalchini)',
            'Green Cardamom (Choti Elaichi)',
            'Cloves (Laung)',
            'Dry Ginger (Sonth)',
            'Black Salt (Kala Namak)',
            'Rock Salt (Sendha Namak)',
            'Bay Leaf (Tej Patta)',
            'Carom Seeds (Ajwain)',
            'Turmeric (Haldi)',
            'White Pepper (Safed Mirch)',
            'Dried Fenugreek Leaves (Kasuri Methi)',
            'Mace (Javitri)',
            'Caraway Seeds (Shahi Jeera)',
            'Kachri'
          ],
          youtubeUrl: 'https://youtu.be/pDOFN9OEKt4?si=RyDFBeFCk1LY0ZHi',
          inStock: true,
          tags: ['premium', 'punjabi', 'aromatic'],
        },
        {
          id: 'sukhdevi-combo-pack',
          name: 'Sukhdevi Combo Pack',
          category: 'combo-pack-masala',
          price: 640,
          packGrams: 200,
          image: 'images/products/SDA-Combo-Pack.jpeg',
          rating: 5,
          reviewCount: 0,
          description: 'All four signature 50g masalas in one order: Bharwa Masala, Chaat Masala, Chole Masala, and Mix Masala Premium Blend. Free shipping applies automatically because the combo subtotal is above ₹500.',
          ingredients: [
            '1 x Bharwa Masala 50g',
            '1 x Chaat Masala 50g',
            '1 x Chole Masala 50g',
            '1 x Mix Masala Premium Blend 50g'
          ],
          youtubeUrl: 'https://youtu.be/pDOFN9OEKt4?si=RyDFBeFCk1LY0ZHi',
          inStock: true,
          tags: ['combo-pack', 'free-shipping', 'giftable'],
        },
      ])
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
        setCatalogCacheMeta({ fetchedAt: now, buster: cacheBuster })
        setIsHydrated(true)
        return
      }

      if (remoteCatalog.source === 'supabase' && remoteCatalog.products.length === 0) {
        console.warn('[catalog] Supabase returned empty products. Serving stale/local snapshot to avoid empty storefront.')
      }

      setDataVersion(currentVersion)
      setCatalogCacheMeta({ fetchedAt: now, buster: cacheBuster })
      setIsHydrated(true)
    }
    
    void initializeData()
    // This initializer is intended to run once per app mount.
    // Including hydrated catalog values in deps can cause recursive updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { categories, products, isHydrated }
}
