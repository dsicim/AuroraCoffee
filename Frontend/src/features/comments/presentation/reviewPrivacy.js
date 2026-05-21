export function normalizeReviewPrivacyMode(value) {
  return ['full', 'initials', 'anonymous'].includes(value) ? value : 'initials'
}

export function getDisplayNameWords(displayName) {
  return String(displayName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function getReviewPrivacyCodeMode(value, fallbackMode = 'initials') {
  const normalizedValue = String(value || '').trim().toLowerCase()

  if (normalizedValue === 's') {
    return 'full'
  }

  if (normalizedValue === 'h') {
    return 'anonymous'
  }

  if (normalizedValue === 'i') {
    return 'initials'
  }

  return normalizeReviewPrivacyMode(fallbackMode)
}

function buildReviewPrivacyInitialWord(word) {
  let normalizedWord = String(word || '').trim()

  while (normalizedWord.startsWith('.') && normalizedWord.length > 1) {
    normalizedWord = normalizedWord.slice(1)
  }

  if (!normalizedWord) {
    return ''
  }

  return `${String(word || '').trim()[0]}.`
}

export function buildReviewPrivacyWordPreview(word, mode) {
  const normalizedMode = normalizeReviewPrivacyMode(mode)

  if (normalizedMode === 'full') {
    return word
  }

  if (normalizedMode === 'anonymous') {
    return '-'
  }

  return buildReviewPrivacyInitialWord(word) || '-'
}

export function buildReviewPrivacySelection(displayName, mode = 'initials') {
  const words = getDisplayNameWords(displayName)
  const normalizedMode = normalizeReviewPrivacyMode(mode)

  return words.map(() => normalizedMode)
}

export function buildReviewPrivacySelectionFromCode(
  privacyCode,
  displayName,
  fallbackMode = 'initials',
) {
  const words = getDisplayNameWords(displayName)
  const normalizedPrivacyCode = String(privacyCode || '').trim().toLowerCase()
  const fallbackPrivacyMode = normalizedPrivacyCode
    ? getReviewPrivacyCodeMode(normalizedPrivacyCode[0], fallbackMode)
    : normalizeReviewPrivacyMode(fallbackMode)

  return words.map((_, index) =>
    getReviewPrivacyCodeMode(normalizedPrivacyCode[index], fallbackPrivacyMode),
  )
}

export function getReviewPrivacyFallbackMode(selection, fallbackMode = 'initials') {
  if (!Array.isArray(selection) || !selection.length) {
    return normalizeReviewPrivacyMode(fallbackMode)
  }

  const normalizedSelection = selection.map((mode) => normalizeReviewPrivacyMode(mode))
  const [firstMode] = normalizedSelection

  return normalizedSelection.every((mode) => mode === firstMode)
    ? firstMode
    : normalizeReviewPrivacyMode(fallbackMode)
}

export function resolveReviewPrivacySelection(selection, displayName, fallbackMode = 'initials') {
  const words = getDisplayNameWords(displayName)

  if (!words.length) {
    return []
  }

  if (!Array.isArray(selection) || !selection.length) {
    return buildReviewPrivacySelection(displayName, fallbackMode)
  }

  const normalizedFallbackMode = getReviewPrivacyFallbackMode(selection, fallbackMode)

  return words.map((_, index) => normalizeReviewPrivacyMode(selection[index] || normalizedFallbackMode))
}

export function buildReviewPrivacyPreviewName(selection, displayName) {
  const words = getDisplayNameWords(displayName)
  const resolvedSelection = resolveReviewPrivacySelection(selection, displayName)
  const previewWords = words
    .map((word, index) => buildReviewPrivacyWordPreview(word, resolvedSelection[index]))
    .filter((word) => word && word !== '-')

  return previewWords.length ? previewWords.join(' ') : 'Anonymous'
}

export function buildReviewPrivacyCode(selectionOrMode, displayName) {
  const words = getDisplayNameWords(displayName)

  if (!words.length) {
    return ''
  }

  const resolvedSelection = Array.isArray(selectionOrMode)
    ? resolveReviewPrivacySelection(selectionOrMode, displayName)
    : buildReviewPrivacySelection(displayName, selectionOrMode)

  return resolvedSelection
    .map((mode) => (mode === 'full' ? 's' : mode === 'anonymous' ? 'h' : 'i'))
    .join('')
}
