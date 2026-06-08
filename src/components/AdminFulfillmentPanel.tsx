import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import type { Order } from "@/lib/types"
import {
  fetchOrderShipmentsForAdmin,
  syncShiprocketAwbForOrderByAdmin,
  triggerShipmentForOrderByAdmin,
  type AdminOrderShipment,
} from "@/lib/order-shipments"

type AdminFulfillmentPanelProps = {
  orders?: Order[]
}

function getOrderTimestamp(order: Order) {
  const createdAtValue = new Date(order.createdAt).getTime()
  if (Number.isFinite(createdAtValue) && createdAtValue > 0) {
    return createdAtValue
  }

  const match = order.id.match(/ORD-(\d{8,})$/)
  if (!match) {
    return 0
  }

  const value = Number(match[1])
  return Number.isFinite(value) ? value : 0
}

function isPendingOrUpcoming(order: Order) {
  return order.status === "pending" || order.status === "processing"
}

function isShipmentAssigned(shipment?: AdminOrderShipment) {
  if (!shipment) {
    return false
  }

  if (shipment.shipmentStatus !== "created") {
    return false
  }

  return Boolean(shipment.shipmentId || shipment.awbCode)
}

export function AdminFulfillmentPanel({ orders = [] }: AdminFulfillmentPanelProps) {
  const [shipmentLogs, setShipmentLogs] = useState<AdminOrderShipment[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [triggeringShipmentOrderId, setTriggeringShipmentOrderId] = useState<string | null>(null)
  const [syncingAwbOrderId, setSyncingAwbOrderId] = useState<string | null>(null)

  const refreshShipmentLogs = async () => {
    setIsRefreshing(true)
    const result = await fetchOrderShipmentsForAdmin(40)
    setIsRefreshing(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    setShipmentLogs(result.shipments)
  }

  useEffect(() => {
    void refreshShipmentLogs()
  }, [])

  const latestShipmentByOrderId = useMemo(() => {
    const map = new Map<string, AdminOrderShipment>()

    for (const shipment of shipmentLogs) {
      if (!map.has(shipment.orderId)) {
        map.set(shipment.orderId, shipment)
      }
    }

    return map
  }, [shipmentLogs])

  const priorityOrders = useMemo(() => {
    return [...orders]
      .map((order) => {
        const latestShipment = latestShipmentByOrderId.get(order.id)
        const pendingOrUpcoming = isPendingOrUpcoming(order)
        const shipmentAssigned = isShipmentAssigned(latestShipment)
        const shipmentUnassigned = !shipmentAssigned

        return {
          order,
          latestShipment,
          pendingOrUpcoming,
          shipmentUnassigned,
          priorityScore: (pendingOrUpcoming ? 2 : 0) + (shipmentUnassigned ? 1 : 0),
        }
      })
      .filter((entry) => entry.pendingOrUpcoming || entry.shipmentUnassigned)
      .sort((left, right) => {
        if (right.priorityScore !== left.priorityScore) {
          return right.priorityScore - left.priorityScore
        }

        return getOrderTimestamp(right.order) - getOrderTimestamp(left.order)
      })
  }, [orders, latestShipmentByOrderId])

  const handleTriggerShipmentForOrder = async (orderId: string) => {
    setTriggeringShipmentOrderId(orderId)
    const result = await triggerShipmentForOrderByAdmin(orderId)
    setTriggeringShipmentOrderId(null)

    if (!result.success) {
      toast.error(result.error ?? "Failed to trigger shipment.")
      await refreshShipmentLogs()
      return
    }

    if (result.created) {
      toast.success(`Shipment created via ${result.provider ?? "provider"}${result.awbCode ? ` (AWB: ${result.awbCode})` : ""}.`)
    } else {
      toast.info(`Shipment was not created: ${result.reason ?? "check logs"}.`)
    }

    await refreshShipmentLogs()
  }

  const handleSyncAwbForOrder = async (orderId: string) => {
    setSyncingAwbOrderId(orderId)
    const result = await syncShiprocketAwbForOrderByAdmin(orderId)
    setSyncingAwbOrderId(null)

    if (!result.success) {
      toast.error(result.error ?? "Failed to sync Shiprocket AWB.")
      await refreshShipmentLogs()
      return
    }

    if (result.synced) {
      toast.success(`Shiprocket updated${result.awbCode ? ` (AWB: ${result.awbCode})` : ""}.`)
    } else {
      toast.info(`No AWB update yet: ${result.reason ?? "carrier assignment pending"}.`)
    }

    await refreshShipmentLogs()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Priority Orders Queue</CardTitle>
          <CardDescription>Pending/upcoming or shipment-unassigned orders are shown first.</CardDescription>
        </CardHeader>
        <CardContent>
          {priorityOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending or shipment-unassigned orders right now.</p>
          ) : (
            <div className="space-y-3">
              {priorityOrders.slice(0, 20).map(({ order, latestShipment, shipmentUnassigned }) => {
                const isTriggering = triggeringShipmentOrderId === order.id
                const isSyncingAwb = syncingAwbOrderId === order.id
                const canTrigger = order.paymentStatus === "paid"
                const canSyncAwb = order.paymentStatus === "paid"

                return (
                  <div key={order.id} className="rounded-lg border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">Order #{order.id}</p>
                        <Badge variant="secondary" className="capitalize">{order.status}</Badge>
                        <Badge variant={order.paymentStatus === "paid" ? "default" : "outline"} className="capitalize">
                          {order.paymentStatus}
                        </Badge>
                        <Badge variant={shipmentUnassigned ? "destructive" : "default"}>
                          {shipmentUnassigned ? "Shipment Unassigned" : "Shipment Assigned"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {order.customer.name} | {new Date(order.createdAt).toLocaleString()}
                      </p>
                      {latestShipment && (
                        <p className="text-xs text-muted-foreground">
                          Latest shipment: {latestShipment.shipmentStatus}
                          {latestShipment.awbCode ? ` | AWB: ${latestShipment.awbCode}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleTriggerShipmentForOrder(order.id)}
                        disabled={!canTrigger || isTriggering}
                      >
                        {!canTrigger ? "Awaiting Payment" : isTriggering ? "Triggering..." : "Trigger Shipment"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSyncAwbForOrder(order.id)}
                        disabled={!canSyncAwb || isSyncingAwb}
                      >
                        {!canSyncAwb ? "Awaiting Payment" : isSyncingAwb ? "Syncing..." : "Sync AWB"}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Shipment Logs</CardTitle>
          <CardDescription>Latest shipment creation and AWB status updates.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Most recent attempts</p>
            <Button size="sm" variant="outline" onClick={refreshShipmentLogs} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {shipmentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shipment attempts logged yet.</p>
          ) : (
            <div className="space-y-2">
              {shipmentLogs.slice(0, 20).map((shipment) => (
                <div key={shipment.id} className="rounded-md border p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{shipment.providerKey}</Badge>
                    <Badge variant={shipment.shipmentStatus === "created" ? "default" : shipment.shipmentStatus === "failed" ? "destructive" : "secondary"}>
                      {shipment.shipmentStatus}
                    </Badge>
                    <span className="text-muted-foreground">Order #{shipment.orderId}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {shipment.awbCode ? `AWB: ${shipment.awbCode} | ` : ""}
                    {shipment.shipmentId ? `Shipment ID: ${shipment.shipmentId} | ` : ""}
                    {new Date(shipment.createdAt).toLocaleString()}
                  </p>
                  {shipment.errorMessage && <p className="mt-1 text-red-700">{shipment.errorMessage}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
