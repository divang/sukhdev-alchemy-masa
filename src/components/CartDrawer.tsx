import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { X, Minus, Plus, ShoppingCart } from "@phosphor-icons/react"
import type { CartItem, Product } from "@/lib/types"
import { useKV } from "@/hooks/use-kv"
import { useIsMobile } from "@/hooks/use-mobile"
import { getProductImage } from "@/lib/product-images"
import { calculateCartItemTotal, calculateCartItemUnitPrice, calculateCartSubtotal, getCartItemPackLabel, parseCartItemAddOns } from "@/lib/pricing"

// Parse selectedAddOns into structured display sections
function CartAddOnsMeta({ addOns }: { addOns: string[] }) {
  if (!addOns.length) return null
  const delivery = addOns.find((a) => a.startsWith("Delivery:"))
  const base = addOns.find((a) => a.startsWith("Base:"))
  const ingredients = addOns.filter((a) => !a.startsWith("Delivery:") && !a.startsWith("Base:"))

  return (
    <div className="mt-1 space-y-1">
      {base && (
        <p className="text-[11px] text-muted-foreground">
          Base: <span className="font-medium">{base.replace("Base: ", "")}</span>
          {ingredients.length > 0 && ` · ${ingredients.join(", ")}`}
        </p>
      )}
      {!base && ingredients.length > 0 && (
        <p className="text-[11px] text-muted-foreground">Add-ons: {ingredients.join(", ")}</p>
      )}
      {delivery && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1">
          <p className="text-[11px] font-medium text-emerald-800">📅 Weekly subscription</p>
          {(() => {
            const body = delivery.replace("Delivery: ", "")
            const [days, ...slots] = body.split(" | ")
            return (
              <p className="text-[11px] text-emerald-700">
                {days} · {slots.join(" & ")}
              </p>
            )
          })()}
        </div>
      )}
    </div>
  )
}

function CartItemPrice({ item, product }: { item: CartItem; product: Product }) {
  const { subDays, subSlots } = parseCartItemAddOns(item.selectedAddOns ?? [])
  const isSubscription = subDays > 0 && subSlots > 0
  const total = calculateCartItemTotal(item, product)
  return (
    <span className="font-bold text-primary">
      ₹{isSubscription ? `${total.toFixed(0)}/wk` : total.toFixed(2)}
    </span>
  )
}

type CartDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cartItems: CartItem[]
  products: Product[]
  isSyncing?: boolean
  onUpdateQuantity: (productId: string, grams: number, quantity: number, selectedAddOns?: string[]) => void
  onRemoveItem: (productId: string, grams: number, selectedAddOns?: string[]) => void
  onCheckout: () => void
}

export function CartDrawer({ 
  open, 
  onOpenChange, 
  cartItems, 
  products,
  isSyncing = false,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout
}: CartDrawerProps) {
  const [productImages] = useKV<Record<string, string>>("product-images", {})
  const isMobile = useIsMobile()

  const getProduct = (productId: string) => products.find(p => p.id === productId)

  // Safety: if all cartItems reference missing products (stale cache), treat as empty
  const hasAnyRenderable = cartItems.length === 0 || cartItems.some(item => Boolean(getProduct(item.productId)))
  const effectiveItems = hasAnyRenderable ? cartItems : []

  const cartSubtotal = calculateCartSubtotal(effectiveItems, products)
  const cartTotal = cartSubtotal

  if (isMobile) {
    if (!open) {
      return null
    }

    return (
      <div className="fixed inset-0 z-50 sm:hidden">
        <button
          type="button"
          className="absolute inset-0 bg-black/45"
          aria-label="Close cart"
          onClick={() => onOpenChange(false)}
        />
        <div className="absolute inset-y-0 right-0 flex w-[92vw] max-w-sm flex-col bg-background shadow-xl">
          <div className="flex items-start justify-between border-b px-4 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <ShoppingCart size={20} />
                Shopping Cart ({cartItems.length})
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">Review your saved items and continue to checkout when ready.</p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onOpenChange(false)}>
              <X size={14} />
            </Button>
          </div>

          {isSyncing && (
            <div className="flex items-center gap-2 border-b bg-blue-50 px-4 py-1.5 text-xs text-blue-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
              Syncing your cart...
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {effectiveItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <ShoppingCart size={56} className="mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Your cart is empty</p>
                <Button variant="link" onClick={() => onOpenChange(false)} className="mt-2">
                  Continue Shopping
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {effectiveItems.map((item) => {
                  const product = getProduct(item.productId)
                  if (!product) return null
                  const imageUrl = getProductImage(product, productImages ?? {})

                  return (
                    <div key={`${item.productId}-${item.grams}-${(item.selectedAddOns ?? []).join("|")}`} className="flex gap-3 rounded-lg border p-3">
                      <div
                        className="h-16 w-16 flex-shrink-0 rounded-md bg-cover bg-center"
                        style={{ backgroundImage: `url(${imageUrl})` }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between">
                          <h4 className="line-clamp-2 text-sm font-semibold">{product.name}</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-mt-1 h-6 w-6 p-0"
                            onClick={() => onRemoveItem(item.productId, item.grams, item.selectedAddOns ?? [])}
                          >
                            <X size={14} />
                          </Button>
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">{getCartItemPackLabel(product, item.grams)}</p>
                        <CartAddOnsMeta addOns={item.selectedAddOns ?? []} />
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => onUpdateQuantity(item.productId, item.grams, Math.max(1, item.quantity - 1), item.selectedAddOns ?? [])}
                            >
                              <Minus size={12} />
                            </Button>
                            <span className="w-8 text-center text-sm">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => onUpdateQuantity(item.productId, item.grams, item.quantity + 1, item.selectedAddOns ?? [])}
                            >
                              <Plus size={12} />
                            </Button>
                          </div>
                          <CartItemPrice item={item} product={product} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {cartItems.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₹{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Shipping</span>
                  <span>Calculated at checkout by pincode</span>
                </div>
                <div className="flex items-center justify-between text-base font-bold">
                  <span>Estimated Total:</span>
                  <span className="text-primary">₹{cartTotal.toFixed(2)}</span>
                </div>
                <Button className="w-full" size="lg" onClick={onCheckout}>
                  Proceed to Checkout
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 px-6 pt-6">
            <ShoppingCart size={24} />
            Shopping Cart ({cartItems.length})
          </SheetTitle>
          <SheetDescription className="px-6 pb-2">
            Review your saved items and continue to checkout when ready.
          </SheetDescription>
        </SheetHeader>
        
        {isSyncing && (
          <div className="flex items-center gap-2 border-b bg-blue-50 px-6 py-1.5 text-xs text-blue-600">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
            Syncing your cart…
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {effectiveItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingCart size={64} className="text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Your cart is empty</p>
              <Button variant="link" onClick={() => onOpenChange(false)} className="mt-2">
                Continue Shopping
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {effectiveItems.map((item) => {
                const product = getProduct(item.productId)
                if (!product) return null
                const imageUrl = getProductImage(product, productImages ?? {})
                
                return (
                  <div key={`${item.productId}-${item.grams}-${(item.selectedAddOns ?? []).join("|")}`} className="flex gap-4 p-4 border rounded-lg">
                    <div 
                      className="w-20 h-20 rounded-md bg-cover bg-center flex-shrink-0"
                      style={{ backgroundImage: `url(${imageUrl})` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-sm line-clamp-2">{product.name}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 -mt-1"
                          onClick={() => onRemoveItem(item.productId, item.grams, item.selectedAddOns ?? [])}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                      
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-muted-foreground">{getCartItemPackLabel(product, item.grams)}</p>
                        <CartAddOnsMeta addOns={item.selectedAddOns ?? []} />
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => onUpdateQuantity(item.productId, item.grams, Math.max(1, item.quantity - 1), item.selectedAddOns ?? [])}
                            >
                              <Minus size={12} />
                            </Button>
                            <span className="text-sm w-8 text-center">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => onUpdateQuantity(item.productId, item.grams, item.quantity + 1, item.selectedAddOns ?? [])}
                            >
                              <Plus size={12} />
                            </Button>
                          </div>
                          <CartItemPrice item={item} product={product} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
        {cartItems.length > 0 && (
          <>
            <Separator />
            <div className="space-y-4 px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Shipping</span>
                <span>Calculated at checkout by pincode</span>
              </div>
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Estimated Total:</span>
                <span className="text-primary">₹{cartTotal.toFixed(2)}</span>
              </div>
              <Button 
                className="w-full" 
                size="lg"
                onClick={onCheckout}
              >
                Proceed to Checkout
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
