import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import AuroraWidget from '../components/AuroraWidget'
import LiquidGlassButton from '../components/LiquidGlassButton'
import ProductCard from '../components/ProductCard'
import StorefrontLayout from '../components/StorefrontLayout'
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
    <section className="aurora-showcase-band p-6 sm:p-8 lg:p-10">
      <div className="aurora-stack-6">
        <div className="aurora-stack-6">
          <div className="aurora-stack-4">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
              Aurora catalog
            </p>
            <h1 className="font-display text-5xl leading-[0.98] text-[var(--aurora-text-strong)] md:text-6xl">
              Browse the latest products from the live catalog.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--aurora-text)]">
              Start from the full product feed, open any item by name, and move into the catalog without relying on static mock data.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <LiquidGlassButton as={Link} to="/products" size="hero">
              Browse products
            </LiquidGlassButton>
            {suggestedProduct ? (
              <LiquidGlassButton
                as={Link}
                to={`/products/${suggestedProduct.slug}`}
                variant="secondary"
                size="hero"
              >
                Open suggested product
              </LiquidGlassButton>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )

  return (
    <StorefrontLayout hero={hero} contentClassName="aurora-stack-12">
      <section className="aurora-stack-6">
        <AuroraWidget
          title="Suggested product"
          icon="spark"
          className="aurora-summary-lead p-6 sm:p-8"
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
