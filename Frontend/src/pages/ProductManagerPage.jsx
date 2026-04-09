import { Link } from 'react-router-dom'
import LiquidGlassButton from '../components/LiquidGlassButton'
import RoleOverviewLayout from '../components/RoleOverviewLayout'
import { formatCurrency } from '../lib/currency'
import { getProductAvailability, getProductCategories, useProductCatalog } from '../lib/products'

export default function ProductManagerPage() {
  const { products, loaded, loading, error } = useProductCatalog()
  const lowStockProducts = products.filter(
    (product) => product.stock > 0 && product.stock <= 3,
  )
  const soldOutProducts = products.filter(
    (product) => !getProductAvailability(product).hasStock,
  )
  const categories = getProductCategories(products)
  const highestStockProduct = [...products].sort((left, right) => right.stock - left.stock)[0]

  return (
    <RoleOverviewLayout
      eyebrow="Product manager"
      title="Keep the catalog coherent, stocked, and ready to extend"
      description="This landing page is centered on the live catalog: product coverage, low-stock visibility, and current inventory state."
    >
      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          <section className="aurora-summary-strip">
            <div className="aurora-summary-lead p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="aurora-kicker">Catalog health</p>
                  <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                    {loading ? 'Loading' : `${lowStockProducts.length} low-stock product${lowStockProducts.length === 1 ? '' : 's'}`}
                  </h2>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  {error || 'Inventory risk is derived from the current backend product feed.'}
                </p>
              </div>
            </div>

            <div className="aurora-summary-card p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Products
                  </p>
                  <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                    {loaded ? products.length : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="aurora-summary-card p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Categories
                  </p>
                  <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                    {loaded ? Math.max(0, categories.length - 1) : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="aurora-summary-card p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Sold out
                  </p>
                  <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                    {loaded ? soldOutProducts.length : '—'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section id="stock-watch" className="aurora-ops-panel p-8">
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Stock watch
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Products that need attention first
                </h2>
              </div>
              <Link
                to="/products"
                className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
              >
                View live catalog
              </Link>
            </div>

            {!lowStockProducts.length ? (
              <div className="aurora-ops-card mt-8 border-dashed px-6 py-10 text-center">
                <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                  No low-stock products right now
                </p>
              </div>
            ) : (
              <div className="mt-8 space-y-4">
                {lowStockProducts
                  .sort((left, right) => left.stock - right.stock)
                  .slice(0, 6)
                  .map((product) => (
                    <article key={product.slug} className="aurora-ops-card p-5">
                      <div className="aurora-widget-header">
                        <div className="aurora-widget-heading">
                          <p className="font-semibold text-[var(--aurora-text-strong)]">
                            {product.name}
                          </p>
                          <p className="text-sm text-[var(--aurora-text)]">
                            {product.categoryName || product.parentCategoryName || 'Catalog'}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                          {product.stock} left
                        </p>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section className="aurora-ops-panel p-8">
            <div className="aurora-widget-body">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Catalog pulse
                </p>
              </div>
              <div className="space-y-4 text-sm leading-7 text-[var(--aurora-text)]">
                <div className="aurora-ops-card px-5 py-4">
                  <p className="font-semibold text-[var(--aurora-text-strong)]">
                    Category coverage
                  </p>
                  <p className="mt-2">{Math.max(0, categories.length - 1)} customer-facing categories are currently represented.</p>
                </div>
                <div className="aurora-ops-card px-5 py-4">
                  <p className="font-semibold text-[var(--aurora-text-strong)]">
                    Highest stock product
                  </p>
                  <p className="mt-2">
                    {highestStockProduct?.name || 'No product data'} · {highestStockProduct ? formatCurrency(highestStockProduct.price) : formatCurrency(0)}
                  </p>
                </div>
                <div className="aurora-ops-card px-5 py-4">
                  <p className="font-semibold text-[var(--aurora-text-strong)]">
                    Loading state
                  </p>
                  <p className="mt-2">{loading ? 'Syncing backend catalog.' : error || 'Backend-backed catalog is active.'}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="aurora-solid-plate rounded-[2.5rem] p-8">
            <div className="aurora-widget-body">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Quick actions
                </p>
              </div>
              <div className="aurora-widget-actions">
                <LiquidGlassButton as="a" href="#stock-watch" variant="secondary">
                  Review low stock
                </LiquidGlassButton>
                <LiquidGlassButton as={Link} to="/products" variant="secondary">
                  Open catalog
                </LiquidGlassButton>
                <LiquidGlassButton as={Link} to="/" variant="quiet">
                  Browse site
                </LiquidGlassButton>
              </div>
            </div>
          </section>
        </div>
      </div>
    </RoleOverviewLayout>
  )
}
