import { Star, StarHalf } from "@phosphor-icons/react"

type StarRatingProps = {
  rating: number
  size?: number
  showNumber?: boolean
}

export function StarRating({ rating, size = 16, showNumber = false }: StarRatingProps) {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => {
        if (i < fullStars) {
          return <Star key={i} size={size} weight="fill" className="text-accent" />
        } else if (i === fullStars && hasHalfStar) {
          return <StarHalf key={i} size={size} weight="fill" className="text-accent" />
        } else {
          return <Star key={i} size={size} className="text-muted-foreground/30" />
        }
      })}
      {showNumber && <span className="text-sm text-muted-foreground ml-1">({rating.toFixed(1)})</span>}
    </div>
  )
}
