import { useEffect, useRef, useState } from "react"
import { useKV } from "@/hooks/use-kv"
import { ShoppingCart, List, Package, CreditCard, Gear, SignOut, UserCircle, InstagramLogo, YoutubeLogo, House, MagnifyingGlass, SquaresFour } from "@phosphor-icons/react"
import { QRCodeSVG as QRCode } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CategorySidebar } from "@/components/CategorySidebar"
import { ProductCard } from "@/components/ProductCard"
import { CartDrawer } from "@/components/CartDrawer"
import { ProductDetailDialog } from "@/components/ProductDetailDialog"
import { CheckoutView } from "@/components/CheckoutView"
import { OrderTrackingView } from "@/components/OrderTrackingView"
import { ContactUsSection } from "@/components/ContactUsSection"
import { AdminSimplifiedPanel } from "@/components/AdminSimplifiedPanel"
import { AuthView } from "@/components/AuthView"
import { AccountDetailsView } from "@/components/AccountDetailsView"
import type { Category, Product, CartItem, Order, UserProfile } from "@/lib/types"
import { toast } from "sonner"
import { useInitialData } from "@/hooks/use-initial-data"
import { finalizeOAuthRedirect, getCurrentAuthState, signOutUser, subscribeToAuthStateChanges } from "@/lib/auth"
import {
  fetchCartForCurrentUser,
  removeCartItemForCurrentUser,
  replaceCartForCurrentUser,
  upsertCartItemForCurrentUser,
} from "@/lib/cart-persistence"
import {
  fetchOrdersForAdmin,
  fetchOrdersForCurrentUser,
  persistOrderToSupabase,
  updateSupabaseOrderPayment,
} from "@/lib/order-persistence"
import { isSupabaseConfigured } from "@/lib/supabase"
import { getProductPackGrams, hasPurchasedProduct, MAX_PRODUCT_GRAMS_PER_CART } from "@/lib/pricing"
import { defaultFeatureFlags, fetchFeatureFlags } from "@/lib/feature-flags"
import { fallbackUpiConfig, fetchActiveUpiConfig } from "@/lib/payment-upi"
import { BRAND_LOGO_PATH } from "@/lib/brand"
import { CATALOG_SEED_CATEGORIES, CATALOG_SEED_PRODUCTS } from "@/lib/catalog-seed"
import { isPaymentGatewayEnabled, startRazorpayCheckout } from "@/lib/payment-gateway"
import { getRequestedRuntimeModeFromSearch, resolveRuntimeMode } from "@/lib/runtime-mode"
import { triggerOrderCreatedNotification, triggerOrderNotification } from "@/lib/order-notifications"

type View = "store" | "account" | "checkout" | "payment" | "tracking" | "admin" | "admin-advanced" | "account-details"

// Flip this to false to instantly revert mobile cards back to the original layout.
const ENABLE_AMAZON_STYLE_MOBILE_PRODUCT_CARDS = true
const TRACKING_VISIBLE_ORDER_ID = "ORD-1780827393392"
const TRACKING_OWNER_EMAIL = "divang.s@gmail.com"
const HIDDEN_CATEGORY_IDS = new Set(["combo-pack-masala"])
const HIDDEN_PRODUCT_IDS = new Set(["sukhdevi-combo-pack"])
const PRODUCT_SEARCH_SYNONYM_GROUPS = [
  ["chilli", "chili", "mirchi", "mircha", "lal mirch", "red chilli", "red chili"],
  ["black pepper", "kali mirch"],
  ["cumin", "jeera"],
  ["coriander", "dhaniya"],
  ["fennel", "saunf"],
  ["cardamom", "elaichi", "ilaichi"],
  ["clove", "laung"],
  ["turmeric", "haldi"],
  ["dry ginger", "sonth"],
  ["carom", "ajwain"],
  ["mango powder", "amchoor", "amchur"],
  ["pomegranate seeds", "anardana"],
  ["mix masala", "garam masala"],
  ["chole", "chhole", "chana masala"],
  ["chaat", "chat"],
  ["bharwa", "stuffed masala"],
] as const

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function buildProductSearchText(product: Product, categoryName?: string) {
  const rawText = [
    product.name,
    product.description,
    categoryName ?? "",
    ...(Array.isArray(product.ingredients) ? product.ingredients : []),
    ...(Array.isArray(product.tags) ? product.tags : []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")

  const normalizedBase = normalizeSearchText(rawText)
  const synonyms = PRODUCT_SEARCH_SYNONYM_GROUPS
    .filter((group) => group.some((term) => normalizedBase.includes(term)))
    .flat()

  return `${normalizedBase} ${synonyms.join(" ")}`.trim()
}

function parseOrderIdTimestamp(orderId: string) {
  const match = orderId.match(/ORD-(\d{8,})$/)
  if (!match) {
    return 0
  }

  const value = Number(match[1])
  return Number.isFinite(value) ? value : 0
}

function getOrderTimestamp(order: Order) {
  const createdAtValue = new Date(order.createdAt).getTime()
  if (Number.isFinite(createdAtValue) && createdAtValue > 0) {
    return createdAtValue
  }

  return parseOrderIdTimestamp(order.id)
}

function mergeOrders(primary: Order[], secondary: Order[]) {
  const deduped = new Map<string, Order>()

  for (const order of [...primary, ...secondary]) {
    deduped.set(order.id, order)
  }

  return [...deduped.values()].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )
}

function getCartItemKey(item: CartItem) {
  return `${item.productId}:${item.grams}`
}

function canonicalizeCartItems(cartItems: CartItem[]) {
  const merged = new Map<string, CartItem>()

  for (const item of cartItems) {
    const key = getCartItemKey(item)
    const existing = merged.get(key)

    if (existing) {
      merged.set(key, { ...existing, quantity: Math.max(existing.quantity, item.quantity) })
      continue
    }

    merged.set(key, item)
  }

  return [...merged.values()]
}

// Merge local + persisted cart snapshots without inflating quantity on refresh.
function mergeCartSnapshots(localCart: CartItem[], persistedCart: CartItem[]) {
  return canonicalizeCartItems([...persistedCart, ...localCart])
}

function normalizeCartItems(cartItems: CartItem[], products: Product[]) {
  const normalized = cartItems.map((item) => {
    const product = products.find((entry) => entry.id === item.productId)
    if (!product) {
      return item
    }

    return {
      ...item,
      grams: getProductPackGrams(product),
    }
  })

  return canonicalizeCartItems(normalized)
}

function getTotalGramsForProduct(cartItems: CartItem[], productId: string) {
  return cartItems
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + (item.grams * item.quantity), 0)
}

function hasOAuthParamsInLocation(href: string) {
  try {
    const url = new URL(href)
    if (url.searchParams.has("code") || url.searchParams.has("error") || url.searchParams.has("error_description")) {
      return true
    }

    const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash)
    return ["access_token", "refresh_token", "error", "error_description", "type"].some((key) => hashParams.has(key))
  } catch {
    return false
  }
}

function App() {
  useInitialData()

  const [categories] = useKV<Category[]>("categories", CATALOG_SEED_CATEGORIES)
  const [products] = useKV<Product[]>("products", CATALOG_SEED_PRODUCTS)
  const [cartItems, setCartItems] = useKV<CartItem[]>("cart", [])
  const [orders, setOrders] = useKV<Order[]>("orders", [])

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [currentView, setCurrentView] = useState<View>("store")
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [requestedRuntimeMode, setRequestedRuntimeMode] = useState(() =>
    typeof window === "undefined" ? "prod" : getRequestedRuntimeModeFromSearch(window.location.search)
  )
  const [hasShownModeLockNotice, setHasShownModeLockNotice] = useState(false)
  const [authMode, setAuthMode] = useState<"customer" | "admin">("customer")
  const [postAuthView, setPostAuthView] = useState<View>("store")
  const [cloudOrders, setCloudOrders] = useState<Order[]>([])
  const [featureFlags, setFeatureFlags] = useKV("feature-flags", defaultFeatureFlags)
  const [activeUpiConfig, setActiveUpiConfig] = useState(fallbackUpiConfig)
  const [isProcessingGatewayPayment, setIsProcessingGatewayPayment] = useState(false)
  const [showAuthHandoffNotice, setShowAuthHandoffNotice] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const authHandoffTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const socialProfiles = [
    { name: "Instagram", handle: "@sukhdevialchemy", url: "https://instagram.com/sukhdevialchemy" },
    { name: "YouTube", handle: "@sukhdevialchemy", url: "https://youtube.com/@sukhdevialchemy" },
  ]
  const runtimeMode = resolveRuntimeMode(requestedRuntimeMode, profile)
  const devModeRequested = requestedRuntimeMode === "dev"
  const devModeLocked = devModeRequested && runtimeMode !== "dev"

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    function syncRequestedModeFromUrl() {
      setRequestedRuntimeMode(getRequestedRuntimeModeFromSearch(window.location.search))
    }

    syncRequestedModeFromUrl()
    window.addEventListener("popstate", syncRequestedModeFromUrl)
    return () => window.removeEventListener("popstate", syncRequestedModeFromUrl)
  }, [])

  useEffect(() => {
    if (!devModeLocked) {
      if (hasShownModeLockNotice) {
        setHasShownModeLockNotice(false)
      }
      return
    }

    if (hasShownModeLockNotice) {
      return
    }

    toast.info("mode=dev is restricted to the configured admin account. Running in production mode.")
    setHasShownModeLockNotice(true)
  }, [devModeLocked, hasShownModeLockNotice])

  // Hash-based admin route: visiting /#admin opens admin login directly.
  useEffect(() => {
    function handleHash() {
      if (window.location.hash === "#admin") {
        if (profile?.role === "admin") {
          setCurrentView("admin")
        } else {
          setAuthMode("admin")
          setPostAuthView("admin")
          setCurrentView("account")
        }
      }
    }

    handleHash()
    window.addEventListener("hashchange", handleHash)
    return () => window.removeEventListener("hashchange", handleHash)
  }, [profile])

  useEffect(() => {
    let isActive = true

    async function initializeAuthState() {
      try {
        if (typeof window !== "undefined" && hasOAuthParamsInLocation(window.location.href)) {
          setShowAuthHandoffNotice(true)
          if (authHandoffTimeoutRef.current) {
            clearTimeout(authHandoffTimeoutRef.current)
          }

          authHandoffTimeoutRef.current = setTimeout(() => {
            setShowAuthHandoffNotice(false)
          }, 1500)
        }

        const oauthError = await finalizeOAuthRedirect()
        if (!isActive) {
          return
        }

        if (oauthError) {
          console.error("[app-auth] OAuth callback failed", oauthError)
          setCurrentOrder(null)
          setCurrentView("store")

          if (typeof window !== "undefined") {
            window.history.replaceState({}, document.title, `${window.location.origin}/`)
          }
          return
        }

        console.log("[app-auth] getCurrentAuthState requested")
        const state = await getCurrentAuthState()
        if (!isActive) {
          return
        }

        console.log("[app-auth] getCurrentAuthState resolved", {
          hasUser: Boolean(state.user),
          hasProfile: Boolean(state.profile),
          role: state.profile?.role ?? null,
        })
        setProfile(state.profile)
        setShowAuthHandoffNotice(false)
      } catch (error) {
        if (!isActive) {
          return
        }

        console.error("[app-auth] initializeAuthState failed", error)
        setProfile(null)
        setCurrentOrder(null)
        setCurrentView("store")
        setShowAuthHandoffNotice(false)

        if (typeof window !== "undefined") {
          window.location.replace(`${window.location.origin}/`)
        }
      }
    }

    void initializeAuthState()

    const subscription = subscribeToAuthStateChanges((state) => {
      if (!isActive) return
      console.log("[app-auth] onAuthStateChange", {
        hasUser: Boolean(state.user),
        hasProfile: Boolean(state.profile),
        role: state.profile?.role ?? null,
      })
      setProfile(state.profile)

      if (state.user || state.profile) {
        setShowAuthHandoffNotice(false)
      }
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
      if (authHandoffTimeoutRef.current) {
        clearTimeout(authHandoffTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let isActive = true

    async function loadActiveUpiConfig() {
      const result = await fetchActiveUpiConfig()
      if (!isActive) {
        return
      }

      if (result.error) {
        console.error("Failed to load active UPI config", result.error)
      }

      setActiveUpiConfig(result.config)
    }

    if (currentView === "payment") {
      void loadActiveUpiConfig()
    }

    return () => {
      isActive = false
    }
  }, [currentView])

  useEffect(() => {
    let isActive = true

    async function loadOrders() {
      if (!profile || !isSupabaseConfigured) {
        if (isActive) setCloudOrders([])
        return
      }

      // Stagger: wait 600ms after login so cart sync (profile?.id effect) fires first.
      await new Promise((resolve) => setTimeout(resolve, 600))
      if (!isActive) return

      const result = profile.role === "admin"
        ? await fetchOrdersForAdmin()
        : await fetchOrdersForCurrentUser()

      if (!isActive) return

      if (result.error) {
        console.error("Failed to load orders", result.error)
        return
      }

      setCloudOrders(result.orders)
    }

    loadOrders()

    return () => {
      isActive = false
    }
  }, [profile])

  useEffect(() => {
    let isActive = true

    async function loadFeatureFlags() {
      const result = await fetchFeatureFlags()
      if (!isActive) {
        return
      }

      if (result.error) {
        console.error("Failed to load feature flags", result.error)
        // Keep last known local value instead of reverting to defaults.
        return
      }

      setFeatureFlags(result.flags)
    }

    void loadFeatureFlags()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!products || products.length === 0) {
      return
    }

    setCartItems((current = []) => normalizeCartItems(current, products))
  }, [products, setCartItems])

  useEffect(() => {
    let isActive = true

    async function syncPersistedCart() {
      if (!profile || !isSupabaseConfigured) {
        return
      }

      // Small stagger so this and loadOrders don't slam PostgREST simultaneously.
      await new Promise((resolve) => setTimeout(resolve, 200))
      if (!isActive) return

      const result = await fetchCartForCurrentUser()
      if (!isActive) {
        return
      }

      if (result.error) {
        console.error("Failed to load cart items", result.error)
        return
      }

      const mergedCart = normalizeCartItems(mergeCartSnapshots(cartItems || [], result.cartItems), products || [])
      setCartItems(mergedCart)

      const persistResult = await replaceCartForCurrentUser(mergedCart)
      if (!isActive || persistResult.persisted || !persistResult.error) {
        return
      }

      console.error("Failed to sync cart items", persistResult.error)
    }

    syncPersistedCart()

    return () => {
      isActive = false
    }
  }, [profile?.id])

  const visibleCategories = (categories || []).filter((category) => !HIDDEN_CATEGORY_IDS.has(category.id))
  const visibleProducts = (products || []).filter((product) => !HIDDEN_PRODUCT_IDS.has(product.id) && !HIDDEN_CATEGORY_IDS.has(product.category))

  useEffect(() => {
    if (selectedCategory && HIDDEN_CATEGORY_IDS.has(selectedCategory)) {
      setSelectedCategory(null)
    }
  }, [selectedCategory])

  const categoryFilteredProducts = selectedCategory
    ? visibleProducts.filter((product) => product.category === selectedCategory)
    : visibleProducts
  const normalizedSearch = normalizeSearchText(searchQuery)
  const filteredProducts = normalizedSearch
    ? categoryFilteredProducts.filter((product) => {
      const categoryName = visibleCategories.find((category) => category.id === product.category)?.name
      return buildProductSearchText(product, categoryName).includes(normalizedSearch)
    })
    : categoryFilteredProducts

  const localOrders = orders || []
  const localOrdersForProfile = profile
    ? localOrders.filter((order) => order.userId === profile.id)
    : localOrders
  const customerOrders = profile ? mergeOrders(cloudOrders, localOrdersForProfile) : localOrders
  const adminOrders = mergeOrders(cloudOrders, localOrders)
  const trackingOwnerEmail = profile?.email?.trim().toLowerCase() ?? ""
  const trackingOwnerAllowed = trackingOwnerEmail === TRACKING_OWNER_EMAIL

  const anchorOrder = adminOrders.find((entry) => entry.id === TRACKING_VISIBLE_ORDER_ID)
  const adminCutoffTimestamp = anchorOrder
    ? getOrderTimestamp(anchorOrder)
    : parseOrderIdTimestamp(TRACKING_VISIBLE_ORDER_ID)
  const adminVisibleOrders = adminOrders.filter((entry) =>
    entry.id === TRACKING_VISIBLE_ORDER_ID || getOrderTimestamp(entry) >= adminCutoffTimestamp
  )
  const cartItemCount = (cartItems || []).reduce((sum, item) => sum + item.quantity, 0)

  const persistCartItem = async (item: CartItem) => {
    if (!profile || !isSupabaseConfigured) {
      return
    }

    const result = await upsertCartItemForCurrentUser(item)
    if (!result.persisted && result.error) {
      console.error("Failed to save cart item", result.error)
    }
  }

  const persistCartRemoval = async (productId: string, grams: number) => {
    if (!profile || !isSupabaseConfigured) {
      return
    }

    const result = await removeCartItemForCurrentUser(productId, grams)
    if (!result.persisted && result.error) {
      console.error("Failed to remove cart item", result.error)
    }
  }

  const handleAddToCart = (product: Product, grams: number = getProductPackGrams(product)) => {
    let nextItem: CartItem | null = null
    let limitExceeded = false

    setCartItems((current = []) => {
      const normalized = normalizeCartItems(current, products || [])
      const productTotalGrams = getTotalGramsForProduct(normalized, product.id)
      if (productTotalGrams + grams > MAX_PRODUCT_GRAMS_PER_CART) {
        limitExceeded = true
        return normalized
      }

      const existingItem = normalized.find((item) => item.productId === product.id && item.grams === grams)
      if (existingItem) {
        nextItem = { ...existingItem, quantity: existingItem.quantity + 1 }
        return normalized.map((item) =>
          item.productId === product.id && item.grams === grams
            ? { ...item, quantity: item.quantity + 1, grams }
            : item
        )
      }

      nextItem = { productId: product.id, quantity: 1, grams }
      return [...normalized, nextItem]
    })

    if (nextItem) {
      void persistCartItem(nextItem)
    }

    if (limitExceeded) {
      toast.error(`Maximum ${MAX_PRODUCT_GRAMS_PER_CART}g allowed per product in cart.`)
      return
    }

  }

  const handleUpdateQuantity = (productId: string, grams: number, quantity: number) => {
    if (quantity < 1) return

    const current = cartItems || []
    const otherItemsTotalGrams = current
      .filter((item) => !(item.productId === productId && item.grams === grams))
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + (item.grams * item.quantity), 0)

    const requestedTotalGrams = otherItemsTotalGrams + (grams * quantity)
    if (requestedTotalGrams > MAX_PRODUCT_GRAMS_PER_CART) {
      toast.error(`Maximum ${MAX_PRODUCT_GRAMS_PER_CART}g allowed per product in cart.`)
      return
    }

    let nextItem: CartItem | null = null
    setCartItems((current = []) =>
      current.map((item) =>
        item.productId === productId && item.grams === grams
          ? ((nextItem = { ...item, quantity }), { ...item, quantity })
          : item
      )
    )

    if (nextItem) {
      void persistCartItem(nextItem)
    }
  }

  const handleRemoveItem = (productId: string, grams: number) => {
    const targetItem = (cartItems || []).find((item) => item.productId === productId && item.grams === grams)
    setCartItems((current = []) => current.filter((item) => !(item.productId === productId && item.grams === grams)))

    if (targetItem) {
      void persistCartRemoval(targetItem.productId, targetItem.grams)
    }

  }

  const handleOpenAccount = () => {
    if (profile) {
      setCurrentView("account-details")
      return
    }

    setAuthMode("customer")
    setPostAuthView("store")
    setCurrentView("account")
  }

  const handleCheckout = () => {
    setCartOpen(false)

    if (!isSupabaseConfigured) {
      toast.error("Supabase auth is not configured yet.")
      return
    }

    if (!profile) {
      setAuthMode("customer")
      setPostAuthView("checkout")
      setCurrentView("account")
      return
    }

    setCurrentView("checkout")
  }

  const handleOpenTracking = () => {
    if (!isSupabaseConfigured) {
      toast.error("Supabase auth is not configured yet.")
      return
    }

    if (!profile) {
      setAuthMode("customer")
      setPostAuthView("tracking")
      setCurrentView("account")
      return
    }

    setCurrentView("tracking")
  }

  const handleOpenAdmin = () => {
    if (!isSupabaseConfigured) {
      toast.error("Supabase auth is not configured yet.")
      return
    }

    if (!profile || profile.role !== "admin") {
      setAuthMode("admin")
      setPostAuthView("admin")
      setCurrentView("account")
      return
    }

    setCurrentView("admin")
  }

  const handleBackToStore = () => {
    // Clear admin hash when navigating back so reload doesn't re-trigger admin route.
    if (window.location.hash === "#admin") {
      history.replaceState(null, "", window.location.pathname)
    }
    setCurrentView("store")
    setCurrentOrder(null)
  }

  const handleAuthenticated = (nextProfile: UserProfile) => {
    setProfile(nextProfile)
    setCurrentView(postAuthView)
  }

  const handleSignOut = async () => {
    await signOutUser()
    setProfile(null)
    setCloudOrders([])
    setCurrentOrder(null)
    setCurrentView("store")
    toast.info("Signed out")
  }

  const handleOrderComplete = async (order: Order) => {
    const nextOrder: Order = {
      ...order,
      userId: profile?.id ?? null,
    }

    setOrders((current = []) => [...current, nextOrder])
    setCloudOrders((current) => mergeOrders([nextOrder], current))
    setCurrentOrder(nextOrder)
    setCartItems([])
    void replaceCartForCurrentUser([])
    setCurrentView("payment")

    const result = await persistOrderToSupabase(nextOrder)
    if (!result.persisted) {
      if (result.reason === "error") {
        toast.error(`Database Error: ${result.error || "Failed to save order to cloud."}\n[Order ID: ${nextOrder.id}]`)
        console.error("Order persistence failed:", result)
      } else {
        toast.info("Cloud storage not configured. Order saved locally.")
      }
    } else {
      toast.success(`Order saved to ${result.provider}!`)

      if (result.provider === "supabase") {
        const notifyResult = await triggerOrderCreatedNotification(nextOrder)
        if (!notifyResult.ok) {
          console.warn("Order notification dispatch failed", notifyResult.error)
          toast.error(`Order notification failed: ${notifyResult.error ?? "Unknown error"}`)
        }
      }
    }
  }

  const markOrderPaidAndNavigate = async (order: Order) => {
    const updatedOrder: Order = {
      ...order,
      paymentStatus: "paid",
      status: "processing",
      updatedAt: new Date().toISOString(),
    }

    setOrders((current = []) =>
      current.map((entry) => (entry.id === updatedOrder.id ? updatedOrder : entry))
    )
    setCloudOrders((current) =>
      current.map((entry) => (entry.id === updatedOrder.id ? updatedOrder : entry))
    )
    setCurrentOrder(updatedOrder)
    setCurrentView("tracking")

    const result = await updateSupabaseOrderPayment(updatedOrder.id, "paid", "processing")
    if (!result.persisted) {
      if (result.reason === "error") {
        toast.error(`Payment status update failed: ${result.error || "Unknown error"}`)
        console.error("Payment update failed:", result)
      } else {
        toast.info("Payment status updated locally (cloud update not enabled).")
      }
    } else {
      toast.success("Payment status updated!")

      // Trigger WhatsApp / email notification for payment confirmation (UPI manual flow).
      const notifyResult = await triggerOrderNotification({
        eventType: "payment_verified",
        appOrderId: updatedOrder.id,
      })
      if (!notifyResult.ok) {
        console.warn("Payment notification dispatch failed", notifyResult.error)
        toast.error(`Payment notification failed: ${notifyResult.error ?? "Unknown error"}`)
      }
    }
  }

  const handleGatewayPayment = async () => {
    if (!currentOrder) return

    setIsProcessingGatewayPayment(true)
    const gatewayResult = await startRazorpayCheckout(currentOrder)
    setIsProcessingGatewayPayment(false)

    if (gatewayResult.cancelled) {
      toast.info("Payment was cancelled.")
      return
    }

    if (gatewayResult.error) {
      toast.error(gatewayResult.error)
      return
    }

    if (!gatewayResult.verified) {
      toast.error("Payment signature verification failed. Please try again.")
      return
    }

    const paidOrder: Order = {
      ...currentOrder,
      paymentDetails: {
        gateway: "razorpay",
        razorpayPaymentId: gatewayResult.razorpayPaymentId,
        razorpayOrderId: gatewayResult.razorpayOrderId,
        paidAt: new Date().toISOString(),
        status: "paid",
      },
    }

    await markOrderPaidAndNavigate(paidOrder)
  }

  const handleManualPaymentComplete = async () => {
    if (!currentOrder) return

    await markOrderPaidAndNavigate(currentOrder)
  }



  const handleViewTracking = (orderId: string) => {
    const visibleOrders = profile?.role === "admin" ? adminOrders : customerOrders
    const order = visibleOrders.find((item) => item.id === orderId)
    if (order) {
      setCurrentOrder(order)
      setCurrentView("tracking")
    }
  }

  const handleResumePayment = (orderId: string) => {
    const visibleOrders = profile?.role === "admin" ? adminOrders : customerOrders
    const order = visibleOrders.find((item) => item.id === orderId)
    if (!order) {
      toast.error("Order not found.")
      return
    }

    if (order.paymentStatus === "paid") {
      toast.info("This order is already paid.")
      return
    }

    setCurrentOrder(order)
    setCurrentView("payment")
  }

  if (currentView === "account") {
    return (
      <AuthView
        mode={authMode}
        onBack={handleBackToStore}
        onAuthenticated={handleAuthenticated}
        autoStartGoogleOnOpen={authMode === "customer"}
      />
    )
  }

  if (currentView === "account-details") {
    if (!profile) {
      return (
        <AuthView
          mode="customer"
          onBack={handleBackToStore}
          onAuthenticated={handleAuthenticated}
          autoStartGoogleOnOpen={true}
        />
      )
    }

    return (
      <AccountDetailsView
        profile={profile}
        onBack={handleBackToStore}
        onSignOut={handleSignOut}
      />
    )
  }

  if (currentView === "checkout") {
    if (!profile) {
      return (
        <AuthView
          mode="customer"
          onBack={handleBackToStore}
          onAuthenticated={handleAuthenticated}
          autoStartGoogleOnOpen={true}
        />
      )
    }

    return (
      <CheckoutView
        cartItems={cartItems || []}
        products={products || []}
        accountProfile={profile}
        runtimeMode={runtimeMode}
        onBack={handleBackToStore}
        onOrderComplete={handleOrderComplete}
      />
    )
  }

  if (currentView === "payment" && currentOrder) {
    const upiId = activeUpiConfig.upiId
    const upiName = activeUpiConfig.payeeName
    const amount = currentOrder.totalAmount.toFixed(2)
    const transactionNote = `Order ${currentOrder.id}`
    const upiParams = `pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent(transactionNote)}`
    const upiLink = `upi://pay?${upiParams}`

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Payment</h1>
              {runtimeMode === "dev" && <Badge variant="destructive">DEV MODE</Badge>}
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-6 max-w-lg">
          <div className="bg-card rounded-lg p-4 sm:p-6 text-center space-y-5">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <CreditCard size={32} className="text-primary" />
            </div>

            <h2 className="text-2xl font-bold">Complete Your Payment</h2>

            <div className="bg-muted px-4 py-4 rounded-lg space-y-3 text-left">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Order ID</p>
                <p className="text-sm font-mono font-semibold break-all">{currentOrder.id}</p>
              </div>

              {/* Order Breakdown */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{(currentOrder.subtotalAmount ?? 0).toFixed(2)}</span>
                </div>
                {(currentOrder.shippingAmount ?? 0) > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>₹{(currentOrder.shippingAmount ?? 0).toFixed(2)}</span>
                  </div>
                )}
                {(currentOrder.discountAmount ?? 0) > 0 && (
                  <div className="flex justify-between items-center text-sm text-green-600">
                    <span>Discount {currentOrder.promoCode ? `(${currentOrder.promoCode})` : ""}</span>
                    <span>-₹{(currentOrder.discountAmount ?? 0).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-border/50">
                <span className="text-base font-medium">Total Amount</span>
                <span className="text-2xl font-bold text-primary">₹{currentOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-2 border-dashed border-border p-6 rounded-lg">
              {isPaymentGatewayEnabled() ? (
                <>
                  <p className="font-semibold mb-2">Pay securely with Razorpay:</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Tap below to open Razorpay checkout. Your payment is marked successful only after server-side signature verification.
                  </p>
                  <Button
                    className="w-full"
                    onClick={handleGatewayPayment}
                    disabled={isProcessingGatewayPayment}
                  >
                    {isProcessingGatewayPayment
                      ? "Opening payment..."
                      : `Pay Rs ${currentOrder.totalAmount.toFixed(2)} with Razorpay`}
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-semibold mb-2">Pay using UPI:</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Scan the QR code and pay using any UPI app. This is a manual fallback flow when Razorpay is not configured.
                  </p>

                  <div className="mx-auto mb-4 w-fit rounded-lg border bg-white p-3">
                    <QRCode
                      value={upiLink}
                      size={224}
                      level="H"
                      includeMargin={true}
                    />
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Your Order ID is auto-generated and can be used to track your order.
                  </p>
                </>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <p className="font-semibold text-blue-900 mb-2">✓ Order Created</p>
              <p className="text-blue-800">Your order (ID: {currentOrder.id}) was created successfully during checkout and is stored in our system.</p>
              <p className="text-blue-800 mt-2">
                {isPaymentGatewayEnabled()
                  ? "Complete payment in Razorpay. After successful verification, you will be redirected to tracking with payment details and receipt options."
                  : "Complete your UPI payment above, then tap confirmation to update order status. Your account keeps this order tied to your login for future tracking and review requests."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button variant="outline" className="w-full sm:flex-1" onClick={handleBackToStore}>
                Back to Store
              </Button>
              {!isPaymentGatewayEnabled() && (
                <Button className="w-full sm:flex-1" onClick={handleManualPaymentComplete}>
                  I have completed payment
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentView === "tracking") {
    if (!profile) {
      return (
        <AuthView
          mode="customer"
          onBack={handleBackToStore}
          onAuthenticated={handleAuthenticated}
          autoStartGoogleOnOpen={true}
        />
      )
    }

    const allVisibleOrders = profile.role === "admin" ? adminVisibleOrders : customerOrders
    const trackingOrders = profile.role === "admin"
      ? allVisibleOrders.filter((entry) => entry.id === TRACKING_VISIBLE_ORDER_ID && trackingOwnerAllowed)
      : allVisibleOrders.filter(
        (entry) => entry.paymentStatus === "pending" || (entry.id === TRACKING_VISIBLE_ORDER_ID && trackingOwnerAllowed)
      )
    const trackingOrder = currentOrder?.id === TRACKING_VISIBLE_ORDER_ID
      ? currentOrder
      : (trackingOrders[0] ?? null)

    return (
      <OrderTrackingView
        order={trackingOrder}
        orders={trackingOrders}
        onBack={handleBackToStore}
        onSelectOrder={handleViewTracking}
        onResumePayment={handleResumePayment}
        onAddToCart={(productId) => {
          const product = (products || []).find((entry) => entry.id === productId)
          if (!product) {
            toast.error("Product not found.")
            return
          }

          handleAddToCart(product)
          setSearchQuery("")
        }}
      />
    )
  }

  if (currentView === "admin" || currentView === "admin-advanced") {
    if (!profile || profile.role !== "admin") {
      return (
        <AuthView
          mode="admin"
          onBack={handleBackToStore}
          onAuthenticated={handleAuthenticated}
        />
      )
    }

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={BRAND_LOGO_PATH}
                  alt="Sukhdevi Alchemy logo"
                  className="h-7 w-7 rounded-full object-contain border bg-white p-0.5"
                  loading="lazy"
                />
                <h1 className="text-2xl font-bold truncate">Admin Panel</h1>
                {runtimeMode === "dev" && <Badge variant="destructive">DEV MODE</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleBackToStore}>
                  Back to Store
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <AdminSimplifiedPanel orders={adminVisibleOrders} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white text-slate-900 shadow-sm sm:border-border sm:bg-card sm:text-foreground">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-4">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent side="left" className="w-[85vw] max-w-xs">
              <SheetHeader>
                <SheetTitle>Sukhdevi Alchemy</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-5">
                <CategorySidebar
                  categories={visibleCategories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={(category) => {
                    setSelectedCategory(category)
                    setMobileMenuOpen(false)
                  }}
                />

                {profile?.role === "admin" && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      handleOpenAdmin()
                    }}
                  >
                    <Gear size={16} className="mr-2" />
                    Admin Panel
                  </Button>
                )}

                <div className="border-t pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your Account</p>
                  <div className="space-y-2">
                    {profile && (
                      <Button variant="ghost" className="w-full justify-start" onClick={() => {
                        setMobileMenuOpen(false)
                        handleOpenTracking()
                      }}>
                        Your Orders
                      </Button>
                    )}
                    <Button variant="ghost" className="w-full justify-start" onClick={() => {
                      setMobileMenuOpen(false)
                      handleOpenAccount()
                    }}>
                      {profile ? "Your Account" : "Sign In"}
                    </Button>
                    {profile && (
                      <Button variant="ghost" className="w-full justify-start" onClick={() => {
                        setMobileMenuOpen(false)
                        handleSignOut()
                      }}>
                        Sign Out
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <div className="space-y-2 sm:hidden">
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-sm">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMobileMenuOpen(true)}
                  className="h-9 w-9 rounded-md border-slate-200 bg-white text-slate-700 shadow-sm"
                  aria-label="Open category menu"
                >
                  <List size={18} />
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory(null)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-1.5 py-1 text-left shadow-sm ring-1 ring-slate-100"
                >
                  <img
                    src={BRAND_LOGO_PATH}
                    alt="Sukhdevi Alchemy logo"
                    className="h-6 w-6 rounded-full border border-slate-200 bg-white p-0.5 object-contain"
                    loading="lazy"
                  />
                  <p className="truncate text-[22px] font-bold leading-none text-black">Sukhdevi Alchemy</p>
                </button>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={handleOpenAccount}
                className="h-9 w-9 rounded-full border-slate-200 bg-white text-slate-700 shadow-sm"
                aria-label="Account"
              >
                <UserCircle size={18} />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-10 flex-1 items-center rounded-full border border-slate-200 bg-white px-3 shadow-sm">
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Discover products"
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  aria-label="Search products"
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => searchInputRef.current?.focus()}
                className="h-10 w-10 rounded-full border-slate-200 bg-white text-slate-700 shadow-sm"
                aria-label="Search"
              >
                <MagnifyingGlass size={18} />
              </Button>
            </div>
          </div>

          <div className="hidden sm:block">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center min-w-0 gap-2 sm:gap-4">
              <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(true)} className="lg:hidden h-9 w-9 p-0 text-slate-100 hover:bg-slate-800 hover:text-white sm:h-auto sm:w-auto sm:p-2 sm:text-foreground sm:hover:bg-accent sm:hover:text-accent-foreground">
                <List size={24} />
              </Button>

              <img
                  src={BRAND_LOGO_PATH}
                alt="Sukhdevi Alchemy logo"
                className="h-6 w-6 rounded-full border bg-white p-0.5 object-contain sm:h-7 sm:w-7"
                loading="lazy"
              />
              <h1 className="truncate text-base font-semibold sm:text-2xl md:text-3xl sm:font-bold">Sukhdevi Alchemy</h1>
              <Badge variant="secondary" className="hidden md:inline-flex text-xs sm:text-sm">Premium Blended Masala</Badge>
              {runtimeMode === "dev" && <Badge variant="destructive" className="hidden md:inline-flex">DEV MODE</Badge>}
              {devModeLocked && <Badge variant="outline" className="hidden md:inline-flex">PROD LOCKED</Badge>}
              <div className="hidden xl:flex items-center gap-1.5 pl-1">
                {socialProfiles.map((profile) => (
                  <a
                    key={profile.name}
                    href={profile.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${profile.name}`}
                    title={`${profile.name} ${profile.handle}`}
                    className="rounded-full border p-1.5 text-muted-foreground transition hover:text-foreground"
                  >
                    {profile.name === "Instagram" && <InstagramLogo size={14} weight="duotone" />}
                    {profile.name === "YouTube" && <YoutubeLogo size={14} weight="duotone" />}
                  </a>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {profile?.role === "admin" && (
                <Button variant="ghost" size="sm" onClick={handleOpenAdmin} className="hidden md:flex">
                  <Gear size={18} className="mr-2" />
                  Admin
                </Button>
              )}
              {/* Admin login is intentionally not exposed here.
                  Access via sukhdevialchemy.com/#admin */}

              {profile && (
                <Button variant="outline" size="sm" onClick={handleOpenTracking} className="hidden sm:flex">
                  <Package size={18} className="mr-2" />
                  Track Order
                </Button>
              )}

              {profile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenTracking}
                  className="sm:hidden h-9 px-2 text-[11px]"
                  aria-label="My Orders"
                >
                  <Package size={14} className="mr-1" />
                  <span>My Orders</span>
                </Button>
              )}

              <Button variant="outline" size="icon" onClick={handleOpenAccount} className="sm:hidden h-9 w-9" aria-label="Account">
                <UserCircle size={18} />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenAccount}
                className="hidden sm:flex"
              >
                <UserCircle size={18} className="mr-2" />
                {profile ? (profile.fullName?.split(" ")[0] || "Account") : "Account"}
              </Button>

              {profile && (
                <Button variant="ghost" size="icon" onClick={handleSignOut} className="hidden h-9 w-9 sm:inline-flex">
                  <SignOut size={18} />
                </Button>
              )}

              <Button variant="outline" size="icon" onClick={() => setCartOpen(true)} className="relative h-9 w-9 sm:h-10 sm:w-10" aria-label="Open Cart">
                <ShoppingCart size={20} />
                {cartItemCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 px-1 text-[10px]">
                    {cartItemCount}
                  </Badge>
                )}
              </Button>
            </div>
          </div>

          <div className="mt-2 hidden items-center gap-2 xl:hidden sm:flex">
            {socialProfiles.map((profile) => (
              <a
                key={`mobile-${profile.name}`}
                href={profile.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${profile.name}`}
                title={`${profile.name} ${profile.handle}`}
                className="rounded-full border p-1.5 text-muted-foreground transition hover:text-foreground"
              >
                {profile.name === "Instagram" && <InstagramLogo size={14} weight="duotone" />}
                {profile.name === "YouTube" && <YoutubeLogo size={14} weight="duotone" />}
              </a>
            ))}
          </div>

          <div className="mt-3 hidden sm:flex items-center gap-2">
            <div className="flex h-10 flex-1 items-center rounded-full border bg-background px-3">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search products"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                aria-label="Search products"
              />
            </div>
            {searchQuery && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
              >
                Clear
              </Button>
            )}
          </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 py-4 pb-24 sm:px-4 sm:py-8 sm:pb-8">
        <div className="flex gap-8">
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <CategorySidebar
                categories={visibleCategories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </div>
          </aside>

          <main className="flex-1">
            <div className="mb-4 sm:mb-6">
              <h2 className="text-2xl font-bold mb-2">
                {selectedCategory
                  ? visibleCategories.find((category) => category.id === selectedCategory)?.name || "Products"
                  : "All Products"}
              </h2>
              <p className="text-muted-foreground">{filteredProducts.length} products available</p>
            </div>

            <div className={ENABLE_AMAZON_STYLE_MOBILE_PRODUCT_CARDS ? "grid grid-cols-2 md:grid-cols-2 gap-3 sm:gap-6" : "grid grid-cols-1 md:grid-cols-2 gap-6"}>
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onViewDetails={setSelectedProduct}
                  onAddToCart={handleAddToCart}
                  mobileDenseLayout={ENABLE_AMAZON_STYLE_MOBILE_PRODUCT_CARDS}
                />
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">No products found in this category.</p>
              </div>
            )}
          </main>
        </div>
      </div>

      {showAuthHandoffNotice && !profile && (
        <div className="container mx-auto px-3 sm:px-4 -mt-1 mb-2">
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700">
            Signing you in...
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-white sm:hidden">
        <div className="grid grid-cols-4">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory(null)
              setSearchQuery("")
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
            className="flex flex-col items-center gap-1 py-2 text-xs"
          >
            <House size={18} />
            Home
          </button>
          <button
            type="button"
            onClick={() => searchInputRef.current?.focus()}
            className="flex flex-col items-center gap-1 py-2 text-xs"
          >
            <MagnifyingGlass size={18} />
            Search
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center gap-1 py-2 text-xs"
          >
            <SquaresFour size={18} />
            Category
          </button>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative flex flex-col items-center gap-1 py-2 text-xs"
          >
            <ShoppingCart size={18} />
            Cart
            {cartItemCount > 0 && (
              <span className="absolute right-6 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      <ContactUsSection />

      <footer className="mt-16 border-t bg-slate-900 text-slate-100">
        <div className="container mx-auto px-4 py-8 text-center text-sm">
          <img
            src={BRAND_LOGO_PATH}
            alt="Sukhdevi Alchemy logo"
            className="mx-auto mb-3 h-9 w-9 rounded-full border border-slate-300 bg-white p-0.5 object-contain"
            loading="lazy"
          />
          <p className="text-slate-100">© 2026 Sukhdevi Alchemy. Premium Masala & Organic Spices.</p>
          <p className="mx-auto mt-2 max-w-2xl text-xs text-slate-300">
            By using this website, you agree to our terms, privacy policy, returns process, and shipping rules.
            Product colors and pack appearance may vary slightly due to natural sourcing and display differences.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-200">
            <a href="/terms-and-conditions.html" target="_blank" rel="noreferrer" className="transition hover:text-white">Terms & Conditions</a>
            <a href="/privacy-policy.html" target="_blank" rel="noreferrer" className="transition hover:text-white">Privacy Policy</a>
            <a href="/shipping-policy.html" target="_blank" rel="noreferrer" className="transition hover:text-white">Shipping Policy</a>
            <a href="/returns-refunds-policy.html" target="_blank" rel="noreferrer" className="transition hover:text-white">Returns & Refunds</a>
            <a href="mailto:care@sukhdevialchemy.com" className="transition hover:text-white">Contact Legal</a>
          </div>
        </div>
      </footer>

      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        cartItems={cartItems ?? []}
        products={products ?? []}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
      />

      {selectedProduct && (
        <ProductDetailDialog
          product={selectedProduct}
          currentUser={profile}
          canReview={Boolean(profile && profile.role === "customer" && hasPurchasedProduct(customerOrders, selectedProduct.id))}
          open={!!selectedProduct}
          onOpenChange={(open: boolean) => !open && setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  )
}

export default App
