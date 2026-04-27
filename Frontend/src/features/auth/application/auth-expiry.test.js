import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

class MemoryStorage {
  #values = new Map()

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null
  }

  setItem(key, value) {
    this.#values.set(key, String(value))
  }

  removeItem(key) {
    this.#values.delete(key)
  }

  clear() {
    this.#values.clear()
  }
}

const listeners = new Map()

function addEventListener(type, listener) {
  const nextListeners = listeners.get(type) || new Set()
  nextListeners.add(listener)
  listeners.set(type, nextListeners)
}

function removeEventListener(type, listener) {
  listeners.get(type)?.delete(listener)
}

function dispatchEvent(event) {
  for (const listener of listeners.get(event.type) || []) {
    listener(event)
  }

  return true
}

function createJsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload
    },
  }
}

globalThis.window = {
  localStorage: new MemoryStorage(),
  sessionStorage: new MemoryStorage(),
  addEventListener,
  removeEventListener,
  dispatchEvent,
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
}

globalThis.document = {
  hidden: false,
  addEventListener,
  removeEventListener,
}

if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type)
      this.detail = options.detail
    }
  }
}

const auth = await import('./auth.js')
const comments = await import('../../../lib/comments.js')
const realDateNow = Date.now

function writeStoredSession(session, storage = window.localStorage) {
  storage.setItem(auth.authStorageKey, JSON.stringify(session))
}

function createSession(overrides = {}) {
  return {
    token: 'Bearer fresh-token',
    expires: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  Date.now = realDateNow
  window.localStorage.clear()
  window.sessionStorage.clear()
  auth.clearAuthSession()
  listeners.clear()
  globalThis.fetch = async () => {
    throw new Error('Unexpected fetch call')
  }
})

afterEach(() => {
  Date.now = realDateNow
})

describe('expired frontend auth sessions', () => {
  it('clears expired stored sessions before exposing auth state', () => {
    writeStoredSession(
      createSession({
        token: 'Bearer expired-token',
        expires: new Date(Date.now() - 60_000).toISOString(),
      }),
    )

    const snapshot = auth.getAuthStateSnapshot()

    assert.equal(snapshot.status, auth.authStateStatus.guest)
    assert.equal(snapshot.hasUsableSession, false)
    assert.equal(snapshot.shouldRequestLogin, true)
    assert.equal(window.localStorage.getItem(auth.authStorageKey), null)
    assert.equal(window.sessionStorage.getItem(auth.authStorageKey), null)
  })

  it('clears the frontend session after a profile 401', async () => {
    writeStoredSession(createSession())
    globalThis.fetch = async () => createJsonResponse(401, { e: 'Unauthorized' })

    const result = await auth.fetchCurrentUserResult('Bearer fresh-token', { force: true })
    const snapshot = auth.getAuthStateSnapshot()

    assert.equal(result.status, auth.currentUserFetchStatus.unauthorized)
    assert.equal(snapshot.shouldRequestLogin, true)
    assert.equal(snapshot.hasUsableSession, false)
    assert.equal(window.localStorage.getItem(auth.authStorageKey), null)
  })

  it('clears a newly saved session when profile hydration returns 401', async () => {
    globalThis.fetch = async () => createJsonResponse(401, { e: 'Unauthorized' })

    auth.saveAuthSession(createSession(), true)
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })

    const snapshot = auth.getAuthStateSnapshot()

    assert.equal(snapshot.shouldRequestLogin, true)
    assert.equal(snapshot.hasUsableSession, false)
    assert.equal(window.localStorage.getItem(auth.authStorageKey), null)
  })

  it('revalidates stale cached profile data before accepting the session', async () => {
    let now = realDateNow()
    let fetchCount = 0

    Date.now = () => now
    writeStoredSession(
      createSession({
        expires: new Date(now + 120_000).toISOString(),
      }),
    )
    globalThis.fetch = async () => {
      fetchCount += 1
      return createJsonResponse(200, {
        user: {
          id: 7,
          name: 'Ege',
          role: 'customer',
        },
      })
    }

    const firstResult = await auth.fetchCurrentUserResult('Bearer fresh-token', { force: true })
    const freshResult = await auth.fetchCurrentUserResult('Bearer fresh-token')

    assert.equal(firstResult.status, auth.currentUserFetchStatus.ok)
    assert.equal(freshResult.status, auth.currentUserFetchStatus.ok)
    assert.equal(fetchCount, 1)

    now += auth.currentUserCacheMaxAgeMs + 1
    const staleSnapshot = auth.getAuthStateSnapshot()

    assert.equal(staleSnapshot.status, auth.authStateStatus.checking)
    assert.equal(staleSnapshot.hasVerifiedUser, false)

    globalThis.fetch = async () => {
      fetchCount += 1
      return createJsonResponse(401, { e: 'Unauthorized' })
    }

    const staleResult = await auth.fetchCurrentUserResult('Bearer fresh-token')
    const snapshot = auth.getAuthStateSnapshot()

    assert.equal(staleResult.status, auth.currentUserFetchStatus.unauthorized)
    assert.equal(fetchCount, 2)
    assert.equal(snapshot.shouldRequestLogin, true)
    assert.equal(window.localStorage.getItem(auth.authStorageKey), null)
  })

  it('blocks comment writes when the stored session has expired', async () => {
    let fetchCount = 0

    writeStoredSession(
      createSession({
        expires: new Date(Date.now() - 60_000).toISOString(),
      }),
    )
    globalThis.fetch = async () => {
      fetchCount += 1
      return createJsonResponse(200, { d: {} })
    }

    await assert.rejects(
      comments.submitProductComment({
        productId: 12,
        rating: 4,
        comment: 'Clean finish',
        privacy: 'full',
      }),
      (error) => error instanceof comments.CommentRequestError && error.status === 401,
    )

    assert.equal(fetchCount, 0)
  })

  it('falls back to public comments when the self-comment lookup expires the session', async () => {
    const requestedPaths = []

    writeStoredSession(createSession())
    globalThis.fetch = async (url) => {
      requestedPaths.push(url)

      if (url === '/api/comments/approved?id=42') {
        return createJsonResponse(200, {
          d: {
            comments: [
              {
                name: 'Defne Kaya',
                text: 'Balanced and bright.',
                time: '2026-04-22T08:00:00Z',
                rating: 10,
              },
            ],
          },
        })
      }

      if (url === '/api/comments/me?id=42&actAsUser=true') {
        return createJsonResponse(401, { e: 'Unauthorized' })
      }

      return createJsonResponse(500, { e: 'Unexpected path' })
    }

    const result = await comments.fetchApprovedProductComments(42)
    const snapshot = auth.getAuthStateSnapshot()

    assert.deepEqual(requestedPaths, [
      '/api/comments/approved?id=42',
      '/api/comments/me?id=42&actAsUser=true',
    ])
    assert.equal(result.comments.length, 1)
    assert.equal(result.comments[0].comment, 'Balanced and bright.')
    assert.equal(result.selfComment, null)
    assert.equal(snapshot.shouldRequestLogin, true)
    assert.equal(window.localStorage.getItem(auth.authStorageKey), null)
  })
})
