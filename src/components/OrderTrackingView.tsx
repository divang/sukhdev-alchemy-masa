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
  useV2Branding?: boolean
}

function getOrderTimestamp(order: Order) {
  const value = new Date(order.createdAt).getTime()
  return Number.isFinite(value) ? value : 0
}

export function OrderTrackingView({ order, orders, onBack, onSelectOrder, onResumePayment, onAddToCart, useV2Branding = false }: OrderTrackingViewProps) {
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
  
  if (useV2Branding) {
    return (
      <div className="min-h-screen bg-[#efefef]">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white no-print">
          <div className="container mx-auto flex items-center justify-between px-4 py-4">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft size={20} className="mr-2" />
              Back to Store
            </Button>
            <p className="text-sm font-medium text-slate-600">My Account</p>
          </div>
        </header>

        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="grid gap-4 md:grid-cols-[280px,1fr]">
            <Card className="border-slate-200 bg-white">
              <CardHeader className="space-y-3">
                <CardTitle className="text-lg">Hey, Customer</CardTitle>
                <CardDescription>
                  {orders.length} total orders
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <button
                  type="button"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium"
                >
                  Overview
                </button>
                <button
                  type="button"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm"
                >
                  My Orders
                </button>
                <button
                  type="button"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm"
                >
                  Saved Addresses
                </button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardHeader>
                <CardTitle>Overview</CardTitle>
                <CardDescription>Track active, pending, and delivered orders from one place.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">My Orders</h3>
                  {sortedOrders.length === 0 ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      No past orders yet. Start shopping to see orders here.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sortedOrders.slice(0, 5).map((entry) => (
                        <button
                          key={`v2-overview-${entry.id}`}
                          type="button"
                          onClick={() => onSelectOrder(entry.id)}
                          className={`w-full rounded-md border p-3 text-left ${currentOrder?.id === entry.id ? "border-slate-800 bg-slate-50" : "border-slate-200 bg-white"}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">{entry.id}</p>
                            <Badge variant={entry.paymentStatus === "paid" ? "secondary" : "outline"}>
                              {entry.paymentStatus === "paid" ? "Paid" : "Pending Payment"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            {new Date(entry.createdAt).toLocaleDateString()} | Rs{entry.totalAmount.toFixed(2)}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">Active Shipment</h3>
                  {currentOrder && currentOrder.paymentStatus === "paid" && currentOrder.status !== "delivered" ? (
                    <div className="rounded-md border border-slate-200 p-4 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="font-medium">{currentOrder.id}</p>
                        <Badge variant="secondary" className="capitalize">{currentOrder.status}</Badge>
                      </div>
                      {shipment?.trackingUrl ? (
                        <a className="inline-flex items-center text-primary underline" href={shipment.trackingUrl} target="_blank" rel="noreferrer">
                          <LinkIcon size={14} className="mr-1" />
                          Tracking Link
                        </a>
                      ) : (
                        <p className="text-slate-600">Tracking will appear after shipment is assigned.</p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      No active shipment right now.
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">Pending Payments</h3>
                  {pendingPaymentOrders.length === 0 ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      No unpaid orders.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingPaymentOrders.map((entry) => (
                        <div key={`v2-pending-${entry.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3 text-sm">
                          <span>{entry.id} | Rs{entry.totalAmount.toFixed(2)}</span>
                          <Button size="sm" onClick={() => onResumePayment?.(entry.id)}>Pay Now</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">Delivered Orders</h3>
                  {deliveredOrders.length === 0 ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      No delivered orders yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {deliveredOrders.slice(0, 6).map((entry) => (
                        <div key={`v2-delivered-${entry.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3 text-sm">
                          <span>{entry.id} | Rs{entry.totalAmount.toFixed(2)}</span>
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
                      ))}
                    </div>
                  )}
                </section>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

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
