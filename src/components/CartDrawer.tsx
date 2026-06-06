import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { X, Minus, Plus, ShoppingCart } from "@phosphor-icons/react"
import type { CartItem, Product } from "@/lib/types"
import { useKV } from "@/hooks/use-kv"
import { getProductImage } from "@/lib/product-images"
import { calculateCartItemTotal, calculateCartSubtotal, getProductPackLabel } from "@/lib/pricing"

type CartDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cartItems: CartItem[]
  products: Product[]
  onUpdateQuantity: (productId: string, grams: number, quantity: number) => void
  onRemoveItem: (productId: string, grams: number) => void
  onCheckout: () => void
}

export function CartDrawer({ 
  open, 
  onOpenChange, 
  cartItems, 
  products,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout
}: CartDrawerProps) {
  const [productImages] = useKV<Record<string, string>>("product-images", {})

  const getProduct = (productId: string) => products.find(p => p.id === productId)
  
  const cartSubtotal = calculateCartSubtotal(cartItems, products)
  const cartTotal = cartSubtotal
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 px-6 pt-6">
            <ShoppingCart size={24} />
            Shopping Cart ({cartItems.length})
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingCart size={64} className="text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Your cart is empty</p>
              <Button variant="link" onClick={() => onOpenChange(false)} className="mt-2">
                Continue Shopping
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {cartItems.map((item) => {
                const product = getProduct(item.productId)
                if (!product) return null
                const imageUrl = getProductImage(product, productImages ?? {})
                
                return (
                  <div key={`${item.productId}-${item.grams}`} className="flex gap-4 p-4 border rounded-lg">
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
                          onClick={() => onRemoveItem(item.productId, item.grams)}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                      
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-muted-foreground">{getProductPackLabel(product)}</p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => onUpdateQuantity(item.productId, item.grams, Math.max(1, item.quantity - 1))}
                            >
                              <Minus size={12} />
                            </Button>
                            <span className="text-sm w-8 text-center">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => onUpdateQuantity(item.productId, item.grams, item.quantity + 1)}
                            >
                              <Plus size={12} />
                            </Button>
                          </div>
                          <span className="font-bold text-primary">₹{calculateCartItemTotal(item, product).toFixed(2)}</span>
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
