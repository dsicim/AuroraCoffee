import { buildApiUrl } from './api'
import { getAuthSession } from './auth'
import {
  fetchProductsByIds,
  getProductCategoryLabel,
  getProductMetaLine,
} from './products'

export const ordersChangeEvent = 'aurora-orders-change'

export const orderProgressSteps = [
  { key: 'confirmed', label: 'Payment confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
]

const knownOrderStatuses = new Set([
  'initialized',
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
])

const orderStatusLabels = {
  initialized: 'Pending',
  pending: 'Pending',
  confirmed: 'Payment confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

let cachedOrders = []
let cachedOrdersScope = null
let cachedOrdersLoaded = false
let inFlightOrdersPromise = null
let inFlightOrdersScope = null
const cachedOrderDetails = new Map()
const inFlightOrderDetailPromises = new Map()

function getOrdersScope() {
  const session = getAuthSession()

  if (!session?.token) {
    return null
  }

  const scopeSource = session.email?.trim().toLowerCase() || session.token.trim()
  return encodeURIComponent(scopeSource)
}

function clearOrdersCache({ emit = false, type = 'clear' } = {}) {
  const hadState =
    cachedOrders.length > 0 ||
    cachedOrdersLoaded ||
    cachedOrdersScope !== null ||
    cachedOrderDetails.size > 0 ||
    inFlightOrdersPromise !== null ||
    inFlightOrderDetailPromises.size > 0

  cachedOrders = []
  cachedOrdersScope = null
  cachedOrdersLoaded = false
  inFlightOrdersPromise = null
  inFlightOrdersScope = null
  cachedOrderDetails.clear()
  inFlightOrderDetailPromises.clear()

  if (emit && hadState) {
    dispatchOrdersChange(type)
  }
}

function dispatchOrdersChange(type, orderId = '') {
  window.dispatchEvent(
    new CustomEvent(ordersChangeEvent, {
      detail: {
        type,
        orderId: String(orderId || ''),
      },
    }),
  )
}

function getAuthorizationHeaders() {
  const session = getAuthSession()
  return session?.token ? { authorization: session.token } : {}
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

function toNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const normalized = String(value ?? '')
    .replace(/[^0-9.,-]/g, '')
    .replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function joinName(firstName, lastName) {
  return [normalizeText(firstName), normalizeText(lastName)]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function ensureOrdersScope(scope) {
  if (cachedOrdersScope !== scope) {
    clearOrdersCache({ emit: true, type: 'scope' })
    cachedOrdersScope = scope
  }
}

async function requestOrdersJson(path = '', options = {}) {
  const response = await fetch(buildApiUrl(`/orders${path}`), {
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
    throw new Error(data?.e || payload?.e || 'Order request failed')
  }

  return data
}

function extractOrderRecord(record) {
  if (record?.order && typeof record.order === 'object') {
    return record.order
  }

  return record && typeof record === 'object' ? record : null
}

function normalizeOrderStatusKey(status) {
  const normalized = normalizeText(status).toLowerCase()
  return knownOrderStatuses.has(normalized) ? normalized : 'pending'
}

export function getOrderStatusPresentation(statusOrOrder) {
  const statusKey = normalizeOrderStatusKey(
    typeof statusOrOrder === 'string' ? statusOrOrder : statusOrOrder?.statusKey || statusOrOrder?.status,
  )

  return {
    key: statusKey,
    label: orderStatusLabels[statusKey] || orderStatusLabels.pending,
    isPending: statusKey === 'initialized' || statusKey === 'pending',
    isCancelled: statusKey === 'cancelled',
  }
}

export function getOrderProgressState(statusOrOrder) {
  const presentation = getOrderStatusPresentation(statusOrOrder)

  if (presentation.isCancelled) {
    return {
      ...presentation,
      stepStates: orderProgressSteps.map(() => 'cancelled'),
    }
  }

  if (presentation.isPending) {
    return {
      ...presentation,
      stepStates: orderProgressSteps.map(() => 'pending'),
    }
  }

  const activeIndex = orderProgressSteps.findIndex((step) => step.key === presentation.key)

  return {
    ...presentation,
    stepStates: orderProgressSteps.map((step, index) => {
      if (presentation.key === 'delivered') {
        return 'complete'
      }

      if (index < activeIndex) {
        return 'complete'
      }

      if (step.key === presentation.key) {
        return 'active'
      }

      return 'upcoming'
    }),
  }
}

function sortOrders(orders) {
  return [...orders].sort((left, right) => {
    const leftTime = Date.parse(left?.submittedAt || left?.createdAt || '')
    const rightTime = Date.parse(right?.submittedAt || right?.createdAt || '')

    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return rightTime - leftTime
    }

    return String(right?.id || '').localeCompare(String(left?.id || ''))
  })
}

function parseOrderOptions(rawValue) {
  if (!rawValue) {
    return null
  }

  if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    const entries = Object.entries(rawValue)
      .map(([key, value]) => [String(key || '').trim(), String(value ?? '').trim()])
      .filter(([key, value]) => Boolean(key && value))
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))

    return entries.length ? Object.fromEntries(entries) : null
  }

  if (typeof rawValue === 'string') {
    return parseOrderOptions(parseJson(rawValue, null))
  }

  return null
}

function normalizeOrderSummary(record) {
  const order = extractOrderRecord(record)

  if (!order?.id) {
    return null
  }

  const statusPresentation = getOrderStatusPresentation(order.status)

  return {
    id: String(order.id),
    reference: String(order.id),
    purchaseId: normalizeText(order.purchaseId),
    status: statusPresentation.key,
    statusKey: statusPresentation.key,
    statusLabel: statusPresentation.label,
    submittedAt: order.created_at || '',
    createdAt: order.created_at || '',
  }
}

function normalizeOrderAddress(address) {
  if (!address || typeof address !== 'object') {
    return null
  }

  const firstName = normalizeText(address.name)
  const lastName = normalizeText(address.surname)
  const addressLine1 = normalizeText(address.address)
  const addressLine2 = normalizeText(address.address2)
  const district = normalizeText(address.city)
  const province = normalizeText(address.province)
  const country = normalizeText(address.country) || 'Turkey'

  return {
    fullName: joinName(firstName, lastName),
    firstName,
    lastName,
    addressLine1,
    addressLine2,
    address: [addressLine1, addressLine2, district].filter(Boolean).join(', '),
    district,
    city: district,
    province,
    country,
    postalCode: normalizeText(address.zip),
    phone: normalizeText(address.phone),
  }
}

function normalizeOrderPayment(cardDetails, installment) {
  const bank = normalizeText(cardDetails?.bank)
  const family = normalizeText(cardDetails?.family)
  const provider = normalizeText(cardDetails?.provider)
  const alias = normalizeText(cardDetails?.alias)
  const last4dig = normalizeText(cardDetails?.last4dig)
  const pieces = [alias, family, provider, bank].filter(Boolean)

  return {
    alias,
    bank,
    family,
    provider,
    last4dig,
    maskedCardNumber: last4dig ? `•••• ${last4dig}` : 'Saved card',
    summary:
      pieces.join(' · ') ||
      (last4dig ? `Card ending ${last4dig}` : 'Secure payment'),
    installmentCount: Math.max(1, Number(installment) || 1),
  }
}

function normalizeOrderItem(rawItem, productById) {
  const productId = Number(rawItem?.product_id || rawItem?.productId || rawItem?.id) || null
  const product = productId ? productById.get(productId) : null
  const quantity = Math.max(1, Math.floor(rawItem?.quantity || rawItem?.qty) || 1)

  return {
    id: productId || String(rawItem?.id || rawItem?.product_id || crypto.randomUUID?.() || Math.random()),
    lineItemId: Number(rawItem?.id) || null,
    productId,
    productSlug: product?.slug || '',
    name: normalizeText(rawItem?.product_name || rawItem?.name) || product?.name || 'Product',
    category: normalizeText(rawItem?.category) || getProductCategoryLabel(product),
    typeLabel: product?.typeLabel || '',
    metaLine: normalizeText(rawItem?.metaLine) || getProductMetaLine(product) || '',
    price: toNumber(rawItem?.product_price || rawItem?.price || product?.price),
    quantity,
    imageUrl: normalizeText(rawItem?.image_url || rawItem?.imageUrl) || product?.imageUrl || '',
    options: parseOrderOptions(rawItem?.options || rawItem?.opt),
  }
}

async function normalizeOrderDetail(record) {
  const order = extractOrderRecord(record)
  const summary = normalizeOrderSummary(order)

  if (!summary) {
    return null
  }

  const details = order?.details && typeof order.details === 'object' ? order.details : {}
  const rawItems = Array.isArray(details.products) ? details.products : []
  const productIds = Array.from(
    new Set(
      rawItems
        .map((item) => Number(item?.product_id || item?.productId || item?.id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  )
  const products = productIds.length ? await fetchProductsByIds(productIds).catch(() => []) : []
  const productById = new Map(products.map((product) => [product.id, product]))
  const items = rawItems.map((item) => normalizeOrderItem(item, productById))
  const subtotal = toNumber(details?.price?.subtotal)
  const total = toNumber(details?.price?.total || details?.price?.paid || subtotal)

  return {
    ...summary,
    items,
    itemCount: items.reduce((totalCount, item) => totalCount + item.quantity, 0),
    delivery: normalizeOrderAddress(details.shippingAddress),
    billing: normalizeOrderAddress(details.billingAddress),
    payment: normalizeOrderPayment(details.card, details.installment),
    subtotal,
    serviceFee: Math.max(0, total - subtotal),
    total,
    currency: normalizeText(details.currency) || 'TRY',
  }
}

function persistResolvedOrders(orders, scope, { loaded = false } = {}) {
  cachedOrdersScope = scope
  cachedOrdersLoaded = loaded
  cachedOrders = sortOrders(orders)
  return cachedOrders
}

function mergeResolvedOrder(order, scope) {
  const merged = new Map()

  if (cachedOrdersScope === scope) {
    for (const currentOrder of cachedOrders) {
      merged.set(currentOrder.id, currentOrder)
    }
  }

  if (order?.id) {
    merged.set(order.id, {
      ...(merged.get(order.id) || {}),
      ...order,
    })
  }

  return persistResolvedOrders(Array.from(merged.values()), scope, {
    loaded: cachedOrdersLoaded,
  })
}

export function getCachedOrders() {
  return cachedOrdersScope === getOrdersScope() ? cachedOrders : []
}

export function getOrdersSnapshot() {
  if (cachedOrdersScope !== getOrdersScope()) {
    return {
      orders: [],
      loaded: false,
    }
  }

  return {
    orders: cachedOrders,
    loaded: cachedOrdersLoaded,
  }
}

export function getCachedOrderById(orderId) {
  const scope = getOrdersScope()

  if (!orderId || cachedOrdersScope !== scope) {
    return null
  }

  return cachedOrderDetails.get(`${scope}:${String(orderId)}`) || null
}

export async function fetchOrders({ force = false, revalidate = true } = {}) {
  const session = getAuthSession()
  const scope = getOrdersScope()

  if (!session?.token || !scope) {
    clearOrdersCache({ emit: true, type: 'clear' })
    return []
  }

  ensureOrdersScope(scope)

  if (!revalidate && !force && cachedOrdersLoaded) {
    return cachedOrders
  }

  if (!force && inFlightOrdersPromise && inFlightOrdersScope === scope) {
    return inFlightOrdersPromise
  }

  inFlightOrdersScope = scope
  inFlightOrdersPromise = requestOrdersJson('', { method: 'GET' })
    .then((payload) => {
      const serverOrders = Array.isArray(payload?.orders)
        ? payload.orders.map(normalizeOrderSummary).filter(Boolean)
        : []

      const resolvedOrders = serverOrders.map((summary) => {
        const cachedDetail = cachedOrderDetails.get(`${scope}:${summary.id}`)
        return cachedDetail ? { ...cachedDetail, ...summary } : summary
      })

      const nextOrders = persistResolvedOrders(resolvedOrders, scope, {
        loaded: true,
      })
      dispatchOrdersChange('list')
      return nextOrders
    })
    .finally(() => {
      if (inFlightOrdersScope === scope) {
        inFlightOrdersPromise = null
        inFlightOrdersScope = null
      }
    })

  return inFlightOrdersPromise
}

export async function fetchOrderById(orderId, { force = false } = {}) {
  const normalizedOrderId = String(orderId || '').trim()
  const session = getAuthSession()
  const scope = getOrdersScope()

  if (!normalizedOrderId || !session?.token || !scope) {
    if (!session?.token) {
      clearOrdersCache()
    }
    return null
  }

  ensureOrdersScope(scope)

  const cacheKey = `${scope}:${normalizedOrderId}`

  if (!force && cachedOrderDetails.has(cacheKey)) {
    return cachedOrderDetails.get(cacheKey) || null
  }

  if (!force && inFlightOrderDetailPromises.has(cacheKey)) {
    return inFlightOrderDetailPromises.get(cacheKey)
  }

  const request = requestOrdersJson(`?id=${encodeURIComponent(normalizedOrderId)}`, {
    method: 'GET',
  })
    .then(async (payload) => {
      const detailOrder = await normalizeOrderDetail(payload?.order)

      if (!detailOrder) {
        throw new Error('Order not found')
      }

      cachedOrderDetails.set(cacheKey, detailOrder)
      mergeResolvedOrder(detailOrder, scope)
      dispatchOrdersChange('detail', detailOrder.id)
      return detailOrder
    })
    .finally(() => {
      inFlightOrderDetailPromises.delete(cacheKey)
    })

  inFlightOrderDetailPromises.set(cacheKey, request)
  return request
}

export function invalidateOrdersCache() {
  clearOrdersCache({ emit: true, type: 'invalidate' })
}
