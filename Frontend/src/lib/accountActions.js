import { addCartItem } from './cart'
import { findProductByReference, getProductAvailability } from './products'

async function normalizeOrderLine(item) {
  const product = await findProductByReference(item?.productSlug || item?.productId || item?.id)

  if (!product) {
    return null
  }

  return {
    product,
    quantity: Math.max(1, Math.floor(item.quantity) || 1),
    name: item.name || product.name,
    options: item?.options && typeof item.options === 'object' ? item.options : null,
    optionCodes: item?.optionCodes && typeof item.optionCodes === 'object' ? item.optionCodes : null,
    variantId: Number(item?.variantId) || null,
    variantCode: typeof item?.variantCode === 'string' ? item.variantCode : '',
  }
}

export async function restoreOrderItemsToCart(items) {
  const validEntries = []
  const skippedItems = []

  for (const item of items || []) {
    const normalizedItem = await normalizeOrderLine(item)

    if (normalizedItem) {
      validEntries.push(normalizedItem)
    } else if (item?.name) {
      skippedItems.push(item.name)
    } else {
      skippedItems.push('Unknown item')
    }
  }

  if (validEntries.length) {
    for (const entry of validEntries) {
      await addCartItem(
        {
          ...entry.product,
          ...(entry.options ? { options: entry.options } : {}),
          ...(entry.optionCodes ? { optionCodes: entry.optionCodes } : {}),
          ...(entry.variantId ? { variantId: entry.variantId } : {}),
          ...(entry.variantCode ? { variantCode: entry.variantCode } : {}),
        },
        entry.quantity,
      )
    }
  }

  return {
    addedCount: validEntries.reduce((total, item) => total + item.quantity, 0),
    skippedItems,
  }
}

export async function addDefaultProductToCart(productReference) {
  const product = await findProductByReference(productReference)

  if (!product) {
    return { status: 'missing' }
  }

  const availability = getProductAvailability(product)

  if (!availability.hasStock) {
    return { status: 'sold-out', product }
  }

  await addCartItem(product, 1)

  return {
    status: 'added',
    product,
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
