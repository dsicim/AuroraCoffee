export const authStorageKey = 'auroraAuth'

export function saveAuthSession(session, rememberMe) {
  const storage = rememberMe ? window.localStorage : window.sessionStorage
  const otherStorage = rememberMe ? window.sessionStorage : window.localStorage

  otherStorage.removeItem(authStorageKey)
  storage.setItem(authStorageKey, JSON.stringify(session))
}

export function getAuthSession() {
  const storedSession =
    window.localStorage.getItem(authStorageKey) ||
    window.sessionStorage.getItem(authStorageKey)

  if (!storedSession) {
    return null
  }

  try {
    return JSON.parse(storedSession)
  } catch {
    return null
  }
}

export function updateAuthSession(session) {
  const storage = window.localStorage.getItem(authStorageKey)
    ? window.localStorage
    : window.sessionStorage

  storage.setItem(authStorageKey, JSON.stringify(session))
}

export function clearAuthSession() {
  window.localStorage.removeItem(authStorageKey)
  window.sessionStorage.removeItem(authStorageKey)
}
