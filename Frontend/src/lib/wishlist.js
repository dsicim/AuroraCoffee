import { getAuthSession } from './auth'
import { fetchAuthJson, fetchAuthResponse, readJsonResponse } from './authRequest'
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

function hasPositiveWishlistFlag(value) {
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

function normalizeNotifyItems(items) {
  return Array.isArray(items) ? items : []
}

export async function fetchWishlistNotifyQueue() {
  const data = await requestWishlistJson('/notify', { method: 'GET' })

  return {
    discount: normalizeNotifyItems(data?.discount),
    stock: normalizeNotifyItems(data?.stock),
  }
}

export async function sendWishlistNotifications(type) {
  const normalizedType = String(type || '').trim().toLowerCase()

  if (!['discount', 'stock'].includes(normalizedType)) {
    throw new WishlistRequestError('Choose discount or stock notifications before sending.', 400)
  }

  const response = await fetchAuthResponse('/wishlist/notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'text/event-stream, text/plain, application/json',
    },
    body: JSON.stringify({ type: normalizedType }),
  })
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const { payload, data } = await readJsonResponse(response)

    if (!response.ok || data?.e || payload?.e) {
      throw new WishlistRequestError(
        data?.e || payload?.e || 'Wishlist notification request failed',
        response.status,
        data,
      )
    }

    return {
      type: normalizedType,
      log: data?.msg || payload?.msg || 'Wishlist notifications sent.',
    }
  }

  const log = await response.text()

  if (!response.ok) {
    throw new WishlistRequestError(
      log.trim() || 'Wishlist notification request failed',
      response.status,
      log,
    )
  }

  return {
    type: normalizedType,
    log: log.trim() || 'Wishlist notifications sent.',
  }
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

export function getWishlistedProductReferences(products) {
  return Array.from(
    new Set(
      (products || [])
        .filter((product) =>
          hasPositiveWishlistFlag(product?.isWishlisted ?? product?.is_wishlisted),
        )
        .flatMap((product) => [
          product?.slug,
          product?.productCode,
          product?.product_code,
        ])
        .map(normalizeWishlistReference)
        .filter(Boolean),
    ),
  )
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
