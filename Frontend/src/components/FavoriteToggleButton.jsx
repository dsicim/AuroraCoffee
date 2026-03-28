import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  accountDataChangeEvent,
  isFavoriteProduct,
  reconcileAccountStorageWithAuth,
  toggleFavoriteProduct,
} from '../lib/accountData'
import { getAuthSession } from '../lib/auth'

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
    window.addEventListener(accountDataChangeEvent, syncFavoriteState)
    const initialSyncId = window.setTimeout(syncFromStorage, 0)

    return () => {
      window.removeEventListener('storage', syncFromStorage)
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

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isFavorite}
      aria-label={
        isFavorite
          ? `Remove ${productName} from favorites`
          : `Save ${productName} to favorites`
      }
      className={`inline-flex items-center justify-center rounded-full border transition ${
        compact
          ? 'h-11 w-11 border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.92)] text-[var(--aurora-text-strong)] shadow-[0_10px_24px_rgba(108,69,51,0.08)] hover:bg-[var(--aurora-primary-pale)]'
          : 'gap-2 border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.92)] px-4 py-2.5 text-sm font-semibold text-[var(--aurora-text-strong)] shadow-[0_10px_24px_rgba(108,69,51,0.08)] hover:bg-[var(--aurora-primary-pale)]'
      } ${isFavorite ? 'border-[var(--aurora-sky)] bg-[rgba(144,180,196,0.18)] text-[var(--aurora-sky-deep)]' : ''}`}
    >
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
      {compact ? null : <span>{isFavorite ? 'Saved' : 'Favorite'}</span>}
    </button>
  )
}
