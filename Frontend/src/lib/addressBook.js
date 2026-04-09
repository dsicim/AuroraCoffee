import { buildApiUrl } from './api'
import { getAuthSession } from './auth'

export const addressBookChangeEvent = 'aurora-address-book-change'

const legacyAddressStorageKeys = {
  local: 'auroraAddressesLocal',
  session: 'auroraAddressesSession',
}

const addressMigrationStorageKey = 'auroraAddressMigrationState'

let cachedAddresses = []
let cachedAddressScope = null
let cachedAddressesLoaded = false
let inFlightAddressListPromise = null
let inFlightAddressListScope = null

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

function clearAddressCache({ emit = true, type = 'clear' } = {}) {
  const hadState =
    cachedAddresses.length > 0 ||
    cachedAddressScope !== null ||
    cachedAddressesLoaded ||
    inFlightAddressListPromise !== null

  cachedAddresses = []
  cachedAddressScope = null
  cachedAddressesLoaded = false
  inFlightAddressListPromise = null
  inFlightAddressListScope = null

  if (emit && hadState) {
    dispatchAddressBookChange(type)
  }
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
    return { firstName: '', lastName: '' }
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.slice(-1)[0] || '',
  }
}

function joinName(firstName, lastName) {
  return [String(firstName || '').trim(), String(lastName || '').trim()]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function splitAddressLines(value, fallbackSecondLine = '') {
  const lines = String(value || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) {
    return {
      addressLine1: '',
      addressLine2: String(fallbackSecondLine || '').trim(),
    }
  }

  return {
    addressLine1: lines[0] || '',
    addressLine2: lines.slice(1).join(', ') || String(fallbackSecondLine || '').trim(),
  }
}

function joinAddressLines(addressLine1, addressLine2) {
  return [String(addressLine1 || '').trim(), String(addressLine2 || '').trim()]
    .filter(Boolean)
    .join('\n')
    .trim()
}

function sortAddresses(addresses) {
  return [...addresses].sort((left, right) => {
    const leftLabel = left.label || left.fullName || left.summaryTitle || ''
    const rightLabel = right.label || right.fullName || right.summaryTitle || ''
    return leftLabel.localeCompare(rightLabel)
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

function normalizeSummaryAddress(summaryAddress) {
  const descParts = String(summaryAddress?.desc || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  return {
    id: String(summaryAddress.id),
    label: '',
    firstName: '',
    lastName: '',
    fullName: '',
    addressLine1: '',
    addressLine2: '',
    address: '',
    district: descParts[0] || '',
    city: descParts[0] || '',
    province: descParts[1] || descParts[0] || '',
    country: descParts[2] || 'Turkey',
    postalCode: '',
    phone: '',
    summaryTitle: String(summaryAddress.title || '').trim(),
    summaryDescription: String(summaryAddress.desc || '').trim(),
  }
}

function normalizeDetailAddress(addressRecord) {
  const firstName = String(addressRecord?.name || '').trim()
  const lastName = String(addressRecord?.surname || '').trim()
  const addressLine1 = String(addressRecord?.address || '').trim()
  const addressLine2 = String(addressRecord?.address2 || '').trim()

  return {
    id: String(addressRecord.id),
    label: String(addressRecord.alias || '').trim(),
    firstName,
    lastName,
    fullName: joinName(firstName, lastName),
    addressLine1,
    addressLine2,
    address: joinAddressLines(addressLine1, addressLine2),
    district: String(addressRecord.city || '').trim(),
    city: String(addressRecord.city || '').trim(),
    province: String(addressRecord.province || '').trim(),
    country: String(addressRecord.country || 'Turkey').trim(),
    postalCode: String(addressRecord.zip || '').trim(),
    phone: String(addressRecord.phone || '').trim(),
    summaryTitle: String(addressRecord.alias || '').trim(),
    summaryDescription: [
      String(addressRecord.city || '').trim(),
      String(addressRecord.province || '').trim(),
      String(addressRecord.country || '').trim(),
    ]
      .filter(Boolean)
      .join(', '),
  }
}

function isValidSummaryAddress(address) {
  return Boolean(
    address &&
      address.id !== undefined &&
      typeof address === 'object' &&
      (address.title || address.desc),
  )
}

function readAddressMigrationState() {
  return parseScopedMap(window.localStorage.getItem(addressMigrationStorageKey))
}

function writeAddressMigrationState(nextState) {
  const entries = Object.entries(nextState).filter(([, value]) => Boolean(value))

  if (!entries.length) {
    window.localStorage.removeItem(addressMigrationStorageKey)
    return
  }

  window.localStorage.setItem(addressMigrationStorageKey, JSON.stringify(Object.fromEntries(entries)))
}

function hasCompletedLegacyMigration(scope) {
  if (!scope) {
    return false
  }

  const state = readAddressMigrationState()
  return Boolean(state[scope])
}

function markLegacyMigrationComplete(scope) {
  if (!scope) {
    return
  }

  const state = readAddressMigrationState()
  state[scope] = true
  writeAddressMigrationState(state)
}

function clearLegacyAddressesForScope(scope) {
  if (!scope) {
    return
  }

  for (const mode of ['local', 'session']) {
    const storage = getStorage(mode)
    const key = legacyAddressStorageKeys[mode]
    const scopedMap = parseScopedMap(storage.getItem(key))

    if (scope in scopedMap) {
      delete scopedMap[scope]
    }

    const nextEntries = Object.entries(scopedMap).filter(([, value]) =>
      Array.isArray(value) ? value.length > 0 : Boolean(value),
    )

    if (!nextEntries.length) {
      storage.removeItem(key)
    } else {
      storage.setItem(key, JSON.stringify(Object.fromEntries(nextEntries)))
    }
  }
}

function readLegacyAddressesForScope(scope) {
  if (!scope) {
    return []
  }

  const seen = new Set()
  const merged = []

  for (const mode of ['local', 'session']) {
    const scopedMap = parseScopedMap(getStorage(mode).getItem(legacyAddressStorageKeys[mode]))
    const records = Array.isArray(scopedMap[scope]) ? scopedMap[scope] : []

    for (const record of records) {
      const recordKey = record?.id || JSON.stringify(record)

      if (!record || seen.has(recordKey)) {
        continue
      }

      seen.add(recordKey)
      merged.push(record)
    }
  }

  return merged
}

function normalizeLegacyAddressRecord(record) {
  if (!record || typeof record !== 'object') {
    return null
  }

  const firstName =
    String(record.firstName || '').trim() || splitFullName(record.fullName).firstName
  const lastName =
    String(record.lastName || '').trim() || splitFullName(record.fullName).lastName
  const lines = splitAddressLines(record.address, record.addressLine2)
  const addressLine1 = String(record.addressLine1 || '').trim() || lines.addressLine1
  const addressLine2 = String(record.addressLine2 || '').trim() || lines.addressLine2
  const district =
    String(record.district || '').trim() ||
    String(record.city || '').trim()
  const province =
    String(record.province || '').trim() ||
    String(record.city || '').trim()

  if (
    !firstName ||
    !lastName ||
    !addressLine1 ||
    !district ||
    !province ||
    !String(record.postalCode || '').trim() ||
    !String(record.phone || '').trim()
  ) {
    return null
  }

  return {
    label: String(record.label || '').trim(),
    firstName,
    lastName,
    fullName: joinName(firstName, lastName),
    addressLine1,
    addressLine2,
    address: joinAddressLines(addressLine1, addressLine2),
    district,
    city: district,
    province,
    country: String(record.country || 'Turkey').trim(),
    postalCode: String(record.postalCode || '').trim(),
    phone: String(record.phone || '').trim(),
  }
}

function createAddressSignature(address) {
  const normalized = [
    String(address.firstName || '').trim().toLowerCase(),
    String(address.lastName || '').trim().toLowerCase(),
    String(address.addressLine1 || '').trim().toLowerCase(),
    String(address.addressLine2 || '').trim().toLowerCase(),
    String(address.district || address.city || '').trim().toLowerCase(),
    String(address.province || '').trim().toLowerCase(),
    String(address.country || 'Turkey').trim().toLowerCase(),
    String(address.postalCode || '').trim(),
    String(address.phone || '').trim(),
  ]

  return normalized.join('|')
}

function persistResolvedAddresses(addresses) {
  cachedAddressScope = getAddressScope()
  cachedAddressesLoaded = true
  cachedAddresses = sortAddresses(addresses)
  dispatchAddressBookChange('list')
  return cachedAddresses
}

async function fetchServerAddressDetail(addressId) {
  const payload = await requestAddressJson(`?id=${encodeURIComponent(addressId)}`, {
    method: 'GET',
  })

  if (!payload?.address?.id) {
    throw new Error('Address not found')
  }

  return normalizeDetailAddress(payload.address)
}

async function runLegacyAddressMigration() {
  const scope = getAddressScope()

  if (!scope || hasCompletedLegacyMigration(scope)) {
    return
  }

  const legacyAddresses = readLegacyAddressesForScope(scope)
    .map(normalizeLegacyAddressRecord)
    .filter(Boolean)

  if (!legacyAddresses.length) {
    clearLegacyAddressesForScope(scope)
    markLegacyMigrationComplete(scope)
    return
  }

  const summaryPayload = await requestAddressJson('', { method: 'GET' })
  const serverSummaries = Array.isArray(summaryPayload?.addresses)
    ? summaryPayload.addresses.filter(isValidSummaryAddress)
    : []

  const serverDetails = await Promise.all(
    serverSummaries.map((address) => fetchServerAddressDetail(address.id).catch(() => null)),
  )

  const serverSignatures = new Set(
    serverDetails.filter(Boolean).map((address) => createAddressSignature(address)),
  )

  for (const address of legacyAddresses) {
    const signature = createAddressSignature(address)

    if (serverSignatures.has(signature)) {
      continue
    }

    await requestAddressJson('', {
      method: 'POST',
      body: JSON.stringify({
        address: buildBackendAddressPayload(address),
      }),
    })

    serverSignatures.add(signature)
  }

  clearLegacyAddressesForScope(scope)
  markLegacyMigrationComplete(scope)
}

export function getSavedAddresses() {
  if (cachedAddressScope !== getAddressScope()) {
    return []
  }

  return cachedAddresses
}

export function getAddressBookSnapshot() {
  if (cachedAddressScope !== getAddressScope()) {
    return {
      addresses: [],
      loaded: false,
    }
  }

  return {
    addresses: cachedAddresses,
    loaded: cachedAddressesLoaded,
  }
}

export function getDefaultSavedAddress() {
  return null
}

export async function fetchSavedAddressById(addressId) {
  if (!addressId) {
    return null
  }

  return fetchServerAddressDetail(addressId)
}

export async function fetchSavedAddresses({ force = false } = {}) {
  const scope = getAddressScope()

  if (!getAuthSession()?.token || !scope) {
    clearAddressCache()
    return []
  }

  if (!force && cachedAddressScope === scope && cachedAddressesLoaded) {
    return cachedAddresses
  }

  if (!force && inFlightAddressListPromise && inFlightAddressListScope === scope) {
    return inFlightAddressListPromise
  }

  inFlightAddressListScope = scope
  inFlightAddressListPromise = (async () => {
    await runLegacyAddressMigration()

    const payload = await requestAddressJson('', { method: 'GET' })
    const serverAddresses = Array.isArray(payload?.addresses)
      ? payload.addresses.filter(isValidSummaryAddress)
      : []

    const resolvedAddresses = serverAddresses.map(normalizeSummaryAddress)

    return persistResolvedAddresses(resolvedAddresses)
  })().finally(() => {
    if (inFlightAddressListScope === scope) {
      inFlightAddressListPromise = null
      inFlightAddressListScope = null
    }
  })

  return inFlightAddressListPromise
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
    addressLine1,
    addressLine2,
    address: joinAddressLines(addressLine1, addressLine2),
    district,
    city: district,
    province,
    country: String(addressInput.country || 'Turkey').trim(),
    postalCode: String(addressInput.postalCode || '').trim(),
    phone: String(addressInput.phone || '').trim(),
  }
}

function buildBackendAddressPayload(addressInput) {
  const normalizedAddress = normalizeAddressInput(addressInput)

  return {
    alias: normalizedAddress.label || undefined,
    name: normalizedAddress.firstName || undefined,
    surname: normalizedAddress.lastName || undefined,
    address: normalizedAddress.addressLine1,
    address2: normalizedAddress.addressLine2 || undefined,
    city: normalizedAddress.city,
    province: normalizedAddress.province || normalizedAddress.city,
    country: normalizedAddress.country || 'Turkey',
    zip: normalizedAddress.postalCode,
    phone: normalizedAddress.phone,
  }
}

export async function saveSavedAddress(addressInput) {
  const normalizedAddress = normalizeAddressInput(addressInput)

  if (normalizedAddress.id) {
    await requestAddressJson('', {
      method: 'PATCH',
      body: JSON.stringify({
        id: normalizedAddress.id,
        address: buildBackendAddressPayload(normalizedAddress),
      }),
    })

    return fetchSavedAddresses({ force: true })
  }

  await requestAddressJson('', {
    method: 'POST',
    body: JSON.stringify({
      address: buildBackendAddressPayload(normalizedAddress),
    }),
  })

  return fetchSavedAddresses({ force: true })
}

export async function deleteSavedAddress(addressId) {
  await requestAddressJson('', {
    method: 'DELETE',
    body: JSON.stringify({
      id: addressId,
    }),
  })

  return fetchSavedAddresses({ force: true })
}

export function setDefaultSavedAddress() {
  return getSavedAddresses()
}
