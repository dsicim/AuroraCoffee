import { useState } from 'react'
import AuthLayout from '../components/AuthLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import { buildApiUrl } from '../lib/api'
import { validateEmail } from '../lib/validation'

function getMessage(payload, fallbackMessage) {
  if (!payload || typeof payload !== 'object') {
    return fallbackMessage
  }

  return payload.e || payload.m || fallbackMessage
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const emailValidation = validateEmail(email)

    if (!emailValidation.s) {
      setFeedback(emailValidation.e)
      setSubmitted(false)
      return
    }

    setSubmitting(true)
    setFeedback('')

    try {
      const response = await fetch(buildApiUrl('/auth/password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          u: email.trim(),
        }),
      })

      let payload = null

      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      const message = getMessage(
        payload,
        'If that email exists, a password reset link has been sent.',
      )

      setFeedback(message)
      setSubmitted(response.ok)
    } catch {
      setFeedback('The password reset request could not be completed. Please try again.')
      setSubmitted(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      topLinkTo="/login"
      topLinkLabel="Back to login"
      eyebrow="Password recovery"
      title="Send yourself a secure reset link."
      description="Enter the email tied to your account and we’ll request a password reset link from the backend."
      chips={['Email delivery', 'Secure token link']}
      cardEyebrow="Recover access"
      cardTitle="Forgot password"
      feedback={feedback}
      feedbackTone={submitted ? 'success' : 'error'}
      helper="If the address is recognized, the email will contain a secure link back to the password reset page."
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
              setSubmitted(false)
            }}
            placeholder="you@example.com"
            className="aurora-input"
          />
        </label>

        <LiquidGlassButton
          type="submit"
          disabled={submitting}
          variant="secondary"
          size="hero"
          className="w-full"
        >
          {submitting ? 'Sending reset link...' : 'Email me a reset link'}
        </LiquidGlassButton>
      </form>
    </AuthLayout>
  )
}
