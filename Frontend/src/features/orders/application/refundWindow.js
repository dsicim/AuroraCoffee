export const refundRequestWindowMs = 30 * 24 * 60 * 60 * 1000

export function isRefundRequestWindowOpen(order, now = Date.now()) {
  const submittedAt = Date.parse(order?.submittedAt || order?.createdAt || '')

  if (!Number.isFinite(submittedAt)) {
    return true
  }

  return now - submittedAt <= refundRequestWindowMs
}
