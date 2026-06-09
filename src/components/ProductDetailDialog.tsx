import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { useEffect, useState } from "react"
import { useKV } from "@/hooks/use-kv"
import type { Review } from "@/lib/types"
import { getProductImage } from "@/lib/product-images"
import { submitProductReview } from "@/lib/catalog"
import { toast } from "sonner"
import { getProductPackGrams, getProductPackLabel, getProductPackOptions, resolveProductPackPrice } from "@/lib/pricing"

type ProductDetailDialogProps = {
  product: Product
  currentUser: UserProfile | null
  canReview: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToCart: (product: Product, grams: number) => void
}

export function ProductDetailDialog({ product, currentUser, canReview, open, onOpenChange, onAddToCart }: ProductDetailDialogProps) {
  const [reviews, setReviews] = useKV<Review[]>("reviews", [])
  const [productImages] = useKV<Record<string, string>>("product-images", {})
  const [reviewRating, setReviewRating] = useState<string>("5")
  const [reviewComment, setReviewComment] = useState("")
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [expandedReviewIds, setExpandedReviewIds] = useState<string[]>([])
  const packOptions = getProductPackOptions(product)
  const [selectedGrams, setSelectedGrams] = useState<string>(String(packOptions[0] ?? getProductPackGrams(product)))
  
  const productReviews = (reviews || []).filter(r => r.productId === product.id)
  const imageUrl = getProductImage(product, productImages ?? {})

  useEffect(() => {
    setSelectedGrams(String(packOptions[0] ?? getProductPackGrams(product)))
  }, [product.id])

  const selectedPackGrams = Number(selectedGrams) || getProductPackGrams(product)
  const selectedPackPrice = resolveProductPackPrice(product, selectedPackGrams)
  
  const handleAddToCart = () => {
    onAddToCart(product, selectedPackGrams)
    onOpenChange(false)
  }

  const toggleExpandedReview = (reviewId: string) => {
    setExpandedReviewIds((current) => (
      current.includes(reviewId)
        ? current.filter((id) => id !== reviewId)
        : [...current, reviewId]
    ))
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

    if (!canReview) {
      toast.error("Only signed-in customers who purchased this item can review it.")
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
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-3xl max-h-[95svh] sm:max-h-[90vh] overflow-x-hidden overflow-y-auto p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl pr-8">{product.name}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pr-8">
            View ingredients, reviews, and pack details. Close this panel to continue browsing.
          </DialogDescription>
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
              <p className="text-muted-foreground break-words">{product.description}</p>
            </div>
            
            <Separator />
            
            <div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-primary">₹{selectedPackPrice}</span>
                <span className="text-sm text-muted-foreground">{selectedPackGrams}g pack</span>
              </div>
              
              <div className="space-y-3">
                {packOptions.length > 1 ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Choose pack size</p>
                    <Select value={selectedGrams} onValueChange={setSelectedGrams}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select pack size" />
                      </SelectTrigger>
                      <SelectContent>
                        {packOptions.map((grams) => (
                          <SelectItem key={`${product.id}-${grams}`} value={String(grams)}>
                            {grams}g - ₹{resolveProductPackPrice(product, grams)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-2">Maximum 500g per product allowed in cart.</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Fixed pack size: {getProductPackLabel(product)}
                  </p>
                )}
                
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    size="lg"
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart size={20} className="mr-2" />
                    Add to Cart
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => onOpenChange(false)}
                  >
                    Close
                  </Button>
                </div>
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
                    <span className="break-words">{ingredient}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="reviews">
            <ScrollArea className="h-48">
              <div className="p-4 border-b space-y-3">
                {currentUser && canReview ? (
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
                ) : currentUser ? (
                  <p className="text-sm text-muted-foreground">
                    Complete a paid purchase for this item to unlock reviews on your account.
                  </p>
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
                      <p className={`text-sm break-words ${expandedReviewIds.includes(review.id) ? "" : "line-clamp-4"}`}>
                        {review.comment}
                      </p>
                      {review.comment.length > 180 && (
                        <button
                          type="button"
                          className="text-xs font-medium text-primary hover:underline"
                          onClick={() => toggleExpandedReview(review.id)}
                        >
                          {expandedReviewIds.includes(review.id) ? "Show less" : "More"}
                        </button>
                      )}
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
