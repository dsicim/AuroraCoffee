import { Link } from 'react-router-dom'
import RoleOverviewLayout from '../components/RoleOverviewLayout'
import {
  getProductAvailability,
  products,
} from '../data/products'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export default function ProductManagerPage() {
  const totalVariants = products.reduce(
    (total, product) => total + product.variants.length,
    0,
  )
  const lowStockVariants = products.flatMap((product) =>
    product.variants
      .filter((variant) => variant.stock > 0 && variant.stock <= 3)
      .map((variant) => ({
        ...variant,
        productName: product.name,
      })),
  )
  const soldOutProducts = products.filter(
    (product) => !getProductAvailability(product).hasStock,
  )
  const categoryCount = new Set(products.map((product) => product.category)).size
  const featuredCount = products.filter((product) => product.featured).length
  const highestStockProduct = [...products]
    .sort(
      (left, right) =>
        getProductAvailability(right).totalStock - getProductAvailability(left).totalStock,
    )[0]

  return (
    <RoleOverviewLayout
      eyebrow="Product manager"
      title="Keep the catalog coherent, stocked, and ready to extend"
      description="This landing page is centered on catalog health: product coverage, low-stock visibility, and the structure needed for future variant and merchandising work."
    >
      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Products
              </p>
              <p className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                {products.length}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                Distinct coffees currently visible in the storefront.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Variants
              </p>
              <p className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                {totalVariants}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                Weight and grind combinations currently defined.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Low stock
              </p>
              <p className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                {lowStockVariants.length}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                Variants with 3 or fewer bags remaining.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Sold out
              </p>
              <p className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                {soldOutProducts.length}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                Products with no remaining stock across all variants.
              </p>
            </div>
          </section>

          <section
            id="stock-watch"
            className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Stock watch
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Variants that need attention first
                </h2>
              </div>
              <Link
                to="/products"
                className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
              >
                View live catalog
              </Link>
            </div>

            {!lowStockVariants.length ? (
              <div className="mt-8 rounded-[2rem] border border-dashed border-[rgba(138,144,119,0.35)] bg-[rgba(255,247,242,0.72)] px-6 py-10 text-center">
                <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                  No low-stock variants right now
                </p>
                <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                  The current demo catalog has breathing room across its variant mix.
                </p>
              </div>
            ) : (
              <div className="mt-8 space-y-4">
                {lowStockVariants
                  .sort((left, right) => left.stock - right.stock)
                  .slice(0, 6)
                  .map((variant) => (
                    <article
                      key={variant.id}
                      className="rounded-[1.75rem] border border-[rgba(138,144,119,0.18)] bg-[rgba(255,247,242,0.94)] p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-[var(--aurora-text-strong)]">
                            {variant.productName}
                          </p>
                          <p className="mt-1 text-sm text-[var(--aurora-text)]">
                            {variant.weight} / {variant.grind}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                          {variant.stock} left
                        </p>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
              Catalog pulse
            </p>
            <div className="mt-6 space-y-4 text-sm leading-7 text-[var(--aurora-text)]">
              <div className="rounded-[1.5rem] border border-[rgba(138,144,119,0.18)] bg-[rgba(255,247,242,0.94)] px-5 py-4">
                <p className="font-semibold text-[var(--aurora-text-strong)]">
                  Category coverage
                </p>
                <p className="mt-2">{categoryCount} customer-facing categories are currently represented.</p>
              </div>
              <div className="rounded-[1.5rem] border border-[rgba(138,144,119,0.18)] bg-[rgba(255,247,242,0.94)] px-5 py-4">
                <p className="font-semibold text-[var(--aurora-text-strong)]">
                  Featured releases
                </p>
                <p className="mt-2">{featuredCount} coffees are carrying the curated first-screen placement.</p>
              </div>
              <div className="rounded-[1.5rem] border border-[rgba(138,144,119,0.18)] bg-[rgba(255,247,242,0.94)] px-5 py-4">
                <p className="font-semibold text-[var(--aurora-text-strong)]">
                  Highest stock product
                </p>
                <p className="mt-2">
                  {highestStockProduct?.name || 'No product data'} ·{' '}
                  {formatCurrency(highestStockProduct ? highestStockProduct.variants.reduce((total, variant) => total + variant.price, 0) : 0)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.44)] p-8 shadow-[0_24px_70px_rgba(138,144,119,0.1)] backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
              Quick actions
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#stock-watch"
                className="rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-5 py-3 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_10px_24px_rgba(144,180,196,0.22)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
              >
                Review low stock
              </a>
              <Link
                to="/products"
                className="rounded-full border border-[#d89270] bg-[var(--aurora-primary)] px-5 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] shadow-[0_10px_24px_rgba(235,176,144,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-primary-soft)]"
              >
                Open catalog
              </Link>
              <Link
                to="/"
                className="rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.92)] px-5 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-cream)]"
              >
                Browse storefront
              </Link>
            </div>
          </section>
        </div>
      </div>
    </RoleOverviewLayout>
  )
}
