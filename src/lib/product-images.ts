const defaultImages: Record<string, string> = {
  'garam-masala-premium': 'https://images.unsplash.com/photo-1596040033229-a0b21e2e1b5f?w=400&h=400&fit=crop',
  'bharwa-masala-premium': 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=400&h=400&fit=crop',
  'chat-masala-premium': 'https://images.unsplash.com/photo-1596040033229-a0b21e2e1b5f?w=400&h=400&fit=crop',
  'chhole-masala-premium': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=400&fit=crop',
}

export function getProductImage(productId: string, uploadedImages?: Record<string, string>): string {
  if (uploadedImages && uploadedImages[productId]) {
    return uploadedImages[productId]
  }
  
  return defaultImages[productId] || ''
}
