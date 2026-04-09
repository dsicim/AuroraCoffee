import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import { buildApiUrl } from '../lib/api'
import { reconcileAccountStorageWithAuth } from '../lib/accountData'
import { saveAuthSession } from '../lib/auth'
import { reconcileCartStorageWithAuth } from '../lib/cart'
import { validateEmail } from '../lib/validation'

const roleHints = ['Customer account', 'Saved orders', 'Manager access']

function getMessage(payload, fallbackMessage) {
  if (!payload || typeof payload !== 'object') {
    return fallbackMessage
  }

  return payload.e || payload.m || fallbackMessage
}

function sanitizeNextPath(nextPath) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return null
  }

  return nextPath
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const callbackMessage = searchParams.get('callback')
  const nextPath = sanitizeNextPath(searchParams.get('next'))
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
    navigate(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login', {
      replace: true,
    })
  }, [callbackMessage, navigate, nextPath])

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

      saveAuthSession(nextSession, true)
      reconcileAccountStorageWithAuth()
      await reconcileCartStorageWithAuth()
      navigate(nextPath || '/', { replace: true })
    } catch {
      setFeedback('The login request could not be completed. Please try again.')
      setFeedbackKind('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      topLinkTo="/"
      topLinkLabel="Back home"
      eyebrow="Welcome back"
      title="Sign in to keep your coffee routine moving."
      description="Access saved favorites, previous orders, stored delivery details, and role-based workspace links from the same account."
      chips={roleHints}
      notice={callbackFeedback}
      noticeTone="success"
      cardEyebrow="Account access"
      cardTitle="Sign in"
      feedback={feedback}
      feedbackTone={feedbackKind === 'success' ? 'success' : 'error'}
      helper={(
        <>
          Need a new account?{' '}
          <Link to="/register" className="aurora-link">
            Create one here
          </Link>
          . If you have trouble signing in, you can also{' '}
          <Link to="/forgotpassword" className="aurora-link">
            reset your password
          </Link>
          .
        </>
      )}
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <label className="block">
          <span className="aurora-field-label">
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
            className="aurora-input"
          />
        </label>

        <label className="block">
          <span className="aurora-field-label">
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
            className="aurora-input"
          />
        </label>

        <div className="aurora-form-inline sm:flex-row sm:items-center sm:justify-between">
          <label className="aurora-checkbox">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="aurora-checkbox-input"
            />
            Remember me
          </label>

          <Link to="/forgotpassword" className="aurora-link">
            Forgot password?
          </Link>
        </div>

        <LiquidGlassButton
          type="submit"
          disabled={submitting}
          variant="secondary"
          size="hero"
          className="w-full"
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </LiquidGlassButton>
      </form>
    </AuthLayout>
  )
}
