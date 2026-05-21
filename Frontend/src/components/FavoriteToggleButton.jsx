import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  authChangeEvent,
  currentUserChangeEvent,
  getAuthStateSnapshot,
} from '../lib/auth'
import {
  addProductToWishlist,
  fetchWishlistItems,
  isWishlistProduct,
  removeProductFromWishlist,
  wishlistChangeEvent,
} from '../lib/wishlist'
import LiquidGlassButton, { LiquidGlassIconButton } from '../shared/components/ui/LiquidGlassButton'

export default function FavoriteToggleButton({
  productId,
  productName,
  compact = false,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [authState, setAuthState] = useState(() => getAuthStateSnapshot())
  const [isFavorite, setIsFavorite] = useState(() => isWishlistProduct(productId))
  const [isSyncing, setIsSyncing] = useState(false)
  const canToggleFavorite = authState.hasUsableSession
  const displayIsFavorite = canToggleFavorite && isFavorite

  useEffect(() => {
    const syncFavoriteState = () => {
      const nextAuthState = getAuthStateSnapshot()
      setAuthState(nextAuthState)

      setIsFavorite(
        nextAuthState.hasUsableSession ? isWishlistProduct(productId) : false,
      )
    }

    const syncRemoteFavoriteState = () => {
      const nextAuthState = getAuthStateSnapshot()
      setAuthState(nextAuthState)

      if (!nextAuthState.hasUsableSession) {
        setIsFavorite(false)
        return
      }

      void fetchWishlistItems()
        .then(() => {
          setIsFavorite(isWishlistProduct(productId))
        })
        .catch(() => {
          setIsFavorite(false)
        })
    }

    window.addEventListener(authChangeEvent, syncRemoteFavoriteState)
    window.addEventListener(currentUserChangeEvent, syncFavoriteState)
    window.addEventListener(wishlistChangeEvent, syncFavoriteState)
    const initialSyncId = window.setTimeout(syncRemoteFavoriteState, 0)

    return () => {
      window.removeEventListener(authChangeEvent, syncRemoteFavoriteState)
      window.removeEventListener(currentUserChangeEvent, syncFavoriteState)
      window.removeEventListener(wishlistChangeEvent, syncFavoriteState)
      window.clearTimeout(initialSyncId)
    }
  }, [productId])

  const handleClick = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (isSyncing) {
      return
    }

    const nextAuthState = getAuthStateSnapshot()
    setAuthState(nextAuthState)

    if (nextAuthState.shouldRequestLogin || !nextAuthState.hasUsableSession) {
      setIsFavorite(false)
      navigate(
        `/login?next=${encodeURIComponent(location.pathname + location.search)}`,
      )
      return
    }

    setIsSyncing(true)
    const nextFavoriteState = !isFavorite
    setIsFavorite(nextFavoriteState)

    try {
      if (nextFavoriteState) {
        await addProductToWishlist(productId)
      } else {
        await removeProductFromWishlist(productId)
      }
    } catch (error) {
      console.error('Wishlist sync error:', error)
      setIsFavorite(!nextFavoriteState)
    } finally {
      setIsSyncing(false)
    }
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
        disabled={isSyncing}
        loading={isSyncing}
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
      disabled={isSyncing}
      loading={isSyncing}
    >
      {icon}
      <span>{displayIsFavorite ? 'Saved' : 'Favorite'}</span>
    </LiquidGlassButton>
  )
}
