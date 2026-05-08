import { buildApiUrl } from '../shared/api/api.js'
import { clearAuthSession, getAuthSession } from './auth.js'

export function getAuthorizationHeaders() {
  const session = getAuthSession()
  return session?.token ? { authorization: session.token } : {}
}

export function clearAuthSessionOnUnauthorized(response) {
  if (response?.status !== 401) {
    return false
  }

  clearAuthSession()
  return true
}

export async function readJsonResponse(response) {
  const payload = await response.json().catch(() => ({}))
  return {
    payload,
    data: payload?.d ?? payload,
  }
}

export async function fetchAuthResponse(path, options = {}) {
  const { headers, ...fetchOptions } = options
  const response = await fetch(buildApiUrl(path), {
    ...fetchOptions,
    headers: {
      ...getAuthorizationHeaders(),
      ...(headers || {}),
    },
  })

  clearAuthSessionOnUnauthorized(response)
  return response
}

export async function fetchAuthJson(path, options = {}) {
  const { json = false, headers, ...fetchOptions } = options
  const response = await fetchAuthResponse(path, {
    ...fetchOptions,
    headers: {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
  })
  const { payload, data } = await readJsonResponse(response)

  return {
    response,
    payload,
    data,
  }
}
