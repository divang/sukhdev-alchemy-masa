import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Link as LinkIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import type { Order } from "@/lib/types"
import { fetchLatestShipmentForOrder, syncShiprocketAwbForOrder, type LatestOrderShipment } from "@/lib/order-shipments"

type OrderTrackingViewProps = {
  order: Order | null
  orders: Order[]
  onBack: () => void
  onSelectOrder: (orderId: string) => void
  onResumePayment?: (orderId: string) => void
  onAddToCart?: (productId: string) => void
}

function getOrderTimestamp(order: Order) {
  const value = new Date(order.createdAt).getTime()
  return Number.isFinite(value) ? value : 0
}

export function OrderTrackingView({ order, orders, onBack, onSelectOrder, onResumePayment, onAddToCart }: OrderTrackingViewProps) {
  const [shipment, setShipment] = useState<LatestOrderShipment | null>(null)
  const [isLoadingShipment, setIsLoadingShipment] = useState(false)
  const [isSyncingShipment, setIsSyncingShipment] = useState(false)
  const [shipmentError, setShipmentError] = useState<string | null>(null)

  const sortedOrders = useMemo(() => [...orders].sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a)), [orders])
  const currentOrder = order ?? sortedOrders[0] ?? null

  const currentInTransit = useMemo(() => {
    return sortedOrders.filter((entry) => entry.paymentStatus === "paid" && entry.status !== "delivered")
  }, [sortedOrders])

  const pendingPaymentOrders = useMemo(() => {
    return sortedOrders.filter((entry) => entry.paymentStatus === "pending")
  }, [sortedOrders])

  const deliveredOrders = useMemo(() => {
    return sortedOrders.filter((entry) => entry.status === "delivered")
  }, [sortedOrders])

  useEffect(() => {
    let isActive = true

    async function loadShipment() {
      if (!currentOrder?.id) {
        setShipment(null)
        setShipmentError(null)
        return
      }

      setIsLoadingShipment(true)
      setShipmentError(null)

      const result = await fetchLatestShipmentForOrder(currentOrder.id)
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
      const syncResult = await syncShiprocketAwbForOrder(currentOrder.id)
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
  }, [currentOrder?.id])
  
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
        <h1 className="text-3xl font-bold mb-8">Your Orders</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current Order Waiting for Delivery</CardTitle>
            <CardDescription>Active paid orders with shipment tracking link.</CardDescription>
          </CardHeader>
          <CardContent>
            {currentInTransit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No current active delivery orders.</p>
            ) : (
              <div className="space-y-3">
                {currentInTransit.map((entry) => {
                  const selected = currentOrder?.id === entry.id
                  return (
                    <button
                      key={`active-${entry.id}`}
                      onClick={() => onSelectOrder(entry.id)}
                      className={`w-full rounded border p-3 text-left ${selected ? "border-primary bg-primary/5" : ""}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{entry.id}</p>
                          <p className="text-sm text-muted-foreground">{entry.customer.name} | Rs{entry.totalAmount.toFixed(2)}</p>
                        </div>
                        <Badge variant="secondary" className="capitalize">{entry.status}</Badge>
                      </div>
                    </button>
                  )
                })}

                {currentOrder && (
                  <div className="rounded border p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium">Shipment for {currentOrder.id}</p>
                      {shipment?.trackingUrl && (
                        <a className="inline-flex items-center text-primary underline" href={shipment.trackingUrl} target="_blank" rel="noreferrer">
                          <LinkIcon size={14} className="mr-1" />
                          Tracking Link
                        </a>
                      )}
                    </div>
                    {isLoadingShipment && <p className="text-muted-foreground">Loading shipment details...</p>}
                    {!isLoadingShipment && isSyncingShipment && <p className="text-muted-foreground">Refreshing shipment details...</p>}
                    {shipmentError && <p className="text-red-700">{shipmentError}</p>}
                    {!isLoadingShipment && !shipmentError && !shipment && <p className="text-muted-foreground">Shipment not assigned yet.</p>}
                    {shipment && (
                      <p className="text-muted-foreground">
                        {shipment.providerKey} | {shipment.shipmentStatus}
                        {shipment.awbCode ? ` | AWB: ${shipment.awbCode}` : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Order Placed but Not Paid</CardTitle>
            <CardDescription>Continue payment for pending orders.</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingPaymentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unpaid orders.</p>
            ) : (
              <div className="space-y-2">
                {pendingPaymentOrders.map((entry) => (
                  <div key={`pending-pay-${entry.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                    <span>{entry.id} | {entry.customer.name} | Rs{entry.totalAmount.toFixed(2)}</span>
                    <Button size="sm" onClick={() => onResumePayment?.(entry.id)}>Continue Payment</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>History Orders</CardTitle>
            <CardDescription>Delivered orders and quick place-order-again action.</CardDescription>
          </CardHeader>
          <CardContent>
            {deliveredOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No delivered order history yet.</p>
            ) : (
              <div className="space-y-2">
                {deliveredOrders.map((entry) => (
                  <div key={`history-${entry.id}`} className="rounded border p-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>{entry.id} | {entry.customer.name} | Rs{entry.totalAmount.toFixed(2)}</span>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Delivered</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const firstItem = entry.items[0]
                            if (firstItem) {
                              onAddToCart?.(firstItem.productId)
                            }
                          }}
                        >
                          Order Again
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Archive Orders Delivered</CardTitle>
            <CardDescription>Delivered archive list.</CardDescription>
          </CardHeader>
          <CardContent>
            {deliveredOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No archived delivered orders.</p>
            ) : (
              <div className="space-y-2">
                {deliveredOrders.map((entry) => (
                  <div key={`archive-delivered-${entry.id}`} className="rounded border p-2 text-sm">
                    {entry.id} | {entry.customer.name} | Rs{entry.totalAmount.toFixed(2)} | {new Date(entry.createdAt).toLocaleDateString()}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
