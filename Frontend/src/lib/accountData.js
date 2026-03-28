import { getAuthSession, getAuthStorageMode } from './auth'

const accountStorageKeys = {
  orders: {
    local: 'auroraOrdersLocal',
    session: 'auroraOrdersSession',
  },
  addresses: {
    local: 'auroraAddressesLocal',
    session: 'auroraAddressesSession',
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

function createAddressId() {
  return `addr-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
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

function sortAddresses(addresses) {
  return [...addresses].sort((left, right) => {
    if (left.isDefault && !right.isDefault) {
      return -1
    }

    if (!left.isDefault && right.isDefault) {
      return 1
    }

    const leftLabel = left.label || left.fullName || ''
    const rightLabel = right.label || right.fullName || ''
    return leftLabel.localeCompare(rightLabel)
  })
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

function mergeAddresses(baseAddresses, incomingAddresses) {
  const merged = new Map()
  let defaultAddressId = null

  for (const address of [...baseAddresses, ...incomingAddresses]) {
    if (!address?.id) {
      continue
    }

    merged.set(address.id, address)

    if (address.isDefault) {
      defaultAddressId = address.id
    }
  }

  const addresses = Array.from(merged.values()).map((address) => ({
    ...address,
    isDefault: defaultAddressId ? address.id === defaultAddressId : Boolean(address.isDefault),
  }))

  if (!addresses.some((address) => address.isDefault) && addresses.length) {
    addresses[0] = {
      ...addresses[0],
      isDefault: true,
    }
  }

  return sortAddresses(addresses)
}

function mergeFavorites(baseFavorites, incomingFavorites) {
  return Array.from(new Set([...baseFavorites, ...incomingFavorites]))
}

function normalizeAddressInput(addressInput, existingAddresses) {
  const nextAddress = {
    id: addressInput.id || createAddressId(),
    label: addressInput.label?.trim() || '',
    fullName: addressInput.fullName?.trim() || '',
    email: addressInput.email?.trim() || '',
    address: addressInput.address?.trim() || '',
    city: addressInput.city?.trim() || '',
    postalCode: addressInput.postalCode?.trim() || '',
    notes: addressInput.notes?.trim() || '',
    isDefault: Boolean(addressInput.isDefault),
  }

  if (!existingAddresses.length) {
    nextAddress.isDefault = true
  }

  return nextAddress
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
  const mergedAddresses = mergeAddresses(
    readScopedRecords('addresses', authStorageMode, scope),
    readScopedRecords('addresses', otherMode, scope),
  )
  const mergedFavorites = mergeFavorites(
    readScopedRecords('favorites', authStorageMode, scope),
    readScopedRecords('favorites', otherMode, scope),
  )

  writeScopedRecords('orders', authStorageMode, scope, mergedOrders)
  writeScopedRecords('orders', otherMode, scope, [])
  writeScopedRecords('addresses', authStorageMode, scope, mergedAddresses)
  writeScopedRecords('addresses', otherMode, scope, [])
  writeScopedRecords('favorites', authStorageMode, scope, mergedFavorites)
  writeScopedRecords('favorites', otherMode, scope, [])

  dispatchAccountChange('reconcile')

  return {
    orders: mergedOrders,
    addresses: mergedAddresses,
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

export function getSavedAddresses() {
  const scope = getCurrentAccountScope()

  if (!scope) {
    return []
  }

  return sortAddresses(
    readScopedRecords('addresses', getAccountStorageMode(), scope),
  )
}

export function getDefaultSavedAddress() {
  return getSavedAddresses().find((address) => address.isDefault) || null
}

export function saveSavedAddress(addressInput) {
  const scope = getCurrentAccountScope()

  if (!scope) {
    return []
  }

  const storageMode = getAccountStorageMode()
  const existingAddresses = getSavedAddresses()
  const normalizedAddress = normalizeAddressInput(addressInput, existingAddresses)
  let nextAddresses = [
    ...existingAddresses.filter((address) => address.id !== normalizedAddress.id),
    normalizedAddress,
  ]

  if (normalizedAddress.isDefault) {
    nextAddresses = nextAddresses.map((address) => ({
      ...address,
      isDefault: address.id === normalizedAddress.id,
    }))
  } else if (!nextAddresses.some((address) => address.isDefault) && nextAddresses.length) {
    nextAddresses = nextAddresses.map((address, index) => ({
      ...address,
      isDefault: index === 0,
    }))
  }

  nextAddresses = sortAddresses(nextAddresses)
  writeScopedRecords('addresses', storageMode, scope, nextAddresses)
  dispatchAccountChange('addresses')
  return nextAddresses
}

export function deleteSavedAddress(addressId) {
  const scope = getCurrentAccountScope()

  if (!scope) {
    return []
  }

  const storageMode = getAccountStorageMode()
  let nextAddresses = getSavedAddresses().filter((address) => address.id !== addressId)

  if (!nextAddresses.some((address) => address.isDefault) && nextAddresses.length) {
    nextAddresses = nextAddresses.map((address, index) => ({
      ...address,
      isDefault: index === 0,
    }))
  }

  nextAddresses = sortAddresses(nextAddresses)
  writeScopedRecords('addresses', storageMode, scope, nextAddresses)
  dispatchAccountChange('addresses')
  return nextAddresses
}

export function setDefaultSavedAddress(addressId) {
  const scope = getCurrentAccountScope()

  if (!scope) {
    return []
  }

  const storageMode = getAccountStorageMode()
  const nextAddresses = sortAddresses(
    getSavedAddresses().map((address) => ({
      ...address,
      isDefault: address.id === addressId,
    })),
  )

  writeScopedRecords('addresses', storageMode, scope, nextAddresses)
  dispatchAccountChange('addresses')
  return nextAddresses
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
