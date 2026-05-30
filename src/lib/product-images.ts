import garamMasalaImg from '@/assets/images/garam-masala.jpg'

export const productImages: Record<string, string> = {
  'garam-masala-premium': garamMasalaImg,
  'bharwa-masala-premium': 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=400&h=400&fit=crop',
  'chat-masala-premium': 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&h=400&fit=crop',
  'chhole-masala-premium': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=400&fit=crop',
}

export function getProductImage(productId: string): string {
  return productImages[productId] || ''
}
