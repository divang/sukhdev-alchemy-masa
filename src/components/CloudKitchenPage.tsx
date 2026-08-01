import { useState, useEffect } from "react"
import { useKV } from "@/hooks/use-kv"
import { useInitialData } from "@/hooks/use-initial-data"
import { ProductDetailDialog } from "@/components/ProductDetailDialog"
import { CheckoutView } from "@/components/CheckoutView"
import { CartDrawer } from "@/components/CartDrawer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, ArrowLeft, InstagramLogo, YoutubeLogo, Leaf, Lightning, CalendarBlank } from "@phosphor-icons/react"
import type { CartItem, Product, Order } from "@/lib/types"
import { toast } from "sonner"
import {
  getProductPackGrams,
  resolveProductPackPrice,
  isCloudKitchenProduct,
} from "@/lib/pricing"
import { CATALOG_SEED_PRODUCTS } from "@/lib/catalog-seed"
import { getProductImage } from "@/lib/product-images"
import { BRAND_LOGO_PATH } from "@/lib/brand"

// ─── Cart helpers (mirrors App.tsx minimal subset) ───────────────────────────

function getCartItemKey(item: CartItem) {
  const addOnKey = (item.selectedAddOns ?? [])
    .map((a) => a.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join("|")
  return `${item.productId}:${item.grams}:${addOnKey}`
}

function canonicalizeCart(items: CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>()
  for (const item of items) {
    const key = getCartItemKey(item)
    const existing = merged.get(key)
    if (existing) {
      merged.set(key, { ...existing, quantity: Math.max(existing.quantity, item.quantity) })
    } else {
      merged.set(key, item)
    }
  }
  return [...merged.values()]
}

// ─── Section definitions — add new rows here as categories grow ───────────────
const CK_SECTIONS: { id: string; label: string; tagFilter: string; comingSoon?: boolean }[] = [
  { id: "smoothies", label: "🥤 Smoothies", tagFilter: "smoothie" },
  { id: "breakfast", label: "🍳 Breakfast", tagFilter: "breakfast", comingSoon: true },
  { id: "brunch", label: "🥗 Brunch", tagFilter: "brunch", comingSoon: true },
  { id: "dinner", label: "🍛 Dinner", tagFilter: "dinner", comingSoon: true },
]

type CKView = "store" | "checkout"

export function CloudKitchenPage() {
  useInitialData()

  // Dynamic page title
  useEffect(() => {
    const prev = document.title
    document.title = "Cloud Kitchen | Sukhdevi Alchemy"
    return () => { document.title = prev }
  }, [])

  const [products] = useKV<Product[]>("products", CATALOG_SEED_PRODUCTS)
  const [cartItems, setCartItems] = useKV<CartItem[]>("ck-cart", [])
  const [productImages] = useKV<Record<string, string>>("product-images", {})

  const [currentView, setCurrentView] = useState<CKView>("store")
  const [cartOpen, setCartOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const allCkProducts = (products ?? CATALOG_SEED_PRODUCTS).filter((p) => isCloudKitchenProduct(p))
  const cartItemCount = (cartItems ?? []).reduce((sum, item) => sum + item.quantity, 0)

  // ── Cart actions ──
  const handleAddToCart = (product: Product, grams: number, selectedAddOns?: string[]) => {
    const newItem: CartItem = { productId: product.id, grams, quantity: 1, selectedAddOns: selectedAddOns ?? [] }
    setCartItems((current = []) => {
      const key = getCartItemKey(newItem)
      const existing = current.find((i) => getCartItemKey(i) === key)
      if (existing) {
        return current.map((i) => getCartItemKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return canonicalizeCart([...current, newItem])
    })
    toast.success(`${product.name} added to cart`)
  }

  const handleUpdateQuantity = (productId: string, grams: number, quantity: number, selectedAddOns: string[] = []) => {
    const key = getCartItemKey({ productId, grams, quantity, selectedAddOns })
    setCartItems((current = []) =>
      quantity <= 0
        ? current.filter((i) => getCartItemKey(i) !== key)
        : current.map((i) => (getCartItemKey(i) === key ? { ...i, quantity } : i))
    )
  }

  const handleRemoveItem = (productId: string, grams: number, selectedAddOns: string[] = []) => {
    const key = getCartItemKey({ productId, grams, quantity: 0, selectedAddOns })
    setCartItems((current = []) => current.filter((i) => getCartItemKey(i) !== key))
  }

  const handleOrderComplete = (_order: Order) => {
    setCartItems([])
    setCurrentView("store")
    toast.success("Order placed! We'll be in touch shortly.")
  }

  // ── Checkout view ──
  if (currentView === "checkout") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-4">
          <CheckoutView
            cartItems={cartItems ?? []}
            products={products ?? CATALOG_SEED_PRODUCTS}
            onBack={() => setCurrentView("store")}
            onOrderComplete={handleOrderComplete}
          />
        </div>
      </div>
    )
  }

  // ── Store view ──
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-emerald-50 to-white">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={BRAND_LOGO_PATH} alt="Sukhdevi Alchemy" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-emerald-600 font-semibold leading-none truncate">
                Sukhdevi Alchemy
              </p>
              <h1 className="text-sm font-bold text-emerald-900 leading-tight">Cloud Kitchen</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <a
              href="/"
              className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-muted"
            >
              <ArrowLeft size={12} />
              Masala
            </a>
            <a
              href="https://instagram.com/sukhdevialchemy"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <InstagramLogo size={17} />
            </a>
            <button
              className="relative flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart size={16} />
              <span className="hidden sm:inline text-xs">Cart</span>
              {cartItemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-700 text-[9px] font-bold text-white">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-5xl px-4 pt-8 pb-6 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 mb-3">
          <Leaf size={11} />
          Fresh · Made to Order · No Preservatives
        </div>
        <h2 className="text-2xl sm:text-4xl font-bold text-emerald-950 leading-tight mb-2">
          Healthy Food,<br className="sm:hidden" /> Delivered Fresh
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto text-sm">
          Customize your order, choose delivery — instant (₹30) or weekly subscription (free, prepay).
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs shadow-sm">
            <Lightning size={13} className="text-amber-500" weight="fill" />
            <span><strong>Instant</strong> — ₹30 · Pincode 560068</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs shadow-sm">
            <CalendarBlank size={13} className="text-emerald-600" weight="fill" />
            <span><strong>Weekly plan</strong> — Free · Pay in advance</span>
          </div>
        </div>
      </section>

      {/* ── Sections ── */}
      <main className="mx-auto max-w-5xl px-4 pb-16 space-y-10">
        {CK_SECTIONS.map((section) => {
          const sectionProducts = allCkProducts.filter((p) => p.tags.includes(section.tagFilter))
          if (sectionProducts.length === 0 && !section.comingSoon) return null
          return (
            <section key={section.id}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold text-emerald-950">{section.label}</h2>
                {section.comingSoon && (
                  <Badge variant="outline" className="text-xs text-muted-foreground border-dashed">
                    Coming soon
                  </Badge>
                )}
              </div>

              {section.comingSoon && sectionProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 py-8 text-center text-sm text-muted-foreground">
                  We're working on {section.label.split(" ").slice(1).join(" ")} items — stay tuned!
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sectionProducts.map((product) => (
                    <CKProductCard
                      key={product.id}
                      product={product}
                      productImages={productImages ?? {}}
                      onOrder={() => setSelectedProduct(product)}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-emerald-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="space-y-0.5 text-center sm:text-left">
            <p className="font-semibold text-foreground">Sukhdevi Alchemy · Cloud Kitchen</p>
            <p>WhatsApp: <a href="https://wa.me/917889480171" className="hover:underline text-emerald-700">+91 78894 80171</a></p>
            <p>Email: <a href="mailto:care@sukhdevialchemy.com" className="hover:underline text-emerald-700">care@sukhdevialchemy.com</a></p>
          </div>
          <div className="flex flex-col items-center sm:items-end gap-2">
            <div className="flex gap-3">
              <a href="https://instagram.com/sukhdevialchemy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors"><InstagramLogo size={19} /></a>
              <a href="https://youtube.com/@sukhdevialchemy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors"><YoutubeLogo size={19} /></a>
            </div>
            <a href="/" className="text-xs hover:underline">← Back to Masala Store</a>
          </div>
        </div>
      </footer>

      {/* ── Product dialog ── */}
      {selectedProduct && (
        <ProductDetailDialog
          product={selectedProduct}
          currentUser={null}
          canReview={false}
          open={Boolean(selectedProduct)}
          onOpenChange={(open) => { if (!open) setSelectedProduct(null) }}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* ── Cart drawer ── */}
      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        cartItems={cartItems ?? []}
        products={products ?? CATALOG_SEED_PRODUCTS}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={() => { setCartOpen(false); setCurrentView("checkout") }}
      />
    </div>
  )
}

// ─── Product card ─────────────────────────────────────────────────────────────

type CKProductCardProps = {
  product: Product
  productImages: Record<string, string>
  onOrder: () => void
}

function CKProductCard({ product, productImages, onOrder }: CKProductCardProps) {
  const imageUrl = getProductImage(product, productImages)
  const price = resolveProductPackPrice(product, getProductPackGrams(product))

  return (
    <div className="group rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="aspect-[4/3] overflow-hidden bg-emerald-50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            No image
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-emerald-950 text-lg">{product.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{product.netQuantityValue}{product.netQuantityUnit} · Fresh made to order</p>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>

        {/* Add-on chips */}
        {Array.isArray(product.addOnOptions) && product.addOnOptions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.addOnOptions.slice(0, 5).map((opt) => (
              <span key={opt} className="rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                {opt}
              </span>
            ))}
            {product.addOnOptions.length > 5 && (
              <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                +{product.addOnOptions.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* Price + actions */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-2xl font-bold text-emerald-900">₹{price}</span>
            <span className="text-xs text-muted-foreground ml-1">/ serving</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onOrder}>
              Customize
            </Button>
            <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white" onClick={onOrder}>
              <ShoppingCart size={14} className="mr-1" />
              Order
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
