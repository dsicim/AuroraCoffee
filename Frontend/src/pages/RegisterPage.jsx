import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import auroraLogo from '../assets/aurora-logo.jpeg'
import coffeeSketch from '../assets/coffee-sketch.jpeg'
import { buildApiUrl } from '../lib/api'
import { reconcileAccountStorageWithAuth } from '../lib/accountData'
import { saveAuthSession } from '../lib/auth'
import { reconcileCartStorageWithAuth } from '../lib/cart'
import { validateEmail, validatePassword } from '../lib/validation'

function getMessage(payload, fallbackMessage) {
  if (!payload || typeof payload !== 'object') {
    return fallbackMessage
  }

  return payload.e || payload.m || fallbackMessage
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [feedback, setFeedback] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const normalizedName = name.trim()
    const normalizedEmail = email.trim()

    if (!normalizedName) {
      setFeedback('Name is required')
      setSubmitted(false)
      return
    }

    if (normalizedName.length > 255) {
      setFeedback('Name must not exceed 255 characters')
      setSubmitted(false)
      return
    }

    const emailValidation = validateEmail(normalizedEmail)

    if (!emailValidation.s) {
      setFeedback(emailValidation.e)
      setSubmitted(false)
      return
    }

    if (password !== confirmPassword) {
      setFeedback('Passwords do not match.')
      setSubmitted(false)
      return
    }

    const passwordValidation = validatePassword(password, [
      normalizedEmail.split('@')[0],
      normalizedName,
    ])

    if (!passwordValidation.s) {
      setFeedback(passwordValidation.e)
      setSubmitted(false)
      return
    }

    setSubmitting(true)
    setFeedback('')
    setSubmitted(false)

    try {
      const response = await fetch(buildApiUrl('/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          u: normalizedEmail,
          n: normalizedName,
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
        setFeedback(getMessage(payload, 'Registration failed. Please try again.'))
        return
      }

      if (payload?.v) {
        setFeedback(
          'User registered successfully. Check your email to verify your account.',
        )
        setSubmitted(true)
        return
      }

      if (payload?.t?.token && payload?.t?.expires) {
        const nextSession = {
          email: normalizedEmail,
          token: payload.t.token,
          expires: payload.t.expires,
        }

        saveAuthSession(nextSession, false)
        reconcileAccountStorageWithAuth()
        reconcileCartStorageWithAuth()
        navigate('/', { replace: true })
        return
      }

      navigate(
        `/login?callback=${encodeURIComponent(
          getMessage(payload, 'User registered successfully. You may log in now.'),
        )}`,
        { replace: true },
      )
    } catch {
      setFeedback('The registration request could not be completed. Please try again.')
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
            to="/login"
            className="rounded-full border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.72)] px-5 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-cream)]"
          >
            Back to login
          </Link>
        </header>

        <main className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[0.95fr_1.05fr]">
          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
              Create account
            </p>
            <h1 className="mt-5 max-w-xl font-display text-5xl leading-tight text-[var(--aurora-text-strong)] md:text-6xl">
              Create your account.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--aurora-text)]">
              This screen submits directly to the backend registration endpoint
              and applies the same email and password checks on the client
              first.
            </p>
          </section>

          <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.86)] p-8 shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur sm:p-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                New customer
              </p>
              <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                Sign up
              </h2>
            </div>

            {feedback ? (
              <div
                className={`mt-6 rounded-[1.75rem] border p-4 text-sm font-medium leading-7 ${
                  submitted
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
                  Full name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setFeedback('')
                    setSubmitted(false)
                  }}
                  placeholder="New Person"
                  className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/80 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition placeholder:text-[rgba(111,71,56,0.5)] focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                />
              </label>

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
                    setSubmitted(false)
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
                    setSubmitted(false)
                  }}
                  placeholder="Create a password"
                  className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/80 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition placeholder:text-[rgba(111,71,56,0.5)] focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                  Confirm password
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value)
                    setFeedback('')
                    setSubmitted(false)
                  }}
                  placeholder="Repeat your password"
                  className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/80 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition placeholder:text-[rgba(111,71,56,0.5)] focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {submitting ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <div className="mt-8 rounded-[1.75rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.34)] p-5 text-sm leading-7 text-[var(--aurora-text)]">
              If email verification is enabled in the backend, successful
              registration will ask the user to check their inbox before
              logging in.
            </div>

            <p className="mt-6 text-center text-sm text-[var(--aurora-text)]">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
              >
                Sign in
              </Link>
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}
