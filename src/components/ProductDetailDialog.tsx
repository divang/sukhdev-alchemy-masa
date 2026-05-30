import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ShoppingCart, VideoCamera } from "@phosphor-icons/react"
import { StarRating } from "./StarRating"
import type { Product } from "@/lib/types"
import { GRAM_OPTIONS } from "@/lib/types"
import { useState } from "react"
import { useKV } from "@github/spark/hooks"
import type { Review } from "@/lib/types"

type ProductDetailDialogProps = {
  product: Product
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToCart: (product: Product, grams: number) => void
}

export function ProductDetailDialog({ product, open, onOpenChange, onAddToCart }: ProductDetailDialogProps) {
  const [selectedGrams, setSelectedGrams] = useState<number>(250)
  const [reviews] = useKV<Review[]>("reviews", [])
  
  const productReviews = (reviews || []).filter(r => r.productId === product.id)
  
  const handleAddToCart = () => {
    onAddToCart(product, selectedGrams)
    onOpenChange(false)
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{product.name}</DialogTitle>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div 
              className="w-full h-64 md:h-80 rounded-lg bg-cover bg-center"
              style={{ backgroundImage: `url(${product.image})` }}
            />
            <div className="flex gap-2 flex-wrap">
              {product.tags.map((tag) => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <StarRating rating={product.rating} size={18} showNumber />
                <span className="text-sm text-muted-foreground">
                  {product.reviewCount} reviews
                </span>
              </div>
              <p className="text-muted-foreground">{product.description}</p>
            </div>
            
            <Separator />
            
            <div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-primary">₹{product.price}</span>
                <span className="text-sm text-muted-foreground">/100g</span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Quantity:</label>
                  <Select value={selectedGrams.toString()} onValueChange={(v) => setSelectedGrams(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GRAM_OPTIONS.map((g) => (
                        <SelectItem key={g} value={g.toString()}>
                          {g}g - ₹{(product.price * (g / 100)).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleAddToCart}
                  disabled={true}
                >
                  <ShoppingCart size={20} className="mr-2" />
                  Coming Soon
                </Button>
              </div>
            </div>
            
            {product.youtubeUrl && (
              <Button variant="outline" className="w-full" asChild>
                <a href={product.youtubeUrl} target="_blank" rel="noopener noreferrer">
                  <VideoCamera size={20} className="mr-2" />
                  Watch Video
                </a>
              </Button>
            )}
          </div>
        </div>
        
        <Tabs defaultValue="ingredients" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="ingredients" className="flex-1">Ingredients</TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1">
              Reviews ({productReviews.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="ingredients">
            <ScrollArea className="h-48">
              <ul className="space-y-2 p-4">
                {product.ingredients.map((ingredient, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span>{ingredient}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="reviews">
            <ScrollArea className="h-48">
              {productReviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No reviews yet. Be the first to review!
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  {productReviews.map((review) => (
                    <div key={review.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{review.customerName}</p>
                          {review.verified && (
                            <Badge variant="outline" className="text-xs">Verified Purchase</Badge>
                          )}
                        </div>
                        <StarRating rating={review.rating} size={14} />
                      </div>
                      <p className="text-sm">{review.comment}</p>
                      <p className="text-xs text-muted-foreground">{new Date(review.date).toLocaleDateString()}</p>
                      {productReviews.indexOf(review) < productReviews.length - 1 && (
                        <Separator className="mt-4" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
