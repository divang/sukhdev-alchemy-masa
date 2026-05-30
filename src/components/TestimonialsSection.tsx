import { Card, CardContent } from "@/components/ui/card"
import { StarRating } from "./StarRating"
import { useKV } from "@/hooks/use-kv"
import type { Testimonial } from "@/lib/types"

export function TestimonialsSection() {
  const [testimonials] = useKV<Testimonial[]>("testimonials", [])
  
  if (!testimonials || testimonials.length === 0) return null
  
  return (
    <section className="bg-muted py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-2">What Our Customers Say</h2>
          <p className="text-muted-foreground">Authentic reviews from spice lovers</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id} className="bg-card">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{testimonial.customerName}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.location}</p>
                  </div>
                  <StarRating rating={testimonial.rating} size={14} />
                </div>
                
                <p className="text-sm text-muted-foreground italic">
                  "{testimonial.comment}"
                </p>
                
                <p className="text-xs text-muted-foreground">
                  {new Date(testimonial.date).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
