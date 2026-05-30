import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { X, Minus, Plus, ShoppingCart } from "@phosphor-icons/react"
import type { CartItem, Product } from "@/lib/types"
import { GRAM_OPTIONS } from "@/lib/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useKV } from "@github/spark/hooks"
import { getProductImage } from "@/lib/product-images"

type CartDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cartItems: CartItem[]
  products: Product[]
  onUpdateQuantity: (productId: string, quantity: number) => void
  onUpdateGrams: (productId: string, grams: number) => void
  onRemoveItem: (productId: string) => void
  onCheckout: () => void
}

export function CartDrawer({ 
  open, 
  onOpenChange, 
  cartItems, 
  products,
  onUpdateQuantity,
  onUpdateGrams,
  onRemoveItem,
  onCheckout
}: CartDrawerProps) {
  const [productImages] = useKV<Record<string, string>>("product-images", {})

  const getProduct = (productId: string) => products.find(p => p.id === productId)
  
  const calculateItemTotal = (item: CartItem) => {
    const product = getProduct(item.productId)
    if (!product) return 0
    const gramsMultiplier = item.grams / 100
    return product.price * gramsMultiplier * item.quantity
  }
  
  const cartTotal = cartItems.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart size={24} />
            Shopping Cart ({cartItems.length})
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto py-4">
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
                  <div key={item.productId} className="flex gap-4 p-4 border rounded-lg">
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
                          onClick={() => onRemoveItem(item.productId)}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                      
                      <div className="mt-2 space-y-2">
                        <Select
                          value={item.grams.toString()}
                          onValueChange={(value) => onUpdateGrams(item.productId, parseInt(value))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GRAM_OPTIONS.map((g) => (
                              <SelectItem key={g} value={g.toString()}>
                                {g}g
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => onUpdateQuantity(item.productId, Math.max(1, item.quantity - 1))}
                            >
                              <Minus size={12} />
                            </Button>
                            <span className="text-sm w-8 text-center">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                            >
                              <Plus size={12} />
                            </Button>
                          </div>
                          <span className="font-bold text-primary">₹{calculateItemTotal(item).toFixed(2)}</span>
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
            <div className="py-4 space-y-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total:</span>
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
