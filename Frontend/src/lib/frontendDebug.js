import { authChangeEvent, currentUserChangeEvent, getAuthSession } from './auth'
import { productCatalogChangeEvent, getProductCatalogSnapshot } from './products'

const frontendDebugPrefix = '[Aurora Frontend]'
const frontendDebugStorageKey = 'auroraFrontendDebugEvents'
const frontendDebugMaxEvents = 400
const frontendDebugSessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
const originalConsole = {
  error: console.error.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
}

let initialized = false
let eventSequence = 0
let events = []

function getLocationSnapshot() {
  if (typeof window === 'undefined') {
    return {}
  }

  return {
    path: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  }
}

function getAuthSnapshot() {
  const session = getAuthSession?.()

  return {
    hasToken: Boolean(session?.token),
    email: session?.email || '',
    role: session?.role || '',
  }
}

function cloneDetail(value, depth = 0) {
  if (depth > 4) {
    return '[depth-limit]'
  }

  if (value === null || value === undefined) {
    return value
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack || '',
    }
  }

  if (value instanceof File) {
    return {
      name: value.name,
      size: value.size,
      type: value.type,
      lastModified: value.lastModified,
    }
  }

  if (value instanceof Event) {
    return {
      type: value.type,
      target: value.target?.constructor?.name || '',
    }
  }

  if (Array.isArray(value)) {
    return value.slice(0, 40).map((entry) => cloneDetail(entry, depth + 1))
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 80)
        .map(([key, entry]) => [
          key.toLowerCase().includes('token') || key.toLowerCase().includes('password')
            ? key
            : key,
          key.toLowerCase().includes('token') || key.toLowerCase().includes('password')
            ? '[redacted]'
            : cloneDetail(entry, depth + 1),
        ]),
    )
  }

  if (typeof value === 'function') {
    return `[function ${value.name || 'anonymous'}]`
  }

  return value
}

function persistEvents() {
  try {
    window.sessionStorage.setItem(frontendDebugStorageKey, JSON.stringify(events))
  } catch {
    // Ignore quota/private-mode failures. Console logging still works.
  }
}

function loadPersistedEvents() {
  try {
    const parsedEvents = JSON.parse(window.sessionStorage.getItem(frontendDebugStorageKey) || '[]')

    if (Array.isArray(parsedEvents)) {
      events = parsedEvents.slice(-frontendDebugMaxEvents)
      eventSequence = events.reduce((max, entry) => Math.max(max, Number(entry.seq) || 0), 0)
    }
  } catch {
    events = []
  }
}

function pushEvent(level, event, details = {}) {
  const entry = {
    seq: eventSequence + 1,
    sessionId: frontendDebugSessionId,
    level,
    event,
    details: cloneDetail(details),
    location: getLocationSnapshot(),
    at: new Date().toISOString(),
  }

  eventSequence = entry.seq
  events = [...events, entry].slice(-frontendDebugMaxEvents)
  persistEvents()
  return entry
}

export function logFrontendDebug(event, details = {}, level = 'info') {
  if (typeof console === 'undefined') {
    return null
  }

  const entry = pushEvent(level, event, details)
  const consoleMethod = level === 'error' ? originalConsole.error : level === 'warn' ? originalConsole.warn : originalConsole.info

  consoleMethod(frontendDebugPrefix, event, entry)
  return entry
}

function getDebugSummary() {
  const errors = events.filter((entry) => entry.level === 'error')
  const warnings = events.filter((entry) => entry.level === 'warn')

  return {
    sessionId: frontendDebugSessionId,
    count: events.length,
    errors: errors.length,
    warnings: warnings.length,
    lastEvent: events.at(-1) || null,
  }
}

function installConsoleBreadcrumbs() {
  console.warn = (...args) => {
    pushEvent('warn', 'console:warn', { args })
    originalConsole.warn(...args)
  }

  console.error = (...args) => {
    pushEvent('error', 'console:error', { args })
    originalConsole.error(...args)
  }
}

function getFetchUrl(input) {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input?.url || ''
}

function installFetchBreadcrumbs() {
  const originalFetch = window.fetch?.bind(window)

  if (!originalFetch) {
    return
  }

  window.fetch = async (input, init = {}) => {
    const startedAt = performance.now()
    const method = init?.method || input?.method || 'GET'
    const url = getFetchUrl(input)
    const eventId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

    pushEvent('info', 'fetch:start', {
      eventId,
      method,
      url,
    })

    try {
      const response = await originalFetch(input, init)
      const durationMs = Math.round(performance.now() - startedAt)
      const level = response.ok ? 'info' : 'warn'

      pushEvent(level, 'fetch:finish', {
        eventId,
        method,
        url,
        status: response.status,
        ok: response.ok,
        durationMs,
      })

      if (!response.ok) {
        originalConsole.warn(frontendDebugPrefix, 'fetch:finish', events.at(-1))
      }

      return response
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt)

      logFrontendDebug('fetch:error', {
        eventId,
        method,
        url,
        durationMs,
        error,
      }, 'error')
      throw error
    }
  }
}

function logCatalogEvent(event) {
  const snapshot = getProductCatalogSnapshot()

  logFrontendDebug('catalog:event', {
    type: event?.detail?.type || '',
    loaded: snapshot.loaded,
    productCount: snapshot.products.length,
  })
}

function logAuthEvent(eventName) {
  logFrontendDebug(eventName, getAuthSnapshot())
}

function logFileInputChange(event) {
  const target = event.target

  if (!(target instanceof HTMLInputElement) || target.type !== 'file') {
    return
  }

  const files = Array.from(target.files || [])

  logFrontendDebug('dom:file-input-change', {
    id: target.id || '',
    name: target.name || '',
    className: target.className || '',
    disabled: target.disabled,
    fileCount: files.length,
    files,
  })
}

function installDebugApi() {
  window.AuroraDebug = {
    all() {
      return [...events]
    },
    clear() {
      events = []
      eventSequence = 0
      persistEvents()
      logFrontendDebug('debug:cleared')
    },
    errors() {
      return events.filter((entry) => entry.level === 'error')
    },
    export() {
      return JSON.stringify(events, null, 2)
    },
    last(count = 25) {
      return events.slice(-count)
    },
    mark(label, details = {}) {
      return logFrontendDebug('debug:mark', { label, ...details })
    },
    summary: getDebugSummary,
  }
}

export function initializeFrontendDebug() {
  if (initialized || typeof window === 'undefined') {
    return
  }

  initialized = true
  loadPersistedEvents()
  installDebugApi()
  installConsoleBreadcrumbs()
  installFetchBreadcrumbs()

  logFrontendDebug('debug:initialized', {
    userAgent: window.navigator?.userAgent || '',
    auth: getAuthSnapshot(),
  })

  window.addEventListener('error', (event) => {
    logFrontendDebug('window:error', {
      message: event.message || '',
      filename: event.filename || '',
      lineno: event.lineno || 0,
      colno: event.colno || 0,
      stack: event.error?.stack || '',
    }, 'error')
  })

  window.addEventListener('unhandledrejection', (event) => {
    logFrontendDebug('window:unhandledrejection', {
      reason: event.reason?.message || String(event.reason || ''),
      stack: event.reason?.stack || '',
    }, 'error')
  })

  window.addEventListener('visibilitychange', () => {
    logFrontendDebug('document:visibilitychange', {
      visibilityState: document.visibilityState,
    })
  })

  window.addEventListener('pageshow', (event) => {
    logFrontendDebug('window:pageshow', {
      persisted: event.persisted,
    })
  })

  window.addEventListener('pagehide', (event) => {
    logFrontendDebug('window:pagehide', {
      persisted: event.persisted,
    })
  })

  window.addEventListener('focus', () => {
    logFrontendDebug('window:focus')
  })

  window.addEventListener('blur', () => {
    logFrontendDebug('window:blur')
  })

  window.addEventListener('change', logFileInputChange, true)
  window.addEventListener(productCatalogChangeEvent, logCatalogEvent)
  window.addEventListener(authChangeEvent, () => logAuthEvent('auth:event'))
  window.addEventListener(currentUserChangeEvent, () => logAuthEvent('current-user:event'))
}
