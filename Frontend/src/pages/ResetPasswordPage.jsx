import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import { buildApiUrl } from '../lib/api'
import { reconcileAccountStorageWithAuth } from '../lib/accountData'
import { saveAuthSession } from '../lib/auth'
import { reconcileCartStorageWithAuth } from '../lib/cart'
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
        navigate('/', { replace: true })
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
    <AuthLayout
      topLinkTo="/login"
      topLinkLabel="Back to login"
      eyebrow="Password reset"
      title="Choose a new password."
      description="Use the secure link from your email to set a new password and restore access to your account."
      chips={['Secure reset link', 'Password update']}
      cardEyebrow="Reset access"
      cardTitle="Set new password"
      cardBadge={(
        <span className="rounded-full bg-[rgba(134,169,185,0.18)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--aurora-sky-deep)]">
          Token flow
        </span>
      )}
      notice={
        !token
          ? 'No reset token was found in the URL. Open the link from your password reset email or request a new one.'
          : ''
      }
      noticeTone="error"
      feedback={feedback}
      feedbackTone="error"
      helper="Successful password resets return the user to sign in again, unless the backend responds with a fresh authenticated session."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
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
            className="aurora-input"
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
            className="aurora-input"
          />
        </label>

        <LiquidGlassButton
          type="submit"
          disabled={submitting || !token}
          variant="secondary"
          size="hero"
          className="w-full"
        >
          {submitting ? 'Updating password...' : 'Save new password'}
        </LiquidGlassButton>
      </form>
    </AuthLayout>
  )
}
