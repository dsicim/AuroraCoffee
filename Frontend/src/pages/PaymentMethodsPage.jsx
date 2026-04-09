import { useEffect, useState } from 'react'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import {
  deletePaymentMethod,
  fetchPaymentMethods,
  formatPaymentError,
  maskSavedCard,
  savePaymentMethod,
} from '../lib/payment'

const initialForm = {
  alias: '',
  cardholder: '',
  cardNumber: '',
  expiry: '',
  cvc: '',
}

function validateCardForm(form) {
  const errors = {}
  const digits = String(form.cardNumber || '').replace(/\D/g, '')
  const expiryDigits = String(form.expiry || '').replace(/\D/g, '')
  const cvcDigits = String(form.cvc || '').replace(/\D/g, '')

  if (!String(form.cardholder || '').trim()) {
    errors.cardholder = 'Cardholder name is required'
  }

  if (digits.length < 16) {
    errors.cardNumber = 'Card number must be 16 digits'
  }

  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(String(form.expiry || '').trim())) {
    errors.expiry = 'Expiry must be in MM/YY format'
  } else if (expiryDigits.length < 4) {
    errors.expiry = 'Expiry must be in MM/YY format'
  }

  if (cvcDigits.length < 3) {
    errors.cvc = 'CVC must be at least 3 digits'
  }

  return errors
}

function getCardSummary(card) {
  const parts = [
    card?.type || card?.family || 'Stored card',
    card?.provider,
    card?.bank,
  ].filter(Boolean)

  return parts.join(' · ')
}

export default function PaymentMethodsPage() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [feedback, setFeedback] = useState('')

  const loadCards = async ({ quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true)
    }

    try {
      const nextCards = await fetchPaymentMethods()
      setCards(nextCards)
    } catch (loadError) {
      setErrors((current) => ({
        ...current,
        form: formatPaymentError(loadError, 'Could not load saved cards'),
      }))
    } finally {
      if (!quiet) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadCards()
  }, [])

  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback('')
    }, 2800)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [feedback])

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))

    setErrors((current) => ({
      ...current,
      [field]: '',
      form: '',
    }))
  }

  const resetForm = () => {
    setForm(initialForm)
    setErrors({})
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    void (async () => {
      const nextErrors = validateCardForm(form)

      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors)
        return
      }

      setSaving(true)

      try {
        await savePaymentMethod({
          alias: form.alias,
          card: {
            cardholder: form.cardholder,
            cardNumber: form.cardNumber,
            expiry: form.expiry,
            cvc: form.cvc,
          },
        })
        await loadCards({ quiet: true })
        resetForm()
        setFeedback('Saved cards were updated successfully.')
      } catch (saveError) {
        setErrors((current) => ({
          ...current,
          form: formatPaymentError(saveError, 'Could not save card'),
        }))
      } finally {
        setSaving(false)
      }
    })()
  }

  const handleDelete = (cardId) => {
    void (async () => {
      const confirmed = window.confirm('Delete this saved card?')

      if (!confirmed) {
        return
      }

      setDeletingId(cardId)

      try {
        await deletePaymentMethod(cardId)
        await loadCards({ quiet: true })
        setFeedback('Saved card removed.')
      } catch (deleteError) {
        setErrors((current) => ({
          ...current,
          form: formatPaymentError(deleteError, 'Could not delete card'),
        }))
      } finally {
        setDeletingId('')
      }
    })()
  }

  return (
    <AccountLayout
      eyebrow="Payment methods"
      title="Saved cards"
      description="Store a card for faster checkout. Only summary details are shown here, and you can delete any card you no longer want to keep on file."
    >
      {feedback ? (
        <div className="aurora-message aurora-message-success mb-6">
          {feedback}
        </div>
      ) : null}

      {errors.form ? (
        <div className="aurora-message aurora-message-error mb-6">
          {errors.form}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="aurora-ops-panel p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                Add card
              </p>
              <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                Save a new payment method
              </h2>
            </div>
            <span className="aurora-chip">
              {cards.length} card{cards.length === 1 ? '' : 's'}
            </span>
          </div>

          <form className="mt-8 grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit} noValidate>
            <label className="block sm:col-span-2">
              <span className="aurora-field-label">Card nickname</span>
              <input
                type="text"
                value={form.alias}
                onChange={(event) => handleChange('alias', event.target.value)}
                placeholder="Visa for groceries"
                className="aurora-input"
              />
              <p className="mt-2 text-sm text-[var(--aurora-text)]">
                This is the label you will see in checkout.
              </p>
            </label>

            <label className="block sm:col-span-2">
              <span className="aurora-field-label">Cardholder name</span>
              <input
                type="text"
                value={form.cardholder}
                onChange={(event) => handleChange('cardholder', event.target.value)}
                className="aurora-input"
              />
              {errors.cardholder ? (
                <p className="mt-2 text-sm font-medium text-[var(--aurora-text-strong)]">
                  {errors.cardholder}
                </p>
              ) : null}
            </label>

            <label className="block sm:col-span-2">
              <span className="aurora-field-label">Card number</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-number"
                value={form.cardNumber}
                onChange={(event) => handleChange('cardNumber', event.target.value)}
                placeholder="4111 1111 1111 1111"
                className="aurora-input"
              />
              {errors.cardNumber ? (
                <p className="mt-2 text-sm font-medium text-[var(--aurora-text-strong)]">
                  {errors.cardNumber}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="aurora-field-label">Expiry</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp"
                value={form.expiry}
                onChange={(event) => handleChange('expiry', event.target.value)}
                placeholder="MM/YY"
                className="aurora-input"
              />
              {errors.expiry ? (
                <p className="mt-2 text-sm font-medium text-[var(--aurora-text-strong)]">
                  {errors.expiry}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="aurora-field-label">CVC</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-csc"
                value={form.cvc}
                onChange={(event) => handleChange('cvc', event.target.value)}
                placeholder="123"
                className="aurora-input"
              />
              {errors.cvc ? (
                <p className="mt-2 text-sm font-medium text-[var(--aurora-text-strong)]">
                  {errors.cvc}
                </p>
              ) : null}
            </label>

            <div className="sm:col-span-2 mt-2 flex flex-wrap gap-3">
              <LiquidGlassButton type="submit" loading={saving}>
                {saving ? 'Saving card...' : 'Save card'}
              </LiquidGlassButton>
              <LiquidGlassButton
                type="button"
                variant="quiet"
                onClick={resetForm}
                disabled={saving}
              >
                Clear form
              </LiquidGlassButton>
            </div>
          </form>
        </section>

        <section className="aurora-ops-panel p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                Stored cards
              </p>
              <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                {loading ? 'Loading' : cards.length ? 'Ready' : 'None stored'}
              </h2>
            </div>
            <LiquidGlassButton
              type="button"
              variant="secondary"
              size="compact"
              onClick={() => void loadCards({ quiet: false })}
              disabled={loading}
            >
              Refresh
            </LiquidGlassButton>
          </div>

          {loading ? (
            <div className="aurora-widget-subsurface mt-6 p-5">
              <p className="text-sm leading-7 text-[var(--aurora-text)]">
                Loading saved payment methods...
              </p>
            </div>
          ) : cards.length ? (
            <div className="mt-6 space-y-4">
              {cards.map((card) => (
                <div key={card.id} className="aurora-widget-subsurface p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-2xl text-[var(--aurora-text-strong)]">
                          {card.alias || 'Saved card'}
                        </p>
                        <span className="aurora-chip">{maskSavedCard(card)}</span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                        {getCardSummary(card)}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                        Card on file for future checkout use.
                      </p>
                    </div>

                    <LiquidGlassButton
                      type="button"
                      variant="danger"
                      size="compact"
                      onClick={() => handleDelete(card.id)}
                      disabled={deletingId === card.id}
                    >
                      {deletingId === card.id ? 'Deleting...' : 'Delete'}
                    </LiquidGlassButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="aurora-widget-subsurface mt-6 p-5">
              <p className="text-sm leading-7 text-[var(--aurora-text)]">
                No saved cards yet. Add one on the left to reuse it in checkout.
              </p>
            </div>
          )}
        </section>
      </div>
    </AccountLayout>
  )
}
