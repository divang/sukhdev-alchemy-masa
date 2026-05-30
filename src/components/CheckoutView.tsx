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

type CheckoutViewProps = {
  cartItems: CartItem[]
  products: Product[]
  accountProfile?: UserProfile | null
  onBack: () => void
  onOrderComplete: (order: Order) => void | Promise<void>
}

export function CheckoutView({ cartItems, products, accountProfile, onBack, onOrderComplete }: CheckoutViewProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    pincode: ""
  })

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
  
  const calculateItemTotal = (item: CartItem) => {
    const product = getProduct(item.productId)
    if (!product) return 0
    const gramsMultiplier = item.grams / 100
    return product.price * gramsMultiplier * item.quantity
  }
  
  const cartTotal = cartItems.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.email || !formData.phone || !formData.address || !formData.city || !formData.pincode) {
      toast.error("Please fill in all fields")
      return
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
                        onChange={(e) => setFormData(f => ({ ...f, pincode: e.target.value }))}
                        placeholder="000000"
                      />
                    </div>
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
                    <div key={item.productId} className="flex justify-between items-start text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {item.grams}g × {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold">₹{calculateItemTotal(item).toFixed(2)}</p>
                    </div>
                  )
                })}
                
                <Separator />
                
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
