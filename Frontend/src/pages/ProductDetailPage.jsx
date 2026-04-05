import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AuroraWidget, { AuroraInset } from '../components/AuroraWidget'
import FavoriteToggleButton from '../components/FavoriteToggleButton'
import LiquidGlassButton from '../components/LiquidGlassButton'
import ProductCard from '../components/ProductCard'
import StorefrontLayout from '../components/StorefrontLayout'
import { addCartItem } from '../lib/cart'
import { formatCurrency } from '../lib/currency'
import {
  getProductAvailability,
  getProductCategoryLabel,
  getProductFlavorNotes,
  getProductMetaLine,
  getProductTypeLabel,
  getRelatedProducts,
  isCoffeeProduct,
  useProductBySlug,
  useProductCatalog,
} from '../lib/products'

function buildAttributeCards(product) {
  if (isCoffeeProduct(product)) {
    return [
      { title: product.origin || 'Not provided', subtitle: 'Origin', icon: 'location' },
      { title: product.roastLevel || 'Not provided', subtitle: 'Roast level', icon: 'coffee' },
      { title: product.acidity || 'Not provided', subtitle: 'Acidity', icon: 'spark' },
    ]
  }

  return [
    { title: product.material || 'Not provided', subtitle: 'Material', icon: 'package' },
    { title: product.capacity || 'Not provided', subtitle: 'Capacity', icon: 'grid' },
    { title: getProductCategoryLabel(product), subtitle: 'Category', icon: 'spark' },
  ]
}

const placeholderWeightOptions = ['250 g', '500 g', '1 kg']
const placeholderGrindOptions = ['Whole bean', 'Pour over', 'Espresso']

export default function ProductDetailPage() {
  const { slug } = useParams()
  const { product, loading, error } = useProductBySlug(slug)
  const { products } = useProductCatalog()
  const [feedback, setFeedback] = useState('')
  const [previewSelection, setPreviewSelection] = useState({
    productSlug: '',
    grind: '',
    weight: '',
  })

  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback('')
    }, 2400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [feedback])

  const relatedProducts = useMemo(
    () => (product ? getRelatedProducts(products, product) : []),
    [product, products],
  )

  if (loading) {
    const hero = (
      <section className="aurora-showcase-band px-6 py-12 text-center sm:px-8 lg:px-10">
        <p className="aurora-kicker">Loading product</p>
        <h1 className="mt-4 font-display text-5xl text-[var(--aurora-text-strong)]">
          Loading product details
        </h1>
      </section>
    )

    return <StorefrontLayout hero={hero} />
  }

  if (!product) {
    const hero = (
      <section className="aurora-showcase-band px-6 py-12 text-center sm:px-8 lg:px-10">
        <p className="aurora-kicker">Product unavailable</p>
        <h1 className="mt-4 font-display text-5xl text-[var(--aurora-text-strong)]">
          That product could not be found
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--aurora-text)]">
          {error || 'The requested product route does not match the live catalog.'}
        </p>
        <div className="mt-8 flex justify-center">
          <LiquidGlassButton as={Link} to="/products" size="hero">
            Back to products
          </LiquidGlassButton>
        </div>
      </section>
    )

    return <StorefrontLayout hero={hero} />
  }

  const availability = getProductAvailability(product)
  const notes = getProductFlavorNotes(product)
  const attributeCards = buildAttributeCards(product)
  const previewGrind = previewSelection.productSlug === product.slug ? previewSelection.grind : ''
  const previewWeight = previewSelection.productSlug === product.slug ? previewSelection.weight : ''

  const handleAddToCart = () => {
    if (!availability.hasStock) {
      return
    }

    addCartItem(product)
    setFeedback(`${product.name} was added to cart.`)
  }

  const hero = (
    <section className="aurora-showcase-band p-6 sm:p-8 lg:p-10">
      <div className="aurora-crumbs">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/products">Products</Link>
        <span>/</span>
        <span className="font-semibold text-[var(--aurora-text-strong)]">{product.name}</span>
      </div>

      <div className="mt-6 aurora-page-intro-split lg:items-start">
        <AuroraWidget
          title={product.name}
          subtitle={getProductTypeLabel(product)}
          icon="coffee"
          className="aurora-summary-lead p-6 sm:p-8"
          headerAside={<span className="aurora-chip">{getProductCategoryLabel(product)}</span>}
        >
          <AuroraInset className="mb-6">
            {getProductMetaLine(product) ? (
              <p className="text-sm text-[var(--aurora-text)]">{getProductMetaLine(product)}</p>
            ) : null}
            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--aurora-text)]">
              {product.description}
            </p>
          </AuroraInset>
        </AuroraWidget>

        <AuroraWidget
          title="Product details"
          subtitle={getProductCategoryLabel(product)}
          icon="spark"
          className="aurora-showroom-panel p-6 sm:p-8"
          headerAside={<FavoriteToggleButton productId={product.slug} productName={product.name} />}
        >
          <AuroraInset className="mt-1">
            {notes.length ? (
              <div className="flex flex-wrap gap-2">
                {notes.map((note) => (
                  <span key={note} className="aurora-chip">
                    {note}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-base leading-8 text-[var(--aurora-text)]">
                {product.description}
              </p>
            )}
          </AuroraInset>

          <AuroraInset className="mt-6">
            {isCoffeeProduct(product) ? (
              <div className="mb-6 grid gap-5">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      Grind
                    </p>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--aurora-text-muted)]">
                      To be implemented
                    </span>
                  </div>
                  <select
                    value={previewGrind}
                    onChange={(event) => {
                      setPreviewSelection({
                        productSlug: product.slug,
                        grind: event.target.value,
                        weight: '',
                      })
                    }}
                    className="aurora-select mt-3"
                  >
                    <option value="">Select grind</option>
                    {placeholderGrindOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {previewGrind ? (
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                        Weight
                      </p>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--aurora-text-muted)]">
                        To be implemented
                      </span>
                    </div>
                    <select
                      value={previewWeight}
                      onChange={(event) => {
                        setPreviewSelection((current) => ({
                          productSlug: product.slug,
                          grind: current.productSlug === product.slug ? current.grind : '',
                          weight: event.target.value,
                        }))
                      }}
                      className="aurora-select mt-3"
                    >
                      <option value="">Select weight</option>
                      {placeholderWeightOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                  Current price
                </p>
                <p className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {formatCurrency(product.price)}
                </p>
              </div>
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  availability.hasStock
                    ? 'bg-[var(--aurora-olive-soft)] text-[var(--aurora-olive-deep)]'
                    : 'bg-[rgba(217,144,107,0.24)] text-[var(--aurora-text-strong)]'
                }`}
              >
                {availability.hasStock ? `${availability.totalStock} available` : 'Currently unavailable'}
              </span>
            </div>

            <LiquidGlassButton
              type="button"
              onClick={handleAddToCart}
              disabled={!availability.hasStock}
              size="hero"
              className="mt-6 w-full"
            >
              {availability.hasStock ? 'Add to cart' : 'Unavailable'}
            </LiquidGlassButton>

            {feedback ? (
              <p className="aurora-message aurora-message-success mt-4">{feedback}</p>
            ) : null}
          </AuroraInset>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {attributeCards.map((card) => (
              <AuroraWidget
                key={card.subtitle}
                title={card.title}
                subtitle={card.subtitle}
                icon={card.icon}
                className="aurora-showroom-subpanel p-5"
              />
            ))}
          </div>
        </AuroraWidget>
      </div>
    </section>
  )

  return (
    <StorefrontLayout hero={hero} contentClassName="aurora-stack-12">
      {relatedProducts.length ? (
        <section className="aurora-showroom-panel p-6 sm:p-8">
          <p className="aurora-kicker">Related products</p>
          <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
            More from the catalog
          </h2>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard
                key={relatedProduct.slug}
                product={relatedProduct}
                compact
              />
            ))}
          </div>
        </section>
      ) : null}
    </StorefrontLayout>
  )
}
