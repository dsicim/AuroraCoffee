import { useEffect, useMemo, useState } from 'react'
import {
  applyResolvedTheme,
  getSystemTheme,
  initializeTheme,
  persistThemePreference,
  readThemePreference,
  resolveTheme,
  themePreferences,
} from '../lib/theme'
import { ThemeContext } from '../lib/theme-context'

export default function ThemeProvider({ children }) {
  const [themePreference, setThemePreferenceState] = useState(() => readThemePreference())
  const [systemTheme, setSystemTheme] = useState(() => {
    if (typeof document !== 'undefined') {
      const activeTheme = document.documentElement.dataset.theme

      if (activeTheme === themePreferences.dark || activeTheme === themePreferences.light) {
        return activeTheme
      }
    }

    return initializeTheme().resolvedTheme
  })

  const resolvedTheme = useMemo(
    () => (themePreference === themePreferences.system ? systemTheme : themePreference),
    [systemTheme, themePreference],
  )

  useEffect(() => {
    persistThemePreference(themePreference)
    applyResolvedTheme(resolvedTheme)
  }, [resolvedTheme, themePreference])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const syncSystemTheme = () => {
      setSystemTheme(getSystemTheme())
    }

    syncSystemTheme()
    mediaQuery.addEventListener('change', syncSystemTheme)

    return () => {
      mediaQuery.removeEventListener('change', syncSystemTheme)
    }
  }, [themePreference])

  const value = useMemo(() => ({
    themePreference,
    resolvedTheme,
    setThemePreference: setThemePreferenceState,
    toggleTheme: () => {
      setThemePreferenceState((currentPreference) => {
        const currentResolvedTheme = resolveTheme(currentPreference)

        return currentResolvedTheme === themePreferences.dark
          ? themePreferences.light
          : themePreferences.dark
      })
    },
  }), [themePreference, resolvedTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
