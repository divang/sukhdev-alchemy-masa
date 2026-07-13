import { ArrowRight, Leaf, ShieldCheck, Sparkle } from "lucide-react"

import { CATALOG_SEED_PRODUCTS } from "@/lib/catalog-seed"

import "@/styles/storefront-v2.css"

const FEATURE_POINTS = [
  {
    icon: Leaf,
    title: "Hand-Roasted Batches",
    description: "Small-lot roasting keeps aroma vibrant from first spoon to last.",
  },
  {
    icon: ShieldCheck,
    title: "No Fillers Promise",
    description: "Clean spice blends with transparent ingredients and balanced heat.",
  },
  {
    icon: Sparkle,
    title: "Chef-Led Recipes",
    description: "Each masala is tuned to elevate one iconic home-style dish.",
  },
]

const previewProducts = CATALOG_SEED_PRODUCTS
  .filter((product) => product.inStock)
  .slice(0, 8)

export function StorefrontV2() {
  return (
    <div className="v2-root">
      <div className="v2-top-strip">V2 Preview • Inspired storefront direction • Existing website remains unchanged</div>

      <header className="v2-header">
        <div className="v2-brand">
          <img
            src="/branding/SDA-Logo-V3.png"
            alt="Sukhdevi Alchemy"
            className="v2-brand-logo"
            loading="lazy"
          />
          <div>
            <p className="v2-brand-kicker">Sukhdevi Alchemy</p>
            <h1 className="v2-brand-title">Desi Kitchen Aromatics</h1>
          </div>
        </div>

        <nav className="v2-nav" aria-label="V2 navigation">
          <a href="#collections">Collections</a>
          <a href="#why-us">Why Us</a>
          <a href="#best-sellers">Best Sellers</a>
        </nav>

        <a className="v2-switch-link" href="/">
          Visit Current Store
        </a>
      </header>

      <main>
        <section className="v2-hero">
          <div className="v2-hero-copy">
            <p className="v2-kicker">Authentic Spice Craft</p>
            <h2>Bring home the fragrance of freshly ground Indian masalas.</h2>
            <p>
              This V2 experience explores a richer desi retail aesthetic with warm tones, bold typography,
              and ingredient-first storytelling.
            </p>
            <div className="v2-hero-actions">
              <a href="#best-sellers" className="v2-btn v2-btn-primary">
                Explore Best Sellers
                <ArrowRight size={16} />
              </a>
              <a href="#why-us" className="v2-btn v2-btn-secondary">
                Why Families Choose Us
              </a>
            </div>
          </div>
          <div className="v2-hero-media" aria-hidden="true">
            <img src="/images/products/garam-masala-premium.png" alt="" loading="lazy" />
            <img src="/images/products/chat-masala-premium.png" alt="" loading="lazy" />
            <img src="/images/products/chhole-masala-premium.png" alt="" loading="lazy" />
          </div>
        </section>

        <section className="v2-feature-grid" id="why-us">
          {FEATURE_POINTS.map((item) => {
            const Icon = item.icon
            return (
              <article className="v2-feature-card" key={item.title}>
                <Icon size={18} />
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            )
          })}
        </section>

        <section className="v2-products" id="best-sellers">
          <div className="v2-section-head">
            <p className="v2-kicker">Bestsellers</p>
            <h3>Crafted blends your everyday recipes deserve</h3>
          </div>

          <div className="v2-product-grid">
            {previewProducts.map((product) => (
              <article className="v2-product-card" key={product.id}>
                <div className="v2-product-media">
                  <img src={`/${product.image}`} alt={product.name} loading="lazy" />
                </div>
                <div className="v2-product-content">
                  <h4>{product.name}</h4>
                  <p>{product.shortDescription || product.description}</p>
                  <div className="v2-product-footer">
                    <strong>Rs {product.price}</strong>
                    <button type="button">View</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}