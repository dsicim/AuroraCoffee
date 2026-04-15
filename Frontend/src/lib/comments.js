import { buildApiUrl } from './api'
import { getAuthSession } from './auth'

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getAuthorizationHeaders() {
  const session = getAuthSession()
  return session?.token ? { authorization: session.token } : {}
}

function toUiRating(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return 0
  }

  return Math.max(0.5, Math.min(5, Math.round(numericValue) / 2))
}

function toBackendRating(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return null
  }

  return Math.max(1, Math.min(10, Math.round(numericValue * 2)))
}

function normalizeCommentRecord(rawComment, index) {
  const author = normalizeText(rawComment?.name) || 'Anonymous'
  const comment = normalizeText(rawComment?.text)
  const createdAt = normalizeText(rawComment?.time)
  const editedAt = normalizeText(rawComment?.edit) || null
  const rating = toUiRating(rawComment?.rating)

  if (!comment || !rating) {
    return null
  }

  return {
    id: `${createdAt || 'comment'}:${author}:${index}`,
    author,
    comment,
    rating,
    backendRating: toBackendRating(rating),
    createdAt,
    editedAt,
  }
}

export class CommentRequestError extends Error {
  constructor(message, status = 500, details = null) {
    super(message)
    this.name = 'CommentRequestError'
    this.status = status
    this.details = details
  }
}

async function requestCommentsJson(path, options = {}) {
  const { auth = false, headers, ...fetchOptions } = options
  const response = await fetch(buildApiUrl(path), {
    ...fetchOptions,
    headers: {
      ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? getAuthorizationHeaders() : {}),
      ...(headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  const data = payload?.d ?? payload

  if (!response.ok || data?.e || payload?.e) {
    throw new CommentRequestError(
      data?.e || payload?.e || 'Comment request failed',
      response.status,
      data,
    )
  }

  return data
}

export async function fetchProductComments(productId) {
  const normalizedProductId = Number(productId)

  if (!Number.isFinite(normalizedProductId) || normalizedProductId <= 0) {
    return []
  }

  const payload = await requestCommentsJson(
    `/comments?id=${normalizedProductId}&approved=true`,
  )

  return Array.isArray(payload?.comments)
    ? payload.comments
        .map((comment, index) => normalizeCommentRecord(comment, index))
        .filter(Boolean)
    : []
}

export async function submitProductComment({
  productId,
  rating,
  comment,
  privacy,
}) {
  const normalizedProductId = Number(productId)
  const normalizedComment = normalizeText(comment)
  const normalizedPrivacy = normalizeText(privacy)
  const backendRating = toBackendRating(rating)

  if (!Number.isFinite(normalizedProductId) || normalizedProductId <= 0) {
    throw new CommentRequestError('Invalid product', 400)
  }

  if (!backendRating) {
    throw new CommentRequestError('Choose a valid rating', 400)
  }

  if (!normalizedComment) {
    throw new CommentRequestError('Comment cannot be empty', 400)
  }

  if (!normalizedPrivacy) {
    throw new CommentRequestError('Privacy setting is required', 400)
  }

  if (!getAuthSession()?.token) {
    throw new CommentRequestError('Unauthorized', 401)
  }

  return requestCommentsJson('/comments', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({
      id: normalizedProductId,
      rating: backendRating,
      comment: normalizedComment,
      privacy: normalizedPrivacy,
    }),
  })
}
