import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CoffeeBeanDecor from '../components/CoffeeBeanDecor'
import Footer from '../components/Footer'
import Header from '../components/Header'
import {
  accountDataChangeEvent,
  addOrderHistoryEntry,
  getDefaultSavedAddress,
  getSavedAddresses,
  reconcileAccountStorageWithAuth,
} from '../lib/accountData'
import { getAuthSession } from '../lib/auth'
import {
  cartChangeEvent,
  clearCart,
  getCartItems,
  reconcileCartStorageWithAuth,
} from '../lib/cart'
import { validateEmail } from '../lib/validation'

const checkoutSteps = [
  { key: 'delivery', label: 'Delivery' },
  { key: 'payment', label: 'Payment' },
  { key: 'review', label: 'Review' },
  { key: 'success', label: 'Success' },
]

const initialDelivery = {
  fullName: '',
  email: '',
  address: '',
  city: '',
  postalCode: '',
  notes: '',
}

const initialPayment = {
  cardholder: '',
  cardNumber: '',
  expiry: '',
  cvc: '',
}

function buildDeliveryFromAddress(address) {
  if (!address) {
    return initialDelivery
  }

  return {
    fullName: address.fullName || '',
    email: address.email || '',
    address: address.address || '',
    city: address.city || '',
    postalCode: address.postalCode || '',
    notes: address.notes || '',
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatCardNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4)

  if (digits.length <= 2) {
    return digits
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

function maskCardNumber(value) {
  const digits = value.replace(/\D/g, '')

  if (digits.length < 4) {
    return 'Demo card'
  }

  return `•••• •••• •••• ${digits.slice(-4)}`
}

function createOrderReference() {
  const seed = Date.now().toString(36).toUpperCase()
  return `AUR-${seed.slice(-6)}`
}

function validateDeliveryForm(delivery) {
  const errors = {}

  if (!delivery.fullName.trim()) {
    errors.fullName = 'Full name is required'
  }

  const emailValidation = validateEmail(delivery.email)
  if (!emailValidation.s) {
    errors.email = emailValidation.e
  }

  if (!delivery.address.trim()) {
    errors.address = 'Address is required'
  }

  if (!delivery.city.trim()) {
    errors.city = 'City is required'
  }

  if (!delivery.postalCode.trim()) {
    errors.postalCode = 'Postal code is required'
  }

  return errors
}

function validatePaymentForm(payment) {
  const errors = {}
  const digits = payment.cardNumber.replace(/\D/g, '')
  const expiryIsValid = /^(0[1-9]|1[0-2])\/\d{2}$/.test(payment.expiry)
  const cvcDigits = payment.cvc.replace(/\D/g, '')

  if (!payment.cardholder.trim()) {
    errors.cardholder = 'Cardholder name is required'
  }

  if (digits.length < 16) {
    errors.cardNumber = 'Card number must be 16 digits'
  }

  if (!expiryIsValid) {
    errors.expiry = 'Expiry must be in MM/YY format'
  }

  if (cvcDigits.length < 3) {
    errors.cvc = 'CVC must be at least 3 digits'
  }

  return errors
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const initialDefaultAddress = getDefaultSavedAddress()
  const [items, setItems] = useState(() => getCartItems())
  const [session, setSession] = useState(() => getAuthSession())
  const [stepIndex, setStepIndex] = useState(0)
  const [delivery, setDelivery] = useState(() =>
    buildDeliveryFromAddress(initialDefaultAddress),
  )
  const [payment, setPayment] = useState(initialPayment)
  const [savedAddresses, setSavedAddresses] = useState(() => getSavedAddresses())
  const [selectedAddressId, setSelectedAddressId] = useState(
    initialDefaultAddress?.id || '',
  )
  const [errors, setErrors] = useState({})
  const [submittedOrder, setSubmittedOrder] = useState(null)

  const subtotal = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  )
  const serviceFee = items.length ? 4.5 : 0
  const total = subtotal + serviceFee
  const currentStep = checkoutSteps[stepIndex]
  const isLoggedIn = Boolean(session?.token)

  useEffect(() => {
    const syncFromStorage = () => {
      reconcileAccountStorageWithAuth()
      reconcileCartStorageWithAuth()
      setItems(getCartItems())
      setSession(getAuthSession())
      setSavedAddresses(getSavedAddresses())
    }

    const syncCartState = () => {
      setItems(getCartItems())
      setSession(getAuthSession())
    }

    const syncAccountState = () => {
      setSession(getAuthSession())
      setSavedAddresses(getSavedAddresses())
    }

    window.addEventListener('storage', syncFromStorage)
    window.addEventListener(cartChangeEvent, syncCartState)
    window.addEventListener(accountDataChangeEvent, syncAccountState)
    const initialSyncId = window.setTimeout(syncFromStorage, 0)

    return () => {
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener(cartChangeEvent, syncCartState)
      window.removeEventListener(accountDataChangeEvent, syncAccountState)
      window.clearTimeout(initialSyncId)
    }
  }, [])

  useEffect(() => {
    if (submittedOrder || !items.length || isLoggedIn) {
      return
    }

    navigate('/login?next=%2Fcheckout', { replace: true })
  }, [isLoggedIn, items.length, navigate, submittedOrder])

  const handleDeliveryChange = (field, value) => {
    setSelectedAddressId('')
    setDelivery((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const handlePaymentChange = (field, value) => {
    setPayment((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const handleNextStep = () => {
    if (currentStep.key === 'delivery') {
      const deliveryErrors = validateDeliveryForm(delivery)

      if (Object.keys(deliveryErrors).length) {
        setErrors(deliveryErrors)
        return
      }
    }

    if (currentStep.key === 'payment') {
      const paymentErrors = validatePaymentForm(payment)

      if (Object.keys(paymentErrors).length) {
        setErrors(paymentErrors)
        return
      }
    }

    setErrors({})
    setStepIndex((current) => Math.min(current + 1, 2))
  }

  const handlePreviousStep = () => {
    setErrors({})
    setStepIndex((current) => Math.max(current - 1, 0))
  }

  const handleSubmitOrder = () => {
    const submittedOrderSnapshot = {
      reference: createOrderReference(),
      submittedAt: new Date().toISOString(),
      items,
      delivery,
      payment: {
        cardholder: payment.cardholder,
        maskedCardNumber: maskCardNumber(payment.cardNumber),
        expiry: payment.expiry,
      },
      subtotal,
      serviceFee,
      total,
      status: 'Demo order placed',
    }

    addOrderHistoryEntry(submittedOrderSnapshot)
    setSubmittedOrder(submittedOrderSnapshot)
    clearCart()
    setItems([])
    setErrors({})
    setStepIndex(3)
  }

  const handleApplySavedAddress = (addressId) => {
    if (!addressId) {
      setSelectedAddressId('')
      return
    }

    const address = savedAddresses.find((candidate) => candidate.id === addressId)

    if (!address) {
      return
    }

    setDelivery(buildDeliveryFromAddress(address))
    setSelectedAddressId(address.id)
    setErrors({})
  }

  const renderFieldError = (field) =>
    errors[field] ? (
      <p className="mt-2 text-sm font-medium text-[var(--aurora-text-strong)]">
        {errors[field]}
      </p>
    ) : null

  if (!items.length && !submittedOrder) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#f7e6d9_0%,#efd3bf_34%,#e0b495_64%,#cf9877_100%)]">
        <CoffeeBeanDecor />
        <Header />

        <main className="relative z-10 px-6 pb-16 pt-6 lg:px-10">
          <div className="mx-auto max-w-4xl rounded-[2.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.86)] p-10 text-center shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
              Checkout unavailable
            </p>
            <h1 className="mt-4 font-display text-5xl text-[var(--aurora-text-strong)]">
              Your cart is empty
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--aurora-text)]">
              Add coffees to your cart before moving into the checkout flow.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                to="/products"
                className="inline-flex rounded-full border border-[#d89270] bg-[var(--aurora-primary)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-text-strong)] shadow-[0_14px_36px_rgba(235,176,144,0.28)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-primary-soft)]"
              >
                Browse catalog
              </Link>
              <Link
                to="/cart"
                className="inline-flex rounded-full border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.78)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-cream)]"
              >
                Back to cart
              </Link>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#f7e6d9_0%,#efd3bf_34%,#e0b495_64%,#cf9877_100%)]">
      <CoffeeBeanDecor />
      <Header />

      <main className="relative z-10 px-6 pb-16 pt-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center gap-2 text-sm text-[var(--aurora-text)]">
            <Link to="/" className="transition hover:text-[var(--aurora-text-strong)]">
              Home
            </Link>
            <span>/</span>
            <Link
              to="/cart"
              className="transition hover:text-[var(--aurora-text-strong)]"
            >
              Cart
            </Link>
            <span>/</span>
            <span className="font-semibold text-[var(--aurora-text-strong)]">
              Checkout
            </span>
          </div>

          <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[2.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                    Demo checkout
                  </p>
                  <h1 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                    {currentStep.key === 'success'
                      ? 'Order confirmed'
                      : 'Complete your order'}
                  </h1>
                </div>
                {submittedOrder ? (
                  <span className="rounded-full border border-[rgba(138,144,119,0.26)] bg-[rgba(230,232,222,0.48)] px-4 py-2 text-sm font-semibold text-[var(--aurora-olive-deep)]">
                    {submittedOrder.reference}
                  </span>
                ) : null}
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-4">
                {checkoutSteps.map((step, index) => {
                  const isActive = index === stepIndex
                  const isComplete = index < stepIndex

                  return (
                    <div
                      key={step.key}
                      className={`rounded-[1.5rem] border px-4 py-3 text-sm font-semibold transition ${
                        isActive
                          ? 'border-[var(--aurora-sky)] bg-[var(--aurora-sky)] text-[var(--aurora-cream)]'
                          : isComplete
                            ? 'border-[rgba(138,144,119,0.26)] bg-[rgba(230,232,222,0.45)] text-[var(--aurora-olive-deep)]'
                            : 'border-[rgba(138,144,119,0.18)] bg-[rgba(255,247,242,0.78)] text-[var(--aurora-text)]'
                      }`}
                    >
                      <span className="block text-[10px] uppercase tracking-[0.22em] opacity-80">
                        Step {index + 1}
                      </span>
                      <span className="mt-2 block">{step.label}</span>
                    </div>
                  )
                })}
              </div>

              {currentStep.key === 'delivery' ? (
                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  {savedAddresses.length ? (
                    <div className="rounded-[1.75rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.34)] p-5 sm:col-span-2">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                            Saved addresses
                          </p>
                          <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                            Pick an address to prefill delivery details or keep editing manually.
                          </p>
                        </div>
                        <Link
                          to="/account/addresses"
                          className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
                        >
                          Manage saved addresses
                        </Link>
                      </div>

                      <label className="mt-4 block">
                        <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                          Apply a saved address
                        </span>
                        <select
                          value={selectedAddressId}
                          onChange={(event) => handleApplySavedAddress(event.target.value)}
                          className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                        >
                          <option value="">Choose a saved address</option>
                          {savedAddresses.map((address) => (
                            <option key={address.id} value={address.id}>
                              {address.label || address.fullName}
                              {address.isDefault ? ' (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                      Full name
                    </span>
                    <input
                      type="text"
                      value={delivery.fullName}
                      onChange={(event) =>
                        handleDeliveryChange('fullName', event.target.value)
                      }
                      className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                    />
                    {renderFieldError('fullName')}
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                      Email
                    </span>
                    <input
                      type="email"
                      value={delivery.email}
                      onChange={(event) =>
                        handleDeliveryChange('email', event.target.value)
                      }
                      className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                    />
                    {renderFieldError('email')}
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                      Delivery address
                    </span>
                    <input
                      type="text"
                      value={delivery.address}
                      onChange={(event) =>
                        handleDeliveryChange('address', event.target.value)
                      }
                      className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                    />
                    {renderFieldError('address')}
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                      City
                    </span>
                    <input
                      type="text"
                      value={delivery.city}
                      onChange={(event) =>
                        handleDeliveryChange('city', event.target.value)
                      }
                      className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                    />
                    {renderFieldError('city')}
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                      Postal code
                    </span>
                    <input
                      type="text"
                      value={delivery.postalCode}
                      onChange={(event) =>
                        handleDeliveryChange('postalCode', event.target.value)
                      }
                      className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                    />
                    {renderFieldError('postalCode')}
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                      Delivery notes
                    </span>
                    <textarea
                      value={delivery.notes}
                      onChange={(event) =>
                        handleDeliveryChange('notes', event.target.value)
                      }
                      rows="4"
                      className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                    />
                  </label>
                </div>
              ) : null}

              {currentStep.key === 'payment' ? (
                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                      Cardholder name
                    </span>
                    <input
                      type="text"
                      value={payment.cardholder}
                      onChange={(event) =>
                        handlePaymentChange('cardholder', event.target.value)
                      }
                      className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                    />
                    {renderFieldError('cardholder')}
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                      Card number
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={payment.cardNumber}
                      onChange={(event) =>
                        handlePaymentChange(
                          'cardNumber',
                          formatCardNumber(event.target.value),
                        )
                      }
                      placeholder="1234 5678 9012 3456"
                      className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                    />
                    {renderFieldError('cardNumber')}
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                      Expiry
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={payment.expiry}
                      onChange={(event) =>
                        handlePaymentChange(
                          'expiry',
                          formatExpiry(event.target.value),
                        )
                      }
                      placeholder="MM/YY"
                      className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                    />
                    {renderFieldError('expiry')}
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                      CVC
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={payment.cvc}
                      onChange={(event) =>
                        handlePaymentChange(
                          'cvc',
                          event.target.value.replace(/\D/g, '').slice(0, 4),
                        )
                      }
                      placeholder="123"
                      className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                    />
                    {renderFieldError('cvc')}
                  </label>

                  <div className="sm:col-span-2 rounded-[1.75rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.34)] p-5 text-sm leading-7 text-[var(--aurora-text)]">
                    This payment step is a frontend-only demo. No real card data
                    is processed or sent to a payment gateway.
                  </div>
                </div>
              ) : null}

              {currentStep.key === 'review' ? (
                <div className="mt-8 space-y-6">
                  <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.96)] p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      Delivery summary
                    </p>
                    <p className="mt-4 text-sm leading-8 text-[var(--aurora-text)]">
                      <span className="font-semibold text-[var(--aurora-text-strong)]">
                        {delivery.fullName}
                      </span>
                      <br />
                      {delivery.email}
                      <br />
                      {delivery.address}
                      <br />
                      {delivery.city}, {delivery.postalCode}
                    </p>
                    {delivery.notes ? (
                      <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                        Notes: {delivery.notes}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.96)] p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      Payment summary
                    </p>
                    <p className="mt-4 text-sm leading-8 text-[var(--aurora-text)]">
                      <span className="font-semibold text-[var(--aurora-text-strong)]">
                        {payment.cardholder}
                      </span>
                      <br />
                      {maskCardNumber(payment.cardNumber)}
                      <br />
                      Expires {payment.expiry}
                    </p>
                  </div>

                  <div className="rounded-[2rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.38)] p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      Invoice preview
                    </p>
                    <div className="mt-6 space-y-4">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-[rgba(138,144,119,0.18)] bg-[rgba(255,247,242,0.72)] px-4 py-3"
                        >
                          <div>
                            <p className="font-semibold text-[var(--aurora-text-strong)]">
                              {item.name}
                            </p>
                            <p className="text-sm text-[var(--aurora-text)]">
                              {item.weight} / {item.grind}
                            </p>
                            <p className="text-sm text-[var(--aurora-text)]">
                              Qty {item.quantity}
                            </p>
                          </div>
                          <p className="font-semibold text-[var(--aurora-text-strong)]">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {currentStep.key === 'success' && submittedOrder ? (
                <div className="mt-8 rounded-[2.25rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.45)] p-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                    Order confirmed
                  </p>
                  <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                    Your demo checkout has been completed
                  </h2>
                  <p className="mt-5 text-lg leading-8 text-[var(--aurora-text)]">
                    Reference {submittedOrder.reference} was created on{' '}
                    {new Date(submittedOrder.submittedAt).toLocaleString('en-GB', {
                      hour12: false,
                    })}
                    .
                  </p>

                  <div className="mt-8 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-[1.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.92)] p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                        Items
                      </p>
                      <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                        {submittedOrder.items.reduce(
                          (totalItems, item) => totalItems + item.quantity,
                          0,
                        )}
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.92)] p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                        Total
                      </p>
                      <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                        {formatCurrency(submittedOrder.total)}
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.92)] p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                        Delivery
                      </p>
                      <p className="mt-3 text-base font-semibold text-[var(--aurora-text-strong)]">
                        {submittedOrder.delivery.city}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-wrap gap-4">
                    <Link
                      to="/account/orders"
                      className="inline-flex rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.48)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-olive-deep)] transition hover:bg-[rgba(230,232,222,0.62)]"
                    >
                      View order history
                    </Link>
                    <Link
                      to="/products"
                      className="inline-flex rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
                    >
                      Return to shop
                    </Link>
                    <Link
                      to="/cart"
                      className="inline-flex rounded-full border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.82)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-cream)]"
                    >
                      View empty cart
                    </Link>
                  </div>
                </div>
              ) : null}

              {currentStep.key !== 'success' ? (
                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={handlePreviousStep}
                    disabled={stepIndex === 0}
                    className="rounded-full border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.82)] px-6 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-cream)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Back
                  </button>

                  {currentStep.key === 'review' ? (
                    <button
                      type="button"
                      onClick={handleSubmitOrder}
                      className="rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
                    >
                      Place demo order
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
                    >
                      Continue
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            <aside className="rounded-[2.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                Order summary
              </p>
              <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                Invoice preview
              </h2>

              <div className="mt-8 space-y-4">
                {(submittedOrder?.items || items).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[1.75rem] border border-[rgba(138,144,119,0.22)] bg-[rgba(255,247,242,0.95)] px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[var(--aurora-text-strong)]">
                          {item.name}
                        </p>
                        <p className="text-sm text-[var(--aurora-text)]">
                          {item.weight} / {item.grind}
                        </p>
                        <p className="text-sm text-[var(--aurora-text)]">
                          Qty {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold text-[var(--aurora-text-strong)]">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 space-y-4 rounded-[2rem] border border-[rgba(138,144,119,0.26)] bg-[rgba(230,232,222,0.34)] p-5 text-sm text-[var(--aurora-text)]">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[var(--aurora-text-strong)]">
                    {formatCurrency(submittedOrder?.subtotal ?? subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Service fee</span>
                  <span className="font-semibold text-[var(--aurora-text-strong)]">
                    {formatCurrency(submittedOrder?.serviceFee ?? serviceFee)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-base">
                  <span className="font-semibold text-[var(--aurora-text-strong)]">
                    Total
                  </span>
                  <span className="font-semibold text-[var(--aurora-text-strong)]">
                    {formatCurrency(submittedOrder?.total ?? total)}
                  </span>
                </div>
              </div>

              <div className="mt-8 rounded-[1.75rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.78)] p-5 text-sm leading-7 text-[var(--aurora-text)]">
                {currentStep.key === 'success'
                  ? 'The cart has been cleared and the success step now reflects the submitted snapshot of this demo checkout.'
                  : 'This checkout is a frontend-only demo. The review step acts as an invoice-style preview before final submission.'}
              </div>
            </aside>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
