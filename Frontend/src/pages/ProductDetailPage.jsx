import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import AuroraWidget, { AuroraInset } from '../shared/components/ui/AuroraWidget'
import FavoriteToggleButton from '../components/FavoriteToggleButton'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
import ProductMedia from '../features/products/presentation/ProductMedia'
import StorefrontLayout from '../shared/components/layout/StorefrontLayout'
import {
  authChangeEvent,
  currentUserChangeEvent,
  currentUserFetchStatus,
  fetchCurrentUserResult,
  getAuthStateSnapshot,
} from '../lib/auth'
import { addCartItem, getCartErrorMessage } from '../lib/cart'
import {
  deleteProductComment,
  fetchApprovedProductComments,
  submitProductComment,
} from '../features/comments/infrastructure/commentsApi'
import { formatCurrency } from '../lib/currency'
import {
  formatDiscountRate,
  getDiscountPricing,
  getProductStartingPrice,
} from '../lib/pricing'
import {
  getProductAvailability,
  getProductCategoryLabel,
  getProductFlavorNotes,
  getProductMetaLine,
  getProductTypeLabel,
  isCoffeeProduct,
  useProductBySlug,
} from '../lib/products'
import {
  getPreferredProductGalleryIndex,
  getProductGalleryImages,
  getProductGalleryOptionGroups,
} from '../features/products/domain/productImages'
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

function isOptionGroupRequired(group) {
  return group?.isRequired !== false
}

function optionValueChangesPrice(value) {
  const priceAdd = Number(value?.priceAdd) || 0
  const priceMult = Number(value?.priceMult) || 1

  return priceAdd !== 0 || priceMult !== 1
}

function optionGroupChangesPrice(product, group) {
  if (group?.storeAsVariant) {
    const variantPrices = Array.isArray(product?.variants)
      ? product.variants
          .map((variant) => Number(variant?.price))
          .filter((price) => Number.isFinite(price))
      : []
    const uniqueVariantPrices = new Set(variantPrices.map((price) => Math.round(price * 100)))

    return uniqueVariantPrices.size > 1
  }

  return (group?.values || []).some(optionValueChangesPrice)
}

function hasPendingPriceSelection(product, optionGroups, selectedValues) {
  return (optionGroups || []).some((group) => {
    if (!isOptionGroupRequired(group) || !optionGroupChangesPrice(product, group)) {
      return false
    }

    return !selectedValues[getOptionGroupKey(group)]
  })
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

  const selectedVariantEntries = relevantGroups
    .map((group) => [
      getOptionGroupKey(group),
      normalizeOptionCode(selectedValues[getOptionGroupKey(group)]),
    ])
    .filter(([, valueCode]) => Boolean(valueCode))

  if (!selectedVariantEntries.length) {
    return null
  }

  return product.variants.find((variant) => {
    const variantCodes = Object.fromEntries(
      Object.entries(variant?.optionValueCodes || {})
        .map(([key, value]) => [normalizeOptionCode(key), normalizeOptionCode(value)])
        .filter(([key, value]) => Boolean(key && value)),
    )

    if (Object.keys(variantCodes).length) {
      return selectedVariantEntries.every(
        ([groupKey, valueCode]) => variantCodes[groupKey] === valueCode,
      )
    }

    return relevantGroups.length === 1 &&
      selectedVariantEntries.length === 1 &&
      normalizeOptionCode(variant?.variantCode) === selectedVariantEntries[0][1]
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

  const entries = selectedOptionRecords
    .filter(({ group }) => !group?.storeAsVariant)
    .map(({ group, value }) => [group.code || group.id, value.valueCode || value.id])

  return entries.length ? Object.fromEntries(entries) : null
}

const reviewPrivacyColumnOptions = [
  { value: 'full', label: 'Show' },
  { value: 'initials', label: 'Initial Only' },
  { value: 'anonymous', label: 'Hide' },
]

function normalizeReviewPrivacyMode(value) {
  return ['full', 'initials', 'anonymous'].includes(value) ? value : 'initials'
}

function getDisplayNameWords(displayName) {
  return String(displayName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function buildReviewPrivacyInitialWord(word) {
  let normalizedWord = String(word || '').trim()

  while (normalizedWord.startsWith('.') && normalizedWord.length > 1) {
    normalizedWord = normalizedWord.slice(1)
  }

  if (!normalizedWord) {
    return ''
  }

  return `${String(word || '').trim()[0]}.`
}

function buildReviewPrivacyWordPreview(word, mode) {
  const normalizedMode = normalizeReviewPrivacyMode(mode)

  if (normalizedMode === 'full') {
    return word
  }

  if (normalizedMode === 'anonymous') {
    return '-'
  }

  return buildReviewPrivacyInitialWord(word) || '-'
}

function buildReviewPrivacySelection(displayName, mode = 'initials') {
  const words = getDisplayNameWords(displayName)
  const normalizedMode = normalizeReviewPrivacyMode(mode)

  return words.map(() => normalizedMode)
}

function resolveReviewPrivacySelection(selection, displayName, fallbackMode = 'initials') {
  const words = getDisplayNameWords(displayName)

  if (!words.length) {
    return []
  }

  if (!Array.isArray(selection) || !selection.length) {
    return buildReviewPrivacySelection(displayName, fallbackMode)
  }

  return words.map((_, index) => normalizeReviewPrivacyMode(selection[index] || fallbackMode))
}

function buildReviewPrivacyPreviewName(selection, displayName) {
  const words = getDisplayNameWords(displayName)
  const resolvedSelection = resolveReviewPrivacySelection(selection, displayName)
  const previewWords = words
    .map((word, index) => buildReviewPrivacyWordPreview(word, resolvedSelection[index]))
    .filter((word) => word && word !== '-')

  return previewWords.length ? previewWords.join(' ') : 'Anonymous'
}

function buildReviewPrivacyCode(selectionOrMode, displayName) {
  const words = getDisplayNameWords(displayName)

  if (!words.length) {
    return ''
  }

  const resolvedSelection = Array.isArray(selectionOrMode)
    ? resolveReviewPrivacySelection(selectionOrMode, displayName)
    : buildReviewPrivacySelection(displayName, selectionOrMode)

  return resolvedSelection
    .map((mode) => (mode === 'full' ? 's' : mode === 'anonymous' ? 'h' : 'i'))
    .join('')
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

function PreviewChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 7 5 5 5-5" />
    </svg>
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
  disabled = false,
}) {
  const activeValue = hoverValue || value

  return (
    <div
      className={`aurora-review-rating-picker ${disabled ? 'opacity-60' : ''}`.trim()}
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
                  disabled={disabled}
                  onMouseEnter={() => {
                    if (!disabled) {
                      onHoverChange(step)
                    }
                  }}
                  onFocus={() => {
                    if (!disabled) {
                      onHoverChange(step)
                    }
                  }}
                  onBlur={() => {
                    onHoverChange(0)
                  }}
                  onClick={() => {
                    if (!disabled) {
                      onChange(step)
                    }
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

function ReviewPrivacyMatrix({
  displayName,
  selection,
  open,
  disabled = false,
  onToggle,
  onChange,
  onToggleAll,
}) {
  const words = getDisplayNameWords(displayName)
  const resolvedSelection = resolveReviewPrivacySelection(selection, displayName)
  const previewName = buildReviewPrivacyPreviewName(resolvedSelection, displayName)
  const allHidden = words.length > 0 && resolvedSelection.every((mode) => mode === 'anonymous')

  return (
    <div className="aurora-review-privacy-matrix">
      <div className="aurora-review-privacy-summary">
        <span className="aurora-review-privacy-summary-name">{previewName}</span>
        <div className="aurora-review-privacy-summary-actions">
          <button
            type="button"
            className="aurora-review-privacy-summary-button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                onToggleAll(allHidden ? 'full' : 'anonymous')
              }
            }}
          >
            {allHidden ? 'Show All' : 'Hide All'}
          </button>
          <button
            type="button"
            className={`aurora-review-privacy-summary-chevron ${open ? 'is-open' : ''}`.trim()}
            disabled={disabled}
            aria-label={open ? 'Collapse name visibility options' : 'Expand name visibility options'}
            aria-expanded={open ? 'true' : 'false'}
            onClick={() => {
              if (!disabled) {
                onToggle(!open)
              }
            }}
          >
            <PreviewChevronIcon />
          </button>
        </div>
      </div>

      {open ? (
        <div className="aurora-review-privacy-panel">
          <div className="aurora-review-privacy-grid aurora-review-privacy-grid-heading">
            {reviewPrivacyColumnOptions.map((option) => (
              <span key={option.value} className="aurora-review-privacy-heading-cell">
                {option.label}
              </span>
            ))}
          </div>

          <div className="aurora-review-privacy-rows">
            {words.map((word, wordIndex) => (
              <div key={`${word}-${wordIndex}`} className="aurora-review-privacy-grid">
                {reviewPrivacyColumnOptions.map((option) => {
                  const selected = resolvedSelection[wordIndex] === option.value

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`aurora-review-privacy-cell ${selected ? 'is-selected' : ''}`.trim()}
                      aria-pressed={selected ? 'true' : 'false'}
                      disabled={disabled}
                      onClick={() => {
                        if (!disabled) {
                          onChange(wordIndex, option.value)
                        }
                      }}
                    >
                      {buildReviewPrivacyWordPreview(word, option.value)}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ProductReviewPanel({ product }) {
  const location = useLocation()
  const navigate = useNavigate()
  const reviewTextareaRef = useRef(null)
  const [authState, setAuthState] = useState(() => getAuthStateSnapshot())
  const [reviewRating, setReviewRating] = useState(0)
  const [hoverReviewRating, setHoverReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewPrivacySelection, setReviewPrivacySelection] = useState([])
  const [privacyMenuOpen, setPrivacyMenuOpen] = useState(true)
  const [reviews, setReviews] = useState([])
  const [selfComment, setSelfComment] = useState(null)
  const [selfCommentEditing, setSelfCommentEditing] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentsError, setCommentsError] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [submitBusy, setSubmitBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const session = authState.session
  const currentUserState = authState.currentUserState
  const hasSession = authState.hasUsableSession
  const currentUser =
    currentUserState.status === currentUserFetchStatus.ok
      ? currentUserState.user
      : null
  const canComment = Boolean(product?.canComment)
  const isCurrentUserLoading =
    hasSession &&
    (currentUserState.status === currentUserFetchStatus.idle ||
      currentUserState.status === currentUserFetchStatus.loading)
  const hasDisplayName = Boolean(currentUser?.displayname?.trim())
  const editorMode = Boolean(selfComment && selfCommentEditing)
  const canEditSelfComment = Boolean(selfComment && !isCurrentUserLoading && hasDisplayName)
  const editCommentDisabled = submitBusy || deleteBusy || !canEditSelfComment
  const reviewFormDisabled =
    submitBusy || deleteBusy || isCurrentUserLoading || !hasDisplayName || (!canComment && !editorMode)
  const showReviewPrivacyControls =
    (canComment || editorMode) && !isCurrentUserLoading && hasDisplayName
  const selfCommentStatus = String(selfComment?.status || '').trim().toLowerCase()
  const hasPendingSelfComment = ['pending', 'pending_edit'].includes(selfCommentStatus)
  const hasRejectedSelfComment = ['rejected', 'edit_rejected'].includes(selfCommentStatus)
  const selfCommentCardSnapshot = selfComment?.visibleSnapshot || selfComment?.pendingSnapshot || null
  let reviewInfoMessage = ''
  const reviewLoginPath = `/login?next=${encodeURIComponent(location.pathname + location.search)}`

  if (hasSession) {
    if (!canComment && !selfComment) {
      reviewInfoMessage =
        'Purchase and delivery are required before you can comment on this product.'
    } else if (isCurrentUserLoading) {
      reviewInfoMessage = 'Loading your comment settings.'
    } else if (!hasDisplayName) {
      reviewInfoMessage = 'We could not load your profile name. Reload and try again.'
    }
  }

  const selfCommentNotice = useMemo(() => {
    if (!selfComment || !editorMode) {
      return ''
    }

    if (selfCommentStatus === 'pending') {
      return 'Your current pending comment is loaded here. Saving again will replace that draft with your latest changes.'
    }

    if (selfCommentStatus === 'rejected') {
      return 'Your last comment was rejected. Update it here to submit a new version for moderation.'
    }

    if (!selfComment.draftAvailable) {
      return 'Your current comment is awaiting approval. The current API does not return that draft text yet, so editing starts from a blank form.'
    }

    if (selfCommentStatus === 'pending_edit') {
      return 'You already have a pending edit. Saving again will replace that draft with your latest changes.'
    }

    if (selfCommentStatus === 'edit_rejected') {
      return 'Your last edit was rejected. Update it here to submit a fresh revision for moderation.'
    }

    if (selfComment.visibleSnapshot) {
      return 'Your current comment is loaded here. Saving will submit an updated version for moderation.'
    }

    return ''
  }, [editorMode, selfComment, selfCommentStatus])

  useEffect(() => {
    const clearSelfCommentState = () => {
      setSelfComment(null)
      setSelfCommentEditing(false)
      setReviewRating(0)
      setReviewComment('')
    }

    const syncAuthState = () => {
      const nextAuthState = getAuthStateSnapshot()
      setAuthState(nextAuthState)

      if (nextAuthState.shouldRequestLogin) {
        clearSelfCommentState()
      }
    }

    window.addEventListener('storage', syncAuthState)
    window.addEventListener(authChangeEvent, syncAuthState)
    window.addEventListener(currentUserChangeEvent, syncAuthState)

    return () => {
      window.removeEventListener('storage', syncAuthState)
      window.removeEventListener(authChangeEvent, syncAuthState)
      window.removeEventListener(currentUserChangeEvent, syncAuthState)
    }
  }, [])

  useEffect(() => {
    if (
      !session?.token ||
      (currentUserState.token === session.token &&
        currentUserState.status !== currentUserFetchStatus.idle)
    ) {
      return
    }

    void fetchCurrentUserResult(session.token)
  }, [currentUserState.status, currentUserState.token, session?.token])

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
    const textarea = reviewTextareaRef.current

    if (!textarea) {
      return undefined
    }

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(textarea.scrollHeight, 136)}px`
    return undefined
  }, [reviewComment, product.id])

  useEffect(() => {
    let active = true

    setCommentsLoading(true)
    setCommentsError('')
    setReviews([])
    setSelfComment(null)
    setSelfCommentEditing(false)

    void fetchApprovedProductComments(product.id)
      .then((nextResult) => {
        if (!active) {
          return
        }

        setReviews(nextResult.comments || [])
        setSelfComment(nextResult.selfComment || null)
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setCommentsError(error?.message || 'Could not load comments.')
      })
      .finally(() => {
        if (active) {
          setCommentsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [product.id, session?.token])

  useEffect(() => {
    setHoverReviewRating(0)
    setPrivacyMenuOpen(true)

    if (!hasSession || !selfComment || !editorMode) {
      setReviewRating(0)
      setReviewComment('')
      setReviewPrivacySelection(
        buildReviewPrivacySelection(currentUser?.displayname, 'initials'),
      )
      return
    }

    setReviewRating(selfComment.prefill?.rating || 0)
    setReviewComment(selfComment.prefill?.comment || '')
    setReviewPrivacySelection(
      resolveReviewPrivacySelection(
        selfComment.prefill?.privacySelection,
        currentUser?.displayname,
        selfComment.prefill?.privacyMode || 'initials',
      ),
    )
  }, [currentUser?.displayname, editorMode, hasSession, product.id, selfComment])

  const metricReviews = useMemo(() => {
    if (selfComment?.visibleSnapshot) {
      return [selfComment.visibleSnapshot, ...reviews]
    }

    return reviews
  }, [reviews, selfComment])

  const reviewAverage = useMemo(() => {
    const ratedReviews = metricReviews.filter((review) => review.rating)

    if (!ratedReviews.length) {
      return 0
    }

    const totalRating = ratedReviews.reduce((sum, review) => sum + review.rating, 0)
    return totalRating / ratedReviews.length
  }, [metricReviews])

  const activeReviewValue = hoverReviewRating || reviewRating || reviewAverage
  const emptyReviewMessage = commentsLoading
    ? 'Loading approved comments.'
    : editorMode && selfComment?.visibleSnapshot
      ? 'Your published comment is being edited above.'
      : editorMode && selfCommentStatus === 'pending'
        ? 'Your pending comment is loaded in the editor above.'
      : editorMode && selfCommentStatus === 'rejected'
        ? 'Your rejected comment draft is loaded in the editor above.'
      : editorMode && selfCommentStatus === 'edit_rejected'
        ? 'Your rejected edit is loaded in the editor above.'
      : editorMode && selfCommentStatus === 'pending_edit'
        ? 'Your pending edit is loaded in the editor above.'
      : editorMode && !selfComment?.draftAvailable
        ? 'Your current comment is awaiting approval. Use the editor above to resubmit it.'
        : selfComment && !reviews.length
          ? 'No other approved comments yet.'
        : 'This space is ready for product comments. Approved reviews will appear here once customers share their take.'

  const clearSelfCommentState = () => {
    setSelfComment(null)
    setSelfCommentEditing(false)
    setReviewRating(0)
    setReviewComment('')
  }

  const confirmReviewSession = async () => {
    const snapshot = getAuthStateSnapshot()
    setAuthState(snapshot)

    if (snapshot.shouldRequestLogin || !snapshot.hasUsableSession || !snapshot.token) {
      clearSelfCommentState()
      navigate(reviewLoginPath, { replace: true })
      return false
    }

    const result = await fetchCurrentUserResult(snapshot.token, { force: true })
    const nextSnapshot = getAuthStateSnapshot()
    setAuthState(nextSnapshot)

    if (
      result.status === currentUserFetchStatus.unauthorized ||
      nextSnapshot.shouldRequestLogin
    ) {
      clearSelfCommentState()
      navigate(reviewLoginPath, { replace: true })
      return false
    }

    if (result.status === currentUserFetchStatus.error) {
      setReviewError('We could not confirm your session. Reload and try again.')
      return false
    }

    return result.status === currentUserFetchStatus.ok
  }

  const handleReviewSubmit = (event) => {
    event.preventDefault()

    const trimmedComment = reviewComment.trim()

    setReviewError('')
    setReviewFeedback('')

    if (!reviewRating && !trimmedComment) {
      setReviewError('Add a rating or comment before posting.')
      return
    }

    if (reviewFormDisabled) {
      setReviewError(reviewInfoMessage || 'Commenting is unavailable right now.')
      return
    }

    void (async () => {
      setSubmitBusy(true)

      try {
        const hasFreshReviewSession = await confirmReviewSession()

        if (!hasFreshReviewSession) {
          return
        }

        const latestAuthState = getAuthStateSnapshot()
        const latestDisplayName = latestAuthState.user?.displayname
        const privacy = buildReviewPrivacyCode(reviewPrivacySelection, latestDisplayName)

        if (!latestDisplayName?.trim()) {
          setReviewError('We could not load your profile name. Reload and try again.')
          return
        }

        if (!privacy) {
          setReviewError('We could not determine your comment privacy settings.')
          return
        }

        const result = await submitProductComment({
          productId: product.id,
          rating: reviewRating,
          comment: trimmedComment,
          privacy,
        })

        setHoverReviewRating(0)
        setPrivacyMenuOpen(true)
        setReviewFeedback(
          result?.msg ||
          (editorMode
            ? 'Your comment changes were submitted for moderation.'
            : 'Your comment was submitted and is awaiting approval.'),
        )

        try {
          const nextResult = await fetchApprovedProductComments(product.id)
          setReviews(nextResult.comments || [])
          setSelfComment(nextResult.selfComment || null)
          setSelfCommentEditing(false)
          setCommentsError('')
        } catch (error) {
          setCommentsError(error?.message || 'Approved comments could not be refreshed.')
        }
      } catch (error) {
        setReviewError(error?.message || 'Could not post your comment.')
      } finally {
        setSubmitBusy(false)
      }
    })()
  }

  const handleReviewDelete = () => {
    setReviewError('')
    setReviewFeedback('')

    if (!selfComment || deleteBusy) {
      return
    }

    if (!window.confirm('Delete your rating or comment for this product?')) {
      return
    }

    void (async () => {
      setDeleteBusy(true)

      try {
        const hasFreshReviewSession = await confirmReviewSession()

        if (!hasFreshReviewSession) {
          return
        }

        const result = await deleteProductComment(product.id)
        const nextResult = await fetchApprovedProductComments(product.id)

        setReviews(nextResult.comments || [])
        setSelfComment(nextResult.selfComment || null)
        setSelfCommentEditing(false)
        setReviewRating(0)
        setHoverReviewRating(0)
        setReviewComment('')
        setCommentsError('')
        setReviewFeedback(result?.msg || 'Your comment was deleted.')
      } catch (error) {
        setReviewError(error?.message || 'Could not delete your comment.')
      } finally {
        setDeleteBusy(false)
      }
    })()
  }

  return (
    <AuroraWidget
      title={editorMode ? 'Edit your comment' : 'Share your take'}
      subtitle={editorMode ? 'Update your rating and published text' : 'Half-step rating and quick comment'}
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
            {commentsLoading && !metricReviews.length
              ? 'Loading approved comments for this product.'
              : metricReviews.length
                ? `${metricReviews.length} approved ${metricReviews.length === 1 ? 'comment' : 'comments'} for this product.`
                : 'No approved comments yet.'}
          </p>
        </div>
        <div className="aurora-review-metrics-side">
          <ReviewStars value={activeReviewValue} />
          <span className="aurora-review-score-pill">
            {reviewRating ? `${formatReviewScore(reviewRating)} / 5 selected` : 'Tap a star to rate'}
          </span>
        </div>
      </AuroraInset>

      {hasSession && selfComment && !editorMode ? (
        <AuroraInset className="aurora-review-card">
          <div className="aurora-review-card-header">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--aurora-olive-deep)]">
                {selfCommentStatus === 'pending'
                  ? 'Pending review'
                  : selfCommentStatus === 'rejected'
                    ? 'Rejected'
                    : selfCommentStatus === 'pending_edit'
                      ? 'Pending update'
                      : selfCommentStatus === 'edit_rejected'
                        ? 'Rejected update'
                        : 'Your comment'}
              </p>
              <p className="mt-2 text-sm text-[var(--aurora-text)]">
                {selfCommentCardSnapshot?.createdAt
                  ? formatReviewDate(selfCommentCardSnapshot.createdAt)
                  : 'Waiting for moderation'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {selfCommentCardSnapshot ? (
                <div className="aurora-review-card-score">
                  {selfCommentCardSnapshot.rating ? (
                    <>
                      <ReviewStars value={selfCommentCardSnapshot.rating} compact />
                      <span className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                        {formatReviewScore(selfCommentCardSnapshot.rating)}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                      No rating
                    </span>
                  )}
                </div>
              ) : null}
              <LiquidGlassButton
                type="button"
                size="compact"
                variant="secondary"
                disabled={editCommentDisabled}
                onClick={() => {
                  setReviewError('')
                  setReviewFeedback('')
                  setSelfCommentEditing(true)
                }}
              >
                Edit comment
              </LiquidGlassButton>
              <LiquidGlassButton
                type="button"
                size="compact"
                variant="quiet"
                disabled={deleteBusy || submitBusy}
                loading={deleteBusy}
                onClick={handleReviewDelete}
              >
                Delete
              </LiquidGlassButton>
            </div>
          </div>

          <p className="text-base leading-8 text-[var(--aurora-text)]">
            {selfCommentCardSnapshot?.comment ||
              'No written comment.'}
          </p>

          {hasPendingSelfComment || hasRejectedSelfComment ? (
            <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
              {selfCommentStatus === 'pending_edit'
                ? 'A newer version of your comment is waiting for moderation. Use Edit comment to revise or replace that draft.'
                : selfCommentStatus === 'edit_rejected'
                  ? 'Your last edit was rejected. Use Edit comment to replace it with a new draft.'
                  : selfCommentStatus === 'rejected'
                    ? 'Your last comment was rejected. Use Edit comment to revise it and submit again.'
                    : 'Your comment is waiting for moderation. Use Edit comment if you want to update the draft before it is reviewed.'}
            </p>
          ) : null}
        </AuroraInset>
      ) : null}

      {hasSession ? (
        !selfComment || editorMode ? (
          <form className="aurora-review-form" onSubmit={handleReviewSubmit}>
            <AuroraInset>
              <div className="aurora-review-form-heading">
                <div>
                  <p className="aurora-kicker">{editorMode ? 'Edit rating' : 'Your rating'}</p>
                  <h4 className="mt-3 text-2xl font-semibold text-[var(--aurora-text-strong)]">
                    {reviewRating ? `${formatReviewScore(reviewRating)} out of 5` : 'Pick a score'}
                  </h4>
                </div>
                <span className="aurora-review-score-pill">Half-step stars</span>
              </div>

              <ReviewRatingInput
                value={reviewRating}
                hoverValue={hoverReviewRating}
                disabled={reviewFormDisabled}
                onChange={(value) => {
                  setReviewRating(value)
                  setReviewError('')
                }}
                onHoverChange={setHoverReviewRating}
              />

              <div className="aurora-review-rating-scale">
                <span>Needs work</span>
                <span>Outstanding</span>
              </div>
            </AuroraInset>

            {reviewInfoMessage ? (
              <p className="aurora-message aurora-message-info">{reviewInfoMessage}</p>
            ) : null}
            {selfCommentNotice ? (
              <p className="aurora-message aurora-message-info">{selfCommentNotice}</p>
            ) : null}

            <AuroraInset>
              <div>
                <label htmlFor="product-review-comment" className="aurora-review-label">
                  {editorMode ? 'Edit comment' : 'Comment'}
                </label>
                <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                  {editorMode
                    ? 'Refine your current comment and save a new version for moderation.'
                    : 'Share taste, build quality, or how this product fits into your routine.'}
                </p>
              </div>

              {showReviewPrivacyControls ? (
                <div className="mt-6">
                  <span className="aurora-review-label">Name visibility</span>
                  <ReviewPrivacyMatrix
                    displayName={currentUser?.displayname}
                    selection={reviewPrivacySelection}
                    open={privacyMenuOpen}
                    disabled={reviewFormDisabled}
                    onToggle={setPrivacyMenuOpen}
                    onToggleAll={(mode) => {
                      setReviewPrivacySelection(
                        buildReviewPrivacySelection(currentUser?.displayname, mode),
                      )
                      setReviewError('')
                    }}
                    onChange={(wordIndex, mode) => {
                      setReviewPrivacySelection((currentSelection) => {
                        const nextSelection = resolveReviewPrivacySelection(
                          currentSelection,
                          currentUser?.displayname,
                        )
                        nextSelection[wordIndex] = normalizeReviewPrivacyMode(mode)
                        return nextSelection
                      })
                      setReviewError('')
                    }}
                  />
                </div>
              ) : null}

              <textarea
                id="product-review-comment"
                ref={reviewTextareaRef}
                className="aurora-review-textarea"
                rows="5"
                maxLength="320"
                placeholder={
                  editorMode
                    ? `Update your thoughts on ${product.name}. Mention what changed or what still stands out.`
                    : `What stands out about ${product.name}? Mention taste, build quality, or how it fits into your routine.`
                }
                disabled={reviewFormDisabled}
                value={reviewComment}
                onChange={(event) => {
                  setReviewComment(event.target.value)
                  setReviewError('')
                }}
              />

              <div className="aurora-review-form-footer">
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  {reviewComment.length}/320 characters
                </p>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {editorMode ? (
                    <LiquidGlassButton
                      type="button"
                      size="compact"
                      variant="secondary"
                      disabled={submitBusy}
                      onClick={() => {
                        setReviewError('')
                        setReviewFeedback('')
                        setSelfCommentEditing(false)
                      }}
                    >
                      Cancel
                    </LiquidGlassButton>
                  ) : null}
                  <LiquidGlassButton
                    type="submit"
                    size="compact"
                    disabled={reviewFormDisabled}
                    loading={submitBusy}
                  >
                    {submitBusy ? (editorMode ? 'Saving...' : 'Posting...') : (editorMode ? 'Save changes' : 'Post comment')}
                  </LiquidGlassButton>
                </div>
              </div>
            </AuroraInset>
          </form>
        ) : null
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

      {reviewError ? (
        <p className="aurora-message aurora-message-error">{reviewError}</p>
      ) : null}
      {reviewFeedback ? (
        <p className="aurora-message aurora-message-success">{reviewFeedback}</p>
      ) : null}
      {commentsError ? (
        <p className="aurora-message aurora-message-error">{commentsError}</p>
      ) : null}

      <div className="aurora-review-list">
        {reviews.length ? (
          reviews.map((review) => (
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
                  {review.rating ? (
                    <>
                      <ReviewStars value={review.rating} compact />
                      <span className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                        {formatReviewScore(review.rating)}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                      No rating
                    </span>
                  )}
                </div>
              </div>
              <p className="text-base leading-8 text-[var(--aurora-text)]">
                {review.comment || 'No written comment.'}
              </p>
            </AuroraInset>
          ))
        ) : (
          <AuroraInset className="aurora-review-empty">
            <p className="text-base leading-8 text-[var(--aurora-text)]">
              {emptyReviewMessage}
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
  className = '',
  triggerClassName = '',
  menuClassName = '',
  triggerContent = null,
  menuMode = 'overlay',
  open,
  disabled = false,
  onToggle,
  onSelect,
}) {
  const wrapperRef = useRef(null)
  const menuRef = useRef(null)
  const usesFlowLayout = menuMode === 'flow' || menuMode === 'viewport'
  const usesViewportLayout = menuMode === 'viewport'
  const resolvedTriggerContent =
    typeof triggerContent === 'function'
      ? triggerContent({ open, disabled, value, displayValue })
      : triggerContent

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointerDown = (event) => {
      const isInsideTrigger = wrapperRef.current?.contains(event.target)
      const isInsideMenu = menuRef.current?.contains(event.target)

      if (!isInsideTrigger && !isInsideMenu) {
        onToggle(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [onToggle, open])

  useLayoutEffect(() => {
    if (!open) {
      return undefined
    }

    const menu = menuRef.current

    if (!menu) {
      return undefined
    }

    menu.scrollTop = 0
    const frameId = window.requestAnimationFrame(() => {
      menu.scrollTop = 0
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open || !usesViewportLayout) {
      return undefined
    }

    const updateViewportMenuStyle = () => {
      const trigger = wrapperRef.current?.querySelector('.aurora-preview-trigger')
      const menu = menuRef.current

      if (!trigger || !menu) {
        return
      }

      const triggerRect = trigger.getBoundingClientRect()
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
      const margin = 16
      const gap = 10
      const preferredWidth = Math.min(triggerRect.width, Math.max(0, viewportWidth - margin * 2))
      const left = Math.min(
        Math.max(triggerRect.left, margin),
        Math.max(margin, viewportWidth - preferredWidth - margin),
      )
      const anchorTop = Math.min(
        Math.max(triggerRect.top, margin),
        Math.max(margin, viewportHeight - margin),
      )
      const anchorBottom = Math.min(
        Math.max(triggerRect.bottom, margin),
        Math.max(margin, viewportHeight - margin),
      )
      const spaceBelow = viewportHeight - anchorBottom - margin - gap
      const spaceAbove = anchorTop - margin - gap
      const shouldOpenAbove = spaceBelow < 260 && spaceAbove > spaceBelow
      const availableSpace = Math.max(0, shouldOpenAbove ? spaceAbove : spaceBelow)
      const shouldUseViewportPanel = availableSpace < 96
      const availableHeight = Math.floor(
        shouldUseViewportPanel
          ? Math.max(96, viewportHeight - margin * 2)
          : availableSpace,
      )

      Object.assign(menu.style, {
        position: 'fixed',
        right: 'auto',
        left: `${Math.round(left)}px`,
        width: `${Math.round(preferredWidth)}px`,
        maxHeight: `${availableHeight}px`,
        top:
          shouldUseViewportPanel || !shouldOpenAbove
            ? `${Math.round(shouldUseViewportPanel ? margin : anchorBottom + gap)}px`
            : 'auto',
        bottom: !shouldUseViewportPanel && shouldOpenAbove
          ? `${Math.round(viewportHeight - anchorTop + gap)}px`
          : 'auto',
      })

      const optionElements = Array.from(menu.querySelectorAll('.aurora-preview-option'))

      if (optionElements.length > 0 && menu.scrollHeight > availableHeight + 1) {
        const menuRect = menu.getBoundingClientRect()
        const minimumHeight = optionElements[0].getBoundingClientRect().bottom - menuRect.top
        const fittedHeight = optionElements.reduce((bestHeight, optionElement) => {
          const optionBottom = optionElement.getBoundingClientRect().bottom - menuRect.top
          return optionBottom <= availableHeight ? optionBottom : bestHeight
        }, minimumHeight)

        menu.style.maxHeight = `${Math.max(1, Math.ceil(fittedHeight))}px`
      }
    }

    updateViewportMenuStyle()
    window.addEventListener('resize', updateViewportMenuStyle)
    window.addEventListener('scroll', updateViewportMenuStyle, true)

    return () => {
      window.removeEventListener('resize', updateViewportMenuStyle)
      window.removeEventListener('scroll', updateViewportMenuStyle, true)
    }
  }, [open, usesViewportLayout])

  const menu = open && !disabled ? (
    <div
      ref={menuRef}
      className={`aurora-preview-menu ${usesFlowLayout ? 'is-flow' : ''} ${
        usesViewportLayout ? 'is-viewport' : ''
      } ${menuClassName}`.trim()}
      role="listbox"
    >
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
            role="option"
            aria-selected={value === normalizedOption.value}
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
  ) : null

  return (
    <div
      ref={wrapperRef}
      className={`aurora-preview-dropdown mt-3 ${usesFlowLayout ? 'is-flow-menu' : ''} ${
        usesViewportLayout ? 'is-viewport-menu' : ''
      } ${className}`.trim()}
    >
      <button
        type="button"
        className={`aurora-preview-trigger ${open ? 'is-open' : ''} ${triggerClassName}`.trim()}
        disabled={disabled}
        aria-haspopup="listbox"
        onClick={() => {
          if (!disabled) {
            onToggle(!open)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation()
            onToggle(false)
          }
        }}
        aria-expanded={open ? 'true' : 'false'}
      >
        {resolvedTriggerContent || (
          <>
            <span className={`aurora-preview-trigger-label ${displayValue || value ? '' : 'is-placeholder'}`}>
              {displayValue || value || placeholder}
            </span>
            <span className="aurora-preview-select-icon" aria-hidden="true">
              <PreviewChevronIcon />
            </span>
          </>
        )}
      </button>

      {usesViewportLayout && menu ? createPortal(menu, document.body) : menu}
    </div>
  )
}

export default function ProductDetailPage() {
  const { slug } = useParams()
  const { product, loading, error } = useProductBySlug(slug)
  const [feedback, setFeedback] = useState('')
  const [feedbackType, setFeedbackType] = useState('success')
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
      setFeedbackType('success')
    }, 2400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [feedback])

  const optionGroups = useMemo(() => {
    if (!product) {
      return []
    }

    const backendOptionGroups = Array.isArray(product.options)
      ? product.options.filter((group) => Array.isArray(group.values) && group.values.length)
      : []

    return getProductGalleryOptionGroups(product, backendOptionGroups)
  }, [product])
  const rawSelectedOptions =
    optionSelection.productSlug === product?.slug ? optionSelection.values : {}
  const selectedOptionsByGroup = getResolvedOptionSelections(optionGroups, rawSelectedOptions)
  const selectedOptionsSignature = optionGroups
    .map((group) => `${getOptionGroupKey(group)}:${selectedOptionsByGroup[getOptionGroupKey(group)] || ''}`)
    .join('|')
  const productGalleryImages = getProductGalleryImages(product, selectedOptionsByGroup)
  const preferredGalleryImageIndex = getPreferredProductGalleryIndex(
    product,
    selectedOptionsByGroup,
    productGalleryImages,
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
  const visibleOptionGroups = optionGroups.filter((group, index) => {
    if (index === 0) {
      return true
    }

    return optionGroups
      .slice(0, index)
      .every(
        (previousGroup) =>
          !isOptionGroupRequired(previousGroup) ||
          Boolean(selectedOptionsByGroup[getOptionGroupKey(previousGroup)]),
      )
  })
  const selectedOptionRecords = getSelectedOptionRecords(optionGroups, selectedOptionsByGroup)
  const activeOptionMenu =
    openOptionMenu.productSlug === product.slug ? openOptionMenu.groupKey : ''
  const missingRequiredOptionGroups = optionGroups.filter(
    (group) => isOptionGroupRequired(group) && !selectedOptionsByGroup[getOptionGroupKey(group)],
  )
  const matchingVariant = getMatchingVariant(product, optionGroups, selectedOptionsByGroup)
  const requiredVariantGroups = optionGroups.filter(
    (group) => group.storeAsVariant && isOptionGroupRequired(group),
  )
  const selectedVariantGroups = optionGroups.filter(
    (group) => group.storeAsVariant && selectedOptionsByGroup[getOptionGroupKey(group)],
  )
  const requiresVariantMatch = Boolean(product.hasVariants && requiredVariantGroups.length)
  const hasUnavailableVariantCombination = Boolean(
    product.hasVariants &&
    selectedVariantGroups.length &&
    !matchingVariant,
  )
  const hasRequiredOptions = missingRequiredOptionGroups.length === 0
  const hasCompleteSelection =
    hasRequiredOptions &&
    !hasUnavailableVariantCombination &&
    (!requiresVariantMatch || Boolean(matchingVariant))
  const displayAvailability = matchingVariant
    ? {
        hasStock: (matchingVariant.stock || 0) > 0,
        totalStock: Math.max(0, Number(matchingVariant.stock) || 0),
      }
    : availability
  const displayPrice = getDisplayPrice(product, selectedOptionRecords, matchingVariant)
  const showStartingPrice = hasPendingPriceSelection(product, optionGroups, selectedOptionsByGroup)
  const priceBeforeDiscount = showStartingPrice
    ? getProductStartingPrice(product)
    : displayPrice
  const discountPricing = getDiscountPricing({
    price: priceBeforeDiscount,
    discountRate: product.discountRate,
  })
  const purchasePrice = discountPricing.currentPrice
  const priceBreakdown = getUnitPriceBreakdown({ ...product, price: purchasePrice })
  const selectedOptionsSnapshot = buildSelectedOptionsSnapshot(selectedOptionRecords)
  const selectedOptionCodes = buildSelectedOptionCodes(selectedOptionRecords)
  const missingOptionLabels = missingRequiredOptionGroups.map((group) => group.name)

  const handleAddToCart = async () => {
    if (!displayAvailability.hasStock) {
      return
    }

    if (!hasRequiredOptions) {
      setFeedbackType('error')
      setFeedback(`Select ${missingOptionLabels.join(' and ')} before adding this item to cart.`)
      return
    }

    if (hasUnavailableVariantCombination) {
      setFeedbackType('error')
      setFeedback('This option combination is currently unavailable.')
      return
    }

    try {
      await addCartItem({
        ...product,
        price: purchasePrice,
        stock: displayAvailability.totalStock,
        variantId: matchingVariant?.id || null,
        variantCode: matchingVariant?.variantCode || '',
        options: selectedOptionsSnapshot,
        optionCodes: selectedOptionCodes,
      })
      setFeedbackType('success')
      setFeedback(`${product.name} was added to cart.`)
    } catch (error) {
      setFeedbackType('error')
      setFeedback(getCartErrorMessage(error))
    }
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
          <ProductMedia
            key={`${product.slug}-${selectedOptionsSignature}`}
            product={product}
            images={productGalleryImages}
            defaultActiveIndex={preferredGalleryImageIndex}
            className="is-detail mb-6"
            loading="eager"
            enableLightbox
          />

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
          title="Choose and add to cart"
          subtitle="Price, stock, and options"
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
                          {isOptionGroupRequired(group) ? 'Required' : 'Optional'}
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
                        menuMode="flow"
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

                {hasRequiredOptions && hasUnavailableVariantCombination ? (
                  <p className="aurora-message mt-1">
                    That option combination does not map to an available product variant yet.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="relative z-10 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                  {showStartingPrice ? 'Starting from' : 'Ready to buy'}
                </p>
                {discountPricing.hasDiscount ? (
                  <div
                    className="aurora-product-detail-price-stack mt-3"
                    aria-label={`Discounted price ${formatCurrency(discountPricing.currentPrice)}, original price ${formatCurrency(discountPricing.originalPrice)}`}
                  >
                    <div className="aurora-product-detail-sale-row">
                      <p className="font-display text-4xl text-[var(--aurora-text-strong)]">
                        {formatCurrency(discountPricing.currentPrice)}
                      </p>
                      <span className="aurora-product-card-discount-badge">
                        -{formatDiscountRate(discountPricing.discountRate)}%
                      </span>
                    </div>
                    <p className="aurora-product-detail-original-price">
                      {formatCurrency(discountPricing.originalPrice)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                    {formatCurrency(purchasePrice)}
                  </p>
                )}
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
                  : hasUnavailableVariantCombination
                    ? 'Unavailable combination'
                    : 'Add to cart'}
            </LiquidGlassButton>

            {feedback ? (
              <p
                className={`aurora-message aurora-message-${feedbackType} mt-4`}
                role={feedbackType === 'error' ? 'alert' : 'status'}
                aria-live="polite"
              >
                {feedback}
              </p>
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

  return <StorefrontLayout hero={hero} contentClassName="aurora-stack-12" />
}
