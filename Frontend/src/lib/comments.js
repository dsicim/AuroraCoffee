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

function normalizeManagerCommentSnapshot(snapshot, index, suffix) {
  const author = normalizeText(snapshot?.name) || 'Anonymous'
  const comment = normalizeText(snapshot?.text)
  const createdAt = normalizeText(snapshot?.time)
  const editedAt = normalizeText(snapshot?.edit) || null
  const backendRating = Number(snapshot?.rating)
  const rating = toUiRating(backendRating)

  if (!comment || !rating) {
    return null
  }

  return {
    id: `${createdAt || 'comment'}:${author}:${suffix}:${index}`,
    author,
    comment,
    rating,
    backendRating: Number.isFinite(backendRating) ? backendRating : toBackendRating(rating),
    createdAt,
    editedAt,
  }
}

function normalizeManagerCommentRecord(rawComment, index, scope) {
  if (scope === 'approved') {
    const existing = normalizeCommentRecord(rawComment, index)

    if (!existing) {
      return null
    }

    return {
      id: existing.id,
      meta: {
        id: null,
        userId: null,
        userName: existing.author,
        status: 'approved',
      },
      existing,
      upcoming: null,
    }
  }

  const meta = rawComment?.comment && typeof rawComment.comment === 'object'
    ? rawComment.comment
    : {}
  const existing = normalizeManagerCommentSnapshot(rawComment?.existing, index, 'existing')
  const upcoming = normalizeManagerCommentSnapshot(rawComment?.upcoming, index, 'upcoming')
  const status = normalizeText(meta?.status) || (upcoming ? 'pending' : 'approved')
  const id = Number(meta?.id) || null
  const userId = Number(meta?.user_id) || null
  const userName =
    normalizeText(meta?.user_name) ||
    existing?.author ||
    upcoming?.author ||
    'Anonymous'

  if (!existing && !upcoming) {
    return null
  }

  return {
    id: String(id || `${status}:${userName}:${index}`),
    meta: {
      id,
      userId,
      userName,
      status,
    },
    existing,
    upcoming,
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
  const { headers, ...fetchOptions } = options
  const response = await fetch(buildApiUrl(path), {
    ...fetchOptions,
    headers: {
      ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...getAuthorizationHeaders(),
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

function requireAuthSession() {
  if (!getAuthSession()?.token) {
    throw new CommentRequestError('Unauthorized', 401)
  }
}

export async function fetchApprovedProductComments(productId) {
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

export async function fetchManagerProductComments(productId, scope = 'pending') {
  const normalizedProductId = Number(productId)

  if (!Number.isFinite(normalizedProductId) || normalizedProductId <= 0) {
    return []
  }

  requireAuthSession()

  const normalizedScope =
    scope === 'approved'
      ? 'approved'
      : scope === 'all'
        ? 'all'
        : 'pending'
  const path =
    normalizedScope === 'approved'
      ? `/comments?id=${normalizedProductId}&approved=true`
      : normalizedScope === 'all'
        ? `/comments?id=${normalizedProductId}`
        : `/comments/pending?id=${normalizedProductId}`
  const payload = await requestCommentsJson(path)

  return Array.isArray(payload?.comments)
    ? payload.comments
        .map((comment, index) => normalizeManagerCommentRecord(comment, index, normalizedScope))
        .filter(Boolean)
    : []
}

export async function fetchProductComments(productId) {
  return fetchApprovedProductComments(productId)
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

  requireAuthSession()

  return requestCommentsJson('/comments', {
    method: 'POST',
    body: JSON.stringify({
      id: normalizedProductId,
      rating: backendRating,
      comment: normalizedComment,
      privacy: normalizedPrivacy,
    }),
  })
}
