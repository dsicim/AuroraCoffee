import { buildApiUrl } from './api'
import { getAuthSession } from './auth'

export const paymentMethodsChangeEvent = 'aurora-payment-methods-change'

class PaymentRequestError extends Error {
  constructor(message, details = null) {
    super(message)
    this.name = 'PaymentRequestError'
    this.details = details
  }
}

const installmentInfoCache = new Map()
const inFlightInstallmentInfoRequests = new Map()
let cachedPaymentMethods = []
let cachedPaymentMethodsScope = null
let cachedPaymentMethodsLoaded = false
let inFlightPaymentMethodsPromise = null

function getPaymentMethodsScope() {
  const session = getAuthSession()

  if (!session?.token) {
    return null
  }

  const scopeSource = session.email?.trim().toLowerCase() || session.token.trim()
  return encodeURIComponent(scopeSource)
}

function dispatchPaymentMethodsChange(type = 'list') {
  window.dispatchEvent(
    new CustomEvent(paymentMethodsChangeEvent, {
      detail: { type },
    }),
  )
}

function clearPaymentMethodsCache({ emit = false, type = 'clear' } = {}) {
  const hadState =
    cachedPaymentMethods.length > 0 ||
    cachedPaymentMethodsLoaded ||
    cachedPaymentMethodsScope !== null ||
    inFlightPaymentMethodsPromise !== null

  cachedPaymentMethods = []
  cachedPaymentMethodsScope = null
  cachedPaymentMethodsLoaded = false
  inFlightPaymentMethodsPromise = null

  if (emit && hadState) {
    dispatchPaymentMethodsChange(type)
  }
}

function ensurePaymentMethodsScope(scope) {
  if (cachedPaymentMethodsScope === scope) {
    return
  }

  clearPaymentMethodsCache({ emit: true, type: 'scope' })
  cachedPaymentMethodsScope = scope
}

function persistPaymentMethods(cards) {
  cachedPaymentMethodsScope = getPaymentMethodsScope()
  cachedPaymentMethods = Array.isArray(cards) ? cards : []
  cachedPaymentMethodsLoaded = true
  dispatchPaymentMethodsChange('list')
  return cachedPaymentMethods
}

function getAuthorizationHeaders() {
  const session = getAuthSession()
  return session?.token ? { authorization: session.token } : {}
}

function buildPaymentErrorMessage(details, fallback = 'Payment request failed') {
  if (!details) {
    return fallback
  }

  if (typeof details === 'string') {
    return details
  }

  if (typeof details === 'object') {
    const parts = [details.what, details.why, details.resolution]
      .map((value) => String(value || '').trim())
      .filter(Boolean)

    if (parts.length) {
      return parts.join(' — ')
    }
  }

  return fallback
}

async function requestPaymentJson(path, options = {}) {
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
  const errorDetails = data?.e || payload?.e || null
  const isExplicitSuccess = data?.success === true || payload?.success === true

  if (!response.ok || (errorDetails && !isExplicitSuccess)) {
    throw new PaymentRequestError(
      buildPaymentErrorMessage(errorDetails),
      errorDetails,
    )
  }

  return data
}

function sanitizeCardNumber(value) {
  return String(value || '').replace(/\D/g, '')
}

function parseExpiry(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4)
  return {
    month: digits.slice(0, 2),
    year: digits.length > 2 ? `20${digits.slice(2, 4)}` : '',
  }
}

function buildCardPayload(card) {
  const expiry = parseExpiry(card.expiry)

  return {
    holder: String(card.cardholder || '').trim(),
    number: sanitizeCardNumber(card.cardNumber),
    expiry,
    cvc: String(card.cvc || '').replace(/\D/g, '').slice(0, 4),
  }
}

function sanitizeCardCvc(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 4)
}

function buildInstallmentInfoCacheKey(bin, token, price) {
  const normalizedBin = String(bin || '').replace(/\D/g, '').slice(0, 6)
  const normalizedToken = String(token || '').trim()
  const normalizedPrice = Number(price)

  if (normalizedToken) {
    return `token:${normalizedToken}:${Number.isFinite(normalizedPrice) ? normalizedPrice : ''}`
  }

  return `bin:${normalizedBin}:${Number.isFinite(normalizedPrice) ? normalizedPrice : ''}`
}

export async function fetchInstallmentInfo({ bin, token, price }) {
  const normalizedBin = String(bin || '').replace(/\D/g, '').slice(0, 6)
  const normalizedToken = String(token || '').trim()

  if (!normalizedToken && normalizedBin.length < 6) {
    return null
  }

  const cacheKey = buildInstallmentInfoCacheKey(normalizedBin, normalizedToken, price)

  if (installmentInfoCache.has(cacheKey)) {
    return installmentInfoCache.get(cacheKey)
  }

  if (inFlightInstallmentInfoRequests.has(cacheKey)) {
    return inFlightInstallmentInfoRequests.get(cacheKey)
  }

  const request = requestPaymentJson('/payment/installments', {
    method: 'POST',
    body: JSON.stringify({
      ...(normalizedToken ? { token: normalizedToken } : { bin: normalizedBin }),
      price,
    }),
  })
    .then((payload) => {
      const result = {
        card: payload?.card || null,
        features: payload?.features || null,
        installments: Array.isArray(payload?.installments) ? payload.installments : [],
      }

      installmentInfoCache.set(cacheKey, result)
      return result
    })
    .finally(() => {
      inFlightInstallmentInfoRequests.delete(cacheKey)
    })

  inFlightInstallmentInfoRequests.set(cacheKey, request)
  return request
}

export async function fetchPaymentMethods({ force = false } = {}) {
  const scope = getPaymentMethodsScope()

  if (!scope) {
    clearPaymentMethodsCache({ emit: true, type: 'clear' })
    return []
  }

  ensurePaymentMethodsScope(scope)

  if (!force && cachedPaymentMethodsLoaded) {
    return cachedPaymentMethods
  }

  if (!force && inFlightPaymentMethodsPromise) {
    return inFlightPaymentMethodsPromise
  }

  inFlightPaymentMethodsPromise = requestPaymentJson('/payment/methods', {
    method: 'GET',
  })
    .then((payload) => persistPaymentMethods(Array.isArray(payload?.cards) ? payload.cards : []))
    .finally(() => {
      inFlightPaymentMethodsPromise = null
    })

  return inFlightPaymentMethodsPromise
}

export async function savePaymentMethod({ alias, card }) {
  await requestPaymentJson('/payment/methods', {
    method: 'POST',
    body: JSON.stringify({
      alias: String(alias || '').trim() || 'Saved card',
      card: buildCardPayload(card),
    }),
  })

  return fetchPaymentMethods({ force: true })
}

export async function deletePaymentMethod(cardToken, { reload = true } = {}) {
  await requestPaymentJson('/payment/methods', {
    method: 'DELETE',
    body: JSON.stringify({
      cardToken,
    }),
  })

  if (!reload) {
    clearPaymentMethodsCache({ emit: true, type: 'invalidate' })
    return []
  }

  return fetchPaymentMethods({ force: true })
}

export function getPaymentMethodsSnapshot() {
  if (cachedPaymentMethodsScope !== getPaymentMethodsScope()) {
    return {
      cards: [],
      loaded: false,
    }
  }

  return {
    cards: cachedPaymentMethods,
    loaded: cachedPaymentMethodsLoaded,
  }
}

export function invalidatePaymentMethodsCache() {
  clearPaymentMethodsCache({ emit: true, type: 'invalidate' })
}

export async function initiatePayment({
  cart,
  shipping,
  billing,
  expected,
  currency = 'TRY',
  installments,
  avoid3DS,
  card,
  savedCardToken,
  cvc,
}) {
  const body = {
    cart,
    shipping,
    billing,
    expected,
    currency,
    ...(installments ? { installments } : {}),
    ...(avoid3DS !== undefined ? { avoid3DS } : {}),
    card: savedCardToken
      ? {
          token: savedCardToken,
          cvc: sanitizeCardCvc(cvc),
        }
      : buildCardPayload(card),
  }

  return requestPaymentJson('/payment/initiate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function maskSavedCard(card) {
  if (!card?.last4dig) {
    return 'Saved card'
  }

  return `•••• ${card.last4dig}`
}

export function formatPaymentError(error, fallback = 'Payment request failed') {
  if (error instanceof PaymentRequestError) {
    return buildPaymentErrorMessage(error.details, error.message || fallback)
  }

  return buildPaymentErrorMessage(error?.message || error, fallback)
}
