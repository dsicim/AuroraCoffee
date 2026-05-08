import { Link } from 'react-router-dom'
import { formatCurrency } from '../../../lib/currency'
import {
  formatDiscountRate,
  getDiscountPricing,
  getProductStartingPrice,
  hasPriceChangingChoices,
} from '../../../lib/pricing'
import {
  getProductAvailability,
  getProductCategoryLabel,
  getProductFlavorNotes,
  getProductMetaLine,
  getProductTypeLabel,
  isCoffeeProduct,
} from '../../../lib/products'
import { getTaxInclusionCopy } from '../../../lib/tax'
import { getGeneratedProductImageUrl } from '../domain/generatedProductImages'
import FavoriteToggleButton from '../../../components/FavoriteToggleButton'
import LiquidGlassButton from '../../../shared/components/ui/LiquidGlassButton'
import LiquidGlassFrame from '../../../shared/components/ui/LiquidGlassFrame'
import ProductMedia from './ProductMedia'

function keepHyphenatedWordsTogether(value) {
  return String(value || '').replaceAll('-', '\u2011')
}

function formatProductRating(value) {
  const rating = Number(value)

  if (!Number.isFinite(rating) || rating <= 0) {
    return 'No rating'
  }

  return `${Number.isInteger(rating) ? rating : rating.toFixed(1)} / 5`
}

export default function ProductCard({ product, compact = false }) {
  const availability = getProductAvailability(product)
  const isOutOfStock = !availability.hasStock
  const notes = getProductFlavorNotes(product)
  const metaLine = getProductMetaLine(product)
  const detailRoute = `/products/${product.slug}`
  const typeLabel = getProductTypeLabel(product)
  const categoryLabel = getProductCategoryLabel(product)
  const showCategory = categoryLabel && categoryLabel !== typeLabel
  const ratingLabel = formatProductRating(product.averageRating)
  const generatedCardImage = getGeneratedProductImageUrl(product)
  const cardImages = generatedCardImage
    ? [
        {
          key: `${product.slug || product.id || 'product'}-card`,
          src: generatedCardImage,
          alt: product.name ? `${product.name} product image` : 'Aurora Coffee product image',
        },
      ]
    : []
  const hasStartingPrice = hasPriceChangingChoices(product)
  const discountPricing = getDiscountPricing({
    price: hasStartingPrice ? getProductStartingPrice(product) : product.price,
    discountRate: product.discountRate,
  })

  return (
    <LiquidGlassFrame
      as="article"
      className="aurora-bento-card glass-card aurora-product-card"
      contentClassName="flex h-full flex-col gap-5 p-5 sm:p-6"
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_60%)]" />

      <Link
        to={detailRoute}
        className="aurora-product-card-media-link"
        aria-label={`View ${product.name}`}
      >
        <ProductMedia
          product={product}
          images={cardImages}
          showControls={false}
          showDots={false}
          className="is-card"
        />
      </Link>

      <Link to={detailRoute} className="block flex-1">
        <div className="aurora-widget-body h-full">
          <div className="aurora-widget-heading">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="aurora-kicker">{typeLabel}</p>
              {showCategory ? (
                <span className="aurora-chip text-[10px] tracking-[0.18em]">
                  {categoryLabel}
                </span>
              ) : null}
              <span className="aurora-chip text-[10px] tracking-[0.18em]">
                {ratingLabel}
              </span>
            </div>
            <h3 className="aurora-heading mt-1 text-3xl transition hover:text-[var(--aurora-sky-deep)]">
              {product.name}
            </h3>
          </div>

          <div className="aurora-widget-meta text-sm">
            <span
              className={`aurora-stock-badge aurora-stock-badge-compact ${
                isOutOfStock ? 'is-out-of-stock' : 'is-in-stock'
              }`}
            >
              {isOutOfStock
                ? 'Out of stock'
                : `${availability.totalStock} unit${availability.totalStock === 1 ? '' : 's'} available`}
            </span>
            {metaLine ? (
              <span className="text-sm font-medium text-[var(--aurora-text)]">
                {metaLine}
              </span>
            ) : null}
          </div>

          <div className="aurora-widget-subsurface aurora-product-card-copy-surface p-4">
            <div className="aurora-widget-body">
              <p className="aurora-product-card-description text-sm leading-7 text-[var(--aurora-text)]">
                {keepHyphenatedWordsTogether(product.description)}
              </p>

              {notes.length ? (
                <div className="aurora-product-card-notes flex flex-wrap gap-2">
                  {notes.map((note) => (
                    <span
                      key={note}
                      className="aurora-product-card-note rounded-full border px-3 py-1 text-xs font-medium"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              ) : null}

              {!compact && isCoffeeProduct(product) && product.origin ? (
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  {product.origin}
                  {product.acidity ? ` · ${product.acidity} acidity` : ''}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </Link>

      <div className="aurora-product-card-favorite">
        <FavoriteToggleButton
          productId={product.slug}
          productName={product.name}
          compact
        />
      </div>

      <div className="aurora-widget-subsurface aurora-product-card-commerce-surface mt-auto p-4">
        <div className="aurora-product-card-commerce">
          <div>
            <p className="aurora-product-card-price-label text-xs font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
              {hasStartingPrice ? 'Starting from' : 'Price'}
            </p>
            {discountPricing.hasDiscount ? (
              <div
                className="aurora-product-card-price-stack mt-2"
                aria-label={`Discounted price ${formatCurrency(discountPricing.currentPrice)}, original price ${formatCurrency(discountPricing.originalPrice)}`}
              >
                <div className="aurora-product-card-sale-row">
                  <p className="aurora-product-card-price font-display text-3xl text-[var(--aurora-text-strong)]">
                    {formatCurrency(discountPricing.currentPrice)}
                  </p>
                  <span className="aurora-product-card-discount-badge">
                    -{formatDiscountRate(discountPricing.discountRate)}%
                  </span>
                </div>
                <p className="aurora-product-card-original-price">
                  {formatCurrency(discountPricing.originalPrice)}
                </p>
              </div>
            ) : (
              <p className="aurora-product-card-price mt-2 font-display text-3xl text-[var(--aurora-text-strong)]">
                {formatCurrency(discountPricing.currentPrice)}
              </p>
            )}
            <p className="text-sm text-[var(--aurora-text)]">
              {getTaxInclusionCopy(product)}
            </p>
            {product.material || product.capacity ? (
              <p className="text-sm text-[var(--aurora-text)]">
                {[product.material, product.capacity].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>

          <div className="aurora-widget-actions aurora-product-card-actions">
            <Link to={detailRoute} className="aurora-link aurora-product-card-details-link text-sm">
              Details
            </Link>
            <LiquidGlassButton
              as={Link}
              to={detailRoute}
              size="compact"
              className="aurora-product-card-choose-button"
            >
              Choose
            </LiquidGlassButton>
          </div>
        </div>
      </div>
    </LiquidGlassFrame>
  )
}
