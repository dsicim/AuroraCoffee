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
    grind: '',
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
  const previewGrind = previewSelection.productSlug === product.slug ? previewSelection.grind : ''
  const previewWeight = previewSelection.productSlug === product.slug ? previewSelection.weight : ''
  const activePreviewMenu = openPreviewMenu.productSlug === product.slug ? openPreviewMenu.menu : ''

  const handleAddToCart = async () => {
    if (!availability.hasStock) {
      return
    }

    await addCartItem(product)
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
                      Grind
                    </p>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--aurora-text-muted)]">
                      To be implemented
                    </span>
                  </div>
                  <PreviewDropdown
                    value={previewGrind}
                    placeholder="Select grind"
                    options={placeholderGrindOptions}
                    open={activePreviewMenu === 'grind'}
                    onToggle={(nextOpen) => {
                      setOpenPreviewMenu({
                        productSlug: product.slug,
                        menu: nextOpen ? 'grind' : '',
                      })
                    }}
                    onSelect={(option) => {
                      setPreviewSelection({
                        productSlug: product.slug,
                        grind: option,
                        weight: '',
                      })
                    }}
                  />
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
                          grind: current.productSlug === product.slug ? current.grind : '',
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
              </div>
              <span
                className={`aurora-pill px-4 py-2 text-sm font-semibold ${
                  availability.hasStock ? 'aurora-pill-active' : ''
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
