import type { CartItem, Order, Product } from "@/lib/types"

export const SHIPPING_AMOUNT = 120
export const KARNATAKA_SHIPPING_AMOUNT = 60
export const FREE_SHIPPING_THRESHOLD = 500
export const MAX_PRODUCT_GRAMS_PER_CART = 500
export const CLOUD_KITCHEN_INSTANT_DELIVERY_AMOUNT = 30
export const CLOUD_KITCHEN_INSTANT_SERVICEABLE_PINCODES = ["560068"] as const
export const CLOUD_KITCHEN_MILK_SURCHARGE = 15

export const SMOOTHIE_ADDON_PRICES: Record<string, number> = {
  "Almonds": 15,
  "Cashews": 15,
  "Chia Seeds": 10,
  "Pumpkin Seeds": 10,
  "Flax Seeds": 8,
  "Peanuts": 8,
  "Roasted Chickpeas": 8,
  "Walnuts": 15,
  "Sunflower Seeds": 8,
}

export const SMOOTHIE_DEFAULT_ADDONS = ["Almonds", "Cashews", "Walnuts"] as const

export function calculateSmoothieAddOnTotal(selectedAddOns: string[], base: "water" | "milk") {
  const addOnTotal = selectedAddOns.reduce((sum, addon) => sum + (SMOOTHIE_ADDON_PRICES[addon] ?? 0), 0)
  const milkSurcharge = base === "milk" ? CLOUD_KITCHEN_MILK_SURCHARGE : 0
  return addOnTotal + milkSurcharge
}

const rawPackPriceMap: Record<string, Record<number, number>> = {
  "raw-cardamom-black": { 50: 140 },
  "raw-cardamom-green": { 50: 260 },
  "raw-clove": { 50: 90 },
  "raw-cumin": { 50: 50 },
  "raw-fennel-lucknow": { 50: 25 },
  "raw-guntur-chilli": { 50: 25 },
  "raw-pepper-black": { 50: 80 },
  "raw-star-anise": { 50: 80 },
  "raw-tej-patta": { 50: 40 },
  "raw-turmeric": { 50: 35 },
}

export function isComboPack(product: Product) {
  return product.tags.includes("combo-pack")
}

export function isCloudKitchenProduct(product: Product) {
  return product.tags.includes("cloud-kitchen")
}

function getRawPackPriceConfig(product: Product) {
  return rawPackPriceMap[product.id]
}

export function getProductPackGrams(product: Product) {
  if (getRawPackPriceConfig(product)) {
    return 50
  }

  if (typeof product.packGrams === "number" && product.packGrams > 0) {
    return product.packGrams
  }

  return isComboPack(product) ? 200 : 50
}

export function getProductPackLabel(product: Product) {
  if (getRawPackPriceConfig(product)) {
    return "50g pack"
  }

  if (
    typeof product.netQuantityValue === "number"
    && product.netQuantityValue > 0
    && typeof product.netQuantityUnit === "string"
    && product.netQuantityUnit.trim().length > 0
  ) {
    return `${product.netQuantityValue}${product.netQuantityUnit.trim()} serving`
  }

  return isComboPack(product) ? "4 x 50g packs" : `${getProductPackGrams(product)}g pack`
}

export function getProductPackOptions(product: Product) {
  const rawConfig = getRawPackPriceConfig(product)
  if (rawConfig) {
    return Object.keys(rawConfig)
      .map((grams) => Number(grams))
      .filter((grams) => Number.isFinite(grams))
      .sort((left, right) => left - right)
  }

  return [getProductPackGrams(product)]
}

export function resolveProductPackPrice(product: Product, grams: number) {
  const rawConfig = getRawPackPriceConfig(product)
  if (rawConfig && rawConfig[grams] != null) {
    return rawConfig[grams]
  }

  return product.price
}

export function getCartItemPackLabel(product: Product, grams: number) {
  if (isCloudKitchenProduct(product)) {
    return `${grams}ml serving`
  }

  return isComboPack(product) ? "4 x 50g packs" : `${grams}g pack`
}

export function getProductDisplayPriceLabel(product: Product) {
  const options = getProductPackOptions(product)
  if (options.length <= 1) {
    return `₹${resolveProductPackPrice(product, options[0] ?? getProductPackGrams(product))}`
  }

  const prices = options.map((grams) => resolveProductPackPrice(product, grams))
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  return `₹${minPrice} - ₹${maxPrice}`
}

export function calculateCartItemTotal(item: CartItem, product: Product) {
  return resolveProductPackPrice(product, item.grams) * item.quantity
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

export function isCloudKitchenInstantServiceablePincode(pincode: string) {
  const normalized = normalizePincode(pincode)
  return CLOUD_KITCHEN_INSTANT_SERVICEABLE_PINCODES.includes(normalized as typeof CLOUD_KITCHEN_INSTANT_SERVICEABLE_PINCODES[number])
}

export function calculateCloudKitchenShippingAmount(deliveryMode: "instant" | "subscription") {
  return deliveryMode === "subscription" ? 0 : CLOUD_KITCHEN_INSTANT_DELIVERY_AMOUNT
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