export const themeStorageKey = 'aurora-theme-preference'
export const themePreferences = {
  system: 'system',
  light: 'light',
  dark: 'dark',
}

export function getSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return themePreferences.light
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? themePreferences.dark
    : themePreferences.light
}

export function readThemePreference() {
  if (typeof window === 'undefined') {
    return themePreferences.system
  }

  const storedTheme = window.localStorage.getItem(themeStorageKey)

  if (
    storedTheme === themePreferences.light
    || storedTheme === themePreferences.dark
    || storedTheme === themePreferences.system
  ) {
    return storedTheme
  }

  return themePreferences.system
}

export function resolveTheme(preference) {
  if (preference === themePreferences.dark || preference === themePreferences.light) {
    return preference
  }

  return getSystemTheme()
}

export function applyResolvedTheme(resolvedTheme) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.theme = resolvedTheme
  document.documentElement.style.colorScheme = resolvedTheme

  if (document.body) {
    document.body.dataset.theme = resolvedTheme
    document.body.style.colorScheme = resolvedTheme
  }
}

export function persistThemePreference(preference) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(themeStorageKey, preference)
}

export function initializeTheme() {
  const preference = readThemePreference()
  const resolvedTheme = resolveTheme(preference)

  applyResolvedTheme(resolvedTheme)

  return {
    preference,
    resolvedTheme,
  }
}
