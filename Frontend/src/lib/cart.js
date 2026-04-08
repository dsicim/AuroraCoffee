import { buildApiUrl } from './api'
import { getAuthSession, getAuthStorageMode } from './auth'
import {
  fetchProductsByIds,
  getProductCategoryLabel,
  getProductFlavorNotes,
  getProductMetaLine,
  getProductTypeLabel,
} from './products'

export const cartStorageKeys = {
  local: 'auroraCartLocal',
  session: 'auroraCartSession',
  serverLocal: 'auroraCartServerLocal',
  serverSession: 'auroraCartServerSession',
}

export const cartChangeEvent = 'aurora-cart-change'

let cachedServerCartItems = []

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

function normalizeStoredCartItem(item) {
  if (!item || typeof item !== 'object') {
    return null
  }

  const productSlug = typeof item.productSlug === 'string' ? item.productSlug : ''
  const fallbackId = productSlug || String(item.id || '')

  if (!fallbackId) {
    return null
  }

  return {
    id: fallbackId,
    lineItemId: Number(item.lineItemId) || null,
    productId: Number(item.productId) || null,
    productSlug,
    name: item.name || 'Product',
    category: item.category || '',
    typeLabel: item.typeLabel || '',
    metaLine: item.metaLine || '',
    description: item.description || '',
    notes: Array.isArray(item.notes) ? item.notes : [],
    price: normalizeProductPrice(item.price),
    quantity: Math.max(1, Math.floor(item.quantity) || 1),
    imageUrl: item.imageUrl || '',
    options: item.options && typeof item.options === 'object' ? item.options : null,
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

function mergeCartItems(baseItems, incomingItems) {
  const merged = new Map()

  for (const item of [...baseItems, ...incomingItems]) {
    const key = item.productSlug || item.id

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

function buildCartItem(product, quantity = 1) {
  return {
    id: product.slug,
    lineItemId: null,
    productId: product.id,
    productSlug: product.slug,
    name: product.name,
    category: getProductCategoryLabel(product),
    typeLabel: getProductTypeLabel(product),
    metaLine: getProductMetaLine(product),
    description: product.description,
    notes: getProductFlavorNotes(product),
    price: normalizeProductPrice(product.price),
    quantity: Math.max(1, Math.floor(quantity) || 1),
    imageUrl: product.imageUrl || '',
    options: null,
  }
}

function dispatchCartChange() {
  window.dispatchEvent(new Event(cartChangeEvent))
}

function getAuthorizationHeaders() {
  const session = getAuthSession()

  return session?.token
    ? {
        authorization: session.token,
      }
    : {}
}

async function requestCartJson(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthorizationHeaders(),
      ...(options.headers || {}),
    },
  })

  const payload = await response.json().catch(() => ({}))
  const data = payload?.d ?? payload

  if (!response.ok || data?.e || payload?.e) {
    throw new Error(data?.e || payload?.e || 'Cart request failed')
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

function persistServerCartItems(items) {
  const authStorageMode = getAuthStorageMode()
  const scope = getCurrentCartScope()

  if (!authStorageMode || !scope) {
    cachedServerCartItems = items
    return items
  }

  cachedServerCartItems = items
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
    const parsedOptions = parseJson(row.options, null)

    return normalizeStoredCartItem({
      id: `cart-${row.id}`,
      lineItemId: Number(row.id) || null,
      productId: Number(row.product_id) || product?.id || null,
      productSlug: product?.slug || '',
      name: product?.name || row.product_name || 'Product',
      category: product ? getProductCategoryLabel(product) : '',
      typeLabel: product ? getProductTypeLabel(product) : '',
      metaLine: product ? getProductMetaLine(product) : '',
      description: product?.description || '',
      notes: product ? getProductFlavorNotes(product) : [],
      price: normalizeProductPrice(product?.price ?? row.product_price),
      quantity: Math.max(1, Math.floor(row.quantity) || 1),
      imageUrl: product?.imageUrl || row.image_url || '',
      options: parsedOptions,
    })
  }).filter(Boolean)
}

async function fetchServerCart() {
  const payload = await requestCartJson('/cart', { method: 'GET' })
  const hydratedItems = await hydrateServerCartRows(payload?.cart || [])
  return persistServerCartItems(hydratedItems)
}

async function mergeGuestCartIntoServer(items) {
  for (const item of items) {
    if (!item?.productId) {
      continue
    }

    const payload = {
      id: item.productId,
      qty: item.quantity,
    }

    if (item.options) {
      payload.opt = item.options
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
    const guestItems = mergeCartItems(localItems, sessionItems)

    if (guestItems.length) {
      try {
        await mergeGuestCartIntoServer(guestItems)
      } finally {
        writeGuestCartItems('local', [])
        writeGuestCartItems('session', [])
      }
    }

    const serverItems = await fetchServerCart()
    dispatchCartChange()
    return serverItems
  }

  if (sessionItems.length) {
    const mergedItems = mergeCartItems(localItems, sessionItems)
    writeGuestCartItems('local', mergedItems)
    writeGuestCartItems('session', [])
    dispatchCartChange()
    return mergedItems
  }

  return localItems
}

export function getCartItems() {
  const session = getAuthSession()

  if (session?.token) {
    if (cachedServerCartItems.length) {
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

export async function addCartItem(product, quantity = 1) {
  return addCartProduct(product, quantity)
}

export async function addCartProduct(product, quantity = 1) {
  if (!product?.slug) {
    return getCartItems()
  }

  const nextQuantity = Math.max(1, Math.floor(quantity) || 1)
  const session = getAuthSession()

  if (session?.token) {
    const payload = {
      id: product.id,
      qty: nextQuantity,
    }

    if (product.options) {
      payload.opt = product.options
    }

    await requestCartJson('/cart', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const serverItems = await fetchServerCart()
    dispatchCartChange()
    return serverItems
  }

  const storageMode = getCartStorageMode()
  const existingItems = readGuestCartItems(storageMode)
  const existingItem = existingItems.find((item) => item.id === product.slug)

  const nextItems = existingItem
    ? existingItems.map((item) =>
        item.id === product.slug
          ? { ...item, quantity: item.quantity + nextQuantity }
          : item,
      )
    : [...existingItems, buildCartItem(product, nextQuantity)]

  writeGuestCartItems(storageMode, nextItems)
  dispatchCartChange()
  return nextItems
}

export async function addCartVariants(entries) {
  let nextItems = getCartItems()

  for (const entry of entries || []) {
    if (!entry?.product?.slug) {
      continue
    }

    nextItems = await addCartItem(entry.product, entry.quantity)
  }

  return nextItems
}

export async function updateCartItemQuantity(productId, nextQuantity) {
  const session = getAuthSession()
  const sanitizedQuantity = Math.max(0, Math.floor(nextQuantity))

  if (session?.token) {
    const currentItems = getCartItems()
    const targetItem = currentItems.find((item) => item.id === productId || String(item.lineItemId) === String(productId))

    if (!targetItem?.lineItemId) {
      return currentItems
    }

    if (sanitizedQuantity <= 0) {
      return removeCartItem(productId)
    }

    await requestCartJson('/cart', {
      method: 'PATCH',
      body: JSON.stringify({
        id: targetItem.lineItemId,
        qty: sanitizedQuantity,
      }),
    })

    const serverItems = await fetchServerCart()
    dispatchCartChange()
    return serverItems
  }

  const storageMode = getCartStorageMode()
  const existingItems = readGuestCartItems(storageMode)
  const nextItems = existingItems
    .map((item) =>
      item.id === productId ? { ...item, quantity: sanitizedQuantity } : item,
    )
    .filter((item) => item.quantity > 0)

  writeGuestCartItems(storageMode, nextItems)
  dispatchCartChange()
  return nextItems
}

export async function removeCartItem(productId) {
  const session = getAuthSession()

  if (session?.token) {
    const currentItems = getCartItems()
    const targetItem = currentItems.find((item) => item.id === productId || String(item.lineItemId) === String(productId))

    if (!targetItem?.lineItemId) {
      return currentItems
    }

    await requestCartJson(`/cart?id=${encodeURIComponent(targetItem.lineItemId)}`, {
      method: 'DELETE',
    })

    const serverItems = await fetchServerCart()
    dispatchCartChange()
    return serverItems
  }

  const storageMode = getCartStorageMode()
  const nextItems = readGuestCartItems(storageMode).filter((item) => item.id !== productId)
  writeGuestCartItems(storageMode, nextItems)
  dispatchCartChange()
  return nextItems
}

export async function clearCart() {
  const session = getAuthSession()

  if (session?.token) {
    await requestCartJson('/cart?clear=true', {
      method: 'DELETE',
    })
    const nextItems = persistServerCartItems([])
    dispatchCartChange()
    return nextItems
  }

  const storageMode = getCartStorageMode()
  writeGuestCartItems(storageMode, [])
  dispatchCartChange()
  return []
}
