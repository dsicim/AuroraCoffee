const rawApiBaseUrl = import.meta.env?.VITE_API_BASE_URL || '/api'

export function buildApiUrl(path) {
  const normalizedBaseUrl = rawApiBaseUrl.endsWith('/')
    ? rawApiBaseUrl.slice(0, -1)
    : rawApiBaseUrl
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${normalizedBaseUrl}${normalizedPath}`
}
