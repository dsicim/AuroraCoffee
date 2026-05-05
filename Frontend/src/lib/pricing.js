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

export function formatDiscountRate(value) {
  const normalizedValue = Number(value) || 0

  return Number.isInteger(normalizedValue)
    ? normalizedValue.toString()
    : normalizedValue.toFixed(1).replace(/\.0$/, '')
}
