import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { Order } from "@/lib/types"
import {
  downloadAdminOrdersCsv,
  sendDailySnapshotEmailNow,
} from "@/lib/admin-order-export"
import {
  fetchOrderShipmentsForAdmin,
  triggerShipmentForOrderByAdmin,
  type AdminOrderShipment,
} from "@/lib/order-shipments"
import {
  fetchActivePromoCodesForAdmin,
  generatePromoCodeToken,
  upsertPromoCodeByAdmin,
  type PromoDiscountType,
} from "@/lib/promo-codes"

type AdminSimplifiedPanelProps = {
  orders?: Order[]
}

function getOrderTimestamp(order: Order) {
  const value = new Date(order.createdAt).getTime()
  return Number.isFinite(value) ? value : 0
}

function renderOrderLine(order: Order) {
  return `${order.id} | ${order.customer.name} | Rs${order.totalAmount.toFixed(2)} | ${new Date(order.createdAt).toLocaleString()}`
}

export function AdminSimplifiedPanel({ orders = [] }: AdminSimplifiedPanelProps) {
  const [shipments, setShipments] = useState<AdminOrderShipment[]>([])
  const [isRefreshingShipments, setIsRefreshingShipments] = useState(false)
  const [isDownloadingOrdersCsv, setIsDownloadingOrdersCsv] = useState(false)
  const [isSendingSnapshotEmail, setIsSendingSnapshotEmail] = useState(false)
  const [triggeringShipmentOrderId, setTriggeringShipmentOrderId] = useState<string | null>(null)
  const [archivePage, setArchivePage] = useState(1)

  const [activePromos, setActivePromos] = useState<Array<{ id: string; code: string; description?: string; discountType: PromoDiscountType; discountValue: number }>>([])
  const [inactivePromos, setInactivePromos] = useState<Array<{ id: string; code: string; description?: string; discountType: PromoDiscountType; discountValue: number }>>([])
  const [isCreatingPromo, setIsCreatingPromo] = useState(false)
  const [newPromoCode, setNewPromoCode] = useState("")
  const [newPromoDescription, setNewPromoDescription] = useState("")
  const [newPromoType, setNewPromoType] = useState<PromoDiscountType>("percent")
  const [newPromoValue, setNewPromoValue] = useState("10")

  const refreshShipments = async () => {
    setIsRefreshingShipments(true)
    const result = await fetchOrderShipmentsForAdmin(200)
    setIsRefreshingShipments(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    setShipments(result.shipments)
  }

  const refreshPromos = async () => {
    const result = await fetchActivePromoCodesForAdmin()
    if (result.error) {
      toast.error(result.error)
      return
    }

    const mapped = result.promoCodes.map((promo) => ({
      id: promo.id,
      code: promo.code,
      description: promo.description,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      isActive: promo.isActive,
    }))

    setActivePromos(mapped.filter((promo) => promo.isActive))
    setInactivePromos(mapped.filter((promo) => !promo.isActive))
  }

  useEffect(() => {
    void refreshShipments()
    void refreshPromos()
  }, [])

  const latestShipmentByOrderId = useMemo(() => {
    const map = new Map<string, AdminOrderShipment>()

    for (const shipment of shipments) {
      if (!map.has(shipment.orderId)) {
        map.set(shipment.orderId, shipment)
      }
    }

    return map
  }, [shipments])

  const sortedOrders = useMemo(() => [...orders].sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a)), [orders])

  const waitingShipmentAssignment = useMemo(() => {
    return sortedOrders.filter((order) => {
      if (order.paymentStatus !== "paid" || order.status === "delivered") {
        return false
      }
      const shipment = latestShipmentByOrderId.get(order.id)
      return !shipment || (!shipment.shipmentId && !shipment.awbCode)
    })
  }, [sortedOrders, latestShipmentByOrderId])

  const transitionOrders = useMemo(() => {
    return sortedOrders.filter((order) => {
      if (order.paymentStatus !== "paid") {
        return false
      }
      if (order.status === "shipped") {
        return true
      }
      const shipment = latestShipmentByOrderId.get(order.id)
      return Boolean(shipment?.trackingUrl)
    })
  }, [sortedOrders, latestShipmentByOrderId])

  const paidNotYetShipped = useMemo(() => {
    return sortedOrders.filter((order) => order.paymentStatus === "paid" && (order.status === "pending" || order.status === "processing"))
  }, [sortedOrders])

  const unpaidOrders = useMemo(() => {
    return sortedOrders.filter((order) => order.paymentStatus !== "paid")
  }, [sortedOrders])

  const deliveredOrders = useMemo(() => {
    return sortedOrders.filter((order) => order.status === "delivered")
  }, [sortedOrders])

  const archiveOrders = useMemo(() => {
    const inNamedBuckets = new Set<string>([
      ...waitingShipmentAssignment.map((o) => o.id),
      ...transitionOrders.map((o) => o.id),
      ...paidNotYetShipped.map((o) => o.id),
      ...unpaidOrders.map((o) => o.id),
      ...deliveredOrders.map((o) => o.id),
    ])
    return sortedOrders.filter((order) => !inNamedBuckets.has(order.id))
  }, [sortedOrders, waitingShipmentAssignment, transitionOrders, paidNotYetShipped, unpaidOrders, deliveredOrders])

  const archivePageSize = 10
  const archivePages = Math.max(1, Math.ceil(archiveOrders.length / archivePageSize))
  const archiveStart = (archivePage - 1) * archivePageSize
  const pagedArchiveOrders = archiveOrders.slice(archiveStart, archiveStart + archivePageSize)

  useEffect(() => {
    if (archivePage > archivePages) {
      setArchivePage(archivePages)
    }
  }, [archivePage, archivePages])

  const handleTriggerShipment = async (orderId: string) => {
    setTriggeringShipmentOrderId(orderId)
    const result = await triggerShipmentForOrderByAdmin(orderId)
    setTriggeringShipmentOrderId(null)

    if (!result.success) {
      toast.error(result.error ?? "Failed to trigger shipment.")
      return
    }

    if (result.created) {
      toast.success(`Shipment created${result.awbCode ? ` (AWB: ${result.awbCode})` : ""}.`)
    } else {
      toast.info(result.reason ?? "Shipment not created.")
    }

    await refreshShipments()
  }

  const handleDownloadOrdersCsv = async () => {
    setIsDownloadingOrdersCsv(true)
    const result = await downloadAdminOrdersCsv({ range: "all", format: "order-summary" })
    setIsDownloadingOrdersCsv(false)

    if (!result.success) {
      toast.error(result.error ?? "Failed to export orders CSV.")
      return
    }

    toast.success(`Orders CSV downloaded (${result.rowCount ?? 0} rows).`)
  }

  const handleSendSnapshotEmail = async () => {
    setIsSendingSnapshotEmail(true)
    const result = await sendDailySnapshotEmailNow({ range: "all", format: "order-summary" })
    setIsSendingSnapshotEmail(false)

    if (!result.success) {
      toast.error(result.error ?? "Failed to send snapshot email.")
      return
    }

    toast.success("Orders snapshot email sent.")
  }

  const handleCreatePromo = async () => {
    const code = newPromoCode.trim().toUpperCase()
    const discountValue = Number(newPromoValue)

    if (!code) {
      toast.error("Promo code is required.")
      return
    }

    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      toast.error("Promo discount value must be a positive number.")
      return
    }

    setIsCreatingPromo(true)
    const result = await upsertPromoCodeByAdmin({
      code,
      description: newPromoDescription.trim() || undefined,
      discountScope: "total",
      discountType: newPromoType,
      discountValue,
      isActive: true,
    })
    setIsCreatingPromo(false)

    if (result.error || !result.promoCode) {
      toast.error(result.error ?? "Failed to create promo code.")
      return
    }

    toast.success(`Promo ${result.promoCode.code} created.`)
    setNewPromoCode("")
    setNewPromoDescription("")
    setNewPromoType("percent")
    setNewPromoValue("10")
    await refreshPromos()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>Simplified order operations and status buckets.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
            <p className="text-sm">1. Download orders and send orders email snapshot (single row action)</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadOrdersCsv} disabled={isDownloadingOrdersCsv}>
                {isDownloadingOrdersCsv ? "Preparing..." : "Download Orders"}
              </Button>
              <Button size="sm" onClick={handleSendSnapshotEmail} disabled={isSendingSnapshotEmail}>
                {isSendingSnapshotEmail ? "Sending..." : "Send Orders Email"}
              </Button>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">2. Waiting for Shipment Assignment</p>
              <Badge variant="outline">{waitingShipmentAssignment.length}</Badge>
            </div>
            {waitingShipmentAssignment.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders in this bucket.</p>
            ) : (
              <div className="space-y-2">
                {waitingShipmentAssignment.map((order) => (
                  <div key={`waiting-${order.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                    <span>{renderOrderLine(order)}</span>
                    <Button
                      size="sm"
                      onClick={() => handleTriggerShipment(order.id)}
                      disabled={triggeringShipmentOrderId === order.id}
                    >
                      {triggeringShipmentOrderId === order.id ? "Triggering..." : "Trigger Shipment"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">3. Transition Mode (Tracking Link)</p>
              <Badge variant="outline">{transitionOrders.length}</Badge>
            </div>
            {transitionOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders in transit.</p>
            ) : (
              <div className="space-y-2">
                {transitionOrders.map((order) => {
                  const shipment = latestShipmentByOrderId.get(order.id)
                  return (
                    <div key={`transition-${order.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                      <span>{renderOrderLine(order)}</span>
                      {shipment?.trackingUrl ? (
                        <a className="text-primary underline" href={shipment.trackingUrl} target="_blank" rel="noreferrer">
                          Tracking Link
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Tracking pending</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">4. Paid But Not Yet Shipped</p>
              <Badge variant="outline">{paidNotYetShipped.length}</Badge>
            </div>
            {paidNotYetShipped.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders in this bucket.</p>
            ) : (
              <div className="space-y-2">
                {paidNotYetShipped.map((order) => (
                  <div key={`paid-not-shipped-${order.id}`} className="rounded border p-2 text-sm">{renderOrderLine(order)}</div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">5. Order Placed But Not Paid</p>
              <Badge variant="outline">{unpaidOrders.length}</Badge>
            </div>
            {unpaidOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unpaid orders.</p>
            ) : (
              <div className="space-y-2">
                {unpaidOrders.map((order) => (
                  <div key={`unpaid-${order.id}`} className="rounded border p-2 text-sm">{renderOrderLine(order)}</div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">6. Order Delivered</p>
              <Badge variant="outline">{deliveredOrders.length}</Badge>
            </div>
            {deliveredOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No delivered orders.</p>
            ) : (
              <div className="space-y-2">
                {deliveredOrders.map((order) => (
                  <div key={`delivered-${order.id}`} className="rounded border p-2 text-sm">{renderOrderLine(order)}</div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">7. Rest / Archive Orders</p>
              <Badge variant="outline">{archiveOrders.length}</Badge>
            </div>

            {archiveOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No archive orders.</p>
            ) : (
              <div className="space-y-2">
                {pagedArchiveOrders.map((order) => (
                  <div key={`archive-${order.id}`} className="rounded border p-2 text-sm">{renderOrderLine(order)}</div>
                ))}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button size="sm" variant="outline" disabled={archivePage <= 1} onClick={() => setArchivePage((p) => Math.max(1, p - 1))}>
                    Prev
                  </Button>
                  <span className="text-xs text-muted-foreground">Page {archivePage} / {archivePages}</span>
                  <Button size="sm" variant="outline" disabled={archivePage >= archivePages} onClick={() => setArchivePage((p) => Math.min(archivePages, p + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={refreshShipments} disabled={isRefreshingShipments}>
              {isRefreshingShipments ? "Refreshing..." : "Refresh Shipment Data"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promo</CardTitle>
          <CardDescription>Simplified promo controls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Active Promo</p>
              <Badge variant="outline">{activePromos.length}</Badge>
            </div>
            {activePromos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active promos.</p>
            ) : (
              <div className="space-y-2">
                {activePromos.map((promo) => (
                  <div key={promo.id} className="rounded border p-2 text-sm">
                    {promo.code} | {promo.discountType === "percent" ? `${promo.discountValue}%` : `Rs${promo.discountValue}`} | {promo.description || "No description"}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <p className="text-sm font-medium">Create New Promo</p>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label>Code</Label>
                <div className="flex gap-2">
                  <Input value={newPromoCode} onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())} placeholder="SDA10" />
                  <Button type="button" size="sm" variant="outline" onClick={() => setNewPromoCode(generatePromoCodeToken("SDA", 6))}>
                    Auto
                  </Button>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={newPromoDescription} onChange={(e) => setNewPromoDescription(e.target.value)} placeholder="Festival offer" />
              </div>
              <div>
                <Label>Type</Label>
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={newPromoType} onChange={(e) => setNewPromoType(e.target.value as PromoDiscountType)}>
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
              <div>
                <Label>Value</Label>
                <Input type="number" value={newPromoValue} onChange={(e) => setNewPromoValue(e.target.value)} placeholder="10" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCreatePromo} disabled={isCreatingPromo}>{isCreatingPromo ? "Creating..." : "Create Promo"}</Button>
            </div>
          </div>

          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">Inactive Promo (closed list)</summary>
            <div className="mt-3 space-y-2">
              {inactivePromos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No inactive promos.</p>
              ) : (
                inactivePromos.map((promo) => (
                  <div key={promo.id} className="rounded border p-2 text-sm">
                    {promo.code} | {promo.discountType === "percent" ? `${promo.discountValue}%` : `Rs${promo.discountValue}`} | {promo.description || "No description"}
                  </div>
                ))
              )}
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}
