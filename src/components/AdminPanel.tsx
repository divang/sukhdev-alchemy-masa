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
import { createProductByAdmin, loadCatalogFromSupabase, type AdminProductInput, updateProductByAdmin } from "@/lib/catalog"
import { isSupabaseConfigured } from "@/lib/supabase"

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

type AdminPanelProps = {
  orders?: Order[]
}

export function AdminPanel({ orders = [] }: AdminPanelProps) {
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
