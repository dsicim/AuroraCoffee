import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import AuroraWidget from '../shared/components/ui/AuroraWidget'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
import ProductCard from '../components/ProductCard'
import StorefrontLayout from '../shared/components/layout/StorefrontLayout'
import coffeeSketch from '../assets/coffee-sketch.jpeg'
import { useProductCatalog } from '../lib/products'

export default function HomePage() {
  const { products, loading, error } = useProductCatalog()

  const suggestedProduct = useMemo(
    () => {
      if (!products.length) {
        return null
      }

      const seed = products.reduce((total, product) => {
        return (
          total +
          product.slug.split('').reduce((productTotal, character) => productTotal + character.charCodeAt(0), 0)
        )
      }, 0)

      return products[seed % products.length] || products[0]
    },
    [products],
  )

  const hero = (
    <section className="aurora-home-hero">
      <div className="aurora-home-hero-inner">
        <div className="aurora-home-copy">
          <p className="aurora-kicker">Aurora Coffee Roastery</p>
          <h1 className="aurora-home-title">
            Aurora Coffee
          </h1>
          <p className="aurora-copy max-w-xl text-base sm:text-lg">
            Fresh-roasted coffees, brewing gear, and seasonal picks with a smooth path from discovery to checkout.
          </p>

          <div className="flex flex-wrap gap-3">
            <LiquidGlassButton as={Link} to="/products" size="hero">
              Shop coffee
            </LiquidGlassButton>
            {suggestedProduct ? (
              <LiquidGlassButton
                as={Link}
                to={`/products/${suggestedProduct.slug}`}
                variant="secondary"
                size="hero"
              >
                Try today&apos;s pick
              </LiquidGlassButton>
            ) : null}
          </div>
        </div>

        <div className="aurora-home-visual" aria-hidden="true">
          <img
            src={coffeeSketch}
            alt=""
            loading="eager"
            decoding="async"
            className="aurora-home-sketch"
          />
          <div className="aurora-home-roast-note">
            <span>Roasted small</span>
            <strong>Shipped fresh</strong>
          </div>
        </div>
      </div>
    </section>
  )

  return (
    <StorefrontLayout hero={hero} heroFullBleed contentClassName="aurora-home-shell">
      <section className="aurora-home-feature-grid">
        <div className="aurora-showroom-panel p-5 sm:p-8">
          <p className="aurora-kicker">Shop faster</p>
          <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
            Roast detail up front. Checkout tools close by.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--aurora-text)]">
            Product pages keep tasting notes, stock, price, options, and cart actions together so the next step stays obvious.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LiquidGlassButton as={Link} to="/products" variant="secondary">
              Browse all products
            </LiquidGlassButton>
            <LiquidGlassButton as={Link} to="/account" variant="quiet">
              Account tools
            </LiquidGlassButton>
          </div>
        </div>

        <AuroraWidget
          title="Today's pick"
          subtitle="Fresh from the catalog"
          icon="spark"
          className="aurora-summary-lead p-5 sm:p-8"
        >
          {loading ? (
            <p className="text-sm leading-7 text-[var(--aurora-text)]">
              Loading the current catalog.
            </p>
          ) : error ? (
            <p className="text-sm leading-7 text-[var(--aurora-text)]">
              {error}
            </p>
          ) : suggestedProduct ? (
            <div className="mt-5">
              <ProductCard product={suggestedProduct} compact />
            </div>
          ) : (
            <p className="text-sm leading-7 text-[var(--aurora-text)]">
              No products are available right now.
            </p>
          )}
        </AuroraWidget>
      </section>
    </StorefrontLayout>
  )
}
