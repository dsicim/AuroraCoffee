import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import CoffeeBeanDecor from './CoffeeBeanDecor'
import Footer from './Footer'
import Header from './Header'
import { authChangeEvent, getAuthSession } from '../lib/auth'
import { reconcileAccountStorageWithAuth } from '../lib/accountData'

const accountLinks = [
  { label: 'Overview', to: '/account' },
  { label: 'Orders', to: '/account/orders' },
  { label: 'Saved Addresses', to: '/account/addresses' },
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
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#f7e6d9_0%,#efd3bf_34%,#e0b495_64%,#cf9877_100%)]">
        <CoffeeBeanDecor />
        <Header />

        <main className="relative z-10 px-6 pb-16 pt-6 lg:px-10">
          <div className="mx-auto max-w-4xl rounded-[2.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.86)] p-10 text-center shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
              Redirecting
            </p>
            <h1 className="mt-4 font-display text-5xl text-[var(--aurora-text-strong)]">
              Sending you to login
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--aurora-text)]">
              Sign in to reach your saved account tools.
            </p>
          </div>
        </main>

        <Footer />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#f7e6d9_0%,#efd3bf_34%,#e0b495_64%,#cf9877_100%)]">
      <CoffeeBeanDecor />
      <Header />

      <main className="relative z-10 px-6 pb-16 pt-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-[2.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                  {eyebrow}
                </p>
                <h1 className="mt-4 font-display text-5xl text-[var(--aurora-text-strong)]">
                  {title}
                </h1>
                <p className="mt-5 text-lg leading-8 text-[var(--aurora-text)]">
                  {description}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {accountLinks.map((item) => {
                  const isActive = location.pathname === item.to

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        isActive
                          ? 'border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] text-[var(--aurora-cream)] shadow-[0_10px_24px_rgba(144,180,196,0.22)]'
                          : 'border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.9)] text-[var(--aurora-text-strong)] hover:bg-[var(--aurora-primary-pale)]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="mt-10">
            {children}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
