import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuroraAtmosphere from './AuroraAtmosphere'
import Footer from './Footer'
import Header from './Header'
import LiquidGlassButton from './LiquidGlassButton'
import LiquidGlassDefs from './LiquidGlassDefs'
import { authChangeEvent, getAuthSession } from '../lib/auth'
import { reconcileAccountStorageWithAuth } from '../lib/accountData'

const accountLinks = [
  { label: 'Customer Home', to: '/customer' },
  { label: 'Overview', to: '/account' },
  { label: 'Orders', to: '/account/orders' },
  { label: 'Saved Addresses', to: '/account/addresses' },
  { label: 'Payment Methods', to: '/account/payment-methods' },
  { label: 'Favorites', to: '/account/favorites' },
]

export default function AccountLayout({
  eyebrow,
  title,
  description,
  children,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getAuthSession())
  const hasSession = Boolean(session?.token)

  useEffect(() => {
    const syncSession = () => {
      setSession(getAuthSession())
    }

    window.addEventListener('storage', syncSession)
    window.addEventListener(authChangeEvent, syncSession)

    return () => {
      window.removeEventListener('storage', syncSession)
      window.removeEventListener(authChangeEvent, syncSession)
    }
  }, [])

  useEffect(() => {
    if (!hasSession) {
      navigate(
        `/login?next=${encodeURIComponent(
          location.pathname + location.search,
        )}`,
        { replace: true },
      )
      return
    }

    reconcileAccountStorageWithAuth()
  }, [hasSession, location.pathname, location.search, navigate])

  if (!hasSession) {
    return (
      <div className="aurora-page">
        <LiquidGlassDefs />
        <AuroraAtmosphere opacityClassName="opacity-25" />
        <Header />

        <main className="aurora-main">
          <div className="aurora-container">
            <div className="aurora-showcase-band mx-auto max-w-4xl p-10 text-center">
              <p className="aurora-kicker">
                Redirecting
              </p>
              <h1 className="aurora-heading mt-4 text-5xl">
                Sending you to login
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--aurora-text)]">
                Sign in to reach your saved account tools.
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
              <p className="aurora-kicker">Navigate</p>
              <nav className="aurora-account-sidebar-nav mt-5 grid gap-2">
                {accountLinks.map((item) => {
                  const isActive =
                    location.pathname === item.to ||
                    (item.to !== '/account' && location.pathname.startsWith(`${item.to}/`))

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
                Keep the main account tools in one place.
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
