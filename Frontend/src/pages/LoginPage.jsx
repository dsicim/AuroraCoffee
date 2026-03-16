import { Link } from 'react-router-dom'
import auroraLogo from '../assets/aurora-logo.jpeg'
import coffeeSketch from '../assets/coffee-sketch.jpeg'

const roleHints = ['Customer access', 'Sales manager portal', 'Product manager portal']

export default function LoginPage() {
  const handleSubmit = (event) => {
    event.preventDefault()
  }

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

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-between">
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
                Roastery
              </p>
            </div>
          </Link>

          <Link
            to="/"
            className="rounded-full border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.72)] px-5 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-cream)]"
          >
            Back home
          </Link>
        </header>

        <main className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[0.95fr_1.05fr]">
          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
              Welcome back
            </p>
            <h1 className="mt-5 max-w-xl font-display text-5xl leading-tight text-[var(--aurora-text-strong)] md:text-6xl">
              Sign in to continue your Aurora coffee experience.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--aurora-text)]">
              This starter login screen is ready for backend integration. You
              can connect it later to authentication endpoints for customers,
              sales managers, and product managers.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {roleHints.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[rgba(138,144,119,0.28)] bg-[rgba(255,247,242,0.7)] px-4 py-2 text-sm text-[var(--aurora-olive-deep)]"
                >
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.86)] p-8 shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur sm:p-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Account login
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Sign in
                </h2>
              </div>
              <span className="rounded-full bg-[rgba(144,180,196,0.22)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--aurora-sky-deep)]">
                Mock flow
              </span>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                  Email address
                </span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/80 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition placeholder:text-[rgba(111,71,56,0.5)] focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                  Password
                </span>
                <input
                  type="password"
                  placeholder="Enter your password"
                  className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/80 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition placeholder:text-[rgba(111,71,56,0.5)] focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                />
              </label>

              <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-[var(--aurora-text)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[var(--aurora-border)] accent-[var(--aurora-sky)]"
                  />
                  Remember me
                </label>

                <a
                  href="#"
                  className="font-medium text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
                >
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                className="w-full rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
              >
                Login to Aurora
              </button>
            </form>

            <div className="mt-8 rounded-[1.75rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.34)] p-5 text-sm leading-7 text-[var(--aurora-text)]">
              For the course project, this screen can later validate users by
              role and redirect them to customer, sales manager, or product
              manager dashboards after authentication.
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
