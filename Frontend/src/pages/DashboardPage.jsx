import { Link, useNavigate } from 'react-router-dom'
import auroraLogo from '../assets/aurora-logo.jpeg'
import coffeeSketch from '../assets/coffee-sketch.jpeg'
import { clearAuthSession, deriveDisplayName, getAuthSession } from '../lib/auth'

export default function DashboardPage() {
  const navigate = useNavigate()
  const session = getAuthSession()
  const displayName = deriveDisplayName(session?.email)

  const handleLogout = () => {
    clearAuthSession()
    navigate('/login', { replace: true })
  }

  if (!session?.token) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#f7e6d9_0%,#efd3bf_34%,#e0b495_64%,#cf9877_100%)] px-6 py-8 lg:px-10">
        <div className="pointer-events-none absolute inset-0">
          <img
            src={coffeeSketch}
            alt=""
            className="absolute left-[5%] top-[10%] h-32 w-28 rotate-[-18deg] object-contain opacity-10 mix-blend-multiply [mask-image:radial-gradient(circle_at_center,black_35%,transparent_82%)]"
          />
          <img
            src={coffeeSketch}
            alt=""
            className="absolute bottom-[10%] right-[6%] h-40 w-32 rotate-[14deg] object-contain opacity-10 mix-blend-multiply [mask-image:radial-gradient(circle_at_center,black_35%,transparent_82%)]"
          />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center">
          <div className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.86)] p-8 text-center shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
              Dashboard unavailable
            </p>
            <h1 className="mt-4 font-display text-5xl text-[var(--aurora-text-strong)]">
              No active session found.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--aurora-text)]">
              Sign in first so the dashboard can read your saved session token.
            </p>
            <Link
              to="/login"
              className="mt-8 inline-flex rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
            >
              Go to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f5e1d1_0%,#ebc3a6_42%,#d89a78_100%)] px-6 py-8 lg:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-[14%] h-48 w-48 rounded-full bg-[rgba(255,247,242,0.46)] blur-3xl" />
        <div className="absolute bottom-[12%] right-[8%] h-56 w-56 rounded-full bg-[rgba(144,180,196,0.24)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <header className="flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-4">
            <img
              src={auroraLogo}
              alt="Aurora Coffee Roastery logo"
              className="h-20 w-20 rounded-full object-cover shadow-[0_10px_28px_rgba(95,58,43,0.12)]"
            />
            <div>
              <p className="font-display text-2xl text-[var(--aurora-text-strong)]">
                Aurora Coffee
              </p>
              <p className="text-xs uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                Dashboard
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.72)] px-5 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-cream)]"
          >
            Log out
          </button>
        </header>

        <main className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="overflow-hidden rounded-[2.75rem] border border-[rgba(255,247,242,0.5)] bg-[linear-gradient(160deg,rgba(79,47,36,0.96)_0%,rgba(112,72,55,0.94)_100%)] p-10 text-[var(--aurora-cream)] shadow-[0_35px_100px_rgba(98,58,42,0.22)]">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[rgba(255,247,242,0.68)]">
              Welcome in
            </p>
            <h1 className="mt-5 font-display text-6xl leading-tight">
              HELLO, {displayName}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[rgba(255,247,242,0.8)]">
              This is a placeholder dashboard wired to the live login flow. The
              current backend token does not include a real display name, so
              this greeting is derived from the signed-in email address.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.75rem] bg-[rgba(255,247,242,0.08)] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-[rgba(255,247,242,0.6)]">
                  Session
                </p>
                <p className="mt-3 text-2xl font-semibold">
                  Active
                </p>
              </div>
              <div className="rounded-[1.75rem] bg-[rgba(255,247,242,0.08)] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-[rgba(255,247,242,0.6)]">
                  Token expiry
                </p>
                <p className="mt-3 text-2xl font-semibold">
                  {new Date(session.expires).toLocaleTimeString()}
                </p>
              </div>
              <div className="rounded-[1.75rem] bg-[rgba(255,247,242,0.08)] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-[rgba(255,247,242,0.6)]">
                  Email
                </p>
                <p className="mt-3 truncate text-lg font-semibold">
                  {session.email}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[2.25rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.86)] p-7 shadow-[0_24px_70px_rgba(108,69,51,0.12)] backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                Roast room
              </p>
              <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                A dashboard placeholder with personality.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                Once the backend exposes real user profile data and role-based
                routing, this page can split into customer, sales manager, and
                product manager dashboards.
              </p>
            </div>

            <div className="rounded-[2.25rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.52)] p-7 shadow-[0_18px_48px_rgba(138,144,119,0.12)]">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--aurora-olive-deep)]">
                Next
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--aurora-text)]">
                <li>Hook this route to a real post-login role destination.</li>
                <li>Replace the derived greeting with backend display name data.</li>
                <li>Protect the route with token expiry checks and refresh logic.</li>
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
