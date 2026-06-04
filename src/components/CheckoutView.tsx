import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft } from "@phosphor-icons/react"
import type { CartItem, Product, Order, UserProfile } from "@/lib/types"
import { toast } from "sonner"
import {
  calculateCartItemTotal,
  calculateCartSubtotal,
  calculateShippingAmountByPincode,
  getProductPackLabel,
  getShippingZoneLabel,
} from "@/lib/pricing"
import { calculatePromoDiscountAmount, consumePromoCodeUsage, fetchPromoCodeChannelState, type PromoCode, validatePromoCode } from "@/lib/promo-codes"
import type { RuntimeMode } from "@/lib/runtime-mode"

type CheckoutViewProps = {
  cartItems: CartItem[]
  products: Product[]
  accountProfile?: UserProfile | null
  runtimeMode?: RuntimeMode
  onBack: () => void
  onOrderComplete: (order: Order) => void | Promise<void>
}

export function CheckoutView({ cartItems, products, accountProfile, runtimeMode = "prod", onBack, onOrderComplete }: CheckoutViewProps) {
  const isPromoUiEnabled = import.meta.env.VITE_ENABLE_CHECKOUT_PROMO === "true"
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    pincode: ""
  })
  const [promoInput, setPromoInput] = useState("")
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null)
  const [isApplyingPromo, setIsApplyingPromo] = useState(false)
  const [promoEnabledInMode, setPromoEnabledInMode] = useState(runtimeMode === "prod")

  useEffect(() => {
    let isActive = true

    async function loadPromoChannelState() {
      const result = await fetchPromoCodeChannelState()
      if (!isActive) {
        return
      }

      setPromoEnabledInMode(runtimeMode === "dev" ? result.state.devEnabled : result.state.prodEnabled)
    }

    void loadPromoChannelState()
    return () => {
      isActive = false
    }
  }, [runtimeMode])

  useEffect(() => {
    if (!accountProfile) {
      return
    }

    setFormData((current) => ({
      ...current,
      name: current.name || accountProfile.fullName,
      email: current.email || accountProfile.email,
      phone: current.phone || accountProfile.phone,
    }))
  }, [accountProfile])
  
  const getProduct = (productId: string) => products.find(p => p.id === productId)
  const cartSubtotal = calculateCartSubtotal(cartItems, products)
  const shippingAmount = calculateShippingAmountByPincode(formData.pincode, cartSubtotal)
  const promoDiscountAmount = isPromoUiEnabled && appliedPromo
    ? calculatePromoDiscountAmount(appliedPromo, cartSubtotal, shippingAmount)
    : 0
  const cartTotal = Math.max(0, cartSubtotal + shippingAmount - promoDiscountAmount)

  const handleApplyPromo = async () => {
    if (!isPromoUiEnabled) {
      toast.info("Promo codes are currently disabled.")
      return
    }

    if (!promoInput.trim()) {
      toast.error("Please enter a promo code.")
      return
    }

    setIsApplyingPromo(true)
    const result = await validatePromoCode(promoInput, cartSubtotal, shippingAmount, runtimeMode, {
      email: accountProfile?.email,
      phone: accountProfile?.phone,
    })
    setIsApplyingPromo(false)

    if (!result.promo || result.error) {
      toast.error(result.error ?? "Invalid promo code.")
      return
    }

    setAppliedPromo(result.promo)
    setPromoInput(result.promo.code)
    toast.success(`Promo code ${result.promo.code} applied.`)
  }

  const handleRemovePromo = () => {
    setAppliedPromo(null)
    setPromoInput("")
    toast.info("Promo code removed.")
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.email || !formData.phone || !formData.address || !formData.city || !formData.pincode) {
      toast.error("Please fill in all fields")
      return
    }

    if (isPromoUiEnabled && appliedPromo?.code) {
      const consumeResult = await consumePromoCodeUsage(appliedPromo.code, {
        email: accountProfile?.email,
        phone: accountProfile?.phone,
      })
      if (!consumeResult.success) {
        setAppliedPromo(null)
        toast.error(consumeResult.error ?? "Promo code has already been used. Please request a new one.")
        return
      }
    }
    
    const order: Order = {
      id: `ORD-${Date.now()}`,
      items: cartItems.map(item => {
        const product = getProduct(item.productId)!
        return {
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          grams: item.grams,
          pricePerUnit: product.price
        }
      }),
      customer: formData,
      subtotalAmount: cartSubtotal,
      shippingAmount,
      discountAmount: promoDiscountAmount,
      promoCode: appliedPromo?.code,
      totalAmount: cartTotal,
      status: "pending",
      paymentStatus: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    await onOrderComplete(order)
    toast.success("Order placed successfully!")
  }
  
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={20} className="mr-2" />
            Back
          </Button>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>
        
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Information</CardTitle>
              </CardHeader>
              <CardContent>
                {accountProfile && (
                  <div className="mb-6 rounded-lg border bg-muted/40 p-4 text-sm">
                    <p className="font-medium">Signed in as {accountProfile.fullName}</p>
                    <p className="text-muted-foreground">
                      This account will be used for order updates, tracking access, and review follow-ups.
                    </p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="address">Delivery Address *</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData(f => ({ ...f, address: e.target.value }))}
                      placeholder="House no., Street, Landmark"
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData(f => ({ ...f, city: e.target.value }))}
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pincode">Pincode *</Label>
                      <Input
                        id="pincode"
                        value={formData.pincode}
                        onChange={(e) => setFormData(f => ({ ...f, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                        placeholder="000000"
                        inputMode="numeric"
                        maxLength={6}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                    Shipping policy: Karnataka pincodes are charged ₹60. Rest of India is charged ₹120.
                  </div>
                  
                  <Button type="submit" className="w-full mt-6" size="lg">
                    Place Order
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item) => {
                  const product = getProduct(item.productId)
                  if (!product) return null
                  
                  return (
                    <div key={`${item.productId}-${item.grams}`} className="flex justify-between items-start text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {getProductPackLabel(product)} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold">₹{calculateCartItemTotal(item, product).toFixed(2)}</p>
                    </div>
                  )
                })}
                
                <Separator />

                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₹{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Shipping across India</span>
                  <span>{shippingAmount === 0 ? "Free" : `₹${shippingAmount.toFixed(2)}`}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Shipping zone: {formData.pincode.length >= 2 ? getShippingZoneLabel(formData.pincode) : "Enter pincode to confirm zone"}
                </p>

                {isPromoUiEnabled ? (
                  <div className="space-y-2 rounded-lg border border-dashed p-3">
                    <Label htmlFor="promo-code" className="text-xs uppercase tracking-wide text-muted-foreground">Promo Code</Label>
                    <div className="flex gap-2">
                      <Input
                        id="promo-code"
                        value={promoInput}
                        onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                        placeholder="SDAJUNE26"
                        className="h-9"
                        disabled={!promoEnabledInMode}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9"
                        onClick={handleApplyPromo}
                        disabled={isApplyingPromo || !promoEnabledInMode}
                      >
                        {isApplyingPromo ? "Applying..." : "Apply"}
                      </Button>
                    </div>
                    {promoEnabledInMode ? (
                      <p className="text-xs text-muted-foreground">
                        Example promo code: SDAJUNE26
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700">
                        Promo codes are disabled in {runtimeMode === "dev" ? "dev" : "prod"} mode.
                      </p>
                    )}
                    {appliedPromo && (
                      <div className="flex items-center justify-between text-xs text-green-700">
                        <span>{appliedPromo.code} applied ({appliedPromo.discountScope} discount)</span>
                        <button type="button" className="underline" onClick={handleRemovePromo}>Remove {appliedPromo.code}</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    Promo code entry is currently disabled.
                  </div>
                )}

                {promoDiscountAmount > 0 && (
                  <div className="flex justify-between items-center text-sm text-green-700">
                    <span>Promo Discount{appliedPromo?.code ? ` (${appliedPromo.code})` : ""}</span>
                    <span>-₹{promoDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-primary">₹{cartTotal.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
