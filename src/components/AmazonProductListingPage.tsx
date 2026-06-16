import { useEffect, useMemo } from "react"
import { ArrowLeft } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useInitialData } from "@/hooks/use-initial-data"
import { useKV } from "@/hooks/use-kv"
import { CATALOG_SEED_CATEGORIES, CATALOG_SEED_PRODUCTS } from "@/lib/catalog-seed"
import { getProductImage } from "@/lib/product-images"
import { getProductSlug } from "@/lib/product-url"
import type { Category, Product } from "@/lib/types"

const DEFAULT_BRAND = "SukhDevi Alchemy Spices"

function normalizeSlug(value: string) {
  return value.trim().toLowerCase()
}

function toAbsoluteUrl(value: string) {
  if (!value) {
    return ""
  }

  try {
    return new URL(value, window.location.origin).toString()
  } catch {
    return value
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function deriveHighlights(product: Product) {
  if (Array.isArray(product.highlights) && product.highlights.length > 0) {
    return product.highlights
  }

  const fallbacks: string[] = []
  if (product.inStock) {
    fallbacks.push("Currently in stock and ready to dispatch")
  }
  if (product.packGrams) {
    fallbacks.push(`${product.packGrams}g consumer pack`)
  }
  if (product.ingredients.length > 0) {
    fallbacks.push(`Contains ${product.ingredients.length} declared ingredient(s)`)
  }

  return fallbacks
}

type AmazonProductListingPageProps = {
  slug: string
}

export function AmazonProductListingPage({ slug }: AmazonProductListingPageProps) {
  useInitialData()

  const [products] = useKV<Product[]>("products", CATALOG_SEED_PRODUCTS)
  const [categories] = useKV<Category[]>("categories", CATALOG_SEED_CATEGORIES)
  const [productImages] = useKV<Record<string, string>>("product-images", {})

  const product = useMemo(() => {
    const target = normalizeSlug(slug)
    return (products ?? []).find((entry) => {
      const productSlug = normalizeSlug(getProductSlug(entry))
      return productSlug === target || normalizeSlug(entry.id) === target
    })
  }, [products, slug])

  const categoryName = useMemo(() => {
    if (!product) {
      return ""
    }

    return categories?.find((entry) => entry.id === product.category)?.name ?? product.category
  }, [categories, product])

  const listingImages = useMemo(() => {
    if (!product) {
      return []
    }

    const primary = getProductImage(product, productImages ?? {})
    const additional = Array.isArray(product.additionalImages) ? product.additionalImages : []
    return unique([primary, ...additional].map(toAbsoluteUrl))
  }, [product, productImages])

  useEffect(() => {
    if (!product || typeof document === "undefined") {
      return
    }

    const script = document.createElement("script")
    script.type = "application/ld+json"
    script.id = "amazon-product-jsonld"

    const pageUrl = toAbsoluteUrl(window.location.pathname)
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.shortDescription || product.description,
      brand: {
        "@type": "Brand",
        name: product.brandName || DEFAULT_BRAND,
      },
      sku: product.sku,
      mpn: product.mpn,
      gtin13: product.gtin,
      image: listingImages,
      category: categoryName,
      url: pageUrl,
      offers: {
        "@type": "Offer",
        priceCurrency: "INR",
        price: String(product.price),
        availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: pageUrl,
      },
    }

    script.textContent = JSON.stringify(structuredData)
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [categoryName, listingImages, product])

  if (!product) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 sm:p-10">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Product not found</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">This public URL does not match any active product.</p>
              <Button asChild>
                <a href="/">Back to storefront</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  const highlights = deriveHighlights(product)
  const breadcrumb = product.categoryBreadcrumb?.length
    ? product.categoryBreadcrumb
    : ["Home", "Products", categoryName || "Catalog", product.name]

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_50%,#fefce8_100%)] px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
          <ArrowLeft size={16} />
          Back to storefront
        </a>

        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {breadcrumb.map((entry) => (
            <span key={`${product.id}-${entry}`} className="inline-flex items-center gap-2">
              <span>{entry}</span>
              <span className="last:hidden">/</span>
            </span>
          ))}
        </nav>

        <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1.1fr_1fr] sm:p-6">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {listingImages[0] ? (
                <img src={listingImages[0]} alt={product.name} className="h-[320px] w-full object-contain sm:h-[420px]" />
              ) : (
                <div className="flex h-[320px] items-center justify-center text-sm text-slate-500 sm:h-[420px]">No product image</div>
              )}
            </div>
            {listingImages.length > 1 && (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {listingImages.slice(1, 6).map((imageUrl, index) => (
                  <div key={`${product.id}-thumb-${index}`} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <img src={imageUrl} alt={`${product.name} image ${index + 2}`} className="h-20 w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Amazon listing ready page</p>
              <h1 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">{product.name}</h1>
              <p className="text-sm text-slate-600">Brand: <span className="font-medium text-slate-800">{product.brandName || DEFAULT_BRAND}</span></p>
              <p className="text-sm text-slate-600">SKU / Model / MPN: <span className="font-medium text-slate-800">{product.sku || "N/A"} / {product.modelNumber || "N/A"} / {product.mpn || "N/A"}</span></p>
              <p className="text-sm text-slate-600">GTIN: <span className="font-medium text-slate-800">{product.gtin || "N/A"}</span></p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>{product.shortDescription || product.description}</p>
            </div>

            {highlights.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">Key highlights</p>
                <ul className="space-y-1 text-sm text-slate-700">
                  {highlights.map((entry) => (
                    <li key={`${product.id}-${entry}`} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-800" />
                      <span>{entry}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {(product.tags || []).map((tag) => (
                <Badge key={`${product.id}-${tag}`} variant="secondary">{tag}</Badge>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Listing attributes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <p><span className="font-medium text-slate-900">Variant data:</span> {(product.variantData && product.variantData.length > 0) ? product.variantData.join(", ") : "Not added yet"}</p>
              <p><span className="font-medium text-slate-900">Net quantity:</span> {product.netQuantityValue && product.netQuantityUnit ? `${product.netQuantityValue} ${product.netQuantityUnit}` : `${product.packGrams ?? "N/A"} g`}</p>
              <p><span className="font-medium text-slate-900">Material info:</span> {product.materialInfo || "Not applicable"}</p>
              <p><span className="font-medium text-slate-900">Category context:</span> {categoryName || "General"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Compliance and ingredients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div>
                <p className="font-medium text-slate-900">Ingredients</p>
                <p>{product.ingredients.length > 0 ? product.ingredients.join(", ") : "No ingredient data available"}</p>
              </div>
              <div>
                <p className="font-medium text-slate-900">Compliance / safety</p>
                <p>{(product.complianceInfo && product.complianceInfo.length > 0) ? product.complianceInfo.join(" | ") : "Add regulatory and safety declarations for this product."}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Public URL for Amazon Web URL import</p>
          <p className="mt-1 break-all">{toAbsoluteUrl(window.location.pathname)}</p>
          <p className="mt-2 text-xs text-slate-500">Keep this page public, indexable, and free from login/paywall restrictions for best Amazon import success.</p>
        </section>
      </div>
    </main>
  )
}
