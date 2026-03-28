import { getAuthStorageMode } from './auth'

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

function readCartItems(mode) {
  return parseCartItems(getStorage(mode).getItem(cartStorageKeys[mode]))
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

function normalizeProductPrice(product) {
  if (typeof product.price === 'number') {
    return product.price
  }

  if (typeof product.price === 'string') {
    const numericPrice = Number(product.price.replace(/[^0-9.]/g, ''))
    return Number.isFinite(numericPrice) ? numericPrice : 0
  }

  return 0
}

function buildCartItem(product, variant) {
  return {
    id: variant.id,
    productId: product.id,
    name: product.name,
    roast: product.roast,
    description: product.description,
    notes: product.notes || [],
    weight: variant.weight,
    grind: variant.grind,
    price: normalizeProductPrice(variant),
    quantity: 1,
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

export function addCartItem(product, variant) {
  const storageMode = getCartStorageMode()
  const existingItems = readCartItems(storageMode)
  const existingItem = existingItems.find((item) => item.id === variant.id)

  if (existingItem) {
    const nextItems = existingItems.map((item) =>
      item.id === variant.id
        ? { ...item, quantity: item.quantity + 1 }
        : item,
    )

    writeCartItems(storageMode, nextItems)
    dispatchCartChange()
    return nextItems
  }

  const nextItems = [...existingItems, buildCartItem(product, variant)]
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
