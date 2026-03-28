import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import auroraLogo from '../assets/aurora-logo.jpeg'
import {
  clearAuthSession,
  fetchCurrentUser,
  getAuthSession,
} from '../lib/auth'
import { reconcileAccountStorageWithAuth } from '../lib/accountData'
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
  const menuRef = useRef(null)
  const [session, setSession] = useState(getAuthSession())
  const [user, setUser] = useState(null)
  const [cartCount, setCartCount] = useState(getCartCount())
  const [menuOpen, setMenuOpen] = useState(false)
  const hasSession = Boolean(session?.token)
  const displayName = user?.displayname || 'Coffee Lover'

  const accountLinks = [
    { label: 'Orders', to: '/account/orders' },
    { label: 'Saved Addresses', to: '/account/addresses' },
    { label: 'Favorites', to: '/account/favorites' },
  ]

  useEffect(() => {
    const syncSessionState = () => {
      setSession(getAuthSession())
      setUser(null)
      reconcileAccountStorageWithAuth()
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

  useEffect(() => {
    if (!menuOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
    }
  }, [menuOpen])

  const handleLogout = () => {
    setMenuOpen(false)
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
          <div
            className="relative"
            ref={menuRef}
            onMouseEnter={() => setMenuOpen(true)}
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="inline-flex items-center gap-3 rounded-full border border-[rgba(138,144,119,0.26)] bg-[rgba(255,247,242,0.88)] px-4 py-2.5 text-sm font-semibold text-[var(--aurora-text-strong)] shadow-[0_10px_28px_rgba(95,58,43,0.08)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-cream)]"
            >
              <span>{displayName}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className={`h-4 w-4 transition ${menuOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m5 7 5 6 5-6" />
              </svg>
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-full z-30 w-60 pt-4">
                <div className="rounded-[1.75rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.97)] p-3 shadow-[0_24px_70px_rgba(95,58,43,0.14)] backdrop-blur">
                  <div className="border-b border-[rgba(138,144,119,0.16)] px-3 pb-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      Account
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--aurora-text-strong)]">
                      {displayName}
                    </p>
                  </div>

                  <div className="mt-3 space-y-1">
                    {accountLinks.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMenuOpen(false)}
                        className="block rounded-[1.2rem] px-4 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[rgba(230,232,222,0.44)]"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-3 w-full rounded-[1.2rem] border border-[rgba(217,144,107,0.28)] bg-[rgba(248,227,214,0.62)] px-4 py-3 text-left text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:border-[rgba(176,41,41,0.8)] hover:bg-[rgba(176,41,41,0.9)] hover:text-[var(--aurora-cream)]"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : null}
          </div>
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
