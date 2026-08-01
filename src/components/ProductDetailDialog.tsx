import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowSquareOut, ShoppingCart, VideoCamera } from "@phosphor-icons/react"
import { StarRating } from "./StarRating"
import type { Product, UserProfile } from "@/lib/types"
import { useEffect, useState } from "react"
import { useKV } from "@/hooks/use-kv"
import type { Review } from "@/lib/types"
import { getProductImage } from "@/lib/product-images"
import { submitProductReview } from "@/lib/catalog"
import { toast } from "sonner"
import { getProductPackGrams, getProductPackLabel, getProductPackOptions, resolveProductPackPrice, SMOOTHIE_ADDON_PRICES, SMOOTHIE_DEFAULT_ADDONS, CLOUD_KITCHEN_MILK_SURCHARGE, calculateSmoothieAddOnTotal } from "@/lib/pricing"

type ProductDetailDialogProps = {
  product: Product
  currentUser: UserProfile | null
  canReview: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToCart: (product: Product, grams: number, selectedAddOns?: string[]) => void
}

export function ProductDetailDialog({ product, currentUser, canReview, open, onOpenChange, onAddToCart }: ProductDetailDialogProps) {
  const [reviews, setReviews] = useKV<Review[]>("reviews", [])
  const [productImages] = useKV<Record<string, string>>("product-images", {})
  const [reviewRating, setReviewRating] = useState<string>("5")
  const [reviewComment, setReviewComment] = useState("")
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [expandedReviewIds, setExpandedReviewIds] = useState<string[]>([])
  const isSmoothie = product.tags.includes("smoothie")
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>(
    isSmoothie ? [...SMOOTHIE_DEFAULT_ADDONS] : []
  )
  const [smoothieBase, setSmoothieBase] = useState<"water" | "milk">("water")
  const [deliveryPreview, setDeliveryPreview] = useState<"instant" | "subscription">("instant")
  const [subDays, setSubDays] = useState<string[]>([])
  const [subMorningTime, setSubMorningTime] = useState("")
  const [subEveningTime, setSubEveningTime] = useState("")
  const packOptions = getProductPackOptions(product)
  const [selectedGrams, setSelectedGrams] = useState<string>(String(packOptions[0] ?? getProductPackGrams(product)))
  
  const productReviews = (reviews || []).filter(r => r.productId === product.id)
  const imageUrl = getProductImage(product, productImages ?? {})

  useEffect(() => {
    setSelectedGrams(String(packOptions[0] ?? getProductPackGrams(product)))
    setSelectedAddOns(isSmoothie ? [...SMOOTHIE_DEFAULT_ADDONS] : [])
    setSmoothieBase("water")
    setDeliveryPreview("instant")
    setSubDays([])
    setSubMorningTime("")
    setSubEveningTime("")
  }, [product.id])

  const selectedPackGrams = Number(selectedGrams) || getProductPackGrams(product)
  const basePackPrice = resolveProductPackPrice(product, selectedPackGrams)
  const smoothieAddOnExtra = isSmoothie ? calculateSmoothieAddOnTotal(selectedAddOns, smoothieBase) : 0
  const selectedPackPrice = basePackPrice + smoothieAddOnExtra
  const discountFromTag = (() => {
    for (const tag of product.tags || []) {
      const match = /^discount-(\d{1,2})$/i.exec(tag)
      if (match) {
        const value = Number(match[1])
        if (Number.isFinite(value) && value > 0 && value < 100) {
          return value
        }
      }
    }

    return undefined
  })()
  const referencePrice = product.compareAtPrice
    ?? (product.discountPercent
      ? Math.ceil((selectedPackPrice / (1 - product.discountPercent / 100)) / 5) * 5
      : undefined)
  const derivedDiscountPercent = referencePrice && referencePrice > selectedPackPrice
    ? Math.round((1 - selectedPackPrice / referencePrice) * 100)
    : undefined
  const discountPercent = product.discountPercent ?? derivedDiscountPercent ?? discountFromTag
  const hasDiscount = Boolean(discountPercent && referencePrice && referencePrice > selectedPackPrice)
  
  const toggleSubDay = (day: string) => {
    setSubDays((cur) => cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day])
  }

  const subSlotsSelected = [subMorningTime, subEveningTime].filter(Boolean).length
  const subDeliveriesPerWeek = subDays.length * subSlotsSelected
  const subWeeklyTotal = subDeliveriesPerWeek * selectedPackPrice

  const handleAddToCart = () => {
    const slotParts = [
      subMorningTime ? `Morning ${subMorningTime}` : null,
      subEveningTime ? `Evening ${subEveningTime}` : null,
    ].filter(Boolean).join(" & ")
    const addOnsWithBase = isSmoothie
      ? [
          `Base: ${smoothieBase === "milk" ? "Milk" : "Water"}`,
          ...selectedAddOns,
          ...(deliveryPreview === "subscription" && subDays.length > 0 && slotParts
            ? [`Delivery: ${subDays.join(",")} | ${slotParts}`]
            : []),
        ]
      : selectedAddOns
    onAddToCart(product, selectedPackGrams, addOnsWithBase)
    onOpenChange(false)
  }

  const toggleAddOn = (option: string) => {
    setSelectedAddOns((current) => (
      current.includes(option)
        ? current.filter((entry) => entry !== option)
        : [...current, option]
    ))
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
  
  const detailContent = (
    <>
      <div className="pr-8">
        <h2 className="text-xl font-semibold sm:text-2xl">{product.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View ingredients, reviews, and pack details.
        </p>
      </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="w-full h-full object-contain object-center p-3"
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
                {hasDiscount && (
                  <>
                    <span className="text-sm text-muted-foreground line-through">₹{referencePrice}</span>
                    <Badge className="bg-red-600 text-white hover:bg-red-600">-{discountPercent}%</Badge>
                  </>
                )}
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

                {isSmoothie && (
                  <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
                    {/* Base choice */}
                    <div>
                      <p className="text-sm font-medium mb-2">Base liquid</p>
                      <RadioGroup
                        value={smoothieBase}
                        onValueChange={(v) => setSmoothieBase(v as "water" | "milk")}
                        className="flex gap-4"
                      >
                        <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                          <RadioGroupItem value="water" id={`${product.id}-base-water`} />
                          <span>Water <span className="text-xs text-muted-foreground">(default)</span></span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                          <RadioGroupItem value="milk" id={`${product.id}-base-milk`} />
                          <span>Milk <span className="text-xs text-emerald-700">+₹{CLOUD_KITCHEN_MILK_SURCHARGE}</span></span>
                        </label>
                      </RadioGroup>
                    </div>

                    {/* Ingredients */}
                    {Array.isArray(product.addOnOptions) && product.addOnOptions.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-1">Ingredients <span className="text-xs text-muted-foreground font-normal">(Almonds, Cashews & Walnuts selected by default)</span></p>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {product.addOnOptions.map((option) => {
                            const checkboxId = `${product.id}-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
                            const price = SMOOTHIE_ADDON_PRICES[option]
                            return (
                              <label key={option} htmlFor={checkboxId} className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted/50 ${selectedAddOns.includes(option) ? "border-primary bg-primary/5" : ""}`}>
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={checkboxId}
                                    checked={selectedAddOns.includes(option)}
                                    onCheckedChange={() => toggleAddOn(option)}
                                  />
                                  <span>{option}</span>
                                </div>
                                {price != null && (
                                  <span className="text-xs text-muted-foreground">+₹{price}</span>
                                )}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Live price breakdown */}
                    <div className="rounded-md bg-white border px-3 py-2 text-sm flex items-center justify-between">
                      <span className="text-muted-foreground">Total (smoothie + add-ons)</span>
                      <span className="font-bold text-primary text-base">₹{selectedPackPrice}</span>
                    </div>

                    {/* Delivery Planner */}
                    <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
                      <p className="text-sm font-semibold text-emerald-900">Delivery</p>

                      {/* Mode picker */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDeliveryPreview("instant")}
                          className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${deliveryPreview === "instant" ? "border-emerald-700 bg-white shadow-sm" : "border-emerald-200 bg-white/60 text-emerald-800"}`}
                        >
                          <p className="font-medium">⚡ Instant</p>
                          <p className="text-xs text-muted-foreground">₹30 · Pincode 560068</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliveryPreview("subscription")}
                          className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${deliveryPreview === "subscription" ? "border-emerald-700 bg-white shadow-sm" : "border-emerald-200 bg-white/60 text-emerald-800"}`}
                        >
                          <p className="font-medium">📅 Weekly Plan</p>
                          <p className="text-xs text-muted-foreground">Free delivery, prepay weekly</p>
                        </button>
                      </div>

                      {/* Subscription builder */}
                      {deliveryPreview === "subscription" && (
                        <div className="space-y-3 rounded-md border border-emerald-200 bg-white p-3">
                          {/* Weekdays */}
                          <div>
                            <p className="text-xs font-medium text-emerald-900 mb-2">
                              Delivery days <span className="text-red-500">*</span>
                              <span className="ml-1 font-normal text-muted-foreground">(select at least one)</span>
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => toggleSubDay(day)}
                                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${subDays.includes(day) ? "border-emerald-700 bg-emerald-100 text-emerald-900" : "border-gray-200 text-gray-600 hover:border-emerald-300"}`}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Time slots — morning and evening are independent; pick one or both */}
                          <div>
                            <p className="text-xs font-medium text-emerald-900 mb-2">
                              Time slot <span className="text-red-500">*</span>
                              <span className="ml-1 font-normal text-muted-foreground">(select morning, evening, or both)</span>
                            </p>
                            <div className="space-y-2">
                              {/* Morning */}
                              <div className={`rounded-md border px-3 py-2 ${subMorningTime ? "border-emerald-400 bg-emerald-50" : "border-gray-200"}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-medium text-gray-700">🌅 Morning</p>
                                  {subMorningTime && (
                                    <button type="button" onClick={() => setSubMorningTime("")} className="text-[10px] text-muted-foreground hover:text-red-500 underline">
                                      Clear
                                    </button>
                                  )}
                                </div>
                                <RadioGroup
                                  value={subMorningTime}
                                  onValueChange={setSubMorningTime}
                                  className="flex flex-wrap gap-3"
                                >
                                  {["7 AM", "8 AM", "9 AM", "10 AM"].map((t) => (
                                    <label key={t} className="flex cursor-pointer items-center gap-1.5 text-xs">
                                      <RadioGroupItem value={t} id={`${product.id}-morning-${t.replace(" ", "")}`} />
                                      <span>{t}</span>
                                    </label>
                                  ))}
                                </RadioGroup>
                              </div>

                              {/* Evening */}
                              <div className={`rounded-md border px-3 py-2 ${subEveningTime ? "border-emerald-400 bg-emerald-50" : "border-gray-200"}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-medium text-gray-700">🌇 Evening</p>
                                  {subEveningTime && (
                                    <button type="button" onClick={() => setSubEveningTime("")} className="text-[10px] text-muted-foreground hover:text-red-500 underline">
                                      Clear
                                    </button>
                                  )}
                                </div>
                                <RadioGroup
                                  value={subEveningTime}
                                  onValueChange={setSubEveningTime}
                                  className="flex flex-wrap gap-3"
                                >
                                  {["5 PM", "6 PM", "7 PM", "8 PM", "9 PM"].map((t) => (
                                    <label key={t} className="flex cursor-pointer items-center gap-1.5 text-xs">
                                      <RadioGroupItem value={t} id={`${product.id}-evening-${t.replace(" ", "")}`} />
                                      <span>{t}</span>
                                    </label>
                                  ))}
                                </RadioGroup>
                              </div>
                            </div>
                          </div>

                          {/* Weekly total */}
                          {subDays.length > 0 && subSlotsSelected > 0 ? (
                            <div className="rounded-md bg-emerald-100 border border-emerald-300 px-3 py-2 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-emerald-800">
                                  {subDays.length} day{subDays.length > 1 ? "s" : ""}
                                  {subSlotsSelected === 2 ? " × 2 slots" : ""} × ₹{selectedPackPrice}
                                </span>
                                <span className="font-bold text-emerald-900 text-base">
                                  ₹{subWeeklyTotal} / week
                                </span>
                              </div>
                              <p className="text-xs text-emerald-700">
                                💳 Pay ₹{subWeeklyTotal} in advance · Free delivery
                                {subMorningTime ? ` · 🌅 ${subMorningTime}` : ""}
                                {subEveningTime ? ` · 🌇 ${subEveningTime}` : ""}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-amber-600">
                              {subDays.length === 0
                                ? "Select at least one day"
                                : "Select at least one time slot"} to see your weekly total.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!isSmoothie && Array.isArray(product.addOnOptions) && product.addOnOptions.length > 0 && (
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-sm font-medium">Optional add-ons</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {product.addOnOptions.map((option) => {
                        const checkboxId = `${product.id}-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
                        return (
                          <label key={option} htmlFor={checkboxId} className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted/50">
                            <Checkbox
                              id={checkboxId}
                              checked={selectedAddOns.includes(option)}
                              onCheckedChange={() => toggleAddOn(option)}
                            />
                            <span>{option}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col gap-2">
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
                  {product.amazonUrl && (
                    <Button type="button" variant="outline" asChild>
                      <a href={product.amazonUrl} target="_blank" rel="noopener noreferrer">
                        <ArrowSquareOut size={18} className="mr-2" />
                        Buy on Amazon
                      </a>
                    </Button>
                  )}
                  <p className="sm:hidden text-xs text-center text-muted-foreground">
                    💡 Tip: Tap the dimmed background to close
                  </p>
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
    </>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-3xl max-h-[85svh] sm:max-h-[90vh] overflow-x-hidden overflow-y-auto p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Product details and reviews.
          </DialogDescription>
        </DialogHeader>
        {detailContent}
      </DialogContent>
    </Dialog>
  )
}
