import { useState, useRef } from "react"
import { useKV } from "@github/spark/hooks"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Upload, X, Image as ImageIcon, Check } from "@phosphor-icons/react"
import { toast } from "sonner"
import type { Product } from "@/lib/types"

export function AdminPanel() {
  const [products] = useKV<Product[]>("products", [])
  const [productImages, setProductImages] = useKV<Record<string, string>>("product-images", {})
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (productId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setProductImages((current) => ({
          ...current,
          [productId]: base64String
        }))
        toast.success('Image uploaded successfully!')
        setSelectedProduct(null)
      }
      reader.onerror = () => {
        toast.error('Failed to read image file')
      }
      reader.readAsDataURL(file)
    } catch (error) {
      toast.error('Failed to upload image')
      console.error(error)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = (productId: string) => {
    setProductImages((current) => {
      const updated = { ...current }
      delete updated[productId]
      return updated
    })
    toast.info('Image removed')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && selectedProduct) {
      handleImageUpload(selectedProduct.id, file)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Product Image Management</h2>
        <p className="text-muted-foreground">
          Upload and manage product images. Images are stored securely and will persist across sessions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(products || []).map((product) => {
          const hasImage = !!productImages?.[product.id]
          const imageUrl = productImages?.[product.id]

          return (
            <Card key={product.id}>
              <CardHeader>
                <CardTitle className="text-lg">{product.name}</CardTitle>
                <CardDescription>₹{product.price}/100g</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon size={48} className="text-muted-foreground" />
                    </div>
                  )}
                  {hasImage && (
                    <Badge className="absolute top-2 right-2 bg-green-600">
                      <Check size={14} className="mr-1" />
                      Uploaded
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setSelectedProduct(product)}
                    className="flex-1"
                    variant={hasImage ? "outline" : "default"}
                  >
                    <Upload size={16} className="mr-2" />
                    {hasImage ? 'Change' : 'Upload'}
                  </Button>
                  {hasImage && (
                    <Button
                      onClick={() => handleRemoveImage(product.id)}
                      variant="destructive"
                      size="icon"
                    >
                      <X size={16} />
                    </Button>
                  )}
                </div>
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

      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Image for {selectedProduct?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="image-upload">Select Image</Label>
              <Input
                id="image-upload"
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileSelect}
                disabled={uploading}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Accepted formats: JPG, PNG, WebP. Max size: 5MB
              </p>
            </div>

            {selectedProduct && productImages?.[selectedProduct.id] && (
              <div>
                <Label>Current Image</Label>
                <div className="mt-2 aspect-square bg-muted rounded-lg overflow-hidden">
                  <img
                    src={productImages[selectedProduct.id]}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedProduct(null)}
                className="flex-1"
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
                disabled={uploading}
              >
                <Upload size={16} className="mr-2" />
                {uploading ? 'Uploading...' : 'Choose File'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
