import { useEffect, useState } from 'react'
import { useKV } from '@/hooks/use-kv'
import type { Category, Product, Review, Testimonial } from '@/lib/types'
import { loadCatalogFromSupabase } from '@/lib/catalog'

const CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CATALOG_CACHE_FALLBACK_BUSTER = 'catalog-v1'

type CatalogCacheMeta = {
  fetchedAt: number
  buster: string
}

export function useInitialData() {
  const [categories, setCategories] = useKV<Category[]>('categories', [])
  const [products, setProducts] = useKV<Product[]>('products', [])
  const [reviews, setReviews] = useKV<Review[]>('reviews', [])
  const [testimonials, setTestimonials] = useKV<Testimonial[]>('testimonials', [])
  const [dataVersion, setDataVersion] = useKV<number>('data-version', 0)
  const [catalogCacheMeta, setCatalogCacheMeta] = useKV<CatalogCacheMeta | null>('catalog-cache-meta', null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    const initializeData = async () => {
      const currentVersion = 17
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
            name: 'Premium Masala',
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
            reviewCount: 5,
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
          name: 'Bharwa Masala',
          category: 'premium-masala',
          price: 125,
          packGrams: 50,
          image: 'images/products/bharwa-masala-premium.png',
          rating: 4.7,
          reviewCount: 4,
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
          name: 'Chaat Masala',
          category: 'premium-masala',
          price: 145,
          packGrams: 50,
          image: 'images/products/chat-masala-premium.png',
          rating: 4.9,
          reviewCount: 3,
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
          name: 'Chole Masala',
          category: 'premium-masala',
          price: 160,
          packGrams: 50,
          image: 'images/products/chhole-masala-premium.png',
          rating: 4.8,
          reviewCount: 6,
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
      }

      if (!testimonials || testimonials.length === 0) {
        setTestimonials([
          {
            id: 'testimonial-aditi',
            customerName: 'Aditi',
            rating: 5,
            location: 'Bengaluru, Karnataka',
            date: '2026-01-25',
            comment: 'Sukhdevi Alchemy has truly transformed my cooking! The quality, aroma, and freshness of their spices are unmatched. Their Chat Masala adds the perfect tangy punch to snacks and salads, while the Chhole Masala helps me create rich, authentic North Indian flavors at home. The Garam Masala brings exceptional depth and warmth to my curries, and the Bharwa Masala has made stuffed vegetables a family favorite. Every dish I prepare now carries that authentic restaurant-style taste. I highly recommend Sukhdevi Alchemy to anyone who loves flavorful, high-quality spices.',
          },
          {
            id: 'testimonial-subhash',
            customerName: 'Subhash',
            rating: 5,
            location: 'Lucknow, Uttar Pradesh',
            date: '2026-01-27',
            comment: 'As a food lover, I may not know how to cook, but I definitely know good taste when I experience it. After trying dishes prepared with Sukhdevi Alchemy spices, I was genuinely impressed by the rich flavors and authentic aroma. The Chat Masala adds a perfect burst of tangy flavor to snacks and fruits, while the Chhole Masala delivers the classic North Indian taste that makes every plate irresistible. The Garam Masala enhances the depth and richness of curries, and the Bharwa Masala brings a unique and delicious flavor to stuffed vegetable dishes. Every meal tastes more flavorful and memorable. Sukhdevi Alchemy spices have truly elevated my dining experience.',
          },
          {
            id: 'testimonial-geetika',
            customerName: 'Geetika',
            rating: 5,
            location: 'Delhi, NCR',
            date: '2026-01-29',
            comment: 'Being a working professional and managing work-from-home responsibilities, I often look for ways to prepare delicious meals without spending hours in the kitchen. Sukhdevi Alchemy spices have been a game-changer for me. Their Chhole Masala, Garam Masala, Chat Masala, and Bharwa Masala help me create authentic, homemade flavors in a fraction of the time. Earlier, achieving that rich aroma and balanced taste required preparing and blending multiple spices. With Sukhdevi Alchemy, I can enjoy the same homemade taste and aroma effortlessly. The Chhole Masala gives my chhole the perfect Punjabi flavor, the Garam Masala adds warmth and depth to curries, the Chat Masala instantly enhances snacks and salads, and the Bharwa Masala makes stuffed vegetables incredibly flavorful. These masalas have helped me save valuable time while ensuring my family enjoys restaurant-quality dishes with the comfort and authenticity of home-cooked food.',
          },
        ])
      }

      if (!reviews || reviews.length === 0) {
        setReviews([
          {
            id: 'review-aditi-garam',
            productId: 'garam-masala-premium',
            customerName: 'Aditi',
            rating: 5,
            comment: 'Sukhdevi Alchemy has truly transformed my cooking! The quality, aroma, and freshness of their spices are unmatched. Their Chat Masala adds the perfect tangy punch to snacks and salads, while the Chhole Masala helps me create rich, authentic North Indian flavors at home. The Garam Masala brings exceptional depth and warmth to my curries, and the Bharwa Masala has made stuffed vegetables a family favorite. Every dish I prepare now carries that authentic restaurant-style taste. I highly recommend Sukhdevi Alchemy to anyone who loves flavorful, high-quality spices.',
            date: '2026-01-25',
            verified: true,
          },
          {
            id: 'review-subhash-chhole',
            productId: 'chhole-masala-premium',
            customerName: 'Subhash',
            rating: 5,
            comment: 'As a food lover, I may not know how to cook, but I definitely know good taste when I experience it. After trying dishes prepared with Sukhdevi Alchemy spices, I was genuinely impressed by the rich flavors and authentic aroma. The Chat Masala adds a perfect burst of tangy flavor to snacks and fruits, while the Chhole Masala delivers the classic North Indian taste that makes every plate irresistible. The Garam Masala enhances the depth and richness of curries, and the Bharwa Masala brings a unique and delicious flavor to stuffed vegetable dishes. Every meal tastes more flavorful and memorable. Sukhdevi Alchemy spices have truly elevated my dining experience.',
            date: '2026-01-27',
            verified: true,
          },
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
        return
      }

      if (remoteCatalog.source === 'supabase' && remoteCatalog.products.length === 0) {
        console.warn('[catalog] Supabase returned empty products. Serving stale/local snapshot to avoid empty storefront.')
      }

      setDataVersion(currentVersion)
      setCatalogCacheMeta({ fetchedAt: now, buster: cacheBuster })
      setIsHydrated(true)
    }
    
    initializeData()
  }, [categories, products, dataVersion, catalogCacheMeta, setCatalogCacheMeta, setCategories, setDataVersion, setProducts, setReviews, setTestimonials, testimonials, reviews])

  return { categories, products, isHydrated }
}
