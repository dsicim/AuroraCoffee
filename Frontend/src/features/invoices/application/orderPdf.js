import { getAuthSession } from '../../auth/application/auth'
import { fetchAuthResponse } from '../../../lib/authRequest'

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function sanitizeDownloadFilename(value, fallback = 'aurora-order.pdf') {
  const normalized = normalizeText(value)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || fallback
}

function getFilenameFromContentDisposition(headerValue) {
  const header = normalizeText(headerValue)

  if (!header) {
    return ''
  }

  const encodedMatch = header.match(/filename\*=UTF-8''([^;]+)/i)

  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1].replace(/^"|"$/g, ''))
    } catch {
      return encodedMatch[1].replace(/^"|"$/g, '')
    }
  }

  const filenameMatch = header.match(/filename="?([^";]+)"?/i)
  return filenameMatch?.[1]?.trim() || ''
}

async function getPdfErrorMessage(response) {
  const contentType = (response.headers.get('content-type') || '').toLowerCase()

  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => ({}))
    const data = payload?.d ?? payload
    return data?.e || payload?.e || data?.message || payload?.message || 'PDF download failed'
  }

  const message = await response.text().catch(() => '')
  return message.trim() || 'PDF download failed'
}

export async function downloadOrderPdf(orderId) {
  const normalizedOrderId = String(orderId || '').trim()
  const session = getAuthSession()

  if (!normalizedOrderId) {
    throw new Error('Order ID is required before downloading a PDF.')
  }

  if (!session?.token) {
    throw new Error('Sign in again to download this order PDF.')
  }

  const response = await fetchAuthResponse(`/orders/pdf?id=${encodeURIComponent(normalizedOrderId)}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      accept: 'application/pdf, application/json;q=0.8',
    },
  })
  const contentType = (response.headers.get('content-type') || '').toLowerCase()

  if (!response.ok || contentType.includes('application/json')) {
    throw new Error(await getPdfErrorMessage(response))
  }

  const rawBlob = await response.blob()

  if (!rawBlob.size) {
    throw new Error('The PDF response was empty.')
  }

  const filename =
    sanitizeDownloadFilename(
      getFilenameFromContentDisposition(response.headers.get('content-disposition')) ||
      `aurora-order-${normalizedOrderId}.pdf`,
    )
  const blob = rawBlob.type === 'application/pdf'
    ? rawBlob
    : new Blob([rawBlob], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)

  return {
    orderId: normalizedOrderId,
    filename: link.download,
  }
}
