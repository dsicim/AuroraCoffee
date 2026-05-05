export function getDiscountPricing(product) {
  const originalPrice = Number(product?.price) || 0
  const discountRate = Number(product?.discountRate) || 0

  if (originalPrice <= 0 || discountRate <= 0) {
    return {
      hasDiscount: false,
      originalPrice,
      currentPrice: originalPrice,
      discountRate: 0,
    }
  }

  const boundedDiscountRate = Math.min(discountRate, 100)
  const currentPrice = originalPrice * (1 - boundedDiscountRate / 100)

  return {
    hasDiscount: currentPrice < originalPrice,
    originalPrice,
    currentPrice,
    discountRate: boundedDiscountRate,
  }
}

export function getProductStartingPrice(product) {
  const prices = [Number(product?.price)]

  if (Array.isArray(product?.variants)) {
    for (const variant of product.variants) {
      prices.push(Number(variant?.price))
    }
  }

  const validPrices = prices.filter((price) => Number.isFinite(price) && price >= 0)

  if (!validPrices.length) {
    return 0
  }

  return Math.min(...validPrices)
}

export function hasPriceChangingChoices(product) {
  const variantPrices = Array.isArray(product?.variants)
    ? product.variants
        .map((variant) => Number(variant?.price))
        .filter((price) => Number.isFinite(price))
    : []
  const uniqueVariantPrices = new Set(variantPrices.map((price) => Math.round(price * 100)))

  if (uniqueVariantPrices.size > 1) {
    return true
  }

  return (product?.options || []).some((group) =>
    (group?.values || []).some((value) => {
      const priceAdd = Number(value?.priceAdd) || 0
      const priceMult = Number(value?.priceMult) || 1

      return priceAdd !== 0 || priceMult !== 1
    }),
  )
}

export function formatDiscountRate(value) {
  const normalizedValue = Number(value) || 0

  return Number.isInteger(normalizedValue)
    ? normalizedValue.toString()
    : normalizedValue.toFixed(1).replace(/\.0$/, '')
}
