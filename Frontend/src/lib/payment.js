import { buildApiUrl } from './api'
import { getAuthSession } from './auth'

class PaymentRequestError extends Error {
  constructor(message, details = null) {
    super(message)
    this.name = 'PaymentRequestError'
    this.details = details
  }
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

export async function fetchInstallmentInfo({ bin, price }) {
  const normalizedBin = String(bin || '').replace(/\D/g, '').slice(0, 6)

  if (normalizedBin.length < 6) {
    return null
  }

  const payload = await requestPaymentJson('/payment/installments', {
    method: 'POST',
    body: JSON.stringify({
      bin: normalizedBin,
      price,
    }),
  })

  return {
    card: payload?.card || null,
    features: payload?.features || null,
    installments: Array.isArray(payload?.installments) ? payload.installments : [],
  }
}

export async function fetchPaymentMethods() {
  const payload = await requestPaymentJson('/payment/methods', {
    method: 'GET',
  })

  return Array.isArray(payload?.cards) ? payload.cards : []
}

export async function savePaymentMethod({ alias, card }) {
  return requestPaymentJson('/payment/methods', {
    method: 'POST',
    body: JSON.stringify({
      alias: String(alias || '').trim() || 'Saved card',
      card: buildCardPayload(card),
    }),
  })
}

export async function deletePaymentMethod(cardToken) {
  return requestPaymentJson('/payment/methods', {
    method: 'DELETE',
    body: JSON.stringify({
      cardToken,
    }),
  })
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
