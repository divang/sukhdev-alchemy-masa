import { useState, useEffect } from "react"
import { useKV } from "@github/spark/hooks"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, List, Package, CreditCard, Gear } from "@phosphor-icons/react"
import { CategorySidebar } from "@/components/CategorySidebar"
import { ProductCard } from "@/components/ProductCard"
import { CartDrawer } from "@/components/CartDrawer"
import { ProductDetailDialog } from "@/components/ProductDetailDialog"
import { CheckoutView } from "@/components/CheckoutView"
import { OrderTrackingView } from "@/components/OrderTrackingView"
import { TestimonialsSection } from "@/components/TestimonialsSection"
import { AdminPanel } from "@/components/AdminPanel"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { Category, Product, CartItem, Order } from "@/lib/types"
import { toast } from "sonner"
import { useInitialData } from "@/hooks/use-initial-data"

type View = "store" | "checkout" | "payment" | "tracking" | "admin"

function App() {
  useInitialData()
  
  const [categories, setCategories] = useKV<Category[]>("categories", [])
  const [products] = useKV<Product[]>("products", [])
  const [cartItems, setCartItems] = useKV<CartItem[]>("cart", [])
  const [orders, setOrders] = useKV<Order[]>("orders", [])
  
  useEffect(() => {
    if (categories && categories.length > 0) {
      const rawSpicesCategory = categories.find(cat => 
        cat.slug === 'raw-organic-spices' || cat.name === 'Raw Organic Spices'
      )
      
      if (rawSpicesCategory && rawSpicesCategory.enabled) {
        setCategories((current = []) =>
          current.map(cat =>
            (cat.slug === 'raw-organic-spices' || cat.name === 'Raw Organic Spices')
              ? { ...cat, enabled: false }
              : cat
          )
        )
      }
    }
  }, [])
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [currentView, setCurrentView] = useState<View>("store")
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  
  const filteredProducts = selectedCategory
    ? (products || []).filter(p => p.category === selectedCategory)
    : (products || [])
  
  const cartItemCount = (cartItems || []).reduce((sum, item) => sum + item.quantity, 0)
  
  const handleAddToCart = (product: Product, grams: number = 100) => {
    setCartItems((current = []) => {
      const existingItem = current.find(item => item.productId === product.id)
      if (existingItem) {
        return current.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, grams }
            : item
        )
      }
      return [...current, { productId: product.id, quantity: 1, grams }]
    })
    toast.success(`${product.name} added to cart!`)
  }
  
  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return
    setCartItems((current = []) =>
      current.map(item =>
        item.productId === productId ? { ...item, quantity } : item
      )
    )
  }
  
  const handleUpdateGrams = (productId: string, grams: number) => {
    setCartItems((current = []) =>
      current.map(item =>
        item.productId === productId ? { ...item, grams } : item
      )
    )
  }
  
  const handleRemoveItem = (productId: string) => {
    setCartItems((current = []) => current.filter(item => item.productId !== productId))
    toast.info("Item removed from cart")
  }
  
  const handleCheckout = () => {
    setCartOpen(false)
    setCurrentView("checkout")
  }
  
  const handleOrderComplete = (order: Order) => {
    setOrders((current = []) => [...current, order])
    setCurrentOrder(order)
    setCartItems([])
    setCurrentView("payment")
  }
  
  const handlePaymentComplete = () => {
    setCurrentView("tracking")
  }
  
  const handleBackToStore = () => {
    setCurrentView("store")
    setCurrentOrder(null)
  }
  
  const handleViewTracking = (orderId: string) => {
    const order = (orders || []).find(o => o.id === orderId)
    if (order) {
      setCurrentOrder(order)
      setCurrentView("tracking")
    }
  }
  
  if (currentView === "checkout") {
    return (
      <CheckoutView
        cartItems={cartItems || []}
        products={products || []}
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
    const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent(transactionNote)}`
    const baseUrl = import.meta.env.BASE_URL || "/"
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
    const qrCodeUrl = `${normalizedBaseUrl}images/products/SukhDeviAlchemy-UPI-Barcode.jpeg`

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold">Payment</h1>
          </div>
        </header>
        
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="bg-card rounded-lg p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <CreditCard size={32} className="text-primary" />
            </div>
            
            <h2 className="text-2xl font-bold">Complete Your Payment</h2>
            
            <div className="bg-muted p-6 rounded-lg space-y-4">
              <div className="flex justify-between text-lg">
                <span>Order ID:</span>
                <span className="font-mono font-bold">{currentOrder.id}</span>
              </div>
              <div className="flex justify-between text-2xl font-bold">
                <span>Amount:</span>
                <span className="text-primary">₹{currentOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="border-2 border-dashed border-border p-6 rounded-lg">
              <p className="font-semibold mb-2">Pay using UPI:</p>
              <p className="text-lg sm:text-2xl font-mono font-bold text-primary mb-4 break-all leading-relaxed px-2">{upiId}</p>

              <div className="mx-auto mb-4 w-fit rounded-lg border bg-white p-3">
                <img
                  src={qrCodeUrl}
                  alt="UPI QR code for payment"
                  className="h-56 w-56"
                  loading="lazy"
                />
              </div>

              <Button asChild variant="outline" className="mb-3">
                <a href={upiLink}>Pay in UPI App</a>
              </Button>

              <p className="text-sm text-muted-foreground">
                Scan QR code or use UPI ID to complete payment
              </p>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p>After completing the payment, please click the button below.</p>
              <p>Your order will be processed once payment is confirmed.</p>
            </div>
            
            <div className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleBackToStore}
              >
                Back to Store
              </Button>
              <Button
                className="flex-1"
                onClick={handlePaymentComplete}
              >
                I have completed payment
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  if (currentView === "tracking") {
    return (
      <OrderTrackingView
        order={currentOrder}
        orders={orders || []}
        onBack={handleBackToStore}
        onSelectOrder={handleViewTracking}
      />
    )
  }
  
  if (currentView === "admin") {
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
          <AdminPanel />
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="lg:hidden">
                    <List size={24} />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64">
                  <SheetHeader>
                    <SheetTitle>Categories</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <CategorySidebar
                      categories={categories || []}
                      selectedCategory={selectedCategory}
                      onSelectCategory={(cat) => {
                        setSelectedCategory(cat)
                        setMobileMenuOpen(false)
                      }}
                    />
                  </div>
                </SheetContent>
              </Sheet>
              
              <h1 className="text-2xl md:text-3xl font-bold">Sukhdevi Alchemy Masala</h1>
              <Badge variant="secondary" className="hidden sm:inline-flex">Premium Masala</Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentView("admin")}
                className="hidden md:flex"
              >
                <Gear size={18} className="mr-2" />
                Manage Images
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentView("tracking")}
                className="hidden sm:flex"
              >
                <Package size={18} className="mr-2" />
                Track Order
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCartOpen(true)}
                className="relative"
              >
                <ShoppingCart size={20} />
                {cartItemCount > 0 && (
                  <Badge 
                    className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
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
                  ? (categories || []).find(c => c.id === selectedCategory)?.name || "Products"
                  : "All Products"}
              </h2>
              <p className="text-muted-foreground">{(filteredProducts || []).length} products available</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(filteredProducts || []).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onViewDetails={setSelectedProduct}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
            
            {(filteredProducts || []).length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">No products found in this category.</p>
              </div>
            )}
          </main>
        </div>
      </div>
      
      <TestimonialsSection />
      
      <footer className="border-t bg-card mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>© 2024 Sukhdevi Alchemy Masala. Premium Masala & Organic Spices.</p>
        </div>
      </footer>
      
      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        cartItems={cartItems ?? []}
        products={products ?? []}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdateGrams={handleUpdateGrams}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
      />
      
      {selectedProduct && (
        <ProductDetailDialog
          product={selectedProduct}
          open={!!selectedProduct}
          onOpenChange={(open: boolean) => !open && setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  )
}

export default App
