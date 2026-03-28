import {
  getDefaultVariant,
  getProductById,
  getVariantById,
} from '../data/products'
import { addCartVariants } from './cart'

function normalizeOrderLine(item) {
  const resolved = getVariantById(item?.id)

  if (!resolved?.product || !resolved.variant) {
    return null
  }

  return {
    product: resolved.product,
    variant: resolved.variant,
    quantity: Math.max(1, Math.floor(item.quantity) || 1),
    name: item.name || resolved.product.name,
  }
}

export function restoreOrderItemsToCart(items) {
  const validEntries = []
  const skippedItems = []

  for (const item of items || []) {
    const normalizedItem = normalizeOrderLine(item)

    if (normalizedItem) {
      validEntries.push(normalizedItem)
    } else if (item?.name) {
      skippedItems.push(item.name)
    } else {
      skippedItems.push('Unknown item')
    }
  }

  if (validEntries.length) {
    addCartVariants(validEntries)
  }

  return {
    addedCount: validEntries.reduce((total, item) => total + item.quantity, 0),
    skippedItems,
  }
}

export function addDefaultProductToCart(productId) {
  const product = getProductById(productId)

  if (!product) {
    return { status: 'missing' }
  }

  const variant = getDefaultVariant(product)

  if (!variant || variant.stock <= 0) {
    return { status: 'sold-out', product }
  }

  addCartVariants([{ product, variant, quantity: 1 }])

  return {
    status: 'added',
    product,
    variant,
  }
}

const orderStatusStages = [
  { thresholdHours: 2, label: 'Order received' },
  { thresholdHours: 12, label: 'Preparing' },
  { thresholdHours: 36, label: 'Out for delivery' },
  { thresholdHours: Number.POSITIVE_INFINITY, label: 'Delivered' },
]

export function getOrderStatus(order) {
  if (order?.status && order.status !== 'Demo order placed') {
    return order.status
  }

  const submittedAt = order?.submittedAt ? new Date(order.submittedAt).getTime() : Number.NaN

  if (!Number.isFinite(submittedAt)) {
    return 'Order received'
  }

  const elapsedHours = Math.max(0, (Date.now() - submittedAt) / 3600000)
  const nextStage =
    orderStatusStages.find((stage) => elapsedHours < stage.thresholdHours) ||
    orderStatusStages[orderStatusStages.length - 1]

  return nextStage.label
}

export function buildRestoreMessage(result, label) {
  if (!result.addedCount && result.skippedItems.length) {
    return `Could not restore ${label}. ${result.skippedItems.join(', ')} is no longer available.`
  }

  if (result.skippedItems.length) {
    return `${label} added to cart. Skipped ${result.skippedItems.join(', ')} because it is no longer available.`
  }

  return `${label} added to cart.`
}
