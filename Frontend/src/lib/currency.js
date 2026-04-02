export function formatCurrency(amount) {
  const numericAmount =
    typeof amount === 'number'
      ? amount
      : Number.parseFloat(String(amount ?? '').replace(/[^0-9.-]/g, ''))

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericAmount) ? numericAmount : 0)
}
