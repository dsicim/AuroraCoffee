import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import PasswordField from '../components/PasswordField'
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
        await reconcileCartStorageWithAuth()
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
    <AuthLayout
      topLinkTo="/login"
      topLinkLabel="Back to login"
      eyebrow="Create an account"
      title="Set up your Aurora Coffee account."
      description="Create an account to save favorites, keep delivery details on hand, and move through checkout with less friction next time."
      chips={['Favorites', 'Saved addresses', 'Order history']}
      aside={(
        <div className="aurora-solid-plate rounded-[1.25rem] p-4 text-sm leading-7 text-[var(--aurora-text)]">
          Accounts are designed for repeat visits: save your preferred coffees,
          reopen past orders, and keep checkout details close.
        </div>
      )}
      cardEyebrow="New customer"
      cardTitle="Create account"
      feedback={feedback}
      feedbackTone={submitted ? 'success' : 'error'}
      helper="If account verification is enabled in the backend, you may be asked to confirm your email before signing in."
      footer={(
        <>
          Already have an account?{' '}
          <Link to="/login" className="aurora-link">
            Sign in
          </Link>
        </>
      )}
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <label className="block">
          <span className="aurora-field-label">
            Full name
          </span>
          <input
            type="text"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setFeedback('')
              setSubmitted(false)
            }}
            placeholder="New Person"
            className="aurora-input"
          />
        </label>

        <label className="block">
          <span className="aurora-field-label">
            Email address
          </span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setFeedback('')
              setSubmitted(false)
            }}
            placeholder="you@example.com"
            className="aurora-input"
          />
        </label>

        <PasswordField
          id="register-password"
          label="Password"
          name="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
          }}
          placeholder="Create a password"
          autoComplete="new-password"
          onClearFeedback={() => {
            setFeedback('')
            setSubmitted(false)
          }}
        />

        <PasswordField
          id="register-confirm-password"
          label="Confirm password"
          name="confirmPassword"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value)
          }}
          placeholder="Repeat your password"
          autoComplete="new-password"
          onClearFeedback={() => {
            setFeedback('')
            setSubmitted(false)
          }}
        />

        <LiquidGlassButton
          type="submit"
          disabled={submitting}
          variant="secondary"
          size="hero"
          className="w-full"
        >
          {submitting ? 'Creating account...' : 'Create account'}
        </LiquidGlassButton>
      </form>
    </AuthLayout>
  )
}
