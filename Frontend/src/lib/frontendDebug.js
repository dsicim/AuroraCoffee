import { authChangeEvent, currentUserChangeEvent, getAuthSession } from './auth'
import { productCatalogChangeEvent, getProductCatalogSnapshot } from './products'

const frontendDebugPrefix = '[Aurora Frontend]'
const frontendDebugStorageKey = 'auroraFrontendDebugEvents'
const frontendDebugIssuesStorageKey = 'auroraFrontendDebugIssues'
const frontendDebugMaxEvents = 400
const frontendDebugMaxIssues = 80
const frontendDebugSessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
const originalConsole = {
  error: console.error.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
}

let initialized = false
let eventSequence = 0
let events = []
let issues = []
let issueSequence = 0
let activeIssueStack = []

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

function normalizeIssueType(type) {
  return String(type || 'general')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general'
}

function createIssueId(type) {
  issueSequence += 1

  return `${normalizeIssueType(type)}-${Date.now().toString(36)}-${issueSequence.toString(36)}`
}

function getIssue(issueId) {
  return issues.find((issue) => issue.id === issueId) || null
}

function getActiveIssueId() {
  return activeIssueStack.at(-1) || ''
}

function persistIssues() {
  try {
    window.sessionStorage.setItem(frontendDebugIssuesStorageKey, JSON.stringify(issues))
  } catch {
    // Issue grouping is a debugging aid; console breadcrumbs should never fail the app.
  }
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

function loadPersistedIssues() {
  try {
    const parsedIssues = JSON.parse(window.sessionStorage.getItem(frontendDebugIssuesStorageKey) || '[]')

    if (Array.isArray(parsedIssues)) {
      issues = parsedIssues.slice(-frontendDebugMaxIssues)
      issueSequence = issues.reduce((max, issue) => {
        const suffix = String(issue?.id || '').split('-').at(-1)
        const parsedSuffix = Number.parseInt(suffix, 36)

        return Math.max(max, Number.isFinite(parsedSuffix) ? parsedSuffix : 0)
      }, 0)
    }
  } catch {
    issues = []
  }
}

function normalizeIssueContext(issueContext = {}) {
  if (!issueContext || typeof issueContext !== 'object') {
    return {
      issueId: getActiveIssueId(),
      issueType: '',
    }
  }

  const issueId = issueContext.issueId || issueContext.traceId || getActiveIssueId()
  const issue = issueId ? getIssue(issueId) : null

  return {
    issueId,
    issueType: issueContext.issueType || issue?.type || '',
  }
}

function updateIssueFromEvent(entry) {
  if (!entry.issueId) {
    return
  }

  const issue = getIssue(entry.issueId)

  if (!issue) {
    return
  }

  issue.updatedAt = entry.at
  issue.lastEventSeq = entry.seq
  issue.eventCount = (Number(issue.eventCount) || 0) + 1

  if (entry.level === 'error') {
    issue.errorCount = (Number(issue.errorCount) || 0) + 1
    if (issue.status === 'open') {
      issue.status = 'failing'
    }
  }

  if (entry.level === 'warn') {
    issue.warningCount = (Number(issue.warningCount) || 0) + 1
  }

  persistIssues()
}

function pushEvent(level, event, details = {}, issueContext = {}) {
  const normalizedIssueContext = normalizeIssueContext(issueContext)
  const entry = {
    seq: eventSequence + 1,
    sessionId: frontendDebugSessionId,
    level,
    event,
    issueId: normalizedIssueContext.issueId || '',
    issueType: normalizedIssueContext.issueType || '',
    details: cloneDetail(details),
    location: getLocationSnapshot(),
    at: new Date().toISOString(),
  }

  eventSequence = entry.seq
  events = [...events, entry].slice(-frontendDebugMaxEvents)
  updateIssueFromEvent(entry)
  persistEvents()
  return entry
}

export function startFrontendDebugIssue(type = 'general', details = {}) {
  if (typeof window === 'undefined') {
    return ''
  }

  const normalizedType = normalizeIssueType(type)
  const now = new Date().toISOString()
  const issue = {
    id: createIssueId(normalizedType),
    sessionId: frontendDebugSessionId,
    type: normalizedType,
    title: details?.title || normalizedType,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    closedAt: '',
    location: getLocationSnapshot(),
    details: cloneDetail(details),
    eventCount: 0,
    errorCount: 0,
    warningCount: 0,
    lastEventSeq: 0,
    outcome: '',
  }

  issues = [...issues, issue].slice(-frontendDebugMaxIssues)
  persistIssues()
  pushEvent('info', 'debug:issue-start', {
    issueId: issue.id,
    issueType: issue.type,
    title: issue.title,
    details,
  }, { issueId: issue.id, issueType: issue.type })

  return issue.id
}

export function endFrontendDebugIssue(issueId, outcome = 'closed', details = {}) {
  const issue = getIssue(issueId)

  if (!issue) {
    return null
  }

  const now = new Date().toISOString()
  issue.status = outcome === 'resolved' || outcome === 'closed' || outcome === 'success'
    ? 'closed'
    : outcome || 'closed'
  issue.outcome = outcome || 'closed'
  issue.closedAt = now
  issue.updatedAt = now
  issue.details = {
    ...issue.details,
    closedWith: cloneDetail(details),
  }
  persistIssues()
  activeIssueStack = activeIssueStack.filter((activeIssueId) => activeIssueId !== issueId)

  return pushEvent(
    issue.status === 'closed' ? 'info' : 'warn',
    'debug:issue-end',
    {
      issueId,
      issueType: issue.type,
      outcome,
      details,
    },
    { issueId, issueType: issue.type },
  )
}

export function withFrontendDebugIssue(issueId, callback) {
  if (!issueId || typeof callback !== 'function') {
    return callback?.()
  }

  activeIssueStack = [...activeIssueStack, issueId]

  try {
    return callback()
  } finally {
    activeIssueStack = activeIssueStack.filter((activeIssueId, index) =>
      activeIssueId !== issueId || index !== activeIssueStack.lastIndexOf(issueId),
    )
  }
}

export function logFrontendDebug(event, details = {}, level = 'info', issueContext = {}) {
  if (typeof console === 'undefined') {
    return null
  }

  const entry = pushEvent(level, event, details, issueContext)
  const consoleMethod = level === 'error' ? originalConsole.error : level === 'warn' ? originalConsole.warn : originalConsole.info

  consoleMethod(frontendDebugPrefix, event, entry)
  return entry
}

function getDebugSummary() {
  const errors = events.filter((entry) => entry.level === 'error')
  const warnings = events.filter((entry) => entry.level === 'warn')
  const openIssues = issues.filter((issue) => issue.status !== 'closed')

  return {
    sessionId: frontendDebugSessionId,
    count: events.length,
    errors: errors.length,
    warnings: warnings.length,
    issues: issues.length,
    openIssues: openIssues.length,
    activeIssueId: getActiveIssueId(),
    lastEvent: events.at(-1) || null,
    lastIssue: issues.at(-1) || null,
  }
}

function installConsoleBreadcrumbs() {
  console.warn = (...args) => {
    pushEvent('warn', 'console:warn', { args }, { issueId: getActiveIssueId() })
    originalConsole.warn(...args)
  }

  console.error = (...args) => {
    pushEvent('error', 'console:error', { args }, { issueId: getActiveIssueId() })
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
    const issueId = getActiveIssueId()

    pushEvent('info', 'fetch:start', {
      eventId,
      method,
      url,
    }, { issueId })

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
      }, { issueId })

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
      }, 'error', { issueId })
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
    activeIssues() {
      return issues.filter((issue) => activeIssueStack.includes(issue.id))
    },
    clear() {
      events = []
      issues = []
      eventSequence = 0
      issueSequence = 0
      activeIssueStack = []
      persistEvents()
      persistIssues()
      logFrontendDebug('debug:cleared')
    },
    endIssue(issueId, outcome = 'closed', details = {}) {
      return endFrontendDebugIssue(issueId, outcome, details)
    },
    errors() {
      return events.filter((entry) => entry.level === 'error')
    },
    export() {
      return JSON.stringify({
        sessionId: frontendDebugSessionId,
        summary: getDebugSummary(),
        issues,
        events,
      }, null, 2)
    },
    exportIssue(issueId) {
      const issue = getIssue(issueId)

      return JSON.stringify({
        sessionId: frontendDebugSessionId,
        issue,
        events: events.filter((entry) => entry.issueId === issueId),
      }, null, 2)
    },
    issue(issueId) {
      const issue = getIssue(issueId)

      if (!issue) {
        return null
      }

      return {
        ...issue,
        events: events.filter((entry) => entry.issueId === issueId),
      }
    },
    issues(status = '') {
      return status
        ? issues.filter((issue) => issue.status === status)
        : [...issues]
    },
    last(count = 25) {
      return events.slice(-count)
    },
    lastIssue(type = '') {
      const normalizedType = type ? normalizeIssueType(type) : ''

      return [...issues]
        .reverse()
        .find((issue) => !normalizedType || issue.type === normalizedType) || null
    },
    mark(label, details = {}) {
      return logFrontendDebug('debug:mark', { label, ...details })
    },
    report() {
      return {
        summary: getDebugSummary(),
        openIssues: issues.filter((issue) => issue.status !== 'closed'),
        recentErrors: events.filter((entry) => entry.level === 'error').slice(-20),
        recentWarnings: events.filter((entry) => entry.level === 'warn').slice(-20),
      }
    },
    startIssue(type = 'general', details = {}) {
      return startFrontendDebugIssue(type, details)
    },
    summary: getDebugSummary,
    trace(issueId) {
      return events.filter((entry) => entry.issueId === issueId)
    },
  }
}

export function initializeFrontendDebug() {
  if (initialized || typeof window === 'undefined') {
    return
  }

  initialized = true
  loadPersistedEvents()
  loadPersistedIssues()
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
