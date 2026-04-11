import { getAuthSession } from './auth'
import { maskSavedCard } from './payment'

const payment3DSPendingStorageKey = 'auroraPayment3DSPending'
const payment3DSReturnStorageKey = 'auroraPayment3DSReturn'

function getStorageScope() {
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

function readScopedValue(storageKey, scope) {
  if (!scope) {
    return null
  }

  const scopedMap = parseScopedMap(window.sessionStorage.getItem(storageKey))
  return scopedMap[scope] ?? null
}

function writeScopedValue(storageKey, scope, value) {
  if (!scope) {
    return
  }

  const scopedMap = parseScopedMap(window.sessionStorage.getItem(storageKey))

  if (value) {
    scopedMap[scope] = value
  } else {
    delete scopedMap[scope]
  }

  const entries = Object.entries(scopedMap).filter(([, entryValue]) => Boolean(entryValue))

  if (!entries.length) {
    window.sessionStorage.removeItem(storageKey)
    return
  }

  window.sessionStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(entries)))
}

function joinName(firstName, lastName) {
  return [String(firstName || '').trim(), String(lastName || '').trim()]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function joinAddressLines(addressLine1, addressLine2) {
  return [String(addressLine1 || '').trim(), String(addressLine2 || '').trim()]
    .filter(Boolean)
    .join('\n')
    .trim()
}

function maskManualCardNumber(value) {
  const digits = String(value || '').replace(/\D/g, '')

  if (digits.length < 4) {
    return 'Card ending unavailable'
  }

  return `•••• •••• •••• ${digits.slice(-4)}`
}

export function createOrderReference() {
  const seed = Date.now().toString(36).toUpperCase()
  return `AUR-${seed.slice(-6)}`
}

export function buildDeliverySummary(delivery) {
  return {
    ...delivery,
    fullName: joinName(delivery?.firstName, delivery?.lastName),
    address: joinAddressLines(delivery?.addressLine1, delivery?.addressLine2),
    city: delivery?.district || '',
  }
}

export function buildBillingSummary(billing) {
  return {
    ...billing,
    fullName: joinName(billing?.firstName, billing?.lastName),
    address: joinAddressLines(billing?.addressLine1, billing?.addressLine2),
    city: billing?.district || '',
  }
}

export function buildPaymentSummary({ payment, savedCards, selectedSavedCardId }) {
  if (selectedSavedCardId) {
    return {
      mode: 'saved',
      cardholder: 'Saved card',
      maskedCardNumber:
        maskSavedCard(savedCards.find((card) => card.id === selectedSavedCardId)) ||
        'Saved card',
      expiry: '',
    }
  }

  return {
    mode: 'manual',
    cardholder: payment?.cardholder || '',
    maskedCardNumber: maskManualCardNumber(payment?.cardNumber),
    expiry: payment?.expiry || '',
  }
}

export function createPending3DSCheckoutSnapshot({
  items,
  delivery,
  billing,
  useShippingAsBilling,
  selectedAddressId,
  selectedSavedCardId,
  payment,
  savedCards,
  saveCardForLater,
  selectedInstallments,
  installmentSelectionLabel,
  subtotal,
  serviceFee,
  taxTotal,
  installmentFee,
  total,
}) {
  const paymentSummary = buildPaymentSummary({
    payment,
    savedCards: Array.isArray(savedCards) ? savedCards : [],
    selectedSavedCardId,
  })

  if (installmentSelectionLabel) {
    paymentSummary.installmentLabel = installmentSelectionLabel
  }

  return {
    reference: createOrderReference(),
    submittedAt: new Date().toISOString(),
    items: Array.isArray(items) ? items : [],
    deliveryForm: { ...(delivery || {}) },
    deliverySummary: buildDeliverySummary(delivery || {}),
    billingForm: { ...(billing || {}) },
    billingSummary: useShippingAsBilling ? null : buildBillingSummary(billing || {}),
    useShippingAsBilling: Boolean(useShippingAsBilling),
    selectedAddressId: String(selectedAddressId || ''),
    selectedSavedCardId: String(selectedSavedCardId || ''),
    paymentForm: selectedSavedCardId
      ? null
      : {
          cardholder: String(payment?.cardholder || ''),
          expiry: String(payment?.expiry || ''),
        },
    selectedInstallments: selectedInstallments ? String(selectedInstallments) : '',
    paymentSummary,
    saveCardForLater: Boolean(saveCardForLater),
    subtotal: Number(subtotal) || 0,
    serviceFee: Number(serviceFee) || 0,
    taxTotal: Number(taxTotal) || 0,
    installmentFee: Number(installmentFee) || 0,
    total: Number(total) || 0,
  }
}

export function buildSubmittedOrderSnapshotFromPending(snapshot, paymentResponse) {
  if (!snapshot) {
    return null
  }

  return {
    reference: snapshot.reference || createOrderReference(),
    submittedAt: snapshot.submittedAt || new Date().toISOString(),
    items: Array.isArray(snapshot.items) ? snapshot.items : [],
    delivery: snapshot.deliverySummary || buildDeliverySummary(snapshot.deliveryForm || {}),
    billing:
      snapshot.billingSummary ||
      (snapshot.useShippingAsBilling ? null : buildBillingSummary(snapshot.billingForm || {})),
    payment: snapshot.paymentSummary || {
      cardholder: 'Secure payment',
      maskedCardNumber: 'Card ending unavailable',
      expiry: '',
    },
    subtotal: Number(snapshot.subtotal) || 0,
    serviceFee: Number(snapshot.installmentFee ?? snapshot.serviceFee) || 0,
    taxTotal: Number(snapshot.taxTotal) || 0,
    installmentFee: Number(snapshot.installmentFee ?? snapshot.serviceFee) || 0,
    total: Number(snapshot.total) || Number(snapshot.subtotal) || 0,
    status: 'Payment confirmed',
    paymentResponse,
    orderNumber: paymentResponse?.orderNumber || null,
  }
}

export function savePending3DSCheckoutSnapshot(snapshot) {
  const scope = getStorageScope()

  if (!scope || !snapshot) {
    return null
  }

  writeScopedValue(payment3DSPendingStorageKey, scope, snapshot)
  return snapshot
}

export function consumePending3DSCheckoutSnapshot() {
  const scope = getStorageScope()
  const snapshot = readScopedValue(payment3DSPendingStorageKey, scope)
  writeScopedValue(payment3DSPendingStorageKey, scope, null)
  return snapshot
}

export function saveCheckout3DSReturnState(state) {
  const scope = getStorageScope()

  if (!scope || !state) {
    return null
  }

  writeScopedValue(payment3DSReturnStorageKey, scope, state)
  return state
}

export function consumeCheckout3DSReturnState() {
  const scope = getStorageScope()
  const state = readScopedValue(payment3DSReturnStorageKey, scope)
  writeScopedValue(payment3DSReturnStorageKey, scope, null)
  return state
}

export function parse3DSCallbackResult(rawResult) {
  const normalized = String(rawResult || '')
    .trim()
    .replace(/ /g, '+')

  if (!normalized) {
    return {
      success: false,
      error: 'Secure payment result is missing.',
    }
  }

  try {
    const decoded = window.atob(normalized)
    const parsed = JSON.parse(decoded)

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid result payload')
    }

    return {
      success: true,
      result: parsed,
    }
  } catch {
    return {
      success: false,
      error: 'Secure payment result could not be verified.',
    }
  }
}

function decodeBase64Utf8(rawValue) {
  const normalized = String(rawValue || '')
    .trim()
    .replace(/ /g, '+')

  if (!normalized) {
    return ''
  }

  const binary = window.atob(normalized)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function extract3DSHtmlFromTarget(target) {
  const normalizedTarget = String(target || '').trim()
  const match = normalizedTarget.match(/^data:text\/html(?:;charset=[^;,]+)?;base64,(.+)$/i)

  if (!match) {
    return null
  }

  return decodeBase64Utf8(match[1])
}

export function open3DSTargetSameTab(target) {
  const normalizedTarget = String(target || '').trim()

  if (!normalizedTarget) {
    throw new Error('3D Secure was requested, but the payment page target was missing.')
  }

  const html = extract3DSHtmlFromTarget(normalizedTarget)

  if (!html) {
    window.location.assign(normalizedTarget)
    return
  }

  window.document.open('text/html', 'replace')
  window.document.write(html)
  window.document.close()
}
