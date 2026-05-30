import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Category } from "@/lib/types"

type CategorySidebarProps = {
  categories: Category[]
  selectedCategory: string | null
  onSelectCategory: (categoryId: string | null) => void
}

export function CategorySidebar({ categories, selectedCategory, onSelectCategory }: CategorySidebarProps) {
  const enabledCategories = categories.filter(cat => cat.enabled)
  
  return (
    <div className="space-y-2">
      <h2 className="font-bold text-xl mb-4">Categories</h2>
      
      <button
        onClick={() => onSelectCategory(null)}
        className={cn(
          "w-full text-left px-4 py-3 rounded-lg transition-colors",
          "hover:bg-muted",
          selectedCategory === null ? "bg-primary text-primary-foreground" : ""
        )}
      >
        All Products
      </button>
      
      {enabledCategories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelectCategory(category.id)}
          className={cn(
            "w-full text-left px-4 py-3 rounded-lg transition-colors",
            "hover:bg-muted flex items-center justify-between",
            selectedCategory === category.id ? "bg-primary text-primary-foreground" : ""
          )}
        >
          <span>{category.name}</span>
          {category.slug === 'byom' && (
            <Badge variant="outline" className={cn(
              "text-xs",
              selectedCategory === category.id ? "border-primary-foreground" : ""
            )}>
              New
            </Badge>
          )}
        </button>
      ))}
      
      {categories.filter(cat => !cat.enabled).length > 0 && (
        <div className="pt-4 border-t border-border mt-4">
          <p className="text-xs text-muted-foreground px-4 mb-2">Coming Soon</p>
          {categories.filter(cat => !cat.enabled).map((category) => (
            <div
              key={category.id}
              className="px-4 py-3 rounded-lg opacity-50 flex items-center justify-between"
            >
              <span className="text-sm">{category.name}</span>
              <Badge variant="secondary" className="text-xs">Soon</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
