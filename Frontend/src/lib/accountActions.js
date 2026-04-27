import { addCartItem, getCartErrorMessage } from './cart'
import { findProductByReference, getProductAvailability } from './products'

function normalizeCode(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

function normalizeOptionCodes(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const entries = Object.entries(value)
    .map(([key, optionValue]) => [normalizeCode(key), normalizeCode(optionValue)])
    .filter(([key, optionValue]) => Boolean(key && optionValue))

  return entries.length ? Object.fromEntries(entries) : null
}

function getOrderLineName(item) {
  return item?.name || item?.product?.name || 'Unknown item'
}

function findOrderLineVariant(product, item) {
  const variants = Array.isArray(product?.variants) ? product.variants : []

  if (!variants.length) {
    return null
  }

  const variantId = Number(item?.variantId) || 0
  const variantCode = normalizeCode(item?.variantCode)

  if (variantId) {
    return variants.find((variant) => Number(variant?.id) === variantId) || null
  }

  if (variantCode) {
    return variants.find((variant) => normalizeCode(variant?.variantCode) === variantCode) || null
  }

  const optionCodes = normalizeOptionCodes(item?.optionCodes)

  if (!optionCodes) {
    return null
  }

  return variants.find((variant) => {
    const variantOptionCodes = normalizeOptionCodes(variant?.optionValueCodes)

    if (!variantOptionCodes) {
      return false
    }

    return Object.entries(optionCodes).every(
      ([groupKey, valueCode]) => variantOptionCodes[groupKey] === valueCode,
    )
  }) || null
}

async function normalizeOrderLine(item) {
  const product = await findProductByReference(item?.productSlug || item?.productId || item?.id)

  if (!product) {
    return null
  }

  const availability = getProductAvailability(product)

  if (!availability.hasStock) {
    return null
  }

  const variantRequired = Boolean(
    product?.variants?.length &&
    (item?.variantId || item?.variantCode || item?.optionCodes),
  )
  const matchingVariant = variantRequired ? findOrderLineVariant(product, item) : null

  if (variantRequired && (!matchingVariant || (Number(matchingVariant.stock) || 0) <= 0)) {
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
  let addedCount = 0

  for (const item of items || []) {
    const normalizedItem = await normalizeOrderLine(item)

    if (normalizedItem) {
      validEntries.push(normalizedItem)
    } else if (item?.name) {
      skippedItems.push(`${item.name} is no longer available`)
    } else {
      skippedItems.push('Unknown item is no longer available')
    }
  }

  if (validEntries.length) {
    for (const entry of validEntries) {
      try {
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
        addedCount += entry.quantity
      } catch (error) {
        skippedItems.push(`${getOrderLineName(entry)}: ${getCartErrorMessage(error)}`)
      }
    }
  }

  return {
    addedCount,
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
    return `Could not restore ${label}. ${result.skippedItems.join(', ')}.`
  }

  if (result.skippedItems.length) {
    return `${label} added to cart. Skipped ${result.skippedItems.join(', ')}.`
  }

  return `${label} added to cart.`
}

export function getRestoreFeedbackType(result) {
  return !result?.addedCount && result?.skippedItems?.length ? 'error' : 'success'
}
