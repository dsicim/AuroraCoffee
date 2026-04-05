import { getAuthStorageMode } from './auth'
import {
  getProductCategoryLabel,
  getProductFlavorNotes,
  getProductMetaLine,
  getProductTypeLabel,
} from './products'

export const cartStorageKeys = {
  local: 'auroraCartLocal',
  session: 'auroraCartSession',
}

export const cartChangeEvent = 'aurora-cart-change'

function getStorage(mode) {
  return mode === 'session' ? window.sessionStorage : window.localStorage
}

function parseCartItems(rawValue) {
  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeStoredCartItem(item) {
  if (!item || typeof item !== 'object') {
    return null
  }

  const productSlug = typeof item.productSlug === 'string' ? item.productSlug : ''

  if (!productSlug) {
    return null
  }

  return {
    id: productSlug,
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
  }
}

function readCartItems(mode) {
  return parseCartItems(getStorage(mode).getItem(cartStorageKeys[mode]))
    .map(normalizeStoredCartItem)
    .filter(Boolean)
}

function writeCartItems(mode, items) {
  const storage = getStorage(mode)

  if (!items.length) {
    storage.removeItem(cartStorageKeys[mode])
    return
  }

  storage.setItem(cartStorageKeys[mode], JSON.stringify(items))
}

function mergeCartItems(baseItems, incomingItems) {
  const merged = new Map()

  for (const item of [...baseItems, ...incomingItems]) {
    const existing = merged.get(item.id)

    if (existing) {
      existing.quantity += item.quantity
      continue
    }

    merged.set(item.id, { ...item })
  }

  return Array.from(merged.values())
}

function normalizeProductPrice(value) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const numericPrice = Number(value.replace(/[^0-9.]/g, ''))
    return Number.isFinite(numericPrice) ? numericPrice : 0
  }

  if (value && typeof value === 'object') {
    return normalizeProductPrice(value.price)
  }

  return 0
}

function buildCartItem(product, quantity = 1) {
  return {
    id: product.slug,
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
  }
}

function dispatchCartChange() {
  window.dispatchEvent(new Event(cartChangeEvent))
}

export function getCartStorageMode() {
  return getAuthStorageMode() || 'local'
}

export function reconcileCartStorageWithAuth() {
  const authStorageMode = getAuthStorageMode()
  const localItems = readCartItems('local')
  const sessionItems = readCartItems('session')

  if (authStorageMode === 'session') {
    const mergedItems = mergeCartItems(sessionItems, localItems)
    writeCartItems('session', mergedItems)
    writeCartItems('local', [])
    dispatchCartChange()
    return mergedItems
  }

  if (authStorageMode === 'local') {
    const mergedItems = mergeCartItems(localItems, sessionItems)
    writeCartItems('local', mergedItems)
    writeCartItems('session', [])
    dispatchCartChange()
    return mergedItems
  }

  if (sessionItems.length) {
    const mergedItems = mergeCartItems(localItems, sessionItems)
    writeCartItems('local', mergedItems)
    writeCartItems('session', [])
    dispatchCartChange()
    return mergedItems
  }

  return localItems
}

export function getCartItems() {
  const storageMode = getCartStorageMode()
  return readCartItems(storageMode)
}

export function getCartCount() {
  return getCartItems().reduce((count, item) => count + item.quantity, 0)
}

export function getCartSubtotal() {
  return getCartItems().reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  )
}

export function addCartItem(product, quantity = 1) {
  return addCartProduct(product, quantity)
}

export function addCartProduct(product, quantity = 1) {
  if (!product?.slug) {
    return getCartItems()
  }

  const storageMode = getCartStorageMode()
  const existingItems = readCartItems(storageMode)
  const existingItem = existingItems.find((item) => item.id === product.slug)
  const nextQuantity = Math.max(1, Math.floor(quantity) || 1)

  if (existingItem) {
    const nextItems = existingItems.map((item) =>
      item.id === product.slug
        ? { ...item, quantity: item.quantity + nextQuantity }
        : item,
    )

    writeCartItems(storageMode, nextItems)
    dispatchCartChange()
    return nextItems
  }

  const nextItems = [...existingItems, buildCartItem(product, nextQuantity)]
  writeCartItems(storageMode, nextItems)
  dispatchCartChange()
  return nextItems
}

export function addCartVariants(entries) {
  const storageMode = getCartStorageMode()
  const existingItems = readCartItems(storageMode)
  const merged = new Map(existingItems.map((item) => [item.id, { ...item }]))

  for (const entry of entries) {
    if (!entry?.product?.slug) {
      continue
    }

    const quantity = Math.max(1, Math.floor(entry.quantity) || 1)
    const existingItem = merged.get(entry.product.slug)

    if (existingItem) {
      existingItem.quantity += quantity
      continue
    }

    merged.set(
      entry.product.slug,
      buildCartItem(entry.product, quantity),
    )
  }

  const nextItems = Array.from(merged.values())
  writeCartItems(storageMode, nextItems)
  dispatchCartChange()
  return nextItems
}

export function updateCartItemQuantity(productId, nextQuantity) {
  const storageMode = getCartStorageMode()
  const existingItems = readCartItems(storageMode)
  const sanitizedQuantity = Math.max(0, Math.floor(nextQuantity))
  const nextItems = existingItems
    .map((item) =>
      item.id === productId ? { ...item, quantity: sanitizedQuantity } : item,
    )
    .filter((item) => item.quantity > 0)

  writeCartItems(storageMode, nextItems)
  dispatchCartChange()
  return nextItems
}

export function removeCartItem(productId) {
  const storageMode = getCartStorageMode()
  const nextItems = readCartItems(storageMode).filter(
    (item) => item.id !== productId,
  )

  writeCartItems(storageMode, nextItems)
  dispatchCartChange()
  return nextItems
}

export function clearCart() {
  const storageMode = getCartStorageMode()
  writeCartItems(storageMode, [])
  dispatchCartChange()
}
