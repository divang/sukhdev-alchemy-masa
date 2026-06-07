import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, ShoppingCart } from "@phosphor-icons/react"
import { StarRating } from "./StarRating"
import type { Product } from "@/lib/types"
import { motion } from "framer-motion"
import { getProductImage } from "@/lib/product-images"
import { useKV } from "@/hooks/use-kv"
import { getProductDisplayPriceLabel, getProductPackLabel } from "@/lib/pricing"

type ProductCardProps = {
  product: Product
  onViewDetails: (product: Product) => void
  onAddToCart: (product: Product) => void
}

export function ProductCard({ product, onViewDetails, onAddToCart }: ProductCardProps) {
  const [productImages] = useKV<Record<string, string>>("product-images", {})
  const imageUrl = getProductImage(product, productImages ?? {})
  
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden h-full flex flex-col hover:shadow-lg transition-shadow">
        <div className="relative h-48 bg-muted overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <span className="text-muted-foreground">No image</span>
            </div>
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
            <span className="text-2xl font-bold text-primary">{getProductDisplayPriceLabel(product)}</span>
            <span className="text-xs text-muted-foreground">{getProductPackLabel(product)}</span>
          </div>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onViewDetails(product)}
            >
              <Eye size={16} className="mr-1" />
              Details
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onAddToCart(product)}
            >
              <ShoppingCart size={16} className="mr-1" />
              Add to Cart
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
