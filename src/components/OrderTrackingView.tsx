import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Link as LinkIcon,
  MagnifyingGlass,
  Star,
  CaretRight,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import type { Order } from "@/lib/types"
import { fetchLatestShipmentForOrder, syncShiprocketAwbForOrder, type LatestOrderShipment } from "@/lib/order-shipments"

type OrderTrackingViewProps = {
  order: Order | null
  orders: Order[]
  onBack: () => void
  onSelectOrder: (orderId: string) => void
}

const statusSteps = [
  { key: "pending", label: "Order Placed", icon: Package },
  { key: "processing", label: "Assigning Courier", icon: Package },
  { key: "shipped", label: "On the way", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle }
]

type OrderFilter = "all" | "active" | "delivered"

function getOrderDateLabel(order: Order) {
  return new Date(order.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function orderMatchesSearch(order: Order, query: string) {
  const haystack = [
    order.id,
    order.customer.name,
    order.customer.city,
    ...order.items.map((item) => item.productName),
  ].join(" ").toLowerCase()

  return haystack.includes(query.toLowerCase())
}

export function OrderTrackingView({ order, orders, onBack, onSelectOrder }: OrderTrackingViewProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all")
  const [shipment, setShipment] = useState<LatestOrderShipment | null>(null)
  const [isLoadingShipment, setIsLoadingShipment] = useState(false)
  const [isSyncingShipment, setIsSyncingShipment] = useState(false)
  const [shipmentError, setShipmentError] = useState<string | null>(null)

  const filteredOrders = useMemo(() => {
    return orders
      .filter((entry) => {
        if (orderFilter === "delivered") {
          return entry.status === "delivered"
        }

        if (orderFilter === "active") {
          return entry.status !== "delivered"
        }

        return true
      })
      .filter((entry) => (searchQuery.trim() ? orderMatchesSearch(entry, searchQuery.trim()) : true))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  }, [orders, orderFilter, searchQuery])

  const buyAgainItems = useMemo(() => {
    const map = new Map<string, { key: string; name: string }>()

    const sorted = [...orders].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    for (const entry of sorted) {
      for (const item of entry.items) {
        if (!map.has(item.productId)) {
          map.set(item.productId, { key: `${entry.id}-${item.productId}`, name: item.productName })
        }
      }
    }

    return [...map.values()].slice(0, 8)
  }, [orders])

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

      const loadedShipment = result.shipment
      const shouldSyncAwb = Boolean(
        loadedShipment
        && loadedShipment.providerKey === "shiprocket"
        && !loadedShipment.awbCode
        && loadedShipment.shipmentId
        && (loadedShipment.shipmentStatus === "created" || loadedShipment.shipmentStatus === "pending")
      )

      if (!shouldSyncAwb) {
        return
      }

      setIsSyncingShipment(true)
      const syncResult = await syncShiprocketAwbForOrder(order.id)
      if (!isActive) {
        return
      }

      setIsSyncingShipment(false)

      if (!syncResult.success) {
        setShipmentError(syncResult.error ?? "Unable to refresh shipment details from Shiprocket.")
        return
      }

      if (!syncResult.synced) {
        return
      }

      setShipment((current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          shipmentId: syncResult.shipmentId ?? current.shipmentId,
          awbCode: syncResult.awbCode ?? current.awbCode,
          trackingUrl: syncResult.trackingUrl ?? current.trackingUrl,
          externalStatus: syncResult.externalStatus ?? current.externalStatus,
          externalEventAt: new Date().toISOString(),
        }
      })
    }

    void loadShipment()

    return () => {
      isActive = false
    }
  }, [order?.id])
  
  const getStatusIndex = (status: string) => {
    return statusSteps.findIndex(s => s.key === status)
  }
  
  const currentStatusIndex = order ? getStatusIndex(order.status) : -1
  const progressPercentage = order ? ((currentStatusIndex + 1) / statusSteps.length) * 100 : 0
  
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card no-print">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={20} className="mr-2" />
            Back to Store
          </Button>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="mb-4 text-3xl font-bold">Your Orders</h1>

        <Card className="mb-5 border-slate-200 py-3 shadow-none">
          <CardContent className="px-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="flex items-center rounded-md border bg-background px-3">
                <MagnifyingGlass size={18} className="mr-2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search all orders"
                  className="border-0 px-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="min-w-[112px]">
                <select
                  value={orderFilter}
                  onChange={(event) => setOrderFilter(event.target.value as OrderFilter)}
                  className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                >
                  <option value="all">Filter: All</option>
                  <option value="active">Filter: Active</option>
                  <option value="delivered">Filter: Delivered</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {buyAgainItems.length > 0 && (
          <Card className="mb-5 border-slate-200 py-3 shadow-none">
            <CardHeader className="px-3 pb-2">
              <CardTitle className="text-2xl">Buy again</CardTitle>
            </CardHeader>
            <CardContent className="px-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {buyAgainItems.map((item) => (
                  <div key={item.key} className="w-24 flex-shrink-0">
                    <div className="mb-1 flex h-20 w-full items-center justify-center rounded-md border bg-muted">
                      <Package size={26} className="text-muted-foreground" />
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{item.name}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-8 border-slate-200 py-3 shadow-none">
          <CardHeader className="px-3 pb-2">
            <CardTitle className="text-2xl">Purchase history</CardTitle>
            <p className="text-sm text-muted-foreground">Past three months</p>
          </CardHeader>
          <CardContent className="space-y-3 px-3">
            {filteredOrders.length === 0 && (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                No orders found for current filter.
              </div>
            )}

            {filteredOrders.map((entry) => {
              const selected = entry.id === order?.id
              const isDelivered = entry.status === "delivered"

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "rounded-xl border bg-background p-4 transition-colors",
                    selected ? "border-primary bg-primary/5" : "border-slate-200"
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Order #{entry.id}</p>
                      <p className="text-xs text-muted-foreground">{getOrderDateLabel(entry)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">₹{entry.totalAmount.toFixed(2)}</p>
                      <p className="text-xs capitalize text-muted-foreground">{entry.status}</p>
                    </div>
                  </div>

                  <p className="mb-1 line-clamp-1 text-base font-medium">{entry.items[0]?.productName ?? "Order item"}</p>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {isDelivered ? "Package was handed to resident" : "Your shipment is being prepared for dispatch"}
                  </p>

                  {isDelivered && (
                    <div className="mb-3">
                      <p className="mb-2 text-sm">Rate your delivery experience</p>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star key={`${entry.id}-${index}`} size={24} className="text-muted-foreground" />
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    className="h-auto w-full justify-between px-0 py-1 text-base"
                    onClick={() => onSelectOrder(entry.id)}
                  >
                    Track package
                    <CaretRight size={18} />
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
        
        {order && (
          <Card className="print-receipt-card border-slate-200 py-4 shadow-none">
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

                  {!isLoadingShipment && isSyncingShipment && (
                    <p className="text-muted-foreground">Fetching latest AWB from Shiprocket...</p>
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
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4">
                        <span className="text-muted-foreground">AWB</span>
                        {shipment.awbCode ? (
                          <span className="font-mono text-[11px] sm:text-sm break-all sm:text-right leading-5">{shipment.awbCode}</span>
                        ) : (
                          <span className="font-medium text-muted-foreground">Pending carrier assignment</span>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4">
                        <span className="text-muted-foreground">Tracking Link</span>
                        {shipment.trackingUrl ? (
                          <a
                            href={shipment.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-primary underline underline-offset-2 break-all sm:text-right"
                          >
                            {shipment.trackingUrl}
                          </a>
                        ) : (
                          <span className="font-medium text-muted-foreground">Will appear once AWB is available</span>
                        )}
                      </div>
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
      </div>
    </div>
  )
}
