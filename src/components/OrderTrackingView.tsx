import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Link as LinkIcon, MagnifyingGlass } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import type { Order } from "@/lib/types"
import { fetchLatestShipmentForOrder, syncShiprocketAwbForOrder, type LatestOrderShipment } from "@/lib/order-shipments"
import { toast } from "sonner"

type OrderTrackingViewProps = {
  order: Order | null
  orders: Order[]
  onBack: () => void
  onSelectOrder: (orderId: string) => void
  onResumePayment?: (orderId: string) => void
  onAddToCart?: (productId: string) => void
  useV2Branding?: boolean
  isAdmin?: boolean
}

function getOrderTimestamp(order: Order) {
  const value = new Date(order.createdAt).getTime()
  return Number.isFinite(value) ? value : 0
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value)
}

function getOrderHeadline(order: Order) {
  if (order.paymentStatus === "pending") {
    return "Awaiting payment"
  }

  if (order.status === "delivered") {
    return `Delivered ${new Date(order.updatedAt || order.createdAt).toLocaleDateString()}`
  }

  if (order.status === "shipped") {
    return "Shipped and on the way"
  }

  return "Order confirmed"
}

function getOrderSubheadline(order: Order) {
  if (order.paymentStatus === "pending") {
    return "Complete payment to start shipment processing."
  }
  if (order.status === "delivered") {
    return "Package was delivered successfully."
  }
  if (order.status === "shipped") {
    return "Your package is in transit."
  }
  return "Your order is being prepared for shipment."
}

type OrdersTab = "orders" | "buy-again" | "not-yet-shipped"

export function OrderTrackingView({ order, orders, onBack, onSelectOrder, onResumePayment, onAddToCart, useV2Branding = false, isAdmin = false }: OrderTrackingViewProps) {
  const [shipment, setShipment] = useState<LatestOrderShipment | null>(null)
  const [isLoadingShipment, setIsLoadingShipment] = useState(false)
  const [isSyncingShipment, setIsSyncingShipment] = useState(false)
  const [shipmentError, setShipmentError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<OrdersTab>("orders")
  const [searchQuery, setSearchQuery] = useState("")

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

  const notYetShippedOrders = useMemo(() => {
    return sortedOrders.filter((entry) => entry.status !== "delivered")
  }, [sortedOrders])

  const searchedOrders = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase()
    const base = activeTab === "buy-again"
      ? deliveredOrders
      : activeTab === "not-yet-shipped"
        ? notYetShippedOrders
        : sortedOrders

    if (!normalized) {
      return base
    }

    return base.filter((entry) => {
      const haystack = [
        entry.id,
        entry.customer.name,
        entry.customer.email,
        entry.items.map((item) => item.productName).join(" "),
      ].join(" ").toLowerCase()
      return haystack.includes(normalized)
    })
  }, [activeTab, deliveredOrders, notYetShippedOrders, searchQuery, sortedOrders])

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
        isAdmin
        && loadedShipment
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
  }, [currentOrder?.id, isAdmin])
  
  if (useV2Branding) {
    return (
      <div className="min-h-screen bg-[#eef1f4]">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white no-print">
          <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft size={18} className="mr-2" />
              Back to Store
            </Button>
            <p className="text-sm font-medium text-slate-700">Your Account | Your Orders</p>
          </div>
        </header>

        <main className="container mx-auto max-w-6xl px-4 py-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Your Orders</h1>
            <div className="flex w-full max-w-xl items-center gap-2 sm:w-auto sm:min-w-[420px]">
              <div className="relative flex-1">
                <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search all orders"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none ring-offset-2 transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <Button className="h-10 bg-slate-900 px-4 text-white hover:bg-slate-800">Search Orders</Button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${activeTab === "orders" ? "border-amber-500 text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"}`}
            >
              Orders
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("buy-again")}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${activeTab === "buy-again" ? "border-amber-500 text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"}`}
            >
              Buy Again
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("not-yet-shipped")}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${activeTab === "not-yet-shipped" ? "border-amber-500 text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"}`}
            >
              Not Yet Shipped
            </button>
          </div>

          <p className="mb-4 text-sm text-slate-600">{searchedOrders.length} order{searchedOrders.length === 1 ? "" : "s"}</p>

          {searchedOrders.length === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="p-8 text-center text-sm text-slate-600">No orders match your current filter.</CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {searchedOrders.map((entry) => {
                const isSelected = currentOrder?.id === entry.id
                const primaryItem = entry.items[0]

                return (
                  <Card key={`amazon-order-${entry.id}`} className={`overflow-hidden border-slate-300 ${isSelected ? "ring-2 ring-amber-300" : ""}`}>
                    <CardHeader className="bg-slate-100/90 py-3">
                      <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-4">
                        <div>
                          <p className="font-semibold text-slate-700">ORDER PLACED</p>
                          <p>{new Date(entry.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700">TOTAL</p>
                          <p>{formatInr(entry.totalAmount)}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700">SHIP TO</p>
                          <p className="truncate">{entry.customer.name}</p>
                        </div>
                        <div className="sm:text-right">
                          <p className="font-semibold text-slate-700">ORDER # {entry.id}</p>
                          <button
                            type="button"
                            onClick={() => onSelectOrder(entry.id)}
                            className="text-[11px] font-semibold text-blue-700 underline-offset-2 hover:underline"
                          >
                            View order details
                          </button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr,240px]">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{getOrderHeadline(entry)}</h3>
                        <p className="text-sm text-slate-600">{getOrderSubheadline(entry)}</p>

                        <div className="mt-4 flex gap-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                            {primaryItem ? primaryItem.productName.slice(0, 2).toUpperCase() : "OR"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {primaryItem ? primaryItem.productName : "Order items"}
                            </p>
                            <p className="text-xs text-slate-600">
                              {entry.items.length} item{entry.items.length === 1 ? "" : "s"} | Payment: {entry.paymentStatus}
                            </p>
                            {entry.items.length > 1 && (
                              <p className="mt-1 text-xs text-slate-500">+{entry.items.length - 1} more item(s)</p>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                            {isLoadingShipment && <p className="text-slate-600">Loading shipment details...</p>}
                            {!isLoadingShipment && isSyncingShipment && <p className="text-slate-600">Refreshing shipment details...</p>}
                            {shipmentError && <p className="text-red-700">{shipmentError}</p>}
                            {!isLoadingShipment && !shipmentError && entry.paymentStatus === "paid" && !shipment && (
                              <p className="text-slate-600">Shipment not assigned yet.</p>
                            )}
                            {shipment && (
                              <p className="text-slate-600">
                                {shipment.providerKey} | {shipment.shipmentStatus}
                                {shipment.awbCode ? ` | AWB: ${shipment.awbCode}` : ""}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {entry.paymentStatus === "pending" ? (
                          <Button className="h-9 w-full" onClick={() => onResumePayment?.(entry.id)}>Continue payment</Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="h-9 w-full"
                            onClick={() => {
                              if (!isSelected) {
                                onSelectOrder(entry.id)
                                return
                              }

                              if (shipment?.trackingUrl) {
                                window.open(shipment.trackingUrl, "_blank", "noopener,noreferrer")
                              } else {
                                toast.info("Tracking link is not available yet. Shipment details will appear once carrier assigns tracking.")
                              }
                            }}
                          >
                            Track package
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          className="h-9 w-full"
                          onClick={() => {
                            onSelectOrder(entry.id)
                            if (isSelected) {
                              toast.info("Order details are already open below.")
                            }
                          }}
                        >
                          View order details
                        </Button>

                        <Button
                          variant="outline"
                          className="h-9 w-full"
                          disabled={!primaryItem || entry.status !== "delivered"}
                          onClick={() => {
                            if (primaryItem) {
                              onAddToCart?.(primaryItem.productId)
                            }
                          }}
                        >
                          Buy it again
                        </Button>

                        {isSelected && shipment?.trackingUrl && (
                          <a
                            className="inline-flex h-9 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            href={shipment.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <LinkIcon size={14} className="mr-2" />
                            Open tracking link
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </main>
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
