import { useEffect, useState } from "react"
import { useKV } from "@/hooks/use-kv"
import { ShoppingCart, List, Package, CreditCard, Gear, SignOut, UserCircle } from "@phosphor-icons/react"
import { QRCodeSVG as QRCode } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { CategorySidebar } from "@/components/CategorySidebar"
import { ProductCard } from "@/components/ProductCard"
import { CartDrawer } from "@/components/CartDrawer"
import { ProductDetailDialog } from "@/components/ProductDetailDialog"
import { CheckoutView } from "@/components/CheckoutView"
import { OrderTrackingView } from "@/components/OrderTrackingView"
import { TestimonialsSection } from "@/components/TestimonialsSection"
import { ContactUsSection } from "@/components/ContactUsSection"
import { AdminPanel } from "@/components/AdminPanel"
import { AuthView } from "@/components/AuthView"
import type { Category, Product, CartItem, Order, UserProfile } from "@/lib/types"
import { toast } from "sonner"
import { useInitialData } from "@/hooks/use-initial-data"
import { getCurrentAuthState, signOutUser, subscribeToAuthStateChanges } from "@/lib/auth"
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
import { getProductPackGrams, hasPurchasedProduct } from "@/lib/pricing"

type View = "store" | "account" | "checkout" | "payment" | "tracking" | "admin"

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

function mergeCartItems(primary: CartItem[], secondary: CartItem[]) {
  const merged = new Map<string, CartItem>()

  for (const item of [...primary, ...secondary]) {
    const key = getCartItemKey(item)
    const existing = merged.get(key)

    if (existing) {
      merged.set(key, { ...existing, quantity: existing.quantity + item.quantity })
      continue
    }

    merged.set(key, item)
  }

  return [...merged.values()]
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

  return mergeCartItems(normalized, [])
}

function App() {
  useInitialData()

  const [categories, setCategories] = useKV<Category[]>("categories", [])
  const [products] = useKV<Product[]>("products", [])
  const [cartItems, setCartItems] = useKV<CartItem[]>("cart", [])
  const [orders, setOrders] = useKV<Order[]>("orders", [])

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [currentView, setCurrentView] = useState<View>("store")
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authMode, setAuthMode] = useState<"customer" | "admin">("customer")
  const [postAuthView, setPostAuthView] = useState<View>("store")
  const [cloudOrders, setCloudOrders] = useState<Order[]>([])

  useEffect(() => {
    if (categories && categories.length > 0) {
      const rawSpicesCategory = categories.find(
        (cat) => cat.slug === "raw-organic-spices" || cat.name === "Raw Organic Spices"
      )

      if (rawSpicesCategory && rawSpicesCategory.enabled) {
        setCategories((current = []) =>
          current.map((cat) =>
            cat.slug === "raw-organic-spices" || cat.name === "Raw Organic Spices"
              ? { ...cat, enabled: false }
              : cat
          )
        )
      }
    }
  }, [categories, setCategories])

  useEffect(() => {
    let isActive = true

    console.log("[app-auth] getCurrentAuthState requested")
    getCurrentAuthState().then((state) => {
      if (!isActive) return
      console.log("[app-auth] getCurrentAuthState resolved", {
        hasUser: Boolean(state.user),
        hasProfile: Boolean(state.profile),
        role: state.profile?.role ?? null,
      })
      setProfile(state.profile)
    })

    const subscription = subscribeToAuthStateChanges((state) => {
      if (!isActive) return
      console.log("[app-auth] onAuthStateChange", {
        hasUser: Boolean(state.user),
        hasProfile: Boolean(state.profile),
        role: state.profile?.role ?? null,
      })
      setProfile(state.profile)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let isActive = true

    async function loadOrders() {
      if (!profile || !isSupabaseConfigured) {
        if (isActive) setCloudOrders([])
        return
      }

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

      const result = await fetchCartForCurrentUser()
      if (!isActive) {
        return
      }

      if (result.error) {
        console.error("Failed to load cart items", result.error)
        return
      }

      const mergedCart = normalizeCartItems(mergeCartItems(cartItems || [], result.cartItems), products || [])
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

  const filteredProducts = selectedCategory
    ? (products || []).filter((product) => product.category === selectedCategory)
    : products || []

  const localOrders = orders || []
  const localOrdersForProfile = profile
    ? localOrders.filter((order) => order.userId === profile.id)
    : localOrders
  const customerOrders = profile ? mergeOrders(cloudOrders, localOrdersForProfile) : localOrders
  const adminOrders = mergeOrders(cloudOrders, localOrders)
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

    setCartItems((current = []) => {
      const normalized = normalizeCartItems(current, products || [])
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

    toast.success(`${product.name} added to cart!`)
  }

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return

    let nextItem: CartItem | null = null
    setCartItems((current = []) =>
      current.map((item) =>
        item.productId === productId
          ? ((nextItem = { ...item, quantity }), { ...item, quantity })
          : item
      )
    )

    if (nextItem) {
      void persistCartItem(nextItem)
    }
  }

  const handleRemoveItem = (productId: string) => {
    const targetItem = (cartItems || []).find((item) => item.productId === productId)
    setCartItems((current = []) => current.filter((item) => item.productId !== productId))

    if (targetItem) {
      void persistCartRemoval(targetItem.productId, targetItem.grams)
    }

    toast.info("Item removed from cart")
  }

  const handleOpenAccount = () => {
    if (profile) {
      setCurrentView(profile.role === "admin" ? "admin" : "tracking")
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
    }
  }

  const handlePaymentComplete = async () => {
    if (!currentOrder) return

    const updatedOrder: Order = {
      ...currentOrder,
      paymentStatus: "paid",
      status: "processing",
      updatedAt: new Date().toISOString(),
    }

    setOrders((current = []) =>
      current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
    )
    setCloudOrders((current) =>
      current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
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
    }
  }

  const handleBackToStore = () => {
    setCurrentView("store")
    setCurrentOrder(null)
  }

  const handleViewTracking = (orderId: string) => {
    const visibleOrders = profile?.role === "admin" ? adminOrders : customerOrders
    const order = visibleOrders.find((item) => item.id === orderId)
    if (order) {
      setCurrentOrder(order)
      setCurrentView("tracking")
    }
  }

  if (currentView === "account") {
    return (
      <AuthView
        mode={authMode}
        onBack={handleBackToStore}
        onAuthenticated={handleAuthenticated}
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
        />
      )
    }

    return (
      <CheckoutView
        cartItems={cartItems || []}
        products={products || []}
        accountProfile={profile}
        onBack={handleBackToStore}
        onOrderComplete={handleOrderComplete}
      />
    )
  }

  if (currentView === "payment" && currentOrder) {
    const upiId = "poonam.om.107@okicici"
    const upiName = "Sukhdevi Alchemy"
    const amount = currentOrder.totalAmount.toFixed(2)
    const transactionNote = `Order ${currentOrder.id}`
    const upiParams = `pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent(transactionNote)}`
    const upiLink = `upi://pay?${upiParams}`
    // Google Pay (Tez) deep-link
    const gpayLink = `tez://upi/pay?${upiParams}`
    // Android intent with explicit package greatly reduces other UPI apps intercepting the link.
    const gpayIntentLink = `intent://upi/pay?${upiParams}#Intent;scheme=tez;package=com.google.android.apps.nbu.paisa.user;end`
    const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)
    const preferredGpayLink = isAndroid ? gpayIntentLink : gpayLink

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold">Payment</h1>
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
              <div className="flex justify-between items-center">
                <span className="text-base font-medium">Amount</span>
                <span className="text-2xl font-bold text-primary">₹{currentOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-2 border-dashed border-border p-6 rounded-lg">
              <p className="font-semibold mb-2">Pay using UPI:</p>

              <div className="mx-auto mb-4 w-fit rounded-lg border bg-white p-3">
                <QRCode
                  value={upiLink}
                  size={224}
                  level="H"
                  includeMargin={true}
                  alt="UPI QR code for payment"
                />
              </div>

              <Button asChild className="w-full mb-2">
                <a href={preferredGpayLink}>Open Google Pay</a>
              </Button>
              <Button asChild variant="outline" className="w-full mb-3">
                <a href={upiLink}>Other UPI App</a>
              </Button>

              <p className="text-sm text-muted-foreground">
                Tap <strong>Open Google Pay</strong> to pay directly. Use <em>Other UPI App</em> if you prefer PhonePe, Paytm, etc. The order ID is auto-filled.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <p className="font-semibold text-blue-900 mb-2">✓ Order Created</p>
              <p className="text-blue-800">Your order (ID: {currentOrder.id}) was created successfully during checkout and is stored in our system.</p>
              <p className="text-blue-800 mt-2">Complete your UPI payment above, then confirm to update the order status. Your account keeps this order tied to your login for future tracking and review requests.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button variant="outline" className="w-full sm:flex-1" onClick={handleBackToStore}>
                Back to Store
              </Button>
              <Button className="w-full sm:flex-1" onClick={handlePaymentComplete}>
                I have completed payment
              </Button>
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
        />
      )
    }

    return (
      <OrderTrackingView
        order={currentOrder}
        orders={profile.role === "admin" ? adminOrders : customerOrders}
        onBack={handleBackToStore}
        onSelectOrder={handleViewTracking}
      />
    )
  }

  if (currentView === "admin") {
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
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <Button variant="outline" onClick={handleBackToStore}>
                Back to Store
              </Button>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <AdminPanel orders={adminOrders} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center min-w-0 gap-2 sm:gap-4">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="lg:hidden">
                    <List size={24} />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[85vw] max-w-xs">
                  <SheetHeader>
                    <SheetTitle>Categories</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <CategorySidebar
                      categories={categories || []}
                      selectedCategory={selectedCategory}
                      onSelectCategory={(category) => {
                        setSelectedCategory(category)
                        setMobileMenuOpen(false)
                      }}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              <h1 className="truncate text-lg sm:text-2xl md:text-3xl font-bold">Sukhdevi Alchemy</h1>
              <Badge variant="secondary" className="hidden md:inline-flex text-xs sm:text-sm">Premium Masala</Badge>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {profile?.role === "admin" && (
                <Button variant="ghost" size="sm" onClick={handleOpenAdmin} className="hidden md:flex">
                  <Gear size={18} className="mr-2" />
                  Admin
                </Button>
              )}

              {profile && (
                <Button variant="outline" size="sm" onClick={handleOpenTracking} className="hidden sm:flex">
                  <Package size={18} className="mr-2" />
                  Track Order
                </Button>
              )}

              <Button variant="ghost" size="icon" onClick={handleOpenAccount} className="sm:hidden h-9 w-9" aria-label="Account">
                <UserCircle size={18} />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenAccount}
                className="hidden sm:flex"
              >
                <UserCircle size={18} className="mr-2" />
                {profile ? profile.fullName.split(" ")[0] : "Account"}
              </Button>

              {profile && (
                <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9">
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
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <CategorySidebar
                categories={categories || []}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </div>
          </aside>

          <main className="flex-1">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">
                {selectedCategory
                  ? (categories || []).find((category) => category.id === selectedCategory)?.name || "Products"
                  : "All Products"}
              </h2>
              <p className="text-muted-foreground">{filteredProducts.length} products available</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onViewDetails={setSelectedProduct}
                  onAddToCart={handleAddToCart}
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

      <TestimonialsSection />
      <ContactUsSection />

      <footer className="border-t bg-card mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>© 2026 Sukhdevi Alchemy. Premium Masala & Organic Spices.</p>
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
