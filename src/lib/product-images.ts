import garamMasalaImg from '@/assets/images/garam-masala.jpg'
import chatMasalaImg from '@/assets/images/chat-masala.jpg'

export const productImages: Record<string, string> = {
  'garam-masala-premium': garamMasalaImg,
  'bharwa-masala-premium': 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=400&h=400&fit=crop',
  'chat-masala-premium': chatMasalaImg,
  'chhole-masala-premium': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=400&fit=crop',
}

export function getProductImage(productId: string): string {
  return productImages[productId] || ''
}
