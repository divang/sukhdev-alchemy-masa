import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ShoppingCart, VideoCamera } from "@phosphor-icons/react"
import { StarRating } from "./StarRating"
import type { Product, UserProfile } from "@/lib/types"
import { GRAM_OPTIONS } from "@/lib/types"
import { useState } from "react"
import { useKV } from "@/hooks/use-kv"
import type { Review } from "@/lib/types"
import { getProductImage } from "@/lib/product-images"
import { submitProductReview } from "@/lib/catalog"
import { toast } from "sonner"

type ProductDetailDialogProps = {
  product: Product
  currentUser: UserProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToCart: (product: Product, grams: number) => void
}

export function ProductDetailDialog({ product, currentUser, open, onOpenChange, onAddToCart }: ProductDetailDialogProps) {
  const [selectedGrams, setSelectedGrams] = useState<number>(250)
  const [reviews, setReviews] = useKV<Review[]>("reviews", [])
  const [productImages] = useKV<Record<string, string>>("product-images", {})
  const [reviewRating, setReviewRating] = useState<string>("5")
  const [reviewComment, setReviewComment] = useState("")
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  
  const productReviews = (reviews || []).filter(r => r.productId === product.id)
  const imageUrl = getProductImage(product, productImages ?? {})
  
  const handleAddToCart = () => {
    onAddToCart(product, selectedGrams)
    onOpenChange(false)
  }

  const handleSubmitReview = async () => {
    if (!currentUser) {
      toast.error("Sign in to submit a review.")
      return
    }

    if (!reviewComment.trim()) {
      toast.error("Please write a review comment before submitting.")
      return
    }

    setIsSubmittingReview(true)
    const result = await submitProductReview({
      productId: product.id,
      rating: Number(reviewRating),
      comment: reviewComment,
    })
    setIsSubmittingReview(false)

    if (result.error || !result.review) {
      toast.error(result.error ?? "Unable to submit review.")
      return
    }

    setReviews((current = []) => {
      const remaining = current.filter((item) => item.id !== result.review?.id)
      return [result.review as Review, ...remaining]
    })
    setReviewComment("")
    setReviewRating("5")
    toast.success("Review submitted successfully.")
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{product.name}</DialogTitle>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="w-full h-64 md:h-80 rounded-lg overflow-hidden bg-muted">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-muted-foreground">No image</span>
                </div>
              )}
            </div>
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
              <div className="p-4 border-b space-y-3">
                {currentUser ? (
                  <>
                    <p className="text-sm font-medium">Write a review</p>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Rating</label>
                      <Select value={reviewRating} onValueChange={setReviewRating}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 - Excellent</SelectItem>
                          <SelectItem value="4">4 - Good</SelectItem>
                          <SelectItem value="3">3 - Average</SelectItem>
                          <SelectItem value="2">2 - Poor</SelectItem>
                          <SelectItem value="1">1 - Bad</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Comment</label>
                      <Textarea
                        value={reviewComment}
                        onChange={(event) => setReviewComment(event.target.value)}
                        placeholder="Share your experience with this product"
                        rows={3}
                      />
                    </div>
                    <Button size="sm" onClick={handleSubmitReview} disabled={isSubmittingReview}>
                      {isSubmittingReview ? "Submitting..." : "Submit Review"}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Sign in to write a review.</p>
                )}
              </div>

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
