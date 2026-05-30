const defaultImages: Record<string, string> = {
  'garam-masala-premium': 'https://images.unsplash.com/photo-1596040033229-a0b78e2dfcce?w=800&auto=format&fit=crop',
  
  'bharwa-masala-premium': 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=800&auto=format&fit=crop',
  
  'chat-masala-premium': 'https://images.unsplash.com/photo-1695049043794-0cc28b2bb5bc?w=800&auto=format&fit=crop',
  
  'chhole-masala-premium': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&auto=format&fit=crop',
}

export function getProductImage(productId: string, uploadedImages?: Record<string, string>): string {
  if (uploadedImages && uploadedImages[productId]) {
    return uploadedImages[productId]
  }
  
  return defaultImages[productId] || ''
}
