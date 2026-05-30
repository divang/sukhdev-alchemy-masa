import type { Product } from "@/lib/types"

const defaultImages: Record<string, string> = {
  'garam-masala-premium': 'images/products/garam-masala-premium.png',
  
  'bharwa-masala-premium': 'images/products/bharwa-masala-premium.png',
  
  'chat-masala-premium': 'images/products/chat-masala-premium.png',
  
  'chhole-masala-premium': 'images/products/chhole-masala-premium.png',
}

function normalizeImageUrl(imagePath?: string): string {
  if (!imagePath) {
    return ''
  }

  if (/^(?:https?:|data:|blob:|\/\/)/i.test(imagePath)) {
    return imagePath
  }

  const baseUrl = import.meta.env.BASE_URL || '/'
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const normalizedImagePath = imagePath.replace(/^\.?\//, '')

  return `${normalizedBaseUrl}${normalizedImagePath}`
}

export function getProductImage(product: Pick<Product, 'id' | 'image'>, uploadedImages?: Record<string, string>): string {
  if (uploadedImages && uploadedImages[product.id]) {
    return uploadedImages[product.id]
  }

  return normalizeImageUrl(product.image) || normalizeImageUrl(defaultImages[product.id])
}
