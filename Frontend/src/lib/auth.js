import { buildApiUrl } from './api'

export const authStorageKey = 'auroraAuth'
export const authChangeEvent = 'aurora-auth-change'
export const currentUserFetchStatus = {
  ok: 'ok',
  unauthorized: 'unauthorized',
  error: 'error',
}

function dispatchAuthChange() {
  window.dispatchEvent(new Event(authChangeEvent))
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

  otherStorage.removeItem(authStorageKey)
  storage.setItem(authStorageKey, JSON.stringify(session))
  dispatchAuthChange()
}

export function getAuthSession() {
  const storageMode = getAuthStorageMode()
  const storedSession = storageMode
    ? getStorageValue(storageMode)
    : null

  if (!storedSession) {
    return null
  }

  try {
    return JSON.parse(storedSession)
  } catch {
    return null
  }
}

function getStorageValue(mode) {
  return mode === 'local'
    ? window.localStorage.getItem(authStorageKey)
    : window.sessionStorage.getItem(authStorageKey)
}

export function clearAuthSession() {
  window.localStorage.removeItem(authStorageKey)
  window.sessionStorage.removeItem(authStorageKey)
  dispatchAuthChange()
}

export async function fetchCurrentUserResult(token, options = {}) {
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
      headers: {
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

export async function fetchCurrentUser(token, options = {}) {
  const result = await fetchCurrentUserResult(token, options)

  if (result.status !== currentUserFetchStatus.ok) {
    return null
  }

  return result.user
}
