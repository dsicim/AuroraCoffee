import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  accountDataChangeEvent,
  isFavoriteProduct,
  reconcileAccountStorageWithAuth,
  toggleFavoriteProduct,
} from '../lib/accountData'
import { authChangeEvent, getAuthSession } from '../lib/auth'
import LiquidGlassButton, { LiquidGlassIconButton } from './LiquidGlassButton'

export default function FavoriteToggleButton({
  productId,
  productName,
  compact = false,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getAuthSession())
  const [isFavorite, setIsFavorite] = useState(() => isFavoriteProduct(productId))
  const hasSession = Boolean(session?.token)

  useEffect(() => {
    const syncFromStorage = () => {
      setSession(getAuthSession())
      reconcileAccountStorageWithAuth()
      setIsFavorite(isFavoriteProduct(productId))
    }

    const syncFavoriteState = () => {
      setSession(getAuthSession())
      setIsFavorite(isFavoriteProduct(productId))
    }

    window.addEventListener('storage', syncFromStorage)
    window.addEventListener(authChangeEvent, syncFavoriteState)
    window.addEventListener(accountDataChangeEvent, syncFavoriteState)
    const initialSyncId = window.setTimeout(syncFromStorage, 0)

    return () => {
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener(authChangeEvent, syncFavoriteState)
      window.removeEventListener(accountDataChangeEvent, syncFavoriteState)
      window.clearTimeout(initialSyncId)
    }
  }, [productId])

  const handleClick = (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (!hasSession) {
      navigate(
        `/login?next=${encodeURIComponent(location.pathname + location.search)}`,
      )
      return
    }

    const nextFavorites = toggleFavoriteProduct(productId)
    setIsFavorite(nextFavorites.includes(productId))
  }

  const label = isFavorite
    ? `Remove ${productName} from favorites`
    : `Save ${productName} to favorites`

  const icon = (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={compact ? 'h-5.5 w-5.5' : 'h-5 w-5'}
      fill={isFavorite ? 'currentColor' : 'none'}
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
        aria-pressed={isFavorite}
        aria-label={label}
        selected={isFavorite}
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
      aria-pressed={isFavorite}
      aria-label={label}
      selected={isFavorite}
    >
      {icon}
      <span>{isFavorite ? 'Saved' : 'Favorite'}</span>
    </LiquidGlassButton>
  )
}
