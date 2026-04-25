import { getAuthSession, getAuthStorageMode } from '../../../lib/auth'
import { fetchAuthJson } from '../../../lib/authRequest'
import {
  fetchProductsByIds,
  getProductCategoryLabel,
  getProductFlavorNotes,
  getProductMetaLine,
  getProductTypeLabel,
} from '../../../lib/products'

export const cartStorageKeys = {
  local: 'auroraCartLocal',
  session: 'auroraCartSession',
  serverLocal: 'auroraCartServerLocal',
  serverSession: 'auroraCartServerSession',
}

export const cartChangeEvent = 'aurora-cart-change'

let cachedServerCartItems = []
let cachedServerCartScope = null
let cachedServerCartLoaded = false
let serverCartPromise = null

function getStorage(mode) {
  return mode === 'session' ? window.sessionStorage : window.localStorage
}

function getCurrentCartScope() {
  const session = getAuthSession()

  if (!session?.token) {
    return null
  }

  const scopeSource = session.email?.trim().toLowerCase() || session.token.trim()
  return encodeURIComponent(scopeSource)
}

function parseJson(rawValue, fallback) {
  if (!rawValue) {
    return fallback
  }

  try {
    const parsed = JSON.parse(rawValue)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function parseCartItems(rawValue) {
  const parsed = parseJson(rawValue, [])
  return Array.isArray(parsed) ? parsed : []
}

function parseScopedMap(rawValue) {
  const parsed = parseJson(rawValue, {})
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

function normalizeProductPrice(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const numericPrice = Number.parseFloat(value.replace(/[^0-9.,-]/g, '').replace(',', '.'))
    return Number.isFinite(numericPrice) ? numericPrice : 0
  }

  if (value && typeof value === 'object') {
    return normalizeProductPrice(value.price)
  }

  return 0
}

function normalizeCartOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return null
  }

  const entries = Object.entries(options)
    .map(([key, value]) => {
      const normalizedKey = String(key || '').trim()
      const normalizedValue = String(value ?? '').trim()
      return [normalizedKey, normalizedValue]
    })
    .filter(([key, value]) => Boolean(key && value))
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))

  return entries.length ? Object.fromEntries(entries) : null
}

function normalizeVariantCode(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

function serializeCartOptions(options) {
  const normalizedOptions = normalizeCartOptions(options)
  return normalizedOptions ? JSON.stringify(normalizedOptions) : ''
}

function buildCartVariantKey(productSlug, fallbackId, variantCode, options) {
  const normalizedBase = String(productSlug || fallbackId || '').trim()

  if (!normalizedBase) {
    return ''
  }

  const normalizedVariantCode = normalizeVariantCode(variantCode)
  const serializedOptions = serializeCartOptions(options)
  const segments = []

  if (normalizedVariantCode) {
    segments.push(`var:${normalizedVariantCode}`)
  }

  if (serializedOptions) {
    segments.push(`opt:${serializedOptions}`)
  }

  return segments.length ? `${normalizedBase}::${segments.join('::')}` : normalizedBase
}

function getCartMergeKey(item) {
  return buildCartVariantKey(
    item?.productSlug,
    item?.productId || item?.id,
    item?.variantCode,
    item?.optionCodes ?? item?.options,
  )
}

export function getCartOptionEntries(options) {
  const normalizedOptions = normalizeCartOptions(options)
  return normalizedOptions ? Object.entries(normalizedOptions) : []
}

function getNormalizedOptionLabelKey(key) {
  return formatCartOptionLabel(key).trim().toLowerCase()
}

export function getCartItemOptionEntries(item) {
  const displayOptions = normalizeCartOptions(item?.options)
  const optionCodes = normalizeCartOptions(item?.optionCodes)
  const variantOptions = decodeVariantSelectionCodes(item?.variantCode)

  if (!displayOptions && !optionCodes && !variantOptions) {
    return []
  }

  const seenLabels = new Set()
  const entries = []

  const appendEntries = (source) => {
    for (const [key, value] of Object.entries(source || {})) {
      const normalizedLabelKey = getNormalizedOptionLabelKey(key)

      if (seenLabels.has(normalizedLabelKey)) {
        continue
      }

      seenLabels.add(normalizedLabelKey)
      entries.push([key, value])
    }
  }

  appendEntries(displayOptions)
  if (!displayOptions) {
    appendEntries(optionCodes)
  }
  appendEntries(variantOptions)

  return entries
}

export function formatCartOptionLabel(key) {
  switch (String(key || '').trim().toLowerCase()) {
    case 'filter':
      return 'Filter'
    case 'weight':
      return 'Weight'
    default:
      return String(key || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase())
    }
}

function decodeVariantSelectionCodes(variantCode) {
  const normalizedVariantCode = normalizeVariantCode(variantCode)

  if (!normalizedVariantCode) {
    return null
  }

  try {
    const decoder =
      typeof atob === 'function'
        ? atob
        : typeof window !== 'undefined' && typeof window.atob === 'function'
          ? window.atob.bind(window)
          : null

    if (!decoder) {
      return null
    }

    return normalizeCartOptions(parseJson(decoder(normalizedVariantCode), null))
  } catch {
    return null
  }
}

function normalizeStoredCartItem(item) {
  if (!item || typeof item !== 'object') {
    return null
  }

  const productSlug = typeof item.productSlug === 'string' ? item.productSlug : ''
  const normalizedOptions = normalizeCartOptions(item.options)
  const normalizedOptionCodes = normalizeCartOptions(item.optionCodes)
  const normalizedVariantCode = normalizeVariantCode(item.variantCode)
  const preferredId =
    typeof item.id === 'string' && item.id.trim()
      ? item.id.trim()
      : ''
  const fallbackId = buildCartVariantKey(
    productSlug,
    item.productId || item.id,
    normalizedVariantCode,
    normalizedOptionCodes ?? normalizedOptions,
  )

  if (!preferredId && !fallbackId) {
    return null
  }

  return {
    id: preferredId || fallbackId,
    lineItemId: Number(item.lineItemId) || null,
    productId: Number(item.productId) || null,
    variantId: Number(item.variantId) || null,
    variantCode: normalizedVariantCode,
    productSlug,
    name: item.name || 'Product',
    category: item.category || '',
    parentCategoryName: item.parentCategoryName || '',
    typeLabel: item.typeLabel || '',
    metaLine: item.metaLine || '',
    description: item.description || '',
    notes: Array.isArray(item.notes) ? item.notes : [],
    price: normalizeProductPrice(item.price),
    taxRate:
      item.taxRate === null || item.taxRate === undefined
        ? null
        : normalizeProductPrice(item.taxRate),
    taxClass: typeof item.taxClass === 'string' ? item.taxClass : '',
    taxRateOverride:
      item.taxRateOverride === null || item.taxRateOverride === undefined
        ? null
        : normalizeProductPrice(item.taxRateOverride),
    priceNet:
      item.priceNet === null || item.priceNet === undefined
        ? null
        : normalizeProductPrice(item.priceNet),
    taxAmount:
      item.taxAmount === null || item.taxAmount === undefined
        ? null
        : normalizeProductPrice(item.taxAmount),
    quantity: Math.max(1, Math.floor(item.quantity) || 1),
    imageUrl: item.imageUrl || '',
    options: normalizedOptions,
    optionCodes: normalizedOptionCodes,
  }
}

function readGuestCartItems(mode) {
  return parseCartItems(getStorage(mode).getItem(cartStorageKeys[mode]))
    .map(normalizeStoredCartItem)
    .filter(Boolean)
}

function writeGuestCartItems(mode, items) {
  const storage = getStorage(mode)

  if (!items.length) {
    storage.removeItem(cartStorageKeys[mode])
    return
  }

  storage.setItem(cartStorageKeys[mode], JSON.stringify(items))
}

function readServerCartSnapshot(mode, scope) {
  if (!scope) {
    return []
  }

  const scopedMap = parseScopedMap(getStorage(mode).getItem(cartStorageKeys[mode === 'session' ? 'serverSession' : 'serverLocal']))
  const items = scopedMap[scope]
  return Array.isArray(items) ? items.map(normalizeStoredCartItem).filter(Boolean) : []
}

function writeServerCartSnapshot(mode, scope, items) {
  if (!scope) {
    return
  }

  const storage = getStorage(mode)
  const key = cartStorageKeys[mode === 'session' ? 'serverSession' : 'serverLocal']
  const scopedMap = parseScopedMap(storage.getItem(key))

  if (items.length) {
    scopedMap[scope] = items
  } else {
    delete scopedMap[scope]
  }

  const entries = Object.entries(scopedMap).filter(([, value]) => Array.isArray(value) && value.length)

  if (!entries.length) {
    storage.removeItem(key)
    return
  }

  storage.setItem(key, JSON.stringify(Object.fromEntries(entries)))
}

function mergeCartItems(...itemGroups) {
  const merged = new Map()

  for (const item of itemGroups.flat()) {
    const key = getCartMergeKey(item)

    if (!key) {
      continue
    }

    const existing = merged.get(key)

    if (existing) {
      existing.quantity += item.quantity
      continue
    }

    merged.set(key, {
      ...item,
      id: key,
      lineItemId: null,
    })
  }

  return Array.from(merged.values())
}

class CartRequestError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'CartRequestError'
    this.status = status
  }
}

function isExpiredAuthCartError(error) {
  return error?.status === 401 && !getAuthSession()?.token
}

function persistGuestCartItems(items) {
  const nextItems = items.map(normalizeStoredCartItem).filter(Boolean)
  writeGuestCartItems(getCartStorageMode(), nextItems)
  writeGuestCartItems('session', [])
  clearServerCartCache()
  dispatchCartChange()
  return nextItems
}

function addGuestCartProduct(product, quantity) {
  const normalizedOptions = normalizeCartOptions(product.options)
  const normalizedOptionCodes = normalizeCartOptions(product.optionCodes)
  const normalizedVariantCode = normalizeVariantCode(product.variantCode)
  const storageMode = getCartStorageMode()
  const existingItems = readGuestCartItems(storageMode)
  const nextItemKey = buildCartVariantKey(
    product.slug,
    product.id,
    normalizedVariantCode,
    normalizedOptionCodes ?? normalizedOptions,
  )
  const existingItem = existingItems.find((item) => getCartMergeKey(item) === nextItemKey)

  const nextItems = existingItem
    ? existingItems.map((item) =>
        getCartMergeKey(item) === nextItemKey
          ? { ...item, quantity: item.quantity + quantity }
          : item,
      )
    : [...existingItems, buildCartItem(product, quantity, normalizedOptions)]

  writeGuestCartItems(storageMode, nextItems)
  dispatchCartChange()
  return nextItems
}

function updateGuestCartItemQuantity(productId, quantity, items = null) {
  const currentItems = items || readGuestCartItems(getCartStorageMode())
  const nextItems = currentItems
    .map(normalizeStoredCartItem)
    .filter(Boolean)
    .map((item) => (isCartItemIdentity(item, productId) ? { ...item, quantity } : item))
    .filter((item) => item.quantity > 0)

  return persistGuestCartItems(nextItems)
}

function isCartItemIdentity(item, productId) {
  return (
    item?.id === productId ||
    (item?.lineItemId && String(item.lineItemId) === String(productId))
  )
}

function removeGuestCartItem(productId, items = null) {
  const currentItems = items || readGuestCartItems(getCartStorageMode())
  const nextItems = currentItems
    .map(normalizeStoredCartItem)
    .filter(Boolean)
    .filter((item) => !isCartItemIdentity(item, productId))

  return persistGuestCartItems(nextItems)
}

function buildCartItem(product, quantity = 1, options = null) {
  const normalizedOptions = normalizeCartOptions(options)
  const normalizedOptionCodes = normalizeCartOptions(product.optionCodes)
  const normalizedVariantCode = normalizeVariantCode(product.variantCode)

  return {
    id: buildCartVariantKey(
      product.slug,
      product.id,
      normalizedVariantCode,
      normalizedOptionCodes ?? normalizedOptions,
    ),
    lineItemId: null,
    productId: product.id,
    variantId: Number(product.variantId) || null,
    variantCode: normalizedVariantCode,
    productSlug: product.slug,
    name: product.name,
    category: getProductCategoryLabel(product),
    parentCategoryName: product.parentCategoryName || '',
    typeLabel: getProductTypeLabel(product),
    metaLine: getProductMetaLine(product),
    description: product.description,
    notes: getProductFlavorNotes(product),
    price: normalizeProductPrice(product.price),
    taxRate: product.taxRate ?? null,
    taxClass: product.taxClass || '',
    taxRateOverride: product.taxRateOverride ?? null,
    priceNet: product.priceNet ?? null,
    taxAmount: product.taxAmount ?? null,
    quantity: Math.max(1, Math.floor(quantity) || 1),
    imageUrl: product.imageUrl || '',
    options: normalizedOptions,
    optionCodes: normalizedOptionCodes,
  }
}

function findMatchingProductOptionGroup(product, key) {
  const normalizedKey = String(key || '').trim().toLowerCase()
  const optionGroups = Array.isArray(product?.options) ? product.options : []

  return optionGroups.find((group) => {
    const candidates = [group?.code, group?.id, group?.name]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)

    return candidates.includes(normalizedKey)
  }) || null
}

function filterOptionCodesForPayload(product, options) {
  const normalizedOptions = normalizeCartOptions(options)

  if (!normalizedOptions) {
    return null
  }

  const entries = Object.entries(normalizedOptions).filter(([groupKey]) => {
    const group = findMatchingProductOptionGroup(product, groupKey)
    return !group?.storeAsVariant
  })

  return entries.length ? Object.fromEntries(entries) : null
}

function getVariantSelectionCodes(product, variantCode) {
  const normalizedVariantCode = normalizeVariantCode(variantCode)

  if (!normalizedVariantCode) {
    return null
  }

  const matchingVariant =
    product?.variants?.find(
      (entry) => normalizeVariantCode(entry?.variantCode) === normalizedVariantCode,
    ) || null

  return (
    normalizeCartOptions(matchingVariant?.optionValueCodes) ||
    decodeVariantSelectionCodes(normalizedVariantCode)
  )
}

function mapCartOptionsForDisplay(product, options, variantCode = '') {
  const normalizedOptions = normalizeCartOptions(options)
  const variantOptions = getVariantSelectionCodes(product, variantCode)

  if (!normalizedOptions && !variantOptions) {
    return null
  }

  const entries = []

  for (const [groupCode, valueCode] of Object.entries(normalizedOptions || {})) {
    const group = findMatchingProductOptionGroup(product, groupCode)
    const value = (group?.values || []).find(
      (optionValue) => String(optionValue?.valueCode || '').trim() === String(valueCode || '').trim(),
    )

    entries.push([group?.name || groupCode, value?.label || valueCode])
  }

  for (const [groupCode, valueCode] of Object.entries(variantOptions || {})) {
    const group = findMatchingProductOptionGroup(product, groupCode)

    if (!group?.storeAsVariant) {
      continue
    }

    const value = (group?.values || []).find(
      (optionValue) => String(optionValue?.valueCode || '').trim() === String(valueCode || '').trim(),
    )

    entries.push([group?.name || groupCode, value?.label || valueCode])
  }

  return entries.length ? Object.fromEntries(entries) : null
}

function mapCartOptionsForPayload(product, options) {
  const normalizedOptions = normalizeCartOptions(options)

  if (!normalizedOptions) {
    return null
  }

  return Object.fromEntries(
    Object.entries(normalizedOptions).map(([groupKey, valueKey]) => {
      const group = findMatchingProductOptionGroup(product, groupKey)
      const normalizedValueKey = String(valueKey || '').trim().toLowerCase()
      const value = (group?.values || []).find((optionValue) => {
        const candidates = [optionValue?.valueCode, optionValue?.id, optionValue?.label]
          .map((candidate) => String(candidate || '').trim().toLowerCase())
          .filter(Boolean)

        return candidates.includes(normalizedValueKey)
      })

      return [group?.code || groupKey, value?.valueCode || valueKey]
    }),
  )
}

function dispatchCartChange() {
  window.dispatchEvent(new Event(cartChangeEvent))
}

async function requestCartJson(path, options = {}) {
  const { response, payload, data } = await fetchAuthJson(path, {
    ...options,
    json: true,
  })

  if (!response.ok || data?.e || payload?.e) {
    throw new CartRequestError(data?.e || payload?.e || 'Cart request failed', response.status)
  }

  return data
}

function getPersistedServerCartItems() {
  const authStorageMode = getAuthStorageMode()
  const scope = getCurrentCartScope()

  if (!authStorageMode || !scope) {
    return []
  }

  return readServerCartSnapshot(authStorageMode, scope)
}

function clearServerCartCache() {
  cachedServerCartItems = []
  cachedServerCartScope = null
  cachedServerCartLoaded = false
  serverCartPromise = null
}

function ensureServerCartScope(scope) {
  if (cachedServerCartScope === scope) {
    return
  }

  cachedServerCartItems = []
  cachedServerCartScope = scope
  cachedServerCartLoaded = false
  serverCartPromise = null
}

function persistServerCartItems(items) {
  const authStorageMode = getAuthStorageMode()
  const scope = getCurrentCartScope()

  if (!authStorageMode || !scope) {
    cachedServerCartItems = items
    cachedServerCartLoaded = false
    cachedServerCartScope = null
    return items
  }

  cachedServerCartScope = scope
  cachedServerCartItems = items
  cachedServerCartLoaded = true
  writeServerCartSnapshot(authStorageMode, scope, items)
  return items
}

async function hydrateServerCartRows(rows) {
  const cartRows = Array.isArray(rows) ? rows : []
  const productIds = Array.from(
    new Set(
      cartRows
        .map((row) => Number(row.product_id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  )
  const products = productIds.length ? await fetchProductsByIds(productIds) : []
  const productsById = new Map(products.map((product) => [product.id, product]))

  return cartRows.map((row) => {
    const product = productsById.get(Number(row.product_id))
    const variant =
      product?.variants?.find((entry) => Number(entry.id) === Number(row.variant_id)) || null
    const rawOptions =
      typeof row.options === 'string'
        ? parseJson(row.options, null)
        : row.options
    const parsedOptions = normalizeCartOptions(rawOptions)

    return normalizeStoredCartItem({
      id: `cart-${row.id}`,
      lineItemId: Number(row.id) || null,
      productId: Number(row.product_id) || product?.id || null,
      variantId: Number(row.variant_id) || null,
      variantCode: variant?.variantCode || row.variant_code || '',
      productSlug: product?.slug || '',
      name: product?.name || row.product_name || 'Product',
      category: product ? getProductCategoryLabel(product) : '',
      parentCategoryName: product?.parentCategoryName || '',
      typeLabel: product ? getProductTypeLabel(product) : '',
      metaLine: product ? getProductMetaLine(product) : '',
      description: product?.description || '',
      notes: product ? getProductFlavorNotes(product) : [],
      price: normalizeProductPrice(variant?.price ?? product?.price ?? row.product_price),
      taxRate: product?.taxRate ?? null,
      taxClass: product?.taxClass || '',
      taxRateOverride: product?.taxRateOverride ?? null,
      priceNet: product?.priceNet ?? null,
      taxAmount: product?.taxAmount ?? null,
      quantity: Math.max(1, Math.floor(row.quantity) || 1),
      imageUrl: product?.imageUrl || row.image_url || '',
      options: mapCartOptionsForDisplay(product, parsedOptions, variant?.variantCode || row.variant_code || '') ?? parsedOptions,
      optionCodes: parsedOptions,
    })
  }).filter(Boolean)
}

async function fetchServerCart({ force = false } = {}) {
  const scope = getCurrentCartScope()

  if (!scope) {
    clearServerCartCache()
    return []
  }

  ensureServerCartScope(scope)

  if (!force && cachedServerCartLoaded) {
    return cachedServerCartItems
  }

  if (serverCartPromise && !force) {
    return serverCartPromise
  }

  serverCartPromise = (async () => {
    const payload = await requestCartJson('/cart', { method: 'GET' })
    const hydratedItems = await hydrateServerCartRows(payload?.cart || [])
    return persistServerCartItems(hydratedItems)
  })()

  try {
    return await serverCartPromise
  } finally {
    serverCartPromise = null
  }
}

async function mergeGuestCartIntoServer(items) {
  const productIds = Array.from(
    new Set(
      (items || [])
        .map((item) => Number(item?.productId))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  )
  const products = productIds.length ? await fetchProductsByIds(productIds).catch(() => []) : []
  const productsById = new Map(products.map((product) => [product.id, product]))

  for (const item of items) {
    if (!item?.productId) {
      continue
    }

    const product = productsById.get(Number(item.productId))
    const optionCodes = filterOptionCodesForPayload(
      product,
      normalizeCartOptions(item.optionCodes) || mapCartOptionsForPayload(product, item.options),
    )
    const variantCode =
      normalizeVariantCode(item.variantCode) ||
      product?.variants?.find((variant) => Number(variant.id) === Number(item.variantId))?.variantCode ||
      ''

    const payload = {
      id: item.productId,
      qty: item.quantity,
    }

    if (optionCodes) {
      payload.opt = optionCodes
    }

    if (variantCode) {
      payload.var = variantCode
    }

    await requestCartJson('/cart', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }
}

export function getCartStorageMode() {
  return getAuthStorageMode() || 'local'
}

export async function reconcileCartStorageWithAuth() {
  const session = getAuthSession()
  const authStorageMode = getAuthStorageMode()
  const localItems = readGuestCartItems('local')
  const sessionItems = readGuestCartItems('session')

  if (session?.token && authStorageMode) {
    ensureServerCartScope(getCurrentCartScope())
    const guestItems = mergeCartItems(localItems, sessionItems)
    const persistedItems = getPersistedServerCartItems()

    try {
      if (guestItems.length) {
        await mergeGuestCartIntoServer(guestItems)
        writeGuestCartItems('local', [])
        writeGuestCartItems('session', [])

        const serverItems = await fetchServerCart({ force: true })
        dispatchCartChange()
        return serverItems
      }

      if (cachedServerCartLoaded) {
        return cachedServerCartItems
      }

      if (persistedItems.length) {
        cachedServerCartItems = persistedItems
        cachedServerCartScope = getCurrentCartScope()
      }

      const serverItems = await fetchServerCart()
      dispatchCartChange()
      return serverItems
    } catch (error) {
      if (!isExpiredAuthCartError(error)) {
        throw error
      }

      return persistGuestCartItems(mergeCartItems(localItems, sessionItems, persistedItems))
    }
  }

  clearServerCartCache()

  if (sessionItems.length) {
    return persistGuestCartItems(mergeCartItems(localItems, sessionItems))
  }

  return localItems
}

export function getCartItems() {
  const session = getAuthSession()

  if (session?.token) {
    const scope = getCurrentCartScope()
    ensureServerCartScope(scope)

    if (cachedServerCartLoaded) {
      return cachedServerCartItems
    }

    cachedServerCartItems = getPersistedServerCartItems()
    return cachedServerCartItems
  }

  const storageMode = getCartStorageMode()
  return readGuestCartItems(storageMode)
}

export function getCartCount() {
  return getCartItems().reduce((count, item) => count + item.quantity, 0)
}

export function getCartSubtotal() {
  return getCartItems().reduce((total, item) => total + item.price * item.quantity, 0)
}

export async function enrichCartItems(items) {
  const normalizedItems = Array.isArray(items) ? items.map(normalizeStoredCartItem).filter(Boolean) : []
  const productIds = Array.from(
    new Set(
      normalizedItems
        .map((item) => Number(item?.productId))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  )

  if (!productIds.length) {
    return normalizedItems
  }

  const products = await fetchProductsByIds(productIds).catch(() => [])
  const productsById = new Map(products.map((product) => [product.id, product]))

  return normalizedItems.map((item) => {
    const product = productsById.get(Number(item.productId))
    const optionCodes =
      normalizeCartOptions(item.optionCodes) ||
      filterOptionCodesForPayload(product, mapCartOptionsForPayload(product, item.options))
    const variantCode =
      normalizeVariantCode(item.variantCode) ||
      product?.variants?.find((variant) => Number(variant.id) === Number(item.variantId))?.variantCode ||
      ''
    const displayOptions =
      mapCartOptionsForDisplay(product, optionCodes, variantCode) ||
      normalizeCartOptions(item.options)

    return normalizeStoredCartItem({
      ...item,
      optionCodes,
      variantCode,
      options: displayOptions,
    })
  }).filter(Boolean)
}

export async function buildCheckoutCartPayload(items) {
  const normalizedItems = (items || []).filter(
    (item) => Number.isFinite(Number(item?.productId)) && Number(item.productId) > 0,
  )
  const productIds = Array.from(
    new Set(normalizedItems.map((item) => Number(item.productId))),
  )
  const products = productIds.length ? await fetchProductsByIds(productIds).catch(() => []) : []
  const productsById = new Map(products.map((product) => [product.id, product]))

  return normalizedItems.map((item) => {
    const product = productsById.get(Number(item.productId))
    const normalizedOptionCodes = normalizeCartOptions(item.optionCodes)
    const normalizedOptions = normalizeCartOptions(item.options)
    const payloadOptionCodes = filterOptionCodesForPayload(
      product,
      normalizedOptionCodes || mapCartOptionsForPayload(product, normalizedOptions),
    )
    const payloadVariantCode =
      normalizeVariantCode(item.variantCode) ||
      product?.variants?.find((variant) => Number(variant.id) === Number(item.variantId))?.variantCode ||
      ''

    const payload = {
      id: Number(item.productId),
      qty: Math.max(1, Math.floor(item.quantity) || 1),
      opt: payloadOptionCodes || {},
    }

    if (payloadVariantCode) {
      payload.var = payloadVariantCode
    }

    return payload
  })
}

export async function addCartItem(product, quantity = 1) {
  return addCartProduct(product, quantity)
}

export async function addCartProduct(product, quantity = 1) {
  if (!product?.slug) {
    return getCartItems()
  }

  const nextQuantity = Math.max(1, Math.floor(quantity) || 1)
  const normalizedOptions = normalizeCartOptions(product.options)
  const normalizedOptionCodes = normalizeCartOptions(product.optionCodes)
  const normalizedVariantCode = normalizeVariantCode(product.variantCode)
  const session = getAuthSession()

  if (session?.token) {
    let payloadOptionCodes = normalizedOptionCodes
    let payloadVariantCode = normalizedVariantCode

    if ((!payloadOptionCodes && normalizedOptions) || (!payloadVariantCode && product.variantId)) {
      const [resolvedProduct] = await fetchProductsByIds([product.id]).catch(() => [])

      if (resolvedProduct) {
        payloadOptionCodes =
          payloadOptionCodes ||
          filterOptionCodesForPayload(
            resolvedProduct,
            mapCartOptionsForPayload(resolvedProduct, normalizedOptions),
          )
        payloadVariantCode =
          payloadVariantCode ||
          resolvedProduct.variants?.find((variant) => Number(variant.id) === Number(product.variantId))?.variantCode ||
          ''
      }
    }

    const payload = {
      id: product.id,
      qty: nextQuantity,
    }

    if (payloadOptionCodes) {
      payload.opt = payloadOptionCodes
    }

    if (payloadVariantCode) {
      payload.var = payloadVariantCode
    }

    try {
      await requestCartJson('/cart', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const serverItems = await fetchServerCart({ force: true })
      dispatchCartChange()
      return serverItems
    } catch (error) {
      if (!isExpiredAuthCartError(error)) {
        throw error
      }

      return addGuestCartProduct(product, nextQuantity)
    }
  }

  return addGuestCartProduct(product, nextQuantity)
}

export async function addCartVariants(entries) {
  let nextItems = getCartItems()

  for (const entry of entries || []) {
    if (!entry?.product?.slug) {
      continue
    }

    nextItems = await addCartItem(
      {
        ...entry.product,
        ...(entry.options ? { options: entry.options } : {}),
        ...(entry.optionCodes ? { optionCodes: entry.optionCodes } : {}),
        ...(entry.variantId ? { variantId: entry.variantId } : {}),
        ...(entry.variantCode ? { variantCode: entry.variantCode } : {}),
      },
      entry.quantity,
    )
  }

  return nextItems
}

export async function updateCartItemQuantity(productId, nextQuantity) {
  const session = getAuthSession()
  const sanitizedQuantity = Math.max(0, Math.floor(nextQuantity))

  if (session?.token) {
    const currentItems = getCartItems()
    const targetItem = currentItems.find((item) => isCartItemIdentity(item, productId))

    if (!targetItem?.lineItemId) {
      return currentItems
    }

    if (sanitizedQuantity <= 0) {
      return removeCartItem(productId)
    }

    try {
      await requestCartJson('/cart', {
        method: 'PATCH',
        body: JSON.stringify({
          id: targetItem.lineItemId,
          qty: sanitizedQuantity,
          ...(targetItem.optionCodes ? { opt: targetItem.optionCodes } : {}),
          ...(targetItem.variantCode ? { var: targetItem.variantCode } : {}),
        }),
      })

      const serverItems = await fetchServerCart({ force: true })
      dispatchCartChange()
      return serverItems
    } catch (error) {
      if (!isExpiredAuthCartError(error)) {
        throw error
      }

      return updateGuestCartItemQuantity(productId, sanitizedQuantity, currentItems)
    }
  }

  return updateGuestCartItemQuantity(productId, sanitizedQuantity)
}

export async function removeCartItem(productId) {
  const session = getAuthSession()

  if (session?.token) {
    const currentItems = getCartItems()
    const targetItem = currentItems.find((item) => isCartItemIdentity(item, productId))

    if (!targetItem?.lineItemId) {
      return currentItems
    }

    try {
      await requestCartJson(`/cart?id=${encodeURIComponent(targetItem.lineItemId)}`, {
        method: 'DELETE',
      })

      const serverItems = await fetchServerCart({ force: true })
      dispatchCartChange()
      return serverItems
    } catch (error) {
      if (!isExpiredAuthCartError(error)) {
        throw error
      }

      return removeGuestCartItem(productId, currentItems)
    }
  }

  return removeGuestCartItem(productId)
}

export async function clearCart() {
  const session = getAuthSession()

  if (session?.token) {
    try {
      await requestCartJson('/cart?clear=true', {
        method: 'DELETE',
      })
      const nextItems = persistServerCartItems([])
      dispatchCartChange()
      return nextItems
    } catch (error) {
      if (!isExpiredAuthCartError(error)) {
        throw error
      }

      return persistGuestCartItems([])
    }
  }

  return persistGuestCartItems([])
}
