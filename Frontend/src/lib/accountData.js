import { getAuthSession, getAuthStorageMode } from './auth'

const accountStorageKeys = {
  orders: {
    local: 'auroraOrdersLocal',
    session: 'auroraOrdersSession',
  },
}

export const accountDataChangeEvent = 'aurora-account-data-change'

const legacyFavoriteStorageKeys = ['auroraFavoritesLocal', 'auroraFavoritesSession']

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
  if (!accountStorageKeys[type]) {
    return {}
  }

  return parseScopedMap(getStorage(mode).getItem(accountStorageKeys[type][mode]))
}

function writeScopedMap(type, mode, nextMap) {
  if (!accountStorageKeys[type]) {
    return
  }

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

export function getAccountStorageMode() {
  return getAuthStorageMode() || 'local'
}

function clearLegacyFavoriteStorage() {
  for (const key of legacyFavoriteStorageKeys) {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  }
}

export function reconcileAccountStorageWithAuth() {
  const scope = getCurrentAccountScope()
  const authStorageMode = getAuthStorageMode()
  clearLegacyFavoriteStorage()

  if (!scope || !authStorageMode) {
    return null
  }

  const otherMode = authStorageMode === 'local' ? 'session' : 'local'
  const mergedOrders = mergeOrders(
    readScopedRecords('orders', authStorageMode, scope),
    readScopedRecords('orders', otherMode, scope),
  )

  writeScopedRecords('orders', authStorageMode, scope, mergedOrders)
  writeScopedRecords('orders', otherMode, scope, [])

  dispatchAccountChange('reconcile')

  return {
    orders: mergedOrders,
    favorites: [],
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
  clearLegacyFavoriteStorage()
  return []
}

export function isFavoriteProduct(productId) {
  return getFavoriteProductIds().includes(productId)
}

export function toggleFavoriteProduct() {
  dispatchAccountChange('favorites')
  return []
}
