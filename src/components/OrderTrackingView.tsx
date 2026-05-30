import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Package, Truck, CheckCircle } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import type { Order } from "@/lib/types"

type OrderTrackingViewProps = {
  order: Order | null
  orders: Order[]
  onBack: () => void
  onSelectOrder: (orderId: string) => void
}

const statusSteps = [
  { key: "pending", label: "Order Placed", icon: Package },
  { key: "processing", label: "Processing", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle }
]

export function OrderTrackingView({ order, orders, onBack, onSelectOrder }: OrderTrackingViewProps) {
  const [trackingId, setTrackingId] = useState("")
  
  const handleTrack = () => {
    if (!trackingId.trim()) return
    onSelectOrder(trackingId)
  }
  
  const getStatusIndex = (status: string) => {
    return statusSteps.findIndex(s => s.key === status)
  }
  
  const currentStatusIndex = order ? getStatusIndex(order.status) : -1
  const progressPercentage = order ? ((currentStatusIndex + 1) / statusSteps.length) * 100 : 0
  
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={20} className="mr-2" />
            Back to Store
          </Button>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Track Your Order</h1>
        
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="tracking-id">Order ID</Label>
                <Input
                  id="tracking-id"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  placeholder="Enter your order ID"
                  onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                />
              </div>
              <Button onClick={handleTrack} className="mt-6">
                Track Order
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {order && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Order #{order.id}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div>
                <div className="mb-6">
                  <Progress value={progressPercentage} className="h-2" />
                </div>
                
                <div className="grid grid-cols-4 gap-4">
                  {statusSteps.map((step, index) => {
                    const Icon = step.icon
                    const isActive = index <= currentStatusIndex
                    const isCurrent = index === currentStatusIndex
                    
                    return (
                      <div key={step.key} className="flex flex-col items-center text-center">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors",
                            isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                            isCurrent && "ring-2 ring-primary ring-offset-2"
                          )}
                        >
                          <Icon size={24} weight={isActive ? "fill" : "regular"} />
                        </div>
                        <p className={cn(
                          "text-xs font-medium",
                          isActive ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {step.label}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-semibold mb-4">Order Items</h3>
                <div className="space-y-3">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.grams}g × {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold">
                        ₹{(item.pricePerUnit * (item.grams / 100) * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              
              <Separator />
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Delivery Address</h3>
                  <p className="text-sm text-muted-foreground">
                    {order.customer.name}<br />
                    {order.customer.address}<br />
                    {order.customer.city}, {order.customer.pincode}<br />
                    {order.customer.phone}
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Order Summary</h3>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>₹{order.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery:</span>
                      <span className="text-green-600">Free</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between font-bold text-base">
                      <span>Total:</span>
                      <span className="text-primary">₹{order.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {!order && orders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orders.slice(-5).reverse().map((o) => (
                  <button
                    key={o.id}
                    onClick={() => onSelectOrder(o.id)}
                    className="w-full text-left p-4 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">#{o.id}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">₹{o.totalAmount.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground capitalize">{o.status}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
