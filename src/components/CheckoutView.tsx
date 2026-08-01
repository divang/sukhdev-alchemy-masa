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
  calculateCloudKitchenShippingAmount,
  calculateCartItemTotal,
  calculateCartSubtotal,
  getCartItemPackLabel,
  calculateShippingAmountByPincode,
  getShippingZoneLabel,
  isCloudKitchenInstantServiceablePincode,
  isCloudKitchenProduct,
  resolveProductPackPrice,
} from "@/lib/pricing"
import { calculatePromoDiscountAmount, fetchPromoCodeChannelState, type PromoCode, validatePromoCode } from "@/lib/promo-codes"
import type { RuntimeMode } from "@/lib/runtime-mode"
import { validateIndianShippingAddress } from "@/lib/validation"

type CheckoutViewProps = {
  cartItems: CartItem[]
  products: Product[]
  accountProfile?: UserProfile | null
  runtimeMode?: RuntimeMode
  onBack: () => void
  onOrderComplete: (order: Order) => void | Promise<void>
}

export function CheckoutView({ cartItems, products, accountProfile, runtimeMode = "prod", onBack, onOrderComplete }: CheckoutViewProps) {
  const subscriptionWeekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const morningSlots = ["7 AM", "8 AM", "9 AM", "10 AM"]
  const eveningSlots = ["5 PM", "6 PM", "7 PM", "8 PM", "9 PM"]

  const isPromoUiEnabled = import.meta.env.VITE_ENABLE_CHECKOUT_PROMO !== "false"
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    pincode: "",
    country: "India"
  })
  const [promoInput, setPromoInput] = useState("")
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null)
  const [isApplyingPromo, setIsApplyingPromo] = useState(false)
  const [promoEnabledInMode, setPromoEnabledInMode] = useState(runtimeMode === "prod")
  const [cloudKitchenDeliveryMode, setCloudKitchenDeliveryMode] = useState<"instant" | "subscription">("instant")
  const [subscriptionDays, setSubscriptionDays] = useState<string[]>([])
  const [subscriptionSlot, setSubscriptionSlot] = useState("")

  // Pre-fill subscription config from dialog-encoded add-on (format: "Delivery: Mon,Wed | Morning 8 AM")
  useEffect(() => {
    const deliveryNote = cartItems
      .flatMap((item) => item.selectedAddOns ?? [])
      .find((a) => a.startsWith("Delivery: "))
    if (!deliveryNote) return
    const body = deliveryNote.replace("Delivery: ", "")
    const [daysStr, slotStr] = body.split(" | ")
    if (!daysStr || !slotStr) return
    const days = daysStr.split(",").map((d) => d.trim()).filter(Boolean)
    if (days.length > 0) {
      setCloudKitchenDeliveryMode("subscription")
      setSubscriptionDays(days)
      setSubscriptionSlot(slotStr.trim())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const hasCloudKitchenItems = cartItems.some((item) => {
    const product = getProduct(item.productId)
    return Boolean(product && isCloudKitchenProduct(product))
  })
  const cartSubtotal = calculateCartSubtotal(cartItems, products)
  const shippingAmount = hasCloudKitchenItems
    ? calculateCloudKitchenShippingAmount(cloudKitchenDeliveryMode)
    : calculateShippingAmountByPincode(formData.pincode, cartSubtotal)
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
      email: formData.email || accountProfile?.email,
      phone: formData.phone || accountProfile?.phone,
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

  const toggleSubscriptionDay = (day: string) => {
    setSubscriptionDays((current) => (
      current.includes(day)
        ? current.filter((entry) => entry !== day)
        : [...current, day]
    ))
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.email || !formData.phone || !formData.address || !formData.city || !formData.pincode || !formData.country) {
      toast.error("Please fill in all fields")
      return
    }

    const shippingValidationError = validateIndianShippingAddress({
      address: formData.address,
      city: formData.city,
      pincode: formData.pincode,
      country: formData.country,
    })
    if (shippingValidationError) {
      toast.error(shippingValidationError)
      return
    }

    if (hasCloudKitchenItems) {
      if (cloudKitchenDeliveryMode === "instant" && !isCloudKitchenInstantServiceablePincode(formData.pincode)) {
        toast.error("Instant delivery is currently available only for pincode 560068.")
        return
      }

      if (cloudKitchenDeliveryMode === "subscription") {
        if (subscriptionDays.length === 0) {
          toast.error("Select at least one weekday for subscription delivery.")
          return
        }

        if (!subscriptionSlot) {
          toast.error("Select one morning or evening slot for subscription delivery.")
          return
        }
      }
    }

    const deliveryTimeSlot = hasCloudKitchenItems
      ? cloudKitchenDeliveryMode === "subscription"
        ? subscriptionSlot
        : "Instant delivery (within 5 km)"
      : undefined

    const order: Order = {
      id: `ORD-${Date.now()}`,
      items: cartItems.map(item => {
        const product = getProduct(item.productId)!
        const addOnSummary = (item.selectedAddOns ?? []).join(", ")
        const productLabel = addOnSummary ? `${product.name} [Add-ons: ${addOnSummary}]` : product.name
        return {
          productId: item.productId,
          productName: productLabel,
          quantity: item.quantity,
          grams: item.grams,
          pricePerUnit: resolveProductPackPrice(product, item.grams),
          selectedAddOns: item.selectedAddOns,
        }
      }),
      customer: {
        ...formData,
        deliveryMode: hasCloudKitchenItems ? cloudKitchenDeliveryMode : "standard",
        deliveryWeekdays: hasCloudKitchenItems && cloudKitchenDeliveryMode === "subscription" ? subscriptionDays : undefined,
        deliveryTimeSlot,
      },
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
                      placeholder="House/Flat no., Street, Locality"
                      rows={3}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Include house/flat number and street/locality.</p>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData(f => ({ ...f, city: e.target.value.replace(/[^A-Za-z\s.'-]/g, "") }))}
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
                    <div>
                      <Label htmlFor="country">Country *</Label>
                      <Input
                        id="country"
                        value={formData.country}
                        readOnly
                        autoComplete="country-name"
                        className="bg-muted"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">We currently deliver only within India.</p>
                    </div>
                  </div>

                  {hasCloudKitchenItems && (
                    <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                      <div>
                        <p className="text-sm font-semibold text-emerald-900">Cloud Kitchen Delivery</p>
                        <p className="text-xs text-emerald-800">Choose instant delivery or a weekly subscription plan.</p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setCloudKitchenDeliveryMode("instant")}
                          className={`rounded-md border px-3 py-2 text-left text-sm ${cloudKitchenDeliveryMode === "instant" ? "border-emerald-700 bg-white text-emerald-900" : "border-emerald-200 bg-white/70 text-emerald-800"}`}
                        >
                          <p className="font-medium">Instant Delivery</p>
                          <p className="text-xs">Within 5 km, pincode 560068, charge ₹30</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCloudKitchenDeliveryMode("subscription")}
                          className={`rounded-md border px-3 py-2 text-left text-sm ${cloudKitchenDeliveryMode === "subscription" ? "border-emerald-700 bg-white text-emerald-900" : "border-emerald-200 bg-white/70 text-emerald-800"}`}
                        >
                          <p className="font-medium">Weekly Subscription</p>
                          <p className="text-xs">Pay weekly in advance, delivery free</p>
                        </button>
                      </div>

                      {cloudKitchenDeliveryMode === "subscription" && (
                        <div className="space-y-3 rounded-md border border-emerald-200 bg-white p-3">
                          <div>
                            <p className="text-xs font-medium text-emerald-900">Weekdays</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {subscriptionWeekdays.map((day) => (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => toggleSubscriptionDay(day)}
                                  className={`rounded-full border px-3 py-1 text-xs ${subscriptionDays.includes(day) ? "border-emerald-700 bg-emerald-100 text-emerald-900" : "border-emerald-200 text-emerald-700"}`}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="subscription-slot">Time Slot</Label>
                            <select
                              id="subscription-slot"
                              value={subscriptionSlot}
                              onChange={(event) => setSubscriptionSlot(event.target.value)}
                              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value="">Select delivery slot</option>
                              <optgroup label="Morning">
                                {morningSlots.map((slot) => (
                                  <option key={`morning-${slot}`} value={`Morning ${slot}`}>
                                    Morning {slot}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Evening">
                                {eveningSlots.map((slot) => (
                                  <option key={`evening-${slot}`} value={`Evening ${slot}`}>
                                    Evening {slot}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                    {hasCloudKitchenItems
                      ? "Cloud Kitchen policy: Instant delivery is available only for pincode 560068 at ₹30. Weekly subscription delivery is free."
                      : "Shipping policy: Karnataka pincodes are charged ₹60. Rest of India is charged ₹120."}
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
                    <div key={`${item.productId}-${item.grams}-${(item.selectedAddOns ?? []).join("|")}`} className="flex justify-between items-start text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {getCartItemPackLabel(product, item.grams)} × {item.quantity}
                        </p>
                        {(item.selectedAddOns ?? []).length > 0 && (
                          <p className="text-[11px] text-muted-foreground">Add-ons: {(item.selectedAddOns ?? []).join(", ")}</p>
                        )}
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
                  <span>{hasCloudKitchenItems ? "Delivery" : "Shipping across India"}</span>
                  <span>{shippingAmount === 0 ? "Free" : `₹${shippingAmount.toFixed(2)}`}</span>
                </div>
                {hasCloudKitchenItems ? (
                  <p className="text-xs text-muted-foreground">
                    {cloudKitchenDeliveryMode === "instant"
                      ? "Instant mode: available only in pincode 560068 (within 5 km radius)."
                      : `Subscription mode: ${subscriptionDays.length > 0 ? subscriptionDays.join(", ") : "Select weekdays"}${subscriptionSlot ? ` • ${subscriptionSlot}` : ""}`}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Shipping zone: {formData.pincode.length >= 2 ? getShippingZoneLabel(formData.pincode) : "Enter pincode to confirm zone"}
                  </p>
                )}

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
                    <p className="text-xs text-muted-foreground">Only one promo code can be applied per order.</p>
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
