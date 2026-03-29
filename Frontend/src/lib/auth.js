import { buildApiUrl } from './api'

export const authStorageKey = 'auroraAuth'
export const authChangeEvent = 'aurora-auth-change'

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

export async function fetchCurrentUser(token, options = {}) {
  if (!token) {
    return null
  }

  const { clearOnFailure = true } = options

  try {
    const response = await fetch(buildApiUrl('/users/me'), {
      method: 'GET',
      headers: {
        authorization: token,
      },
    })

    if (!response.ok) {
      if (clearOnFailure) {
        clearAuthSession()
      }

      return null
    }

    const payload = await response.json()

    return payload?.user || null
  } catch {
    if (clearOnFailure) {
      clearAuthSession()
    }

    return null
  }
}
