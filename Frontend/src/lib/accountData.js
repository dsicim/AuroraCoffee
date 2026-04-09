import { getAuthSession, getAuthStorageMode } from './auth'

const accountStorageKeys = {
  orders: {
    local: 'auroraOrdersLocal',
    session: 'auroraOrdersSession',
  },
  favorites: {
    local: 'auroraFavoritesLocal',
    session: 'auroraFavoritesSession',
  },
}

export const accountDataChangeEvent = 'aurora-account-data-change'

function getStorage(mode) {
  return mode === 'session' ? window.sessionStorage : window.localStorage
}

function getCurrentAccountScope() {
  const session = getAuthSession()

  if (!session?.token) {
    return null
  }

  const scopeSource = session.email?.trim().toLowerCase() || session.token.trim()
  return encodeURIComponent(scopeSource)
}

function parseScopedMap(rawValue) {
  if (!rawValue) {
    return {}
  }

  try {
    const parsed = JSON.parse(rawValue)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {}
  } catch {
    return {}
  }
}

function readScopedMap(type, mode) {
  return parseScopedMap(getStorage(mode).getItem(accountStorageKeys[type][mode]))
}

function writeScopedMap(type, mode, nextMap) {
  const storage = getStorage(mode)
  const sanitizedEntries = Object.entries(nextMap).filter(([, value]) => {
    if (Array.isArray(value)) {
      return value.length > 0
    }

    return Boolean(value)
  })

  if (!sanitizedEntries.length) {
    storage.removeItem(accountStorageKeys[type][mode])
    return
  }

  storage.setItem(
    accountStorageKeys[type][mode],
    JSON.stringify(Object.fromEntries(sanitizedEntries)),
  )
}

function readScopedRecords(type, mode, scope) {
  const scopedMap = readScopedMap(type, mode)
  const storedValue = scopedMap[scope]
  return Array.isArray(storedValue) ? storedValue : []
}

function writeScopedRecords(type, mode, scope, records) {
  const scopedMap = readScopedMap(type, mode)

  if (records.length) {
    scopedMap[scope] = records
  } else {
    delete scopedMap[scope]
  }

  writeScopedMap(type, mode, scopedMap)
}

function dispatchAccountChange(type) {
  window.dispatchEvent(
    new CustomEvent(accountDataChangeEvent, {
      detail: { type },
    }),
  )
}

function sortOrders(orders) {
  return [...orders].sort(
    (left, right) =>
      new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime(),
  )
}

function mergeOrders(baseOrders, incomingOrders) {
  const merged = new Map()

  for (const order of [...baseOrders, ...incomingOrders]) {
    if (!order?.reference) {
      continue
    }

    merged.set(order.reference, order)
  }

  return sortOrders(Array.from(merged.values()))
}

function mergeFavorites(baseFavorites, incomingFavorites) {
  return Array.from(new Set([...baseFavorites, ...incomingFavorites]))
}

export function getAccountStorageMode() {
  return getAuthStorageMode() || 'local'
}

export function reconcileAccountStorageWithAuth() {
  const scope = getCurrentAccountScope()
  const authStorageMode = getAuthStorageMode()

  if (!scope || !authStorageMode) {
    return null
  }

  const otherMode = authStorageMode === 'local' ? 'session' : 'local'
  const mergedOrders = mergeOrders(
    readScopedRecords('orders', authStorageMode, scope),
    readScopedRecords('orders', otherMode, scope),
  )
  const mergedFavorites = mergeFavorites(
    readScopedRecords('favorites', authStorageMode, scope),
    readScopedRecords('favorites', otherMode, scope),
  )

  writeScopedRecords('orders', authStorageMode, scope, mergedOrders)
  writeScopedRecords('orders', otherMode, scope, [])
  writeScopedRecords('favorites', authStorageMode, scope, mergedFavorites)
  writeScopedRecords('favorites', otherMode, scope, [])

  dispatchAccountChange('reconcile')

  return {
    orders: mergedOrders,
    favorites: mergedFavorites,
  }
}

export function getOrderHistory() {
  const scope = getCurrentAccountScope()

  if (!scope) {
    return []
  }

  return sortOrders(readScopedRecords('orders', getAccountStorageMode(), scope))
}

export function addOrderHistoryEntry(order) {
  const scope = getCurrentAccountScope()

  if (!scope || !order?.reference) {
    return []
  }

  const storageMode = getAccountStorageMode()
  const nextOrders = mergeOrders(
    readScopedRecords('orders', storageMode, scope),
    [order],
  )

  writeScopedRecords('orders', storageMode, scope, nextOrders)
  dispatchAccountChange('orders')
  return nextOrders
}

export function getFavoriteProductIds() {
  const scope = getCurrentAccountScope()

  if (!scope) {
    return []
  }

  return readScopedRecords('favorites', getAccountStorageMode(), scope)
}

export function isFavoriteProduct(productId) {
  return getFavoriteProductIds().includes(productId)
}

export function toggleFavoriteProduct(productId) {
  const scope = getCurrentAccountScope()

  if (!scope || !productId) {
    return []
  }

  const storageMode = getAccountStorageMode()
  const existingFavorites = getFavoriteProductIds()
  const nextFavorites = existingFavorites.includes(productId)
    ? existingFavorites.filter((id) => id !== productId)
    : [...existingFavorites, productId]

  writeScopedRecords('favorites', storageMode, scope, nextFavorites)
  dispatchAccountChange('favorites')
  return nextFavorites
}
