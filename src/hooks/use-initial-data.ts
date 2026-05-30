import { useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import type { Category, Product } from '@/lib/types'

export function useInitialData() {
  const [categories, setCategories] = useKV<Category[]>('categories', [])
  const [products, setProducts] = useKV<Product[]>('products', [])
  const [dataVersion, setDataVersion] = useKV<number>('data-version', 0)

  useEffect(() => {
    const initializeData = async () => {
      const currentVersion = 8
      
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
            image: 'https://images.unsplash.com/photo-1599946347371-68eb71b16afc?w=800&auto=format&fit=crop',
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
          image: 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?w=800&auto=format&fit=crop',
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
          image: 'https://images.unsplash.com/photo-1596097635604-1347c93e0daa?w=800&auto=format&fit=crop',
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
          image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&auto=format&fit=crop',
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
      
      setDataVersion(currentVersion)
      }
    }
    
    initializeData()
  }, [])

  return { categories, products }
}
