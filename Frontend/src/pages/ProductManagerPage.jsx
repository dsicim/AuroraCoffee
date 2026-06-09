import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
import RoleOverviewLayout from '../components/RoleOverviewLayout'
import { fetchManagerProductComments, moderateProductComment } from '../features/comments/infrastructure/commentsApi'
import { mergeUploadedProductImage } from '../features/products/domain/productImageCache'
import { formatCurrency } from '../lib/currency'
import {
  endFrontendDebugIssue,
  logFrontendDebug,
  startFrontendDebugIssue,
  withFrontendDebugIssue,
} from '../lib/frontendDebug'
import { themePreferences } from '../lib/theme'
import { useTheme } from '../lib/theme-context'
import {
  fetchWishlistNotifyQueue,
  sendWishlistNotifications,
} from '../lib/wishlist'
import { fetchAdminOrderById, getOrderStatusPresentation } from '../features/orders/application/orders'
import {
  getProductAvailability,
  getProductCategories,
  getProductCategoryLabel,
  getProductMetaLine,
  isCoffeeProduct,
  createProduct,
  createProductOption,
  createProductOptionValue,
  createProductVariant,
  createProductCategory,
  deleteProduct,
  deleteProductOption,
  deleteProductOptionValue,
  deleteProductVariant,
  deleteProductCategory,
  deleteProductImage,
  fetchProductCategoryTree,
  updateProductImageSet,
  updateProductCategory,
  updateProductDetails,
  updateProductOption,
  updateProductOptionValue,
  updateProductVariant,
  uploadProductImage,
  useProductCatalog,
} from '../lib/products'

const moderationScopeOptions = [
  {
    value: 'all',
    label: 'All',
    description: 'Approved, pending, rejected, and edit states for the selected product.',
  },
  {
    value: 'pending',
    label: 'Pending',
    description: 'Comments and edits waiting for moderation review.',
  },
  {
    value: 'approved',
    label: 'Approved',
    description: 'The storefront-visible comment set for the selected product.',
  },
  {
    value: 'rejected',
    label: 'Rejected',
    description: 'Rejected comments and rejected edits that can still be reviewed or restored.',
  },
]

const productManagerSelectionStorageKey = 'aurora-product-manager-selected-product'
const productManagerDebugPrefix = '[Aurora Product Manager]'
const productImageDrafts = new Map()

function logProductManagerDebug(event, details = {}, issueContext = {}) {
  const entry = logFrontendDebug(`product-manager:${event}`, details, 'info', issueContext)

  if (!entry && typeof console !== 'undefined') {
    console.info(productManagerDebugPrefix, event, {
      ...details,
      at: new Date().toISOString(),
    })
  }
}

function getProductImageDraftKey(productId) {
  const normalizedProductId = Number(productId)

  return Number.isFinite(normalizedProductId) && normalizedProductId > 0
    ? String(normalizedProductId)
    : ''
}

function readProductImageDraft(productId) {
  const draftKey = getProductImageDraftKey(productId)

  return draftKey ? productImageDrafts.get(draftKey) || null : null
}

function writeProductImageDraft(productId, draft) {
  const draftKey = getProductImageDraftKey(productId)

  if (!draftKey) {
    return
  }

  if (!draft?.file) {
    productImageDrafts.delete(draftKey)
    return
  }

  productImageDrafts.set(draftKey, {
    issueId: '',
    primary: false,
    scrollX: 0,
    scrollY: 0,
    selectedVariantId: '',
    ...draft,
  })
}

function clearProductImageDraft(productId) {
  const draftKey = getProductImageDraftKey(productId)

  if (draftKey) {
    productImageDrafts.delete(draftKey)
  }
}

function readStoredProductManagerSelection() {
  if (typeof window === 'undefined') {
    return {
      key: '',
      id: null,
      product: null,
    }
  }

  try {
    const storedValue = window.localStorage.getItem(productManagerSelectionStorageKey)
    if (!storedValue) {
      return {
        key: '',
        id: null,
        product: null,
      }
    }

    const parsedValue = JSON.parse(storedValue)
    const storedProduct = parsedValue?.product && typeof parsedValue.product === 'object'
      ? parsedValue.product
      : null
    const storedId = Number(parsedValue?.id ?? storedProduct?.id)

    return {
      key: String(parsedValue?.key || ''),
      id: Number.isFinite(storedId) && storedId > 0 ? storedId : null,
      product: storedProduct,
    }
  } catch {
    return {
      key: '',
      id: null,
      product: null,
    }
  }
}

function writeStoredProductManagerSelection(product) {
  if (typeof window === 'undefined') {
    return
  }

  if (!product) {
    window.localStorage.removeItem(productManagerSelectionStorageKey)
    return
  }

  window.localStorage.setItem(
    productManagerSelectionStorageKey,
    JSON.stringify({
      key: getProductManagerSelectKey(product),
      id: product.id,
      product,
    }),
  )
}

const productEditFields = [
  { key: 'name', column: 'name', label: 'Name', type: 'text', required: true },
  { key: 'productCode', column: 'product_code', label: 'Product code', type: 'text' },
  { key: 'model', column: 'model', label: 'Model', type: 'text' },
  { key: 'serialNumber', column: 'serial_number', label: 'Serial number', type: 'text' },
  { key: 'description', column: 'description', label: 'Description', type: 'textarea' },
  { key: 'price', column: 'price', label: 'Price', type: 'number', min: 0, step: '0.01' },
  { key: 'stock', column: 'stock', label: 'Stock', type: 'number', min: 0, step: '1' },
  { key: 'warrantyStatus', column: 'warranty_status', label: 'Warranty status', type: 'text' },
  { key: 'distributorInformation', column: 'distributor_information', label: 'Distributor information', type: 'text' },
  { key: 'discountRate', column: 'discount_rate', label: 'Discount %', type: 'number', min: 0, step: '0.01' },
  { key: 'taxRate', column: 'tax', label: 'Tax %', type: 'number', min: 0, step: '1' },
  { key: 'origin', column: 'origin', label: 'Origin', type: 'text' },
  { key: 'roastLevel', column: 'roast_level', label: 'Roast level', type: 'text' },
  { key: 'acidity', column: 'acidity', label: 'Acidity', type: 'text' },
  { key: 'flavorNotes', column: 'flavor_notes', label: 'Flavor notes', type: 'textarea' },
  { key: 'material', column: 'material', label: 'Material', type: 'text' },
  { key: 'capacity', column: 'capacity', label: 'Capacity', type: 'text' },
  { key: 'imageUrl', column: 'image_url', label: 'Image URL', type: 'text' },
]

const productEditFieldGroups = [
  {
    title: 'Storefront identity',
    description: 'Customer-facing names, descriptions, codes, and product media.',
    fieldKeys: ['name', 'productCode', 'model', 'serialNumber', 'description', 'imageUrl'],
  },
  {
    title: 'Pricing and inventory',
    description: 'Numbers that affect availability and checkout totals.',
    fieldKeys: ['price', 'stock', 'discountRate', 'taxRate'],
  },
  {
    title: 'Fulfillment details',
    description: 'Required product traceability and supplier information.',
    fieldKeys: ['warrantyStatus', 'distributorInformation'],
  },
  {
    title: 'Coffee profile',
    description: 'Origin, roast, acidity, and tasting notes for coffee products.',
    fieldKeys: ['origin', 'roastLevel', 'acidity', 'flavorNotes'],
  },
  {
    title: 'Equipment details',
    description: 'Material and capacity for accessories, brewers, mugs, and equipment.',
    fieldKeys: ['material', 'capacity'],
  },
].map((group) => ({
  ...group,
  fields: group.fieldKeys
    .map((fieldKey) => productEditFields.find((field) => field.key === fieldKey))
    .filter(Boolean),
}))

const requiredProductCreateFields = [
  ['name', 'Name'],
  ['model', 'Model'],
  ['serial_number', 'Serial number'],
  ['description', 'Description'],
  ['price', 'Price'],
  ['stock', 'Stock'],
  ['warranty_status', 'Warranty status'],
  ['distributor_information', 'Distributor information'],
]
const requiredProductCreateColumnSet = new Set(requiredProductCreateFields.map(([column]) => column))

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

function formatManagerOrderDate(value) {
  const timestamp = Date.parse(value || '')

  if (!Number.isFinite(timestamp)) {
    return 'Date unavailable'
  }

  return new Date(timestamp).toLocaleString('en-GB', {
    hour12: false,
  })
}

function formatCommentRating(value) {
  if (!value) {
    return '0'
  }

  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function getManagerOrderLocation(order) {
  const delivery = order?.delivery || {}
  const seenParts = new Set()
  const parts = [
    delivery.address,
    delivery.district,
    delivery.city,
    delivery.province,
    delivery.country,
    delivery.postalCode,
  ]
    .map((part) => String(part || '').trim())
    .filter((part) => {
      const normalizedPart = part.toLowerCase()

      if (!normalizedPart || seenParts.has(normalizedPart)) {
        return false
      }

      seenParts.add(normalizedPart)
      return true
    })

  return parts.length ? parts.join(', ') : 'Delivery region unavailable'
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
      backgroundColor: 'rgba(18, 31, 40, 0.82)',
      borderColor: 'rgba(135, 182, 215, 0.34)',
      color: '#d8f2d0',
      boxShadow: '0 0 0 2px rgba(201, 155, 221, 0.12)',
    },
    badgeStyle: {
      backgroundColor: 'rgba(247, 240, 229, 0.94)',
      borderColor: 'rgba(164, 131, 92, 0.4)',
      color: '#6f5139',
    },
    darkBadgeStyle: {
      backgroundColor: 'rgba(18, 31, 40, 0.86)',
      borderColor: 'rgba(135, 182, 215, 0.34)',
      color: '#d8f2d0',
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

function getProductEditForm(product) {
  return Object.fromEntries(
    productEditFields.map((field) => {
      const value = product?.[field.key]

      return [
        field.key,
        value === null || value === undefined ? '' : String(value),
      ]
    }),
  )
}

function normalizeEditValue(field, value) {
  const normalizedValue = String(value ?? '').trim()

  if (field.type !== 'number') {
    return normalizedValue || null
  }

  if (!normalizedValue) {
    return null
  }

  const numericValue = Number(normalizedValue)

  if (!Number.isFinite(numericValue)) {
    throw new Error(`${field.label} must be a valid number.`)
  }

  if (field.min !== undefined && numericValue < field.min) {
    throw new Error(`${field.label} cannot be below ${field.min}.`)
  }

  return field.step === '1' ? Math.round(numericValue) : numericValue
}

function buildProductEdits(product, form) {
  const edits = {}

  for (const field of productEditFields) {
    const nextValue = normalizeEditValue(field, form[field.key])
    const currentValue = normalizeEditValue(field, product?.[field.key])

    if (nextValue !== currentValue) {
      edits[field.column] = nextValue
    }
  }

  if ('name' in edits && !edits.name) {
    throw new Error('Name is required.')
  }

  if ('price' in edits && edits.price === null) {
    throw new Error('Price is required.')
  }

  return edits
}

function normalizeProductCategoryEdit(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return null
  }

  const categoryId = Number(normalizedValue)

  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    throw new Error('Select a valid category.')
  }

  return categoryId
}

function getProductCategorySnapshotFields(categories, categoryId) {
  const normalizedCategoryId = Number(categoryId)

  if (!Number.isFinite(normalizedCategoryId) || normalizedCategoryId <= 0) {
    return {
      categoryId: null,
      categoryName: '',
      parentCategoryName: '',
    }
  }

  const category = categories.find((entry) => Number(entry.id) === normalizedCategoryId)
  const parentCategory = category?.parentId
    ? categories.find((entry) => Number(entry.id) === Number(category.parentId))
    : null

  return {
    categoryId: normalizedCategoryId,
    categoryName: category?.name || '',
    parentCategoryName: parentCategory?.name || '',
  }
}

function applyProductEditsToSnapshot(product, edits, categories = []) {
  if (!product || !edits) {
    return product
  }

  const columnToField = new Map(productEditFields.map((field) => [field.column, field.key]))
  const nextProduct = { ...product }

  for (const [column, value] of Object.entries(edits)) {
    const fieldKey = columnToField.get(column)

    if (fieldKey) {
      nextProduct[fieldKey] = value
    }
  }

  if (Object.hasOwn(edits, 'category_id')) {
    Object.assign(nextProduct, getProductCategorySnapshotFields(categories, edits.category_id))
  }

  return nextProduct
}

function buildProductCreatePayload(form, categoryId) {
  const payload = {}

  for (const field of productEditFields) {
    const nextValue = normalizeEditValue(field, form[field.key])

    if (nextValue !== null && nextValue !== '') {
      payload[field.column] = nextValue
    }
  }

  for (const [column, label] of requiredProductCreateFields) {
    if (payload[column] === undefined || payload[column] === null || payload[column] === '') {
      throw new Error(`${label} is required.`)
    }
  }

  const normalizedCategoryId = Number(categoryId)
  if (Number.isFinite(normalizedCategoryId) && normalizedCategoryId > 0) {
    payload.category_id = normalizedCategoryId
  }

  return payload
}

function getCategoryChildren(categories, parentId) {
  const normalizedParentId = parentId ? Number(parentId) : null
  return categories
    .filter((category) => {
      const categoryParentId = category.parentId ? Number(category.parentId) : null
      return categoryParentId === normalizedParentId
    })
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
}

function getCategoryDescendantIds(categories, categoryId) {
  const descendantIds = new Set()
  const pendingIds = [Number(categoryId)]

  while (pendingIds.length) {
    const currentId = pendingIds.pop()

    for (const child of getCategoryChildren(categories, currentId)) {
      if (descendantIds.has(child.id)) {
        continue
      }

      descendantIds.add(child.id)
      pendingIds.push(child.id)
    }
  }

  return descendantIds
}

function getCategoryProductCount(products, categories, categoryId) {
  const categoryIds = getCategoryDescendantIds(categories, categoryId)
  categoryIds.add(Number(categoryId))

  return (products || []).filter((product) => categoryIds.has(Number(product.categoryId))).length
}

function getCategoryPathLabel(categories, categoryId) {
  const path = []
  const visitedIds = new Set()
  let current = categories.find((category) => Number(category.id) === Number(categoryId))

  while (current && !visitedIds.has(Number(current.id))) {
    visitedIds.add(Number(current.id))
    path.unshift(current.name)
    current = current.parentId
      ? categories.find((category) => Number(category.id) === Number(current.parentId))
      : null
  }

  return path.join(' / ')
}

function getCategorySelectLabel(categories, category) {
  return getCategoryPathLabel(categories, category?.id) || category?.name || 'Category'
}

function hasSiblingCategoryName(categories, { name, parentId, excludedId = null }) {
  const normalizedName = String(name || '').trim().toLowerCase()
  const normalizedParentId = parentId ? Number(parentId) : null

  return categories.some((category) => {
    if (excludedId && Number(category.id) === Number(excludedId)) {
      return false
    }

    return (
      category.name.trim().toLowerCase() === normalizedName &&
      (category.parentId || null) === normalizedParentId
    )
  })
}

function getAvailableCategoryParents(categories, categoryId = null) {
  const normalizedCategoryId = categoryId ? Number(categoryId) : null
  const blockedIds = normalizedCategoryId
    ? getCategoryDescendantIds(categories, normalizedCategoryId)
    : new Set()

  if (normalizedCategoryId) {
    blockedIds.add(normalizedCategoryId)
  }

  return categories
    .filter((category) => !blockedIds.has(Number(category.id)))
    .sort((left, right) => getCategorySelectLabel(categories, left).localeCompare(getCategorySelectLabel(categories, right)))
}

function getInventoryTone(stock) {
  const normalizedStock = Number(stock) || 0

  if (normalizedStock <= 0) {
    return 'Sold out'
  }

  if (normalizedStock <= 3) {
    return 'Low stock'
  }

  return 'In stock'
}

function ProductEditField({ field, defaultValue, idPrefix = 'product-edit', required = field.required }) {
  const fieldId = `${idPrefix}-${field.key}`
  const inputClassName =
    field.type === 'textarea'
      ? 'aurora-textarea aurora-product-edit-input min-h-28'
      : 'aurora-input aurora-product-edit-input'

  return (
    <label
      className={
        field.type === 'textarea'
          ? 'aurora-product-edit-field block md:col-span-2'
          : 'aurora-product-edit-field block'
      }
    >
      <span className="aurora-product-edit-label">
        {field.label}
      </span>
      {field.type === 'textarea' ? (
        <textarea
          id={fieldId}
          name={field.key}
          className={`${inputClassName} mt-3`}
          defaultValue={defaultValue}
          required={required}
        />
      ) : (
        <input
          id={fieldId}
          name={field.key}
          className={`${inputClassName} mt-3`}
          type={field.type}
          min={field.min}
          step={field.step}
          defaultValue={defaultValue}
          required={required}
        />
      )}
    </label>
  )
}

function shouldPreventProductEditEnterSubmit(event) {
  if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) {
    return false
  }

  const target = event.target

  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()

  if (tagName === 'textarea') {
    return false
  }

  if (tagName !== 'input') {
    return tagName === 'select'
  }

  return target.getAttribute('type') !== 'file'
}

function getProductManagerSelectKey(product) {
  return product?.slug || product?.productCode || product?.name || ''
}

function getProductManagerAttributeRows(product) {
  const rows = [
    { label: 'Category', value: getProductCategoryLabel(product) },
    { label: 'Description', value: product.description },
    { label: 'Meta line', value: getProductMetaLine(product) },
  ]

  if (isCoffeeProduct(product)) {
    rows.push(
      { label: 'Origin', value: product.origin },
      { label: 'Roast', value: product.roastLevel },
      { label: 'Acidity', value: product.acidity },
      { label: 'Flavor notes', value: product.flavorNotes },
    )
  } else {
    rows.push(
      { label: 'Material', value: product.material },
      { label: 'Capacity', value: product.capacity },
    )
  }

  return rows
    .map((row) => ({
      ...row,
      value: String(row.value || '').trim(),
    }))
    .filter((row) => row.value)
}

function ProductEditSnapshot({ product }) {
  const categoryLabel = getProductCategoryLabel(product)
  const inventoryTone = getInventoryTone(product.stock)
  const productImage = product.imageUrl
  const attributeRows = getProductManagerAttributeRows(product)

  return (
    <aside className="aurora-product-edit-snapshot" aria-label="Selected product summary">
      <div className="aurora-product-edit-image-shell">
        {productImage ? (
          <img
            src={productImage}
            alt=""
            className="aurora-product-edit-image"
            loading="lazy"
          />
        ) : (
          <div className="aurora-product-edit-image-fallback" aria-hidden="true">
            {product.name?.slice(0, 1) || 'A'}
          </div>
        )}
      </div>

      <div className="aurora-product-edit-snapshot-body">
        <p className="aurora-product-edit-kicker">{categoryLabel}</p>
        <h3 className="aurora-product-edit-product-name">{product.name}</h3>
        <p className="aurora-product-edit-product-code">
          {product.productCode || `Product ${product.id}`}
        </p>
      </div>

      <dl className="aurora-product-edit-stats">
        <div>
          <dt>Price</dt>
          <dd>{formatCurrency(product.price)}</dd>
        </div>
        <div>
          <dt>Stock</dt>
          <dd>{product.stock}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{inventoryTone}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>{Number(product.discountRate || 0)}%</dd>
        </div>
      </dl>

      <div className="aurora-product-edit-attribute-summary">
        <div className="aurora-product-edit-attribute-summary-header">
          <p>Attribute review</p>
          <span>{isCoffeeProduct(product) ? 'Coffee' : 'Equipment'}</span>
        </div>
        {attributeRows.length ? (
          <dl>
            {attributeRows.map((attribute) => (
              <div key={attribute.label}>
                <dt>{attribute.label}</dt>
                <dd>{attribute.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="aurora-product-edit-attribute-empty">
            No storefront attributes are set for this product yet.
          </p>
        )}
      </div>
    </aside>
  )
}

function getProductImageVariantLabel(product, variantId) {
  const normalizedVariantId = Number(variantId)
  const variant = (product?.variants || []).find(
    (entry) => Number(entry.id) === normalizedVariantId,
  )

  if (!variant) {
    return 'Base product'
  }

  const optionLabels = Object.entries(variant.optionValueCodes || {})
    .map(([groupCode, valueCode]) => {
      const group = (product.options || []).find((optionGroup) => optionGroup.code === groupCode)
      const value = (group?.values || []).find((optionValue) => optionValue.valueCode === valueCode)
      return value?.label || valueCode
    })
    .filter(Boolean)

  return optionLabels.length
    ? optionLabels.join(' / ')
    : variant.variantCode || `Variant ${normalizedVariantId}`
}

function getVariantOptionGroups(product) {
  return (product?.options || []).filter((group) => group.storeAsVariant)
}

function getVariantGroupKey(group) {
  return group?.code || group?.id || group?.name || ''
}

function getVariantOptionValueId(group, valueCode) {
  const normalizedValueCode = String(valueCode || '')
  const optionValue = (group?.values || []).find(
    (value) => String(value.valueCode) === normalizedValueCode,
  )

  return optionValue?.id ? String(optionValue.id) : ''
}

function getVariantOptionSelection(product, variant) {
  return Object.fromEntries(
    getVariantOptionGroups(product).map((group) => {
      const groupKey = getVariantGroupKey(group)
      const valueCode = variant?.optionValueCodes?.[groupKey] || ''

      return [groupKey, getVariantOptionValueId(group, valueCode)]
    }),
  )
}

function getVariantForm(product, variant = null) {
  return {
    optionValueIdsByGroup: getVariantOptionSelection(product, variant),
    price: String(Number(variant?.price ?? product?.price ?? 0) || 0),
    stock: String(Math.max(0, Number(variant?.stock) || 0)),
    discountRate: String(Math.max(0, Number(variant?.discountRate) || 0)),
  }
}

function normalizeVariantNumber(value, label, { min = 0, max = null, integer = false } = {}) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    throw new Error(`${label} is required.`)
  }

  const numericValue = Number(normalizedValue)

  if (!Number.isFinite(numericValue)) {
    throw new Error(`${label} must be a valid number.`)
  }

  if (numericValue < min) {
    throw new Error(`${label} cannot be below ${min}.`)
  }

  if (max !== null && numericValue > max) {
    throw new Error(`${label} cannot be above ${max}.`)
  }

  return integer ? Math.round(numericValue) : numericValue
}

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

function getVariantSelectionKeyFromIds(product, optionValueIdsByGroup) {
  return getVariantOptionGroups(product)
    .map((group) => {
      const groupKey = getVariantGroupKey(group)
      const selectedValueId = String(optionValueIdsByGroup?.[groupKey] || '')
      const optionValue = (group.values || []).find(
        (value) => String(value.id) === selectedValueId,
      )

      return optionValue ? `${groupKey}:${optionValue.valueCode}` : ''
    })
    .filter(Boolean)
    .join('|')
}

function getVariantSelectionKey(product, variant) {
  const optionValueIdsByGroup = getVariantOptionSelection(product, variant)
  return getVariantSelectionKeyFromIds(product, optionValueIdsByGroup)
}

function getVariantOptionValueIds(product, form) {
  return getVariantOptionGroups(product).map((group) => {
    const groupKey = getVariantGroupKey(group)
    const optionValueId = Number(form.optionValueIdsByGroup?.[groupKey])

    if (!Number.isFinite(optionValueId) || optionValueId <= 0) {
      throw new Error(`Choose a ${group.name || 'variant option'} value.`)
    }

    return optionValueId
  })
}

function ensureUniqueVariantSelection(product, form, currentVariantId = null) {
  const nextSelectionKey = getVariantSelectionKeyFromIds(product, form.optionValueIdsByGroup)

  if (!nextSelectionKey) {
    return
  }

  const duplicate = (product?.variants || []).find((variant) => {
    if (currentVariantId && Number(variant.id) === Number(currentVariantId)) {
      return false
    }

    return getVariantSelectionKey(product, variant) === nextSelectionKey
  })

  if (duplicate) {
    throw new Error('Another variant already uses that option combination.')
  }
}

function buildCreateVariantPayload(product, form) {
  const optionValueIds = getVariantOptionValueIds(product, form)
  const basePrice = Number(product?.price) || 0
  const price = normalizeVariantNumber(form.price, 'Variant price', { min: basePrice })
  const stock = normalizeVariantNumber(form.stock, 'Variant stock', { integer: true })
  const discountRate = normalizeVariantNumber(form.discountRate, 'Variant discount', { max: 100 })

  ensureUniqueVariantSelection(product, form)

  return {
    price_add: roundCurrency(price - basePrice),
    price_mult: 1,
    stock,
    discount_rate: discountRate,
    option_value_ids: optionValueIds,
  }
}

function buildUpdateVariantEdits(product, variant, form) {
  const edits = {}
  const optionValueIds = getVariantOptionValueIds(product, form)
  const basePrice = Number(product?.price) || 0
  const price = normalizeVariantNumber(form.price, 'Variant price', { min: basePrice })
  const stock = normalizeVariantNumber(form.stock, 'Variant stock', { integer: true })
  const discountRate = normalizeVariantNumber(form.discountRate, 'Variant discount', { max: 100 })
  const nextSelectionKey = getVariantSelectionKeyFromIds(product, form.optionValueIdsByGroup)
  const currentSelectionKey = getVariantSelectionKey(product, variant)

  ensureUniqueVariantSelection(product, form, variant?.id)

  if (nextSelectionKey !== currentSelectionKey) {
    edits.option_value_ids = optionValueIds
  }

  if (roundCurrency(price) !== roundCurrency(variant?.price)) {
    edits.price_add = roundCurrency(price - basePrice)
    edits.price_mult = 1
  }

  if (stock !== Math.max(0, Number(variant?.stock) || 0)) {
    edits.stock = stock
  }

  if (roundCurrency(discountRate) !== roundCurrency(variant?.discountRate)) {
    edits.discount_rate = discountRate
  }

  return edits
}

function getNextProductImageSortOrder(images) {
  return Math.max(
    -1,
    ...(Array.isArray(images) ? images : []).map((image) => Number(image.sortOrder) || 0),
  ) + 1
}

function moveProductImageUrl(images, fromIndex, direction) {
  const nextIndex = fromIndex + direction

  if (nextIndex < 0 || nextIndex >= images.length) {
    return null
  }

  const nextImages = [...images]
  const [image] = nextImages.splice(fromIndex, 1)
  nextImages.splice(nextIndex, 0, image)
  return nextImages.map((entry) => entry.url)
}

function preventProductImageEnterAction(event) {
  if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
}

function confirmDestructiveAction(message) {
  if (!window.confirm(message)) {
    return false
  }

  return window.confirm('Are you sure? This cannot be undone.')
}

function getInsertionIndexFromDrop(event, targetIndex) {
  const rect = event.currentTarget.getBoundingClientRect()
  const heldBelowMiddle = event.clientY > rect.top + rect.height / 2
  return targetIndex + (heldBelowMiddle ? 1 : 0)
}

function moveItemToInsertionIndex(items, fromIndex, insertionIndex) {
  if (fromIndex < 0 || fromIndex >= items.length) {
    return null
  }

  const nextItems = [...items]
  const [item] = nextItems.splice(fromIndex, 1)
  const adjustedIndex = fromIndex < insertionIndex ? insertionIndex - 1 : insertionIndex
  const safeIndex = Math.max(0, Math.min(adjustedIndex, nextItems.length))
  nextItems.splice(safeIndex, 0, item)
  return nextItems
}

function ProductOptionManager({ product, onProductOptionsChange }) {
  const optionGroups = useMemo(() => getVariantOptionGroups(product), [product])
  const [optionName, setOptionName] = useState('')
  const [optionValue, setOptionValue] = useState('')
  const [editingOptionId, setEditingOptionId] = useState('')
  const [optionDrafts, setOptionDrafts] = useState({})
  const [editingValueId, setEditingValueId] = useState('')
  const [valueDrafts, setValueDrafts] = useState({})
  const [newValueDrafts, setNewValueDrafts] = useState({})
  const [dragState, setDragState] = useState(null)
  const [optionState, setOptionState] = useState({
    busy: false,
    error: '',
    success: '',
  })
  const optionBusy = Boolean(optionState.busy)

  function setOptionFeedback(nextState) {
    setOptionState({
      busy: false,
      error: '',
      success: '',
      ...nextState,
    })
  }

  function setOptionError(error) {
    setOptionFeedback({
      error: error?.message || 'Could not update product options.',
      success: '',
    })
  }

  function hasDuplicateOptionName(name, currentGroupId = null) {
    const normalizedName = name.trim().toLowerCase()
    return optionGroups.some((group) => (
      String(group.id) !== String(currentGroupId) &&
      String(group.name || '').trim().toLowerCase() === normalizedName
    ))
  }

  function hasDuplicateValueName(group, label, currentValueId = null) {
    const normalizedLabel = label.trim().toLowerCase()
    return (group?.values || []).some((value) => (
      String(value.id) !== String(currentValueId) &&
      String(value.label || '').trim().toLowerCase() === normalizedLabel
    ))
  }

  function getOptionDraft(group) {
    return optionDrafts[String(group.id)] ?? group.name ?? ''
  }

  function getValueDraft(value) {
    return valueDrafts[String(value.id)] ?? value.label ?? ''
  }

  function updateOptionDraft(groupId, value) {
    setOptionDrafts((current) => ({
      ...current,
      [String(groupId)]: value,
    }))
  }

  function updateValueDraft(valueId, value) {
    setValueDrafts((current) => ({
      ...current,
      [String(valueId)]: value,
    }))
  }

  function updateNewValueDraft(groupId, value) {
    setNewValueDrafts((current) => ({
      ...current,
      [String(groupId)]: value,
    }))
  }

  function beginEditOption(group) {
    setEditingOptionId(String(group.id))
    updateOptionDraft(group.id, group.name || '')
    setOptionFeedback({})
  }

  function beginEditValue(value) {
    setEditingValueId(String(value.id))
    updateValueDraft(value.id, value.label || '')
    setOptionFeedback({})
  }

  function finishOptionRequest(request, successMessage) {
    setOptionState({ busy: true, error: '', success: '' })
    void request
      .then((result) => {
        setOptionFeedback({
          success: result?.msg || successMessage,
        })
      })
      .catch(setOptionError)
  }

  function handleAddOption() {
    const name = optionName.trim()
    const valueLabel = optionValue.trim()

    if (!name) {
      setOptionState({
        busy: false,
        error: 'Option name is required.',
        success: '',
      })
      return
    }

    if (hasDuplicateOptionName(name)) {
      setOptionState({
        busy: false,
        error: 'An option with this name already exists.',
        success: '',
      })
      return
    }

    if (!valueLabel) {
      setOptionState({
        busy: false,
        error: 'Option value is required.',
        success: '',
      })
      return
    }

    const duplicateValueInNewOption = name.trim().toLowerCase() === valueLabel.trim().toLowerCase()
    if (duplicateValueInNewOption) {
      setOptionState({
        busy: false,
        error: 'Use a distinct variant name for the first value.',
        success: '',
      })
      return
    }

    setOptionState({
      busy: true,
      error: '',
      success: '',
    })

    void createProductOption(product.id, { name, valueLabel })
      .then((result) => {
        setOptionName('')
        setOptionValue('')
        if (result?.product) {
          onProductOptionsChange?.(result.product)
        }
        setOptionState({
          busy: false,
          error: '',
          success: result?.msg || 'Product option added.',
        })
      })
      .catch((error) => {
        setOptionState({
          busy: false,
          error: error?.message || 'Could not add product option.',
          success: '',
        })
      })
  }

  function handleSaveOption(group) {
    const name = getOptionDraft(group).trim()

    if (!name) {
      setOptionError(new Error('Option name is required.'))
      return
    }

    if (hasDuplicateOptionName(name, group.id)) {
      setOptionError(new Error('An option with this name already exists.'))
      return
    }

    if (name === group.name) {
      setEditingOptionId('')
      setOptionFeedback({ success: 'No option changes to save.' })
      return
    }

    setOptionState({ busy: true, error: '', success: '' })
    void updateProductOption(group.id, { name })
      .then((result) => {
        setEditingOptionId('')
        setOptionFeedback({ success: result?.msg || 'Option updated.' })
      })
      .catch(setOptionError)
  }

  function handleDeleteOption(group) {
    if (!confirmDestructiveAction(`Delete "${group.name}" and its variants?`)) {
      return
    }

    finishOptionRequest(
      deleteProductOption(group.id),
      'Option deleted.',
    )
  }

  function handleAddValue(group) {
    const label = String(newValueDrafts[String(group.id)] || '').trim()

    if (!label) {
      setOptionError(new Error('Variant name is required.'))
      return
    }

    if (hasDuplicateValueName(group, label)) {
      setOptionError(new Error('A variant with this name already exists in this option.'))
      return
    }

    setOptionState({ busy: true, error: '', success: '' })
    void createProductOptionValue(group.id, { label })
      .then((result) => {
        updateNewValueDraft(group.id, '')
        setOptionFeedback({ success: result?.msg || 'Variant added.' })
      })
      .catch(setOptionError)
  }

  function handleSaveValue(group, value) {
    const label = getValueDraft(value).trim()

    if (!label) {
      setOptionError(new Error('Variant name is required.'))
      return
    }

    if (hasDuplicateValueName(group, label, value.id)) {
      setOptionError(new Error('A variant with this name already exists in this option.'))
      return
    }

    if (label === value.label) {
      setEditingValueId('')
      setOptionFeedback({ success: 'No variant changes to save.' })
      return
    }

    setOptionState({ busy: true, error: '', success: '' })
    void updateProductOptionValue(value.id, { label })
      .then((result) => {
        setEditingValueId('')
        setOptionFeedback({ success: result?.msg || 'Variant updated.' })
      })
      .catch(setOptionError)
  }

  function handleDeleteValue(group, value) {
    if ((group.values || []).length <= 1) {
      setOptionError(new Error('An option must have at least one variant.'))
      return
    }

    if (!confirmDestructiveAction(`Delete "${value.label}" from ${group.name}?`)) {
      return
    }

    finishOptionRequest(
      deleteProductOptionValue(value.id),
      'Variant deleted.',
    )
  }

  function moveItem(items, fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
      return null
    }

    const nextItems = [...items]
    const [item] = nextItems.splice(fromIndex, 1)
    nextItems.splice(toIndex, 0, item)
    return nextItems
  }

  function handleReorderOptions(fromIndex, toIndex) {
    const reorderedOptions = moveItem(optionGroups, fromIndex, toIndex)
    if (!reorderedOptions) {
      return
    }

    setOptionState({ busy: true, error: '', success: '' })
    void Promise.all(
      reorderedOptions.map((group, index) => updateProductOption(group.id, { priority: index + 1 })),
    )
      .then(() => {
        setOptionFeedback({ success: 'Options reordered.' })
      })
      .catch(setOptionError)
  }

  function handleReorderValues(group, fromIndex, insertionIndex) {
    const values = group.values || []
    const reorderedValues = moveItemToInsertionIndex(values, fromIndex, insertionIndex)
    if (!reorderedValues) {
      return
    }

    setOptionState({ busy: true, error: '', success: '' })
    void Promise.all(
      reorderedValues.map((value, index) => updateProductOptionValue(value.id, { sort_order: index })),
    )
      .then(() => {
        setOptionFeedback({ success: 'Variants reordered.' })
      })
      .catch(setOptionError)
  }

  function handleMoveValueToOption(sourceGroup, targetGroup, sourceIndex, insertionIndex = null) {
    const value = sourceGroup?.values?.[sourceIndex]
    if (!value || !targetGroup) {
      return
    }

    if (String(sourceGroup.id) === String(targetGroup.id)) {
      handleReorderValues(sourceGroup, sourceIndex, insertionIndex ?? (sourceGroup.values || []).length)
      return
    }

    if ((sourceGroup.values || []).length <= 1) {
      setOptionError(new Error('An option must have at least one variant.'))
      return
    }

    if (hasDuplicateValueName(targetGroup, value.label)) {
      setOptionError(new Error('A variant with this name already exists in the destination option.'))
      return
    }

    const targetValues = [...(targetGroup.values || [])]
    const insertIndex = insertionIndex === null
      ? targetValues.length
      : Math.max(0, Math.min(insertionIndex, targetValues.length))
    targetValues.splice(insertIndex, 0, value)
    const sourceValues = (sourceGroup.values || []).filter((entry) => String(entry.id) !== String(value.id))

    setOptionState({ busy: true, error: '', success: '' })
    void Promise.all([
      ...targetValues.map((entry, index) => updateProductOptionValue(entry.id, {
        ...(String(entry.id) === String(value.id) ? { option_group_id: targetGroup.id } : {}),
        sort_order: index,
      })),
      ...sourceValues.map((entry, index) => updateProductOptionValue(entry.id, {
        sort_order: index,
      })),
    ])
      .then(() => {
        setOptionFeedback({ success: 'Variant moved.' })
      })
      .catch(setOptionError)
  }

  function handleDropOption(targetIndex) {
    if (dragState?.type !== 'option') {
      return
    }
    handleReorderOptions(dragState.index, targetIndex)
    setDragState(null)
  }

  function handleDropValue(targetGroup, insertionIndex = null) {
    if (dragState?.type !== 'value') {
      return
    }
    const sourceGroup = optionGroups.find((group) => String(group.id) === String(dragState.groupId))
    handleMoveValueToOption(sourceGroup, targetGroup, dragState.index, insertionIndex)
    setDragState(null)
  }

  return (
    <section
      className="aurora-product-edit-group aurora-product-option-manager"
      onKeyDownCapture={preventProductImageEnterAction}
    >
      <div className="aurora-product-image-manager-header">
        <div>
          <p className="aurora-product-edit-label">Product options</p>
          <h3>Edit options and variants</h3>
        </div>
        <span>{optionGroups.length} {optionGroups.length === 1 ? 'option' : 'options'}</span>
      </div>

      <div className="aurora-product-variant-form">
        <label className="aurora-product-edit-field">
          <span className="aurora-product-edit-label">Option name</span>
          <input
            className="aurora-input aurora-product-edit-input mt-3"
            type="text"
            value={optionName}
            disabled={optionBusy}
            placeholder="Weight"
            onChange={(event) => {
              setOptionName(event.target.value)
            }}
          />
        </label>

        <label className="aurora-product-edit-field">
          <span className="aurora-product-edit-label">First value</span>
          <input
            className="aurora-input aurora-product-edit-input mt-3"
            type="text"
            value={optionValue}
            disabled={optionBusy}
            placeholder="250g, 500g, 1kg"
            onChange={(event) => {
              setOptionValue(event.target.value)
            }}
          />
        </label>
      </div>

      <div className="aurora-product-variant-actions">
        <LiquidGlassButton
          type="button"
          variant="quiet"
          size="compact"
          disabled={optionBusy}
          onClick={() => {
            setOptionName('')
            setOptionValue('')
            setOptionState({ busy: false, error: '', success: '' })
          }}
        >
          Reset option
        </LiquidGlassButton>
        <LiquidGlassButton
          type="button"
          variant="secondary"
          size="compact"
          loading={optionBusy}
          disabled={optionBusy}
          onClick={handleAddOption}
        >
          Add option
        </LiquidGlassButton>
      </div>

      {optionState.error ? (
        <p className="aurora-message aurora-message-error" role="alert">
          {optionState.error}
        </p>
      ) : null}
      {optionState.success ? (
        <p className="aurora-message aurora-message-success" role="status" aria-live="polite">
          {optionState.success}
        </p>
      ) : null}

      {optionGroups.length ? (
        <div className="aurora-product-option-tree" role="tree" aria-label="Current product options">
          {optionGroups.map((group, groupIndex) => (
            <article
              key={getVariantGroupKey(group)}
              className="aurora-product-option-node"
              role="treeitem"
              aria-level={1}
              aria-expanded="true"
              draggable={!optionBusy}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                setDragState({ type: 'option', index: groupIndex })
              }}
              onDragOver={(event) => {
                if (dragState?.type === 'option') {
                  event.preventDefault()
                }
              }}
              onDrop={() => {
                if (dragState?.type === 'option') {
                  handleDropOption(groupIndex)
                }
              }}
            >
              <div className="aurora-product-option-node-header">
                <button
                  type="button"
                  className="aurora-product-option-drag"
                  aria-label={`Drag ${group.name || 'option'} to reorder`}
                  disabled={optionBusy}
                >
                  ::
                </button>
                {editingOptionId === String(group.id) ? (
                  <label className="aurora-product-edit-field aurora-product-option-name-editor">
                    <span className="sr-only">Option name</span>
                    <input
                      className="aurora-input aurora-product-edit-input"
                      type="text"
                      value={getOptionDraft(group)}
                      disabled={optionBusy}
                      onChange={(event) => {
                        updateOptionDraft(group.id, event.target.value)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          handleSaveOption(group)
                        }
                        if (event.key === 'Escape') {
                          setEditingOptionId('')
                          setOptionFeedback({})
                        }
                      }}
                    />
                  </label>
                ) : (
                  <div>
                    <p className="aurora-product-image-name">{group.name || 'Option'}</p>
                    <p className="aurora-product-image-meta">
                      {(group.values || []).length} {(group.values || []).length === 1 ? 'variant' : 'variants'}
                    </p>
                  </div>
                )}
                <div className="aurora-product-option-node-actions">
                  {editingOptionId === String(group.id) ? (
                    <>
                      <LiquidGlassButton
                        type="button"
                        variant="secondary"
                        size="compact"
                        disabled={optionBusy}
                        onClick={() => {
                          handleSaveOption(group)
                        }}
                      >
                        Save
                      </LiquidGlassButton>
                      <LiquidGlassButton
                        type="button"
                        variant="quiet"
                        size="compact"
                        disabled={optionBusy}
                        onClick={() => {
                          setEditingOptionId('')
                          setOptionFeedback({})
                        }}
                      >
                        Cancel
                      </LiquidGlassButton>
                    </>
                  ) : (
                    <>
                      <LiquidGlassButton
                        type="button"
                        variant="quiet"
                        size="compact"
                        disabled={optionBusy}
                        onClick={() => {
                          beginEditOption(group)
                        }}
                      >
                        Rename
                      </LiquidGlassButton>
                      <LiquidGlassButton
                        type="button"
                        variant="quiet"
                        size="compact"
                        disabled={optionBusy || groupIndex === 0}
                        onClick={() => {
                          handleReorderOptions(groupIndex, groupIndex - 1)
                        }}
                      >
                        Up
                      </LiquidGlassButton>
                      <LiquidGlassButton
                        type="button"
                        variant="quiet"
                        size="compact"
                        disabled={optionBusy || groupIndex === optionGroups.length - 1}
                        onClick={() => {
                          handleReorderOptions(groupIndex, groupIndex + 1)
                        }}
                      >
                        Down
                      </LiquidGlassButton>
                      <LiquidGlassButton
                        type="button"
                        variant="danger"
                        size="compact"
                        disabled={optionBusy}
                        onClick={() => {
                          handleDeleteOption(group)
                        }}
                      >
                        Delete
                      </LiquidGlassButton>
                    </>
                  )}
                </div>
              </div>

              <div
                className="aurora-product-option-value-list"
                role="group"
                onDragOver={(event) => {
                  if (dragState?.type === 'value') {
                    event.preventDefault()
                    event.stopPropagation()
                  }
                }}
                onDrop={(event) => {
                  if (dragState?.type === 'value') {
                    event.preventDefault()
                    event.stopPropagation()
                    handleDropValue(group)
                  }
                }}
              >
                {(group.values || []).map((value, valueIndex) => (
                  <div
                    key={value.id}
                    className="aurora-product-option-value-row"
                    role="treeitem"
                    aria-level={2}
                    draggable={!optionBusy}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move'
                      setDragState({ type: 'value', groupId: group.id, index: valueIndex })
                    }}
                    onDragOver={(event) => {
                      if (dragState?.type === 'value') {
                        event.preventDefault()
                        event.stopPropagation()
                      }
                    }}
                    onDrop={(event) => {
                      if (dragState?.type === 'value') {
                        event.preventDefault()
                        event.stopPropagation()
                        handleDropValue(group, getInsertionIndexFromDrop(event, valueIndex))
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="aurora-product-option-drag"
                      aria-label={`Drag ${value.label || 'variant'} to reorder`}
                      disabled={optionBusy}
                    >
                      ::
                    </button>
                    {editingValueId === String(value.id) ? (
                      <label className="aurora-product-edit-field aurora-product-option-name-editor">
                        <span className="sr-only">Variant name</span>
                        <input
                          className="aurora-input aurora-product-edit-input"
                          type="text"
                          value={getValueDraft(value)}
                          disabled={optionBusy}
                          onChange={(event) => {
                            updateValueDraft(value.id, event.target.value)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              handleSaveValue(group, value)
                            }
                            if (event.key === 'Escape') {
                              setEditingValueId('')
                              setOptionFeedback({})
                            }
                          }}
                        />
                      </label>
                    ) : (
                      <div>
                        <p className="aurora-product-image-name">{value.label || 'Variant'}</p>
                        <p className="aurora-product-image-meta">Value #{value.id}</p>
                      </div>
                    )}
                    <div className="aurora-product-option-node-actions">
                      {editingValueId === String(value.id) ? (
                        <>
                          <LiquidGlassButton
                            type="button"
                            variant="secondary"
                            size="compact"
                            disabled={optionBusy}
                            onClick={() => {
                              handleSaveValue(group, value)
                            }}
                          >
                            Save
                          </LiquidGlassButton>
                          <LiquidGlassButton
                            type="button"
                            variant="quiet"
                            size="compact"
                            disabled={optionBusy}
                            onClick={() => {
                              setEditingValueId('')
                              setOptionFeedback({})
                            }}
                          >
                            Cancel
                          </LiquidGlassButton>
                        </>
                      ) : (
                        <>
                          <LiquidGlassButton
                            type="button"
                            variant="quiet"
                            size="compact"
                            disabled={optionBusy}
                            onClick={() => {
                              beginEditValue(value)
                            }}
                          >
                            Rename
                          </LiquidGlassButton>
                          <LiquidGlassButton
                            type="button"
                            variant="quiet"
                            size="compact"
                            disabled={optionBusy || valueIndex === 0}
                            onClick={() => {
                              handleReorderValues(group, valueIndex, valueIndex - 1)
                            }}
                          >
                            Up
                          </LiquidGlassButton>
                          <LiquidGlassButton
                            type="button"
                            variant="quiet"
                            size="compact"
                            disabled={optionBusy || valueIndex === (group.values || []).length - 1}
                            onClick={() => {
                              handleReorderValues(group, valueIndex, valueIndex + 2)
                            }}
                          >
                            Down
                          </LiquidGlassButton>
                          <LiquidGlassButton
                            type="button"
                            variant="danger"
                            size="compact"
                            disabled={optionBusy || (group.values || []).length <= 1}
                            onClick={() => {
                              handleDeleteValue(group, value)
                            }}
                          >
                            Delete
                          </LiquidGlassButton>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="aurora-product-option-add-value">
                <label className="aurora-product-edit-field">
                  <span className="aurora-product-edit-label">Add option to {group.name || 'option'}</span>
                  <input
                    className="aurora-input aurora-product-edit-input mt-3"
                    type="text"
                    value={newValueDrafts[String(group.id)] || ''}
                    disabled={optionBusy}
                    placeholder="500g"
                    onChange={(event) => {
                      updateNewValueDraft(group.id, event.target.value)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleAddValue(group)
                      }
                    }}
                  />
                </label>
                <LiquidGlassButton
                  type="button"
                  variant="secondary"
                  size="compact"
                  disabled={optionBusy}
                  onClick={() => {
                    handleAddValue(group)
                  }}
                >
                  Add variant
                </LiquidGlassButton>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function ProductVariantManager({ product }) {
  const optionGroups = useMemo(() => getVariantOptionGroups(product), [product])
  const variants = useMemo(() => (Array.isArray(product?.variants) ? product.variants : []), [product])
  const [mode, setMode] = useState(variants.length ? 'edit' : 'create')
  const [selectedVariantId, setSelectedVariantId] = useState(
    variants[0]?.id ? String(variants[0].id) : '',
  )
  const selectedVariant = variants.find(
    (variant) => String(variant.id) === selectedVariantId,
  ) || (mode === 'edit' ? variants[0] : null)
  const selectedVariantSelectValue =
    mode === 'edit' && selectedVariant?.id ? String(selectedVariant.id) : ''
  const [variantForm, setVariantForm] = useState(() =>
    getVariantForm(product, selectedVariant),
  )
  const [variantState, setVariantState] = useState({
    busy: '',
    error: '',
    success: '',
  })
  const variantBusy = Boolean(variantState.busy)
  const canManageVariants = Boolean(product?.hasVariants || variants.length || optionGroups.length)

  function setVariantBusy(busy) {
    setVariantState({
      busy,
      error: '',
      success: '',
    })
  }

  function setVariantSuccess(success) {
    setVariantState({
      busy: '',
      error: '',
      success,
    })
  }

  function setVariantError(error) {
    setVariantState({
      busy: '',
      error: error?.message || 'Could not update variants.',
      success: '',
    })
  }

  function handleModeChange(nextMode) {
    if (variantBusy) {
      return
    }

    setMode(nextMode)
    setVariantState({ busy: '', error: '', success: '' })

    if (nextMode === 'create') {
      setSelectedVariantId('')
      setVariantForm(getVariantForm(product))
      return
    }

    const nextVariant = selectedVariant || variants[0] || null
    setSelectedVariantId(nextVariant?.id ? String(nextVariant.id) : '')
    setVariantForm(getVariantForm(product, nextVariant))
  }

  function updateVariantOption(groupKey, optionValueId) {
    setVariantForm((current) => ({
      ...current,
      optionValueIdsByGroup: {
        ...current.optionValueIdsByGroup,
        [groupKey]: optionValueId,
      },
    }))
  }

  function updateVariantField(field, value) {
    setVariantForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleVariantSelect(event) {
    const nextVariantId = event.target.value
    const nextVariant = variants.find((variant) => String(variant.id) === nextVariantId) || null

    setSelectedVariantId(nextVariantId)
    setVariantForm(getVariantForm(product, nextVariant))
    setVariantState({ busy: '', error: '', success: '' })
  }

  function handleResetVariantForm() {
    setVariantForm(getVariantForm(product, mode === 'edit' ? selectedVariant : null))
    setVariantState({ busy: '', error: '', success: '' })
  }

  function handleSaveVariant() {
    if (!canManageVariants || variantBusy) {
      return
    }

    if (mode === 'edit' && !selectedVariant) {
      setVariantError(new Error('Select a variant before saving.'))
      return
    }

    let payload = null

    try {
      payload = mode === 'create'
        ? buildCreateVariantPayload(product, variantForm)
        : buildUpdateVariantEdits(product, selectedVariant, variantForm)
    } catch (validationError) {
      setVariantError(validationError)
      return
    }

    if (mode === 'edit' && !Object.keys(payload).length) {
      setVariantSuccess('No variant changes to save.')
      return
    }

    setVariantBusy(mode === 'create' ? 'create' : `save:${selectedVariant.id}`)

    const request = mode === 'create'
      ? createProductVariant(product.id, payload)
      : updateProductVariant(selectedVariant.id, payload)

    void request
      .then((result) => {
        if (mode === 'create') {
          setVariantForm(getVariantForm(product))
        }

        setVariantSuccess(result?.msg || (mode === 'create' ? 'Variant created.' : 'Variant updated.'))
      })
      .catch(setVariantError)
  }

  function handleDeleteVariant() {
    if (!selectedVariant || variantBusy) {
      return
    }

    if (!window.confirm('Delete this product variant permanently?')) {
      return
    }

    setVariantBusy(`delete:${selectedVariant.id}`)

    void deleteProductVariant(selectedVariant.id)
      .then((result) => {
        setMode('create')
        setSelectedVariantId('')
        setVariantForm(getVariantForm(product))
        setVariantSuccess(result?.msg || 'Variant deleted.')
      })
      .catch(setVariantError)
  }

  return (
    <section
      className="aurora-product-edit-group aurora-product-variant-manager"
      onKeyDownCapture={preventProductImageEnterAction}
    >
      <div className="aurora-product-image-manager-header">
        <div>
          <p className="aurora-product-edit-label">Product variants</p>
          <h3>Edit option pricing and stock</h3>
        </div>
        <span>{variants.length} {variants.length === 1 ? 'variant' : 'variants'}</span>
      </div>

      {!canManageVariants ? (
        <div className="aurora-product-image-empty">
          <p>No variant option groups</p>
          <span>Add backend variant option groups before creating variants for this product.</span>
        </div>
      ) : (
        <>
          <div className="aurora-product-variant-toolbar">
            <div className="aurora-product-variant-mode" role="group" aria-label="Variant form mode">
              <LiquidGlassButton
                type="button"
                size="compact"
                variant={mode === 'edit' ? 'secondary' : 'quiet'}
                selected={mode === 'edit'}
                disabled={variantBusy || !variants.length}
                onClick={() => {
                  handleModeChange('edit')
                }}
              >
                Edit
              </LiquidGlassButton>
              <LiquidGlassButton
                type="button"
                size="compact"
                variant={mode === 'create' ? 'secondary' : 'quiet'}
                selected={mode === 'create'}
                disabled={variantBusy}
                onClick={() => {
                  handleModeChange('create')
                }}
              >
                New
              </LiquidGlassButton>
            </div>

            <label className="aurora-product-edit-field">
              <span className="aurora-product-edit-label">Variant</span>
              <select
                className="aurora-select aurora-product-edit-input mt-3"
                value={selectedVariantSelectValue}
                disabled={variantBusy || mode !== 'edit' || !variants.length}
                onChange={handleVariantSelect}
              >
                {variants.length ? null : <option value="">No variants yet</option>}
                {variants.map((variant) => (
                  <option key={variant.id} value={String(variant.id)}>
                    {getProductImageVariantLabel(product, variant.id)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="aurora-product-variant-form">
            {optionGroups.map((group) => {
              const groupKey = getVariantGroupKey(group)

              return (
                <label key={groupKey} className="aurora-product-edit-field">
                  <span className="aurora-product-edit-label">{group.name || 'Option'}</span>
                  <select
                    className="aurora-select aurora-product-edit-input mt-3"
                    value={variantForm.optionValueIdsByGroup[groupKey] || ''}
                    disabled={variantBusy}
                    required
                    onChange={(event) => {
                      updateVariantOption(groupKey, event.target.value)
                    }}
                  >
                    <option value="">Choose {group.name || 'option'}</option>
                    {(group.values || []).map((value) => (
                      <option key={value.id} value={String(value.id)}>
                        {value.label}
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}

            <label className="aurora-product-edit-field">
              <span className="aurora-product-edit-label">Variant price</span>
              <input
                className="aurora-input aurora-product-edit-input mt-3"
                type="number"
                min={Number(product.price) || 0}
                step="0.01"
                value={variantForm.price}
                disabled={variantBusy}
                onChange={(event) => {
                  updateVariantField('price', event.target.value)
                }}
              />
            </label>

            <label className="aurora-product-edit-field">
              <span className="aurora-product-edit-label">Variant stock</span>
              <input
                className="aurora-input aurora-product-edit-input mt-3"
                type="number"
                min="0"
                step="1"
                value={variantForm.stock}
                disabled={variantBusy}
                onChange={(event) => {
                  updateVariantField('stock', event.target.value)
                }}
              />
            </label>

            <label className="aurora-product-edit-field">
              <span className="aurora-product-edit-label">Discount %</span>
              <input
                className="aurora-input aurora-product-edit-input mt-3"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={variantForm.discountRate}
                disabled={variantBusy}
                onChange={(event) => {
                  updateVariantField('discountRate', event.target.value)
                }}
              />
            </label>
          </div>

          <div className="aurora-product-variant-actions">
            <LiquidGlassButton
              type="button"
              variant="quiet"
              size="compact"
              disabled={variantBusy}
              onClick={handleResetVariantForm}
            >
              Reset variant
            </LiquidGlassButton>
            {mode === 'edit' ? (
              <LiquidGlassButton
                type="button"
                variant="danger"
                size="compact"
                loading={variantState.busy === `delete:${selectedVariant?.id}`}
                disabled={variantBusy || !selectedVariant}
                onClick={handleDeleteVariant}
              >
                Delete variant
              </LiquidGlassButton>
            ) : null}
            <LiquidGlassButton
              type="button"
              variant="secondary"
              size="compact"
              loading={
                variantState.busy === 'create' ||
                variantState.busy === `save:${selectedVariant?.id}`
              }
              disabled={variantBusy || (mode === 'edit' && !selectedVariant)}
              onClick={handleSaveVariant}
            >
              {mode === 'create' ? 'Create variant' : 'Save variant'}
            </LiquidGlassButton>
          </div>

          {variantState.error ? (
            <p className="aurora-message aurora-message-error" role="alert">
              {variantState.error}
            </p>
          ) : null}
          {variantState.success ? (
            <p className="aurora-message aurora-message-success" role="status" aria-live="polite">
              {variantState.success}
            </p>
          ) : null}

          {variants.length ? (
            <div className="aurora-product-variant-list" aria-label="Current variants">
              {variants.map((variant) => (
                <article
                  key={variant.id}
                  className={
                    String(variant.id) === selectedVariantSelectValue && mode === 'edit'
                      ? 'aurora-product-variant-row is-selected'
                      : 'aurora-product-variant-row'
                  }
                >
                  <div>
                    <p className="aurora-product-image-name">
                      {getProductImageVariantLabel(product, variant.id)}
                    </p>
                    <p className="aurora-product-image-meta">
                      #{variant.id} · {Math.max(0, Number(variant.stock) || 0)} in stock · {Number(variant.discountRate || 0)}% discount
                    </p>
                  </div>
                  <strong>{formatCurrency(variant.price)}</strong>
                </article>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

function ProductImageManager({ product, onProductImagesChange }) {
  const debugInstance = useId()
  const images = useMemo(() => (Array.isArray(product?.images) ? product.images : []), [product])
  const [initialDraft] = useState(() => readProductImageDraft(product?.id))
  const initialDraftRef = useRef(initialDraft)
  const [imageOverride, setImageOverride] = useState({
    productId: null,
    images: null,
  })
  const variantOptions = (product?.variants || [])
    .map((variant) => ({
      id: Number(variant.id) || 0,
      label: getProductImageVariantLabel(product, variant.id),
    }))
    .filter((variant) => variant.id > 0)
  const selectedFileRef = useRef(initialDraft?.file || null)
  const [selectedFileName, setSelectedFileName] = useState(initialDraft?.file?.name || '')
  const fileInputRef = useRef(null)
  const uploadInFlightRef = useRef(false)
  const uploadIssueIdRef = useRef(initialDraft?.issueId || '')
  const debugInitialRef = useRef({
    imageCount: images.length,
    productCode: product?.productCode || '',
    productId: product?.id || null,
  })
  const debugStateRef = useRef({
    imageBusy: false,
    imageCount: images.length,
    productCode: product?.productCode || '',
    productId: product?.id || null,
    selectedFileName: '',
    selectedVariantId: '',
  })
  const [fileInputVersion, setFileInputVersion] = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState(initialDraft?.selectedVariantId || '')
  const [primaryUpload, setPrimaryUpload] = useState(
    typeof initialDraft?.primary === 'boolean'
      ? initialDraft.primary
      : images.length === 0,
  )
  const [imageState, setImageState] = useState({
    busy: '',
    error: '',
    success: '',
  })

  const selectedVariant = variantOptions.find(
    (variant) => String(variant.id) === selectedVariantId,
  )
  const imageBusy = Boolean(imageState.busy)
  const displayedImages =
    Number(imageOverride.productId) === Number(product?.id) && Array.isArray(imageOverride.images)
      ? imageOverride.images
      : images

  function persistUploadDraft(nextDraft = {}) {
    const uploadFile = nextDraft.file === undefined ? selectedFileRef.current : nextDraft.file

    if (!uploadFile) {
      clearProductImageDraft(product?.id)
      return
    }

    writeProductImageDraft(product?.id, {
      file: uploadFile,
      issueId: nextDraft.issueId === undefined ? uploadIssueIdRef.current : nextDraft.issueId,
      primary: nextDraft.primary === undefined ? primaryUpload : nextDraft.primary,
      scrollX: nextDraft.scrollX === undefined ? window.scrollX : nextDraft.scrollX,
      scrollY: nextDraft.scrollY === undefined ? window.scrollY : nextDraft.scrollY,
      selectedVariantId: nextDraft.selectedVariantId === undefined ? selectedVariantId : nextDraft.selectedVariantId,
    })
  }

  function getUploadIssueId(source, details = {}) {
    if (uploadIssueIdRef.current) {
      persistUploadDraft({ issueId: uploadIssueIdRef.current })
      return uploadIssueIdRef.current
    }

    uploadIssueIdRef.current = startFrontendDebugIssue('product-manager-image-upload', {
      source,
      component: 'ProductImageManager',
      instance: debugInstance,
      productId: product?.id || null,
      productCode: product?.productCode || '',
      productName: product?.name || '',
      imageCount: displayedImages.length,
      ...details,
    })
    persistUploadDraft({ issueId: uploadIssueIdRef.current })

    return uploadIssueIdRef.current
  }

  function clearUploadIssue(outcome, details = {}) {
    const issueId = uploadIssueIdRef.current

    if (!issueId) {
      return
    }

    endFrontendDebugIssue(issueId, outcome, {
      component: 'ProductImageManager',
      instance: debugInstance,
      productId: product?.id || null,
      productCode: product?.productCode || '',
      selectedFileName: selectedFileRef.current?.name || selectedFileName,
      selectedVariantId,
      ...details,
    })
    uploadIssueIdRef.current = ''
    clearProductImageDraft(product?.id)
  }

  const restoreDraftScroll = useCallback(() => {
    const draft = readProductImageDraft(product?.id)

    if (!draft || !Number.isFinite(draft.scrollY)) {
      return
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({
        left: Number(draft.scrollX) || 0,
        top: Number(draft.scrollY) || 0,
        behavior: 'auto',
      })
    })
  }, [product?.id])

  useEffect(() => {
    debugStateRef.current = {
      imageBusy,
      imageCount: displayedImages.length,
      productCode: product?.productCode || '',
      productId: product?.id || null,
      selectedFileName: selectedFileRef.current?.name || selectedFileName,
      selectedVariantId,
    }
  }, [
    displayedImages.length,
    imageBusy,
    product?.id,
    product?.productCode,
    selectedFileName,
    selectedVariantId,
  ])

  useEffect(() => {
    const debugInitial = debugInitialRef.current
    const restoredDraft = initialDraftRef.current

    logProductManagerDebug('image-manager:mounted', {
      instance: debugInstance,
      productId: debugInitial.productId,
      productCode: debugInitial.productCode,
      imageCount: debugInitial.imageCount,
      restoredFileName: restoredDraft?.file?.name || '',
      restoredIssueId: restoredDraft?.issueId || '',
    })

    if (restoredDraft?.file) {
      restoreDraftScroll()
      logProductManagerDebug('image-manager:draft-restored', {
        instance: debugInstance,
        productId: debugInitial.productId,
        productCode: debugInitial.productCode,
        fileName: restoredDraft.file.name,
        fileSize: restoredDraft.file.size,
        issueId: restoredDraft.issueId || '',
        selectedVariantId: restoredDraft.selectedVariantId || '',
      }, { issueId: restoredDraft.issueId || '' })
    }

    return () => {
      const debugState = debugStateRef.current
      const activeUploadIssueId = uploadIssueIdRef.current
      const preservedDraft = readProductImageDraft(debugState.productId)
      logProductManagerDebug('image-manager:unmounted', {
        instance: debugInstance,
        productId: debugState.productId,
        productCode: debugState.productCode,
        selectedFileName: debugState.selectedFileName,
        selectedVariantId: debugState.selectedVariantId,
        imageBusy: debugState.imageBusy,
        imageCount: debugState.imageCount,
        preservingDraft: Boolean(preservedDraft?.file),
      }, { issueId: activeUploadIssueId })

      if (activeUploadIssueId && uploadInFlightRef.current) {
        endFrontendDebugIssue(activeUploadIssueId, 'interrupted', {
          component: 'ProductImageManager',
          reason: 'component-unmounted-with-active-upload-issue',
          ...debugState,
        })
        uploadIssueIdRef.current = ''
      }
    }
  }, [debugInstance, restoreDraftScroll])

  useEffect(() => {
    logProductManagerDebug('image-manager:product-state', {
      instance: debugInstance,
      productId: product?.id,
      productCode: product?.productCode,
      sourceImageCount: images.length,
      displayedImageCount: displayedImages.length,
      selectedFileName,
      selectedVariantId,
      busy: imageState.busy,
      error: imageState.error,
      success: imageState.success,
    })
  }, [
    debugInstance,
    displayedImages.length,
    imageState.busy,
    imageState.error,
    imageState.success,
    images.length,
    product?.id,
    product?.productCode,
    selectedFileName,
    selectedVariantId,
  ])

  function setImageBusy(busy) {
    logProductManagerDebug('image-manager:busy', {
      instance: debugInstance,
      productId: product?.id,
      busy,
    })
    setImageState({
      busy,
      error: '',
      success: '',
    })
  }

  function setImageSuccess(success) {
    logProductManagerDebug('image-manager:success', {
      instance: debugInstance,
      productId: product?.id,
      success,
    })
    setImageState({
      busy: '',
      error: '',
      success,
    })
  }

  function setImageError(error) {
    logProductManagerDebug('image-manager:error', {
      instance: debugInstance,
      productId: product?.id,
      message: error?.message || 'Could not update product images.',
    })
    setImageState({
      busy: '',
      error: error?.message || 'Could not update product images.',
      success: '',
    })
  }

  function handleUpload(event) {
    event?.preventDefault()
    event?.stopPropagation()

    if (imageBusy || uploadInFlightRef.current) {
      const issueId = getUploadIssueId('upload-blocked')
      logProductManagerDebug('image-manager:upload-blocked', {
        instance: debugInstance,
        productId: product?.id,
        imageBusy,
        uploadInFlight: uploadInFlightRef.current,
      }, { issueId })
      return
    }

    const uploadFile = selectedFileRef.current

    if (!uploadFile) {
      const issueId = getUploadIssueId('upload-missing-file')
      logProductManagerDebug('image-manager:upload-missing-file', {
        instance: debugInstance,
        productId: product?.id,
        selectedFileName,
      }, { issueId })
      setImageError(new Error('Choose an image file before uploading.'))
      clearUploadIssue('missing-file')
      return
    }

    uploadInFlightRef.current = true
    setImageBusy('upload')
    const currentImages = displayedImages
    const uploadSortOrder = getNextProductImageSortOrder(currentImages)
    const uploadVariantId = selectedVariant?.id || ''
    const uploadPrimary = primaryUpload
    const uploadIssueId = getUploadIssueId('upload-start', {
      fileName: uploadFile.name,
      fileSize: uploadFile.size,
      variantId: uploadVariantId || null,
      primary: uploadPrimary,
    })
    logProductManagerDebug('image-manager:upload-start', {
      instance: debugInstance,
      productId: product?.id,
      productCode: product?.productCode,
      fileName: uploadFile.name,
      fileSize: uploadFile.size,
      sortOrder: uploadSortOrder,
      variantId: uploadVariantId || null,
      primary: uploadPrimary,
      currentImageCount: currentImages.length,
    }, { issueId: uploadIssueId })

    void withFrontendDebugIssue(uploadIssueId, () =>
      uploadProductImage({
        productId: product.id,
        file: uploadFile,
        sortOrder: uploadSortOrder,
        variantId: uploadVariantId,
        primary: uploadPrimary,
        refreshOnCacheMiss: false,
      }),
    )
      .then((result) => {
        if (!result?.url) {
          throw new Error('Product image uploaded, but the response did not include the image URL.')
        }

        const nextProduct = mergeUploadedProductImage(
          { ...product, images: currentImages },
          {
            url: result?.url,
            sortOrder: Number.isFinite(Number(result?.sortOrder ?? result?.sort_order))
              ? Number(result?.sortOrder ?? result?.sort_order)
              : uploadSortOrder,
            variantId: Number.isFinite(Number(result?.variantId ?? result?.variant_id))
              ? Number(result?.variantId ?? result?.variant_id)
              : uploadVariantId,
            primary: typeof result?.isPrimary === 'boolean' ? result.isPrimary : uploadPrimary,
          },
        )

        if (Array.isArray(nextProduct?.images)) {
          logProductManagerDebug('image-manager:upload-merge', {
            instance: debugInstance,
            productId: product?.id,
            uploadedUrl: result.url,
            nextImageCount: nextProduct.images.length,
          }, { issueId: uploadIssueId })
          setImageOverride({
            productId: product.id,
            images: nextProduct.images,
          })
          onProductImagesChange?.(nextProduct)
        }

        selectedFileRef.current = null
        setSelectedFileName('')
        setFileInputVersion((version) => version + 1)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        setSelectedVariantId('')
        setPrimaryUpload(false)
        setImageSuccess(result?.msg || (displayedImages.length ? 'Product image uploaded.' : 'Product image uploaded and set as primary.'))
        clearUploadIssue('success', {
          uploadedUrl: result.url,
          nextImageCount: nextProduct?.images?.length || 0,
        })
      })
      .catch((error) => {
        logProductManagerDebug('image-manager:upload-failed', {
          instance: debugInstance,
          productId: product?.id,
          message: error?.message || '',
        }, { issueId: uploadIssueId })
        setImageError(error)
        clearUploadIssue('failed', {
          message: error?.message || '',
        })
      })
      .finally(() => {
        logProductManagerDebug('image-manager:upload-finished', {
          instance: debugInstance,
          productId: product?.id,
          selectedFileName: selectedFileRef.current?.name || '',
        }, { issueId: uploadIssueId })
        uploadInFlightRef.current = false
      })
  }

  function handleSetPrimary(image) {
    setImageBusy(`primary:${image.url}`)

    void updateProductImageSet(product.id, {
      setAsPrimary: true,
      url: image.url,
    })
      .then((result) => {
        setImageOverride({
          productId: product.id,
          images: null,
        })
        setImageSuccess(result?.setprimary || result?.msg || 'Primary image updated.')
      })
      .catch(setImageError)
  }

  function handleReorder(index, direction) {
    const newOrder = moveProductImageUrl(displayedImages, index, direction)

    if (!newOrder) {
      return
    }

    setImageBusy(`order:${displayedImages[index].url}:${direction}`)

    void updateProductImageSet(product.id, { newOrder })
      .then((result) => {
        setImageOverride({
          productId: product.id,
          images: null,
        })
        setImageSuccess(result?.setorder || result?.msg || 'Image order updated.')
      })
      .catch(setImageError)
  }

  function handleDelete(image) {
    if (!window.confirm('Delete this product image permanently?')) {
      return
    }

    setImageBusy(`delete:${image.url}`)

    void deleteProductImage(image.url)
      .then((result) => {
        setImageOverride({
          productId: product.id,
          images: null,
        })
        setImageSuccess(result?.msg || 'Product image deleted.')
      })
      .catch(setImageError)
  }

  return (
    <section
      className="aurora-product-edit-group aurora-product-image-manager"
      onKeyDownCapture={preventProductImageEnterAction}
      onSubmitCapture={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <div className="aurora-product-image-manager-header">
        <div>
          <p className="aurora-product-edit-label">Product images</p>
          <h3>Manage gallery and variants</h3>
        </div>
        <span>{displayedImages.length} {displayedImages.length === 1 ? 'image' : 'images'}</span>
      </div>

      <div className="aurora-product-image-upload">
        <div className="aurora-product-edit-field">
          <span className="aurora-product-edit-label">Upload image</span>
          <input
            key={fileInputVersion}
            ref={fileInputRef}
            className="aurora-product-image-hidden-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={imageBusy}
            onChange={(event) => {
              if (imageBusy) {
                const issueId = getUploadIssueId('file-change-ignored-busy')
                logProductManagerDebug('image-manager:file-change-ignored-busy', {
                  instance: debugInstance,
                  productId: product?.id,
                }, { issueId })
                return
              }

              const nextFile = event.target.files?.[0] || null
              const issueId = getUploadIssueId('file-change', {
                fileName: nextFile?.name || '',
                fileSize: nextFile?.size || 0,
              })
              logProductManagerDebug('image-manager:file-change', {
                instance: debugInstance,
                productId: product?.id,
                productCode: product?.productCode,
                fileName: nextFile?.name || '',
                fileSize: nextFile?.size || 0,
                previousFileName: selectedFileRef.current?.name || '',
              }, { issueId })
              selectedFileRef.current = nextFile
              if (nextFile) {
                persistUploadDraft({
                  file: nextFile,
                  issueId,
                  scrollX: window.scrollX,
                  scrollY: window.scrollY,
                })
              } else {
                clearProductImageDraft(product?.id)
              }
              setSelectedFileName(nextFile?.name || '')
              setImageState({ busy: '', error: '', success: '' })
              restoreDraftScroll()
            }}
          />
          <LiquidGlassButton
            type="button"
            variant="secondary"
            disabled={imageBusy}
            onClick={() => {
              persistUploadDraft({
                scrollX: window.scrollX,
                scrollY: window.scrollY,
              })
              const issueId = getUploadIssueId('file-dialog-open')
              logProductManagerDebug('image-manager:file-dialog-open', {
                instance: debugInstance,
                productId: product?.id,
                productCode: product?.productCode,
                selectedFileName,
              }, { issueId })
              fileInputRef.current?.click()
            }}
          >
            {selectedFileName ? 'Change file' : 'Choose file'}
          </LiquidGlassButton>
          {selectedFileName ? (
            <small className="aurora-product-image-file-name">{selectedFileName}</small>
          ) : null}
        </div>

        <label className="aurora-product-edit-field">
          <span className="aurora-product-edit-label">Image applies to</span>
          <select
            className="aurora-select aurora-product-edit-input mt-3"
            value={selectedVariantId}
            disabled={imageBusy}
            onChange={(event) => {
              const issueId = getUploadIssueId('variant-change', {
                nextVariantId: event.target.value,
              })
              logProductManagerDebug('image-manager:variant-change', {
                instance: debugInstance,
                productId: product?.id,
                previousVariantId: selectedVariantId,
                nextVariantId: event.target.value,
                selectedFileName,
              }, { issueId })
              persistUploadDraft({
                issueId,
                selectedVariantId: event.target.value,
              })
              setSelectedVariantId(event.target.value)
            }}
          >
            <option value="">Base product image</option>
            {variantOptions.map((variant) => (
              <option key={variant.id} value={String(variant.id)}>
                {variant.label}
              </option>
            ))}
          </select>
        </label>

        <label className="aurora-product-image-primary-toggle">
          <input
            type="checkbox"
            checked={primaryUpload}
            disabled={imageBusy}
            onChange={(event) => {
              const issueId = getUploadIssueId('primary-toggle', {
                nextPrimary: event.target.checked,
              })
              logProductManagerDebug('image-manager:primary-toggle', {
                instance: debugInstance,
                productId: product?.id,
                previousPrimary: primaryUpload,
                nextPrimary: event.target.checked,
                selectedFileName,
              }, { issueId })
              persistUploadDraft({
                issueId,
                primary: event.target.checked,
              })
              setPrimaryUpload(event.target.checked)
            }}
          />
          <span>Set as primary</span>
        </label>

        <LiquidGlassButton
          type="button"
          variant="secondary"
          loading={imageState.busy === 'upload'}
          disabled={imageBusy}
          onClick={handleUpload}
        >
          Upload image
        </LiquidGlassButton>
      </div>

      {imageState.error ? (
        <p className="aurora-message aurora-message-error" role="alert">{imageState.error}</p>
      ) : null}
      {imageState.success ? (
        <p className="aurora-message aurora-message-success" role="status" aria-live="polite">{imageState.success}</p>
      ) : null}

      {displayedImages.length ? (
        <div className="aurora-product-image-list">
          {displayedImages.map((image, index) => (
            <article key={image.url} className="aurora-product-image-row">
              <img src={image.src} alt="" loading="lazy" />
              <div className="aurora-product-image-row-body">
                <div>
                  <p className="aurora-product-image-name">{image.url}</p>
                  <p className="aurora-product-image-meta">
                    {image.isPrimary ? 'Primary' : 'Gallery'} · {getProductImageVariantLabel(product, image.variantId)} · Order {image.sortOrder}
                  </p>
                </div>
                <div className="aurora-product-image-actions">
                  <LiquidGlassButton
                    type="button"
                    size="compact"
                    variant="quiet"
                    disabled={imageBusy || index === 0}
                    loading={imageState.busy === `order:${image.url}:-1`}
                    onClick={() => {
                      handleReorder(index, -1)
                    }}
                  >
                    Move up
                  </LiquidGlassButton>
                  <LiquidGlassButton
                    type="button"
                    size="compact"
                    variant="quiet"
                    disabled={imageBusy || index === displayedImages.length - 1}
                    loading={imageState.busy === `order:${image.url}:1`}
                    onClick={() => {
                      handleReorder(index, 1)
                    }}
                  >
                    Move down
                  </LiquidGlassButton>
                  <LiquidGlassButton
                    type="button"
                    size="compact"
                    variant="secondary"
                    disabled={imageBusy || image.isPrimary}
                    loading={imageState.busy === `primary:${image.url}`}
                    onClick={() => {
                      handleSetPrimary(image)
                    }}
                  >
                    Set primary
                  </LiquidGlassButton>
                  <LiquidGlassButton
                    type="button"
                    size="compact"
                    variant="danger"
                    disabled={imageBusy}
                    loading={imageState.busy === `delete:${image.url}`}
                    onClick={() => {
                      handleDelete(image)
                    }}
                  >
                    Delete
                  </LiquidGlassButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="aurora-product-image-empty">
          <p>No uploaded images</p>
          <span>Upload the first image to create the product gallery.</span>
        </div>
      )}
    </section>
  )
}

function CategoryTreeNode({
  category,
  categories,
  products,
  selectedCategoryId,
  busy,
  editingCategoryId,
  editDrafts,
  childDrafts,
  openChildCategoryId,
  dragCategoryId,
  onSelect,
  onBeginRename,
  onEditDraftChange,
  onSaveRename,
  onCancelRename,
  onChildDraftChange,
  onToggleChildEditor,
  onCloseChildEditor,
  onAddChild,
  onDelete,
  onDragStart,
  onDragEnd,
  onDropOnCategory,
  level = 1,
  siblingIndex = 0,
}) {
  const children = getCategoryChildren(categories, category.id)
  const selected = String(category.id) === String(selectedCategoryId)
  const editing = String(category.id) === String(editingCategoryId)
  const childEditorOpen = String(category.id) === String(openChildCategoryId)
  const childEditorId = `aurora-category-child-${category.id}`
  const childNameInputRef = useRef(null)
  const productCount = getCategoryProductCount(products, categories, category.id)
  const childCount = getCategoryDescendantIds(categories, category.id).size
  const dragBlocked = dragCategoryId && (
    String(dragCategoryId) === String(category.id) ||
    getCategoryDescendantIds(categories, dragCategoryId).has(Number(category.id))
  )

  useEffect(() => {
    if (childEditorOpen) {
      childNameInputRef.current?.focus()
    }
  }, [childEditorOpen])

  return (
    <div className="aurora-category-branch" role="treeitem" aria-level={level} aria-expanded="true">
      <div
        className={`aurora-category-row ${selected ? 'aurora-category-row-active' : ''}`.trim()}
        draggable={!busy}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move'
          onDragStart(category.id)
        }}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          if (!dragBlocked) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (!dragBlocked) {
            onDropOnCategory(category, getInsertionIndexFromDrop(event, siblingIndex))
          }
        }}
      >
        <button
          type="button"
          className="aurora-category-drag"
          aria-label={`Drag ${category.name} to move it`}
          disabled={busy}
        >
          ::
        </button>

        {editing ? (
          <label className="aurora-product-edit-field aurora-category-inline-editor">
            <span className="sr-only">Category name</span>
            <input
              className="aurora-input aurora-product-edit-input"
              type="text"
              value={editDrafts[String(category.id)] ?? category.name}
              disabled={busy}
              onChange={(event) => {
                onEditDraftChange(category.id, event.target.value)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onSaveRename(category)
                }
                if (event.key === 'Escape') {
                  onCancelRename()
                }
              }}
            />
          </label>
        ) : (
          <button
            type="button"
            className="aurora-category-row-main"
            onClick={() => {
              onSelect(category.id)
            }}
          >
            <span>{category.name}</span>
            <small>
              {productCount} product{productCount === 1 ? '' : 's'}
              {childCount ? ` · ${childCount} nested` : ''}
            </small>
          </button>
        )}

        <div className="aurora-category-row-actions">
          {editing ? (
            <>
              <LiquidGlassButton
                type="button"
                variant="secondary"
                size="compact"
                disabled={busy}
                onClick={() => {
                  onSaveRename(category)
                }}
              >
                Save
              </LiquidGlassButton>
              <LiquidGlassButton
                type="button"
                variant="quiet"
                size="compact"
                disabled={busy}
                onClick={onCancelRename}
              >
                Cancel
              </LiquidGlassButton>
            </>
          ) : (
            <>
              <LiquidGlassButton
                type="button"
                variant="secondary"
                size="compact"
                disabled={busy}
                aria-expanded={childEditorOpen}
                aria-controls={childEditorId}
                onClick={() => {
                  onToggleChildEditor(category)
                }}
              >
                Add child
              </LiquidGlassButton>
              <LiquidGlassButton
                type="button"
                variant="quiet"
                size="compact"
                disabled={busy}
                onClick={() => {
                  onBeginRename(category)
                }}
              >
                Rename
              </LiquidGlassButton>
              <LiquidGlassButton
                type="button"
                variant="danger"
                size="compact"
                disabled={busy}
                onClick={() => {
                  onDelete(category)
                }}
              >
                Delete
              </LiquidGlassButton>
            </>
          )}
        </div>
      </div>

      {childEditorOpen ? (
        <form
          id={childEditorId}
          className="aurora-category-add-child"
          onSubmit={(event) => {
            event.preventDefault()
            onAddChild(category)
          }}
        >
          <label className="aurora-product-edit-field">
            <span className="aurora-product-edit-label">Child category name</span>
            <input
              ref={childNameInputRef}
              className="aurora-input aurora-product-edit-input mt-3"
              type="text"
              value={childDrafts[String(category.id)] || ''}
              disabled={busy}
              placeholder={`New category under ${category.name}`}
              onChange={(event) => {
                onChildDraftChange(category.id, event.target.value)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  onCloseChildEditor()
                }
              }}
            />
          </label>
          <div className="aurora-category-add-child-actions">
            <LiquidGlassButton type="submit" variant="secondary" size="compact" disabled={busy}>
              Add
            </LiquidGlassButton>
            <LiquidGlassButton
              type="button"
              variant="quiet"
              size="compact"
              disabled={busy}
              onClick={onCloseChildEditor}
            >
              Cancel
            </LiquidGlassButton>
          </div>
        </form>
      ) : null}

      {children.length ? (
        <div className="aurora-category-children" role="group">
          {children.map((child, childIndex) => (
            <CategoryTreeNode
              key={child.id}
              category={child}
              categories={categories}
              products={products}
              selectedCategoryId={selectedCategoryId}
              busy={busy}
              editingCategoryId={editingCategoryId}
              editDrafts={editDrafts}
              childDrafts={childDrafts}
              openChildCategoryId={openChildCategoryId}
              dragCategoryId={dragCategoryId}
              onSelect={onSelect}
              onBeginRename={onBeginRename}
              onEditDraftChange={onEditDraftChange}
              onSaveRename={onSaveRename}
              onCancelRename={onCancelRename}
              onChildDraftChange={onChildDraftChange}
              onToggleChildEditor={onToggleChildEditor}
              onCloseChildEditor={onCloseChildEditor}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDropOnCategory={onDropOnCategory}
              level={level + 1}
              siblingIndex={childIndex}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CategoryManagementPanel({ products }) {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [createName, setCreateName] = useState('')
  const [createParentId, setCreateParentId] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [editName, setEditName] = useState('')
  const [editParentId, setEditParentId] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState('')
  const [categoryEditDrafts, setCategoryEditDrafts] = useState({})
  const [childCategoryDrafts, setChildCategoryDrafts] = useState({})
  const [openChildCategoryId, setOpenChildCategoryId] = useState('')
  const [dragCategoryId, setDragCategoryId] = useState('')
  const [actionState, setActionState] = useState({
    busy: '',
    error: '',
    success: '',
  })
  const loadRequestRef = useRef(0)

  const rootCategories = useMemo(
    () => getCategoryChildren(categories, null),
    [categories],
  )
  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === selectedCategoryId) || null,
    [categories, selectedCategoryId],
  )
  const selectedProductCount = selectedCategory
    ? getCategoryProductCount(products, categories, selectedCategory.id)
    : 0
  const selectedChildCount = selectedCategory
    ? getCategoryDescendantIds(categories, selectedCategory.id).size
    : 0
  const availableCreateParents = useMemo(
    () => getAvailableCategoryParents(categories),
    [categories],
  )
  const availableEditParents = useMemo(
    () => getAvailableCategoryParents(categories, selectedCategory?.id),
    [categories, selectedCategory?.id],
  )
  const categoryBusy = Boolean(actionState.busy)

  const loadCategories = useCallback(async ({ quiet = false } = {}) => {
    const requestId = loadRequestRef.current + 1
    loadRequestRef.current = requestId

    if (!quiet) {
      setLoading(true)
    }
    setLoadError('')

    try {
      const nextCategories = await fetchProductCategoryTree()

      if (loadRequestRef.current !== requestId) {
        return nextCategories
      }

      setCategories(nextCategories)
      return nextCategories
    } catch (categoryError) {
      if (loadRequestRef.current === requestId) {
        setLoadError(categoryError?.message || 'Could not load categories.')
      }
      return []
    } finally {
      if (loadRequestRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  useEffect(() => {
    if (!selectedCategory) {
      setEditName('')
      setEditParentId('')
      return
    }

    setEditName(selectedCategory.name)
    setEditParentId(selectedCategory.parentId ? String(selectedCategory.parentId) : '')
  }, [selectedCategory])

  function setActionBusy(busy) {
    setActionState({
      busy,
      error: '',
      success: '',
    })
  }

  function setActionError(error) {
    setActionState({
      busy: '',
      error: error?.message || 'Could not update categories.',
      success: '',
    })
  }

  function setActionSuccess(success) {
    setActionState({
      busy: '',
      error: '',
      success,
    })
  }

  function handleSelectCategory(categoryId) {
    setSelectedCategoryId(String(categoryId))
    setActionState({ busy: '', error: '', success: '' })
  }

  function updateCategoryEditDraft(categoryId, value) {
    setCategoryEditDrafts((current) => ({
      ...current,
      [String(categoryId)]: value,
    }))
  }

  function updateChildCategoryDraft(categoryId, value) {
    setChildCategoryDrafts((current) => ({
      ...current,
      [String(categoryId)]: value,
    }))
  }

  function toggleChildCategoryEditor(category) {
    setOpenChildCategoryId((current) => (
      String(current) === String(category.id) ? '' : String(category.id)
    ))
  }

  function beginRenameCategory(category) {
    setEditingCategoryId(String(category.id))
    updateCategoryEditDraft(category.id, category.name)
    handleSelectCategory(category.id)
  }

  function cancelRenameCategory() {
    setEditingCategoryId('')
    setActionState({ busy: '', error: '', success: '' })
  }

  async function saveCategoryName(category) {
    const name = String(categoryEditDrafts[String(category.id)] ?? category.name).trim()
    const parentId = category.parentId ? Number(category.parentId) : null

    if (!name) {
      setActionError(new Error('Category name is required.'))
      return
    }

    if (hasSiblingCategoryName(categories, { name, parentId, excludedId: category.id })) {
      setActionError(new Error('A category with that name already exists at this level.'))
      return
    }

    if (name === category.name) {
      setEditingCategoryId('')
      setActionSuccess('No category changes to save.')
      return
    }

    setActionBusy(`rename:${category.id}`)

    try {
      const result = await updateProductCategory(category.id, { name, parentId })
      await loadCategories({ quiet: true })
      setEditingCategoryId('')
      setActionSuccess(result?.msg || 'Category updated successfully.')
    } catch (renameError) {
      setActionError(renameError)
    }
  }

  async function addChildCategory(parentCategory) {
    const name = String(childCategoryDrafts[String(parentCategory.id)] || '').trim()
    const parentId = Number(parentCategory.id)

    if (!name) {
      setActionError(new Error('Category name is required.'))
      return
    }

    if (hasSiblingCategoryName(categories, { name, parentId })) {
      setActionError(new Error('A category with that name already exists at this level.'))
      return
    }

    setActionBusy(`create-child:${parentCategory.id}`)

    try {
      const result = await createProductCategory({ name, parentId })
      await loadCategories({ quiet: true })
      updateChildCategoryDraft(parentCategory.id, '')
      setOpenChildCategoryId('')
      setSelectedCategoryId(String(result?.categoryId || ''))
      setActionSuccess(result?.msg || 'Category created successfully.')
    } catch (createError) {
      setActionError(createError)
    }
  }

  async function moveCategory(categoryId, parentId, insertionIndex = null) {
    const category = categories.find((entry) => Number(entry.id) === Number(categoryId))
    const normalizedParentId = parentId ? Number(parentId) : null

    if (!category) {
      setActionError(new Error('Select a valid category before moving.'))
      return
    }

    if (normalizedParentId === Number(category.id)) {
      setActionError(new Error('A category cannot be its own parent.'))
      return
    }

    if (normalizedParentId && getCategoryDescendantIds(categories, category.id).has(normalizedParentId)) {
      setActionError(new Error('A category cannot be moved under one of its subcategories.'))
      return
    }

    if (hasSiblingCategoryName(categories, {
      name: category.name,
      parentId: normalizedParentId,
      excludedId: category.id,
    })) {
      setActionError(new Error('A category with that name already exists at the destination level.'))
      return
    }

    setActionBusy(`move:${category.id}`)

    try {
      const currentParentId = category.parentId || null
      const movingWithinSameParent = currentParentId === normalizedParentId
      let reorderedTargetSiblings = []

      if (movingWithinSameParent) {
        const siblings = getCategoryChildren(categories, normalizedParentId)
        const sourceIndex = siblings.findIndex((entry) => Number(entry.id) === Number(category.id))
        reorderedTargetSiblings = moveItemToInsertionIndex(
          siblings,
          sourceIndex,
          insertionIndex ?? siblings.length,
        ) || siblings
      } else {
        const targetSiblings = getCategoryChildren(categories, normalizedParentId)
          .filter((entry) => Number(entry.id) !== Number(category.id))
        const safeIndex = insertionIndex === null
          ? targetSiblings.length
          : Math.max(0, Math.min(insertionIndex, targetSiblings.length))
        reorderedTargetSiblings = [...targetSiblings]
        reorderedTargetSiblings.splice(safeIndex, 0, category)
      }

      const sourceSiblings = movingWithinSameParent
        ? []
        : getCategoryChildren(categories, currentParentId)
            .filter((entry) => Number(entry.id) !== Number(category.id))

      const updateRequests = [
        ...reorderedTargetSiblings.map((entry, index) => updateProductCategory(entry.id, {
          name: entry.name,
          parentId: normalizedParentId,
          sortOrder: index,
        })),
        ...sourceSiblings.map((entry, index) => updateProductCategory(entry.id, {
          name: entry.name,
          parentId: currentParentId,
          sortOrder: index,
        })),
      ]

      await Promise.all(updateRequests)
      await loadCategories({ quiet: true })
      setSelectedCategoryId(String(category.id))
      setActionSuccess('Category moved successfully.')
    } catch (moveError) {
      setActionError(moveError)
    } finally {
      setDragCategoryId('')
    }
  }

  async function handleCreateCategory(event) {
    event.preventDefault()

    const name = createName.trim()
    const parentId = createParentId ? Number(createParentId) : null

    if (!name) {
      setActionError(new Error('Category name is required.'))
      return
    }

    if (hasSiblingCategoryName(categories, { name, parentId })) {
      setActionError(new Error('A category with that name already exists at this level.'))
      return
    }

    setActionBusy('create')

    try {
      const result = await createProductCategory({ name, parentId })
      await loadCategories({ quiet: true })
      setCreateName('')
      setCreateParentId('')
      setSelectedCategoryId(String(result?.categoryId || ''))
      setActionSuccess(result?.msg || 'Category created successfully.')
    } catch (createError) {
      setActionError(createError)
    }
  }

  async function handleUpdateCategory(event) {
    event.preventDefault()

    if (!selectedCategory) {
      setActionError(new Error('Select a category before saving.'))
      return
    }

    const name = editName.trim()
    const parentId = editParentId ? Number(editParentId) : null

    if (!name) {
      setActionError(new Error('Category name is required.'))
      return
    }

    if (parentId === Number(selectedCategory.id)) {
      setActionError(new Error('A category cannot be its own parent.'))
      return
    }

    if (parentId && getCategoryDescendantIds(categories, selectedCategory.id).has(parentId)) {
      setActionError(new Error('A category cannot be moved under one of its subcategories.'))
      return
    }

    if (hasSiblingCategoryName(categories, { name, parentId, excludedId: selectedCategory.id })) {
      setActionError(new Error('A category with that name already exists at this level.'))
      return
    }

    if (name === selectedCategory.name && (selectedCategory.parentId || null) === parentId) {
      setActionSuccess('No category changes to save.')
      return
    }

    setActionBusy('update')

    try {
      const result = await updateProductCategory(selectedCategory.id, { name, parentId })
      await loadCategories({ quiet: true })
      setActionSuccess(result?.msg || 'Category updated successfully.')
    } catch (updateError) {
      setActionError(updateError)
    }
  }

  async function handleDeleteCategory(categoryOverride = null) {
    const targetCategory = categoryOverride || selectedCategory

    if (!targetCategory) {
      setActionError(new Error('Select a category before deleting.'))
      return
    }

    const targetProductCount = getCategoryProductCount(products, categories, targetCategory.id)
    const targetChildCount = getCategoryDescendantIds(categories, targetCategory.id).size
    const impactParts = [
      targetProductCount
        ? `${targetProductCount} product${targetProductCount === 1 ? '' : 's'} will lose this category`
        : 'no products currently use this category',
      targetChildCount
        ? `${targetChildCount} subcategor${targetChildCount === 1 ? 'y' : 'ies'} will also be deleted`
        : '',
    ].filter(Boolean)

    if (!confirmDestructiveAction(`Delete ${targetCategory.name}? ${impactParts.join('. ')}.`)) {
      return
    }

    setActionBusy('delete')

    try {
      const result = await deleteProductCategory(targetCategory.id)
      await loadCategories({ quiet: true })
      if (String(targetCategory.id) === selectedCategoryId) {
        setSelectedCategoryId('')
      }
      setActionSuccess(result?.msg || 'Category deleted successfully.')
    } catch (deleteError) {
      setActionError(deleteError)
    }
  }

  return (
    <section id="category-management" className="aurora-ops-panel aurora-product-edit-panel">
      <div className="aurora-product-edit-hero">
        <div className="aurora-widget-header">
          <div className="aurora-widget-heading">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
              Category management
            </p>
            <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
              Organize catalog groups
            </h2>
          </div>
          <span className="aurora-category-count">
            {loading ? 'Loading' : `${categories.length} categories`}
          </span>
        </div>

        <p className="aurora-product-edit-intro">
          Create top-level categories or subcategories, rename existing groups, and delete unused
          category records from the backend catalog.
        </p>
      </div>

      <div className="aurora-category-manager">
        <form className="aurora-category-form" onSubmit={handleCreateCategory}>
          <div>
            <p className="aurora-product-edit-label">Create category</p>
            <h3>Add a catalog group</h3>
          </div>

          <label className="aurora-product-edit-field">
            <span className="aurora-product-edit-label">Name</span>
            <input
              className="aurora-input aurora-product-edit-input mt-3"
              type="text"
              value={createName}
              disabled={Boolean(actionState.busy)}
              onChange={(event) => {
                setCreateName(event.target.value)
              }}
            />
          </label>

          <label className="aurora-product-edit-field">
            <span className="aurora-product-edit-label">Parent</span>
            <select
              className="aurora-select aurora-product-edit-input mt-3"
              value={createParentId}
              disabled={Boolean(actionState.busy)}
              onChange={(event) => {
                setCreateParentId(event.target.value)
              }}
            >
              <option value="">Top-level category</option>
              {availableCreateParents.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {getCategorySelectLabel(categories, category)}
                </option>
              ))}
            </select>
          </label>

          <LiquidGlassButton
            type="submit"
            variant="secondary"
            loading={actionState.busy === 'create'}
            disabled={Boolean(actionState.busy)}
          >
            Create category
          </LiquidGlassButton>
        </form>

        <div className="aurora-category-grid">
          <section className="aurora-category-list" aria-label="Catalog categories">
            <div className="aurora-category-list-header">
              <p className="aurora-product-edit-label">Existing categories</p>
              <button
                type="button"
                className="aurora-category-refresh"
                disabled={Boolean(actionState.busy) || loading}
                onClick={() => {
                  void loadCategories()
                }}
              >
                Refresh
              </button>
            </div>

            {loadError ? (
              <p className="aurora-message aurora-message-error" role="alert">{loadError}</p>
            ) : null}

            {loading ? (
              <div className="aurora-product-image-empty">
                <p>Loading categories</p>
                <span>Fetching the current category tree.</span>
              </div>
            ) : categories.length ? (
              <div
                className="aurora-category-tree"
                role="tree"
                aria-label="Catalog category tree"
                onDragOver={(event) => {
                  if (dragCategoryId) {
                    event.preventDefault()
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragCategoryId) {
                    void moveCategory(dragCategoryId, null, rootCategories.length)
                  }
                }}
              >
                {rootCategories.map((category, categoryIndex) => (
                  <CategoryTreeNode
                    key={category.id}
                    category={category}
                    categories={categories}
                    products={products}
                    selectedCategoryId={selectedCategoryId}
                    busy={categoryBusy}
                    editingCategoryId={editingCategoryId}
                    editDrafts={categoryEditDrafts}
                    childDrafts={childCategoryDrafts}
                    openChildCategoryId={openChildCategoryId}
                    dragCategoryId={dragCategoryId}
                    onSelect={handleSelectCategory}
                    onBeginRename={beginRenameCategory}
                    onEditDraftChange={updateCategoryEditDraft}
                    onSaveRename={saveCategoryName}
                    onCancelRename={cancelRenameCategory}
                    onChildDraftChange={updateChildCategoryDraft}
                    onToggleChildEditor={toggleChildCategoryEditor}
                    onCloseChildEditor={() => {
                      setOpenChildCategoryId('')
                    }}
                    onAddChild={addChildCategory}
                    onDelete={handleDeleteCategory}
                    onDragStart={(categoryId) => {
                      setDragCategoryId(String(categoryId))
                    }}
                    onDragEnd={() => {
                      setDragCategoryId('')
                    }}
                    onDropOnCategory={(targetCategory, insertionIndex) => {
                      const draggedCategory = categories.find(
                        (entry) => String(entry.id) === String(dragCategoryId),
                      )
                      const targetParentId = draggedCategory &&
                        (draggedCategory.parentId || null) === (targetCategory.parentId || null)
                        ? targetCategory.parentId || null
                        : targetCategory.id
                      const targetInsertionIndex = draggedCategory &&
                        (draggedCategory.parentId || null) === (targetCategory.parentId || null)
                        ? insertionIndex
                        : null
                      void moveCategory(dragCategoryId, targetParentId, targetInsertionIndex)
                    }}
                    siblingIndex={categoryIndex}
                  />
                ))}
              </div>
            ) : (
              <div className="aurora-product-image-empty">
                <p>No categories yet</p>
                <span>Create the first top-level category to begin grouping products.</span>
              </div>
            )}
          </section>

          <form className="aurora-category-form" onSubmit={handleUpdateCategory}>
            <div>
              <p className="aurora-product-edit-label">Edit category</p>
              <h3>{selectedCategory?.name || 'Select a category'}</h3>
            </div>

            <label className="aurora-product-edit-field">
              <span className="aurora-product-edit-label">Category</span>
              <select
                className="aurora-select aurora-product-edit-input mt-3"
                value={selectedCategoryId}
                disabled={Boolean(actionState.busy)}
                onChange={(event) => {
                  setSelectedCategoryId(event.target.value)
                  setActionState({ busy: '', error: '', success: '' })
                }}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {getCategorySelectLabel(categories, category)}
                  </option>
                ))}
              </select>
            </label>

            <label className="aurora-product-edit-field">
              <span className="aurora-product-edit-label">Name</span>
              <input
                className="aurora-input aurora-product-edit-input mt-3"
                type="text"
                value={editName}
                disabled={!selectedCategory || Boolean(actionState.busy)}
                onChange={(event) => {
                  setEditName(event.target.value)
                }}
              />
            </label>

            <label className="aurora-product-edit-field">
              <span className="aurora-product-edit-label">Parent</span>
              <select
                className="aurora-select aurora-product-edit-input mt-3"
                value={editParentId}
                disabled={!selectedCategory || Boolean(actionState.busy)}
                onChange={(event) => {
                  setEditParentId(event.target.value)
                }}
              >
                <option value="">Top-level category</option>
                {availableEditParents
                  .map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {getCategorySelectLabel(categories, category)}
                    </option>
                  ))}
              </select>
            </label>

            {selectedCategory ? (
              <p className="aurora-category-impact">
                {selectedProductCount} product{selectedProductCount === 1 ? '' : 's'} currently use
                this category{selectedChildCount ? ` or its ${selectedChildCount} subcategories` : ''}.
              </p>
            ) : null}

            <div className="aurora-category-actions">
              <LiquidGlassButton
                type="submit"
                variant="secondary"
                loading={actionState.busy === 'update'}
                disabled={!selectedCategory || Boolean(actionState.busy)}
              >
                Save category
              </LiquidGlassButton>
              <LiquidGlassButton
                type="button"
                variant="danger"
                loading={actionState.busy === 'delete'}
                disabled={!selectedCategory || Boolean(actionState.busy)}
                onClick={() => {
                  void handleDeleteCategory()
                }}
              >
                Delete category
              </LiquidGlassButton>
            </div>
          </form>
        </div>

        <div aria-live="polite">
          {actionState.error ? (
            <p className="aurora-message aurora-message-error" role="alert">{actionState.error}</p>
          ) : null}
          {actionState.success ? (
            <p className="aurora-message aurora-message-success">{actionState.success}</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function ProductEditPanel({ products, loading }) {
  const debugInstance = useId()
  const editableProducts = useMemo(
    () => [...products].sort((left, right) => left.name.localeCompare(right.name)),
    [products],
  )
  const [storedInitialSelection] = useState(() => readStoredProductManagerSelection())
  const [createCategories, setCreateCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoryLoadError, setCategoryLoadError] = useState('')
  const [editorMode, setEditorMode] = useState('edit')
  const [selectedProductKey, setSelectedProductKey] = useState(storedInitialSelection.key)
  const [selectedProductId, setSelectedProductId] = useState(storedInitialSelection.id)
  const [selectedProductSnapshot, setSelectedProductSnapshot] = useState(storedInitialSelection.product)
  const currentSelectedProduct = useMemo(
    () =>
      editableProducts.find((product) => Number(product.id) === Number(selectedProductId)) ||
      editableProducts.find((product) => getProductManagerSelectKey(product) === selectedProductKey) ||
      null,
    [editableProducts, selectedProductId, selectedProductKey],
  )
  const selectedProduct = currentSelectedProduct || selectedProductSnapshot
  const selectedProductSelectKey = selectedProduct
    ? getProductManagerSelectKey(selectedProduct)
    : selectedProductKey
  const [saveState, setSaveState] = useState({
    saving: false,
    error: '',
    success: '',
  })
  const [createState, setCreateState] = useState({
    saving: false,
    error: '',
    success: '',
  })
  const [deleteState, setDeleteState] = useState({
    deleting: false,
    error: '',
    success: '',
  })
  const editFieldsRef = useRef(null)
  const editCategoryRef = useRef(null)
  const createFieldsRef = useRef(null)
  const createCategoryRef = useRef(null)
  const createImageInputRef = useRef(null)
  const createImageFileRef = useRef(null)
  const createIssueIdRef = useRef('')
  const [createImageFileName, setCreateImageFileName] = useState('')
  const [createImageInputVersion, setCreateImageInputVersion] = useState(0)
  const productActionBusy = saveState.saving || createState.saving || deleteState.deleting
  const activeEditorMode = !loading && !editableProducts.length ? 'create' : editorMode

  function getCreateIssueId(source, details = {}) {
    if (createIssueIdRef.current) {
      return createIssueIdRef.current
    }

    createIssueIdRef.current = startFrontendDebugIssue('product-manager-create-product', {
      source,
      component: 'ProductEditPanel',
      instance: debugInstance,
      selectedProductId: selectedProduct?.id || null,
      selectedProductCode: selectedProduct?.productCode || '',
      ...details,
    })

    return createIssueIdRef.current
  }

  function clearCreateIssue(outcome, details = {}) {
    const issueId = createIssueIdRef.current

    if (!issueId) {
      return
    }

    endFrontendDebugIssue(issueId, outcome, {
      component: 'ProductEditPanel',
      instance: debugInstance,
      selectedImageFileName: createImageFileRef.current?.name || createImageFileName,
      ...details,
    })
    createIssueIdRef.current = ''
  }

  useEffect(() => {
    logProductManagerDebug('edit-panel:mounted', {
      instance: debugInstance,
      storedProductId: storedInitialSelection.id,
      storedProductKey: storedInitialSelection.key,
      storedProductCode: storedInitialSelection.product?.productCode,
    })

    return () => {
      const activeCreateIssueId = createIssueIdRef.current
      logProductManagerDebug('edit-panel:unmounted', {
        instance: debugInstance,
      }, { issueId: activeCreateIssueId })

      if (activeCreateIssueId) {
        endFrontendDebugIssue(activeCreateIssueId, 'interrupted', {
          component: 'ProductEditPanel',
          reason: 'edit-panel-unmounted-with-active-create-issue',
          selectedImageFileName: createImageFileRef.current?.name || '',
        })
        createIssueIdRef.current = ''
      }
    }
  }, [
    debugInstance,
    storedInitialSelection.id,
    storedInitialSelection.key,
    storedInitialSelection.product?.productCode,
  ])

  useEffect(() => {
    logProductManagerDebug('edit-panel:catalog-state', {
      instance: debugInstance,
      productCount: products.length,
      editableProductCount: editableProducts.length,
      loading,
      selectedProductId,
      selectedProductKey,
      selectedProductCode: selectedProduct?.productCode,
      snapshotProductCode: selectedProductSnapshot?.productCode,
      currentProductCode: currentSelectedProduct?.productCode,
      activeEditorMode,
    })
  }, [
    activeEditorMode,
    currentSelectedProduct?.productCode,
    debugInstance,
    editableProducts.length,
    loading,
    products.length,
    selectedProduct?.productCode,
    selectedProductId,
    selectedProductKey,
    selectedProductSnapshot?.productCode,
  ])

  useEffect(() => {
    if (!currentSelectedProduct) {
      return
    }

    logProductManagerDebug('edit-panel:sync-current-product', {
      instance: debugInstance,
      productId: currentSelectedProduct.id,
      productCode: currentSelectedProduct.productCode,
      imageCount: currentSelectedProduct.images?.length || 0,
    })
    setSelectedProductSnapshot(currentSelectedProduct)
    writeStoredProductManagerSelection(currentSelectedProduct)
  }, [currentSelectedProduct, debugInstance])

  const handleSelectedProductSnapshotChange = useCallback((nextProduct) => {
    logProductManagerDebug('edit-panel:snapshot-updated', {
      instance: debugInstance,
      productId: nextProduct?.id,
      productCode: nextProduct?.productCode,
      imageCount: nextProduct?.images?.length || 0,
    })
    setSelectedProductSnapshot(nextProduct)
    writeStoredProductManagerSelection(nextProduct)
  }, [debugInstance])

  useEffect(() => {
    let active = true

    void fetchProductCategoryTree()
      .then((categories) => {
        if (!active) {
          return
        }

        setCreateCategories(categories)
      })
      .catch((categoryError) => {
        if (!active) {
          return
        }

        setCategoryLoadError(categoryError?.message || 'Could not load product categories.')
      })
      .finally(() => {
        if (active) {
          setCategoriesLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [debugInstance])

  function handleEditorModeChange(nextMode) {
    if (productActionBusy || activeEditorMode === nextMode) {
      return
    }

    setEditorMode(nextMode)
    setSaveState({
      saving: false,
      error: '',
      success: '',
    })
    setCreateState({
      saving: false,
      error: '',
      success: '',
    })
    setDeleteState({
      deleting: false,
      error: '',
      success: '',
    })
  }

  function getCurrentEditForm() {
    return Object.fromEntries(
      productEditFields.map((field) => {
        const input = editFieldsRef.current?.querySelector(`[name="${field.key}"]`)
        return [field.key, input?.value || '']
      }),
    )
  }

  function getCurrentCreateForm() {
    return Object.fromEntries(
      productEditFields.map((field) => {
        const input = createFieldsRef.current?.querySelector(`[name="${field.key}"]`)
        return [field.key, input?.value || '']
      }),
    )
  }

  function resetCreateFields() {
    if (!createFieldsRef.current) {
      return
    }

    for (const field of productEditFields) {
      const input = createFieldsRef.current.querySelector(`[name="${field.key}"]`)

      if (input) {
        input.value = ''
      }
    }

    if (createCategoryRef.current) {
      createCategoryRef.current.value = ''
    }

    createImageFileRef.current = null
    setCreateImageFileName('')
    setCreateImageInputVersion((version) => version + 1)
    if (createImageInputRef.current) {
      createImageInputRef.current.value = ''
    }
  }

  function resetEditFields() {
    if (!selectedProduct || !editFieldsRef.current) {
      return
    }

    const nextForm = getProductEditForm(selectedProduct)

    for (const field of productEditFields) {
      const input = editFieldsRef.current.querySelector(`[name="${field.key}"]`)

      if (input) {
        input.value = nextForm[field.key] || ''
      }
    }

    if (editCategoryRef.current) {
      editCategoryRef.current.value = selectedProduct.categoryId ? String(selectedProduct.categoryId) : ''
    }
  }

  function handleSave() {
    if (!selectedProduct) {
      setSaveState({
        saving: false,
        error: 'Select a product before saving.',
        success: '',
      })
      return
    }

    let edits = null

    try {
      const form = getCurrentEditForm()
      edits = buildProductEdits(selectedProduct, form)
      const nextCategoryId = normalizeProductCategoryEdit(editCategoryRef.current?.value || '')
      const currentCategoryId = selectedProduct.categoryId ? Number(selectedProduct.categoryId) : null

      if (nextCategoryId !== currentCategoryId) {
        edits.category_id = nextCategoryId
      }
    } catch (validationError) {
      setSaveState({
        saving: false,
        error: validationError?.message || 'Review the product fields before saving.',
        success: '',
      })
      return
    }

    if (!Object.keys(edits).length) {
      setSaveState({
        saving: false,
        error: '',
        success: 'No changes to save.',
      })
      return
    }

    setSaveState({
      saving: true,
      error: '',
      success: '',
    })

    void updateProductDetails(selectedProduct.id, edits)
      .then((result) => {
        handleSelectedProductSnapshotChange(
          applyProductEditsToSnapshot(selectedProduct, edits, createCategories),
        )
        setSaveState({
          saving: false,
          error: '',
          success: result?.msg || 'Product updated successfully.',
        })
      })
      .catch((saveError) => {
        setSaveState({
          saving: false,
          error: saveError?.message || 'Could not update product.',
          success: '',
        })
      })
  }

  function handleCreateProduct() {
    let payload = null
    const createIssueId = getCreateIssueId('create-submit', {
      selectedImageFileName: createImageFileRef.current?.name || '',
    })

    try {
      payload = buildProductCreatePayload(
        getCurrentCreateForm(),
        createCategoryRef.current?.value || '',
      )
    } catch (validationError) {
      logProductManagerDebug('create-panel:validation-failed', {
        instance: debugInstance,
        message: validationError?.message || '',
      }, { issueId: createIssueId })
      setCreateState({
        saving: false,
        error: validationError?.message || 'Review the product fields before creating.',
        success: '',
      })
      clearCreateIssue('validation-failed', {
        message: validationError?.message || '',
      })
      return
    }

    setCreateState({
      saving: true,
      error: '',
      success: '',
    })
    setDeleteState({
      deleting: false,
      error: '',
      success: '',
    })
    const selectedCreateImageFile = createImageFileRef.current

    void (async () => {
      let result = null
      let createdProduct = null
      let productId = null

      try {
        logProductManagerDebug('create-panel:create-start', {
          instance: debugInstance,
          selectedImageFileName: selectedCreateImageFile?.name || '',
        }, { issueId: createIssueId })
        result = await withFrontendDebugIssue(createIssueId, () => createProduct(payload))
        createdProduct = result?.product || null
        productId = Number(result?.productId ?? createdProduct?.id)

        if (selectedCreateImageFile) {
          if (!Number.isFinite(productId) || productId <= 0) {
            throw new Error('Product created, but the image upload could not start.')
          }

          logProductManagerDebug('create-panel:image-upload-start', {
            instance: debugInstance,
            productId,
            fileName: selectedCreateImageFile.name,
            fileSize: selectedCreateImageFile.size,
          }, { issueId: createIssueId })

          const imageResult = await withFrontendDebugIssue(createIssueId, () =>
            uploadProductImage({
              productId,
              file: selectedCreateImageFile,
              sortOrder: 0,
              primary: true,
              refreshOnCacheMiss: false,
            }),
          )

          if (!imageResult?.url) {
            throw new Error('Product created, but the image upload did not return an image URL.')
          }

          if (createdProduct) {
            createdProduct = mergeUploadedProductImage(createdProduct, {
              url: imageResult.url,
              sortOrder: Number.isFinite(Number(imageResult?.sortOrder ?? imageResult?.sort_order))
                ? Number(imageResult?.sortOrder ?? imageResult?.sort_order)
                : 0,
              variantId: Number.isFinite(Number(imageResult?.variantId ?? imageResult?.variant_id))
                ? Number(imageResult?.variantId ?? imageResult?.variant_id)
                : '',
              primary:
                typeof imageResult?.isPrimary === 'boolean'
                  ? imageResult.isPrimary
                  : true,
            })
          }
        }

        resetCreateFields()
        setSelectedProductId(productId || createdProduct?.id || null)
        setSelectedProductKey(createdProduct ? getProductManagerSelectKey(createdProduct) : '')
        setSelectedProductSnapshot(createdProduct)
        writeStoredProductManagerSelection(createdProduct)
        setEditorMode('edit')
        setCreateState({
          saving: false,
          error: '',
          success: selectedCreateImageFile
            ? 'Product created with image.'
            : result?.msg || 'Product created successfully.',
        })
        clearCreateIssue('success', {
          productId: productId || createdProduct?.id || null,
          selectedImageFileName: selectedCreateImageFile?.name || '',
        })
      } catch (createError) {
        logProductManagerDebug('create-panel:create-failed', {
          instance: debugInstance,
          productId,
          message: createError?.message || '',
        }, { issueId: createIssueId })
        if (Number.isFinite(productId) && productId > 0) {
          setSelectedProductId(productId)
          setSelectedProductKey(createdProduct ? getProductManagerSelectKey(createdProduct) : '')
          setSelectedProductSnapshot(createdProduct)
          setEditorMode('edit')
        }

        setCreateState({
          saving: false,
          error: createError?.message || 'Could not create product.',
          success: '',
        })
        clearCreateIssue('failed', {
          productId,
          message: createError?.message || '',
        })
      }
    })()
  }

  function handleDeleteProduct() {
    if (!selectedProduct) {
      setDeleteState({
        deleting: false,
        error: 'Select a product before deleting.',
        success: '',
      })
      return
    }

    const productLabel = selectedProduct.name || `Product ${selectedProduct.id}`
    if (!window.confirm(`Delete ${productLabel} permanently? Variants, images, comments, or order history may be affected if the backend allows the deletion.`)) {
      return
    }

    setDeleteState({
      deleting: true,
      error: '',
      success: '',
    })
    setCreateState({
      saving: false,
      error: '',
      success: '',
    })

    void deleteProduct(selectedProduct.id)
      .then((result) => {
        setSelectedProductKey('')
        setSelectedProductId(null)
        setSelectedProductSnapshot(null)
        writeStoredProductManagerSelection(null)
        setSaveState({
          saving: false,
          error: '',
          success: '',
        })
        setDeleteState({
          deleting: false,
          error: '',
          success: result?.msg || 'Product deleted successfully.',
        })
      })
      .catch((deleteError) => {
        setDeleteState({
          deleting: false,
          error: deleteError?.message || 'Could not delete product.',
          success: '',
        })
      })
  }

  return (
    <section id="product-editor" className="aurora-ops-panel aurora-product-edit-panel">
      <div className="aurora-product-edit-hero">
        <div className="aurora-widget-header">
          <div className="aurora-widget-heading">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
              Product editor
            </p>
            <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
              Update catalog details
            </h2>
          </div>
          {activeEditorMode === 'edit' && selectedProduct ? (
            <Link
              to={`/products/${selectedProduct.slug}`}
              className="aurora-product-edit-live-link"
            >
              View product
            </Link>
          ) : null}
        </div>

        <p className="aurora-product-edit-intro">
          Edit the core product record, upload gallery images, connect variant-specific photos,
          and choose the primary storefront image.
        </p>
      </div>

      <div
        className="aurora-product-edit-form"
        onKeyDown={(event) => {
          if (shouldPreventProductEditEnterSubmit(event)) {
            event.preventDefault()
          }
        }}
      >
        <div className="aurora-product-edit-picker">
          <div className="aurora-product-variant-mode" role="group" aria-label="Product editor mode">
            <LiquidGlassButton
              type="button"
              size="compact"
              variant={activeEditorMode === 'edit' ? 'secondary' : 'quiet'}
              selected={activeEditorMode === 'edit'}
              disabled={productActionBusy || (!editableProducts.length && !loading)}
              onClick={() => {
                handleEditorModeChange('edit')
              }}
            >
              Edit
            </LiquidGlassButton>
            <LiquidGlassButton
              type="button"
              size="compact"
              variant={activeEditorMode === 'create' ? 'secondary' : 'quiet'}
              selected={activeEditorMode === 'create'}
              disabled={productActionBusy}
              onClick={() => {
                handleEditorModeChange('create')
              }}
            >
              New
            </LiquidGlassButton>
          </div>

          {activeEditorMode === 'edit' ? (
            <>
              <label className="aurora-product-edit-picker-field">
                <span className="aurora-product-edit-label">Product</span>
                <select
                  className="aurora-select aurora-product-edit-input mt-3"
                  value={selectedProductSelectKey}
                  disabled={productActionBusy}
                  onChange={(event) => {
                    const nextProductKey = event.target.value
                    const nextProduct =
                      editableProducts.find(
                        (product) => getProductManagerSelectKey(product) === nextProductKey,
                      ) || null

                    logProductManagerDebug('edit-panel:product-select-change', {
                      instance: debugInstance,
                      nextProductKey,
                      nextProductId: nextProduct?.id || null,
                      nextProductCode: nextProduct?.productCode || '',
                      previousProductId: selectedProductId,
                      previousProductKey: selectedProductKey,
                    })
                    setSelectedProductKey(nextProductKey)
                    setSelectedProductId(nextProduct?.id ?? null)
                    setSelectedProductSnapshot(nextProduct)
                    writeStoredProductManagerSelection(nextProduct)
                    setSaveState({
                      saving: false,
                      error: '',
                      success: '',
                    })
                    setDeleteState({
                      deleting: false,
                      error: '',
                      success: '',
                    })
                  }}
                >
                  <option value="">{loading ? 'Loading products' : 'Select a product'}</option>
                  {editableProducts.map((product) => (
                    <option key={product.id} value={getProductManagerSelectKey(product)}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="aurora-product-edit-picker-field">
                <span className="aurora-product-edit-label">Category</span>
                <select
                  key={`edit-category:${selectedProduct?.id || 'none'}`}
                  ref={editCategoryRef}
                  className="aurora-select aurora-product-edit-input mt-3"
                  disabled={productActionBusy || categoriesLoading || !selectedProduct}
                  defaultValue={selectedProduct?.categoryId ? String(selectedProduct.categoryId) : ''}
                >
                  <option value="">
                    {categoriesLoading ? 'Loading categories' : 'No category'}
                  </option>
                  {createCategories.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {getCategorySelectLabel(createCategories, category)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <label className="aurora-product-edit-picker-field">
              <span className="aurora-product-edit-label">Category</span>
              <select
                ref={createCategoryRef}
                className="aurora-select aurora-product-edit-input mt-3"
                disabled={productActionBusy || categoriesLoading}
                defaultValue=""
              >
                <option value="">
                  {categoriesLoading ? 'Loading categories' : 'No category'}
                </option>
                {createCategories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {getCategorySelectLabel(createCategories, category)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="aurora-product-edit-picker-copy">
            {activeEditorMode === 'create'
              ? 'Create a product record with its first gallery image when one is selected.'
              : selectedProduct
                ? 'Changes save directly to the product record after review.'
                : 'Choose an item to reveal the editable storefront fields.'}
          </p>
        </div>

        {activeEditorMode === 'create' ? (
          <>
            <div
              ref={createFieldsRef}
              className="aurora-product-edit-workspace aurora-product-create-workspace"
            >
              <div className="aurora-product-edit-groups">
                {productEditFieldGroups.map((group) => (
                  <fieldset key={group.title} className="aurora-product-edit-group">
                    <legend>
                      <span>{group.title}</span>
                      <small>{group.description}</small>
                    </legend>

                    <div className="aurora-product-edit-grid">
                      {group.fields.map((field) => (
                        <ProductEditField
                          key={field.key}
                          field={field}
                          defaultValue=""
                          idPrefix="product-create"
                          required={requiredProductCreateColumnSet.has(field.column)}
                        />
                      ))}
                    </div>

                    {group.title === 'Storefront identity' ? (
                      <div className="aurora-product-create-image">
                        <div className="aurora-product-create-image-header">
                          <div>
                            <p className="aurora-product-edit-label">Product image</p>
                            <h3>Add first gallery image</h3>
                          </div>
                          <span>{createImageFileName ? '1 selected' : 'Optional'}</span>
                        </div>

                        <div className="aurora-product-create-image-upload">
                          <div className="aurora-product-edit-field">
                            <span className="aurora-product-edit-label">Upload image</span>
                            <input
                              key={createImageInputVersion}
                              ref={createImageInputRef}
                              className="aurora-product-image-hidden-input"
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              disabled={productActionBusy}
                              onChange={(event) => {
                                if (productActionBusy) {
                                  const issueId = getCreateIssueId('file-change-ignored-busy')
                                  logProductManagerDebug('create-panel:file-change-ignored-busy', {
                                    instance: debugInstance,
                                  }, { issueId })
                                  return
                                }

                                const nextFile = event.target.files?.[0] || null
                                const issueId = getCreateIssueId('file-change', {
                                  fileName: nextFile?.name || '',
                                  fileSize: nextFile?.size || 0,
                                })
                                logProductManagerDebug('create-panel:file-change', {
                                  instance: debugInstance,
                                  fileName: nextFile?.name || '',
                                  fileSize: nextFile?.size || 0,
                                  previousFileName: createImageFileRef.current?.name || '',
                                }, { issueId })
                                createImageFileRef.current = nextFile
                                setCreateImageFileName(nextFile?.name || '')
                                setCreateState({
                                  saving: false,
                                  error: '',
                                  success: '',
                                })
                              }}
                            />
                            <LiquidGlassButton
                              type="button"
                              variant="secondary"
                              disabled={productActionBusy}
                              onClick={() => {
                                const issueId = getCreateIssueId('file-dialog-open')
                                logProductManagerDebug('create-panel:file-dialog-open', {
                                  instance: debugInstance,
                                  selectedFileName: createImageFileName,
                                }, { issueId })
                                createImageInputRef.current?.click()
                              }}
                            >
                              {createImageFileName ? 'Change file' : 'Choose file'}
                            </LiquidGlassButton>
                            {createImageFileName ? (
                              <small className="aurora-product-image-file-name">{createImageFileName}</small>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </fieldset>
                ))}
              </div>
            </div>

            <div className="aurora-product-edit-action-bar">
              <div className="aurora-product-edit-action-copy">
                <span>New catalog item</span>
                <p>Create the product and attach the selected image in one action.</p>
              </div>
              <div className="aurora-product-edit-actions">
                <LiquidGlassButton
                  type="button"
                  variant="quiet"
                  disabled={createState.saving}
                  onClick={() => {
                    resetCreateFields()
                    setCreateState({
                      saving: false,
                      error: '',
                      success: '',
                    })
                  }}
                >
                  Reset fields
                </LiquidGlassButton>
                <LiquidGlassButton
                  type="button"
                  variant="secondary"
                  loading={createState.saving}
                  disabled={createState.saving}
                  onClick={handleCreateProduct}
                >
                  Create product
                </LiquidGlassButton>
              </div>
            </div>
          </>
        ) : selectedProduct ? (
          <>
            <div
              key={selectedProduct.id}
              ref={editFieldsRef}
              className="aurora-product-edit-workspace"
            >
              <ProductEditSnapshot product={selectedProduct} />
              <ProductOptionManager
                key={`options:${selectedProduct.id}`}
                product={selectedProduct}
                onProductOptionsChange={handleSelectedProductSnapshotChange}
              />
              <ProductVariantManager key={selectedProduct.id} product={selectedProduct} />
              <ProductImageManager
                product={selectedProduct}
                onProductImagesChange={handleSelectedProductSnapshotChange}
              />

              <div className="aurora-product-edit-groups">
                {productEditFieldGroups.map((group) => (
                  <fieldset key={group.title} className="aurora-product-edit-group">
                    <legend>
                      <span>{group.title}</span>
                      <small>{group.description}</small>
                    </legend>

                    <div className="aurora-product-edit-grid">
                      {group.fields.map((field) => (
                        <ProductEditField
                          key={field.key}
                          field={field}
                          defaultValue={getProductEditForm(selectedProduct)[field.key] || ''}
                        />
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>

            <div className="aurora-product-edit-action-bar">
              <div className="aurora-product-edit-action-copy">
                <span>{selectedProduct.categoryName || selectedProduct.parentCategoryName || 'Catalog'}</span>
                <p>Save only after checking the live product details.</p>
              </div>
              <div className="aurora-product-edit-actions">
                <LiquidGlassButton
                  type="button"
                  variant="quiet"
                  disabled={saveState.saving || deleteState.deleting}
                  onClick={() => {
                    resetEditFields()
                    setSaveState({
                      saving: false,
                      error: '',
                      success: '',
                    })
                  }}
                >
                  Reset fields
                </LiquidGlassButton>
                <LiquidGlassButton
                  type="button"
                  variant="danger"
                  loading={deleteState.deleting}
                  disabled={saveState.saving || deleteState.deleting}
                  onClick={handleDeleteProduct}
                >
                  Delete product
                </LiquidGlassButton>
                <LiquidGlassButton
                  type="button"
                  variant="secondary"
                  loading={saveState.saving}
                  disabled={saveState.saving || deleteState.deleting}
                  onClick={() => {
                    handleSave()
                  }}
                >
                  Save product
                </LiquidGlassButton>
              </div>
            </div>
          </>
        ) : (
          <SectionEmptyState
            title="Select a product"
            description="Choose a catalog item to load editable details."
          />
        )}
      </div>

      {saveState.error ? (
        <div className="aurora-message aurora-message-error mt-6" role="alert">{saveState.error}</div>
      ) : null}
      {saveState.success ? (
        <div className="aurora-message aurora-message-success mt-6" role="status" aria-live="polite">{saveState.success}</div>
      ) : null}
      {categoryLoadError ? (
        <div className="aurora-message aurora-message-error mt-6" role="alert">{categoryLoadError}</div>
      ) : null}
      {createState.error ? (
        <div className="aurora-message aurora-message-error mt-6" role="alert">{createState.error}</div>
      ) : null}
      {createState.success ? (
        <div className="aurora-message aurora-message-success mt-6" role="status" aria-live="polite">{createState.success}</div>
      ) : null}
      {deleteState.error ? (
        <div className="aurora-message aurora-message-error mt-6" role="alert">{deleteState.error}</div>
      ) : null}
      {deleteState.success ? (
        <div className="aurora-message aurora-message-success mt-6" role="status" aria-live="polite">{deleteState.success}</div>
      ) : null}
    </section>
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
            {snapshot.rating ? `${formatCommentRating(snapshot.rating)} / 5` : 'No rating'}
          </p>
          <p
            className="mt-2 text-xs uppercase tracking-[0.2em]"
            style={{ color: metaColor }}
          >
            Score {snapshot.backendRating || '—'}/10
          </p>
        </div>
      </div>

      <p
        className="mt-4 text-sm leading-7"
        style={{
          color: bodyColor,
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        }}
      >
        {snapshot.comment || 'No written comment.'}
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

function getWishlistNotifySummary(items) {
  const normalizedItems = Array.isArray(items) ? items : []
  const userIds = new Set()
  const productIds = new Set()
  let blockedUsers = 0

  for (const item of normalizedItems) {
    if (item?.user_id !== undefined && item?.user_id !== null) {
      userIds.add(String(item.user_id))
    }

    if (item?.product_id !== undefined && item?.product_id !== null) {
      productIds.add(String(item.product_id))
    }

    if (item?.emailblocked) {
      blockedUsers += 1
    }
  }

  return {
    entries: normalizedItems.length,
    users: userIds.size,
    products: productIds.size,
    blockedUsers,
  }
}

function WishlistNotifyPanel() {
  const [queueState, setQueueState] = useState({
    loading: true,
    error: '',
    discount: [],
    stock: [],
  })
  const [sendState, setSendState] = useState({
    type: '',
    error: '',
    success: '',
    log: '',
  })

  const discountSummary = useMemo(
    () => getWishlistNotifySummary(queueState.discount),
    [queueState.discount],
  )
  const stockSummary = useMemo(
    () => getWishlistNotifySummary(queueState.stock),
    [queueState.stock],
  )
  const busyType = sendState.type

  const loadQueue = useCallback(async ({ quiet = false } = {}) => {
    setQueueState((current) => ({
      ...current,
      loading: quiet ? current.loading : true,
      error: '',
    }))

    try {
      const queue = await fetchWishlistNotifyQueue()

      setQueueState({
        loading: false,
        error: '',
        discount: queue.discount,
        stock: queue.stock,
      })
    } catch (queueError) {
      setQueueState((current) => ({
        ...current,
        loading: false,
        error: queueError?.message || 'Could not load wishlist notification queue.',
      }))
    }
  }, [])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  function handleSend(type, summary) {
    if (busyType) {
      return
    }

    if (!summary.entries) {
      setSendState({
        type: '',
        error: '',
        success: `No ${type} notifications are waiting.`,
        log: '',
      })
      return
    }

    if (!window.confirm(`Send ${type} wishlist notifications to ${summary.users} user${summary.users === 1 ? '' : 's'} now?`)) {
      return
    }

    setSendState({
      type,
      error: '',
      success: '',
      log: '',
    })

    void sendWishlistNotifications(type)
      .then((result) => {
        setSendState({
          type: '',
          error: '',
          success: `${type === 'discount' ? 'Discount' : 'Stock'} notifications sent.`,
          log: result?.log || '',
        })
        void loadQueue({ quiet: true })
      })
      .catch((sendError) => {
        setSendState({
          type: '',
          error: sendError?.message || `Could not send ${type} notifications.`,
          success: '',
          log: '',
        })
      })
  }

  const cards = [
    {
      type: 'discount',
      title: 'Discount alerts',
      description: 'Wishlisted products whose discount changed and are waiting for a manager-triggered email.',
      summary: discountSummary,
    },
    {
      type: 'stock',
      title: 'Stock alerts',
      description: 'Wishlisted products that came back in stock and are waiting for a manager-triggered email.',
      summary: stockSummary,
    },
  ]

  return (
    <section id="wishlist-notifications" className="aurora-ops-panel p-8">
      <div className="aurora-widget-header">
        <div className="aurora-widget-heading">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
            Wishlist notifications
          </p>
          <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
            Send queued wishlist emails
          </h2>
        </div>
        <LiquidGlassButton
          type="button"
          variant="quiet"
          size="compact"
          disabled={queueState.loading || Boolean(busyType)}
          onClick={() => {
            void loadQueue()
          }}
        >
          Refresh queue
        </LiquidGlassButton>
      </div>

      <p className="mt-5 text-sm leading-7 text-[var(--aurora-text)]">
        Emails are only sent when you choose a queue below. Updating stock or discounts can add
        items here, but this panel never sends those notifications automatically.
      </p>

      {queueState.error ? (
        <div className="aurora-message aurora-message-error mt-6">{queueState.error}</div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {cards.map((card) => (
          <article key={card.type} className="aurora-ops-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                  {card.summary.entries} queued
                </p>
                <h3 className="mt-3 text-xl font-semibold text-[var(--aurora-text-strong)]">
                  {card.title}
                </h3>
              </div>
              <p className="text-right text-sm font-semibold text-[var(--aurora-text-strong)]">
                {card.summary.users} user{card.summary.users === 1 ? '' : 's'}
              </p>
            </div>

            <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
              {card.description}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--aurora-olive-deep)]">
                  Products
                </p>
                <p className="mt-1 font-semibold text-[var(--aurora-text-strong)]">
                  {card.summary.products}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--aurora-olive-deep)]">
                  Entries
                </p>
                <p className="mt-1 font-semibold text-[var(--aurora-text-strong)]">
                  {card.summary.entries}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--aurora-olive-deep)]">
                  Blocked
                </p>
                <p className="mt-1 font-semibold text-[var(--aurora-text-strong)]">
                  {card.summary.blockedUsers}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--aurora-border)] pt-4">
              <LiquidGlassButton
                type="button"
                variant={card.type === 'discount' ? 'secondary' : 'soft'}
                size="compact"
                loading={busyType === card.type}
                disabled={queueState.loading || Boolean(busyType) || !card.summary.entries}
                onClick={() => {
                  handleSend(card.type, card.summary)
                }}
              >
                Send {card.type}
              </LiquidGlassButton>
              <p className="text-sm leading-7 text-[var(--aurora-text)]">
                Requires confirmation before sending.
              </p>
            </div>
          </article>
        ))}
      </div>

      {sendState.error ? (
        <div className="aurora-message aurora-message-error mt-6">{sendState.error}</div>
      ) : null}
      {sendState.success ? (
        <div className="aurora-message aurora-message-success mt-6">{sendState.success}</div>
      ) : null}
      {sendState.log ? (
        <pre className="mt-4 max-h-48 overflow-auto rounded-[1.2rem] border border-[var(--aurora-border)] bg-[var(--aurora-surface-muted)] p-4 text-xs leading-6 text-[var(--aurora-text)]">
          {sendState.log}
        </pre>
      ) : null}
    </section>
  )
}

function ProductOrderLookupPanel() {
  const [orderId, setOrderId] = useState('')
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()

    const normalizedOrderId = orderId.trim()

    setError('')

    if (!normalizedOrderId) {
      setOrder(null)
      setError('Enter an order number before looking up details.')
      return
    }

    setLoading(true)

    void fetchAdminOrderById(normalizedOrderId)
      .then((nextOrder) => {
        setOrder(nextOrder)
      })
      .catch((lookupError) => {
        setOrder(null)
        setError(lookupError?.message || 'Could not load order details.')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const status = getOrderStatusPresentation(order)

  return (
    <section className="aurora-ops-panel p-8">
      <div className="aurora-widget-header">
        <div className="aurora-widget-heading">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
            Order lookup
          </p>
          <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
            Inspect order details
          </h2>
        </div>
      </div>

      <p className="mt-5 text-sm leading-7 text-[var(--aurora-text)]">
        Look up a known order number to review delivery region, totals, and product line details.
      </p>

      <form className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleSubmit}>
        <label className="block">
          <span className="sr-only">Order number</span>
          <input
            type="search"
            className="aurora-input"
            value={orderId}
            onChange={(event) => {
              setOrderId(event.target.value)
              setError('')
            }}
            placeholder="Enter order number"
          />
        </label>
        <LiquidGlassButton type="submit" variant="secondary" size="compact" loading={loading}>
          {loading ? 'Loading...' : 'Look up order'}
        </LiquidGlassButton>
      </form>

      {error ? (
        <div className="aurora-message aurora-message-error mt-6" role="alert">
          {error}
        </div>
      ) : null}

      {!order && !error ? (
        <SectionEmptyState
          title="No order selected"
          description="Enter an order number to load the detail record available to product operations."
        />
      ) : null}

      {order ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="aurora-widget-subsurface p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="aurora-kicker">Order</p>
                <h3 className="mt-3 break-all font-display text-3xl text-[var(--aurora-text-strong)]">
                  {order.id}
                </h3>
              </div>
              <span className={`aurora-order-status-chip is-${status.key} inline-flex`}>
                {status.label}
              </span>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="aurora-kicker">Submitted</dt>
                <dd className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                  {formatManagerOrderDate(order.submittedAt)}
                </dd>
              </div>
              <div>
                <dt className="aurora-kicker">Total</dt>
                <dd className="mt-2 text-sm font-semibold text-[var(--aurora-text-strong)]">
                  {formatCurrency(order.total)}
                </dd>
              </div>
              <div>
                <dt className="aurora-kicker">Customer</dt>
                <dd className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                  {order.delivery?.fullName || 'Customer name unavailable'}
                </dd>
              </div>
              <div>
                <dt className="aurora-kicker">Currency</dt>
                <dd className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                  {order.currency || 'TRY'}
                </dd>
              </div>
            </dl>
            <p className="mt-5 text-sm leading-7 text-[var(--aurora-text)]">
              {getManagerOrderLocation(order)}
            </p>
          </div>

          <div className="aurora-widget-subsurface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="aurora-kicker">Products</p>
              <p className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="mt-4 divide-y divide-[rgba(73,92,65,0.12)]">
              {(order.items || []).map((item) => (
                <div key={`${order.id}:${item.lineItemId || item.id || item.name}`} className="py-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--aurora-text-strong)]">
                        {item.name}
                      </p>
                      <p className="mt-1 text-[var(--aurora-text)]">
                        Qty {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-[var(--aurora-text-strong)]">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default function ProductManagerPage() {
  const debugInstance = useId()
  const { resolvedTheme } = useTheme()
  const { products, loading, error } = useProductCatalog()
  const [selectedModerationProductKey, setSelectedModerationProductKey] = useState('')
  const [moderationScope, setModerationScope] = useState('pending')
  const [moderationResult, setModerationResult] = useState({
    key: '',
    comments: [],
    error: '',
  })
  const [moderationActionState, setModerationActionState] = useState({
    recordId: '',
    action: '',
    error: '',
    success: '',
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

  useEffect(() => {
    logProductManagerDebug('page:mounted', {
      instance: debugInstance,
    })

    return () => {
      logProductManagerDebug('page:unmounted', {
        instance: debugInstance,
      })
    }
  }, [debugInstance])

  useEffect(() => {
    logProductManagerDebug('page:catalog-hook-state', {
      instance: debugInstance,
      productCount: products.length,
      loading,
      error,
      firstProductCode: products[0]?.productCode || '',
    })
  }, [debugInstance, error, loading, products])

  const moderationProductNamesById = useMemo(
    () =>
      new Map(
        moderationProducts
          .map((product) => [Number(product.id), product.name])
          .filter(([productId, productName]) => Number.isFinite(productId) && productName),
      ),
    [moderationProducts],
  )
  const allProductsSelected = selectedModerationProductKey === 'all'
  const selectedProduct = useMemo(
    () =>
      moderationProducts.find(
        (product) => (product.slug || product.productCode || product.name) === selectedModerationProductKey,
      ) || null,
    [moderationProducts, selectedModerationProductKey],
  )
  const activeModerationProductId =
    allProductsSelected
      ? 'all'
      : selectedProduct
        ? selectedProduct.id
        : ''
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
    () => getProductSelectTheme(allProductsSelected ? null : selectedProduct, resolvedTheme),
    [allProductsSelected, resolvedTheme, selectedProduct],
  )
  const moderationSelectionLabel = allProductsSelected
    ? 'All products'
    : selectedProduct?.name || ''

  function handleModerationProductChange(event) {
    setSelectedModerationProductKey(event.target.value)
  }

  function handleModerationScopeChange(nextScope) {
    setModerationScope(nextScope)
  }

  function handleModerationAction(record, action) {
    const commentId = Number(record?.meta?.id)

    if (!Number.isFinite(commentId) || commentId <= 0 || !activeModerationKey) {
      return
    }

    setModerationActionState({
      recordId: record.id,
      action,
      error: '',
      success: '',
    })

    void (async () => {
      try {
        const result = await moderateProductComment(commentId, action)

        try {
          const comments = await fetchManagerProductComments(
            activeModerationProductId,
            moderationScope,
          )

          setModerationResult({
            key: activeModerationKey,
            comments,
            error: '',
          })
        } catch (fetchError) {
          setModerationResult((current) => ({
            key: activeModerationKey,
            comments: current.key === activeModerationKey ? current.comments : [],
            error: fetchError?.message || 'Could not refresh comment moderation data.',
          }))
        }

        setModerationActionState({
          recordId: record.id,
          action: '',
          error: '',
          success:
            result?.msg ||
            `Comment ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
        })
      } catch (actionError) {
        setModerationActionState({
          recordId: record.id,
          action: '',
          error: actionError?.message || 'Could not update comment status.',
          success: '',
        })
      }
    })()
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

  useEffect(() => {
    setModerationActionState({
      recordId: '',
      action: '',
      error: '',
      success: '',
    })
  }, [activeModerationKey])

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

        <CategoryManagementPanel products={products} />

        <ProductEditPanel products={products} loading={loading} />

        <WishlistNotifyPanel />

        <ProductOrderLookupPanel />

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
                  <option value="all">All products</option>
                  {moderationProducts.map((product) => (
                    <option
                      key={product.id}
                      value={product.slug || product.productCode || product.name}
                    >
                      {product.name}
                    </option>
                  ))}
                </select>
                {activeModerationProductId ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                      style={selectedProductTheme.badgeStyle}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: selectedProductTheme.swatch }}
                      />
                      {allProductsSelected ? 'Catalog-wide' : selectedProductTheme.label}
                    </span>
                    <span className="text-sm leading-7 text-[var(--aurora-text)]">
                      {moderationSelectionLabel}
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

            {!activeModerationProductId ? (
              <SectionEmptyState
                title="Select a product"
                description="Choose a catalog item or switch to All products to inspect the full comment feed."
              />
            ) : moderationLoading ? (
              <SectionEmptyState
                title={`Loading ${moderationScope} comments`}
                description=""
              />
            ) : !moderationComments.length ? (
              <SectionEmptyState
                title={`No ${
                  moderationScope === 'all'
                    ? 'comment records'
                    : moderationScope === 'rejected'
                      ? 'rejected comments'
                      : moderationScope
                } found`}
                description={
                  allProductsSelected
                    ? 'The catalog-wide feed is empty for this scope.'
                    : `${selectedProduct.name} does not currently have entries in this queue.`
                }
              />
            ) : (
              <div className="mt-6 space-y-4">
                {moderationComments.map((record) => {
                  const normalizedStatus = String(record.meta.status || '').trim().toLowerCase()
                  const recordProductLabel = allProductsSelected
                    ? record.meta.productName ||
                      moderationProductNamesById.get(Number(record.meta.productId)) ||
                      moderationSelectionLabel
                    : moderationSelectionLabel
                  const recordHasEndpointId = Number.isFinite(Number(record.meta.id)) && Number(record.meta.id) > 0
                  const recordActionBusy = moderationActionState.recordId === record.id && Boolean(moderationActionState.action)
                  const approveDisabled = recordActionBusy || !recordHasEndpointId || normalizedStatus === 'approved'
                  const rejectDisabled =
                    recordActionBusy ||
                    !recordHasEndpointId ||
                    normalizedStatus === 'rejected' ||
                    normalizedStatus === 'edit_rejected'
                  const actionHint = recordHasEndpointId
                    ? 'Use approve or reject to update the current moderation state.'
                    : 'Switch to Pending or All to moderate this record.'
                  const actionSuccess =
                    moderationActionState.recordId === record.id
                      ? moderationActionState.success
                      : ''
                  const actionError =
                    moderationActionState.recordId === record.id
                      ? moderationActionState.error
                      : ''

                  return (
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
                          <p>{recordProductLabel || 'Selected product'}</p>
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

                      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--aurora-border)] pt-4">
                        <LiquidGlassButton
                          variant="secondary"
                          size="compact"
                          disabled={approveDisabled}
                          loading={recordActionBusy && moderationActionState.action === 'approve'}
                          onClick={() => {
                            handleModerationAction(record, 'approve')
                          }}
                        >
                          Approve
                        </LiquidGlassButton>
                        <LiquidGlassButton
                          variant="danger"
                          size="compact"
                          disabled={rejectDisabled}
                          loading={recordActionBusy && moderationActionState.action === 'reject'}
                          onClick={() => {
                            handleModerationAction(record, 'reject')
                          }}
                        >
                          Reject
                        </LiquidGlassButton>
                        <p className="text-sm leading-7 text-[var(--aurora-text)]">
                          {actionHint}
                        </p>
                      </div>

                      {actionError ? (
                        <div className="aurora-message aurora-message-error mt-4">{actionError}</div>
                      ) : null}
                      {actionSuccess ? (
                        <div className="aurora-message aurora-message-success mt-4">{actionSuccess}</div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </RoleOverviewLayout>
  )
}
