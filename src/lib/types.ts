export type Category = {
  id: string
  name: string
  enabled: boolean
  slug: string
}

export type Product = {
  id: string
  sku?: string
  name: string
  category: string
  price: number
  compareAtPrice?: number
  discountPercent?: number
  packGrams?: number
  image: string
  rating: number
  reviewCount: number
  description: string
  ingredients: string[]
  youtubeUrl?: string
  inStock: boolean
  tags: string[]
}

export type Review = {
  id: string
  userId?: string
  productId: string
  customerName: string
  rating: number
  comment: string
  date: string
  verified: boolean
}

export type CartItem = {
  productId: string
  quantity: number
  grams: number
}

export type Order = {
  id: string
  userId?: string | null
  items: Array<{
    productId: string
    productName: string
    quantity: number
    grams: number
    pricePerUnit: number
  }>
  customer: {
    name: string
    email: string
    phone: string
    address: string
    city: string
    pincode: string
    country?: string
  }
  subtotalAmount?: number
  shippingAmount?: number
  discountAmount?: number
  promoCode?: string
  totalAmount: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered'
  paymentStatus: 'pending' | 'paid'
  paymentDetails?: {
    gateway: "razorpay"
    razorpayPaymentId?: string
    razorpayOrderId?: string
    paidAt?: string
    status?: "paid" | "failed" | "pending"
  }
  createdAt: string
  updatedAt: string
}

export type UserRole = "customer" | "admin"

export type UserProfile = {
  id: string
  email: string
  fullName: string
  phone: string
  role: UserRole
  reviewOptIn: boolean
  marketingOptIn: boolean
}

export type Testimonial = {
  id: string
  customerName: string
  rating: number
  comment: string
  date: string
  location: string
}

export const GRAM_OPTIONS = [50] as const
export type GramOption = typeof GRAM_OPTIONS[number]
