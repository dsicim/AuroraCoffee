import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import auroraLogo from '../assets/aurora-logo.jpeg'
import coffeeSketch from '../assets/coffee-sketch.jpeg'
import { buildApiUrl } from '../lib/api'
import { reconcileAccountStorageWithAuth } from '../lib/accountData'
import { fetchCurrentUser, saveAuthSession } from '../lib/auth'
import { reconcileCartStorageWithAuth } from '../lib/cart'
import { getRoleLandingPath } from '../lib/roles'
import { validatePassword } from '../lib/validation'

function getMessage(payload, fallbackMessage) {
  if (!payload || typeof payload !== 'object') {
    return fallbackMessage
  }

  return payload.e || payload.m || fallbackMessage
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!token) {
      setFeedback('This reset link is missing its token. Please request a new password reset email.')
      return
    }

    if (!password || !confirmPassword) {
      setFeedback('Please fill in both password fields.')
      return
    }

    if (password !== confirmPassword) {
      setFeedback('Passwords do not match.')
      return
    }

    const passwordValidation = validatePassword(password)

    if (!passwordValidation.s) {
      setFeedback(passwordValidation.e)
      return
    }

    setSubmitting(true)
    setFeedback('')

    try {
      const response = await fetch(buildApiUrl('/auth/password'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          t: token,
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
        setFeedback(getMessage(payload, 'Password reset failed. Please try again.'))
        return
      }

      const successMessage = getMessage(
        payload,
        'Password changed successfully. You may log in now.',
      )

      if (payload?.t?.token && payload?.t?.expires) {
        const nextSession = {
          email: '',
          token: payload.t.token,
          expires: payload.t.expires,
        }

        saveAuthSession(nextSession, false)
        reconcileAccountStorageWithAuth()
        reconcileCartStorageWithAuth()
        const currentUser = await fetchCurrentUser(payload.t.token)
        navigate(currentUser ? getRoleLandingPath(currentUser.role) : '/', {
          replace: true,
        })
        return
      }

      navigate(`/login?callback=${encodeURIComponent(successMessage)}`, {
        replace: true,
      })
    } catch {
      setFeedback('The reset request could not be completed. Please try again.')
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
              Password reset
            </p>
            <h1 className="mt-5 max-w-xl font-display text-5xl leading-tight text-[var(--aurora-text-strong)] md:text-6xl">
              Choose a new password.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--aurora-text)]">
              This page is designed for the email link redirect from the backend.
              It reads the reset token from the URL, submits the new password,
              and returns the user to the login screen when the reset succeeds.
            </p>
          </section>

          <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.86)] p-8 shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur sm:p-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Reset access
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Set new password
                </h2>
              </div>
              <span className="rounded-full bg-[rgba(144,180,196,0.22)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--aurora-sky-deep)]">
                Token flow
              </span>
            </div>

            {!token ? (
              <div className="mt-6 rounded-[1.75rem] border border-[rgba(217,144,107,0.42)] bg-[rgba(248,227,214,0.72)] p-5 text-sm leading-7 text-[var(--aurora-text-strong)]">
                No reset token was found in the URL. Open the link from your password reset email or request a new one.
              </div>
            ) : null}

            {feedback ? (
              <div className="mt-6 rounded-[1.75rem] border border-[rgba(217,144,107,0.42)] bg-[rgba(248,227,214,0.72)] p-4 text-sm font-medium leading-7 text-[var(--aurora-text-strong)]">
                {feedback}
              </div>
            ) : null}

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                  New password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setFeedback('')
                  }}
                  placeholder="Enter your new password"
                  className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/80 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition placeholder:text-[rgba(111,71,56,0.5)] focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                  Confirm new password
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value)
                    setFeedback('')
                  }}
                  placeholder="Re-enter your new password"
                  className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/80 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition placeholder:text-[rgba(111,71,56,0.5)] focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                />
              </label>

              <button
                type="submit"
                disabled={submitting || !token}
                className="w-full rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {submitting ? 'Updating password...' : 'Save new password'}
              </button>
            </form>

            <div className="mt-8 rounded-[1.75rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.34)] p-5 text-sm leading-7 text-[var(--aurora-text)]">
              The backend is expected to redirect password reset email clicks to
              <span className="font-semibold text-[var(--aurora-text-strong)]">
                {' '}
                /resetpassword?token=...
              </span>
              . On success, this screen returns the user to login with a callback
              message.
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
