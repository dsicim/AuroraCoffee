import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import LiquidGlassButton, { LiquidGlassIconButton } from '../shared/components/ui/LiquidGlassButton'
import LiquidGlassFrame from '../shared/components/ui/LiquidGlassFrame'
import {
  authChangeEvent,
  clearAuthSession,
  currentUserChangeEvent,
  currentUserFetchStatus,
  fetchCurrentUserResult,
  getAuthStateSnapshot,
} from '../lib/auth'
import { reconcileAccountStorageWithAuth } from '../lib/accountData'
import {
  cartChangeEvent,
  getCartCount,
  reconcileCartStorageWithAuth,
} from '../lib/cart'
import { getRoleLandingPath, getRoleLabel, normalizeUserRole, userRoles } from '../lib/roles'

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Products', to: '/products' },
]

const brandLogo = '/assets/pwa512.png'
const brandTextLogo = '/assets/logotext.svg'

function getProductSearchFromLocation(location) {
  if (location.pathname !== '/products') {
    return ''
  }

  return new URLSearchParams(location.search).get('search') || ''
}

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const scrollFrameRef = useRef(null)
  const lastScrollYRef = useRef(0)
  const upwardScrollDistanceRef = useRef(0)
  const keepHeaderVisibleRef = useRef(false)
  const menuRef = useRef(null)
  const searchInputRef = useRef(null)
  const searchButtonRef = useRef(null)
  const cartButtonRef = useRef(null)
  const mobileNavButtonRef = useRef(null)
  const [authState, setAuthState] = useState(() => getAuthStateSnapshot())
  const [cartCount, setCartCount] = useState(getCartCount())
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [headerHidden, setHeaderHidden] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [headerSearch, setHeaderSearch] = useState('')
  const headerInteractionOpen = menuOpen || mobileNavOpen || searchOpen
  const session = authState.session
  const currentUserState = authState.currentUserState
  const hasAccountSession = authState.hasUsableSession
  const displayName =
    authState.user?.displayname ||
    session?.email ||
    (authState.isChecking
      ? 'Checking account'
      : authState.isProfileError
        ? 'Account session'
        : 'Coffee Lover')
  const roleLabel = hasAccountSession
    ? getRoleLabel(authState.user?.role) || (authState.isChecking ? 'Checking role' : 'Account')
    : 'Guest shopper'
  const normalizedRole = normalizeUserRole(authState.user?.role)
  const roleLandingPath = normalizedRole ? getRoleLandingPath(normalizedRole) : '/dashboard'
  const canUseCustomerAccountTools =
    normalizedRole === userRoles.customer || normalizedRole === userRoles.admin
  useEffect(() => {
    const syncSessionState = () => {
      void (async () => {
        setAuthState(getAuthStateSnapshot())
        reconcileAccountStorageWithAuth()
        try {
          await reconcileCartStorageWithAuth()
        } catch {
          // Ignore stale auth/cart sync failures during session changes.
        }
        setAuthState(getAuthStateSnapshot())
        setCartCount(getCartCount())
      })()
    }

    const syncCurrentUserState = () => {
      setAuthState(getAuthStateSnapshot())
    }

    const syncCartState = () => {
      setCartCount(getCartCount())
    }

    window.addEventListener('storage', syncSessionState)
    window.addEventListener(authChangeEvent, syncSessionState)
    window.addEventListener(currentUserChangeEvent, syncCurrentUserState)
    window.addEventListener(cartChangeEvent, syncCartState)
    const initialSyncId = window.setTimeout(syncSessionState, 0)

    return () => {
      window.removeEventListener('storage', syncSessionState)
      window.removeEventListener(authChangeEvent, syncSessionState)
      window.removeEventListener(currentUserChangeEvent, syncCurrentUserState)
      window.removeEventListener(cartChangeEvent, syncCartState)
      window.clearTimeout(initialSyncId)
    }
  }, [])

  useEffect(() => {
    if (!session?.token) {
      return
    }

    if (
      currentUserState.token === session.token &&
      (
        currentUserState.status === currentUserFetchStatus.ok ||
        currentUserState.status === currentUserFetchStatus.loading ||
        currentUserState.status === currentUserFetchStatus.unauthorized ||
        currentUserState.status === currentUserFetchStatus.error
      )
    ) {
      return
    }

    void fetchCurrentUserResult(session.token)
  }, [currentUserState.status, currentUserState.token, session?.token])

  useEffect(() => {
    if (!menuOpen && !searchOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false)
        setSearchOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
    }
  }, [menuOpen, searchOpen])

  const closeHeaderInteractions = useCallback((returnFocus = false) => {
    const focusTarget = menuOpen
      ? cartButtonRef
      : mobileNavOpen
        ? mobileNavButtonRef
        : searchOpen
          ? searchButtonRef
          : null

    setMenuOpen(false)
    setMobileNavOpen(false)
    setSearchOpen(false)
    setHeaderHidden(false)

    if (returnFocus && focusTarget?.current) {
      window.requestAnimationFrame(() => {
        focusTarget.current?.focus()
      })
    }
  }, [menuOpen, mobileNavOpen, searchOpen])

  useEffect(() => {
    if (!headerInteractionOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      closeHeaderInteractions(true)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [headerInteractionOpen, closeHeaderInteractions])

  useEffect(() => {
    keepHeaderVisibleRef.current = headerInteractionOpen

    if (!headerInteractionOpen) {
      return undefined
    }

    const frameId = window.requestAnimationFrame(() => {
      setHeaderHidden(false)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [headerInteractionOpen])

  useEffect(() => {
    lastScrollYRef.current = window.scrollY
    const revealDistance = 112

    const revealHeader = () => {
      upwardScrollDistanceRef.current = 0
      setHeaderHidden(false)
    }

    const handleScroll = () => {
      if (scrollFrameRef.current !== null) {
        return
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY
        const scrollDelta = currentScrollY - lastScrollYRef.current

        if (currentScrollY <= 16 || keepHeaderVisibleRef.current) {
          revealHeader()
        } else if (scrollDelta > 12 && currentScrollY > 128) {
          upwardScrollDistanceRef.current = 0
          setHeaderHidden(true)
        } else if (scrollDelta < -1) {
          upwardScrollDistanceRef.current += Math.abs(scrollDelta)

          if (upwardScrollDistanceRef.current >= revealDistance) {
            revealHeader()
          }
        } else if (scrollDelta > 0) {
          upwardScrollDistanceRef.current = 0
        }

        lastScrollYRef.current = currentScrollY
        scrollFrameRef.current = null
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('focusin', revealHeader)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('focusin', revealHeader)

      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMenuOpen(false)
      setMobileNavOpen(false)
      setSearchOpen(false)
      setHeaderHidden(false)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [location.pathname, location.search])

  const handleLogout = () => {
    void (async () => {
      setMenuOpen(false)
      setMobileNavOpen(false)
      setSearchOpen(false)
      clearAuthSession()
      try {
        await reconcileCartStorageWithAuth()
      } catch {
        // Ignore stale server cart cleanup failures after logout.
      }
      setAuthState(getAuthStateSnapshot())
      setCartCount(getCartCount())
      navigate('/', { replace: true })
    })()
  }

  const openHeaderSearch = () => {
    setMenuOpen(false)
    setHeaderSearch(getProductSearchFromLocation(location))
    setSearchOpen(true)
    setHeaderHidden(false)
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
  }

  const handleHeaderSearchSubmit = (event) => {
    event.preventDefault()

    const normalizedSearch = headerSearch.trim()
    const searchPath = normalizedSearch
      ? `/products?search=${encodeURIComponent(normalizedSearch)}`
      : '/products'

    setMenuOpen(false)
    setSearchOpen(false)
    setMobileNavOpen(false)
    navigate(searchPath)
  }

  return (
    <header
      className={[
        'aurora-site-header sticky top-0 z-40 px-2 pt-1 sm:px-6 sm:pt-4 lg:px-10 lg:pt-6',
        headerHidden ? 'is-hidden' : 'is-visible',
      ].join(' ')}
    >
      <div
        className={[
          'aurora-container aurora-header-shell',
          menuOpen ? 'is-cart-menu-open' : '',
        ].join(' ')}
        ref={menuRef}
      >
        <LiquidGlassFrame
          className="aurora-glass-dock glass-nav relative overflow-visible rounded-[2rem]"
          contentClassName="px-2 py-1.5 sm:px-4 sm:py-3 lg:px-5"
        >
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[auto_1fr_auto]">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
              <LiquidGlassIconButton
                type="button"
                ref={mobileNavButtonRef}
                aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
                aria-expanded={mobileNavOpen}
                aria-controls="aurora-mobile-nav-panel"
                onClick={() => {
                  setMenuOpen(false)
                  setSearchOpen(false)
                  setMobileNavOpen((current) => !current)
                }}
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
                  src={brandLogo}
                  alt=""
                  aria-hidden="true"
                  className="aurora-brand-mark aurora-header-brand-mark h-12 w-12 rounded-[1rem] object-contain p-0 sm:h-16 sm:w-16 sm:rounded-[1.15rem]"
                />
                <div className="hidden min-w-0 sm:block">
                  <img
                    src={brandTextLogo}
                    alt="Aurora Coffee"
                    className="aurora-brand-wordmark h-8 w-auto max-w-[11rem] object-contain sm:h-9 sm:max-w-[14rem] lg:h-10 lg:max-w-[18rem]"
                  />
                </div>
              </Link>
            </div>

            <nav className="hidden min-w-0 justify-center md:flex">
              <div className="aurora-desktop-nav-shell inline-flex items-center gap-2 rounded-[1.6rem] px-2 py-2">
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
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {item.label}
                    </LiquidGlassButton>
                  )
                })}
              </div>
            </nav>

            <div
              className="aurora-header-actions relative flex items-center justify-end gap-2 justify-self-end sm:gap-3"
            >
              <div className={`aurora-header-search ${searchOpen ? 'is-open' : ''}`.trim()}>
                <form
                  className="aurora-header-search-form"
                  role="search"
                  aria-label="Product search"
                  aria-hidden={searchOpen ? undefined : 'true'}
                  onSubmit={handleHeaderSearchSubmit}
                >
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={headerSearch}
                    onChange={(event) => setHeaderSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        closeHeaderInteractions(true)
                      }
                    }}
                    placeholder="Search products"
                    aria-label="Search products"
                    name="header-search"
                    autoComplete="off"
                    spellCheck={false}
                    tabIndex={searchOpen ? 0 : -1}
                    className="aurora-header-search-input"
                  />
                  <LiquidGlassIconButton
                    type="submit"
                    aria-label="Search products"
                    className="aurora-header-search-submit"
                    tabIndex={searchOpen ? 0 : -1}
                    disabled={!searchOpen}
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
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.5-3.5" />
                    </svg>
                  </LiquidGlassIconButton>
                </form>

                <LiquidGlassIconButton
                  type="button"
                  ref={searchButtonRef}
                  aria-label="Open product search"
                  aria-hidden={searchOpen ? 'true' : undefined}
                  onClick={openHeaderSearch}
                  className="aurora-header-search-trigger"
                  tabIndex={searchOpen ? -1 : 0}
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
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                </LiquidGlassIconButton>
              </div>

              <div className="relative">
                <LiquidGlassIconButton
                  type="button"
                  ref={cartButtonRef}
                  aria-label={`Open cart menu with ${cartCount} item${cartCount === 1 ? '' : 's'}`}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-controls="aurora-cart-menu"
                  className="relative"
                  contentClassName="relative"
                  selected={menuOpen}
                  onClick={() => {
                    setSearchOpen(false)
                    setMobileNavOpen(false)
                    setMenuOpen((current) => !current)
                    setHeaderHidden(false)
                  }}
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
                  <span className="aurora-cart-count-badge absolute -right-1 -top-1 min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none">
                    {cartCount}
                  </span>
                </LiquidGlassIconButton>
              </div>
            </div>
          </div>
        </LiquidGlassFrame>

        {menuOpen ? (
          <>
            <div
              className="aurora-menu-backdrop fixed inset-0 z-40 md:hidden"
              onClick={() => closeHeaderInteractions(false)}
              aria-hidden="true"
            />
            <div
              id="aurora-cart-menu"
              className="aurora-cart-menu-popover"
              role="menu"
              aria-label="Cart and account menu"
            >
              <div className="aurora-showcase-band aurora-account-menu aurora-cart-menu p-3">
                <div className="aurora-cart-menu-summary rounded-[1.35rem] px-4">
                  <p className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                    {hasAccountSession ? displayName : 'Guest shopper'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--aurora-text)]">
                    {cartCount} item{cartCount === 1 ? '' : 's'} in cart
                  </p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--aurora-text-muted)]">
                    {roleLabel}
                  </p>
                </div>

                <div className="mt-3 space-y-1.5">
                  <LiquidGlassButton
                    as={Link}
                    to="/cart"
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                    variant="quiet"
                    size="compact"
                    className="w-full"
                    contentClassName="w-full justify-start"
                  >
                    Cart
                  </LiquidGlassButton>
                  {hasAccountSession ? (
                    <>
                      <LiquidGlassButton
                        as={Link}
                        to={roleLandingPath}
                        onClick={() => setMenuOpen(false)}
                        role="menuitem"
                        variant="quiet"
                        size="compact"
                        className="w-full"
                        contentClassName="w-full justify-start"
                      >
                        Dashboard
                      </LiquidGlassButton>
                      {canUseCustomerAccountTools ? (
                        <>
                          <LiquidGlassButton
                            as={Link}
                            to="/account/orders"
                            onClick={() => setMenuOpen(false)}
                            role="menuitem"
                            variant="quiet"
                            size="compact"
                            className="w-full"
                            contentClassName="w-full justify-start"
                          >
                            Orders
                          </LiquidGlassButton>
                          <LiquidGlassButton
                            as={Link}
                            to="/account"
                            onClick={() => setMenuOpen(false)}
                            role="menuitem"
                            variant="quiet"
                            size="compact"
                            className="w-full"
                            contentClassName="w-full justify-start"
                          >
                            Account
                          </LiquidGlassButton>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>

                {hasAccountSession ? (
                  <LiquidGlassButton
                    type="button"
                    onClick={handleLogout}
                    role="menuitem"
                    variant="danger"
                    size="compact"
                    className="aurora-logout-button mt-3 w-full"
                    contentClassName="w-full justify-start"
                  >
                    Logout
                  </LiquidGlassButton>
                ) : (
                  <LiquidGlassButton
                    as={Link}
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                    variant="secondary"
                    size="compact"
                    className="mt-3 w-full"
                    contentClassName="w-full justify-start"
                  >
                    Login
                  </LiquidGlassButton>
                )}
              </div>
            </div>
          </>
        ) : null}

        {searchOpen ? (
          <div
            className="aurora-search-backdrop fixed inset-0 md:hidden"
            onClick={() => closeHeaderInteractions(false)}
            aria-hidden="true"
          />
        ) : null}

        {mobileNavOpen ? (
          <div className="mt-2 md:hidden">
            <LiquidGlassFrame
              id="aurora-mobile-nav-panel"
              className="aurora-glass-dock aurora-mobile-nav-panel glass-nav rounded-[1.5rem]"
              contentClassName="p-2"
            >
              <nav className="aurora-mobile-nav-stack flex flex-col gap-2" aria-label="Mobile navigation">
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
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {item.label}
                    </LiquidGlassButton>
                  )
                })}
              </nav>
            </LiquidGlassFrame>
          </div>
        ) : null}
      </div>
    </header>
  )
}
