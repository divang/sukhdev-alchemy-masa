import { useEffect, useMemo, useState } from "react"
import { useKV } from "@/hooks/use-kv"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import type { Category, Order, Product } from "@/lib/types"
import type { RuntimeMode } from "@/lib/runtime-mode"
import { createProductByAdmin, loadCatalogFromSupabase, type AdminProductInput, updateProductByAdmin } from "@/lib/catalog"
import { isSupabaseConfigured } from "@/lib/supabase"
import {
  fetchAdminNotifications,
  markAdminNotificationEmailSent,
  markAdminNotificationWhatsappSent,
  type AdminNotification,
} from "@/lib/admin-notifications"
import {
  fetchPromoCodeChannelState,
  fetchActivePromoCodesForAdmin,
  generatePromoCodeToken,
  promotePromoCodeDevToProdByAdmin,
  rollbackPromoCodeProdByAdmin,
  setPromoCodeDevEnabledByAdmin,
  type PromoCodeChannelState,
  type PromoDiscountType,
  type PromoScope,
  upsertPromoCodeByAdmin,
} from "@/lib/promo-codes"
import { fetchFeatureFlags, setFeatureFlagEnabledByAdmin, type FeatureFlags } from "@/lib/feature-flags"
import {
  fetchPaymentUpiAccountsForAdmin,
  setPaymentUpiAccountEnabled,
  setPrimaryPaymentUpiAccount,
  type AdminPaymentUpiAccount,
} from "@/lib/payment-upi"
import {
  fetchDeliveryPartnerAccountsForAdmin,
  setDeliveryPartnerEnabled,
  setPrimaryDeliveryPartnerAccount,
  type AdminDeliveryPartnerAccount,
} from "@/lib/delivery-partners"
import {
  fetchOrderShipmentsForAdmin,
  triggerShipmentForOrderByAdmin,
  type AdminOrderShipment,
} from "@/lib/order-shipments"

type EditableProduct = {
  id: string
  categoryId: string
  sku: string
  name: string
  description: string
  pricePer100g: string
  imagePath: string
  tagsCsv: string
  ingredientsCsv: string
  youtubeUrl: string
  inStock: boolean
}

type EditablePromoCode = {
  id: string
  code: string
  description: string
  discountType: PromoDiscountType
  discountValue: string
  isActive: boolean
}

type AdminPanelProps = {
  orders?: Order[]
  runtimeMode?: RuntimeMode
}

export function AdminPanel({ orders = [], runtimeMode = "prod" }: AdminPanelProps) {
  const adminWhatsappNumber = (import.meta.env.VITE_ADMIN_WHATSAPP_NUMBER as string | undefined)?.replace(/\D/g, "") || "917889480171"
  const adminAlertEmail = (import.meta.env.VITE_ADMIN_ALERT_EMAIL as string | undefined)?.trim() || "divang.s@gmail.com"
  const [products, setProducts] = useKV<Product[]>("products", [])
  const [categories, setCategories] = useKV<Category[]>("categories", [])
  const [editableProducts, setEditableProducts] = useState<EditableProduct[]>([])
  const [savingProductId, setSavingProductId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newProduct, setNewProduct] = useState<EditableProduct>({
    id: "",
    categoryId: "premium-masala",
    sku: "",
    name: "",
    description: "",
    pricePer100g: "",
    imagePath: "",
    tagsCsv: "",
    ingredientsCsv: "",
    youtubeUrl: "",
    inStock: true,
  })
  const [editablePromoCodes, setEditablePromoCodes] = useState<EditablePromoCode[]>([])
  const [savingPromoId, setSavingPromoId] = useState<string | null>(null)
  const [isCreatingPromo, setIsCreatingPromo] = useState(false)
  const [promoChannelState, setPromoChannelState] = useState<PromoCodeChannelState | null>(null)
  const [isSavingPromoChannel, setIsSavingPromoChannel] = useState(false)
  const [isPromotingPromoChannel, setIsPromotingPromoChannel] = useState(false)
  const [isRollingBackPromoChannel, setIsRollingBackPromoChannel] = useState(false)
  const [newPromoCode, setNewPromoCode] = useState<EditablePromoCode>({
    id: "",
    code: "",
    description: "",
    discountType: "percent",
    discountValue: "10",
    isActive: true,
  })
  const [upiAccounts, setUpiAccounts] = useState<AdminPaymentUpiAccount[]>([])
  const [switchingUpiId, setSwitchingUpiId] = useState<string | null>(null)
  const [togglingUpiId, setTogglingUpiId] = useState<string | null>(null)
  const [deliveryPartners, setDeliveryPartners] = useState<AdminDeliveryPartnerAccount[]>([])
  const [switchingDeliveryPartnerId, setSwitchingDeliveryPartnerId] = useState<string | null>(null)
  const [togglingDeliveryPartnerId, setTogglingDeliveryPartnerId] = useState<string | null>(null)
  const [featureFlagsState, setFeatureFlagsState] = useState<FeatureFlags | null>(null)
  const [isSavingShiprocketFlag, setIsSavingShiprocketFlag] = useState(false)
  const [shipmentLogs, setShipmentLogs] = useState<AdminOrderShipment[]>([])
  const [triggeringShipmentOrderId, setTriggeringShipmentOrderId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])

  const categoryOptions = useMemo(() => {
    if (categories && categories.length > 0) {
      return categories
    }

    return [{ id: "premium-masala", name: "Premium Masala", slug: "premium-masala", enabled: true }]
  }, [categories])

  useEffect(() => {
    setEditableProducts(
      (products || []).map((product) => ({
        id: product.id,
        categoryId: product.category,
        sku: product.sku ?? "",
        name: product.name,
        description: product.description,
        pricePer100g: String(product.price),
        imagePath: product.image,
        tagsCsv: product.tags.join(", "),
        ingredientsCsv: product.ingredients.join(", "),
        youtubeUrl: product.youtubeUrl ?? "",
        inStock: product.inStock,
      }))
    )
  }, [products])

  useEffect(() => {
    async function refreshCatalogForAdmin() {
      const snapshot = await loadCatalogFromSupabase()
      if (snapshot.source !== "supabase") {
        return
      }

      if (snapshot.categories.length > 0) {
        setCategories(snapshot.categories)
      }
      if (snapshot.products.length > 0) {
        setProducts(snapshot.products)
      }
    }

    refreshCatalogForAdmin()
  }, [setCategories, setProducts])

  useEffect(() => {
    async function refreshAdminNotifications() {
      const result = await fetchAdminNotifications(20)
      if (result.error) {
        console.warn("[admin] notifications load skipped", result.error)
        return
      }

      setNotifications(result.notifications)
    }

    refreshAdminNotifications()
  }, [])

  useEffect(() => {
    async function refreshPromoChannelState() {
      const result = await fetchPromoCodeChannelState()
      if (result.error) {
        console.warn("[admin] promo channel state load skipped", result.error)
      }

      setPromoChannelState(result.state)
    }

    refreshPromoChannelState()
  }, [])

  useEffect(() => {
    async function refreshPromoCodesForAdmin() {
      const result = await fetchActivePromoCodesForAdmin()
      if (result.error) {
        console.warn("[admin] promo code load skipped", result.error)
        return
      }

      setEditablePromoCodes(
        result.promoCodes.map((promo) => ({
          id: promo.id,
          code: promo.code,
          description: promo.description ?? "",
          discountType: promo.discountType,
          discountValue: String(promo.discountValue),
          isActive: promo.isActive,
        }))
      )
    }

    refreshPromoCodesForAdmin()
  }, [])

  useEffect(() => {
    async function refreshUpiAccountsForAdmin() {
      const result = await fetchPaymentUpiAccountsForAdmin()
      if (result.error) {
        console.warn("[admin] payment upi load skipped", result.error)
        return
      }

      setUpiAccounts(result.accounts)
    }

    refreshUpiAccountsForAdmin()
  }, [])

  useEffect(() => {
    async function refreshDeliveryPartnersForAdmin() {
      const result = await fetchDeliveryPartnerAccountsForAdmin()
      if (result.error) {
        console.warn("[admin] delivery partner load skipped", result.error)
        return
      }

      setDeliveryPartners(result.accounts)
    }

    refreshDeliveryPartnersForAdmin()
  }, [])

  useEffect(() => {
    async function refreshFeatureFlagsForAdmin() {
      const result = await fetchFeatureFlags()
      if (result.error) {
        console.warn("[admin] feature flags load skipped", result.error)
      }

      setFeatureFlagsState(result.flags)
    }

    refreshFeatureFlagsForAdmin()
  }, [])

  useEffect(() => {
    async function refreshShipmentLogsForAdmin() {
      const result = await fetchOrderShipmentsForAdmin(25)
      if (result.error) {
        console.warn("[admin] shipment logs load skipped", result.error)
        return
      }

      setShipmentLogs(result.shipments)
    }

    refreshShipmentLogsForAdmin()
  }, [])

  const updateEditableProduct = (productId: string, key: keyof EditableProduct, value: string | boolean) => {
    setEditableProducts((current) =>
      current.map((item) => (item.id === productId ? { ...item, [key]: value } : item))
    )
  }

  const buildAdminPayload = (input: EditableProduct): AdminProductInput | undefined => {
    const price = Number(input.pricePer100g)
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Price per 100g must be a valid non-negative number.")
      return undefined
    }

    if (!input.id.trim() || !input.name.trim() || !input.sku.trim() || !input.categoryId.trim()) {
      toast.error("ID, SKU, Name, and Category are required.")
      return undefined
    }

    return {
      id: input.id.trim(),
      categoryId: input.categoryId.trim(),
      sku: input.sku.trim(),
      name: input.name.trim(),
      description: input.description.trim(),
      pricePer100g: price,
      imagePath: input.imagePath.trim(),
      ingredients: input.ingredientsCsv.split(",").map((value) => value.trim()).filter(Boolean),
      tags: input.tagsCsv.split(",").map((value) => value.trim()).filter(Boolean),
      youtubeUrl: input.youtubeUrl.trim() || undefined,
      inStock: input.inStock,
      isActive: true,
    }
  }

  const buildPromoPayload = (input: EditablePromoCode) => {
    const discountValue = Number(input.discountValue)
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      toast.error("Promo discount value must be a positive number.")
      return undefined
    }

    const code = input.code.trim().toUpperCase()
    if (!code) {
      toast.error("Promo code is required.")
      return undefined
    }

    return {
      id: input.id || undefined,
      code,
      description: input.description.trim() || undefined,
      discountScope: "total" as PromoScope,
      discountType: input.discountType,
      discountValue,
      isActive: input.isActive,
    }
  }

  const updateEditablePromo = (promoId: string, key: keyof EditablePromoCode, value: string | boolean) => {
    setEditablePromoCodes((current) => current.map((promo) => (promo.id === promoId ? { ...promo, [key]: value } : promo)))
  }

  const buildWhatsappLink = (text: string) => {
    return `https://wa.me/${adminWhatsappNumber}?text=${encodeURIComponent(text)}`
  }

  const buildEmailLink = (subject: string, body: string) => {
    return `mailto:${encodeURIComponent(adminAlertEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const buildNotificationMessageText = (notification: AdminNotification) => {
    const payload = notification.payload ?? {}

    if (notification.eventType === "new_user") {
      return [
        "New user signup alert",
        `Name: ${String(payload.fullName ?? "Unknown")}`,
        `Email: ${String(payload.email ?? "Unknown")}`,
        `Phone: ${String(payload.phone ?? "Unknown")}`,
        `Created At: ${new Date(notification.createdAt).toLocaleString()}`,
      ].join("\n")
    }

    const items = Array.isArray(payload.items) ? payload.items : []
    const lines = items.map((item) => {
      const productName = String((item as { productName?: unknown }).productName ?? "Item")
      const quantity = Number((item as { quantity?: unknown }).quantity ?? 0)
      const grams = Number((item as { grams?: unknown }).grams ?? 0)
      return `- ${productName}: ${quantity} x ${grams}g`
    })

    return [
      "New order alert",
      `Order ID: ${String(payload.orderId ?? "Unknown")}`,
      `Customer: ${String(payload.customerName ?? "Unknown")}`,
      `Email: ${String(payload.customerEmail ?? "Unknown")}`,
      `Phone: ${String(payload.customerPhone ?? "Unknown")}`,
      `Total: Rs${String(payload.totalAmount ?? "0")}`,
      "Items:",
      ...(lines.length > 0 ? lines : ["- No items found"]),
      `Created At: ${new Date(notification.createdAt).toLocaleString()}`,
    ].join("\n")
  }

  const handleSendNotificationWhatsapp = async (notification: AdminNotification) => {
    const text = buildNotificationMessageText(notification)
    window.open(buildWhatsappLink(text), "_blank", "noopener,noreferrer")
    const result = await markAdminNotificationWhatsappSent(notification.id)
    if (!result.success && result.error) {
      toast.error(result.error)
      return
    }

    setNotifications((current) => current.map((entry) => entry.id === notification.id ? { ...entry, whatsappSentAt: new Date().toISOString() } : entry))
  }

  const handleSendNotificationEmail = async (notification: AdminNotification) => {
    const subject = notification.eventType === "new_user" ? "New user signup" : "New order placed"
    const body = buildNotificationMessageText(notification)
    window.open(buildEmailLink(subject, body), "_blank", "noopener,noreferrer")
    const result = await markAdminNotificationEmailSent(notification.id)
    if (!result.success && result.error) {
      toast.error(result.error)
      return
    }

    setNotifications((current) => current.map((entry) => entry.id === notification.id ? { ...entry, emailSentAt: new Date().toISOString() } : entry))
  }

  const handleSetPromoChannelDevEnabled = async (enabled: boolean) => {
    setIsSavingPromoChannel(true)
    const result = await setPromoCodeDevEnabledByAdmin(enabled)
    setIsSavingPromoChannel(false)

    if (!result.state || result.error) {
      toast.error(result.error ?? "Failed to update dev promo channel state.")
      return
    }

    setPromoChannelState(result.state)
    toast.success(`Promo codes ${enabled ? "enabled" : "disabled"} for dev mode.`)
  }

  const handlePromotePromoDevToProd = async () => {
    setIsPromotingPromoChannel(true)
    const result = await promotePromoCodeDevToProdByAdmin()
    setIsPromotingPromoChannel(false)

    if (!result.state || result.error) {
      toast.error(result.error ?? "Failed to promote dev promo state to prod.")
      return
    }

    setPromoChannelState(result.state)
    toast.success("Promoted promo channel dev state to production.")
  }

  const handleRollbackPromoProd = async () => {
    setIsRollingBackPromoChannel(true)
    const result = await rollbackPromoCodeProdByAdmin()
    setIsRollingBackPromoChannel(false)

    if (!result.state || result.error) {
      toast.error(result.error ?? "Failed to rollback promo channel production state.")
      return
    }

    setPromoChannelState(result.state)
    toast.success("Rolled back promo channel production state.")
  }

  const handleSavePromoCode = async (promoId: string) => {
    const editable = editablePromoCodes.find((promo) => promo.id === promoId)
    if (!editable) {
      return
    }

    const payload = buildPromoPayload(editable)
    if (!payload) {
      return
    }

    setSavingPromoId(promoId)
    const { promoCode, error } = await upsertPromoCodeByAdmin(payload)
    setSavingPromoId(null)

    if (error) {
      toast.error(error)
      return
    }

    const savedPromo = promoCode
    if (!savedPromo) {
      toast.error("Failed to save promo code.")
      return
    }

    const savedPromoCode = savedPromo.code

    setEditablePromoCodes((current) =>
      current.map((promo) =>
        promo.id === promoId
          ? {
              ...promo,
              code: savedPromoCode,
            }
          : promo
      )
    )
    toast.success(`Promo code ${savedPromoCode} saved.`)
  }

  const handleCreatePromoCode = async () => {
    const payload = buildPromoPayload(newPromoCode)
    if (!payload) {
      return
    }

    setIsCreatingPromo(true)
    const { promoCode, error } = await upsertPromoCodeByAdmin(payload)
    setIsCreatingPromo(false)

    if (error) {
      toast.error(error)
      return
    }

    const createdPromo = promoCode
    if (!createdPromo) {
      toast.error("Failed to create promo code.")
      return
    }

    const createdPromoId = createdPromo.id
    const createdPromoCode = createdPromo.code
    const createdPromoDescription = createdPromo.description ?? ""
    const createdPromoDiscountType = createdPromo.discountType
    const createdPromoDiscountValue = String(createdPromo.discountValue)
    const createdPromoActive = createdPromo.isActive

    setEditablePromoCodes((current) => [
      {
        id: createdPromoId,
        code: createdPromoCode,
        description: createdPromoDescription,
        discountType: createdPromoDiscountType,
        discountValue: createdPromoDiscountValue,
        isActive: createdPromoActive,
      },
      ...current,
    ])

    setNewPromoCode({
      id: "",
      code: "",
      description: "",
      discountType: "percent",
      discountValue: "10",
      isActive: true,
    })

    toast.success(`Promo code ${createdPromoCode} created.`)
  }

  const handleGenerateOneTimePromoToken = () => {
    setNewPromoCode((current) => ({
      ...current,
      code: generatePromoCodeToken("SDA", 8),
      description: current.description.trim() || "Open promo code",
      discountType: "percent",
      discountValue: current.discountValue.trim() || "10",
      isActive: true,
    }))

    toast.success("Promo token generated. Review and click Create Promo Code.")
  }

  const handleSaveProduct = async (productId: string) => {
    if (!isSupabaseConfigured) {
      toast.error("Supabase auth is not configured.")
      return
    }

    const editable = editableProducts.find((item) => item.id === productId)
    if (!editable) {
      return
    }

    const payload = buildAdminPayload(editable)
    if (!payload) {
      return
    }

    setSavingProductId(productId)
    const result = await updateProductByAdmin(payload)
    setSavingProductId(null)

    if (!result.product || result.error) {
      toast.error(result.error ?? "Failed to save product.")
      return
    }

    setProducts((current = []) => current.map((item) => (item.id === result.product?.id ? result.product : item)))
    toast.success("Product updated successfully.")
  }

  const handleSetPrimaryUpi = async (accountId: string) => {
    setSwitchingUpiId(accountId)
    const result = await setPrimaryPaymentUpiAccount(accountId)
    setSwitchingUpiId(null)

    if (!result.success) {
      toast.error(result.error ?? "Failed to switch primary UPI account.")
      return
    }

    const refreshed = await fetchPaymentUpiAccountsForAdmin()
    if (refreshed.error) {
      toast.error(refreshed.error)
      return
    }

    setUpiAccounts(refreshed.accounts)
    toast.success("Primary UPI account updated.")
  }

  const handleToggleUpiEnabled = async (accountId: string, enabled: boolean) => {
    const currentlyEnabledCount = upiAccounts.filter((account) => account.enabled).length
    if (!enabled && currentlyEnabledCount <= 1) {
      toast.error("At least one UPI account must remain enabled.")
      return
    }

    setTogglingUpiId(accountId)
    const result = await setPaymentUpiAccountEnabled(accountId, enabled)
    setTogglingUpiId(null)

    if (!result.success) {
      toast.error(result.error ?? "Failed to update UPI account status.")
      return
    }

    const refreshed = await fetchPaymentUpiAccountsForAdmin()
    if (refreshed.error) {
      toast.error(refreshed.error)
      return
    }

    setUpiAccounts(refreshed.accounts)
    toast.success(`UPI account ${enabled ? "enabled" : "disabled"}.`)
  }

  const handleSetPrimaryDeliveryPartner = async (accountId: string) => {
    setSwitchingDeliveryPartnerId(accountId)
    const result = await setPrimaryDeliveryPartnerAccount(accountId)
    setSwitchingDeliveryPartnerId(null)

    if (!result.success) {
      toast.error(result.error ?? "Failed to switch primary delivery partner.")
      return
    }

    const refreshed = await fetchDeliveryPartnerAccountsForAdmin()
    if (refreshed.error) {
      toast.error(refreshed.error)
      return
    }

    setDeliveryPartners(refreshed.accounts)
    toast.success("Primary delivery partner updated.")
  }

  const handleToggleDeliveryPartnerEnabled = async (accountId: string, enabled: boolean) => {
    const currentlyEnabledCount = deliveryPartners.filter((account) => account.enabled).length
    if (!enabled && currentlyEnabledCount <= 1) {
      toast.error("At least one delivery partner must remain enabled.")
      return
    }

    setTogglingDeliveryPartnerId(accountId)
    const result = await setDeliveryPartnerEnabled(accountId, enabled)
    setTogglingDeliveryPartnerId(null)

    if (!result.success) {
      toast.error(result.error ?? "Failed to update delivery partner status.")
      return
    }

    const refreshed = await fetchDeliveryPartnerAccountsForAdmin()
    if (refreshed.error) {
      toast.error(refreshed.error)
      return
    }

    setDeliveryPartners(refreshed.accounts)
    toast.success(`Delivery partner ${enabled ? "enabled" : "disabled"}.`)
  }

  const handleSetShiprocketFeatureEnabled = async (enabled: boolean) => {
    setIsSavingShiprocketFlag(true)
    const result = await setFeatureFlagEnabledByAdmin("enable_shiprocket_integration", enabled)
    setIsSavingShiprocketFlag(false)

    if (!result.success) {
      toast.error(result.error ?? "Failed to update Shiprocket feature flag.")
      return
    }

    setFeatureFlagsState((current) => ({
      ...(current ?? {
        enableSocialExperimentSection: false,
        enableSocialIcons: false,
        enableRestaurantToHomeReels: false,
        enableChefSampleCta: false,
        enableShiprocketIntegration: false,
      }),
      enableShiprocketIntegration: enabled,
    }))

    toast.success(`Shiprocket integration ${enabled ? "enabled" : "disabled"} for paid-order shipment flow.`)
  }

  const refreshShipmentLogs = async () => {
    const result = await fetchOrderShipmentsForAdmin(25)
    if (result.error) {
      toast.error(result.error)
      return
    }

    setShipmentLogs(result.shipments)
  }

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

  const handleCreateProduct = async () => {
    if (!isSupabaseConfigured) {
      toast.error("Supabase auth is not configured.")
      return
    }

    const payload = buildAdminPayload(newProduct)
    if (!payload) {
      return
    }

    setIsCreating(true)
    const result = await createProductByAdmin(payload)
    setIsCreating(false)

    if (!result.product || result.error) {
      toast.error(result.error ?? "Failed to create product.")
      return
    }

    setProducts((current = []) => [result.product as Product, ...current])
    setNewProduct({
      id: "",
      categoryId: categoryOptions[0]?.id ?? "premium-masala",
      sku: "",
      name: "",
      description: "",
      pricePer100g: "",
      imagePath: "",
      tagsCsv: "",
      ingredientsCsv: "",
      youtubeUrl: "",
      inStock: true,
    })
    toast.success("Product created successfully.")
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Notifications</CardTitle>
          <CardDescription>New user signups and new orders appear here with quick WhatsApp and email actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const payload = notification.payload ?? {}
                const orderItems = notification.eventType === "new_order" && Array.isArray(payload.items)
                  ? payload.items as Array<{ productName?: string; quantity?: number; grams?: number }>
                  : []

                return (
                  <div key={notification.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{notification.title}</p>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={notification.eventType === "new_order" ? "default" : "secondary"}>
                          {notification.eventType === "new_order" ? "New Order" : "New User"}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(notification.createdAt).toLocaleString()}</p>
                      </div>
                    </div>

                    {notification.eventType === "new_order" && orderItems.length > 0 && (
                      <div className="rounded-md bg-muted/40 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Products Purchased</p>
                        <ul className="mt-2 space-y-1">
                          {orderItems.map((item, index) => (
                            <li key={`${notification.id}-item-${index}`} className="text-sm">
                              {item.productName ?? "Item"} - {item.quantity ?? 0} x {item.grams ?? 0}g
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleSendNotificationWhatsapp(notification)}>
                        Send WhatsApp
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleSendNotificationEmail(notification)}>
                        Send Email
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        WhatsApp: {notification.whatsappSentAt ? "Sent" : "Not Sent"} | Email: {notification.emailSentAt ? "Sent" : "Not Sent"}
                      </span>
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
          <CardTitle>Payment UPI Switch</CardTitle>
          <CardDescription>Choose which UPI account is primary for new payment QR and links.</CardDescription>
        </CardHeader>
        <CardContent>
          {upiAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No UPI accounts found yet. Run SQL migration 012 first.</p>
          ) : (
            <div className="space-y-3">
              {upiAccounts.map((account, index) => {
                const isPrimary = account.enabled && index === 0
                const isSwitching = switchingUpiId === account.id

                return (
                  <div key={account.id} className="rounded-lg border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{account.displayName}</p>
                        {isPrimary && <Badge>Primary</Badge>}
                        {!account.enabled && <Badge variant="outline">Disabled</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{account.upiId}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={account.enabled}
                          onCheckedChange={(checked) => handleToggleUpiEnabled(account.id, checked)}
                          disabled={togglingUpiId === account.id}
                        />
                        <span className="text-sm">Enabled</span>
                      </div>
                      <Button
                        size="sm"
                        variant={isPrimary ? "secondary" : "default"}
                        onClick={() => handleSetPrimaryUpi(account.id)}
                        disabled={isPrimary || isSwitching || !account.enabled}
                      >
                        {isPrimary ? "Current Primary" : isSwitching ? "Switching..." : "Make Primary"}
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
          <CardTitle>Delivery Partner Switch</CardTitle>
          <CardDescription>Switch the active courier provider without changing the rest of the order flow.</CardDescription>
        </CardHeader>
        <CardContent>
          {deliveryPartners.length === 0 ? (
            <p className="text-sm text-muted-foreground">No delivery partners found yet. Run SQL migration 020 first.</p>
          ) : (
            <div className="space-y-3">
              {deliveryPartners.map((partner, index) => {
                const isPrimary = partner.enabled && index === 0
                const isSwitching = switchingDeliveryPartnerId === partner.id

                return (
                  <div key={partner.id} className="rounded-lg border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{partner.displayName}</p>
                        <Badge variant="outline" className="uppercase">{partner.providerKey}</Badge>
                        {isPrimary && <Badge>Primary</Badge>}
                        {!partner.enabled && <Badge variant="outline">Disabled</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">Ready to plug in partner-specific pickup, AWB, and tracking APIs.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={partner.enabled}
                          onCheckedChange={(checked) => handleToggleDeliveryPartnerEnabled(partner.id, checked)}
                          disabled={togglingDeliveryPartnerId === partner.id}
                        />
                        <span className="text-sm">Enabled</span>
                      </div>
                      <Button
                        size="sm"
                        variant={isPrimary ? "secondary" : "default"}
                        onClick={() => handleSetPrimaryDeliveryPartner(partner.id)}
                        disabled={isPrimary || isSwitching || !partner.enabled}
                      >
                        {isPrimary ? "Current Primary" : isSwitching ? "Switching..." : "Make Primary"}
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
          <CardTitle>Shipping Feature Flag</CardTitle>
          <CardDescription>Keep this OFF in production until Shiprocket E2E is validated.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Enable Shiprocket Integration</p>
              <p className="text-sm text-muted-foreground">
                When enabled, paid orders will attempt shipment creation for the active partner if it is Shiprocket.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={Boolean(featureFlagsState?.enableShiprocketIntegration)}
                onCheckedChange={handleSetShiprocketFeatureEnabled}
                disabled={isSavingShiprocketFlag}
              />
              <span className="text-sm">{featureFlagsState?.enableShiprocketIntegration ? "ON" : "OFF"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipment Operations</CardTitle>
          <CardDescription>Trigger shipment for paid orders and monitor latest shipment attempts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders loaded yet.</p>
            ) : (
              orders.slice(0, 8).map((order) => {
                const isTriggering = triggeringShipmentOrderId === order.id
                const canTrigger = order.paymentStatus === "paid"

                return (
                  <div key={`ship-trigger-${order.id}`} className="rounded-lg border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">Order #{order.id}</p>
                      <p className="text-xs text-muted-foreground">Payment: {order.paymentStatus} | Status: {order.status}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleTriggerShipmentForOrder(order.id)}
                      disabled={!canTrigger || isTriggering}
                    >
                      {!canTrigger
                        ? "Awaiting Payment"
                        : isTriggering
                          ? "Triggering..."
                          : "Trigger Shipment"}
                    </Button>
                  </div>
                )
              })
            )}
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Recent Shipment Logs</p>
              <Button size="sm" variant="outline" onClick={refreshShipmentLogs}>Refresh</Button>
            </div>

            {shipmentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shipment attempts logged yet.</p>
            ) : (
              <div className="space-y-2">
                {shipmentLogs.map((shipment) => (
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
                    {shipment.externalStatus && (
                      <p className="mt-1 text-muted-foreground">
                        Carrier Status: {shipment.externalStatus}
                        {shipment.externalEventAt ? ` | Event At: ${new Date(shipment.externalEventAt).toLocaleString()}` : ""}
                      </p>
                    )}
                    {shipment.errorMessage && (
                      <p className="mt-1 text-red-700">{shipment.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promo Channel Controls</CardTitle>
          <CardDescription>Control promo-code visibility by channel, then promote dev state to production or rollback.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={runtimeMode === "dev" ? "destructive" : "secondary"}>
                Active Channel: {runtimeMode.toUpperCase()}
              </Badge>
              <Badge variant={promoChannelState?.devEnabled ? "default" : "outline"}>
                Dev Promo: {promoChannelState?.devEnabled ? "Enabled" : "Disabled"}
              </Badge>
              <Badge variant={promoChannelState?.prodEnabled ? "default" : "outline"}>
                Prod Promo: {promoChannelState?.prodEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={Boolean(promoChannelState?.devEnabled)}
                  onCheckedChange={handleSetPromoChannelDevEnabled}
                  disabled={isSavingPromoChannel || isPromotingPromoChannel || isRollingBackPromoChannel}
                />
                <span className="text-sm">Enable promo in dev</span>
              </div>

              <Button
                size="sm"
                onClick={handlePromotePromoDevToProd}
                disabled={!promoChannelState || isPromotingPromoChannel || isSavingPromoChannel || isRollingBackPromoChannel}
              >
                {isPromotingPromoChannel ? "Promoting..." : "Promote Dev -> Prod"}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleRollbackPromoProd}
                disabled={!promoChannelState || promoChannelState.previousProdEnabled == null || isRollingBackPromoChannel || isSavingPromoChannel || isPromotingPromoChannel}
              >
                {isRollingBackPromoChannel ? "Rolling back..." : "Rollback Prod"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promo Code Management</CardTitle>
          <CardDescription>Create simple amount or percentage promo codes and manage enable or disable status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4 space-y-4">
            <p className="text-sm font-medium">Create Promo Code</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label>Code</Label>
                <Input value={newPromoCode.code} onChange={(event) => setNewPromoCode((c) => ({ ...c, code: event.target.value.toUpperCase() }))} placeholder="SDAJUNE26" />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={newPromoCode.description} onChange={(event) => setNewPromoCode((c) => ({ ...c, description: event.target.value }))} placeholder="June shipping promo" />
              </div>
              <div>
                <Label>Discount Value</Label>
                <Input type="number" value={newPromoCode.discountValue} onChange={(event) => setNewPromoCode((c) => ({ ...c, discountValue: event.target.value }))} placeholder="100" />
              </div>
              <div>
                <Label>Type</Label>
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={newPromoCode.discountType} onChange={(event) => setNewPromoCode((c) => ({ ...c, discountType: event.target.value as PromoDiscountType }))}>
                  <option value="fixed">Fixed Amount</option>
                  <option value="percent">Percentage</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={newPromoCode.isActive} onCheckedChange={(checked) => setNewPromoCode((c) => ({ ...c, isActive: checked }))} />
              <span className="text-sm">Active</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={handleGenerateOneTimePromoToken}>
                Generate One-Time Token
              </Button>
              <Button onClick={handleCreatePromoCode} disabled={isCreatingPromo}>{isCreatingPromo ? "Creating..." : "Create Promo Code"}</Button>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium">Available Promo Codes</p>
            {editablePromoCodes.length === 0 && (
              <p className="text-sm text-muted-foreground">No promo codes found yet. Create one above.</p>
            )}
            {editablePromoCodes.map((promo) => {
              const isSavingPromo = savingPromoId === promo.id

              return (
                <div key={promo.id} className="rounded-lg border p-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <Label>Code</Label>
                      <Input value={promo.code} onChange={(event) => updateEditablePromo(promo.id, "code", event.target.value.toUpperCase())} />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input value={promo.description} onChange={(event) => updateEditablePromo(promo.id, "description", event.target.value)} />
                    </div>
                    <div>
                      <Label>Discount Value</Label>
                      <Input type="number" value={promo.discountValue} onChange={(event) => updateEditablePromo(promo.id, "discountValue", event.target.value)} />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={promo.discountType} onChange={(event) => updateEditablePromo(promo.id, "discountType", event.target.value as PromoDiscountType)}>
                        <option value="fixed">Fixed Amount</option>
                        <option value="percent">Percentage</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Switch checked={promo.isActive} onCheckedChange={(checked) => updateEditablePromo(promo.id, "isActive", checked)} />
                    <span className="text-sm">Enabled</span>
                    <Button size="sm" onClick={() => handleSavePromoCode(promo.id)} disabled={isSavingPromo}>{isSavingPromo ? "Saving..." : "Save Promo"}</Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>
            Admin accounts can review every customer order from one place.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders available yet.</p>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 10).map((order) => (
                <div key={order.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">#{order.id}</p>
                      <p className="text-sm text-muted-foreground">{order.customer.name} • {order.customer.email}</p>
                      <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ordered Products</p>
                        <ul className="mt-1 space-y-1">
                          {order.items.map((item) => (
                            <li key={`${order.id}-${item.productId}-${item.grams}`} className="flex items-center justify-between gap-3 text-sm text-foreground">
                              <span>{item.productName} - {item.quantity} x {item.grams}g</span>
                              <span className="font-medium">₹{(item.pricePerUnit * (item.grams / 100) * item.quantity).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">₹{order.totalAmount.toFixed(2)}</p>
                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        <Badge variant="secondary" className="capitalize">{order.status}</Badge>
                        <Badge variant={order.paymentStatus === "paid" ? "default" : "outline"} className="capitalize">
                          {order.paymentStatus}
                        </Badge>
                      </div>
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
          <CardTitle>Create Product</CardTitle>
          <CardDescription>Add a new catalog item directly in Supabase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Product ID</Label>
              <Input value={newProduct.id} onChange={(event) => setNewProduct((c) => ({ ...c, id: event.target.value }))} placeholder="chat-masala-premium" />
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={newProduct.sku} onChange={(event) => setNewProduct((c) => ({ ...c, sku: event.target.value }))} placeholder="PM-CHAT-001" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={newProduct.name} onChange={(event) => setNewProduct((c) => ({ ...c, name: event.target.value }))} placeholder="Chat Masala Premium" />
            </div>
            <div>
              <Label>Category ID</Label>
              <Input value={newProduct.categoryId} onChange={(event) => setNewProduct((c) => ({ ...c, categoryId: event.target.value }))} placeholder="premium-masala" />
            </div>
            <div>
              <Label>Price Per 100g</Label>
              <Input type="number" value={newProduct.pricePer100g} onChange={(event) => setNewProduct((c) => ({ ...c, pricePer100g: event.target.value }))} placeholder="350" />
            </div>
            <div>
              <Label>Image Path</Label>
              <Input value={newProduct.imagePath} onChange={(event) => setNewProduct((c) => ({ ...c, imagePath: event.target.value }))} placeholder="images/products/chat-masala-premium.png" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={newProduct.description} onChange={(event) => setNewProduct((c) => ({ ...c, description: event.target.value }))} rows={3} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input value={newProduct.tagsCsv} onChange={(event) => setNewProduct((c) => ({ ...c, tagsCsv: event.target.value }))} placeholder="premium, aromatic" />
            </div>
            <div>
              <Label>Ingredients (comma-separated)</Label>
              <Input value={newProduct.ingredientsCsv} onChange={(event) => setNewProduct((c) => ({ ...c, ingredientsCsv: event.target.value }))} placeholder="Cumin Seeds, Black Pepper" />
            </div>
          </div>
          <div>
            <Label>YouTube URL (optional)</Label>
            <Input value={newProduct.youtubeUrl} onChange={(event) => setNewProduct((c) => ({ ...c, youtubeUrl: event.target.value }))} placeholder="https://youtu.be/..." />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={newProduct.inStock} onCheckedChange={(checked) => setNewProduct((c) => ({ ...c, inStock: checked }))} />
            <span className="text-sm">In stock</span>
          </div>
          <Button onClick={handleCreateProduct} disabled={isCreating}>{isCreating ? "Creating..." : "Create Product"}</Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-3xl font-bold mb-2">Catalog Management</h2>
        <p className="text-muted-foreground">Edit product fields and persist updates to Supabase.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {editableProducts.map((product) => {
          const isSaving = savingProductId === product.id
          const categoryName = categoryOptions.find((item) => item.id === product.categoryId)?.name ?? product.categoryId

          return (
            <Card key={product.id}>
              <CardHeader>
                <CardTitle className="text-lg">{product.name || product.id}</CardTitle>
                <CardDescription>{categoryName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={product.name} onChange={(event) => updateEditableProduct(product.id, "name", event.target.value)} />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input value={product.sku} onChange={(event) => updateEditableProduct(product.id, "sku", event.target.value)} />
                </div>
                <div>
                  <Label>Category ID</Label>
                  <Input value={product.categoryId} onChange={(event) => updateEditableProduct(product.id, "categoryId", event.target.value)} />
                </div>
                <div>
                  <Label>Price Per 100g</Label>
                  <Input type="number" value={product.pricePer100g} onChange={(event) => updateEditableProduct(product.id, "pricePer100g", event.target.value)} />
                </div>
                <div>
                  <Label>Image Path</Label>
                  <Input value={product.imagePath} onChange={(event) => updateEditableProduct(product.id, "imagePath", event.target.value)} />
                </div>
                <div>
                  <Label>Tags (comma-separated)</Label>
                  <Input value={product.tagsCsv} onChange={(event) => updateEditableProduct(product.id, "tagsCsv", event.target.value)} />
                </div>
                <div>
                  <Label>Ingredients (comma-separated)</Label>
                  <Input value={product.ingredientsCsv} onChange={(event) => updateEditableProduct(product.id, "ingredientsCsv", event.target.value)} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={product.description} onChange={(event) => updateEditableProduct(product.id, "description", event.target.value)} rows={3} />
                </div>
                <div>
                  <Label>YouTube URL</Label>
                  <Input value={product.youtubeUrl} onChange={(event) => updateEditableProduct(product.id, "youtubeUrl", event.target.value)} />
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={product.inStock} onCheckedChange={(checked) => updateEditableProduct(product.id, "inStock", checked)} />
                  <span className="text-sm">In stock</span>
                </div>
                <Button onClick={() => handleSaveProduct(product.id)} disabled={isSaving}>{isSaving ? "Saving..." : "Save Product"}</Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {(products || []).length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No products found. Please add products first.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
