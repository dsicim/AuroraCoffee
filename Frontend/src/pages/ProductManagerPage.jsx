import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
import RoleOverviewLayout from '../components/RoleOverviewLayout'
import { fetchManagerProductComments, moderateProductComment } from '../features/comments/infrastructure/commentsApi'
import { formatCurrency } from '../lib/currency'
import { themePreferences } from '../lib/theme'
import { useTheme } from '../lib/theme-context'
import {
  getProductAvailability,
  getProductCategories,
  deleteProductImage,
  updateProductImageSet,
  updateProductDetails,
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

const productEditFields = [
  { key: 'name', column: 'name', label: 'Name', type: 'text', required: true },
  { key: 'productCode', column: 'product_code', label: 'Product code', type: 'text' },
  { key: 'price', column: 'price', label: 'Price', type: 'number', min: 0, step: '0.01' },
  { key: 'stock', column: 'stock', label: 'Stock', type: 'number', min: 0, step: '1' },
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
    description: 'Customer-facing names, codes, and product media.',
    fieldKeys: ['name', 'productCode', 'imageUrl'],
  },
  {
    title: 'Pricing and inventory',
    description: 'Numbers that affect availability and checkout totals.',
    fieldKeys: ['price', 'stock', 'discountRate', 'taxRate'],
  },
  {
    title: 'Catalog attributes',
    description: 'Product traits shown on catalog and detail pages.',
    fieldKeys: ['origin', 'roastLevel', 'acidity', 'material', 'capacity', 'flavorNotes'],
  },
].map((group) => ({
  ...group,
  fields: group.fieldKeys
    .map((fieldKey) => productEditFields.find((field) => field.key === fieldKey))
    .filter(Boolean),
}))

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

function ProductEditField({ field, defaultValue }) {
  const fieldId = `product-edit-${field.key}`
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
          required={field.required}
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

function ProductEditSnapshot({ product }) {
  const categoryLabel = product.categoryName || product.parentCategoryName || 'Catalog'
  const inventoryTone = getInventoryTone(product.stock)
  const productImage = product.imageUrl

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

function ProductImageManager({ product }) {
  const images = Array.isArray(product?.images) ? product.images : []
  const variantOptions = (product?.variants || [])
    .map((variant) => ({
      id: Number(variant.id) || 0,
      label: getProductImageVariantLabel(product, variant.id),
    }))
    .filter((variant) => variant.id > 0)
  const [selectedFile, setSelectedFile] = useState(null)
  const fileInputRef = useRef(null)
  const [fileInputVersion, setFileInputVersion] = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [primaryUpload, setPrimaryUpload] = useState(images.length === 0)
  const [nextUploadSortOrder, setNextUploadSortOrder] = useState(() =>
    getNextProductImageSortOrder(images),
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

  function setImageBusy(busy) {
    setImageState({
      busy,
      error: '',
      success: '',
    })
  }

  function setImageSuccess(success) {
    setImageState({
      busy: '',
      error: '',
      success,
    })
  }

  function setImageError(error) {
    setImageState({
      busy: '',
      error: error?.message || 'Could not update product images.',
      success: '',
    })
  }

  function handleUpload() {
    if (imageBusy) {
      return
    }

    if (!selectedFile) {
      setImageError(new Error('Choose an image file before uploading.'))
      return
    }

    setImageBusy('upload')

    void uploadProductImage({
      productId: product.id,
      file: selectedFile,
      sortOrder: Math.max(nextUploadSortOrder, getNextProductImageSortOrder(images)),
      variantId: selectedVariant?.id || '',
      primary: primaryUpload,
    })
      .then((result) => {
        setSelectedFile(null)
        setFileInputVersion((version) => version + 1)
        setNextUploadSortOrder((sortOrder) => sortOrder + 1)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        setSelectedVariantId('')
        setPrimaryUpload(false)
        setImageSuccess(result?.msg || 'Product image uploaded.')
      })
      .catch(setImageError)
  }

  function handleSetPrimary(image) {
    setImageBusy(`primary:${image.url}`)

    void updateProductImageSet(product.id, {
      setAsPrimary: true,
      url: image.url,
    })
      .then((result) => {
        setImageSuccess(result?.setprimary || result?.msg || 'Primary image updated.')
      })
      .catch(setImageError)
  }

  function handleReorder(index, direction) {
    const newOrder = moveProductImageUrl(images, index, direction)

    if (!newOrder) {
      return
    }

    setImageBusy(`order:${images[index].url}:${direction}`)

    void updateProductImageSet(product.id, { newOrder })
      .then((result) => {
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
        setImageSuccess(result?.msg || 'Product image deleted.')
      })
      .catch(setImageError)
  }

  return (
    <section
      className="aurora-product-edit-group aurora-product-image-manager"
      onKeyDownCapture={preventProductImageEnterAction}
    >
      <div className="aurora-product-image-manager-header">
        <div>
          <p className="aurora-product-edit-label">Product images</p>
          <h3>Manage gallery and variants</h3>
        </div>
        <span>{images.length} {images.length === 1 ? 'image' : 'images'}</span>
      </div>

      <div className="aurora-product-image-upload">
        <label className="aurora-product-edit-field">
          <span className="aurora-product-edit-label">Upload image</span>
          <input
            key={fileInputVersion}
            ref={fileInputRef}
            className="aurora-input aurora-product-edit-input mt-3"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={imageBusy}
            onChange={(event) => {
              if (imageBusy) {
                return
              }

              setSelectedFile(event.target.files?.[0] || null)
              setImageState({ busy: '', error: '', success: '' })
            }}
          />
        </label>

        <label className="aurora-product-edit-field">
          <span className="aurora-product-edit-label">Variant key</span>
          <select
            className="aurora-select aurora-product-edit-input mt-3"
            value={selectedVariantId}
            disabled={imageBusy}
            onChange={(event) => {
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
        <p className="aurora-message aurora-message-error">{imageState.error}</p>
      ) : null}
      {imageState.success ? (
        <p className="aurora-message aurora-message-success">{imageState.success}</p>
      ) : null}

      {images.length ? (
        <div className="aurora-product-image-list">
          {images.map((image, index) => (
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
                    disabled={imageBusy || index === images.length - 1}
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

function ProductEditPanel({ products, loading }) {
  const editableProducts = useMemo(
    () => [...products].sort((left, right) => left.name.localeCompare(right.name)),
    [products],
  )
  const [selectedProductKey, setSelectedProductKey] = useState('')
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [selectedProductSnapshot, setSelectedProductSnapshot] = useState(null)
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
  const editFieldsRef = useRef(null)

  function getCurrentEditForm() {
    return Object.fromEntries(
      productEditFields.map((field) => {
        const input = editFieldsRef.current?.querySelector(`[name="${field.key}"]`)
        return [field.key, input?.value || '']
      }),
    )
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
          {selectedProduct ? (
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
          <label className="aurora-product-edit-picker-field">
            <span className="aurora-product-edit-label">Product</span>
            <select
              className="aurora-select aurora-product-edit-input mt-3"
              value={selectedProductSelectKey}
              onChange={(event) => {
                const nextProductKey = event.target.value
                const nextProduct =
                  editableProducts.find(
                    (product) => getProductManagerSelectKey(product) === nextProductKey,
                  ) || null

                setSelectedProductKey(nextProductKey)
                setSelectedProductId(nextProduct?.id ?? null)
                setSelectedProductSnapshot(nextProduct)
                setSaveState({
                  saving: false,
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
          <p className="aurora-product-edit-picker-copy">
            {selectedProduct
              ? 'Changes save directly to the product record after review.'
              : 'Choose an item to reveal the editable storefront fields.'}
          </p>
        </div>

        {selectedProduct ? (
          <>
            <div
              key={selectedProduct.id}
              ref={editFieldsRef}
              className="aurora-product-edit-workspace"
            >
              <ProductEditSnapshot product={selectedProduct} />
              <ProductImageManager product={selectedProduct} />

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
                  disabled={saveState.saving}
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
                  variant="secondary"
                  loading={saveState.saving}
                  disabled={saveState.saving}
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
        <div className="aurora-message aurora-message-error mt-6">{saveState.error}</div>
      ) : null}
      {saveState.success ? (
        <div className="aurora-message aurora-message-success mt-6">{saveState.success}</div>
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

export default function ProductManagerPage() {
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

        <ProductEditPanel products={products} loading={loading} />

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
                          <p>{moderationSelectionLabel || 'Selected product'}</p>
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
