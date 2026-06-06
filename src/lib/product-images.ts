import type { Product } from "@/lib/types"

const defaultImages: Record<string, string> = {
  'garam-masala-premium': 'images/products/garam-masala-premium.png',
  
  'bharwa-masala-premium': 'images/products/bharwa-masala-premium.png',
  
  'chat-masala-premium': 'images/products/chat-masala-premium.png',
  
  'chhole-masala-premium': 'images/products/chhole-masala-premium.png',
}

function isRuntimeLocalhost() {
  if (typeof window === 'undefined') {
    return false
  }

  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

function isLocalhostAssetUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  } catch {
    return false
  }
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
  const uploadedImage = uploadedImages?.[product.id]
  if (uploadedImage) {
    // Browser-local admin overrides sometimes persist localhost image URLs.
    // Ignore those in production/public domains to prevent broken image fetches.
    if (!(isLocalhostAssetUrl(uploadedImage) && !isRuntimeLocalhost())) {
      return uploadedImage
    }
  }

  return normalizeImageUrl(product.image) || normalizeImageUrl(defaultImages[product.id])
}
