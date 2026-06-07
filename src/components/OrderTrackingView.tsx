import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Package, Truck, CheckCircle, Link as LinkIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import type { Order } from "@/lib/types"
import { fetchLatestShipmentForOrder, type LatestOrderShipment } from "@/lib/order-shipments"

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
  const [shipment, setShipment] = useState<LatestOrderShipment | null>(null)
  const [isLoadingShipment, setIsLoadingShipment] = useState(false)
  const [shipmentError, setShipmentError] = useState<string | null>(null)
  const recentOrders = orders.slice(0, 5)

  const handlePrintReceipt = () => {
    if (typeof window !== "undefined") {
      window.print()
    }
  }

  const formatAmount = (amount?: number) => `₹${(amount ?? 0).toFixed(2)}`

  useEffect(() => {
    let isActive = true

    async function loadShipment() {
      if (!order?.id) {
        setShipment(null)
        setShipmentError(null)
        return
      }

      setIsLoadingShipment(true)
      setShipmentError(null)

      const result = await fetchLatestShipmentForOrder(order.id)
      if (!isActive) {
        return
      }

      setIsLoadingShipment(false)

      if (result.error) {
        setShipment(null)
        setShipmentError(result.error)
        return
      }

      setShipment(result.shipment ?? null)
    }

    void loadShipment()

    return () => {
      isActive = false
    }
  }, [order?.id])
  
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
      <header className="border-b bg-card sticky top-0 z-10 no-print">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={20} className="mr-2" />
            Back to Store
          </Button>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Track Your Order</h1>

        {recentOrders.length > 0 && (
          <Card className="mb-8 no-print">
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentOrders.map((item) => {
                  const isSelected = item.id === order?.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectOrder(item.id)}
                      className={cn(
                        "w-full text-left p-4 border rounded-lg transition-colors",
                        isSelected ? "border-primary bg-primary/5" : "hover:bg-muted"
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-semibold break-all">Order ID: {item.id}</p>
                          <p className="text-sm text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-primary">₹{item.totalAmount.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground capitalize">{item.status}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
        
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
          <Card className="print-receipt-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Order #{order.id}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="print-page-break-avoid">
                <div className="mb-6">
                  <Progress value={progressPercentage} className="h-2" />
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
                  {statusSteps.map((step, index) => {
                    const Icon = step.icon
                    const isActive = index <= currentStatusIndex
                    const isCurrent = index === currentStatusIndex
                    
                    return (
                      <div key={step.key} className="flex flex-col items-center text-center">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors print:w-10 print:h-10 print:mb-1",
                            isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                            isCurrent && "ring-2 ring-primary ring-offset-2"
                          )}
                        >
                          <Icon size={20} weight={isActive ? "fill" : "regular"} />
                        </div>
                        <p className={cn(
                          "text-xs font-medium leading-tight print:text-[10px]",
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
                        {formatAmount(item.pricePerUnit * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              
              <Separator />

              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <h3 className="font-semibold">Shipment Tracking</h3>
                  {shipment?.trackingUrl && (
                    <Button asChild variant="outline" size="sm">
                      <a href={shipment.trackingUrl} target="_blank" rel="noreferrer">
                        <LinkIcon size={16} className="mr-2" />
                        Open Carrier Tracking
                      </a>
                    </Button>
                  )}
                </div>

                <div className="rounded-lg border p-4 space-y-3 text-sm">
                  {isLoadingShipment && (
                    <p className="text-muted-foreground">Loading shipment details...</p>
                  )}

                  {!isLoadingShipment && !shipment && !shipmentError && (
                    <p className="text-muted-foreground">
                      Shipment has not been created yet. It will appear here after Razorpay payment verification and Shiprocket order booking.
                    </p>
                  )}

                  {shipmentError && (
                    <p className="text-red-700">Unable to load shipment details: {shipmentError}</p>
                  )}

                  {shipment && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-4">
                        <span className="text-muted-foreground">Courier Provider</span>
                        <span className="font-medium capitalize">{shipment.providerKey}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-4">
                        <span className="text-muted-foreground">Shipment Status</span>
                        <span className="font-medium capitalize">{shipment.shipmentStatus}</span>
                      </div>
                      {shipment.awbCode && (
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4">
                          <span className="text-muted-foreground">AWB</span>
                          <span className="font-mono text-[11px] sm:text-sm break-all sm:text-right leading-5">{shipment.awbCode}</span>
                        </div>
                      )}
                      {shipment.shipmentId && (
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4">
                          <span className="text-muted-foreground">Shipment ID</span>
                          <span className="font-mono text-[11px] sm:text-sm break-all sm:text-right leading-5">{shipment.shipmentId}</span>
                        </div>
                      )}
                      {shipment.externalStatus && (
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-4">
                          <span className="text-muted-foreground">Latest Carrier Update</span>
                          <span className="font-medium">{shipment.externalStatus}</span>
                        </div>
                      )}
                      {shipment.externalEventAt && (
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-4">
                          <span className="text-muted-foreground">Update Time</span>
                          <span className="font-medium sm:text-right">{new Date(shipment.externalEventAt).toLocaleString()}</span>
                        </div>
                      )}
                      {shipment.errorMessage && (
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-4">
                          <span className="text-muted-foreground">Shipment Note</span>
                          <span className="font-medium text-red-700">{shipment.errorMessage}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {order.paymentStatus === "paid" && order.paymentDetails?.gateway === "razorpay" && (
                <>
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                      <h3 className="font-semibold">Payment Details</h3>
                      <Button variant="outline" size="sm" onClick={handlePrintReceipt}>
                        Download / Print Receipt
                      </Button>
                    </div>
                    <div className="rounded-lg border p-4 space-y-3 text-sm print-page-break-avoid">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-4">
                        <span className="text-muted-foreground">Payment Gateway</span>
                        <span className="font-medium">Razorpay</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-4">
                        <span className="text-muted-foreground">Payment Status</span>
                        <span className="font-medium capitalize">{order.paymentDetails.status ?? "paid"}</span>
                      </div>
                      {order.paymentDetails.razorpayPaymentId && (
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4">
                          <span className="text-muted-foreground">Razorpay Payment ID</span>
                          <span className="font-mono text-[11px] sm:text-sm break-all sm:text-right leading-5">{order.paymentDetails.razorpayPaymentId}</span>
                        </div>
                      )}
                      {order.paymentDetails.razorpayOrderId && (
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4">
                          <span className="text-muted-foreground">Razorpay Order ID</span>
                          <span className="font-mono text-[11px] sm:text-sm break-all sm:text-right leading-5">{order.paymentDetails.razorpayOrderId}</span>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-4">
                        <span className="text-muted-foreground">Payment Time</span>
                        <span className="font-medium sm:text-right">
                          {new Date(order.paymentDetails.paidAt ?? order.updatedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Separator />
                </>
              )}
              
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
                      <span>{formatAmount(order.subtotalAmount ?? order.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery:</span>
                      <span className={order.shippingAmount ? "" : "text-green-600"}>
                        {order.shippingAmount && order.shippingAmount > 0 ? formatAmount(order.shippingAmount) : "Free"}
                      </span>
                    </div>
                    {typeof order.discountAmount === "number" && order.discountAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Discount:</span>
                        <span className="text-green-600">- {formatAmount(order.discountAmount)}</span>
                      </div>
                    )}
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
          <Card className="no-print">
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
