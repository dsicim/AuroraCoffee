import { buildApiUrl } from './api'
import { getAuthSession } from './auth'

function getAuthorizationHeaders() {
  const session = getAuthSession()
  return session?.token ? { authorization: session.token } : {}
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

  if (!response.ok || data?.e || payload?.e) {
    throw new Error(data?.e || payload?.e || 'Payment request failed')
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

export async function initiatePayment({ card, cardToken, cvc }) {
  const body = cardToken
    ? {
        cardToken,
        card: {
          cvc: String(cvc || '').replace(/\D/g, '').slice(0, 4),
        },
      }
    : {
        card: buildCardPayload(card),
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
