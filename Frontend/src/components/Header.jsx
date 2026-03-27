import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import auroraLogo from '../assets/aurora-logo.jpeg'
import {
  clearAuthSession,
  fetchCurrentUser,
  getAuthSession,
} from '../lib/auth'
import {
  cartChangeEvent,
  getCartCount,
  reconcileCartStorageWithAuth,
} from '../lib/cart'

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Products', to: '/products' },
  { label: 'Our Story', href: '/#about' },
  { label: 'Contact', href: '/#footer' },
]

export default function Header() {
  const navigate = useNavigate()
  const [session, setSession] = useState(getAuthSession())
  const [user, setUser] = useState(null)
  const [cartCount, setCartCount] = useState(getCartCount())
  const hasSession = Boolean(session?.token)
  const displayName = user?.displayname || 'Aurora User'

  useEffect(() => {
    const syncSessionState = () => {
      setSession(getAuthSession())
      setUser(null)
      reconcileCartStorageWithAuth()
      setCartCount(getCartCount())
    }

    const syncCartState = () => {
      setCartCount(getCartCount())
    }

    window.addEventListener('storage', syncSessionState)
    window.addEventListener(cartChangeEvent, syncCartState)
    const initialSyncId = window.setTimeout(syncSessionState, 0)

    return () => {
      window.removeEventListener('storage', syncSessionState)
      window.removeEventListener(cartChangeEvent, syncCartState)
      window.clearTimeout(initialSyncId)
    }
  }, [])

  useEffect(() => {
    if (!session?.token) {
      return
    }

    let cancelled = false

    const loadUser = async () => {
      try {
        const nextUser = await fetchCurrentUser(session.token)

        if (!cancelled) {
          setUser(nextUser)
        }
      } catch {
        if (!cancelled) {
          setUser(null)
        }
      }
    }

    loadUser()

    return () => {
      cancelled = true
    }
  }, [session?.token])

  const handleLogout = () => {
    clearAuthSession()
    reconcileCartStorageWithAuth()
    setSession(getAuthSession())
    setUser(null)
    setCartCount(getCartCount())
    navigate('/', { replace: true })
  }

  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
      <Link to="/" className="flex items-center">
        <img
          src={auroraLogo}
          alt="Aurora Coffee Roastery logo"
          className="h-24 w-24 rounded-full object-cover shadow-[0_10px_28px_rgba(95,58,43,0.12)] md:h-28 md:w-28"
        />
      </Link>

      <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--aurora-text)] md:flex">
        {navItems.map((item) => (
          item.to ? (
            <Link
              key={item.label}
              to={item.to}
              className="transition hover:text-[var(--aurora-olive-deep)]"
            >
              {item.label}
            </Link>
          ) : (
            <a
              key={item.label}
              href={item.href}
              className="transition hover:text-[var(--aurora-olive-deep)]"
            >
              {item.label}
            </a>
          )
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <Link
          to="/cart"
          aria-label={`Cart with ${cartCount} item${cartCount === 1 ? '' : 's'}`}
          className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(138,144,119,0.26)] bg-[rgba(255,247,242,0.88)] text-[var(--aurora-text-strong)] shadow-[0_10px_28px_rgba(95,58,43,0.08)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-cream)]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5.5 w-5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="20" r="1.5" />
            <circle cx="18" cy="20" r="1.5" />
            <path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.76L20 8H7" />
          </svg>
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--aurora-sky)] px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-[var(--aurora-cream)] shadow-[0_8px_18px_rgba(144,180,196,0.28)]">
            {cartCount}
          </span>
        </Link>

        {hasSession ? (
          <>
            <span className="rounded-full border border-[rgba(138,144,119,0.26)] bg-[rgba(255,247,242,0.88)] px-4 py-2 text-sm font-semibold text-[var(--aurora-text-strong)] shadow-[0_10px_28px_rgba(95,58,43,0.08)]">
              {displayName}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-5 py-3 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_10px_30px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-5 py-3 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_10px_30px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  )
}
