import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LiquidGlassButton from '../components/LiquidGlassButton'
import StorefrontLayout from '../components/StorefrontLayout'
import { formatCurrency } from '../lib/currency'
import {
  getCityOptions,
  getCityOptionValue,
  sanitizePostalCode,
} from '../lib/address'
import {
  accountDataChangeEvent,
  addOrderHistoryEntry,
  getDefaultSavedAddress,
  getSavedAddresses,
  reconcileAccountStorageWithAuth,
} from '../lib/accountData'
import { authChangeEvent, getAuthSession } from '../lib/auth'
import {
  cartChangeEvent,
  clearCart,
  getCartItems,
  reconcileCartStorageWithAuth,
} from '../lib/cart'
import {
  validateCityPostalCode,
  validateEmail,
  validateTurkishCity,
} from '../lib/validation'

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

  const cityValidation = validateTurkishCity(delivery.city)
  if (!cityValidation.s) {
    errors.city = cityValidation.e
  }

  const cityPostalValidation = validateCityPostalCode(
    delivery.city,
    delivery.postalCode,
  )
  if (!cityPostalValidation.s) {
    if (!errors.city && cityPostalValidation.e === 'Select a valid city from the list') {
      errors.city = cityPostalValidation.e
    } else {
      errors.postalCode = cityPostalValidation.e
    }
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
    window.addEventListener(authChangeEvent, syncAccountState)
    window.addEventListener(cartChangeEvent, syncCartState)
    window.addEventListener(accountDataChangeEvent, syncAccountState)
    const initialSyncId = window.setTimeout(syncFromStorage, 0)

    return () => {
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener(authChangeEvent, syncAccountState)
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
    setErrors((current) => {
      if (field === 'city' || field === 'postalCode') {
        return {
          ...current,
          city: '',
          postalCode: '',
        }
      }

      return { ...current, [field]: '' }
    })
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

  const cityOptions = getCityOptions(delivery.city)

  if (!items.length && !submittedOrder) {
    const hero = (
      <section className="aurora-showcase-band px-6 py-12 text-center sm:px-8 lg:px-10">
        <p className="aurora-kicker">Checkout unavailable</p>
        <h1 className="mt-4 font-display text-5xl text-[var(--aurora-text-strong)]">
          Your cart is empty
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--aurora-text)]">
          Add products to your cart before moving into the checkout flow.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <LiquidGlassButton as={Link} to="/products" size="hero">
            Browse catalog
          </LiquidGlassButton>
          <LiquidGlassButton as={Link} to="/cart" variant="quiet" size="hero">
            Back to cart
          </LiquidGlassButton>
        </div>
      </section>
    )

    return <StorefrontLayout hero={hero} />
  }

  const hero = (
    <section className="aurora-showcase-band p-6 sm:p-8 lg:p-10">
      <div className="aurora-crumbs">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/cart">Cart</Link>
        <span>/</span>
        <span className="font-semibold text-[var(--aurora-text-strong)]">Checkout</span>
      </div>

      <div className="mt-6 aurora-page-intro-split">
        <div>
          <p className="aurora-kicker">Checkout</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl leading-[0.98] text-[var(--aurora-text-strong)] md:text-6xl">
            {currentStep.key === 'success' ? 'Order confirmed' : 'Complete your order'}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--aurora-text)]">
            Delivery details, payment details, and final review stay inside one clear transaction flow.
          </p>
        </div>

        <div className="aurora-summary-strip xl:grid-cols-3">
          <div className="aurora-summary-card p-5">
            <div className="aurora-widget-body">
              <div className="aurora-widget-heading">
                <p className="aurora-kicker">Items</p>
                <p className="mt-2 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {(submittedOrder?.items || items).reduce((sum, item) => sum + item.quantity, 0)}
                </p>
              </div>
              <p className="text-sm leading-7 text-[var(--aurora-text)]">
                Units moving through the checkout flow.
              </p>
            </div>
          </div>
          <div className="aurora-summary-card p-5">
            <div className="aurora-widget-body">
              <div className="aurora-widget-heading">
                <p className="aurora-kicker">Current total</p>
                <p className="mt-2 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {formatCurrency(submittedOrder?.total ?? total)}
                </p>
              </div>
              <p className="text-sm leading-7 text-[var(--aurora-text)]">
                Current total including service fee.
              </p>
            </div>
          </div>
          <div className="aurora-summary-card p-5">
            <div className="aurora-widget-body">
              <div className="aurora-widget-heading">
                <p className="aurora-kicker">Reference</p>
                <p className="mt-2 font-display text-3xl text-[var(--aurora-text-strong)]">
                  {submittedOrder ? submittedOrder.reference : `Step ${stepIndex + 1}`}
                </p>
              </div>
              <p className="text-sm leading-7 text-[var(--aurora-text)]">
                {submittedOrder ? 'Submitted order snapshot stored locally.' : 'Current checkout stage.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )

  return (
    <StorefrontLayout hero={hero} contentClassName="aurora-stack-12">
      <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="aurora-showroom-panel p-6 sm:p-8">
          <div className="grid gap-3 sm:grid-cols-4">
            {checkoutSteps.map((step, index) => {
              const isActive = index === stepIndex
              const isComplete = index < stepIndex

              return (
                <div
                  key={step.key}
                  className={`aurora-step-card px-4 py-3 text-sm font-semibold ${
                    isActive
                      ? 'border-[var(--aurora-sky)] bg-[var(--aurora-sky)] text-[var(--aurora-cream)]'
                      : isComplete
                        ? 'border-[rgba(138,144,119,0.26)] bg-[rgba(230,232,222,0.45)] text-[var(--aurora-olive-deep)]'
                        : 'text-[var(--aurora-text)]'
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
                <div className="aurora-showroom-subpanel p-5 sm:col-span-2">
                  <div className="aurora-widget-header">
                    <div className="aurora-widget-heading flex-1">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                        Saved addresses
                      </p>
                      <p className="text-sm leading-7 text-[var(--aurora-text)]">
                        Pick an address to prefill delivery details or keep editing manually.
                      </p>
                    </div>
                    <Link
                        to="/account/addresses"
                      className="aurora-link text-sm"
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
                      className="aurora-select"
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
                  onChange={(event) => handleDeliveryChange('fullName', event.target.value)}
                  className="aurora-input"
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
                  onChange={(event) => handleDeliveryChange('email', event.target.value)}
                  className="aurora-input"
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
                  onChange={(event) => handleDeliveryChange('address', event.target.value)}
                  className="aurora-input"
                />
                {renderFieldError('address')}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                  City
                </span>
                <select
                  value={delivery.city}
                  onChange={(event) => handleDeliveryChange('city', event.target.value)}
                  className="aurora-select"
                >
                  <option value="">Select a city</option>
                  {cityOptions.map((option) => (
                    <option key={option} value={getCityOptionValue(option)}>
                      {option}
                    </option>
                  ))}
                </select>
                {renderFieldError('city')}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                  Postal code
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={delivery.postalCode}
                  onChange={(event) =>
                    handleDeliveryChange(
                      'postalCode',
                      sanitizePostalCode(event.target.value),
                    )
                  }
                  className="aurora-input"
                />
                {renderFieldError('postalCode')}
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                  Delivery notes
                </span>
                <textarea
                  value={delivery.notes}
                  onChange={(event) => handleDeliveryChange('notes', event.target.value)}
                  rows="4"
                  className="aurora-textarea"
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
                  onChange={(event) => handlePaymentChange('cardholder', event.target.value)}
                  className="aurora-input"
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
                    handlePaymentChange('cardNumber', formatCardNumber(event.target.value))
                  }
                  placeholder="1234 5678 9012 3456"
                  className="aurora-input"
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
                    handlePaymentChange('expiry', formatExpiry(event.target.value))
                  }
                  placeholder="MM/YY"
                  className="aurora-input"
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
                  className="aurora-input"
                />
                {renderFieldError('cvc')}
              </label>

              <div className="aurora-showroom-subpanel p-5 text-sm leading-7 text-[var(--aurora-text)] sm:col-span-2">
                This payment step is for interface preview only. No real card data is processed or sent to a payment gateway.
              </div>
            </div>
          ) : null}

          {currentStep.key === 'review' ? (
            <div className="mt-8 space-y-6">
              <div className="aurora-showroom-subpanel p-6">
                <div className="aurora-widget-body">
                  <div className="aurora-widget-heading">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      Delivery summary
                    </p>
                  </div>
                  <div className="aurora-widget-subsurface p-5">
                    <p className="text-sm leading-8 text-[var(--aurora-text)]">
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
                </div>
              </div>

              <div className="aurora-showroom-subpanel p-6">
                <div className="aurora-widget-body">
                  <div className="aurora-widget-heading">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      Payment summary
                    </p>
                  </div>
                  <div className="aurora-widget-subsurface p-5">
                    <p className="text-sm leading-8 text-[var(--aurora-text)]">
                      <span className="font-semibold text-[var(--aurora-text-strong)]">
                        {payment.cardholder}
                      </span>
                      <br />
                      {maskCardNumber(payment.cardNumber)}
                      <br />
                      Expires {payment.expiry}
                    </p>
                  </div>
                </div>
              </div>

              <div className="aurora-solid-plate rounded-[1.9rem] p-6">
                <div className="aurora-widget-body">
                  <div className="aurora-widget-heading">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      Invoice preview
                    </p>
                  </div>
                  <div className="aurora-widget-list">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="aurora-showroom-subpanel flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div>
                          <p className="font-semibold text-[var(--aurora-text-strong)]">
                            {item.name}
                          </p>
                          <p className="text-sm text-[var(--aurora-text)]">
                            {item.metaLine || item.category || 'Product'}
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
            </div>
          ) : null}

          {currentStep.key === 'success' && submittedOrder ? (
            <div className="aurora-solid-plate mt-8 rounded-[2rem] p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                Order confirmed
              </p>
              <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                Your order has been placed
              </h2>
              <p className="mt-5 text-lg leading-8 text-[var(--aurora-text)]">
                Reference {submittedOrder.reference} was created on{' '}
                {new Date(submittedOrder.submittedAt).toLocaleString('en-GB', {
                  hour12: false,
                })}
                .
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="aurora-ops-card p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Items
                  </p>
                  <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                    {submittedOrder.items.reduce((totalItems, item) => totalItems + item.quantity, 0)}
                  </p>
                </div>
                <div className="aurora-ops-card p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Total
                  </p>
                  <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                    {formatCurrency(submittedOrder.total)}
                  </p>
                </div>
                <div className="aurora-ops-card p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Delivery
                  </p>
                  <p className="mt-3 text-base font-semibold text-[var(--aurora-text-strong)]">
                    {submittedOrder.delivery.city}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <LiquidGlassButton as={Link} to="/account/orders" variant="secondary" size="hero">
                  View order history
                </LiquidGlassButton>
                <LiquidGlassButton as={Link} to="/products" size="hero">
                  Return to shop
                </LiquidGlassButton>
                <LiquidGlassButton as={Link} to="/cart" variant="quiet" size="hero">
                  View empty cart
                </LiquidGlassButton>
              </div>
            </div>
          ) : null}

          {currentStep.key !== 'success' ? (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <LiquidGlassButton
                type="button"
                onClick={handlePreviousStep}
                disabled={stepIndex === 0}
                variant="quiet"
              >
                Back
              </LiquidGlassButton>

              {currentStep.key === 'review' ? (
                <LiquidGlassButton
                  type="button"
                  onClick={handleSubmitOrder}
                  size="hero"
                >
                  Place order
                </LiquidGlassButton>
              ) : (
                <LiquidGlassButton
                  type="button"
                  onClick={handleNextStep}
                  size="hero"
                >
                  Continue
                </LiquidGlassButton>
              )}
            </div>
          ) : null}
        </div>

        <aside className="aurora-showcase-band h-fit p-6 sm:p-8">
          <div className="aurora-widget-body">
            <div className="aurora-widget-heading">
              <p className="aurora-kicker">Order summary</p>
              <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                Invoice preview
              </h2>
            </div>

            <div className="aurora-widget-list">
            {(submittedOrder?.items || items).map((item) => (
              <div key={item.id} className="aurora-showroom-subpanel px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[var(--aurora-text-strong)]">
                      {item.name}
                    </p>
                    <p className="text-sm text-[var(--aurora-text)]">
                      {item.metaLine || item.category || 'Product'}
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

            <div className="aurora-solid-plate rounded-[1.9rem] p-5">
              <div className="space-y-4 text-sm text-[var(--aurora-text)]">
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
                  <span className="font-semibold text-[var(--aurora-text-strong)]">Total</span>
                  <span className="font-semibold text-[var(--aurora-text-strong)]">
                    {formatCurrency(submittedOrder?.total ?? total)}
                  </span>
                </div>
              </div>
            </div>

            <div className="aurora-showroom-subpanel p-5 text-sm leading-7 text-[var(--aurora-text)]">
              {currentStep.key === 'success'
                ? 'The cart has been cleared and the success step now reflects the submitted order snapshot.'
                : 'Review your order before final submission. Payment data is not sent to a live processor in this build.'}
            </div>
          </div>
        </aside>
      </section>
    </StorefrontLayout>
  )
}
