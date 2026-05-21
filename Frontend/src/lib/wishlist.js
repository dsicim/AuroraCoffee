import { getAuthSession } from './auth'
import { fetchAuthJson } from './authRequest'
import { fetchProductsByIds, findProductByReference } from './products'

export const wishlistChangeEvent = 'aurora-wishlist-change'

let wishlistProductReferences = []
let wishlistLoaded = false
let wishlistPromise = null
let wishlistScope = null

export class WishlistRequestError extends Error {
  constructor(message, status = 500, details = null) {
    super(message)
    this.name = 'WishlistRequestError'
    this.status = status
    this.details = details
  }
}

function normalizeWishlistReference(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

function getWishlistScope() {
  const session = getAuthSession()

  if (!session?.token) {
    return null
  }

  const scopeSource = session.email?.trim().toLowerCase() || session.token.trim()
  return encodeURIComponent(scopeSource)
}

function getBackendProductId(item) {
  const productId = Number(item?.product_id ?? item?.productId ?? item?.product?.id)

  return Number.isFinite(productId) && productId > 0 ? productId : null
}

function getDirectWishlistReferences(item) {
  if (!item || typeof item !== 'object') {
    const value = normalizeWishlistReference(item)
    return value && !/^\d+$/.test(value) ? [value] : []
  }

  return [
    item.slug,
    item.productSlug,
    item.product_slug,
    item.productCode,
    item.product_code,
    item.product?.slug,
    item.product?.productCode,
    item.product?.product_code,
  ]
    .map(normalizeWishlistReference)
    .filter(Boolean)
}

async function normalizeWishlistItems(items) {
  const directReferences = (items || []).flatMap(getDirectWishlistReferences)
  const backendProductIds = Array.from(
    new Set((items || []).map(getBackendProductId).filter(Boolean)),
  )

  if (!backendProductIds.length) {
    return Array.from(new Set(directReferences))
  }

  const products = await fetchProductsByIds(backendProductIds)
  const productById = new Map(products.map((product) => [Number(product.id), product]))
  const productReferences = backendProductIds
    .map((productId) => productById.get(productId)?.slug)
    .filter(Boolean)

  return Array.from(new Set([...directReferences, ...productReferences]))
}

function dispatchWishlistChange(type = 'sync') {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(wishlistChangeEvent, {
      detail: { type },
    }),
  )
}

function clearWishlistReferences({ emit = false, type = 'clear' } = {}) {
  const hadState = wishlistProductReferences.length > 0 || wishlistLoaded || wishlistScope !== null

  wishlistProductReferences = []
  wishlistLoaded = false
  wishlistPromise = null
  wishlistScope = null

  if (emit && hadState) {
    dispatchWishlistChange(type)
  }
}

function ensureWishlistScope(scope) {
  if (wishlistScope === scope) {
    return
  }

  clearWishlistReferences({ emit: true, type: 'scope' })
  wishlistScope = scope
}

async function setWishlistProductReferences(items, scope) {
  wishlistProductReferences = await normalizeWishlistItems(items)
  wishlistLoaded = true
  wishlistScope = scope
  dispatchWishlistChange('list')
  return wishlistProductReferences
}

function addWishlistProductReferences(product) {
  wishlistProductReferences = Array.from(
    new Set(
      [
        ...wishlistProductReferences,
        product?.slug,
        product?.productCode,
      ]
        .map(normalizeWishlistReference)
        .filter(Boolean),
    ),
  )
  wishlistLoaded = true
  dispatchWishlistChange('add')
}

function removeWishlistProductReferences(product) {
  const removals = new Set(
    [product?.slug, product?.productCode]
      .map(normalizeWishlistReference)
      .filter(Boolean),
  )

  wishlistProductReferences = wishlistProductReferences.filter((reference) => !removals.has(reference))
  wishlistLoaded = true
  dispatchWishlistChange('remove')
}

async function requestWishlistJson(path = '', options = {}) {
  const { response, payload, data } = await fetchAuthJson(`/wishlist${path}`, {
    ...options,
    json: true,
  })

  if (!response.ok || data?.e || payload?.e) {
    throw new WishlistRequestError(
      data?.e || payload?.e || 'Wishlist request failed',
      response.status,
      data,
    )
  }

  return data
}

async function resolveWishlistProduct(productReference) {
  const product = await findProductByReference(productReference)

  if (!product?.id) {
    throw new WishlistRequestError('Product could not be found.', 404)
  }

  return product
}

export async function fetchWishlistItems() {
  const scope = getWishlistScope()

  if (!scope) {
    clearWishlistReferences({ emit: true, type: 'clear' })
    return []
  }

  ensureWishlistScope(scope)

  if (wishlistPromise) {
    return wishlistPromise
  }

  wishlistPromise = requestWishlistJson('', { method: 'GET' })
    .then((data) => setWishlistProductReferences(Array.isArray(data?.wishlist) ? data.wishlist : [], scope))
    .finally(() => {
      wishlistPromise = null
    })

  return wishlistPromise
}

export function getWishlistProductReferences() {
  return wishlistScope === getWishlistScope() ? wishlistProductReferences : []
}

export function hasLoadedWishlist() {
  return wishlistScope === getWishlistScope() && wishlistLoaded
}

export function isWishlistProduct(productReference) {
  const normalizedReference = normalizeWishlistReference(productReference)

  return Boolean(normalizedReference && getWishlistProductReferences().includes(normalizedReference))
}

export async function addProductToWishlist(productReference) {
  const product = await resolveWishlistProduct(productReference)
  const data = await requestWishlistJson('', {
    method: 'POST',
    body: JSON.stringify({ id: product.id }),
  })
  ensureWishlistScope(getWishlistScope())
  addWishlistProductReferences(product)

  return {
    ...data,
    product,
  }
}

export async function removeProductFromWishlist(productReference) {
  const product = await resolveWishlistProduct(productReference)
  const data = await requestWishlistJson(`?id=${encodeURIComponent(product.id)}`, {
    method: 'DELETE',
  })
  ensureWishlistScope(getWishlistScope())
  removeWishlistProductReferences(product)

  return {
    ...data,
    product,
  }
}
