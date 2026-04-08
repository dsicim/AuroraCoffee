import { buildApiUrl } from './api'
import { getAuthSession, getAuthStorageMode } from './auth'

export const addressBookChangeEvent = 'aurora-address-book-change'

const addressBookStorageKeys = {
  shadowLocal: 'auroraAddressShadowLocal',
  shadowSession: 'auroraAddressShadowSession',
  prefLocal: 'auroraAddressPrefLocal',
  prefSession: 'auroraAddressPrefSession',
}

let cachedAddresses = []

function getStorage(mode) {
  return mode === 'session' ? window.sessionStorage : window.localStorage
}

function getAddressScope() {
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

function parseScopedMap(rawValue) {
  const parsed = parseJson(rawValue, {})
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

function getStorageKey(kind, mode) {
  if (kind === 'shadow') {
    return mode === 'session'
      ? addressBookStorageKeys.shadowSession
      : addressBookStorageKeys.shadowLocal
  }

  return mode === 'session'
    ? addressBookStorageKeys.prefSession
    : addressBookStorageKeys.prefLocal
}

function readScopedValue(kind, mode, scope, fallback) {
  if (!scope) {
    return fallback
  }

  const scopedMap = parseScopedMap(getStorage(mode).getItem(getStorageKey(kind, mode)))
  return scopedMap[scope] ?? fallback
}

function writeScopedValue(kind, mode, scope, value) {
  if (!scope) {
    return
  }

  const storage = getStorage(mode)
  const key = getStorageKey(kind, mode)
  const scopedMap = parseScopedMap(storage.getItem(key))

  if (value && ((Array.isArray(value) && value.length) || (!Array.isArray(value) && Object.keys(value).length))) {
    scopedMap[scope] = value
  } else {
    delete scopedMap[scope]
  }

  const entries = Object.entries(scopedMap).filter(([, entryValue]) => {
    if (Array.isArray(entryValue)) {
      return entryValue.length
    }

    return Boolean(entryValue && Object.keys(entryValue).length)
  })

  if (!entries.length) {
    storage.removeItem(key)
    return
  }

  storage.setItem(key, JSON.stringify(Object.fromEntries(entries)))
}

function getAddressStorageMode() {
  return getAuthStorageMode() || 'local'
}

function getAddressShadows() {
  const scope = getAddressScope()
  const mode = getAddressStorageMode()
  return readScopedValue('shadow', mode, scope, {})
}

function saveAddressShadows(shadows) {
  const scope = getAddressScope()
  const mode = getAddressStorageMode()
  writeScopedValue('shadow', mode, scope, shadows)
}

function getAddressPreferences() {
  const scope = getAddressScope()
  const mode = getAddressStorageMode()
  return readScopedValue('pref', mode, scope, {})
}

function saveAddressPreferences(preferences) {
  const scope = getAddressScope()
  const mode = getAddressStorageMode()
  writeScopedValue('pref', mode, scope, preferences)
}

function dispatchAddressBookChange(type) {
  window.dispatchEvent(
    new CustomEvent(addressBookChangeEvent, {
      detail: { type },
    }),
  )
}

function splitFullName(value) {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!parts.length) {
    return { name: '', surname: '' }
  }

  if (parts.length === 1) {
    return { name: parts[0], surname: '' }
  }

  return {
    name: parts.slice(0, -1).join(' '),
    surname: parts.slice(-1)[0] || '.',
  }
}

function joinName(firstName, lastName) {
  return [String(firstName || '').trim(), String(lastName || '').trim()]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function splitAddressLines(value) {
  const raw = String(value || '').trim()

  if (!raw) {
    return { addressLine1: '', addressLine2: '' }
  }

  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) {
    return { addressLine1: '', addressLine2: '' }
  }

  if (lines.length === 1) {
    return { addressLine1: lines[0], addressLine2: '' }
  }

  return {
    addressLine1: lines[0],
    addressLine2: lines.slice(1).join(', '),
  }
}

function joinAddressLines(addressLine1, addressLine2) {
  return [String(addressLine1 || '').trim(), String(addressLine2 || '').trim()]
    .filter(Boolean)
    .join('\n')
    .trim()
}

function parseSummaryAddress(summaryAddress) {
  const parts = String(summaryAddress?.desc || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  return {
    city: parts[0] || '',
    province: parts[1] || parts[0] || '',
    country: parts[2] || 'Turkey',
  }
}

function mergeAddressRecord(summaryAddress, shadowAddress, defaultAddressId) {
  const summary = parseSummaryAddress(summaryAddress)
  const nameParts = splitFullName(shadowAddress?.fullName || summaryAddress.title || '')
  const addressLines = splitAddressLines(shadowAddress?.address || '')
  const district = shadowAddress?.district || shadowAddress?.city || summary.city
  const province = shadowAddress?.province || summary.province

  return {
    id: String(summaryAddress.id),
    label: shadowAddress?.label || summaryAddress.title || '',
    firstName: shadowAddress?.firstName || nameParts.name || '',
    lastName: shadowAddress?.lastName || nameParts.surname || '',
    fullName: joinName(
      shadowAddress?.firstName || nameParts.name || '',
      shadowAddress?.lastName || nameParts.surname || '',
    ),
    email: shadowAddress?.email || '',
    addressLine1: shadowAddress?.addressLine1 || addressLines.addressLine1 || '',
    addressLine2: shadowAddress?.addressLine2 || addressLines.addressLine2 || '',
    address: joinAddressLines(
      shadowAddress?.addressLine1 || addressLines.addressLine1 || '',
      shadowAddress?.addressLine2 || addressLines.addressLine2 || '',
    ),
    district,
    city: district,
    province,
    country: shadowAddress?.country || summary.country,
    postalCode: shadowAddress?.postalCode || '',
    phone: shadowAddress?.phone || '',
    isDefault: defaultAddressId
      ? String(summaryAddress.id) === String(defaultAddressId)
      : false,
    summaryTitle: summaryAddress.title || '',
    summaryDescription: summaryAddress.desc || '',
  }
}

function sortAddresses(addresses) {
  return [...addresses].sort((left, right) => {
    if (left.isDefault && !right.isDefault) {
      return -1
    }

    if (!left.isDefault && right.isDefault) {
      return 1
    }

    return (left.label || left.fullName || '').localeCompare(right.label || right.fullName || '')
  })
}

function getAuthorizationHeaders() {
  const session = getAuthSession()
  return session?.token ? { authorization: session.token } : {}
}

async function requestAddressJson(path = '', options = {}) {
  const response = await fetch(buildApiUrl(`/address${path}`), {
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
    throw new Error(data?.e || payload?.e || 'Address request failed')
  }

  return data
}

function persistResolvedAddresses(addresses) {
  cachedAddresses = sortAddresses(addresses)
  return cachedAddresses
}

export function getSavedAddresses() {
  return cachedAddresses
}

export function getDefaultSavedAddress() {
  return cachedAddresses.find((address) => address.isDefault) || null
}

export async function fetchSavedAddresses({ force = false } = {}) {
  if (!getAuthSession()?.token) {
    cachedAddresses = []
    return cachedAddresses
  }

  if (cachedAddresses.length && !force) {
    return cachedAddresses
  }

  const payload = await requestAddressJson('', { method: 'GET' })
  const serverAddresses = Array.isArray(payload?.addresses) ? payload.addresses : []
  const shadows = getAddressShadows()
  const preferences = getAddressPreferences()
  const defaultAddressId = preferences.defaultAddressId || serverAddresses[0]?.id || ''
  const resolvedAddresses = serverAddresses.map((address) =>
    mergeAddressRecord(address, shadows[String(address.id)], defaultAddressId),
  )

  if (resolvedAddresses.length && !resolvedAddresses.some((address) => address.isDefault)) {
    resolvedAddresses[0] = {
      ...resolvedAddresses[0],
      isDefault: true,
    }
    saveAddressPreferences({
      ...preferences,
      defaultAddressId: resolvedAddresses[0].id,
    })
  }

  return persistResolvedAddresses(resolvedAddresses)
}

function normalizeAddressInput(addressInput) {
  const firstName = String(addressInput.firstName || '').trim()
  const lastName = String(addressInput.lastName || '').trim()
  const addressLine1 = String(addressInput.addressLine1 || '').trim()
  const addressLine2 = String(addressInput.addressLine2 || '').trim()
  const district = String(addressInput.district || addressInput.city || '').trim()
  const province = String(addressInput.province || addressInput.city || '').trim()

  return {
    id: addressInput.id ? String(addressInput.id) : '',
    label: String(addressInput.label || '').trim(),
    firstName,
    lastName,
    fullName: joinName(firstName, lastName),
    email: String(addressInput.email || '').trim(),
    addressLine1,
    addressLine2,
    address: joinAddressLines(addressLine1, addressLine2),
    district,
    city: district,
    province,
    country: String(addressInput.country || 'Turkey').trim(),
    postalCode: String(addressInput.postalCode || '').trim(),
    phone: String(addressInput.phone || '').trim(),
    isDefault: Boolean(addressInput.isDefault),
  }
}

function buildBackendAddressPayload(addressInput) {
  const normalizedAddress = normalizeAddressInput(addressInput)
  const { name, surname } = splitFullName(normalizedAddress.fullName)

  return {
    alias: normalizedAddress.label || undefined,
    name,
    surname,
    address: normalizedAddress.address,
    city: normalizedAddress.city,
    province: normalizedAddress.province || normalizedAddress.city,
    country: normalizedAddress.country || 'Turkey',
    zip: normalizedAddress.postalCode,
    phone: normalizedAddress.phone,
  }
}

function updateAddressShadow(id, addressInput) {
  const shadows = getAddressShadows()
  const normalizedAddress = normalizeAddressInput(addressInput)

  shadows[String(id)] = normalizedAddress
  saveAddressShadows(shadows)
}

function removeAddressShadow(id) {
  const shadows = getAddressShadows()
  delete shadows[String(id)]
  saveAddressShadows(shadows)
}

function syncDefaultAddressPreference(nextAddresses, preferredId) {
  const defaultAddressId =
    preferredId && nextAddresses.some((address) => address.id === String(preferredId))
      ? String(preferredId)
      : nextAddresses[0]?.id || ''

  const preferences = getAddressPreferences()
  saveAddressPreferences({
    ...preferences,
    defaultAddressId,
  })

  return sortAddresses(
    nextAddresses.map((address) => ({
      ...address,
      isDefault: address.id === defaultAddressId,
    })),
  )
}

export async function saveSavedAddress(addressInput) {
  const normalizedAddress = normalizeAddressInput(addressInput)
  const beforeIds = new Set(getSavedAddresses().map((address) => address.id))

  if (normalizedAddress.id) {
    await requestAddressJson('', {
      method: 'PATCH',
      body: JSON.stringify({
        id: normalizedAddress.id,
        address: buildBackendAddressPayload(normalizedAddress),
      }),
    })

    updateAddressShadow(normalizedAddress.id, normalizedAddress)
    const nextAddresses = await fetchSavedAddresses({ force: true })
    const resolvedAddresses = syncDefaultAddressPreference(
      nextAddresses,
      normalizedAddress.isDefault ? normalizedAddress.id : getAddressPreferences().defaultAddressId,
    )
    persistResolvedAddresses(resolvedAddresses)
    dispatchAddressBookChange('save')
    return resolvedAddresses
  }

  await requestAddressJson('', {
    method: 'POST',
    body: JSON.stringify({
      address: buildBackendAddressPayload(normalizedAddress),
    }),
  })

  const nextAddresses = await fetchSavedAddresses({ force: true })
  const newAddress = nextAddresses.find((address) => !beforeIds.has(address.id))

  if (newAddress) {
    updateAddressShadow(newAddress.id, normalizedAddress)
  }

  const resolvedAddresses = syncDefaultAddressPreference(
    nextAddresses,
    normalizedAddress.isDefault ? newAddress?.id : getAddressPreferences().defaultAddressId,
  )
  persistResolvedAddresses(resolvedAddresses)
  dispatchAddressBookChange('save')
  return resolvedAddresses
}

export async function deleteSavedAddress(addressId) {
  await requestAddressJson('', {
    method: 'DELETE',
    body: JSON.stringify({
      id: addressId,
    }),
  })

  removeAddressShadow(addressId)
  const nextAddresses = (await fetchSavedAddresses({ force: true })).filter(
    (address) => address.id !== String(addressId),
  )
  const resolvedAddresses = syncDefaultAddressPreference(
    nextAddresses,
    getAddressPreferences().defaultAddressId === String(addressId)
      ? nextAddresses[0]?.id
      : getAddressPreferences().defaultAddressId,
  )
  persistResolvedAddresses(resolvedAddresses)
  dispatchAddressBookChange('delete')
  return resolvedAddresses
}

export function setDefaultSavedAddress(addressId) {
  const resolvedAddresses = syncDefaultAddressPreference(getSavedAddresses(), addressId)
  persistResolvedAddresses(resolvedAddresses)
  dispatchAddressBookChange('default')
  return resolvedAddresses
}
