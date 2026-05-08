import { useEffect, useState } from 'react'
import { authChangeEvent, getAuthSession } from './auth'
import { fetchAuthJson, fetchAuthResponse, readJsonResponse } from './authRequest'
import { getGeneratedProductImageUrl } from '../features/products/domain/generatedProductImages'

export const productCatalogChangeEvent = 'aurora-product-catalog-change'

let catalogProducts = []
let catalogProductsLoaded = false
let productsPromise = null
let productsPromiseScope = null
let catalogScope = null
const productLookupById = new Map()

function dispatchProductCatalogChange(type = 'sync') {
  window.dispatchEvent(
    new CustomEvent(productCatalogChangeEvent, {
      detail: { type },
    }),
  )
}

function clearProductsCache({ emit = true } = {}) {
  const hadState =
    catalogProducts.length > 0 ||
    catalogProductsLoaded ||
    productsPromise !== null ||
    productLookupById.size > 0

  catalogProducts = []
  catalogProductsLoaded = false
  productsPromise = null
  productsPromiseScope = null
  catalogScope = null
  productLookupById.clear()

  if (emit && hadState) {
    dispatchProductCatalogChange('clear')
  }
}

function getProductCatalogScope() {
  const session = getAuthSession()

  if (!session?.token) {
    return 'guest'
  }

  return session.email?.trim().toLowerCase() || session.token.trim()
}

function ensureProductCatalogScope(scope) {
  if (catalogScope === scope) {
    return
  }

  clearProductsCache()
  catalogScope = scope
}

function getScopedCatalogSnapshot() {
  const scope = getProductCatalogScope()

  if (catalogScope !== scope) {
    return {
      products: [],
      loaded: false,
    }
  }

  return {
    products: catalogProducts,
    loaded: catalogProductsLoaded,
  }
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getProductCode(rawProduct) {
  return normalizeCode(rawProduct?.product_code ?? rawProduct?.productCode)
}

function getProductSlug(rawProduct) {
  return getProductCode(rawProduct) || normalizeCode(rawProduct?.slug) || slugify(rawProduct?.name)
}

function toNumber(value) {
  const numericValue =
    typeof value === 'number'
      ? value
      : Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''))

  return Number.isFinite(numericValue) ? numericValue : 0
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numericValue =
    typeof value === 'number'
      ? value
      : Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''))

  return Number.isFinite(numericValue) ? numericValue : null
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase()
    return normalizedValue === 'true' || normalizedValue === '1'
  }

  return false
}

function normalizeCode(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

function normalizeProductOptionValue(rawValue) {
  return {
    id: Number(rawValue?.id ?? rawValue?.value_id) || 0,
    label: normalizeText(rawValue?.label) || 'Option',
    description: normalizeText(rawValue?.description ?? rawValue?.desc),
    valueCode: normalizeCode(rawValue?.value_code ?? rawValue?.valueCode ?? rawValue?.label ?? rawValue?.id),
    priceAdd: toNumber(rawValue?.price_add ?? rawValue?.priceAdd),
    priceMult: toNullableNumber(rawValue?.price_mult ?? rawValue?.priceMult) ?? 1,
    sortOrder: Number(rawValue?.sort_order ?? rawValue?.sortOrder) || 0,
  }
}

function normalizeProductOptionGroup(rawGroup) {
  const id = normalizeCode(rawGroup?.id ?? rawGroup?.group_id)
  const code = normalizeCode(rawGroup?.group_code ?? rawGroup?.groupCode ?? rawGroup?.code) || id
  const values = Array.isArray(rawGroup?.values)
    ? rawGroup.values.map(normalizeProductOptionValue)
    : []

  return {
    id,
    code,
    name: normalizeText(rawGroup?.name ?? rawGroup?.group_name) || 'Option',
    storeAsVariant: toBoolean(rawGroup?.store_as_variant ?? rawGroup?.storeAsVariant),
    cumulativeStock: toBoolean(rawGroup?.cumulative_stock ?? rawGroup?.cumulativeStock),
    separateStock: toBoolean(rawGroup?.separate_stock ?? rawGroup?.separateStock),
    separatePrice: toBoolean(rawGroup?.separate_price ?? rawGroup?.separatePrice),
    isRequired:
      rawGroup?.is_required === undefined && rawGroup?.isRequired === undefined
        ? true
        : toBoolean(rawGroup?.is_required ?? rawGroup?.isRequired),
    multiSelect: toBoolean(rawGroup?.multi_select ?? rawGroup?.multiSelect),
    priority: Number(rawGroup?.priority) || 0,
    values: values.sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)),
  }
}

function normalizeVariantOptionValueCodes(rawCodes, fallbackVariantCode, optionGroups) {
  if (rawCodes && typeof rawCodes === 'object' && !Array.isArray(rawCodes)) {
    const entries = Object.entries(rawCodes)
      .map(([key, value]) => [normalizeCode(key), normalizeCode(value)])
      .filter(([key, value]) => Boolean(key && value))

    if (entries.length) {
      return Object.fromEntries(entries)
    }
  }

  const fallbackCode = normalizeCode(fallbackVariantCode)
  const variantBackedGroups = (optionGroups || []).filter((group) => group.storeAsVariant)

  if (fallbackCode && variantBackedGroups.length === 1) {
    return {
      [variantBackedGroups[0].code || variantBackedGroups[0].id]: fallbackCode,
    }
  }

  return {}
}

function normalizeProductVariant(rawVariant, optionGroups) {
  return {
    id: Number(rawVariant?.id ?? rawVariant?.variant_id) || 0,
    variantCode: normalizeCode(rawVariant?.variant_code ?? rawVariant?.variantCode),
    price: toNumber(rawVariant?.price),
    stock: Math.max(0, Number(rawVariant?.stock) || 0),
    optionValueCodes: normalizeVariantOptionValueCodes(
      rawVariant?.option_value_codes ?? rawVariant?.optionValueCodes,
      rawVariant?.variant_code ?? rawVariant?.variantCode,
      optionGroups,
    ),
  }
}

function normalizeProductImageUrl(value) {
  const url = normalizeText(value)

  if (!url) {
    return ''
  }

  if (/^(?:https?:|data:|blob:|\/)/i.test(url)) {
    return url
  }

  return `/uploads/${encodeURIComponent(url)}`
}

function normalizeProductImage(rawImage, index) {
  if (!rawImage) {
    return null
  }

  if (typeof rawImage === 'string') {
    const url = normalizeText(rawImage)

    if (!url) {
      return null
    }

    return {
      id: null,
      url,
      src: normalizeProductImageUrl(url),
      isPrimary: index === 0,
      variantId: null,
      sortOrder: index,
    }
  }

  if (typeof rawImage !== 'object') {
    return null
  }

  const url = normalizeText(rawImage.url || rawImage.image_url || rawImage.imageUrl)

  if (!url) {
    return null
  }

  return {
    id: Number(rawImage.id) || null,
    url,
    src: normalizeProductImageUrl(url),
    isPrimary: toBoolean(rawImage.is_primary ?? rawImage.isPrimary),
    variantId: Number(rawImage.variant_id ?? rawImage.variantId) || null,
    sortOrder: Number(rawImage.sort_order ?? rawImage.sortOrder ?? index) || 0,
  }
}

function buildSlugMap(rawProducts) {
  const baseSlugCounts = new Map()

  for (const product of rawProducts) {
    const productCode = getProductCode(product)
    const baseSlug = productCode || slugify(product.name) || 'product'
    baseSlugCounts.set(baseSlug, (baseSlugCounts.get(baseSlug) || 0) + 1)
  }

  return rawProducts.map((product) => {
    const productCode = getProductCode(product)
    const baseSlug = productCode || slugify(product.name) || 'product'
    const slug =
      !productCode && (baseSlugCounts.get(baseSlug) || 0) > 1
        ? `${baseSlug}-${product.id}`
        : baseSlug

    return { ...product, slug }
  })
}

function normalizeProduct(rawProduct) {
  const optionGroups = Array.isArray(rawProduct?.options)
    ? rawProduct.options.map(normalizeProductOptionGroup)
    : []
  const images = Array.isArray(rawProduct?.images)
    ? rawProduct.images
        .map((image, index) => normalizeProductImage(image, index))
        .filter(Boolean)
        .sort((left, right) => left.sortOrder - right.sortOrder || Number(left.id || 0) - Number(right.id || 0))
    : []
  const variants = Array.isArray(rawProduct?.variants)
    ? rawProduct.variants.map((variant) => normalizeProductVariant(variant, optionGroups))
    : []
  const primaryImage = images.find((image) => image.isPrimary) || images[0] || null

  return {
    id: Number(rawProduct.id),
    slug: getProductSlug(rawProduct),
    productCode: getProductCode(rawProduct),
    name: normalizeText(rawProduct.name),
    description: normalizeText(rawProduct.description),
    price: toNumber(rawProduct.price),
    stock: Math.max(0, Number(rawProduct.stock) || 0),
    origin: normalizeText(rawProduct.origin),
    roastLevel: normalizeText(rawProduct.roast_level),
    acidity: normalizeText(rawProduct.acidity),
    flavorNotes: normalizeText(rawProduct.flavor_notes),
    material: normalizeText(rawProduct.material),
    capacity: normalizeText(rawProduct.capacity),
    imageUrl:
      primaryImage?.src ||
      normalizeProductImageUrl(rawProduct.image_url) ||
      getGeneratedProductImageUrl(rawProduct),
    images,
    categoryId: Number(rawProduct.category_id) || null,
    categoryName: normalizeText(rawProduct.category_name),
    parentCategoryName: normalizeText(rawProduct.parent_category_name),
    hasVariants: toBoolean(rawProduct.has_variants ?? rawProduct.hasVariants),
    canComment: toBoolean(
      rawProduct.can_comment ??
        rawProduct.canComment ??
        rawProduct.able_to_comment ??
        rawProduct.ableToComment ??
        rawProduct.abletocomment,
    ),
    averageRating: toNullableNumber(rawProduct.averageRating ?? rawProduct.average_rating),
    options: optionGroups,
    variants,
    discountRate: toNullableNumber(rawProduct.discount_rate ?? rawProduct.discountRate) ?? 0,
    taxRate: toNullableNumber(rawProduct.tax_rate ?? rawProduct.taxRate ?? rawProduct.tax),
    taxClass: normalizeText(rawProduct.tax_class || rawProduct.taxClass),
    taxRateOverride: rawProduct.tax_rate_override ?? rawProduct.taxRateOverride ?? null,
    priceNet: toNullableNumber(rawProduct.price_net ?? rawProduct.priceNet ?? rawProduct.subtotal),
    taxAmount: toNullableNumber(rawProduct.tax_amount ?? rawProduct.taxAmount),
    createdAt: rawProduct.created_at || '',
  }
}

function mergeProductRecord(existingProduct, incomingProduct) {
  if (!existingProduct) {
    return incomingProduct
  }

  return {
    ...existingProduct,
    ...incomingProduct,
    slug: incomingProduct.slug || existingProduct.slug,
    name: incomingProduct.name || existingProduct.name,
    description: incomingProduct.description || existingProduct.description,
    productCode: incomingProduct.productCode || existingProduct.productCode,
    origin: incomingProduct.origin || existingProduct.origin,
    roastLevel: incomingProduct.roastLevel || existingProduct.roastLevel,
    acidity: incomingProduct.acidity || existingProduct.acidity,
    flavorNotes: incomingProduct.flavorNotes || existingProduct.flavorNotes,
    material: incomingProduct.material || existingProduct.material,
    capacity: incomingProduct.capacity || existingProduct.capacity,
    imageUrl: incomingProduct.imageUrl || existingProduct.imageUrl,
    images: incomingProduct.images?.length ? incomingProduct.images : existingProduct.images,
    categoryId: incomingProduct.categoryId ?? existingProduct.categoryId,
    categoryName: incomingProduct.categoryName || existingProduct.categoryName,
    parentCategoryName:
      incomingProduct.parentCategoryName || existingProduct.parentCategoryName,
    hasVariants: incomingProduct.hasVariants ?? existingProduct.hasVariants,
    canComment: incomingProduct.canComment ?? existingProduct.canComment,
    averageRating: incomingProduct.averageRating,
    options: incomingProduct.options?.length ? incomingProduct.options : existingProduct.options,
    variants: incomingProduct.variants?.length ? incomingProduct.variants : existingProduct.variants,
    discountRate: incomingProduct.discountRate ?? existingProduct.discountRate,
    taxRate: incomingProduct.taxRate ?? existingProduct.taxRate,
    taxClass: incomingProduct.taxClass || existingProduct.taxClass,
    taxRateOverride: incomingProduct.taxRateOverride ?? existingProduct.taxRateOverride,
    priceNet: incomingProduct.priceNet ?? existingProduct.priceNet,
    taxAmount: incomingProduct.taxAmount ?? existingProduct.taxAmount,
    createdAt: incomingProduct.createdAt || existingProduct.createdAt,
  }
}

function updateProductLookup(products, scope = catalogScope) {
  if (scope !== catalogScope) {
    return []
  }

  const normalizedProducts = products.map(normalizeProduct)

  for (const product of normalizedProducts) {
    const existingProduct = productLookupById.get(product.id)
    productLookupById.set(product.id, mergeProductRecord(existingProduct, product))
  }

  return normalizedProducts
}

function storeCatalogProducts(products, scope = catalogScope) {
  if (scope !== catalogScope) {
    return []
  }

  const normalizedProducts = products.map(normalizeProduct)

  catalogProducts = normalizedProducts
  catalogProductsLoaded = true

  productLookupById.clear()
  for (const product of normalizedProducts) {
    productLookupById.set(product.id, product)
  }

  dispatchProductCatalogChange('list')

  return normalizedProducts
}

function hydrateWithKnownSlugs(rawProducts) {
  if (!productLookupById.size) {
    return buildSlugMap(rawProducts)
  }

  return rawProducts.map((product) => {
    const existing = productLookupById.get(Number(product.id))
    return {
      ...product,
      slug: getProductCode(product) || existing?.slug || slugify(product.name) || `product-${product.id}`,
    }
  })
}

function getProductFromLookupBySlug(slug) {
  const normalizedSlug = String(slug || '').trim()

  if (!normalizedSlug || catalogScope !== getProductCatalogScope()) {
    return null
  }

  for (const product of productLookupById.values()) {
    if (product.slug === normalizedSlug) {
      return product
    }
  }

  return null
}

async function requestJson(path, options = {}) {
  const response = await fetchAuthResponse(path, options)
  const { payload, data } = await readJsonResponse(response)

  if (!response.ok || data?.e || payload?.e) {
    throw new Error(data?.e || payload?.e || 'Request failed')
  }

  return data
}

export function getProductRequestErrorMessage(
  error,
  fallback = 'Catalog could not be reached from this local preview.',
) {
  const message = String(error?.message || '').trim()

  if (!message || message === 'Load failed' || message === 'Failed to fetch') {
    return fallback
  }

  return message || fallback
}

async function requestProducts(scope) {
  const payload = await requestJson('/products/all')
  const normalizedProducts = storeCatalogProducts(buildSlugMap(payload?.products || []), scope)
  return normalizedProducts
}

export async function fetchAllProducts({ force = false } = {}) {
  const scope = getProductCatalogScope()
  ensureProductCatalogScope(scope)

  if (!force && productsPromise && productsPromiseScope === scope) {
    return productsPromise
  }

  productsPromiseScope = scope
  productsPromise = requestProducts(scope).finally(() => {
    if (productsPromiseScope === scope) {
      productsPromise = null
      productsPromiseScope = null
    }
  })

  return productsPromise
}

export async function fetchProductsByIds(ids) {
  const scope = getProductCatalogScope()
  ensureProductCatalogScope(scope)

  const normalizedIds = Array.from(
    new Set(
      (ids || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  )

  if (!normalizedIds.length) {
    return []
  }

  const cachedMatches = normalizedIds
    .map((id) => productLookupById.get(id))
    .filter(Boolean)

  if (cachedMatches.length === normalizedIds.length) {
    return cachedMatches
  }

  const payload = await requestJson(`/products?ids=${normalizedIds.join(',')}`)
  const hydratedProducts = hydrateWithKnownSlugs(payload?.products || [])

  if (catalogScope !== scope) {
    return []
  }

  updateProductLookup(hydratedProducts, scope)

  return normalizedIds
    .map((id) => productLookupById.get(id))
    .filter(Boolean)
}

export async function fetchProductsBySlugs(slugs) {
  const scope = getProductCatalogScope()
  ensureProductCatalogScope(scope)

  const normalizedSlugs = Array.from(
    new Set(
      (slugs || [])
        .map((slug) => String(slug || '').trim())
        .filter(Boolean),
    ),
  )

  if (!normalizedSlugs.length) {
    return []
  }

  const cachedMatches = normalizedSlugs
    .map((slug) => getProductFromLookupBySlug(slug))
    .filter(Boolean)

  if (cachedMatches.length === normalizedSlugs.length) {
    return cachedMatches
  }

  const encodedSlugs = normalizedSlugs.map((slug) => encodeURIComponent(slug)).join(',')
  const payload = await requestJson(`/products?urls=${encodedSlugs}`)
  const hydratedProducts = hydrateWithKnownSlugs(payload?.products || [])

  if (catalogScope !== scope) {
    return []
  }

  updateProductLookup(hydratedProducts, scope)

  return normalizedSlugs
    .map((slug) => getProductFromLookupBySlug(slug))
    .filter(Boolean)
}

export async function searchProducts(query, sortBy = 'newest') {
  const scope = getProductCatalogScope()
  ensureProductCatalogScope(scope)

  const normalizedQuery = String(query || '').trim()

  if (!normalizedQuery) {
    return fetchAllProducts()
  }

  const backendSort =
    sortBy === 'price-asc'
      ? 'price_asc'
      : sortBy === 'price-desc'
        ? 'price_desc'
        : sortBy === 'oldest' || sortBy === 'sales' || sortBy === 'rating'
          ? sortBy
          : 'newest'

  const payload = await requestJson(
    `/products/search?q=${encodeURIComponent(normalizedQuery)}&s=${encodeURIComponent(backendSort)}`,
  )
  const hydratedProducts = hydrateWithKnownSlugs(payload?.products || [])

  if (catalogScope !== scope) {
    return []
  }

  const normalizedProducts = updateProductLookup(hydratedProducts, scope)
  return normalizedProducts.map((product) => productLookupById.get(product.id) || product)
}

export function getCachedProducts() {
  return getScopedCatalogSnapshot().products
}

export function getProductCatalogSnapshot() {
  return getScopedCatalogSnapshot()
}

export function invalidateProductCatalogCache() {
  clearProductsCache()
}

export async function updateProductDetails(productId, edits) {
  const normalizedProductId = Number(productId)

  if (!Number.isFinite(normalizedProductId) || normalizedProductId <= 0) {
    throw new Error('Select a valid product before saving.')
  }

  const normalizedEdits = Object.fromEntries(
    Object.entries(edits || {}).filter(([, value]) => value !== undefined),
  )

  if (!Object.keys(normalizedEdits).length) {
    throw new Error('No product changes to save.')
  }

  const { data } = await fetchAuthJson('/products', {
    method: 'PATCH',
    json: true,
    body: JSON.stringify({
      id: normalizedProductId,
      edits: normalizedEdits,
    }),
  })

  await fetchAllProducts({ force: true })

  return data
}

async function refreshProductsAfterImageChange() {
  await fetchAllProducts({ force: true })
}

function readProductImageResponse(response, fallbackMessage) {
  return readJsonResponse(response).then(({ payload, data }) => {
    if (!response.ok || data?.e || payload?.e) {
      throw new Error(data?.e || payload?.e || fallbackMessage)
    }

    return data
  })
}

export async function uploadProductImage({
  productId,
  file,
  sortOrder = 0,
  variantId = '',
  primary = false,
}) {
  const normalizedProductId = Number(productId)

  if (!Number.isFinite(normalizedProductId) || normalizedProductId <= 0) {
    throw new Error('Select a valid product before uploading an image.')
  }

  if (typeof File === 'undefined' || !(file instanceof File)) {
    throw new Error('Choose an image file to upload.')
  }

  const normalizedSortOrder = Number(sortOrder)

  if (!Number.isFinite(normalizedSortOrder) || normalizedSortOrder < 0) {
    throw new Error('Choose a valid image order.')
  }

  const normalizedVariantId = Number(variantId)
  const headers = {
    'content-type': file.type || 'application/octet-stream',
    'x-product': String(normalizedProductId),
    'x-sortorder': String(Math.floor(normalizedSortOrder)),
    'x-primary': primary ? 'true' : 'false',
  }

  if (Number.isFinite(normalizedVariantId) && normalizedVariantId > 0) {
    headers['x-variant'] = String(normalizedVariantId)
  }

  const response = await fetchAuthResponse('/products/image', {
    method: 'POST',
    headers,
    body: file,
  })
  const data = await readProductImageResponse(response, 'Could not upload product image.')

  await refreshProductsAfterImageChange()
  return data
}

export async function updateProductImageSet(productId, payload) {
  const normalizedProductId = Number(productId)

  if (!Number.isFinite(normalizedProductId) || normalizedProductId <= 0) {
    throw new Error('Select a valid product before updating images.')
  }

  const { data } = await fetchAuthJson('/products/image', {
    method: 'PATCH',
    json: true,
    body: JSON.stringify({
      id: normalizedProductId,
      ...(payload || {}),
    }),
  })

  await refreshProductsAfterImageChange()
  return data
}

export async function deleteProductImage(url) {
  const normalizedUrl = normalizeText(url)

  if (!normalizedUrl) {
    throw new Error('Choose an image before deleting.')
  }

  const response = await fetchAuthResponse(
    `/products/image?url=${encodeURIComponent(normalizedUrl)}`,
    { method: 'DELETE' },
  )
  const data = await readProductImageResponse(response, 'Could not delete product image.')

  await refreshProductsAfterImageChange()
  return data
}

export async function findProductBySlug(slug) {
  const normalizedSlug = String(slug || '').trim()

  if (!normalizedSlug) {
    return null
  }

  const [product] = await fetchProductsBySlugs([normalizedSlug])
  return product || null
}

export async function findProductByReference(reference) {
  const normalizedReference = String(reference || '').trim()

  if (!normalizedReference) {
    return null
  }

  const numericReference = Number(normalizedReference)

  if (Number.isFinite(numericReference) && numericReference > 0) {
    const byId = await fetchProductsByIds([numericReference])
    if (byId[0]) {
      return byId[0]
    }
  }

  const [productBySlug] = await fetchProductsBySlugs([normalizedReference]).catch(() => [])

  if (productBySlug) {
    return productBySlug
  }

  const products = await fetchAllProducts()

  return (
    products.find((product) => product.slug === normalizedReference) ||
    products.find((product) => String(product.id) === normalizedReference) ||
    null
  )
}

export function getProductAvailability(product) {
  return {
    hasStock: (product?.stock || 0) > 0,
    totalStock: Math.max(0, Number(product?.stock) || 0),
  }
}

export function getProductFlavorNotes(product) {
  return normalizeText(product?.flavorNotes)
    .split(',')
    .map((note) => note.trim())
    .filter(Boolean)
}

export function isCoffeeProduct(product) {
  return (
    product?.parentCategoryName?.toLowerCase() === 'coffee' ||
    Boolean(product?.roastLevel || product?.origin || product?.flavorNotes)
  )
}

export function getProductCategoryName(product) {
  return product?.categoryName || product?.parentCategoryName || ''
}

export function getProductCategoryLabel(product) {
  return getProductCategoryName(product) || 'Catalog'
}

export function getProductTypeLabel(product) {
  if (isCoffeeProduct(product)) {
    return product?.roastLevel || getProductCategoryLabel(product)
  }

  return getProductCategoryLabel(product)
}

export function getProductMetaLine(product) {
  const pieces = isCoffeeProduct(product)
    ? [product?.origin, product?.acidity ? `${product.acidity} acidity` : '']
    : [product?.material, product?.capacity]

  return pieces.filter(Boolean).join(' · ')
}

export function getProductSearchText(product) {
  return [
    product?.name,
    product?.description,
    product?.origin,
    product?.roastLevel,
    product?.acidity,
    product?.flavorNotes,
    product?.material,
    product?.capacity,
    product?.categoryName,
    product?.parentCategoryName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function getProductCategories(products) {
  return [
    'All',
    ...new Set(
      (products || [])
        .map((product) => getProductCategoryName(product))
        .filter(Boolean),
    ),
  ]
}

export function getRelatedProducts(products, targetProduct, limit = 3) {
  return (products || [])
    .filter((product) => product.slug !== targetProduct?.slug)
    .sort((left, right) => {
      const leftScore =
        (left.categoryName === targetProduct?.categoryName ? 2 : 0) +
        (left.parentCategoryName === targetProduct?.parentCategoryName ? 1 : 0)
      const rightScore =
        (right.categoryName === targetProduct?.categoryName ? 2 : 0) +
        (right.parentCategoryName === targetProduct?.parentCategoryName ? 1 : 0)

      if (rightScore !== leftScore) {
        return rightScore - leftScore
      }

      return right.stock - left.stock
    })
    .slice(0, limit)
}

export function useProductCatalog() {
  const [snapshot, setSnapshot] = useState(() => getProductCatalogSnapshot())
  const [loading, setLoading] = useState(() => !getProductCatalogSnapshot().loaded)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let loadRequestId = 0

    const syncSnapshot = () => {
      if (!active) {
        return
      }

      const nextSnapshot = getProductCatalogSnapshot()
      setSnapshot(nextSnapshot)

      if (nextSnapshot.loaded) {
        setLoading(false)
      }
    }

    const loadProducts = ({ force = false } = {}) => {
      const requestId = ++loadRequestId
      setLoading(true)

      return fetchAllProducts({ force })
        .then((nextProducts) => {
          if (!active || requestId !== loadRequestId) {
            return
          }

          setSnapshot({
            products: nextProducts,
            loaded: true,
          })
          setError('')
        })
        .catch((fetchError) => {
          if (!active || requestId !== loadRequestId) {
            return
          }

          setError(getProductRequestErrorMessage(fetchError))
        })
        .finally(() => {
          if (active && requestId === loadRequestId) {
            setLoading(false)
          }
        })
    }

    const handleAuthChange = () => {
      if (!active) {
        return
      }

      setSnapshot(getProductCatalogSnapshot())
      setError('')
      void loadProducts({ force: true })
    }

    window.addEventListener(productCatalogChangeEvent, syncSnapshot)
    window.addEventListener(authChangeEvent, handleAuthChange)
    syncSnapshot()

    void loadProducts()

    return () => {
      active = false
      window.removeEventListener(productCatalogChangeEvent, syncSnapshot)
      window.removeEventListener(authChangeEvent, handleAuthChange)
    }
  }, [])

  return {
    products: snapshot.products,
    loaded: snapshot.loaded,
    loading,
    error,
  }
}

export function useProductBySlug(slug) {
  const [product, setProduct] = useState(() => getProductFromLookupBySlug(slug))
  const [loading, setLoading] = useState(() => !getProductFromLookupBySlug(slug))
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const loadProduct = async ({ force = false } = {}) => {
      const normalizedSlug = String(slug || '').trim()

      if (!normalizedSlug) {
        if (active) {
          setProduct(null)
          setLoading(false)
          setError('')
        }
        return
      }

      ensureProductCatalogScope(getProductCatalogScope())
      const session = getAuthSession()
      const cachedProduct = getProductFromLookupBySlug(normalizedSlug)

      if (cachedProduct && !force && !session?.token) {
        if (active) {
          setProduct(cachedProduct)
          setLoading(false)
          setError('')
        }
        return
      }

      if (active) {
        setLoading(true)
        setError('')
      }

      try {
        const nextProduct = await findProductBySlug(normalizedSlug)
        if (!active) {
          return
        }
        setProduct(nextProduct)
      } catch (fetchError) {
        if (!active) {
          return
        }

        setProduct(null)
        setError(getProductRequestErrorMessage(fetchError, 'The requested product route does not match the live catalog.'))
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    const handleAuthChange = () => {
      void loadProduct({ force: true })
    }

    const handleProductCatalogChange = () => {
      void loadProduct({ force: true })
    }

    window.addEventListener(productCatalogChangeEvent, handleProductCatalogChange)
    window.addEventListener(authChangeEvent, handleAuthChange)
    void loadProduct()

    return () => {
      active = false
      window.removeEventListener(productCatalogChangeEvent, handleProductCatalogChange)
      window.removeEventListener(authChangeEvent, handleAuthChange)
    }
  }, [slug])

  return { product, loading, error }
}
