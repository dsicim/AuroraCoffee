import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import AuroraWidget, { AuroraInset } from '../components/AuroraWidget'
import FavoriteToggleButton from '../components/FavoriteToggleButton'
import LiquidGlassButton from '../components/LiquidGlassButton'
import ProductCard from '../components/ProductCard'
import StorefrontLayout from '../components/StorefrontLayout'
import { authChangeEvent, getAuthSession } from '../lib/auth'
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

function getReviewStorageKey(slug) {
  return `aurora-product-review-preview:${slug}`
}

function normalizeOptionCode(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

function getOptionGroupKey(group) {
  return normalizeOptionCode(group?.code || group?.id || group?.name)
}

function getOptionValueCode(optionValue) {
  return normalizeOptionCode(optionValue?.valueCode || optionValue?.id || optionValue?.label)
}

function getResolvedOptionSelections(optionGroups, selectedValues) {
  const normalizedSelectedValues =
    selectedValues && typeof selectedValues === 'object' ? selectedValues : {}

  return Object.fromEntries(
    (optionGroups || []).map((group) => {
      const groupKey = getOptionGroupKey(group)
      const selectedValue = normalizeOptionCode(normalizedSelectedValues[groupKey])
      const fallbackValue =
        group?.values?.length === 1
          ? getOptionValueCode(group.values[0])
          : ''

      return [groupKey, selectedValue || fallbackValue]
    }),
  )
}

function getSelectedOptionRecords(optionGroups, selectedValues) {
  return (optionGroups || [])
    .map((group) => {
      const selectedCode = normalizeOptionCode(selectedValues[getOptionGroupKey(group)])

      if (!selectedCode) {
        return null
      }

      const value = (group.values || []).find(
        (optionValue) => getOptionValueCode(optionValue) === selectedCode,
      )

      if (!value) {
        return null
      }

      return { group, value }
    })
    .filter(Boolean)
}

function getMatchingVariant(product, optionGroups, selectedValues) {
  const relevantGroups = (optionGroups || []).filter((group) => group.storeAsVariant)

  if (!product?.variants?.length || !relevantGroups.length) {
    return null
  }

  const selectedVariantCodes = relevantGroups
    .map((group) => normalizeOptionCode(selectedValues[getOptionGroupKey(group)]))
    .filter(Boolean)

  if (!selectedVariantCodes.length) {
    return null
  }

  return product.variants.find((variant) => {
    const variantCodes = Object.values(variant?.optionValueCodes || {})
      .map((value) => normalizeOptionCode(value))
      .filter(Boolean)

    if (variantCodes.length) {
      return selectedVariantCodes.every((code) => variantCodes.includes(code))
    }

    return relevantGroups.length === 1 &&
      normalizeOptionCode(variant?.variantCode) === selectedVariantCodes[0]
  }) || null
}

function getDisplayPrice(product, selectedOptionRecords, matchingVariant) {
  let nextPrice = Number(matchingVariant?.price)

  if (!Number.isFinite(nextPrice)) {
    nextPrice = Number(product?.price) || 0
  }

  for (const record of selectedOptionRecords || []) {
    if (record.group?.storeAsVariant) {
      continue
    }

    nextPrice += Number(record.value?.priceAdd) || 0
    nextPrice *= Number(record.value?.priceMult) || 1
  }

  return Math.round(nextPrice * 100) / 100
}

function formatOptionPriceDelta(optionValue, selectedOptionValue, basePrice = 0) {
  const priceAdd = Number(optionValue?.priceAdd) || 0
  const priceMult = Number(optionValue?.priceMult) || 1
  const selectedPriceAdd = Number(selectedOptionValue?.priceAdd) || 0
  const selectedPriceMult = Number(selectedOptionValue?.priceMult) || 1
  const normalizedBasePrice = Number(basePrice) || 0

  const optionTotal = (normalizedBasePrice + priceAdd) * priceMult
  const selectedTotal = (normalizedBasePrice + selectedPriceAdd) * selectedPriceMult
  const delta = Math.round((optionTotal - selectedTotal) * 100) / 100

  if (!selectedOptionValue) {
    if (priceAdd > 0) {
      return `+${formatCurrency(priceAdd)}`
    }

    if (priceAdd < 0) {
      return `-${formatCurrency(Math.abs(priceAdd))}`
    }

    if (priceMult > 1) {
      return `x${priceMult.toFixed(2)}`
    }

    return ''
  }

  if (Math.abs(delta) < 0.01) {
    return ''
  }

  if (delta > 0) {
    return `+${formatCurrency(delta)}`
  }

  return `-${formatCurrency(Math.abs(delta))}`
}

function buildSelectedOptionsSnapshot(selectedOptionRecords) {
  if (!selectedOptionRecords?.length) {
    return null
  }

  return Object.fromEntries(
    selectedOptionRecords.map(({ group, value }) => [group.name, value.label]),
  )
}

function buildSelectedOptionCodes(selectedOptionRecords) {
  if (!selectedOptionRecords?.length) {
    return null
  }

  return Object.fromEntries(
    selectedOptionRecords.map(({ group, value }) => [group.code || group.id, value.valueCode || value.id]),
  )
}

function loadStoredReviews(slug) {
  if (!slug) {
    return []
  }

  try {
    const rawReviews = window.localStorage.getItem(getReviewStorageKey(slug))
    const parsedReviews = rawReviews ? JSON.parse(rawReviews) : []

    if (!Array.isArray(parsedReviews)) {
      return []
    }

    return parsedReviews
      .filter((review) => typeof review?.comment === 'string' && Number.isFinite(review?.rating))
      .slice(0, 6)
  } catch {
    return []
  }
}

function formatReviewDate(value) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return 'Just now'
  }
}

function formatReviewScore(value) {
  if (!value) {
    return '0'
  }

  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function getStarFillPercent(value, starNumber) {
  const fill = Math.max(0, Math.min(1, value - (starNumber - 1)))
  return fill * 100
}

function ReviewStar({ fillPercent }) {
  return (
    <span className="aurora-review-star" aria-hidden="true">
      <svg className="aurora-review-star-outline" viewBox="0 0 24 24" fill="none">
        <path
          d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.4l6-.9Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="aurora-review-star-fill-shell"
        style={{ clipPath: `inset(0 ${100 - fillPercent}% 0 0)` }}
      >
        <svg className="aurora-review-star-fill" viewBox="0 0 24 24" fill="currentColor">
          <path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.4l6-.9Z" />
        </svg>
      </span>
    </span>
  )
}

function ReviewStars({ value, compact = false, className = '' }) {
  return (
    <div
      className={`aurora-review-stars ${compact ? 'is-compact' : ''} ${className}`.trim()}
      aria-hidden="true"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <ReviewStar
          key={index + 1}
          fillPercent={getStarFillPercent(value, index + 1)}
        />
      ))}
    </div>
  )
}

function ReviewRatingInput({
  value,
  hoverValue,
  onChange,
  onHoverChange,
}) {
  const activeValue = hoverValue || value

  return (
    <div
      className="aurora-review-rating-picker"
      onMouseLeave={() => {
        onHoverChange(0)
      }}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const starNumber = index + 1
        const leftStep = starNumber - 0.5
        const rightStep = starNumber

        return (
          <div key={starNumber} className="aurora-review-input-star">
            <ReviewStar fillPercent={getStarFillPercent(activeValue, starNumber)} />
            <div className="aurora-review-star-hitbox">
              {[leftStep, rightStep].map((step, stepIndex) => (
                <button
                  key={step}
                  type="button"
                  className={`aurora-review-step-button ${value === step ? 'is-selected' : ''} ${stepIndex === 0 ? 'is-left' : 'is-right'}`}
                  aria-label={`Rate ${step} out of 5`}
                  aria-pressed={value === step ? 'true' : 'false'}
                  onMouseEnter={() => {
                    onHoverChange(step)
                  }}
                  onFocus={() => {
                    onHoverChange(step)
                  }}
                  onBlur={() => {
                    onHoverChange(0)
                  }}
                  onClick={() => {
                    onChange(step)
                  }}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ProductReviewPanel({ product }) {
  const location = useLocation()
  const reviewTextareaRef = useRef(null)
  const [session, setSession] = useState(() => getAuthSession())
  const [reviewRating, setReviewRating] = useState(0)
  const [hoverReviewRating, setHoverReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [localReviews, setLocalReviews] = useState(() => loadStoredReviews(product.slug))
  const hasSession = Boolean(session?.token)

  useEffect(() => {
    const syncSession = () => {
      setSession(getAuthSession())
    }

    window.addEventListener('storage', syncSession)
    window.addEventListener(authChangeEvent, syncSession)

    return () => {
      window.removeEventListener('storage', syncSession)
      window.removeEventListener(authChangeEvent, syncSession)
    }
  }, [])

  useEffect(() => {
    if (!reviewFeedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setReviewFeedback('')
    }, 2800)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [reviewFeedback])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        getReviewStorageKey(product.slug),
        JSON.stringify(localReviews),
      )
    } catch {
      return undefined
    }

    return undefined
  }, [localReviews, product.slug])

  useEffect(() => {
    const textarea = reviewTextareaRef.current

    if (!textarea) {
      return undefined
    }

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(textarea.scrollHeight, 136)}px`
    return undefined
  }, [reviewComment, product.slug])

  const reviewAverage = useMemo(() => {
    if (!localReviews.length) {
      return 0
    }

    const totalRating = localReviews.reduce((sum, review) => sum + review.rating, 0)
    return totalRating / localReviews.length
  }, [localReviews])

  const activeReviewValue = hoverReviewRating || reviewRating || reviewAverage

  const handleReviewSubmit = (event) => {
    event.preventDefault()

    const trimmedComment = reviewComment.trim()

    if (!reviewRating) {
      setReviewFeedback('Choose a half-step rating before posting your comment.')
      return
    }

    if (!trimmedComment) {
      setReviewFeedback('Write a short comment before posting it.')
      return
    }

    setLocalReviews((current) => [
      {
        id: `preview-${Date.now()}`,
        author: 'You',
        rating: reviewRating,
        comment: trimmedComment,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 6))
    setReviewRating(0)
    setHoverReviewRating(0)
    setReviewComment('')
    setReviewFeedback('Your comment was added to this browser preview.')
  }

  return (
    <AuroraWidget
      title="Share your take"
      subtitle="Half-step rating and quick comment"
      icon="star"
      className="aurora-showroom-panel aurora-product-review-panel mx-auto w-full p-5 sm:p-8"
    >
      <AuroraInset className="aurora-review-metrics">
        <div>
          <p className="aurora-kicker">Customer pulse</p>
          <p className="mt-3 font-display text-5xl text-[var(--aurora-text-strong)]">
            {formatReviewScore(reviewAverage)}
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
            {localReviews.length
              ? `${localReviews.length} saved ${localReviews.length === 1 ? 'comment' : 'comments'} for this product in this browser.`
              : 'No comments yet. Set the first half-step rating below.'}
          </p>
        </div>
        <div className="aurora-review-metrics-side">
          <ReviewStars value={activeReviewValue} />
          <span className="aurora-review-score-pill">
            {reviewRating ? `${formatReviewScore(reviewRating)} / 5 selected` : 'Tap a star to rate'}
          </span>
        </div>
      </AuroraInset>

      {hasSession ? (
        <form className="aurora-review-form" onSubmit={handleReviewSubmit}>
          <AuroraInset>
            <div className="aurora-review-form-heading">
              <div>
                <p className="aurora-kicker">Your rating</p>
                <h4 className="mt-3 text-2xl font-semibold text-[var(--aurora-text-strong)]">
                  {reviewRating ? `${formatReviewScore(reviewRating)} out of 5` : 'Pick a score'}
                </h4>
              </div>
              <span className="aurora-review-score-pill">Half-step stars</span>
            </div>

            <ReviewRatingInput
              value={reviewRating}
              hoverValue={hoverReviewRating}
              onChange={setReviewRating}
              onHoverChange={setHoverReviewRating}
            />

            <div className="aurora-review-rating-scale">
              <span>Needs work</span>
              <span>Outstanding</span>
            </div>
          </AuroraInset>

          <AuroraInset>
            <label htmlFor="product-review-comment" className="aurora-review-label">
              Comment
            </label>
            <textarea
              id="product-review-comment"
              ref={reviewTextareaRef}
              className="aurora-review-textarea"
              rows="5"
              maxLength="320"
              placeholder={`What stands out about ${product.name}? Mention taste, build quality, or how it fits into your routine.`}
              value={reviewComment}
              onChange={(event) => {
                setReviewComment(event.target.value)
              }}
            />

            <div className="aurora-review-form-footer">
              <p className="text-sm leading-7 text-[var(--aurora-text)]">
                {reviewComment.length}/320 characters
              </p>
              <LiquidGlassButton type="submit" size="compact">
                Post comment
              </LiquidGlassButton>
            </div>
          </AuroraInset>
        </form>
      ) : (
        <AuroraInset className="aurora-review-login-prompt">
          <p className="aurora-kicker">Members only</p>
          <h4 className="mt-3 text-2xl font-semibold text-[var(--aurora-text-strong)]">
            Sign in to leave a rating or comment.
          </h4>
          <p className="mt-3 max-w-2xl text-base leading-8 text-[var(--aurora-text)]">
            Guests can browse the visible comments here, but posting feedback is limited to signed-in customers.
          </p>
          <div className="mt-5">
            <LiquidGlassButton
              as={Link}
              to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
              size="compact"
            >
              Sign in to comment
            </LiquidGlassButton>
          </div>
        </AuroraInset>
      )}

      {reviewFeedback ? (
        <p className="aurora-message aurora-message-success">{reviewFeedback}</p>
      ) : null}

      <div className="aurora-review-list">
        {localReviews.length ? (
          localReviews.map((review) => (
            <AuroraInset key={review.id} className="aurora-review-card">
              <div className="aurora-review-card-header">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--aurora-olive-deep)]">
                    {review.author}
                  </p>
                  <p className="mt-2 text-sm text-[var(--aurora-text)]">
                    {formatReviewDate(review.createdAt)}
                  </p>
                </div>
                <div className="aurora-review-card-score">
                  <ReviewStars value={review.rating} compact />
                  <span className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                    {formatReviewScore(review.rating)}
                  </span>
                </div>
              </div>
              <p className="text-base leading-8 text-[var(--aurora-text)]">
                {review.comment}
              </p>
            </AuroraInset>
          ))
        ) : (
          <AuroraInset className="aurora-review-empty">
            <p className="text-base leading-8 text-[var(--aurora-text)]">
              This space is ready for product comments. Start with a half-step rating and a short note above.
            </p>
          </AuroraInset>
        )}
      </div>
    </AuroraWidget>
  )
}

function PreviewDropdown({
  value,
  displayValue,
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
        <span className={`aurora-preview-trigger-label ${displayValue || value ? '' : 'is-placeholder'}`}>
          {displayValue || value || placeholder}
        </span>
        <span className="aurora-preview-select-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 7 5 5 5-5" />
          </svg>
        </span>
      </button>

      {open ? (
        <div className="aurora-preview-menu">
          {options.map((option) => {
            const normalizedOption =
              typeof option === 'string'
                ? { value: option, label: option, description: '' }
                : option

            return (
              <button
                key={normalizedOption.value}
                type="button"
                className={`aurora-preview-option ${value === normalizedOption.value ? 'is-selected' : ''}`}
                onClick={() => {
                  onSelect(normalizedOption.value)
                  onToggle(false)
                }}
              >
                <span className="aurora-preview-option-copy">
                  <span className="aurora-preview-option-label">{normalizedOption.label}</span>
                  {normalizedOption.description ? (
                    <span className="aurora-preview-option-meta">{normalizedOption.description}</span>
                  ) : null}
                </span>
                {value === normalizedOption.value ? (
                  <span className="aurora-preview-option-trailing">
                    {normalizedOption.sideLabel ? (
                      <span className="aurora-preview-option-side">{normalizedOption.sideLabel}</span>
                    ) : null}
                    <span className="aurora-preview-check">Selected</span>
                  </span>
                ) : normalizedOption.sideLabel ? (
                  <span className="aurora-preview-option-side">{normalizedOption.sideLabel}</span>
                ) : null}
              </button>
            )
          })}
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
  const [optionSelection, setOptionSelection] = useState({
    productSlug: '',
    values: {},
  })
  const [openOptionMenu, setOpenOptionMenu] = useState({
    productSlug: '',
    groupKey: '',
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
  const optionGroups = Array.isArray(product.options)
    ? product.options.filter((group) => Array.isArray(group.values) && group.values.length)
    : []
  const rawSelectedOptions =
    optionSelection.productSlug === product.slug ? optionSelection.values : {}
  const selectedOptionsByGroup = getResolvedOptionSelections(optionGroups, rawSelectedOptions)
  const visibleOptionGroups = optionGroups.filter((group, index) => {
    if (index === 0) {
      return true
    }

    return optionGroups
      .slice(0, index)
      .every((previousGroup) => Boolean(selectedOptionsByGroup[getOptionGroupKey(previousGroup)]))
  })
  const selectedOptionRecords = getSelectedOptionRecords(optionGroups, selectedOptionsByGroup)
  const activeOptionMenu =
    openOptionMenu.productSlug === product.slug ? openOptionMenu.groupKey : ''
  const missingRequiredOptionGroups = optionGroups.filter(
    (group) => !selectedOptionsByGroup[getOptionGroupKey(group)],
  )
  const matchingVariant = getMatchingVariant(product, optionGroups, selectedOptionsByGroup)
  const requiresVariantMatch = Boolean(product.hasVariants && optionGroups.some((group) => group.storeAsVariant))
  const hasRequiredOptions = missingRequiredOptionGroups.length === 0
  const hasCompleteSelection = hasRequiredOptions && (!requiresVariantMatch || Boolean(matchingVariant))
  const displayAvailability = matchingVariant
    ? {
        hasStock: (matchingVariant.stock || 0) > 0,
        totalStock: Math.max(0, Number(matchingVariant.stock) || 0),
      }
    : availability
  const displayPrice = getDisplayPrice(product, selectedOptionRecords, matchingVariant)
  const priceBreakdown = getUnitPriceBreakdown({ ...product, price: displayPrice })
  const selectedOptionsSnapshot = buildSelectedOptionsSnapshot(selectedOptionRecords)
  const selectedOptionCodes = buildSelectedOptionCodes(selectedOptionRecords)
  const missingOptionLabels = missingRequiredOptionGroups.map((group) => group.name)

  const handleAddToCart = async () => {
    if (!displayAvailability.hasStock) {
      return
    }

    if (!hasRequiredOptions) {
      setFeedback(`Select ${missingOptionLabels.join(' and ')} before adding this item to cart.`)
      return
    }

    if (requiresVariantMatch && !matchingVariant) {
      setFeedback('This option combination is currently unavailable.')
      return
    }

    await addCartItem({
      ...product,
      price: displayPrice,
      stock: displayAvailability.totalStock,
      variantId: matchingVariant?.id || null,
      variantCode: matchingVariant?.variantCode || '',
      options: selectedOptionsSnapshot,
      optionCodes: selectedOptionCodes,
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

      <div className="mt-6 aurora-product-detail-layout">
        <AuroraWidget
          title={product.name}
          subtitle={getProductTypeLabel(product)}
          icon="coffee"
          className="aurora-summary-lead aurora-product-hero-card aurora-product-summary-panel mx-auto w-full p-5 sm:p-8"
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
          className="aurora-showroom-panel aurora-product-detail-panel mx-auto w-full p-5 sm:p-8"
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

          <AuroraInset className="aurora-product-option-panel relative mt-6 overflow-visible">
            {optionGroups.length ? (
              <div className="relative z-20 mb-6 grid gap-5">
                {visibleOptionGroups.map((group) => {
                  const groupKey = getOptionGroupKey(group)
                  const selectedCode = selectedOptionsByGroup[groupKey] || ''
                  const selectedValue = (group.values || []).find(
                    (optionValue) => getOptionValueCode(optionValue) === selectedCode,
                  ) || null

                  return (
                    <div key={groupKey}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                          {group.name}
                        </p>
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--aurora-text-muted)]">
                          Required
                        </span>
                      </div>
                      <PreviewDropdown
                        value={selectedCode}
                        displayValue={selectedValue?.label || ''}
                        placeholder={`Select ${group.name.toLowerCase()}`}
                        options={(group.values || []).map((optionValue) => ({
                          value: getOptionValueCode(optionValue),
                          label: optionValue.label,
                          description: optionValue.description,
                          sideLabel: formatOptionPriceDelta(optionValue, selectedValue, product.price),
                        }))}
                        open={activeOptionMenu === groupKey}
                        onToggle={(nextOpen) => {
                          setOpenOptionMenu({
                            productSlug: product.slug,
                            groupKey: nextOpen ? groupKey : '',
                          })
                        }}
                        onSelect={(optionValueCode) => {
                          setOptionSelection((current) => ({
                            productSlug: product.slug,
                            values: {
                              ...(current.productSlug === product.slug ? current.values : {}),
                              [groupKey]: optionValueCode,
                            },
                          }))
                        }}
                      />
                      {selectedValue?.description ? (
                        <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                          {selectedValue.description}
                        </p>
                      ) : null}
                    </div>
                  )
                })}

                {requiresVariantMatch && hasRequiredOptions && !matchingVariant ? (
                  <p className="aurora-message mt-1">
                    That option combination does not map to an available product variant yet.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                  Current price
                </p>
                <p className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {formatCurrency(displayPrice)}
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                  {getTaxInclusionCopy(product)} · Net {formatCurrency(priceBreakdown.priceNet)} + VAT {formatCurrency(priceBreakdown.taxAmount)}
                </p>
                {selectedOptionRecords.length ? (
                  <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                    {selectedOptionRecords.map(({ group, value }) => `${group.name}: ${value.label}`).join(' · ')}
                  </p>
                ) : null}
              </div>
              <span
                className={`aurora-stock-badge aurora-stock-badge-detail ${
                  displayAvailability.hasStock ? 'is-in-stock' : 'is-out-of-stock'
                }`}
              >
                {displayAvailability.hasStock ? `${displayAvailability.totalStock} available` : 'Currently unavailable'}
              </span>
            </div>

            <LiquidGlassButton
              type="button"
              onClick={() => {
                void handleAddToCart()
              }}
              disabled={!displayAvailability.hasStock || !hasCompleteSelection}
              size="hero"
              className="mt-6 w-full"
            >
              {!displayAvailability.hasStock
                ? 'Unavailable'
                : !hasRequiredOptions
                  ? 'Select options first'
                  : requiresVariantMatch && !matchingVariant
                    ? 'Unavailable combination'
                    : 'Add to cart'}
            </LiquidGlassButton>

            {feedback ? (
              <p className="aurora-message aurora-message-success mt-4">{feedback}</p>
            ) : null}
          </AuroraInset>

          <div className="aurora-product-attribute-list mt-6">
            {attributeCards.map((card) => (
              <AuroraWidget
                key={card.subtitle}
                title={card.title}
                subtitle={card.subtitle}
                icon={card.icon}
                className="aurora-showroom-subpanel aurora-product-attribute-card p-5"
              />
            ))}
          </div>
        </AuroraWidget>

        <ProductReviewPanel key={product.slug} product={product} />
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
