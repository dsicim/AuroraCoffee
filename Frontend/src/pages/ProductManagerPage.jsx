import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import LiquidGlassButton from '../components/LiquidGlassButton'
import RoleOverviewLayout from '../components/RoleOverviewLayout'
import { fetchManagerProductComments } from '../lib/comments'
import { themePreferences } from '../lib/theme'
import { useTheme } from '../lib/theme-context'
import {
  getProductAvailability,
  getProductCategories,
  useProductCatalog,
} from '../lib/products'

const moderationScopeOptions = [
  {
    value: 'pending',
    label: 'Pending',
    description: 'Comments and edits waiting for moderation review.',
  },
  {
    value: 'all',
    label: 'All',
    description: 'Approved, pending, rejected, and edit states for the selected product.',
  },
  {
    value: 'approved',
    label: 'Approved',
    description: 'The storefront-visible comment set for the selected product.',
  },
]

function formatCommentDate(value) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return 'Unknown date'
  }
}

function formatCommentRating(value) {
  if (!value) {
    return '0'
  }

  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function getCommentStatusLabel(status) {
  switch (String(status || '').trim().toLowerCase()) {
    case 'pending':
      return 'Pending review'
    case 'pending_edit':
      return 'Pending edit'
    case 'edit_rejected':
      return 'Edit rejected'
    case 'rejected':
      return 'Rejected'
    case 'approved':
      return 'Approved'
    default:
      return String(status || 'Unknown')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase())
  }
}

function normalizeSelectionToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const productSelectThemes = {
  neutral: {
    label: 'Neutral',
    swatch: 'rgba(208,193,178,0.72)',
    selectStyle: {
      backgroundColor: 'rgba(255,252,248,0.86)',
      borderColor: 'rgba(208,193,178,0.38)',
      color: 'var(--aurora-text-strong)',
      boxShadow: '0 0 0 0 rgba(0,0,0,0)',
    },
    darkSelectStyle: {
      backgroundColor: 'rgba(24, 37, 33, 0.82)',
      borderColor: 'rgba(205, 220, 217, 0.18)',
      color: 'var(--aurora-text-strong)',
      boxShadow: '0 0 0 0 rgba(0,0,0,0)',
    },
    badgeStyle: {
      backgroundColor: 'rgba(255,252,248,0.86)',
      borderColor: 'rgba(208,193,178,0.38)',
      color: 'var(--aurora-text-strong)',
    },
    darkBadgeStyle: {
      backgroundColor: 'rgba(24, 37, 33, 0.86)',
      borderColor: 'rgba(205, 220, 217, 0.18)',
      color: 'var(--aurora-text-strong)',
    },
  },
  coffee: {
    label: 'Coffee',
    swatch: 'linear-gradient(135deg, #8b684f 0%, #ccb187 100%)',
    selectStyle: {
      backgroundColor: 'rgba(247, 240, 229, 0.94)',
      borderColor: 'rgba(164, 131, 92, 0.4)',
      color: '#6f5139',
      boxShadow: '0 0 0 2px rgba(191, 159, 122, 0.12)',
    },
    darkSelectStyle: {
      backgroundColor: 'rgba(63, 46, 35, 0.82)',
      borderColor: 'rgba(203, 173, 136, 0.34)',
      color: '#f1dec8',
      boxShadow: '0 0 0 2px rgba(203, 173, 136, 0.14)',
    },
    badgeStyle: {
      backgroundColor: 'rgba(247, 240, 229, 0.94)',
      borderColor: 'rgba(164, 131, 92, 0.4)',
      color: '#6f5139',
    },
    darkBadgeStyle: {
      backgroundColor: 'rgba(63, 46, 35, 0.86)',
      borderColor: 'rgba(203, 173, 136, 0.34)',
      color: '#f1dec8',
    },
  },
  accessories: {
    label: 'Accessory',
    swatch: 'linear-gradient(135deg, #8fb6a7 0%, #d9eee5 100%)',
    selectStyle: {
      backgroundColor: 'rgba(236, 245, 241, 0.94)',
      borderColor: 'rgba(126, 159, 135, 0.38)',
      color: '#567568',
      boxShadow: '0 0 0 2px rgba(143, 182, 167, 0.14)',
    },
    darkSelectStyle: {
      backgroundColor: 'rgba(29, 53, 48, 0.84)',
      borderColor: 'rgba(143, 182, 167, 0.32)',
      color: '#d8eee4',
      boxShadow: '0 0 0 2px rgba(143, 182, 167, 0.12)',
    },
    badgeStyle: {
      backgroundColor: 'rgba(236, 245, 241, 0.94)',
      borderColor: 'rgba(126, 159, 135, 0.38)',
      color: '#567568',
    },
    darkBadgeStyle: {
      backgroundColor: 'rgba(29, 53, 48, 0.88)',
      borderColor: 'rgba(143, 182, 167, 0.32)',
      color: '#d8eee4',
    },
  },
  red: {
    label: 'Red',
    swatch: 'linear-gradient(135deg, #b84f45 0%, #e0a39c 100%)',
    selectStyle: {
      backgroundColor: 'rgba(249, 233, 230, 0.96)',
      borderColor: 'rgba(184, 79, 69, 0.42)',
      color: '#8b342b',
      boxShadow: '0 0 0 2px rgba(184, 79, 69, 0.12)',
    },
    darkSelectStyle: {
      backgroundColor: 'rgba(74, 33, 31, 0.84)',
      borderColor: 'rgba(224, 143, 134, 0.34)',
      color: '#ffd9d4',
      boxShadow: '0 0 0 2px rgba(224, 143, 134, 0.12)',
    },
    badgeStyle: {
      backgroundColor: 'rgba(249, 233, 230, 0.96)',
      borderColor: 'rgba(184, 79, 69, 0.42)',
      color: '#8b342b',
    },
    darkBadgeStyle: {
      backgroundColor: 'rgba(74, 33, 31, 0.88)',
      borderColor: 'rgba(224, 143, 134, 0.34)',
      color: '#ffd9d4',
    },
  },
  black: {
    label: 'Black',
    swatch: 'linear-gradient(135deg, #3f4348 0%, #787f87 100%)',
    selectStyle: {
      backgroundColor: 'rgba(237, 239, 242, 0.96)',
      borderColor: 'rgba(89, 95, 103, 0.42)',
      color: '#343940',
      boxShadow: '0 0 0 2px rgba(89, 95, 103, 0.1)',
    },
    darkSelectStyle: {
      backgroundColor: 'rgba(34, 39, 44, 0.9)',
      borderColor: 'rgba(148, 155, 165, 0.28)',
      color: '#edf2f6',
      boxShadow: '0 0 0 2px rgba(148, 155, 165, 0.1)',
    },
    badgeStyle: {
      backgroundColor: 'rgba(237, 239, 242, 0.96)',
      borderColor: 'rgba(89, 95, 103, 0.42)',
      color: '#343940',
    },
    darkBadgeStyle: {
      backgroundColor: 'rgba(34, 39, 44, 0.92)',
      borderColor: 'rgba(148, 155, 165, 0.28)',
      color: '#edf2f6',
    },
  },
  white: {
    label: 'White',
    swatch: 'linear-gradient(135deg, #ffffff 0%, #e7ddd2 100%)',
    selectStyle: {
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: 'rgba(208, 193, 178, 0.52)',
      color: '#7c6a58',
      boxShadow: '0 0 0 2px rgba(208, 193, 178, 0.12)',
    },
    darkSelectStyle: {
      backgroundColor: 'rgba(58, 53, 49, 0.86)',
      borderColor: 'rgba(231, 221, 210, 0.26)',
      color: '#f3ede6',
      boxShadow: '0 0 0 2px rgba(231, 221, 210, 0.1)',
    },
    badgeStyle: {
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: 'rgba(208, 193, 178, 0.52)',
      color: '#7c6a58',
    },
    darkBadgeStyle: {
      backgroundColor: 'rgba(58, 53, 49, 0.88)',
      borderColor: 'rgba(231, 221, 210, 0.26)',
      color: '#f3ede6',
    },
  },
  green: {
    label: 'Green',
    swatch: 'linear-gradient(135deg, #6f8b5f 0%, #b5c7a5 100%)',
    selectStyle: {
      backgroundColor: 'rgba(235, 242, 229, 0.96)',
      borderColor: 'rgba(111, 139, 95, 0.42)',
      color: '#5c734f',
      boxShadow: '0 0 0 2px rgba(111, 139, 95, 0.12)',
    },
    darkSelectStyle: {
      backgroundColor: 'rgba(41, 56, 37, 0.86)',
      borderColor: 'rgba(160, 194, 144, 0.3)',
      color: '#d8ebcf',
      boxShadow: '0 0 0 2px rgba(160, 194, 144, 0.1)',
    },
    badgeStyle: {
      backgroundColor: 'rgba(235, 242, 229, 0.96)',
      borderColor: 'rgba(111, 139, 95, 0.42)',
      color: '#5c734f',
    },
    darkBadgeStyle: {
      backgroundColor: 'rgba(41, 56, 37, 0.88)',
      borderColor: 'rgba(160, 194, 144, 0.3)',
      color: '#d8ebcf',
    },
  },
  blue: {
    label: 'Blue',
    swatch: 'linear-gradient(135deg, #587fa5 0%, #a8c2d9 100%)',
    selectStyle: {
      backgroundColor: 'rgba(233, 240, 248, 0.96)',
      borderColor: 'rgba(88, 127, 165, 0.4)',
      color: '#466888',
      boxShadow: '0 0 0 2px rgba(88, 127, 165, 0.12)',
    },
    darkSelectStyle: {
      backgroundColor: 'rgba(34, 48, 64, 0.88)',
      borderColor: 'rgba(132, 170, 206, 0.32)',
      color: '#d7e8f7',
      boxShadow: '0 0 0 2px rgba(132, 170, 206, 0.1)',
    },
    badgeStyle: {
      backgroundColor: 'rgba(233, 240, 248, 0.96)',
      borderColor: 'rgba(88, 127, 165, 0.4)',
      color: '#466888',
    },
    darkBadgeStyle: {
      backgroundColor: 'rgba(34, 48, 64, 0.9)',
      borderColor: 'rgba(132, 170, 206, 0.32)',
      color: '#d7e8f7',
    },
  },
}

function findProductColorTheme(product) {
  const colorGroup = (product?.options || []).find((group) => {
    const token = normalizeSelectionToken(group?.code || group?.name)
    return token === 'color'
  })

  if (!colorGroup) {
    return null
  }

  const matchingValue = (colorGroup.values || []).find((value) => {
    const token = normalizeSelectionToken(value?.valueCode || value?.label)
    return Object.hasOwn(productSelectThemes, token)
  })

  if (!matchingValue) {
    return null
  }

  const colorToken = normalizeSelectionToken(matchingValue.valueCode || matchingValue.label)
  return {
    ...productSelectThemes[colorToken],
    label: matchingValue.label || productSelectThemes[colorToken].label,
  }
}

function resolveProductThemeStyles(themeConfig, resolvedTheme) {
  const isDarkTheme = resolvedTheme === themePreferences.dark

  return {
    label: themeConfig.label,
    swatch: themeConfig.swatch,
    selectStyle: isDarkTheme ? themeConfig.darkSelectStyle : themeConfig.selectStyle,
    badgeStyle: isDarkTheme ? themeConfig.darkBadgeStyle : themeConfig.badgeStyle,
  }
}

function getProductSelectTheme(product, resolvedTheme) {
  if (!product) {
    return resolveProductThemeStyles(productSelectThemes.neutral, resolvedTheme)
  }

  const explicitColorTheme = findProductColorTheme(product)

  if (explicitColorTheme) {
    return resolveProductThemeStyles(explicitColorTheme, resolvedTheme)
  }

  const categoryToken = normalizeSelectionToken(
    product.parentCategoryName || product.categoryName,
  )

  if (categoryToken.includes('coffee')) {
    return resolveProductThemeStyles(productSelectThemes.coffee, resolvedTheme)
  }

  if (
    categoryToken.includes('accessor') ||
    categoryToken.includes('thermos') ||
    categoryToken.includes('mug') ||
    categoryToken.includes('grinder') ||
    categoryToken.includes('equipment')
  ) {
    return resolveProductThemeStyles(productSelectThemes.accessories, resolvedTheme)
  }

  return resolveProductThemeStyles(productSelectThemes.neutral, resolvedTheme)
}

function getCommentSnapshotSurface(tone, themeStyles, resolvedTheme) {
  const isDarkTheme = resolvedTheme === themePreferences.dark

  if (tone === 'upcoming') {
    return themeStyles?.badgeStyle || resolveProductThemeStyles(productSelectThemes.neutral, resolvedTheme).badgeStyle
  }

  return isDarkTheme
    ? {
        backgroundColor: 'rgba(19, 31, 44, 0.68)',
        borderColor: 'rgba(205, 220, 217, 0.16)',
        color: 'var(--aurora-text-strong)',
      }
    : {
        backgroundColor: 'rgba(255, 250, 246, 0.84)',
        borderColor: 'rgba(208, 193, 178, 0.42)',
        color: 'var(--aurora-text-strong)',
      }
}

function ManagerMetricCard({ label, value, detail }) {
  return (
    <div className="aurora-summary-card p-6">
      <div className="aurora-widget-body">
        <div className="aurora-widget-heading">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
            {label}
          </p>
          <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
            {value}
          </p>
        </div>
        <p className="text-sm leading-7 text-[var(--aurora-text)]">{detail}</p>
      </div>
    </div>
  )
}

function SectionEmptyState({ title, description }) {
  return (
    <div className="aurora-ops-card mt-6 border-dashed px-6 py-10 text-center">
      <p className="font-display text-3xl text-[var(--aurora-text-strong)]">{title}</p>
      {description ? (
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--aurora-text)]">
          {description}
        </p>
      ) : null}
    </div>
  )
}

function CommentSnapshotCard({
  title,
  snapshot,
  tone = 'neutral',
  themeStyles,
  resolvedTheme,
}) {
  if (!snapshot) {
    return null
  }

  const isDarkTheme = resolvedTheme === themePreferences.dark
  const surface = getCommentSnapshotSurface(tone, themeStyles, resolvedTheme)
  const labelColor =
    tone === 'upcoming'
      ? surface.color || 'var(--aurora-text-strong)'
      : 'var(--aurora-olive-deep)'
  const bodyColor = isDarkTheme ? 'rgba(226, 235, 231, 0.84)' : 'var(--aurora-text)'
  const metaColor = isDarkTheme ? 'rgba(214, 226, 221, 0.68)' : 'var(--aurora-text)'
  const cardStyle = {
    background: `linear-gradient(180deg, ${
      isDarkTheme ? 'rgba(247, 251, 255, 0.06)' : 'rgba(255, 255, 255, 0.22)'
    }, rgba(255, 255, 255, 0.02)), ${surface.backgroundColor}`,
    borderColor: surface.borderColor,
    boxShadow: isDarkTheme
      ? 'inset 0 1px 0 rgba(241, 248, 255, 0.08)'
      : 'inset 0 1px 0 rgba(255, 255, 255, 0.28)',
  }

  return (
    <div className="rounded-[1.8rem] border px-5 py-4" style={cardStyle}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-[0.24em]"
            style={{ color: labelColor }}
          >
            {title}
          </p>
          <p
            className="mt-3 text-base font-semibold"
            style={{ color: surface.color || 'var(--aurora-text-strong)' }}
          >
            {snapshot.author}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold" style={{ color: surface.color || 'var(--aurora-text-strong)' }}>
            {formatCommentRating(snapshot.rating)} / 5
          </p>
          <p
            className="mt-2 text-xs uppercase tracking-[0.2em]"
            style={{ color: metaColor }}
          >
            Backend {snapshot.backendRating || '—'}/10
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-7" style={{ color: bodyColor }}>
        {snapshot.comment}
      </p>

      <div
        className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.18em]"
        style={{ color: metaColor }}
      >
        <span>Created {formatCommentDate(snapshot.createdAt)}</span>
        {snapshot.editedAt ? <span>Edited {formatCommentDate(snapshot.editedAt)}</span> : null}
      </div>
    </div>
  )
}

export default function ProductManagerPage() {
  const { resolvedTheme } = useTheme()
  const { products, loading, error } = useProductCatalog()
  const [selectedProductId, setSelectedProductId] = useState('')
  const [moderationScope, setModerationScope] = useState('pending')
  const [moderationResult, setModerationResult] = useState({
    key: '',
    comments: [],
    error: '',
  })

  const lowStockProducts = useMemo(
    () =>
      products
        .filter((product) => product.stock > 0 && product.stock <= 3)
        .sort((left, right) => left.stock - right.stock),
    [products],
  )
  const soldOutCount = useMemo(
    () => products.filter((product) => !getProductAvailability(product).hasStock).length,
    [products],
  )
  const categoryCount = useMemo(
    () => Math.max(0, getProductCategories(products).length - 1),
    [products],
  )
  const moderationProducts = useMemo(
    () => [...products].sort((left, right) => left.name.localeCompare(right.name)),
    [products],
  )
  const selectedProduct = useMemo(
    () =>
      moderationProducts.find((product) => String(product.id) === selectedProductId) || null,
    [moderationProducts, selectedProductId],
  )
  const activeModerationProductId = selectedProduct ? selectedProductId : ''
  const activeModerationKey = activeModerationProductId
    ? `${activeModerationProductId}:${moderationScope}`
    : ''
  const moderationScopeDescription =
    moderationScopeOptions.find((option) => option.value === moderationScope)?.description ||
    ''
  const moderationComments =
    moderationResult.key === activeModerationKey ? moderationResult.comments : []
  const moderationError =
    moderationResult.key === activeModerationKey ? moderationResult.error : ''
  const moderationLoading =
    Boolean(activeModerationKey) && moderationResult.key !== activeModerationKey
  const inventoryStatus =
    error || (loading ? 'Syncing backend catalog.' : 'Backend-backed catalog is active.')
  const selectedProductTheme = useMemo(
    () => getProductSelectTheme(selectedProduct, resolvedTheme),
    [resolvedTheme, selectedProduct],
  )

  function handleModerationProductChange(event) {
    setSelectedProductId(event.target.value)
  }

  function handleModerationScopeChange(nextScope) {
    setModerationScope(nextScope)
  }

  useEffect(() => {
    if (!activeModerationKey) {
      return
    }

    let active = true

    void fetchManagerProductComments(activeModerationProductId, moderationScope)
      .then((comments) => {
        if (!active) {
          return
        }

        setModerationResult({
          key: activeModerationKey,
          comments,
          error: '',
        })
      })
      .catch((fetchError) => {
        if (!active) {
          return
        }

        setModerationResult({
          key: activeModerationKey,
          comments: [],
          error: fetchError?.message || 'Could not load comment moderation data.',
        })
      })

    return () => {
      active = false
    }
  }, [activeModerationKey, activeModerationProductId, moderationScope])

  return (
    <RoleOverviewLayout
      eyebrow="Product manager"
      title="Manage the live catalog"
      description="Use this page to watch inventory pressure and inspect product-scoped comment queues without extra dashboard filler."
    >
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ManagerMetricCard
            label="Products"
            value={loading && !products.length ? '—' : products.length}
            detail="Catalog items currently visible from the backend feed."
          />
          <ManagerMetricCard
            label="Categories"
            value={loading && !products.length ? '—' : categoryCount}
            detail="Customer-facing product groupings currently represented."
          />
          <ManagerMetricCard
            label="Low stock"
            value={loading && !products.length ? '—' : lowStockProducts.length}
            detail="Products with one to three units left."
          />
          <ManagerMetricCard
            label="Sold out"
            value={loading && !products.length ? '—' : soldOutCount}
            detail="Products that currently have no available stock."
          />
        </section>

        <p className="text-sm leading-7 text-[var(--aurora-text)]">{inventoryStatus}</p>

        <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
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

            <p className="mt-5 text-sm leading-7 text-[var(--aurora-text)]">
              This list stays focused on products with one to three units left. Sold-out items are
              tracked in the summary row above.
            </p>

            {loading && !products.length ? (
              <SectionEmptyState
                title="Loading catalog"
                description="Fetching the current backend product feed."
              />
            ) : !lowStockProducts.length ? (
              <SectionEmptyState
                title="No low-stock products"
                description="Nothing is currently in the one to three unit range."
              />
            ) : (
              <div className="mt-6 space-y-3">
                {lowStockProducts.slice(0, 8).map((product) => (
                  <article
                    key={product.slug}
                    className="aurora-ops-card flex items-center justify-between gap-4 p-5"
                  >
                    <div>
                      <p className="font-semibold text-[var(--aurora-text-strong)]">
                        {product.name}
                      </p>
                      <p className="mt-1 text-sm leading-7 text-[var(--aurora-text)]">
                        {product.categoryName || product.parentCategoryName || 'Catalog'}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                      {product.stock} left
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section id="comment-moderation" className="aurora-ops-panel p-8">
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Comment moderation
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Inspect comment states by product
                </h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                  Product
                </span>
                <select
                  className="mt-3 w-full rounded-[1.6rem] border px-4 py-3 text-sm font-semibold outline-none transition"
                  value={activeModerationProductId}
                  onChange={handleModerationProductChange}
                  style={selectedProductTheme.selectStyle}
                >
                  <option value="">Select a product</option>
                  {moderationProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                {selectedProduct ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                      style={selectedProductTheme.badgeStyle}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: selectedProductTheme.swatch }}
                      />
                      {selectedProductTheme.label}
                    </span>
                    <span className="text-sm leading-7 text-[var(--aurora-text)]">
                      {selectedProduct.name}
                    </span>
                  </div>
                ) : null}
              </label>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                  Scope
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {moderationScopeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`aurora-pill ${moderationScope === option.value ? 'aurora-pill-active' : ''}`.trim()}
                      onClick={() => handleModerationScopeChange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
              {moderationScopeDescription}
            </p>

            {moderationError ? (
              <div className="aurora-message aurora-message-error mt-6">{moderationError}</div>
            ) : null}

            {!selectedProduct ? (
              <SectionEmptyState
                title="Select a product"
                description="The backend comment endpoints are product-scoped, so moderation starts after you choose a catalog item."
              />
            ) : moderationLoading ? (
              <SectionEmptyState
                title={`Loading ${moderationScope} comments`}
                description=""
              />
            ) : !moderationComments.length ? (
              <SectionEmptyState
                title={`No ${moderationScope === 'all' ? 'comment records' : moderationScope} comments found`}
                description={`${selectedProduct.name} does not currently have entries in this queue.`}
              />
            ) : (
              <div className="mt-6 space-y-4">
                {moderationComments.map((record) => (
                  <article key={record.id} className="aurora-ops-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                          {record.meta.userName || 'Anonymous'}
                        </p>
                        <p className="mt-3 text-lg font-semibold text-[var(--aurora-text-strong)]">
                          {getCommentStatusLabel(record.meta.status)}
                        </p>
                      </div>
                      <div className="text-right text-sm leading-7 text-[var(--aurora-text)]">
                        <p>{selectedProduct.name}</p>
                        {record.meta.id ? <p>Comment #{record.meta.id}</p> : null}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <CommentSnapshotCard
                        title={record.upcoming ? 'Visible version' : 'Comment snapshot'}
                        snapshot={record.existing}
                        themeStyles={selectedProductTheme}
                        resolvedTheme={resolvedTheme}
                      />
                      <CommentSnapshotCard
                        title="Pending version"
                        snapshot={record.upcoming}
                        tone="upcoming"
                        themeStyles={selectedProductTheme}
                        resolvedTheme={resolvedTheme}
                      />
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[rgba(208,193,178,0.32)] pt-4">
                      <LiquidGlassButton variant="secondary" size="compact" disabled>
                        Approve
                      </LiquidGlassButton>
                      <LiquidGlassButton variant="danger" size="compact" disabled>
                        Reject
                      </LiquidGlassButton>
                      <p className="text-sm leading-7 text-[var(--aurora-text)]">
                        Action buttons stay disabled until the backend exposes a comment status
                        endpoint.
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </RoleOverviewLayout>
  )
}
