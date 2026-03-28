import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getDefaultVariant,
  getMinimumVariantPrice,
  getProductAvailability,
  getVariantCount,
} from '../data/products'
import FavoriteToggleButton from './FavoriteToggleButton'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function renderStars(rating) {
  const roundedRating = Math.round(rating)
  return '★'.repeat(roundedRating) + '☆'.repeat(5 - roundedRating)
}

export default function ProductCard({ product, compact = false }) {
  const [feedback, setFeedback] = useState('')
  const defaultVariant = getDefaultVariant(product)
  const minimumPrice = getMinimumVariantPrice(product)
  const variantCount = getVariantCount(product)
  const availability = getProductAvailability(product)
  const isOutOfStock = !availability.hasStock

  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback('')
    }, 2200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [feedback])

  const handleAddToCart = () => {
    setFeedback(
      isOutOfStock
        ? 'Choose another coffee'
        : `Select a package on the product page before adding ${product.name} to cart.`,
    )
  }

  return (
    <article className="relative rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.92)] p-6 shadow-[0_20px_60px_rgba(140,84,60,0.08)] backdrop-blur">
      <div className="absolute right-6 top-6 z-10">
        <FavoriteToggleButton
          productId={product.id}
          productName={product.name}
          compact
        />
      </div>

      <Link to={`/products/${product.id}`} className="block pr-16">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--aurora-olive-deep)]">
                {product.roast}
              </p>
              <span className="rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.36)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--aurora-olive-deep)]">
                {product.category}
              </span>
            </div>
            <h3 className="mt-2 font-display text-2xl text-[var(--aurora-text-strong)] transition hover:text-[var(--aurora-sky-deep)]">
              {product.name}
            </h3>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isOutOfStock
                ? 'bg-[rgba(217,144,107,0.24)] text-[var(--aurora-text-strong)]'
                : 'bg-[var(--aurora-olive-soft)] text-[var(--aurora-olive-deep)]'
            }`}
          >
            {isOutOfStock
              ? 'All variants sold out'
              : `${availability.totalStock} bags across variants`}
          </span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-[var(--aurora-text-strong)]">
            {product.rating.toFixed(1)}
          </span>
          <span className="text-[var(--aurora-primary)]">
            {renderStars(product.rating)}
          </span>
          <span className="text-[var(--aurora-text)]">
            {product.reviewCount} reviews
          </span>
        </div>

        <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
          {product.description}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {product.notes.map((note) => (
            <span
              key={note}
              className="rounded-full border border-[rgba(122,130,96,0.34)] bg-[rgba(223,227,209,0.28)] px-3 py-1 text-xs text-[var(--aurora-olive-deep)]"
            >
              {note}
            </span>
          ))}
        </div>

        {!compact ? (
          <p className="mt-5 text-sm leading-7 text-[var(--aurora-text)]">
            {product.brewGuide}
          </p>
        ) : null}
      </Link>

      <div className="mt-6 flex items-center justify-between">
        <div>
          <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
            From {formatCurrency(minimumPrice)}
          </p>
          <p className="mt-1 text-sm text-[var(--aurora-text)]">
            {variantCount} variants
            {defaultVariant ? ` · starts with ${defaultVariant.weight}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/products/${product.id}`}
            className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
          >
            View details
          </Link>
          <button
            type="button"
            onClick={handleAddToCart}
            className="rounded-full border border-[#d89270] bg-[var(--aurora-primary)] px-4 py-2 text-sm font-semibold text-[var(--aurora-text-strong)] shadow-[0_10px_24px_rgba(235,176,144,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            Select package
          </button>
        </div>
      </div>

      {feedback ? (
        <p className="mt-4 rounded-[1.25rem] border border-[rgba(138,144,119,0.28)] bg-[rgba(230,232,222,0.5)] px-4 py-3 text-sm font-medium text-[var(--aurora-olive-deep)]">
          {feedback}
        </p>
      ) : null}
    </article>
  )
}
