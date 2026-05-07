import { getAuthStateSnapshot, getCurrentUserSnapshot } from '../../../lib/auth'
import { fetchAuthJson } from '../../../lib/authRequest'

export const commentsChangeEvent = 'aurora-comments-change'

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function dispatchCommentsChange(type = 'sync') {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(commentsChangeEvent, {
      detail: { type },
    }),
  )
}

function toUiRating(value) {
  if (value === null || value === undefined || value === '') {
    return 0
  }

  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0
  }

  return Math.max(0.5, Math.min(5, Math.round(numericValue) / 2))
}

function toBackendRating(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
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

  if (!comment && !rating) {
    return null
  }

  return {
    id: `${createdAt || 'comment'}:${suffix}:${author}:${index}`,
    author,
    comment,
    rating,
    backendRating: rating ? toBackendRating(rating) : null,
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

function getDisplayNameWords(displayName) {
  return normalizeText(displayName)
    .split(/\s+/)
    .filter(Boolean)
}

function buildInitialPreviewWord(word) {
  let normalizedWord = String(word || '').trim()

  while (normalizedWord.startsWith('.') && normalizedWord.length > 1) {
    normalizedWord = normalizedWord.slice(1)
  }

  if (!normalizedWord) {
    return ''
  }

  return `${String(word || '').trim()[0]}.`
}

function inferPrivacySelection(authorName) {
  const displayNameWords = getDisplayNameWords(getCurrentUserSnapshot()?.user?.displayname)
  const normalizedAuthorName = normalizeText(authorName)

  if (!displayNameWords.length) {
    return []
  }

  if (!normalizedAuthorName) {
    return displayNameWords.map(() => 'initials')
  }

  if (normalizedAuthorName === 'Anonymous') {
    return displayNameWords.map(() => 'anonymous')
  }

  const authorWords = normalizedAuthorName.split(/\s+/).filter(Boolean)
  let authorWordIndex = 0

  return displayNameWords.map((word) => {
    const authorWord = authorWords[authorWordIndex]

    if (authorWord === word) {
      authorWordIndex += 1
      return 'full'
    }

    if (authorWord === buildInitialPreviewWord(word)) {
      authorWordIndex += 1
      return 'initials'
    }

    return 'anonymous'
  })
}

function inferPrivacyMode(authorName) {
  const privacySelection = inferPrivacySelection(authorName)

  if (!privacySelection.length) {
    return 'initials'
  }

  const [firstMode = 'initials'] = privacySelection
  return privacySelection.every((mode) => mode === firstMode) ? firstMode : 'initials'
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
          privacySelection: inferPrivacySelection(prefillSource?.author),
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

function collectApprovedCommentEntries(rawComments) {
  const result = {
    comments: [],
    selfComment: null,
  }

  if (!Array.isArray(rawComments)) {
    return result
  }

  rawComments.forEach((comment, index) => {
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

function normalizeManagerCommentSnapshot(snapshot, index, suffix) {
  const author = normalizeText(snapshot?.name) || 'Anonymous'
  const comment = normalizeText(snapshot?.text)
  const createdAt = normalizeText(snapshot?.time)
  const editedAt = normalizeText(snapshot?.edit) || null
  const rating = toUiRating(snapshot?.rating)

  if (!comment && !rating) {
    return null
  }

  return {
    id: `${createdAt || 'comment'}:${author}:${suffix}:${index}`,
    author,
    comment,
    rating,
    backendRating: rating ? toBackendRating(rating) : null,
    createdAt,
    editedAt,
    visibilityFlag: snapshot?.visible === true ? true : snapshot?.visible === false ? false : null,
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
  const normalizedStatus = status.toLowerCase()
  const recordVisible =
    record?.visible === true ||
    record?.edit_visible === true ||
    existing?.visibilityFlag === true ||
    false
  const recordHidden =
    record?.visible === false ||
    record?.edit_visible === false ||
    upcoming?.visibilityFlag === false

  if (scope === 'pending' && record.self === true && status === 'approved') {
    return null
  }

  if (
    scope === 'rejected' &&
    (recordVisible || !recordHidden || !['rejected', 'edit_rejected'].includes(normalizedStatus))
  ) {
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

function getSelfCommentStatusLabel(status) {
  switch (normalizeText(status).toLowerCase()) {
    case 'pending':
      return 'Pending review'
    case 'rejected':
      return 'Rejected'
    case 'pending_edit':
      return 'Pending update'
    case 'edit_rejected':
      return 'Rejected update'
    default:
      return 'Approved'
  }
}

function getSelfCommentSortTime(comment) {
  const candidates = [
    comment?.editedAt,
    comment?.createdAt,
    comment?.publishedSnapshot?.editedAt,
    comment?.publishedSnapshot?.createdAt,
  ]

  for (const value of candidates) {
    const parsed = Date.parse(String(value || ''))

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

function normalizeCurrentUserComment(product, selfComment) {
  if (!product || !selfComment) {
    return null
  }

  const status = normalizeText(selfComment.status).toLowerCase() || 'approved'
  const latestSnapshot = selfComment.pendingSnapshot || selfComment.visibleSnapshot || null
  const productName = normalizeText(product?.name) || 'Product'
  const productCategory =
    normalizeText(product?.categoryName) ||
    normalizeText(product?.parentCategoryName) ||
    ''

  return {
    id: `${product.id}:${status}:${latestSnapshot?.createdAt || latestSnapshot?.editedAt || 'comment'}`,
    productId: Number(product.id) || 0,
    productSlug: normalizeText(product?.slug) || String(product.id),
    productName,
    productCategory,
    status,
    statusLabel: getSelfCommentStatusLabel(status),
    comment: latestSnapshot?.comment || '',
    rating: latestSnapshot?.rating || 0,
    backendRating:
      latestSnapshot?.backendRating ??
      (latestSnapshot?.rating ? toBackendRating(latestSnapshot.rating) : null),
    createdAt: normalizeText(latestSnapshot?.createdAt),
    editedAt: normalizeText(latestSnapshot?.editedAt) || null,
    publishedSnapshot: selfComment.visibleSnapshot || null,
    pendingSnapshot: selfComment.pendingSnapshot || null,
    hasPublishedVersion: Boolean(selfComment.visibleSnapshot && selfComment.pendingSnapshot),
    draftAvailable: Boolean(selfComment.draftAvailable),
    sortTime: getSelfCommentSortTime({
      ...latestSnapshot,
      publishedSnapshot: selfComment.visibleSnapshot || null,
    }),
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length)
  let nextIndex = 0
  const workerCount = Math.max(1, Math.min(items.length, Math.floor(concurrency) || 1))

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex
        nextIndex += 1

        if (currentIndex >= items.length) {
          return
        }

        results[currentIndex] = await worker(items[currentIndex], currentIndex)
      }
    }),
  )

  return results
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
  const { response, payload, data } = await fetchAuthJson(path, {
    ...fetchOptions,
    json: Boolean(fetchOptions.body),
    headers: {
      ...(headers || {}),
    },
  })

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
  const authState = getAuthStateSnapshot()

  if (authState.shouldRequestLogin || !authState.hasUsableSession || !authState.token) {
    throw new CommentRequestError('Unauthorized', 401)
  }
}

export async function fetchApprovedProductComments(productId) {
  const normalizedProductId = Number(productId)

  if (!Number.isFinite(normalizedProductId) || normalizedProductId <= 0) {
    return { comments: [], selfComment: null }
  }

  const approvedPath = `/comments/approved?id=${normalizedProductId}`
  const approvedRequest = requestCommentsJson(approvedPath)
  const authState = getAuthStateSnapshot()

  if (!authState.hasUsableSession) {
    const payload = await approvedRequest
    return collectApprovedCommentEntries(payload?.comments)
  }

  let approvedPayload

  try {
    approvedPayload = await approvedRequest
  } catch (error) {
    if (error?.status === 401 && getAuthStateSnapshot().shouldRequestLogin) {
      const payload = await requestCommentsJson(approvedPath)
      return collectApprovedCommentEntries(payload?.comments)
    }

    throw error
  }

  const publicComments = collectApprovedCommentEntries(approvedPayload?.comments)

  try {
    const selfPayload = await requestCommentsJson(
      `/comments/me?id=${normalizedProductId}&actAsUser=true`,
    )
    const ownComments = collectApprovedCommentEntries(selfPayload?.comments)

    return {
      comments: publicComments.comments,
      selfComment: ownComments.selfComment,
    }
  } catch (error) {
    if (error?.status === 401 && getAuthStateSnapshot().shouldRequestLogin) {
      return {
        comments: publicComments.comments,
        selfComment: null,
      }
    }

    throw error
  }
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

export async function fetchCurrentUserComments(products, { concurrency = 6 } = {}) {
  requireAuthSession()

  const productsToInspect = Array.from(
    new Map(
      (Array.isArray(products) ? products : [])
        .filter((product) => Number(product?.id) > 0 && product?.canComment)
        .map((product) => [Number(product.id), product]),
    ).values(),
  )

  if (!productsToInspect.length) {
    return []
  }

  let results = []

  try {
    const payload = await requestCommentsJson('/comments/me?actAsUser=true')
    const rawComments = Array.isArray(payload?.comments) ? payload.comments : []
    const commentsByProductId = new Map()

    rawComments.forEach((comment, index) => {
      const normalizedEntry = normalizeApprovedCommentEntry(comment, index)
      const productId = Number(comment?.product)

      if (!normalizedEntry.selfComment || !Number.isFinite(productId) || productId <= 0) {
        return
      }

      commentsByProductId.set(productId, normalizedEntry.selfComment)
    })

    results = productsToInspect.map((product) =>
      normalizeCurrentUserComment(
        product,
        commentsByProductId.get(Number(product.id)) || null,
      ),
    )

    if (rawComments.length > 0 && !commentsByProductId.size) {
      throw new CommentRequestError('Current user comments response is missing product ids')
    }
  } catch (error) {
    let hasSuccessfulRequest = false
    let firstError = error

    results = await mapWithConcurrency(
      productsToInspect,
      concurrency,
      async (product) => {
        try {
          const result = await fetchApprovedProductComments(product.id)
          hasSuccessfulRequest = true
          return normalizeCurrentUserComment(product, result.selfComment)
        } catch (fallbackError) {
          if (!firstError) {
            firstError = fallbackError
          }

          return null
        }
      },
    )

    if (!hasSuccessfulRequest && firstError) {
      throw firstError
    }
  }

  return results
    .filter(Boolean)
    .sort((left, right) => right.sortTime - left.sortTime)
    .map((comment) => {
      const nextComment = { ...comment }
      delete nextComment.sortTime
      return nextComment
    })
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

  const result = await requestCommentsJson('/comments', {
    method: 'PATCH',
    body: JSON.stringify({
      id: normalizedCommentId,
      action: normalizedAction,
      ...(normalizedAction === 'reject' ? { visible: false } : {}),
    }),
  })

  dispatchCommentsChange(`moderate:${normalizedAction}`)
  return result
}

export async function deleteProductComment(productId) {
  const normalizedProductId = Number(productId)

  if (!Number.isFinite(normalizedProductId) || normalizedProductId <= 0) {
    throw new CommentRequestError('Invalid product', 400)
  }

  requireAuthSession()

  const result = await requestCommentsJson(`/comments?id=${encodeURIComponent(normalizedProductId)}`, {
    method: 'DELETE',
  })

  dispatchCommentsChange('delete')
  return result
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

  if (!backendRating && !normalizedComment) {
    throw new CommentRequestError('Add a rating or comment before posting', 400)
  }

  if (!normalizedPrivacy) {
    throw new CommentRequestError('Privacy setting is required', 400)
  }

  requireAuthSession()

  const result = await requestCommentsJson('/comments', {
    method: 'POST',
    body: JSON.stringify({
      id: normalizedProductId,
      rating: backendRating,
      comment: normalizedComment || null,
      privacy: normalizedPrivacy,
    }),
  })

  dispatchCommentsChange('submit')
  return result
}
