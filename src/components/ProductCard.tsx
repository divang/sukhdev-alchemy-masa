import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowSquareOut, Eye, Plus, ShoppingCart } from "@phosphor-icons/react"
import { StarRating } from "./StarRating"
import type { Product } from "@/lib/types"
import { motion } from "framer-motion"
import { getProductImage } from "@/lib/product-images"
import { useKV } from "@/hooks/use-kv"
import { getProductPackLabel, getProductPackGrams, resolveProductPackPrice } from "@/lib/pricing"

type ProductCardProps = {
  product: Product
  onViewDetails: (product: Product) => void
  onAddToCart: (product: Product) => void
  mobileDenseLayout?: boolean
}

export function ProductCard({ product, onViewDetails, onAddToCart, mobileDenseLayout = false }: ProductCardProps) {
  const [productImages] = useKV<Record<string, string>>("product-images", {})
  const imageUrl = getProductImage(product, productImages ?? {})
  const imageClassName = product.category === "raw-organic-spices"
    ? "w-full h-full object-cover object-bottom transition-transform hover:scale-105 duration-300"
    : "w-full h-full object-cover transition-transform hover:scale-105 duration-300"
  const packBadgeLabel = `${getProductPackGrams(product)}g`
  const currentPrice = resolveProductPackPrice(product, getProductPackGrams(product))
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
  const discountPercent = product.discountPercent ?? discountFromTag
  const referencePrice = product.compareAtPrice
    ?? (discountPercent
      ? Math.ceil((currentPrice / (1 - discountPercent / 100)) / 5) * 5
      : undefined)
  const hasDiscount = Boolean(discountPercent && referencePrice && referencePrice > currentPrice)
  const showDiscountBadge = Boolean(discountPercent)

  if (mobileDenseLayout) {
    return (
      <>
        <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }} className="md:hidden">
          <Card className="gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 py-0">
            <button
              type="button"
              onClick={() => onViewDetails(product)}
              className="relative block w-full text-left"
            >
              <div className="relative aspect-square overflow-hidden rounded-b-2xl bg-white">
                {imageUrl ? (
                  <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <span className="text-muted-foreground">No image</span>
                  </div>
                )}
              </div>
              <Badge className="absolute left-2 top-2 bg-red-600 px-1.5 py-0 text-[10px] font-semibold text-white hover:bg-red-600">
                {showDiscountBadge ? `-${discountPercent}%` : "Best Price"}
              </Badge>
              <Badge className="absolute right-2 top-2 bg-slate-900 px-1.5 py-0 text-[10px] font-semibold text-white hover:bg-slate-900">
                {packBadgeLabel}
              </Badge>
            </button>

            <CardContent className="space-y-0.5 p-2.5 pb-1">
              <h3 className="line-clamp-1 text-[14px] font-medium leading-5">{product.name}</h3>
              <div className="flex items-end gap-1">
                <span className="text-[22px] font-bold tracking-tight leading-none">₹{currentPrice}</span>
                {hasDiscount && (
                  <span className="pb-0.5 text-[12px] text-muted-foreground line-through">₹{referencePrice}</span>
                )}
              </div>
            </CardContent>

            <CardFooter className="justify-between px-2.5 pb-2 pt-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onViewDetails(product)}
                  className="text-[12px] leading-none font-medium text-slate-700"
                >
                  View details
                </button>
                {product.amazonUrl && (
                  <a
                    href={product.amazonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] leading-none font-semibold text-amber-700 hover:text-amber-800"
                  >
                    Buy on Amazon
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-yellow-400 text-slate-900 hover:bg-yellow-500"
                  onClick={() => onAddToCart(product)}
                  aria-label={`Add ${product.name} to cart`}
                >
                  <Plus size={16} weight="bold" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="hidden md:block">
          <Card className="gap-0 overflow-hidden h-full flex flex-col py-0 transition-shadow hover:shadow-lg">
            <div className="relative h-48 bg-muted overflow-hidden">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={product.name}
                  className={imageClassName}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <span className="text-muted-foreground">No image</span>
                </div>
              )}
              <Badge className="absolute right-2 top-2 bg-slate-900 px-1.5 py-0 text-[10px] font-semibold text-white hover:bg-slate-900">
                {packBadgeLabel}
              </Badge>
              {showDiscountBadge && (
                <Badge className="absolute left-2 top-2 bg-red-600 px-1.5 py-0 text-[10px] font-semibold text-white hover:bg-red-600">
                  -{discountPercent}%
                </Badge>
              )}
            </div>

            <CardContent className="flex-1 p-4 flex flex-col gap-2">
              <h3 className="font-semibold text-lg line-clamp-2">{product.name}</h3>
              <div className="flex items-center gap-2">
                <StarRating rating={product.rating} size={14} />
                <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
            </CardContent>

            <CardFooter className="p-4 pt-0 flex flex-col gap-2">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-primary">₹{currentPrice}</span>
                  {hasDiscount && (
                    <span className="text-xs text-muted-foreground line-through">₹{referencePrice}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{getProductPackLabel(product)}</span>
              </div>
              <div className={`grid w-full gap-2 ${product.amazonUrl ? "grid-cols-3" : "grid-cols-2"}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => onViewDetails(product)}
                >
                  <Eye size={16} className="mr-1" />
                  Details
                </Button>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => onAddToCart(product)}
                >
                  <ShoppingCart size={16} className="mr-1" />
                  Add to Cart
                </Button>
                {product.amazonUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    asChild
                  >
                    <a href={product.amazonUrl} target="_blank" rel="noopener noreferrer">
                      <ArrowSquareOut size={16} className="mr-1" />
                      Amazon
                    </a>
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </>
    )
  }
  
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="gap-0 overflow-hidden h-full flex flex-col py-0 transition-shadow hover:shadow-lg">
        <div className="relative h-48 bg-muted overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className={imageClassName}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <span className="text-muted-foreground">No image</span>
            </div>
          )}
          <Badge className="absolute right-2 top-2 bg-slate-900 px-1.5 py-0 text-[10px] font-semibold text-white hover:bg-slate-900">
            {packBadgeLabel}
          </Badge>
          {showDiscountBadge && (
            <Badge className="absolute left-2 top-2 bg-red-600 px-1.5 py-0 text-[10px] font-semibold text-white hover:bg-red-600">
              -{discountPercent}%
            </Badge>
          )}
        </div>
        
        <CardContent className="flex-1 p-4 flex flex-col gap-2">
          <h3 className="font-semibold text-lg line-clamp-2">{product.name}</h3>
          <div className="flex items-center gap-2">
            <StarRating rating={product.rating} size={14} />
            <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
        </CardContent>
        
        <CardFooter className="p-4 pt-0 flex flex-col gap-2">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-primary">₹{currentPrice}</span>
              {hasDiscount && (
                <span className="text-xs text-muted-foreground line-through">₹{referencePrice}</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{getProductPackLabel(product)}</span>
          </div>
          <div className={`grid w-full gap-2 ${product.amazonUrl ? "grid-cols-3" : "grid-cols-2"}`}>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onViewDetails(product)}
            >
              <Eye size={16} className="mr-1" />
              Details
            </Button>
            <Button
              size="sm"
              className="w-full"
              onClick={() => onAddToCart(product)}
            >
              <ShoppingCart size={16} className="mr-1" />
              Add to Cart
            </Button>
            {product.amazonUrl && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                asChild
              >
                <a href={product.amazonUrl} target="_blank" rel="noopener noreferrer">
                  <ArrowSquareOut size={16} className="mr-1" />
                  Amazon
                </a>
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
