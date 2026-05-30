import { useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import type { Category, Product, Review, Testimonial } from '@/lib/types'

export function useInitialData() {
  const [categories, setCategories] = useKV<Category[]>('categories', [])
  const [products, setProducts] = useKV<Product[]>('products', [])
  const [reviews, setReviews] = useKV<Review[]>('reviews', [])
  const [testimonials, setTestimonials] = useKV<Testimonial[]>('testimonials', [])
  const [dataVersion, setDataVersion] = useKV<number>('data-version', 0)

  useEffect(() => {
    const initializeData = async () => {
      const currentVersion = 11
      
      if (!categories || categories.length === 0 || (dataVersion ?? 0) < currentVersion) {
        setCategories([
          {
            id: 'premium-masala',
            name: 'Premium Masala',
            slug: 'premium-masala',
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

      if (!products || products.length === 0 || (dataVersion ?? 0) < currentVersion) {
        setProducts([
          {
            id: 'garam-masala-premium',
            name: 'Garam Masala Premium Blend',
            category: 'premium-masala',
            price: 350,
            image: 'images/products/garam-masala-premium.png',
            rating: 4.8,
            reviewCount: 127,
            description: 'Made from the authentic family recipe. Our signature Garam Masala Premium Blend combines the finest aromatic spices to create a perfect balance of warmth and flavor.',
            ingredients: [
              'Cumin Seeds',
              'Coriander Seeds',
              'Black Pepper',
              'Cardamom',
              'Cloves',
              'Cinnamon',
              'Bay Leaves',
              'Nutmeg',
              'Mace'
            ],
            youtubeUrl: 'https://www.youtube.com/watch?v=example1',
            inStock: true,
            tags: ['bestseller', 'premium', 'aromatic'],
          },
        {
          id: 'bharwa-masala-premium',
          name: 'Bharwa Masala Premium',
          category: 'premium-masala',
          price: 300,
          image: 'images/products/bharwa-masala-premium.png',
          rating: 4.7,
          reviewCount: 98,
          description: 'Specially crafted Bharwa Masala for stuffed vegetables. This premium blend brings authentic North Indian flavors with a perfect mix of tangy and spicy notes.',
          ingredients: [
            'Coriander Powder',
            'Cumin Powder',
            'Dry Mango Powder',
            'Red Chili Powder',
            'Fennel Seeds',
            'Black Salt',
            'Rock Salt',
            'Turmeric'
          ],
          youtubeUrl: 'https://www.youtube.com/watch?v=example2',
          inStock: true,
          tags: ['premium', 'stuffed-veggies', 'tangy'],
        },
        {
          id: 'chat-masala-premium',
          name: 'Chat Masala Premium',
          category: 'premium-masala',
          price: 330,
          image: 'images/products/chat-masala-premium.png',
          rating: 4.9,
          reviewCount: 156,
          description: 'A tangy and zesty Chat Masala that transforms ordinary snacks into extraordinary treats. Perfect for fruits, salads, and street food favorites.',
          ingredients: [
            'Black Salt',
            'Cumin Powder',
            'Dry Mango Powder',
            'Black Pepper',
            'Ginger Powder',
            'Mint Leaves',
            'Asafoetida',
            'Citric Acid'
          ],
          youtubeUrl: 'https://www.youtube.com/watch?v=example3',
          inStock: true,
          tags: ['bestseller', 'premium', 'tangy', 'street-food'],
        },
        {
          id: 'chhole-masala-premium',
          name: 'Chhole Masala Premium',
          category: 'premium-masala',
          price: 330,
          image: 'images/products/chhole-masala-premium.png',
          rating: 4.8,
          reviewCount: 143,
          description: 'Authentic Chhole Masala that brings the taste of Punjab to your kitchen. Rich, aromatic, and perfectly balanced for the perfect chickpea curry.',
          ingredients: [
            'Coriander Seeds',
            'Cumin Seeds',
            'Dried Pomegranate Seeds',
            'Black Cardamom',
            'Cinnamon',
            'Bay Leaves',
            'Red Chili',
            'Tea Leaves',
            'Turmeric'
          ],
          youtubeUrl: 'https://www.youtube.com/watch?v=example4',
          inStock: true,
          tags: ['premium', 'punjabi', 'aromatic'],
        },
      ])
      }

      if (!testimonials || testimonials.length === 0 || (dataVersion ?? 0) < currentVersion) {
        setTestimonials([
          {
            id: 'testimonial-aditi',
            customerName: 'Aditi',
            rating: 5,
            location: 'Bengaluru, Karnataka',
            date: '2026-01-25',
            comment: 'Sukhdevi Alchemy has truly transformed my cooking! The quality, aroma, and freshness of their spices are unmatched. Their Chat Masala adds the perfect tangy punch to snacks and salads, while the Chhole Masala helps me create rich, authentic North Indian flavors at home. The Garam Masala brings exceptional depth and warmth to my curries, and the Bharwa Masala has made stuffed vegetables a family favorite. Every dish I prepare now carries that authentic restaurant-style taste. I highly recommend Sukhdev Alchemy to anyone who loves flavorful, high-quality spices.',
          },
          {
            id: 'testimonial-subhash',
            customerName: 'Subhash',
            rating: 5,
            location: 'Lucknow, Uttar Pradesh',
            date: '2026-01-27',
            comment: 'As a food lover, I may not know how to cook, but I definitely know good taste when I experience it. After trying dishes prepared with Sukhdev Alchemy spices, I was genuinely impressed by the rich flavors and authentic aroma. The Chat Masala adds a perfect burst of tangy flavor to snacks and fruits, while the Chhole Masala delivers the classic North Indian taste that makes every plate irresistible. The Garam Masala enhances the depth and richness of curries, and the Bharwa Masala brings a unique and delicious flavor to stuffed vegetable dishes. Every meal tastes more flavorful and memorable. Sukhdev Alchemy spices have truly elevated my dining experience.',
          },
          {
            id: 'testimonial-geetika',
            customerName: 'Geetika',
            rating: 5,
            location: 'Delhi, Delhi',
            date: '2026-01-29',
            comment: 'Being a working professional and managing work-from-home responsibilities, I often look for ways to prepare delicious meals without spending hours in the kitchen. Sukhdev Alchemy spices have been a game-changer for me. Their Chhole Masala, Garam Masala, Chat Masala, and Bharwa Masala help me create authentic, homemade flavors in a fraction of the time. Earlier, achieving that rich aroma and balanced taste required preparing and blending multiple spices. With Sukhdev Alchemy, I can enjoy the same homemade taste and aroma effortlessly. The Chhole Masala gives my chhole the perfect Punjabi flavor, the Garam Masala adds warmth and depth to curries, the Chat Masala instantly enhances snacks and salads, and the Bharwa Masala makes stuffed vegetables incredibly flavorful. These masalas have helped me save valuable time while ensuring my family enjoys restaurant-quality dishes with the comfort and authenticity of home-cooked food.',
          },
        ])
      }

      if (!reviews || reviews.length === 0 || (dataVersion ?? 0) < currentVersion) {
        setReviews([
          {
            id: 'review-aditi-garam',
            productId: 'garam-masala-premium',
            customerName: 'Aditi',
            rating: 5,
            comment: 'Sukhdevi Alchemy has truly transformed my cooking! The quality, aroma, and freshness of their spices are unmatched. Their Chat Masala adds the perfect tangy punch to snacks and salads, while the Chhole Masala helps me create rich, authentic North Indian flavors at home. The Garam Masala brings exceptional depth and warmth to my curries, and the Bharwa Masala has made stuffed vegetables a family favorite. Every dish I prepare now carries that authentic restaurant-style taste. I highly recommend Sukhdev Alchemy to anyone who loves flavorful, high-quality spices.',
            date: '2026-01-25',
            verified: true,
          },
          {
            id: 'review-subhash-chhole',
            productId: 'chhole-masala-premium',
            customerName: 'Subhash',
            rating: 5,
            comment: 'As a food lover, I may not know how to cook, but I definitely know good taste when I experience it. After trying dishes prepared with Sukhdev Alchemy spices, I was genuinely impressed by the rich flavors and authentic aroma. The Chat Masala adds a perfect burst of tangy flavor to snacks and fruits, while the Chhole Masala delivers the classic North Indian taste that makes every plate irresistible. The Garam Masala enhances the depth and richness of curries, and the Bharwa Masala brings a unique and delicious flavor to stuffed vegetable dishes. Every meal tastes more flavorful and memorable. Sukhdev Alchemy spices have truly elevated my dining experience.',
            date: '2026-01-27',
            verified: true,
          },
          {
            id: 'review-geetika-bharwa',
            productId: 'bharwa-masala-premium',
            customerName: 'Geetika',
            rating: 5,
            comment: 'Being a working professional and managing work-from-home responsibilities, I often look for ways to prepare delicious meals without spending hours in the kitchen. Sukhdev Alchemy spices have been a game-changer for me. Their Chhole Masala, Garam Masala, Chat Masala, and Bharwa Masala help me create authentic, homemade flavors in a fraction of the time. Earlier, achieving that rich aroma and balanced taste required preparing and blending multiple spices. With Sukhdev Alchemy, I can enjoy the same homemade taste and aroma effortlessly. The Chhole Masala gives my chhole the perfect Punjabi flavor, the Garam Masala adds warmth and depth to curries, the Chat Masala instantly enhances snacks and salads, and the Bharwa Masala makes stuffed vegetables incredibly flavorful. These masalas have helped me save valuable time while ensuring my family enjoys restaurant-quality dishes with the comfort and authenticity of home-cooked food.',
            date: '2026-01-29',
            verified: true,
          },
        ])
      }

      setDataVersion(currentVersion)
    }
    
    initializeData()
  }, [])

  return { categories, products }
}
