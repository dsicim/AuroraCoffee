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
