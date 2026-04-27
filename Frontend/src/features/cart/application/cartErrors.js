export function buildCartErrorMessage(details, fallback = 'Could not add this item to cart.') {
  if (typeof details === 'string') {
    return details.trim() || fallback
  }

  if (details instanceof Error) {
    return buildCartErrorMessage(details.message, fallback)
  }

  if (details && typeof details === 'object') {
    if (details.e && details.e !== details) {
      return buildCartErrorMessage(details.e, fallback)
    }

    const message = details.message || details.error || details.msg || details.detail

    if (message) {
      return buildCartErrorMessage(message, fallback)
    }

    const parts = [details.what, details.why, details.resolution]
      .map((value) => String(value || '').trim())
      .filter(Boolean)

    if (parts.length) {
      return parts.join(' - ')
    }
  }

  return fallback
}
