import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

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
  window.localStorage.clear()
  window.sessionStorage.clear()
  auth.clearAuthSession()
  listeners.clear()
  globalThis.fetch = async () => {
    throw new Error('Unexpected fetch call')
  }
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
