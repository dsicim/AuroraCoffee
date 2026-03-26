import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import auroraLogo from '../assets/aurora-logo.jpeg'
import coffeeSketch from '../assets/coffee-sketch.jpeg'
import { buildApiUrl } from '../lib/api'
import { saveAuthSession } from '../lib/auth'
import { validateEmail } from '../lib/validation'

const roleHints = ['Customer access', 'Sales manager portal', 'Product manager portal']

function getMessage(payload, fallbackMessage) {
  if (!payload || typeof payload !== 'object') {
    return fallbackMessage
  }

  return payload.e || payload.m || fallbackMessage
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const callbackMessage = searchParams.get('callback')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [feedback, setFeedback] = useState('')
  const [feedbackKind, setFeedbackKind] = useState('error')
  const [rememberMe, setRememberMe] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [callbackFeedback, setCallbackFeedback] = useState(callbackMessage || '')

  useEffect(() => {
    if (!callbackMessage) {
      return
    }

    setCallbackFeedback(callbackMessage)
    navigate('/login', { replace: true })
  }, [callbackMessage, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()

    const emailValidation = validateEmail(email)

    if (!emailValidation.s) {
      setFeedback(emailValidation.e)
      setFeedbackKind('error')
      return
    }

    if (!password) {
      setFeedback('Password is required')
      setFeedbackKind('error')
      return
    }

    setSubmitting(true)
    setFeedback('')

    try {
      const response = await fetch(buildApiUrl('/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          u: email.trim(),
          p: password,
        }),
      })

      let payload = null

      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      if (!response.ok) {
        setFeedback(getMessage(payload, 'Login failed. Please try again.'))
        setFeedbackKind('error')
        return
      }

      if (!payload?.token || !payload?.expires) {
        setFeedback('Login succeeded, but the backend response was incomplete.')
        setFeedbackKind('error')
        return
      }

      const nextSession = {
        email: email.trim(),
        token: payload.token,
        expires: payload.expires,
      }

      try {
        const meResponse = await fetch(buildApiUrl('/users/me'), {
          method: 'GET',
          headers: {
            authorization: payload.token,
          },
        })

        let mePayload = null

        try {
          mePayload = await meResponse.json()
        } catch {
          mePayload = null
        }

        if (meResponse.ok && mePayload?.user) {
          nextSession.user = mePayload.user
        }
      } catch {
        // Allow login to continue even if the profile lookup fails.
      }

      saveAuthSession(nextSession, rememberMe)
      navigate('/dashboard', { replace: true })
    } catch {
      setFeedback('The login request could not be completed. Please try again.')
      setFeedbackKind('error')
    } finally {
      setSubmitting(false)
    }
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
            <div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Account login
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Sign in
                </h2>
              </div>
            </div>

            {callbackFeedback ? (
              <div className="mt-6 rounded-[1.75rem] border border-[rgba(138,144,119,0.28)] bg-[rgba(230,232,222,0.5)] p-4 text-sm font-medium leading-7 text-[var(--aurora-olive-deep)]">
                {callbackFeedback}
              </div>
            ) : null}

            {feedback ? (
              <div
                className={`mt-6 rounded-[1.75rem] border p-4 text-sm font-medium leading-7 ${
                  feedbackKind === 'success'
                    ? 'border-[rgba(138,144,119,0.28)] bg-[rgba(230,232,222,0.5)] text-[var(--aurora-olive-deep)]'
                    : 'border-[rgba(217,144,107,0.42)] bg-[rgba(248,227,214,0.72)] text-[var(--aurora-text-strong)]'
                }`}
              >
                {feedback}
              </div>
            ) : null}

            <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                  Email address
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setFeedback('')
                  }}
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
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setFeedback('')
                  }}
                  placeholder="Enter your password"
                  className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/80 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition placeholder:text-[rgba(111,71,56,0.5)] focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                />
              </label>

              <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-[var(--aurora-text)]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border-[var(--aurora-border)] accent-[var(--aurora-sky)]"
                  />
                  Remember me
                </label>

                <Link
                  to="/forgotpassword"
                  className="font-medium text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
              >
                {submitting ? 'Signing in...' : 'Login to Aurora'}
              </button>
            </form>

            <div className="mt-8 rounded-[1.75rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.34)] p-5 text-sm leading-7 text-[var(--aurora-text)]">
              For the course project, this screen can later validate users by
              role and redirect them to customer, sales manager, or product
              manager dashboards after authentication.
            </div>

            <p className="mt-6 text-center text-sm text-[var(--aurora-text)]">
              Need an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
              >
                Create one
              </Link>
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}
