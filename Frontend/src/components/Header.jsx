import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import auroraLogo from '../assets/aurora-logo.jpeg'
import LiquidGlassButton, { LiquidGlassIconButton } from './LiquidGlassButton'
import LiquidGlassFrame from './LiquidGlassFrame'
import {
  authChangeEvent,
  clearAuthSession,
  currentUserFetchStatus,
  fetchCurrentUserResult,
  getAuthSession,
} from '../lib/auth'
import { reconcileAccountStorageWithAuth } from '../lib/accountData'
import {
  cartChangeEvent,
  getCartCount,
  reconcileCartStorageWithAuth,
} from '../lib/cart'
import { getRoleLandingPath, getRoleLabel, userRoles } from '../lib/roles'

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Products', to: '/products' },
]

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const menuRef = useRef(null)
  const [session, setSession] = useState(getAuthSession())
  const [user, setUser] = useState(null)
  const [cartCount, setCartCount] = useState(getCartCount())
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const hasSession = Boolean(session?.token)
  const displayName = user?.displayname || 'Coffee Lover'
  const resolvedRole = getRoleLabel(user?.role)

  const accountLinks = resolvedRole === userRoles.customer
    ? [
      { label: 'Customer Home', to: '/customer' },
      { label: 'Account', to: '/account' },
      { label: 'Orders', to: '/account/orders' },
      { label: 'Saved Addresses', to: '/account/addresses' },
      { label: 'Favorites', to: '/account/favorites' },
    ]
    : [
      { label: `${resolvedRole} Home`, to: getRoleLandingPath(resolvedRole) },
      { label: 'Browse Storefront', to: '/' },
      { label: 'View Catalog', to: '/products' },
    ]

  useEffect(() => {
    const syncSessionState = () => {
      void (async () => {
        setSession(getAuthSession())
        setUser(null)
        reconcileAccountStorageWithAuth()
        await reconcileCartStorageWithAuth()
        setCartCount(getCartCount())
      })()
    }

    const syncCartState = () => {
      setCartCount(getCartCount())
    }

    window.addEventListener('storage', syncSessionState)
    window.addEventListener(authChangeEvent, syncSessionState)
    window.addEventListener(cartChangeEvent, syncCartState)
    const initialSyncId = window.setTimeout(syncSessionState, 0)

    return () => {
      window.removeEventListener('storage', syncSessionState)
      window.removeEventListener(authChangeEvent, syncSessionState)
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
      const result = await fetchCurrentUserResult(session.token)

      if (cancelled) {
        return
      }

      if (result.status === currentUserFetchStatus.ok) {
        setUser(result.user)
        return
      }

      setUser(null)
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

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMenuOpen(false)
      setMobileNavOpen(false)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [location.pathname, location.search])

  const handleLogout = () => {
    void (async () => {
      setMenuOpen(false)
      setMobileNavOpen(false)
      clearAuthSession()
      await reconcileCartStorageWithAuth()
      setSession(getAuthSession())
      setUser(null)
      setCartCount(getCartCount())
      navigate('/', { replace: true })
    })()
  }

  return (
    <header className="sticky top-0 z-40 px-2 pt-2 sm:px-6 sm:pt-4 lg:px-10 lg:pt-6">
      <div className="aurora-container">
        <LiquidGlassFrame
          className="aurora-glass-dock glass-nav relative overflow-visible rounded-[2rem]"
          contentClassName="px-2 py-2 sm:px-4 sm:py-3 lg:px-5"
        >
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
          <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
              <LiquidGlassIconButton
                type="button"
                aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
                aria-expanded={mobileNavOpen}
                onClick={() => setMobileNavOpen((current) => !current)}
                className="md:hidden"
                selected={mobileNavOpen}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  {mobileNavOpen ? (
                    <path d="M6 6 18 18M18 6 6 18" />
                  ) : (
                    <>
                      <path d="M4 7h16" />
                      <path d="M4 12h16" />
                      <path d="M4 17h16" />
                    </>
                  )}
                </svg>
              </LiquidGlassIconButton>

              <Link to="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <img
                  src={auroraLogo}
                  alt="Aurora Coffee Roastery logo"
                  className="h-12 w-12 rounded-[1.2rem] border border-white/26 object-cover shadow-[0_18px_40px_rgba(31,19,13,0.16)] sm:h-16 sm:w-16 sm:rounded-[1.5rem]"
                />
                <div className="hidden min-w-0 sm:block">
                  <p className="truncate font-display text-[1.55rem] leading-none text-[var(--aurora-text-strong)] sm:text-2xl">
                    Aurora Coffee
                  </p>
                </div>
              </Link>
            </div>

            <nav className="hidden justify-center md:flex">
              <div className="inline-flex items-center gap-2 rounded-[1.6rem] border border-white/18 bg-[rgba(255,251,247,0.14)] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.to

                  return (
                    <LiquidGlassButton
                      as={Link}
                      key={item.label}
                      to={item.to}
                      variant="chip"
                      size="compact"
                      selected={isActive}
                    >
                      {item.label}
                    </LiquidGlassButton>
                  )
                })}
              </div>
            </nav>

            <div className="flex items-center justify-end gap-2 sm:gap-3">
              <LiquidGlassIconButton
                as={Link}
                to="/cart"
                aria-label={`Cart with ${cartCount} item${cartCount === 1 ? '' : 's'}`}
                className="relative"
                contentClassName="relative"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
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
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--aurora-sky)] px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-[var(--aurora-cream)]">
                  {cartCount}
                </span>
              </LiquidGlassIconButton>

              {hasSession ? (
                <div
                  className="relative"
                  ref={menuRef}
                  onMouseEnter={() => setMenuOpen(true)}
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <LiquidGlassButton
                    type="button"
                    variant="quiet"
                    size="compact"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((current) => !current)}
                    selected={menuOpen}
                    className="aurora-account-trigger"
                  >
                    <span className="hidden sm:inline">{displayName}</span>
                    <span className="rounded-full bg-[rgba(255,255,255,0.14)] px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-[var(--aurora-olive-deep)] sm:hidden">
                      Menu
                    </span>
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
                  </LiquidGlassButton>

                  {menuOpen ? (
                    <>
                      <div
                        className="fixed inset-0 z-40 bg-[rgba(248,244,239,0.38)] backdrop-blur-[2px] md:hidden"
                        onClick={() => setMenuOpen(false)}
                        aria-hidden="true"
                      />
                      <div className="fixed inset-x-3 top-[6.4rem] z-50 md:absolute md:right-0 md:left-auto md:top-full md:z-30 md:w-72 md:pt-4">
                        <div className="aurora-showcase-band aurora-account-menu p-3">
                        <Link
                          to={resolvedRole === userRoles.customer ? '/account' : getRoleLandingPath(resolvedRole)}
                          onClick={() => setMenuOpen(false)}
                          className="aurora-solid-plate aurora-account-menu-profile block rounded-[1.5rem] px-4 py-4"
                        >
                          <p className="aurora-kicker">{resolvedRole}</p>
                          <p className="mt-2 text-sm font-semibold text-[var(--aurora-text-strong)]">
                            {displayName}
                          </p>
                        </Link>

                        <div className="mt-3 space-y-1.5">
                          {accountLinks.map((item) => (
                            <LiquidGlassButton
                              as={Link}
                              key={item.to}
                              to={item.to}
                              onClick={() => setMenuOpen(false)}
                              variant="quiet"
                              size="compact"
                              className="w-full"
                              contentClassName="w-full justify-start"
                            >
                              {item.label}
                            </LiquidGlassButton>
                          ))}
                        </div>

                        <LiquidGlassButton
                          type="button"
                          onClick={handleLogout}
                          variant="danger"
                          size="compact"
                          className="aurora-logout-button mt-3 w-full"
                          contentClassName="w-full justify-start"
                        >
                          Logout
                        </LiquidGlassButton>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <LiquidGlassButton
                  as={Link}
                  to="/login"
                  variant="secondary"
                  size="compact"
                  contentClassName="whitespace-nowrap"
                >
                  Login
                </LiquidGlassButton>
              )}
            </div>
          </div>
        </LiquidGlassFrame>

        {mobileNavOpen ? (
          <div className="mt-2 flex md:hidden">
            <LiquidGlassFrame
              className="aurora-glass-dock glass-nav w-fit max-w-full rounded-[1.5rem]"
              contentClassName="p-2.5"
            >
              <div className="flex flex-col gap-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.to

                  return (
                    <LiquidGlassButton
                      as={Link}
                      key={item.label}
                      to={item.to}
                      variant="chip"
                      size="compact"
                      selected={isActive}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {item.label}
                    </LiquidGlassButton>
                  )
                })}
              </div>
            </LiquidGlassFrame>
          </div>
        ) : null}
      </div>
    </header>
  )
}
