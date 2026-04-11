const taxRateByClass = {
  coffee_packaged: 0.01,
  accessory_general: 0.2,
  food_other: 0.1,
  service_food: 0.1,
}

const coffeeCategoryNames = new Set([
  'coffee',
  'single origin',
  'blend',
  'espresso',
  'filter coffee',
])

const accessoryCategoryNames = new Set([
  'accessories',
  'french press',
  'mug',
  'thermos',
  'filter paper',
  'grinder',
  'brewing equipment',
])

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function toMinorUnits(amount) {
  return Math.round((Number(amount) || 0) * 100)
}

function fromMinorUnits(amount) {
  return amount / 100
}

function normalizeTaxRate(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null
  }

  return numericValue > 1 ? numericValue / 100 : numericValue
}

function inferTaxClass(item) {
  const parentCategoryName = normalizeText(item?.parentCategoryName)
  const categoryName = normalizeText(item?.categoryName || item?.category)

  if (
    parentCategoryName === 'coffee' ||
    categoryName.includes('coffee') ||
    coffeeCategoryNames.has(categoryName) ||
    Boolean(item?.roastLevel || item?.origin || item?.flavorNotes)
  ) {
    return 'coffee_packaged'
  }

  if (
    parentCategoryName === 'accessories' ||
    categoryName.includes('accessor') ||
    accessoryCategoryNames.has(categoryName)
  ) {
    return 'accessory_general'
  }

  return 'accessory_general'
}

function splitGrossAmount(grossAmount, taxRate) {
  const grossMinor = Math.max(0, toMinorUnits(grossAmount))

  if (!(taxRate > 0)) {
    return {
      gross: fromMinorUnits(grossMinor),
      net: fromMinorUnits(grossMinor),
      tax: 0,
    }
  }

  const netMinor = Math.round(grossMinor / (1 + taxRate))
  const taxMinor = grossMinor - netMinor

  return {
    gross: fromMinorUnits(grossMinor),
    net: fromMinorUnits(netMinor),
    tax: fromMinorUnits(taxMinor),
  }
}

export function getTaxClass(item) {
  const explicitTaxClass = normalizeText(item?.taxClass)
  return explicitTaxClass || inferTaxClass(item)
}

export function getTaxRate(item) {
  const overrideRate = normalizeTaxRate(item?.taxRateOverride)

  if (overrideRate !== null) {
    return overrideRate
  }

  return taxRateByClass[getTaxClass(item)] || taxRateByClass.accessory_general
}

export function formatTaxRate(rate) {
  return `${Math.round(getTaxRate({ taxRateOverride: rate }) * 100)}%`
}

export function getTaxInclusionCopy(item) {
  return `Includes ${formatTaxRate(getTaxRate(item))} KDV`
}

export function getUnitPriceBreakdown(item) {
  const taxRate = getTaxRate(item)
  const price = splitGrossAmount(item?.price, taxRate)

  return {
    taxClass: getTaxClass(item),
    taxRate,
    priceGross: price.gross,
    priceNet: price.net,
    taxAmount: price.tax,
  }
}

export function getLinePriceBreakdown(item, quantity = item?.quantity || 1) {
  const taxRate = getTaxRate(item)
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1))
  const lineGrossMinor = Math.max(0, toMinorUnits(item?.price) * safeQuantity)
  const lineNetMinor = taxRate > 0 ? Math.round(lineGrossMinor / (1 + taxRate)) : lineGrossMinor
  const lineTaxMinor = lineGrossMinor - lineNetMinor
  const unitBreakdown = getUnitPriceBreakdown(item)

  return {
    ...unitBreakdown,
    quantity: safeQuantity,
    lineGross: fromMinorUnits(lineGrossMinor),
    lineNet: fromMinorUnits(lineNetMinor),
    lineTax: fromMinorUnits(lineTaxMinor),
  }
}

export function getItemsPriceBreakdown(items, { payableTotal = null } = {}) {
  const lineItems = (items || []).map((item) => getLinePriceBreakdown(item))
  const itemsGrossMinor = lineItems.reduce((total, item) => total + toMinorUnits(item.lineGross), 0)
  const itemsNetMinor = lineItems.reduce((total, item) => total + toMinorUnits(item.lineNet), 0)
  const taxTotalMinor = lineItems.reduce((total, item) => total + toMinorUnits(item.lineTax), 0)
  const totalChargedMinor = payableTotal === null
    ? itemsGrossMinor
    : Math.max(0, toMinorUnits(payableTotal))
  const installmentFeeMinor = Math.max(0, totalChargedMinor - itemsGrossMinor)

  return {
    lineItems,
    itemsGross: fromMinorUnits(itemsGrossMinor),
    itemsNet: fromMinorUnits(itemsNetMinor),
    taxTotal: fromMinorUnits(taxTotalMinor),
    installmentFee: fromMinorUnits(installmentFeeMinor),
    totalCharged: fromMinorUnits(totalChargedMinor),
  }
}
