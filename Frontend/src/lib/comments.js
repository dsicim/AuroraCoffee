import { buildApiUrl } from './api'
import { getAuthSession, getCurrentUserSnapshot } from './auth'

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

function normalizeCommentRecord(rawComment, index, suffix = 'comment') {
  const author = normalizeText(rawComment?.name) || 'Anonymous'
  const comment = normalizeText(rawComment?.text)
  const createdAt = normalizeText(rawComment?.time)
  const editedAt = normalizeText(rawComment?.edit) || null
  const rating = toUiRating(rawComment?.rating)

  if (!comment || !rating) {
    return null
  }

  return {
    id: `${createdAt || 'comment'}:${suffix}:${author}:${index}`,
    author,
    comment,
    rating,
    backendRating: toBackendRating(rating),
    createdAt,
    editedAt,
    visibilityFlag: rawComment?.visible === true,
  }
}

function toPublicComment(snapshot) {
  if (!snapshot) {
    return null
  }

  const { visibilityFlag: _visibilityFlag, ...comment } = snapshot
  return comment
}

function inferPrivacyMode(authorName) {
  const normalizedAuthorName = normalizeText(authorName)
  const currentUserDisplayName = normalizeText(getCurrentUserSnapshot()?.user?.displayname)

  if (normalizedAuthorName === 'Anonymous') {
    return 'anonymous'
  }

  if (currentUserDisplayName && normalizedAuthorName === currentUserDisplayName) {
    return 'full'
  }

  return 'initials'
}

function getApprovedSelfCommentStatus(record, currentVisible, hasPendingSnapshot) {
  if (hasPendingSnapshot) {
    return record.pending === true ? 'pending_edit' : 'edit_rejected'
  }

  if (currentVisible) {
    return 'approved'
  }

  return record.pending === true ? 'pending' : 'rejected'
}

function normalizeApprovedCommentEntry(rawComment, index) {
  const record = rawComment && typeof rawComment === 'object' ? rawComment : {}
  const hasCurrentSnapshot = Object.prototype.hasOwnProperty.call(record, 'c')
  const hasPendingSnapshot = Object.prototype.hasOwnProperty.call(record, 'e')
  const currentSnapshot = normalizeCommentRecord(
    hasCurrentSnapshot ? record.c : record,
    index,
    'current',
  )
  const pendingSnapshot = normalizeCommentRecord(
    hasPendingSnapshot ? record.e : null,
    index,
    'pending',
  )
  const explicitSelfFlag = record.self === true
  const currentVisible =
    record.visible === true ||
    (record.visible !== false && currentSnapshot?.visibilityFlag === true)
  const explicitSelf =
    explicitSelfFlag ||
    hasPendingSnapshot ||
    (hasCurrentSnapshot && record.c === null) ||
    currentSnapshot?.visibilityFlag === true

  if (explicitSelf) {
    const visibleSnapshot = currentVisible ? toPublicComment(currentSnapshot) : null
    const editableDraftSnapshot =
      toPublicComment(pendingSnapshot) ||
      (explicitSelfFlag && currentSnapshot && !currentVisible
        ? toPublicComment(currentSnapshot)
        : null)
    const prefillSource = editableDraftSnapshot || visibleSnapshot || null
    const status = getApprovedSelfCommentStatus(record, currentVisible, hasPendingSnapshot)

    return {
      comment: null,
      selfComment: {
        status,
        prefill: {
          comment: prefillSource?.comment || '',
          rating: prefillSource?.rating || 0,
          privacyMode: inferPrivacyMode(prefillSource?.author),
        },
        visibleSnapshot,
        pendingSnapshot: editableDraftSnapshot,
        draftAvailable: Boolean(prefillSource),
      },
    }
  }

  return {
    comment: toPublicComment(currentSnapshot),
    selfComment: null,
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
  const record = rawComment && typeof rawComment === 'object' ? rawComment : {}

  if (scope === 'approved') {
    if (record.self === true && record.visible === false) {
      return null
    }

    const existing = toPublicComment(
      normalizeCommentRecord(record?.c || record, index, 'approved'),
    )

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

  const existing = normalizeManagerCommentSnapshot(record?.c, index, 'existing')
  const upcoming = normalizeManagerCommentSnapshot(record?.e, index, 'upcoming')
  const status = normalizeText(record?.status) || (upcoming ? 'pending' : 'approved')

  if (scope === 'pending' && record.self === true && status === 'approved') {
    return null
  }

  const id = Number(record?.id) || null
  const userId = Number(record?.user_id) || null
  const userName =
    normalizeText(record?.user_name) ||
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
    return { comments: [], selfComment: null }
  }

  const payload = await requestCommentsJson(
    `/comments/approved?id=${normalizedProductId}&actAsUser=true`,
  )

  if (!Array.isArray(payload?.comments)) {
    return { comments: [], selfComment: null }
  }

  const result = {
    comments: [],
    selfComment: null,
  }

  payload.comments.forEach((comment, index) => {
    const normalizedEntry = normalizeApprovedCommentEntry(comment, index)

    if (normalizedEntry.comment) {
      result.comments.push(normalizedEntry.comment)
    }

    if (!result.selfComment && normalizedEntry.selfComment) {
      result.selfComment = normalizedEntry.selfComment
    }
  })

  return result
}

export async function fetchManagerProductComments(productId, scope = 'pending') {
  const requestedProductId = String(productId || '').trim().toLowerCase()
  const normalizedProductId =
    requestedProductId === 'all'
      ? 'all'
      : Number(productId)

  if (
    normalizedProductId !== 'all' &&
    (!Number.isFinite(normalizedProductId) || normalizedProductId <= 0)
  ) {
    return []
  }

  requireAuthSession()

  const normalizedScope =
    scope === 'all'
      ? 'all'
      : scope === 'approved'
      ? 'approved'
      : scope === 'rejected'
        ? 'rejected'
        : 'pending'
  const path =
    normalizedScope === 'approved'
      ? `/comments/approved?id=${normalizedProductId}`
      : normalizedScope === 'all'
        ? `/comments?id=${normalizedProductId}`
        : normalizedScope === 'rejected'
          ? `/comments/rejected?id=${normalizedProductId}`
        : `/comments/pending?id=${normalizedProductId}`
  const payload = await requestCommentsJson(path)

  return Array.isArray(payload?.comments)
    ? payload.comments
        .map((comment, index) =>
          normalizeManagerCommentRecord(comment, index, normalizedScope),
        )
        .filter(Boolean)
    : []
}

export async function fetchProductComments(productId) {
  return fetchApprovedProductComments(productId)
}

export async function moderateProductComment(commentId, action) {
  const normalizedCommentId = Number(commentId)
  const normalizedAction = normalizeText(action).toLowerCase()

  if (!Number.isFinite(normalizedCommentId) || normalizedCommentId <= 0) {
    throw new CommentRequestError('Invalid comment', 400)
  }

  if (!['approve', 'reject', 'delete'].includes(normalizedAction)) {
    throw new CommentRequestError('Invalid moderation action', 400)
  }

  requireAuthSession()

  return requestCommentsJson('/comments', {
    method: 'PATCH',
    body: JSON.stringify({
      id: normalizedCommentId,
      action: normalizedAction,
    }),
  })
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
