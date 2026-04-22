import { buildApiUrl } from './api'

export const authStorageKey = 'auroraAuth'
export const authChangeEvent = 'aurora-auth-change'
export const currentUserChangeEvent = 'aurora-current-user-change'
export const currentUserFetchStatus = {
  idle: 'idle',
  loading: 'loading',
  ok: 'ok',
  unauthorized: 'unauthorized',
  error: 'error',
}
export const authStateStatus = {
  guest: 'guest',
  checking: 'checking',
  authenticated: 'authenticated',
  unauthorized: 'unauthorized',
  error: 'error',
}

let cachedCurrentUser = null
let cachedCurrentUserStatus = currentUserFetchStatus.idle
let cachedCurrentUserToken = null
let inFlightCurrentUserPromise = null
let currentUserRequestId = 0
let authExpiryTimerId = null
let hasRegisteredAuthSessionMonitor = false
let pendingAuthChangeDispatch = false

function dispatchAuthChange() {
  window.dispatchEvent(new Event(authChangeEvent))
}

function dispatchCurrentUserChange() {
  window.dispatchEvent(new Event(currentUserChangeEvent))
}

function dispatchAuthChangeAsync() {
  if (pendingAuthChangeDispatch) {
    return
  }

  pendingAuthChangeDispatch = true
  window.setTimeout(() => {
    pendingAuthChangeDispatch = false
    dispatchAuthChange()
  }, 0)
}

function clearAuthExpiryTimer() {
  if (authExpiryTimerId !== null) {
    window.clearTimeout(authExpiryTimerId)
    authExpiryTimerId = null
  }
}

function removeStoredAuthSession() {
  window.localStorage.removeItem(authStorageKey)
  window.sessionStorage.removeItem(authStorageKey)
}

function isSessionExpired(session) {
  const expiresAt = Date.parse(session?.expires || '')

  if (!Number.isFinite(expiresAt)) {
    return false
  }

  return expiresAt <= Date.now()
}

function scheduleAuthExpiry(session) {
  clearAuthExpiryTimer()

  const expiresAt = Date.parse(session?.expires || '')

  if (!Number.isFinite(expiresAt)) {
    return
  }

  const remainingMs = expiresAt - Date.now()

  if (remainingMs <= 0) {
    clearAuthSession()
    return
  }

  authExpiryTimerId = window.setTimeout(() => {
    clearAuthSession()
  }, remainingMs)
}

function setCurrentUserCache({ user, status, token }) {
  cachedCurrentUser = user
  cachedCurrentUserStatus = status
  cachedCurrentUserToken = token
  dispatchCurrentUserChange()
}

function clearCurrentUserCache() {
  const hadState =
    cachedCurrentUser !== null ||
    cachedCurrentUserStatus !== currentUserFetchStatus.idle ||
    cachedCurrentUserToken !== null

  cachedCurrentUser = null
  cachedCurrentUserStatus = currentUserFetchStatus.idle
  cachedCurrentUserToken = null
  inFlightCurrentUserPromise = null
  currentUserRequestId += 1

  if (hadState) {
    dispatchCurrentUserChange()
  }
}

function invalidateStoredAuthSession({ async = false } = {}) {
  const hadStoredSession = Boolean(getAuthStorageMode())

  clearAuthExpiryTimer()
  removeStoredAuthSession()
  clearCurrentUserCache()

  if (hadStoredSession) {
    if (async) {
      dispatchAuthChangeAsync()
    } else {
      dispatchAuthChange()
    }
  }
}

function ensureAuthSessionMonitor() {
  if (hasRegisteredAuthSessionMonitor || typeof window === 'undefined') {
    return
  }

  hasRegisteredAuthSessionMonitor = true

  const syncExpiredSession = () => {
    const storageMode = getAuthStorageMode()
    const storedSession = storageMode ? getStorageValue(storageMode) : null

    if (!storedSession) {
      return
    }

    try {
      const parsedSession = JSON.parse(storedSession)

      if (parsedSession?.token && isSessionExpired(parsedSession)) {
        invalidateStoredAuthSession({ async: true })
      }
    } catch {
      invalidateStoredAuthSession({ async: true })
    }
  }

  window.addEventListener('focus', syncExpiredSession)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncExpiredSession()
    }
  })
}

function readStoredSession() {
  ensureAuthSessionMonitor()

  const storageMode = getAuthStorageMode()
  const storedSession = storageMode
    ? getStorageValue(storageMode)
    : null

  if (!storedSession) {
    return null
  }

  try {
    const parsedSession = JSON.parse(storedSession)

    if (!parsedSession?.token || isSessionExpired(parsedSession)) {
      invalidateStoredAuthSession({ async: true })
      return null
    }

    scheduleAuthExpiry(parsedSession)
    return parsedSession
  } catch {
    invalidateStoredAuthSession({ async: true })
    return null
  }
}

export function getAuthStorageMode() {
  if (window.localStorage.getItem(authStorageKey)) {
    return 'local'
  }

  if (window.sessionStorage.getItem(authStorageKey)) {
    return 'session'
  }

  return null
}

export function saveAuthSession(session, rememberMe) {
  const storage = rememberMe ? window.localStorage : window.sessionStorage
  const otherStorage = rememberMe ? window.sessionStorage : window.localStorage

  if (!session?.token || isSessionExpired(session)) {
    clearAuthSession()
    return
  }

  otherStorage.removeItem(authStorageKey)
  storage.setItem(authStorageKey, JSON.stringify(session))
  ensureAuthSessionMonitor()
  scheduleAuthExpiry(session)
  clearCurrentUserCache()
  dispatchAuthChange()

  if (session?.token) {
    void fetchCurrentUserResult(session.token, {
      force: true,
      clearOnUnauthorized: false,
    })
  }
}

export function getAuthSession() {
  return readStoredSession()
}

function getStorageValue(mode) {
  return mode === 'local'
    ? window.localStorage.getItem(authStorageKey)
    : window.sessionStorage.getItem(authStorageKey)
}

export function clearAuthSession() {
  invalidateStoredAuthSession()
}

function getCurrentUserSnapshotForSession(session) {
  if (!session?.token) {
    return {
      user: null,
      status: currentUserFetchStatus.idle,
      token: null,
    }
  }

  if (cachedCurrentUserToken && cachedCurrentUserToken !== session.token) {
    return {
      user: null,
      status: currentUserFetchStatus.idle,
      token: session.token,
    }
  }

  return {
    user: cachedCurrentUser,
    status: cachedCurrentUserStatus,
    token: cachedCurrentUserToken,
  }
}

function getAuthStateStatus(session, currentUserState) {
  if (!session?.token) {
    return authStateStatus.guest
  }

  if (currentUserState.status === currentUserFetchStatus.unauthorized) {
    return authStateStatus.unauthorized
  }

  if (currentUserState.status === currentUserFetchStatus.ok) {
    return authStateStatus.authenticated
  }

  if (currentUserState.status === currentUserFetchStatus.error) {
    return authStateStatus.error
  }

  return authStateStatus.checking
}

export function getCurrentUserSnapshot() {
  return getCurrentUserSnapshotForSession(readStoredSession())
}

export function getAuthStateSnapshot() {
  const session = readStoredSession()
  const currentUserState = getCurrentUserSnapshotForSession(session)
  const status = getAuthStateStatus(session, currentUserState)
  const user = currentUserState.status === currentUserFetchStatus.ok
    ? currentUserState.user
    : null

  return {
    session,
    token: session?.token || null,
    user,
    currentUserState,
    status,
    hasStoredSession: Boolean(session?.token),
    hasUsableSession: Boolean(session?.token) && status !== authStateStatus.unauthorized,
    hasVerifiedUser: Boolean(user),
    shouldRequestLogin:
      status === authStateStatus.guest ||
      status === authStateStatus.unauthorized,
    isChecking: status === authStateStatus.checking,
    isProfileError: status === authStateStatus.error,
  }
}

export function getCachedCurrentUser() {
  const session = readStoredSession()

  if (!session?.token || cachedCurrentUserToken !== session.token) {
    return null
  }

  return cachedCurrentUser
}

async function fetchCurrentUserResultNetwork(token, options = {}) {
  if (!token) {
    return {
      status: currentUserFetchStatus.unauthorized,
      user: null,
    }
  }

  const { clearOnUnauthorized = true } = options

  try {
    const response = await fetch(buildApiUrl('/users/me'), {
      method: 'GET',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        authorization: token,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        if (clearOnUnauthorized) {
          clearAuthSession()
        }

        return {
          status: currentUserFetchStatus.unauthorized,
          user: null,
        }
      }

      return {
        status: currentUserFetchStatus.error,
        user: null,
      }
    }

    const payload = await response.json()

    if (!payload?.user) {
      return {
        status: currentUserFetchStatus.error,
        user: null,
      }
    }

    return {
      status: currentUserFetchStatus.ok,
      user: payload.user,
    }
  } catch {
    return {
      status: currentUserFetchStatus.error,
      user: null,
    }
  }
}

export async function fetchCurrentUserResult(token, options = {}) {
  const session = readStoredSession()

  if (!session?.token || session.token !== token) {
    setCurrentUserCache({
      user: null,
      status: currentUserFetchStatus.unauthorized,
      token: null,
    })
    return {
      status: currentUserFetchStatus.unauthorized,
      user: null,
    }
  }

  if (!token) {
    setCurrentUserCache({
      user: null,
      status: currentUserFetchStatus.unauthorized,
      token: null,
    })
    return {
      status: currentUserFetchStatus.unauthorized,
      user: null,
    }
  }

  const { force = false } = options

  if (
    !force &&
    cachedCurrentUserToken === token &&
    cachedCurrentUserStatus === currentUserFetchStatus.ok &&
    cachedCurrentUser
  ) {
    return {
      status: currentUserFetchStatus.ok,
      user: cachedCurrentUser,
    }
  }

  if (
    !force &&
    cachedCurrentUserToken === token &&
    cachedCurrentUserStatus === currentUserFetchStatus.unauthorized
  ) {
    return {
      status: currentUserFetchStatus.unauthorized,
      user: null,
    }
  }

  if (
    !force &&
    inFlightCurrentUserPromise &&
    cachedCurrentUserToken === token &&
    cachedCurrentUserStatus === currentUserFetchStatus.loading
  ) {
    return inFlightCurrentUserPromise
  }

  const requestId = ++currentUserRequestId
  cachedCurrentUserToken = token
  cachedCurrentUserStatus = currentUserFetchStatus.loading
  dispatchCurrentUserChange()

  inFlightCurrentUserPromise = fetchCurrentUserResultNetwork(token, options)
    .then((result) => {
      if (requestId !== currentUserRequestId) {
        return result
      }

      setCurrentUserCache({
        user: result.status === currentUserFetchStatus.ok ? result.user : null,
        status: result.status,
        token: result.status === currentUserFetchStatus.unauthorized ? null : token,
      })

      return result
    })
    .finally(() => {
      if (requestId === currentUserRequestId) {
        inFlightCurrentUserPromise = null
      }
    })

  return inFlightCurrentUserPromise
}

export async function fetchCurrentUser(token, options = {}) {
  const result = await fetchCurrentUserResult(token, options)

  if (result.status !== currentUserFetchStatus.ok) {
    return null
  }

  return result.user
}
