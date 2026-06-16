import type { Product } from "@/lib/types"

function normalizeSlugPart(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function getProductSlug(product: Pick<Product, "id" | "slug" | "name">) {
  const explicitSlug = String(product.slug ?? "").trim()
  if (explicitSlug) {
    return normalizeSlugPart(explicitSlug)
  }

  const fallback = normalizeSlugPart(product.name || product.id)
  return fallback || normalizeSlugPart(product.id)
}

export function getPublicProductPath(product: Pick<Product, "id" | "slug" | "name">) {
  return `/products/${getProductSlug(product)}`
}

export function isProductPath(pathname: string) {
  return /^\/products\/[^/]+\/?$/i.test(pathname)
}

export function getSlugFromProductPath(pathname: string) {
  const match = pathname.match(/^\/products\/([^/]+)\/?$/i)
  return match?.[1]?.toLowerCase() ?? ""
}
