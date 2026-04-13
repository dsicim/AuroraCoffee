import { useEffect, useMemo, useRef, useState } from 'react'
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
import { getTaxInclusionCopy, getUnitPriceBreakdown } from '../lib/tax'

function formatDetailAttribute(value) {
  const normalized = String(value || '').trim()

  if (!normalized) {
    return 'Not provided'
  }

  return normalized
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s*,\s*/g, ', ')
}

function buildAttributeCards(product) {
  if (isCoffeeProduct(product)) {
    return [
      { title: formatDetailAttribute(product.origin), subtitle: 'Origin', icon: 'location' },
      { title: formatDetailAttribute(product.roastLevel), subtitle: 'Roast level', icon: 'coffee' },
      { title: formatDetailAttribute(product.acidity), subtitle: 'Acidity', icon: 'spark' },
    ]
  }

  return [
    { title: formatDetailAttribute(product.material), subtitle: 'Material', icon: 'package' },
    { title: formatDetailAttribute(product.capacity), subtitle: 'Capacity', icon: 'grid' },
    { title: formatDetailAttribute(getProductCategoryLabel(product)), subtitle: 'Category', icon: 'spark' },
  ]
}

const placeholderWeightOptions = ['250 g', '500 g', '1 kg']
const placeholderFilterOptions = ['Whole bean', 'Filter', 'Espresso']

function PreviewDropdown({
  value,
  placeholder,
  options,
  open,
  onToggle,
  onSelect,
}) {
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        onToggle(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [onToggle, open])

  return (
    <div ref={wrapperRef} className="aurora-preview-dropdown mt-3">
      <button
        type="button"
        className={`aurora-preview-trigger ${open ? 'is-open' : ''}`}
        onClick={() => onToggle(!open)}
        aria-expanded={open ? 'true' : 'false'}
      >
        <span className={`aurora-preview-trigger-label ${value ? '' : 'is-placeholder'}`}>
          {value || placeholder}
        </span>
        <span className="aurora-preview-select-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 7 5 5 5-5" />
          </svg>
        </span>
      </button>

      {open ? (
        <div className="aurora-preview-menu">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={`aurora-preview-option ${value === option ? 'is-selected' : ''}`}
              onClick={() => {
                onSelect(option)
                onToggle(false)
              }}
            >
              <span>{option}</span>
              {value === option ? <span className="aurora-preview-check">Selected</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function ProductDetailPage() {
  const { slug } = useParams()
  const { product, loading, error } = useProductBySlug(slug)
  const { products } = useProductCatalog()
  const [feedback, setFeedback] = useState('')
  const [previewSelection, setPreviewSelection] = useState({
    productSlug: '',
    filter: '',
    weight: '',
  })
  const [openPreviewMenu, setOpenPreviewMenu] = useState({
    productSlug: '',
    menu: '',
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
  const previewFilter = previewSelection.productSlug === product.slug ? previewSelection.filter : ''
  const previewWeight = previewSelection.productSlug === product.slug ? previewSelection.weight : ''
  const activePreviewMenu = openPreviewMenu.productSlug === product.slug ? openPreviewMenu.menu : ''
  const requiresCoffeeOptions = isCoffeeProduct(product)
  const hasRequiredCoffeeOptions = !requiresCoffeeOptions || Boolean(previewFilter && previewWeight)
  const priceBreakdown = getUnitPriceBreakdown(product)

  const handleAddToCart = async () => {
    if (!availability.hasStock) {
      return
    }

    if (requiresCoffeeOptions && !hasRequiredCoffeeOptions) {
      setFeedback('Select filter and weight before adding this coffee to cart.')
      return
    }

    const selectedOptions = requiresCoffeeOptions
      ? {
          filter: previewFilter,
          weight: previewWeight,
        }
      : null

    await addCartItem({
      ...product,
      options: selectedOptions,
    })
    setFeedback(`${product.name} was added to cart.`)
  }

  const hero = (
    <section className="aurora-showcase-band px-4 py-6 sm:p-8 lg:p-10">
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
          className="aurora-summary-lead aurora-product-hero-card mx-auto w-full p-5 sm:p-8"
        >
          <AuroraInset className="mb-6">
            <div className="mb-4 flex justify-start sm:justify-end">
              <span className="aurora-chip aurora-product-category-chip">{getProductCategoryLabel(product)}</span>
            </div>
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
          className="aurora-showroom-panel mx-auto w-full p-5 sm:p-8"
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

          <AuroraInset className="relative mt-6 overflow-visible">
            {isCoffeeProduct(product) ? (
              <div className="relative z-20 mb-6 grid gap-5">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      Filter
                    </p>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--aurora-text-muted)]">
                      Read-only in cart
                    </span>
                  </div>
                  <PreviewDropdown
                    value={previewFilter}
                    placeholder="Select filter"
                    options={placeholderFilterOptions}
                    open={activePreviewMenu === 'filter'}
                    onToggle={(nextOpen) => {
                      setOpenPreviewMenu({
                        productSlug: product.slug,
                        menu: nextOpen ? 'filter' : '',
                      })
                    }}
                    onSelect={(option) => {
                      setPreviewSelection({
                        productSlug: product.slug,
                        filter: option,
                        weight: '',
                      })
                    }}
                  />
                </div>

                {previewFilter ? (
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                        Weight
                      </p>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--aurora-text-muted)]">
                        Read-only in cart
                      </span>
                    </div>
                    <PreviewDropdown
                      value={previewWeight}
                      placeholder="Select weight"
                      options={placeholderWeightOptions}
                      open={activePreviewMenu === 'weight'}
                      onToggle={(nextOpen) => {
                        setOpenPreviewMenu({
                          productSlug: product.slug,
                          menu: nextOpen ? 'weight' : '',
                        })
                      }}
                      onSelect={(option) => {
                        setPreviewSelection((current) => ({
                          productSlug: product.slug,
                          filter: current.productSlug === product.slug ? current.filter : '',
                          weight: option,
                        }))
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                  Current price
                </p>
                <p className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {formatCurrency(product.price)}
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                  {getTaxInclusionCopy(product)} · Net {formatCurrency(priceBreakdown.priceNet)} + VAT {formatCurrency(priceBreakdown.taxAmount)}
                </p>
              </div>
              <span
                className={`aurora-stock-badge aurora-stock-badge-detail ${
                  availability.hasStock ? 'is-in-stock' : 'is-out-of-stock'
                }`}
              >
                {availability.hasStock ? `${availability.totalStock} available` : 'Currently unavailable'}
              </span>
            </div>

            <LiquidGlassButton
              type="button"
              onClick={() => {
                void handleAddToCart()
              }}
              disabled={!availability.hasStock || !hasRequiredCoffeeOptions}
              size="hero"
              className="mt-6 w-full"
            >
              {!availability.hasStock
                ? 'Unavailable'
                : requiresCoffeeOptions && !hasRequiredCoffeeOptions
                  ? 'Select options first'
                  : 'Add to cart'}
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
        <section className="aurora-showroom-panel mx-auto w-full p-5 sm:p-8">
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
