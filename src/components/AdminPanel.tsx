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
import {
  fetchPaymentUpiAccountsForAdmin,
  setPaymentUpiAccountEnabled,
  setPrimaryPaymentUpiAccount,
  type AdminPaymentUpiAccount,
} from "@/lib/payment-upi"

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
  discountScope: PromoScope
  discountType: PromoDiscountType
  discountValue: string
  maxDiscountAmount: string
  minOrderAmount: string
  usageLimit: string
  validFrom: string
  validUntil: string
  isActive: boolean
  usageCount: number
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
    discountScope: "total",
    discountType: "percent",
    discountValue: "10",
    maxDiscountAmount: "",
    minOrderAmount: "0",
    usageLimit: "1",
    validFrom: "",
    validUntil: "",
    isActive: true,
    usageCount: 0,
  })
  const [upiAccounts, setUpiAccounts] = useState<AdminPaymentUpiAccount[]>([])
  const [switchingUpiId, setSwitchingUpiId] = useState<string | null>(null)
  const [togglingUpiId, setTogglingUpiId] = useState<string | null>(null)
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
          discountScope: promo.discountScope,
          discountType: promo.discountType,
          discountValue: String(promo.discountValue),
          maxDiscountAmount: promo.maxDiscountAmount != null ? String(promo.maxDiscountAmount) : "",
          minOrderAmount: promo.minOrderAmount != null ? String(promo.minOrderAmount) : "",
          usageLimit: promo.usageLimit != null ? String(promo.usageLimit) : "",
          validFrom: promo.validFrom ? promo.validFrom.slice(0, 10) : "",
          validUntil: promo.validUntil ? promo.validUntil.slice(0, 10) : "",
          isActive: promo.isActive,
          usageCount: promo.usageCount,
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

    const maxDiscountAmount = input.maxDiscountAmount.trim() ? Number(input.maxDiscountAmount) : undefined
    const minOrderAmount = input.minOrderAmount.trim() ? Number(input.minOrderAmount) : undefined
    const usageLimit = input.usageLimit.trim() ? Number(input.usageLimit) : undefined

    if (maxDiscountAmount != null && (!Number.isFinite(maxDiscountAmount) || maxDiscountAmount < 0)) {
      toast.error("Max discount must be a valid non-negative number.")
      return undefined
    }

    if (minOrderAmount != null && (!Number.isFinite(minOrderAmount) || minOrderAmount < 0)) {
      toast.error("Minimum order must be a valid non-negative number.")
      return undefined
    }

    if (usageLimit != null && (!Number.isFinite(usageLimit) || usageLimit < 1)) {
      toast.error("Usage limit must be at least 1.")
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
      discountScope: input.discountScope,
      discountType: input.discountType,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      usageLimit,
      validFrom: input.validFrom ? `${input.validFrom}T00:00:00.000Z` : undefined,
      validUntil: input.validUntil ? `${input.validUntil}T23:59:59.999Z` : undefined,
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
    const result = await upsertPromoCodeByAdmin(payload)
    setSavingPromoId(null)

    if (!result.promoCode || result.error) {
      toast.error(result.error ?? "Failed to save promo code.")
      return
    }

    setEditablePromoCodes((current) =>
      current.map((promo) =>
        promo.id === promoId
          ? {
              ...promo,
              code: result.promoCode?.code ?? promo.code,
            }
          : promo
      )
    )
    toast.success(`Promo code ${result.promoCode.code} saved.`)
  }

  const handleCreatePromoCode = async () => {
    const payload = buildPromoPayload(newPromoCode)
    if (!payload) {
      return
    }

    setIsCreatingPromo(true)
    const result = await upsertPromoCodeByAdmin(payload)
    setIsCreatingPromo(false)

    if (!result.promoCode || result.error) {
      toast.error(result.error ?? "Failed to create promo code.")
      return
    }

    setEditablePromoCodes((current) => [
      {
        id: result.promoCode.id,
        code: result.promoCode.code,
        description: result.promoCode.description ?? "",
        discountScope: result.promoCode.discountScope,
        discountType: result.promoCode.discountType,
        discountValue: String(result.promoCode.discountValue),
        maxDiscountAmount: result.promoCode.maxDiscountAmount != null ? String(result.promoCode.maxDiscountAmount) : "",
        minOrderAmount: result.promoCode.minOrderAmount != null ? String(result.promoCode.minOrderAmount) : "",
        usageLimit: result.promoCode.usageLimit != null ? String(result.promoCode.usageLimit) : "",
        validFrom: result.promoCode.validFrom ? result.promoCode.validFrom.slice(0, 10) : "",
        validUntil: result.promoCode.validUntil ? result.promoCode.validUntil.slice(0, 10) : "",
        isActive: result.promoCode.isActive,
        usageCount: result.promoCode.usageCount,
      },
      ...current,
    ])

    setNewPromoCode({
      id: "",
      code: "",
      description: "",
      discountScope: "shipping",
      discountType: "fixed",
      discountValue: "",
      maxDiscountAmount: "",
      minOrderAmount: "",
      usageLimit: "",
      validFrom: "",
      validUntil: "",
      isActive: true,
      usageCount: 0,
    })

    toast.success(`Promo code ${result.promoCode.code} created.`)
  }

  const handleGenerateOneTimePromoToken = () => {
    const now = new Date()
    const validFrom = now.toISOString().slice(0, 10)
    const validUntilDate = new Date(now)
    validUntilDate.setDate(validUntilDate.getDate() + 7)
    const validUntil = validUntilDate.toISOString().slice(0, 10)

    setNewPromoCode((current) => ({
      ...current,
      code: generatePromoCodeToken("SDA", 8),
      description: current.description.trim() || "Single-use promo token",
      discountType: "percent",
      discountScope: current.discountScope || "total",
      discountValue: current.discountValue.trim() || "10",
      usageLimit: "1",
      validFrom: current.validFrom || validFrom,
      validUntil: current.validUntil || validUntil,
      isActive: true,
    }))

    toast.success("Single-use token generated. Review and click Create Promo Code.")
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
          <CardDescription>Create and update discount codes for checkout. Example: SDAJUNE26 can be configured for shipping discounts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4 space-y-4">
            <p className="text-sm font-medium">Create Promo Code</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                <Label>Scope</Label>
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={newPromoCode.discountScope} onChange={(event) => setNewPromoCode((c) => ({ ...c, discountScope: event.target.value as PromoScope }))}>
                  <option value="shipping">Shipping</option>
                  <option value="subtotal">Subtotal</option>
                  <option value="total">Total</option>
                </select>
              </div>
              <div>
                <Label>Type</Label>
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={newPromoCode.discountType} onChange={(event) => setNewPromoCode((c) => ({ ...c, discountType: event.target.value as PromoDiscountType }))}>
                  <option value="fixed">Fixed Amount</option>
                  <option value="percent">Percentage</option>
                </select>
              </div>
              <div>
                <Label>Max Discount (optional)</Label>
                <Input type="number" value={newPromoCode.maxDiscountAmount} onChange={(event) => setNewPromoCode((c) => ({ ...c, maxDiscountAmount: event.target.value }))} placeholder="120" />
              </div>
              <div>
                <Label>Min Order (optional)</Label>
                <Input type="number" value={newPromoCode.minOrderAmount} onChange={(event) => setNewPromoCode((c) => ({ ...c, minOrderAmount: event.target.value }))} placeholder="500" />
              </div>
              <div>
                <Label>Usage Limit (optional)</Label>
                <Input type="number" value={newPromoCode.usageLimit} onChange={(event) => setNewPromoCode((c) => ({ ...c, usageLimit: event.target.value }))} placeholder="1" />
              </div>
              <div>
                <Label>Valid From (optional)</Label>
                <Input type="date" value={newPromoCode.validFrom} onChange={(event) => setNewPromoCode((c) => ({ ...c, validFrom: event.target.value }))} />
              </div>
              <div>
                <Label>Valid Until (optional)</Label>
                <Input type="date" value={newPromoCode.validUntil} onChange={(event) => setNewPromoCode((c) => ({ ...c, validUntil: event.target.value }))} />
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
            {editablePromoCodes.length === 0 && (
              <p className="text-sm text-muted-foreground">No promo codes found yet. Create one above.</p>
            )}
            {editablePromoCodes.map((promo) => {
              const isSavingPromo = savingPromoId === promo.id
              const usageLabel = promo.usageLimit
                ? `${promo.usageCount}/${promo.usageLimit}`
                : `${promo.usageCount}`

              return (
                <div key={promo.id} className="rounded-lg border p-4 space-y-4">
                  <div className="text-xs text-muted-foreground">
                    Usage: {usageLabel}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                      <Label>Scope</Label>
                      <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={promo.discountScope} onChange={(event) => updateEditablePromo(promo.id, "discountScope", event.target.value as PromoScope)}>
                        <option value="shipping">Shipping</option>
                        <option value="subtotal">Subtotal</option>
                        <option value="total">Total</option>
                      </select>
                    </div>
                    <div>
                      <Label>Type</Label>
                      <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={promo.discountType} onChange={(event) => updateEditablePromo(promo.id, "discountType", event.target.value as PromoDiscountType)}>
                        <option value="fixed">Fixed Amount</option>
                        <option value="percent">Percentage</option>
                      </select>
                    </div>
                    <div>
                      <Label>Max Discount</Label>
                      <Input type="number" value={promo.maxDiscountAmount} onChange={(event) => updateEditablePromo(promo.id, "maxDiscountAmount", event.target.value)} />
                    </div>
                    <div>
                      <Label>Min Order</Label>
                      <Input type="number" value={promo.minOrderAmount} onChange={(event) => updateEditablePromo(promo.id, "minOrderAmount", event.target.value)} />
                    </div>
                    <div>
                      <Label>Usage Limit</Label>
                      <Input type="number" value={promo.usageLimit} onChange={(event) => updateEditablePromo(promo.id, "usageLimit", event.target.value)} />
                    </div>
                    <div>
                      <Label>Valid From</Label>
                      <Input type="date" value={promo.validFrom} onChange={(event) => updateEditablePromo(promo.id, "validFrom", event.target.value)} />
                    </div>
                    <div>
                      <Label>Valid Until</Label>
                      <Input type="date" value={promo.validUntil} onChange={(event) => updateEditablePromo(promo.id, "validUntil", event.target.value)} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Switch checked={promo.isActive} onCheckedChange={(checked) => updateEditablePromo(promo.id, "isActive", checked)} />
                    <span className="text-sm">Active</span>
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
