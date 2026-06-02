import type { CartItem, Order, Product } from "@/lib/types"

export const SHIPPING_AMOUNT = 120
export const KARNATAKA_SHIPPING_AMOUNT = 60
export const FREE_SHIPPING_THRESHOLD = 500

export function isComboPack(product: Product) {
  return product.tags.includes("combo-pack")
}

export function getProductPackGrams(product: Product) {
  if (typeof product.packGrams === "number" && product.packGrams > 0) {
    return product.packGrams
  }

  return isComboPack(product) ? 200 : 50
}

export function getProductPackLabel(product: Product) {
  return isComboPack(product) ? "4 x 50g packs" : `${getProductPackGrams(product)}g pack`
}

export function calculateCartItemTotal(item: CartItem, product: Product) {
  return product.price * item.quantity
}

export function calculateCartSubtotal(cartItems: CartItem[], products: Product[]) {
  return cartItems.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.productId)
    if (!product) {
      return sum
    }

    return sum + calculateCartItemTotal(item, product)
  }, 0)
}

export function calculateShippingAmount(subtotal: number) {
  if (subtotal <= 0) {
    return 0
  }

  return subtotal > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_AMOUNT
}

function normalizePincode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6)
}

export function isKarnatakaPincode(pincode: string) {
  const normalized = normalizePincode(pincode)
  if (normalized.length < 2) {
    return false
  }

  return ["56", "57", "58", "59"].includes(normalized.slice(0, 2))
}

export function calculateShippingAmountByPincode(pincode: string, subtotal: number) {
  if (subtotal <= 0) {
    return 0
  }

  return isKarnatakaPincode(pincode) ? KARNATAKA_SHIPPING_AMOUNT : SHIPPING_AMOUNT
}

export function getShippingZoneLabel(pincode: string) {
  return isKarnatakaPincode(pincode) ? "Karnataka" : "Rest of India"
}

export function calculateCartTotal(subtotal: number) {
  return subtotal + calculateShippingAmount(subtotal)
}

export function hasPurchasedProduct(orders: Order[], productId: string) {
  return orders.some(
    (order) =>
      order.paymentStatus === "paid" &&
      order.items.some((item) => item.productId === productId)
  )
}