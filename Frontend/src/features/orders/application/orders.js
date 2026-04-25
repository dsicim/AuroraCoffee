import { getAuthSession } from '../../auth/application/auth'
import { fetchAuthJson } from '../../../lib/authRequest'
import {
  fetchProductsByIds,
  getProductCategoryLabel,
  getProductMetaLine,
} from '../../../lib/products'
import { getItemsPriceBreakdown } from '../../../lib/tax'

export const ordersChangeEvent = 'aurora-orders-change'

export const orderProgressSteps = [
  { key: 'confirmed', label: 'Payment confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
]

const MAX_CACHED_ORDER_DETAILS = 30

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

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  const normalized = String(value ?? '')
    .replace(/[^0-9.,-]/g, '')
    .replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
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
  const { response, payload, data } = await fetchAuthJson(`/orders${path}`, {
    ...options,
    json: true,
  })

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

function findMatchingProductOptionGroup(product, key) {
  const normalizedKey = normalizeText(key).toLowerCase()

  return (product?.options || []).find((group) => {
    const candidates = [group?.code, group?.id, group?.name]
      .map((value) => normalizeText(value).toLowerCase())
      .filter(Boolean)

    return candidates.includes(normalizedKey)
  }) || null
}

function decodeVariantSelectionCodes(variantCode) {
  const normalizedVariantCode = normalizeText(variantCode)

  if (!normalizedVariantCode) {
    return null
  }

  try {
    const decoder =
      typeof atob === 'function'
        ? atob
        : typeof window !== 'undefined' && typeof window.atob === 'function'
          ? window.atob.bind(window)
          : null

    if (!decoder) {
      return null
    }

    return parseOrderOptions(decoder(normalizedVariantCode))
  } catch {
    return null
  }
}

function getVariantSelectionCodes(product, variantCode) {
  const normalizedVariantCode = normalizeText(variantCode)

  if (!normalizedVariantCode) {
    return null
  }

  const matchingVariant =
    product?.variants?.find(
      (entry) => normalizeText(entry?.variantCode) === normalizedVariantCode,
    ) || null

  return (
    parseOrderOptions(matchingVariant?.optionValueCodes) ||
    decodeVariantSelectionCodes(normalizedVariantCode)
  )
}

function mapOrderOptionsForDisplay(product, options, variantCode = '') {
  const parsedOptions = parseOrderOptions(options)
  const variantOptions = getVariantSelectionCodes(product, variantCode)

  if (!parsedOptions && !variantOptions) {
    return null
  }

  const entries = []

  for (const [groupCode, valueCode] of Object.entries(parsedOptions || {})) {
    const group = findMatchingProductOptionGroup(product, groupCode)
    const value = (group?.values || []).find(
      (optionValue) => normalizeText(optionValue?.valueCode) === normalizeText(valueCode),
    )

    entries.push([group?.name || groupCode, value?.label || valueCode])
  }

  for (const [groupCode, valueCode] of Object.entries(variantOptions || {})) {
    const group = findMatchingProductOptionGroup(product, groupCode)

    if (!group?.storeAsVariant) {
      continue
    }

    const value = (group?.values || []).find(
      (optionValue) => normalizeText(optionValue?.valueCode) === normalizeText(valueCode),
    )

    entries.push([group?.name || groupCode, value?.label || valueCode])
  }

  return entries.length ? Object.fromEntries(entries) : null
}

function normalizeOrderSummary(record) {
  const order = extractOrderRecord(record)

  return toOrderSummaryEntry(order)
}

function toOrderSummaryEntry(order) {
  if (!order?.id) {
    return null
  }

  const statusPresentation = getOrderStatusPresentation(
    order.statusKey || order.status,
  )
  const submittedAt =
    normalizeText(order.submittedAt) ||
    normalizeText(order.createdAt) ||
    normalizeText(order.created_at)
  const purchaseId =
    normalizeText(order.purchaseId) ||
    normalizeText(order.purchase_id)

  return {
    id: String(order.id),
    reference: String(order.reference || order.id),
    purchaseId,
    status: statusPresentation.key,
    statusKey: statusPresentation.key,
    statusLabel: statusPresentation.label,
    submittedAt,
    createdAt: submittedAt,
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
  const installmentCount = Math.max(
    1,
    Number(
      installment?.months ??
      installment?.installmentNumber ??
      installment,
    ) || 1,
  )
  const installmentPerMonth = toNullableNumber(
    installment?.permonth ?? installment?.installmentPrice,
  )
  const installmentTotal = toNullableNumber(
    installment?.total ?? installment?.totalPrice,
  )

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
    installmentCount,
    installmentPerMonth,
    installmentTotal,
  }
}

function normalizeOrderItem(rawItem, productById) {
  const productId = Number(rawItem?.product_id || rawItem?.productId || rawItem?.id) || null
  const product = productId ? productById.get(productId) : null
  const variantId = Number(rawItem?.variant_id || rawItem?.variantId) || null
  const variant =
    variantId && product?.variants?.length
      ? product.variants.find((entry) => Number(entry.id) === variantId) || null
      : null
  const quantity = Math.max(1, Math.floor(rawItem?.quantity || rawItem?.qty) || 1)
  const variantCode =
    normalizeText(rawItem?.variant_code || rawItem?.variantCode) ||
    normalizeText(variant?.variantCode)
  const optionCodes = parseOrderOptions(rawItem?.options || rawItem?.opt)

  return {
    id: productId || String(rawItem?.id || rawItem?.product_id || crypto.randomUUID?.() || Math.random()),
    lineItemId: Number(rawItem?.id) || null,
    productId,
    variantId,
    variantCode,
    productSlug: product?.slug || '',
    name: normalizeText(rawItem?.product_name || rawItem?.name) || product?.name || 'Product',
    category: normalizeText(rawItem?.category) || getProductCategoryLabel(product),
    parentCategoryName: normalizeText(rawItem?.parent_category_name || rawItem?.parentCategoryName) || product?.parentCategoryName || '',
    typeLabel: product?.typeLabel || '',
    metaLine: normalizeText(rawItem?.metaLine) || getProductMetaLine(product) || '',
    price: toNumber(rawItem?.product_price || rawItem?.price || product?.price),
    taxRate: toNullableNumber(rawItem?.tax_rate ?? rawItem?.taxRate ?? rawItem?.tax ?? product?.taxRate),
    taxClass: normalizeText(rawItem?.tax_class || rawItem?.taxClass) || product?.taxClass || '',
    taxRateOverride: rawItem?.tax_rate_override ?? rawItem?.taxRateOverride ?? product?.taxRateOverride ?? null,
    priceNet: toNullableNumber(rawItem?.price_net ?? rawItem?.priceNet ?? rawItem?.subtotal ?? product?.priceNet),
    taxAmount: toNullableNumber(rawItem?.tax_amount ?? rawItem?.taxAmount ?? product?.taxAmount),
    quantity,
    imageUrl: normalizeText(rawItem?.image_url || rawItem?.imageUrl) || product?.imageUrl || '',
    options: mapOrderOptionsForDisplay(product, optionCodes, variantCode) || optionCodes,
    optionCodes,
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
  const pricing = getItemsPriceBreakdown(items, { payableTotal: total })

  return {
    ...summary,
    items,
    itemCount: items.reduce((totalCount, item) => totalCount + item.quantity, 0),
    delivery: normalizeOrderAddress(details.shippingAddress),
    billing: normalizeOrderAddress(details.billingAddress),
    payment: normalizeOrderPayment(details.card, details.installment),
    subtotal: subtotal || pricing.itemsGross,
    serviceFee: pricing.installmentFee,
    taxTotal: pricing.taxTotal,
    installmentFee: pricing.installmentFee,
    pricing,
    total: total || pricing.totalCharged,
    currency: normalizeText(details.currency) || 'TRY',
  }
}

function persistResolvedOrders(orders, scope, { loaded = false } = {}) {
  cachedOrdersScope = scope
  cachedOrdersLoaded = loaded
  cachedOrders = sortOrders(
    (orders || []).map(toOrderSummaryEntry).filter(Boolean),
  )
  return cachedOrders
}

function mergeResolvedOrder(order, scope) {
  const summary = toOrderSummaryEntry(order)

  if (!summary) {
    return persistResolvedOrders(cachedOrders, scope, {
      loaded: cachedOrdersLoaded,
    })
  }

  const merged = new Map()

  if (cachedOrdersScope === scope) {
    for (const currentOrder of cachedOrders) {
      merged.set(currentOrder.id, currentOrder)
    }
  }

  merged.set(summary.id, {
    ...(merged.get(summary.id) || {}),
    ...summary,
  })

  return persistResolvedOrders(Array.from(merged.values()), scope, {
    loaded: cachedOrdersLoaded,
  })
}

function readCachedOrderDetail(cacheKey) {
  const detail = cachedOrderDetails.get(cacheKey) || null

  if (!detail) {
    return null
  }

  cachedOrderDetails.delete(cacheKey)
  cachedOrderDetails.set(cacheKey, detail)
  return detail
}

function writeCachedOrderDetail(cacheKey, detail) {
  cachedOrderDetails.delete(cacheKey)
  cachedOrderDetails.set(cacheKey, detail)

  while (cachedOrderDetails.size > MAX_CACHED_ORDER_DETAILS) {
    const oldestCacheKey = cachedOrderDetails.keys().next().value

    if (oldestCacheKey === undefined) {
      break
    }

    cachedOrderDetails.delete(oldestCacheKey)
  }
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

  return readCachedOrderDetail(`${scope}:${String(orderId)}`)
}

export async function fetchOrders({ force = false } = {}) {
  const session = getAuthSession()
  const scope = getOrdersScope()

  if (!session?.token || !scope) {
    clearOrdersCache({ emit: true, type: 'clear' })
    return []
  }

  ensureOrdersScope(scope)

  if (!force && cachedOrdersLoaded) {
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
      const nextOrders = persistResolvedOrders(serverOrders, scope, {
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

  if (!force) {
    const cachedDetail = readCachedOrderDetail(cacheKey)

    if (cachedDetail) {
      return cachedDetail
    }
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

      writeCachedOrderDetail(cacheKey, detailOrder)
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
