import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  accountDataChangeEvent,
  isFavoriteProduct,
  reconcileAccountStorageWithAuth,
  toggleFavoriteProduct,
} from '../lib/accountData'
import {
  authChangeEvent,
  currentUserChangeEvent,
  getAuthStateSnapshot,
} from '../lib/auth'
import LiquidGlassButton, { LiquidGlassIconButton } from '../shared/components/ui/LiquidGlassButton'

export default function FavoriteToggleButton({
  productId,
  productName,
  compact = false,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [authState, setAuthState] = useState(() => getAuthStateSnapshot())
  const [isFavorite, setIsFavorite] = useState(() => isFavoriteProduct(productId))
  const canToggleFavorite = authState.hasUsableSession
  const displayIsFavorite = canToggleFavorite && isFavorite

  useEffect(() => {
    const syncFavoriteState = (shouldReconcile = false) => {
      const nextAuthState = getAuthStateSnapshot()
      setAuthState(nextAuthState)

      if (shouldReconcile && nextAuthState.hasUsableSession) {
        reconcileAccountStorageWithAuth()
      }

      setIsFavorite(
        nextAuthState.hasUsableSession ? isFavoriteProduct(productId) : false,
      )
    }

    const syncReconciledFavoriteState = () => syncFavoriteState(true)
    const syncLocalFavoriteState = () => syncFavoriteState(false)

    window.addEventListener('storage', syncReconciledFavoriteState)
    window.addEventListener(authChangeEvent, syncReconciledFavoriteState)
    window.addEventListener(currentUserChangeEvent, syncLocalFavoriteState)
    window.addEventListener(accountDataChangeEvent, syncLocalFavoriteState)
    const initialSyncId = window.setTimeout(syncReconciledFavoriteState, 0)

    return () => {
      window.removeEventListener('storage', syncReconciledFavoriteState)
      window.removeEventListener(authChangeEvent, syncReconciledFavoriteState)
      window.removeEventListener(currentUserChangeEvent, syncLocalFavoriteState)
      window.removeEventListener(accountDataChangeEvent, syncLocalFavoriteState)
      window.clearTimeout(initialSyncId)
    }
  }, [productId])

  const handleClick = (event) => {
    event.preventDefault()
    event.stopPropagation()

    const nextAuthState = getAuthStateSnapshot()
    setAuthState(nextAuthState)

    if (nextAuthState.shouldRequestLogin || !nextAuthState.hasUsableSession) {
      setIsFavorite(false)
      navigate(
        `/login?next=${encodeURIComponent(location.pathname + location.search)}`,
      )
      return
    }

    const nextFavorites = toggleFavoriteProduct(productId)
    setIsFavorite(nextFavorites.includes(productId))
  }

  const label = displayIsFavorite
    ? `Remove ${productName} from favorites`
    : `Save ${productName} to favorites`

  const icon = (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={compact ? 'h-5.5 w-5.5' : 'h-5 w-5'}
      fill={displayIsFavorite ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20.7 4.9 13.9A4.8 4.8 0 0 1 12 7.6a4.8 4.8 0 0 1 7.1 6.3Z" />
    </svg>
  )

  if (compact) {
    return (
      <LiquidGlassIconButton
        type="button"
        onClick={handleClick}
        aria-pressed={displayIsFavorite}
        aria-label={label}
        selected={displayIsFavorite}
      >
        {icon}
      </LiquidGlassIconButton>
    )
  }

  return (
    <LiquidGlassButton
      type="button"
      variant="quiet"
      size="compact"
      onClick={handleClick}
      aria-pressed={displayIsFavorite}
      aria-label={label}
      selected={displayIsFavorite}
    >
      {icon}
      <span>{displayIsFavorite ? 'Saved' : 'Favorite'}</span>
    </LiquidGlassButton>
  )
}
