import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuroraAtmosphere from '../shared/components/common/AuroraAtmosphere'
import Footer from '../shared/components/layout/Footer'
import Header from './Header'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
import LiquidGlassDefs from '../shared/components/ui/LiquidGlassDefs'
import {
  authChangeEvent,
  currentUserChangeEvent,
  currentUserFetchStatus,
  fetchCurrentUserResult,
  getAuthStateSnapshot,
} from '../lib/auth'
import { reconcileAccountStorageWithAuth } from '../lib/accountData'
import { getAccessibleRoleLevels } from '../lib/roles'

const accountLinks = [
  { label: 'Overview', to: '/account' },
  { label: 'Orders', to: '/account/orders' },
  { label: 'Saved Addresses', to: '/account/addresses' },
  { label: 'Payment Methods', to: '/account/payment-methods' },
  { label: 'Favorites', to: '/account/favorites' },
]

const customerHomeLink = { label: 'Customer Home', to: '/customer' }

function isRouteActive(pathname, to) {
  if (to === '/') {
    return pathname === '/'
  }

  if (to === '/account') {
    return pathname === to
  }

  return pathname === to || pathname.startsWith(`${to}/`)
}

function AccessLevelControl({ accessLevels, pathname }) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)
  const customerHomeActive = isRouteActive(pathname, customerHomeLink.to)
  const levels = accessLevels.length ? accessLevels : [customerHomeLink]

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (levels.length <= 1) {
    return (
      <LiquidGlassButton
        as={Link}
        to={customerHomeLink.to}
        variant={customerHomeActive ? 'secondary' : 'quiet'}
        size="compact"
        className="w-full"
        contentClassName="w-full justify-start"
      >
        {customerHomeLink.label}
      </LiquidGlassButton>
    )
  }

  return (
    <div
      ref={dropdownRef}
      className={[
        'aurora-access-dropdown',
        open ? 'is-open' : '',
      ].join(' ')}
    >
      <LiquidGlassButton
        type="button"
        variant={customerHomeActive || open ? 'secondary' : 'quiet'}
        size="compact"
        selected={open}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="aurora-access-level-menu"
        onClick={() => setOpen((current) => !current)}
        className="aurora-access-trigger w-full"
        contentClassName="w-full justify-between gap-3"
      >
        <span>{customerHomeLink.label}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="aurora-access-chevron h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 8 5 5 5-5" />
        </svg>
      </LiquidGlassButton>

      {open ? (
        <div
          id="aurora-access-level-menu"
          className="aurora-access-menu"
          role="menu"
          aria-label="Access levels"
        >
          {levels.map((item) => {
            const isActive = isRouteActive(pathname, item.to)

            return (
              <LiquidGlassButton
                as={Link}
                key={item.role}
                to={item.to}
                onClick={() => setOpen(false)}
                role="menuitem"
                variant={isActive ? 'secondary' : 'quiet'}
                size="compact"
                className="w-full"
                contentClassName="w-full justify-start"
              >
                {item.label}
              </LiquidGlassButton>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default function AccountLayout({
  eyebrow,
  title,
  description,
  children,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [authState, setAuthState] = useState(() => getAuthStateSnapshot())
  const session = authState.session
  const currentUserState = authState.currentUserState
  const canRenderAccountShell = authState.hasVerifiedUser || authState.isProfileError
  const user = currentUserState.status === currentUserFetchStatus.ok
    ? currentUserState.user
    : null
  const accessLevels = getAccessibleRoleLevels(user?.role)

  useEffect(() => {
    const syncAuthState = () => {
      setAuthState(getAuthStateSnapshot())
    }

    window.addEventListener('storage', syncAuthState)
    window.addEventListener(authChangeEvent, syncAuthState)
    window.addEventListener(currentUserChangeEvent, syncAuthState)

    return () => {
      window.removeEventListener('storage', syncAuthState)
      window.removeEventListener(authChangeEvent, syncAuthState)
      window.removeEventListener(currentUserChangeEvent, syncAuthState)
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
    if (authState.shouldRequestLogin) {
      navigate(
        `/login?next=${encodeURIComponent(
          location.pathname + location.search,
        )}`,
        { replace: true },
      )
      return
    }

    if (!canRenderAccountShell) {
      return
    }

    reconcileAccountStorageWithAuth()
  }, [
    authState.shouldRequestLogin,
    canRenderAccountShell,
    location.pathname,
    location.search,
    navigate,
  ])

  if (authState.shouldRequestLogin || !canRenderAccountShell) {
    return (
      <div className="aurora-page">
        <LiquidGlassDefs />
        <AuroraAtmosphere opacityClassName="opacity-25" />
        <Header />

        <main className="aurora-main">
          <div className="aurora-container">
            <div className="aurora-showcase-band mx-auto max-w-4xl p-10 text-center">
              <p className="aurora-kicker">
                {authState.shouldRequestLogin ? 'Redirecting' : 'Checking account'}
              </p>
              <h1 className="aurora-heading mt-4 text-5xl">
                {authState.shouldRequestLogin
                  ? 'Sending you to login'
                  : 'Confirming your session'}
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--aurora-text)]">
                {authState.shouldRequestLogin
                  ? 'Sign in to reach your saved account tools.'
                  : 'Your account tools will appear after the current session is verified.'}
              </p>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    )
  }

  return (
    <div className="aurora-page">
      <LiquidGlassDefs />
      <AuroraAtmosphere opacityClassName="opacity-25" />
      <Header />

      <main className="aurora-main">
        <div className="aurora-container aurora-page-rail">
          <section className="aurora-shell aurora-shell-soft aurora-account-intro rounded-[2.3rem] p-6 sm:p-8 lg:p-7 xl:p-9">
            <div className="max-w-3xl">
              <p className="aurora-kicker">{eyebrow}</p>
              <h1 className="aurora-heading mt-4 text-5xl md:text-6xl lg:text-5xl xl:text-6xl">
                {title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--aurora-text)]">
                {description}
              </p>
            </div>
          </section>

          <section className="aurora-content-split aurora-account-content relative isolate lg:grid-cols-[15.5rem_minmax(0,1fr)] xl:grid-cols-[16.5rem_minmax(0,1fr)]">
            <aside className="aurora-operational-card aurora-account-sidebar relative z-20 h-fit rounded-[2rem] p-5">
              <p className="aurora-kicker">Account tools</p>
              <nav className="aurora-account-sidebar-nav mt-5 grid gap-2">
                <AccessLevelControl
                  accessLevels={accessLevels}
                  pathname={location.pathname}
                />

                {accountLinks.map((item) => {
                  const isActive =
                    isRouteActive(location.pathname, item.to)

                  return (
                    <LiquidGlassButton
                      as={Link}
                      key={item.to}
                      to={item.to}
                      variant={isActive ? 'secondary' : 'quiet'}
                      size="compact"
                      className="w-full"
                      contentClassName="w-full justify-start"
                    >
                      {item.label}
                    </LiquidGlassButton>
                  )
                })}
              </nav>

              <div className="aurora-divider my-5" />
              <p className="text-sm text-[var(--aurora-text)]">
                Orders, saved addresses, cards, and favorites stay one tap apart.
              </p>
            </aside>

            <div className="relative z-0 min-w-0">{children}</div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
