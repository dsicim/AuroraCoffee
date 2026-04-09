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
  reconcileAccountStorageWithAuth,
} from '../lib/accountData'
import {
  addressBookChangeEvent,
  fetchSavedAddressById,
  fetchSavedAddresses,
  getSavedAddresses,
} from '../lib/addressBook'
import { authChangeEvent, getAuthSession } from '../lib/auth'
import {
  cartChangeEvent,
  formatCartOptionLabel,
  getCartItems,
  getCartOptionEntries,
  reconcileCartStorageWithAuth,
} from '../lib/cart'
import {
  deletePaymentMethod,
  fetchInstallmentInfo,
  fetchPaymentMethods,
  formatPaymentError,
  initiatePayment,
  maskSavedCard,
  savePaymentMethod,
} from '../lib/payment'
import {
  buildPaymentSummary,
  consumeCheckout3DSReturnState,
  createPending3DSCheckoutSnapshot,
  open3DSTargetSameTab,
  savePending3DSCheckoutSnapshot,
} from '../lib/payment3ds'
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
  firstName: '',
  lastName: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  province: '',
  district: '',
  postalCode: '',
  phone: '',
}

const initialBilling = {
  firstName: '',
  lastName: '',
  addressLine1: '',
  addressLine2: '',
  province: '',
  district: '',
  postalCode: '',
  phone: '',
}

const initialPayment = {
  cardholder: '',
  cardNumber: '',
  expiry: '',
  cvc: '',
}

function buildDeliveryFromAddress(address, email = '') {
  if (!address) {
    return {
      ...initialDelivery,
      email,
    }
  }

  return {
    firstName: address.firstName || '',
    lastName: address.lastName || '',
    email,
    addressLine1: address.addressLine1 || '',
    addressLine2: address.addressLine2 || '',
    province: address.province || '',
    district: address.district || '',
    postalCode: address.postalCode || '',
    phone: address.phone || '',
  }
}

function buildBillingFromDelivery(delivery) {
  return {
    firstName: delivery.firstName || '',
    lastName: delivery.lastName || '',
    addressLine1: delivery.addressLine1 || '',
    addressLine2: delivery.addressLine2 || '',
    province: delivery.province || '',
    district: delivery.district || '',
    postalCode: delivery.postalCode || '',
    phone: delivery.phone || '',
  }
}

function getAddressFullName(address) {
  return [address.firstName, address.lastName].filter(Boolean).join(' ').trim()
}

function getAddressLines(address) {
  return [address.addressLine1, address.addressLine2].filter(Boolean)
}

function getDeliveryFullName(delivery) {
  return [delivery.firstName, delivery.lastName].filter(Boolean).join(' ').trim()
}

function getDeliveryAddressLines(delivery) {
  return [delivery.addressLine1, delivery.addressLine2].filter(Boolean)
}

function renderCartItemOptions(item) {
  const optionEntries = getCartOptionEntries(item?.options)

  if (!optionEntries.length) {
    return null
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {optionEntries.map(([key, value]) => (
        <span key={`${item.id}-${key}`} className="aurora-chip text-[11px] tracking-[0.14em]">
          {formatCartOptionLabel(key)}: {value}
        </span>
      ))}
    </div>
  )
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

function validateDeliveryForm(delivery) {
  const errors = {}

  if (!delivery.firstName.trim()) {
    errors.firstName = 'First name is required'
  }

  if (!delivery.lastName.trim()) {
    errors.lastName = 'Last name is required'
  }

  const emailValidation = validateEmail(delivery.email)
  if (!emailValidation.s) {
    errors.email = emailValidation.e
  }

  if (!delivery.addressLine1.trim()) {
    errors.addressLine1 = 'Address line 1 is required'
  }

  if (!delivery.phone.trim()) {
    errors.phone = 'Phone is required'
  }

  if (!delivery.district.trim()) {
    errors.district = 'District is required'
  }

  const cityValidation = validateTurkishCity(delivery.province)
  if (!cityValidation.s) {
    errors.province = cityValidation.e
  }

  const cityPostalValidation = validateCityPostalCode(
    delivery.province,
    delivery.postalCode,
  )
  if (!cityPostalValidation.s) {
    if (!errors.province && cityPostalValidation.e === 'Select a valid city from the list') {
      errors.province = cityPostalValidation.e
    } else {
      errors.postalCode = cityPostalValidation.e
    }
  }

  return errors
}

function validateBillingForm(billing) {
  const errors = {}

  if (!billing.firstName.trim()) {
    errors.firstName = 'First name is required'
  }

  if (!billing.lastName.trim()) {
    errors.lastName = 'Last name is required'
  }

  if (!billing.addressLine1.trim()) {
    errors.addressLine1 = 'Address line 1 is required'
  }

  if (!billing.phone.trim()) {
    errors.phone = 'Phone is required'
  }

  if (!billing.district.trim()) {
    errors.district = 'District is required'
  }

  const cityValidation = validateTurkishCity(billing.province)
  if (!cityValidation.s) {
    errors.province = cityValidation.e
  }

  const cityPostalValidation = validateCityPostalCode(
    billing.province,
    billing.postalCode,
  )
  if (!cityPostalValidation.s) {
    if (!errors.province && cityPostalValidation.e === 'Select a valid city from the list') {
      errors.province = cityPostalValidation.e
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

function validateSavedCardForm(payment) {
  const errors = {}
  const cvcDigits = payment.cvc.replace(/\D/g, '')

  if (cvcDigits.length < 3) {
    errors.cvc = 'CVC must be at least 3 digits'
  }

  return errors
}

function normalizeInstallmentMonths(value) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 1 ? parsed : null
}

function getInstallmentOptions(installmentInfo) {
  return Array.isArray(installmentInfo?.installments)
    ? installmentInfo.installments
        .filter((item) => normalizeInstallmentMonths(item?.months))
        .sort((left, right) => Number(left.months) - Number(right.months))
    : []
}

function getInstallmentSelectionLabel(installmentInfo, selectedInstallments) {
  const selectedMonths = normalizeInstallmentMonths(selectedInstallments)

  if (!selectedMonths) {
    return ''
  }

  const selectedOption = getInstallmentOptions(installmentInfo).find(
    (item) => Number(item.months) === selectedMonths,
  )

  if (!selectedOption) {
    return `${selectedMonths} installments`
  }

  return `${selectedMonths} installments · ${formatCurrency(selectedOption.permonth)} / month`
}

function getInstallmentSelectionDescription(installmentInfo, selectedInstallments, total) {
  const selectedMonths = normalizeInstallmentMonths(selectedInstallments)

  if (!selectedMonths) {
    return `Pay in full · ${formatCurrency(total)} today`
  }

  const selectedOption = getInstallmentOptions(installmentInfo).find(
    (item) => Number(item.months) === selectedMonths,
  )

  if (!selectedOption) {
    return `${selectedMonths} installments`
  }

  return `${formatCurrency(selectedOption.permonth)} / month · total ${formatCurrency(selectedOption.total)}`
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const initialSession = getAuthSession()
  const [items, setItems] = useState(() => getCartItems())
  const [session, setSession] = useState(() => initialSession)
  const [stepIndex, setStepIndex] = useState(0)
  const [delivery, setDelivery] = useState(() =>
    buildDeliveryFromAddress(null, initialSession?.email || ''),
  )
  const [billing, setBilling] = useState(initialBilling)
  const [useShippingAsBilling, setUseShippingAsBilling] = useState(true)
  const [payment, setPayment] = useState(initialPayment)
  const [savedAddresses, setSavedAddresses] = useState(() => getSavedAddresses())
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [savedCards, setSavedCards] = useState([])
  const [selectedSavedCardId, setSelectedSavedCardId] = useState('')
  const [saveCardForLater, setSaveCardForLater] = useState(false)
  const [installmentInfo, setInstallmentInfo] = useState(null)
  const [selectedInstallments, setSelectedInstallments] = useState('')
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const [submittedOrder] = useState(null)
  const [paymentSummaryOverride, setPaymentSummaryOverride] = useState(null)

  const subtotal = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  )
  const serviceFee = 0
  const total = subtotal + serviceFee
  const currentStep = checkoutSteps[stepIndex]
  const isLoggedIn = Boolean(session?.token)
  const installmentBin = payment.cardNumber.replace(/\D/g, '').slice(0, 6)
  const installmentOptions = getInstallmentOptions(installmentInfo)
  const activeInstallmentLabel = getInstallmentSelectionLabel(
    installmentInfo,
    selectedInstallments,
  )
  const activeInstallmentDescription = getInstallmentSelectionDescription(
    installmentInfo,
    selectedInstallments,
    total,
  )

  useEffect(() => {
    const syncFromStorage = () => {
      void (async () => {
        reconcileAccountStorageWithAuth()
        try {
          await reconcileCartStorageWithAuth()
        } catch {
          // Ignore stale auth failures during storage or payment-return sync.
        }
        await fetchSavedAddresses().catch(() => [])
        setItems(getCartItems())
        setSession(getAuthSession())
        setSavedAddresses(getSavedAddresses())
      })()
    }

    const syncCartState = () => {
      setItems(getCartItems())
      setSession(getAuthSession())
    }

    const syncAccountState = () => {
      void (async () => {
        setSession(getAuthSession())
        await fetchSavedAddresses().catch(() => [])
        setSavedAddresses(getSavedAddresses())
      })()
    }

    window.addEventListener('storage', syncFromStorage)
    window.addEventListener(authChangeEvent, syncAccountState)
    window.addEventListener(cartChangeEvent, syncCartState)
    window.addEventListener(accountDataChangeEvent, syncAccountState)
    window.addEventListener(addressBookChangeEvent, syncAccountState)
    const initialSyncId = window.setTimeout(syncFromStorage, 0)

    return () => {
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener(authChangeEvent, syncAccountState)
      window.removeEventListener(cartChangeEvent, syncCartState)
      window.removeEventListener(accountDataChangeEvent, syncAccountState)
      window.removeEventListener(addressBookChangeEvent, syncAccountState)
      window.clearTimeout(initialSyncId)
    }
  }, [])

  useEffect(() => {
    if (!isLoggedIn) {
      setSavedCards([])
      setSelectedSavedCardId('')
      return
    }

    let active = true

    const loadSavedCards = async () => {
      try {
        const cards = await fetchPaymentMethods()

        if (!active) {
          return
        }

        setSavedCards(cards)
        setSelectedSavedCardId((current) =>
          current && cards.some((card) => card.id === current)
            ? current
            : cards[0]?.id || '',
        )
      } catch (paymentError) {
        if (active) {
          setErrors((current) => ({
            ...current,
            payment: formatPaymentError(paymentError, 'Could not load saved cards'),
          }))
        }
      }
    }

    loadSavedCards()

    return () => {
      active = false
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (!session?.email) {
      return
    }

    setDelivery((current) =>
      current.email
        ? current
        : {
            ...current,
            email: session.email,
          },
    )
  }, [session?.email])

  useEffect(() => {
    const returnState = consumeCheckout3DSReturnState()

    if (!returnState) {
      return
    }

    const snapshot = returnState.snapshot || null

    if (snapshot?.deliveryForm) {
      setDelivery(snapshot.deliveryForm)
    }

    if (snapshot?.billingForm) {
      setBilling(snapshot.billingForm)
    }

    if (typeof snapshot?.useShippingAsBilling === 'boolean') {
      setUseShippingAsBilling(snapshot.useShippingAsBilling)
    }

    setSelectedAddressId(snapshot?.selectedAddressId || '')
    setSelectedSavedCardId(snapshot?.selectedSavedCardId || '')
    setSelectedInstallments(snapshot?.selectedInstallments || '')
    setSaveCardForLater(Boolean(snapshot?.saveCardForLater))
    setPaymentSummaryOverride(snapshot?.paymentSummary || null)
    setPayment({
      ...initialPayment,
      cardholder: snapshot?.paymentForm?.cardholder || '',
      expiry: snapshot?.paymentForm?.expiry || '',
    })
    setStepIndex(2)
    setErrors({
      payment: returnState.message || '3D Secure authentication did not complete.',
    })
  }, [])

  useEffect(() => {
    if (currentStep.key !== 'payment') {
      return undefined
    }

    if (!selectedSavedCardId && installmentBin.length < 6) {
      setInstallmentInfo(null)
      setSelectedInstallments('')
      return undefined
    }

    let active = true
    const timeoutId = window.setTimeout(() => {
      fetchInstallmentInfo({
        token: selectedSavedCardId,
        bin: installmentBin,
        price: total,
      })
        .then((info) => {
          if (active) {
            setInstallmentInfo(info)
          }
        })
        .catch(() => {
          if (active) {
            setInstallmentInfo(null)
          }
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [currentStep.key, installmentBin, selectedSavedCardId, total])

  useEffect(() => {
    if (!selectedInstallments) {
      return
    }

    const selectedMonths = normalizeInstallmentMonths(selectedInstallments)

    if (!selectedMonths) {
      setSelectedInstallments('')
      return
    }

    if (!installmentOptions.some((item) => Number(item.months) === selectedMonths)) {
      setSelectedInstallments('')
    }
  }, [installmentOptions, selectedInstallments])

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
      if (field === 'province' || field === 'postalCode') {
        return {
          ...current,
          province: '',
          postalCode: '',
        }
      }

      return { ...current, [field]: '' }
    })
  }

  const handleBillingChange = (field, value) => {
    setBilling((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (field === 'province' || field === 'postalCode') {
        return {
          ...current,
          billingProvince: '',
          billingPostalCode: '',
        }
      }

      const nextField =
        field === 'firstName'
          ? 'billingFirstName'
          : field === 'lastName'
            ? 'billingLastName'
            : field === 'addressLine1'
              ? 'billingAddressLine1'
              : field === 'district'
                ? 'billingDistrict'
                : field === 'phone'
                  ? 'billingPhone'
                  : `billing${field.charAt(0).toUpperCase()}${field.slice(1)}`

      return { ...current, [nextField]: '' }
    })
  }

  const handlePaymentChange = (field, value) => {
    setPaymentSummaryOverride(null)
    setPayment((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '', payment: '' }))
  }

  const handleNextStep = () => {
    if (currentStep.key === 'delivery') {
      const deliveryErrors = validateDeliveryForm(delivery)
      const billingErrors = useShippingAsBilling
        ? {}
        : validateBillingForm(billing)

      if (Object.keys(billingErrors).length) {
        if (billingErrors.firstName) {
          billingErrors.billingFirstName = billingErrors.firstName
          delete billingErrors.firstName
        }
        if (billingErrors.lastName) {
          billingErrors.billingLastName = billingErrors.lastName
          delete billingErrors.lastName
        }
        if (billingErrors.addressLine1) {
          billingErrors.billingAddressLine1 = billingErrors.addressLine1
          delete billingErrors.addressLine1
        }
        if (billingErrors.province) {
          billingErrors.billingProvince = billingErrors.province
          delete billingErrors.province
        }
        if (billingErrors.district) {
          billingErrors.billingDistrict = billingErrors.district
          delete billingErrors.district
        }
        if (billingErrors.postalCode) {
          billingErrors.billingPostalCode = billingErrors.postalCode
          delete billingErrors.postalCode
        }
        if (billingErrors.phone) {
          billingErrors.billingPhone = billingErrors.phone
          delete billingErrors.phone
        }
      }

      if (Object.keys(deliveryErrors).length || Object.keys(billingErrors).length) {
        setErrors({
          ...deliveryErrors,
          ...billingErrors,
        })
        return
      }
    }

    if (currentStep.key === 'payment') {
      const paymentErrors = selectedSavedCardId
        ? validateSavedCardForm(payment)
        : validatePaymentForm(payment)

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
    void (async () => {
      setPaymentBusy(true)
      setErrors((current) => ({ ...current, payment: '' }))

      try {
        if (!selectedSavedCardId && saveCardForLater) {
          await savePaymentMethod({
            alias: payment.cardholder || 'Saved card',
            card: payment,
          })
        }

        const cartPayload = items
          .map((item) => ({
            id: Number(item.productId),
            qty: Math.max(1, Math.floor(item.quantity) || 1),
            opt: item.options || {},
          }))
          .filter((item) => Number.isFinite(item.id) && item.id > 0)

        if (!cartPayload.length) {
          throw new Error('Cart items could not be prepared for payment.')
        }

        const shouldUseShippingToken = Boolean(selectedAddressId) && useShippingAsBilling
        const shippingPayload = shouldUseShippingToken
          ? { token: selectedAddressId }
          : {
              name: delivery.firstName.trim(),
              surname: delivery.lastName.trim(),
              address: delivery.addressLine1.trim(),
              address2: delivery.addressLine2.trim(),
              city: delivery.district.trim(),
              province: delivery.province.trim(),
              country: 'Turkey',
              zip: delivery.postalCode.trim(),
              phone: delivery.phone.trim(),
            }
        const billingPayload = useShippingAsBilling
          ? { token: 'shipping' }
          : {
              name: billing.firstName.trim(),
              surname: billing.lastName.trim(),
              address: billing.addressLine1.trim(),
              address2: billing.addressLine2.trim(),
              city: billing.district.trim(),
              province: billing.province.trim(),
              country: 'Turkey',
              zip: billing.postalCode.trim(),
              phone: billing.phone.trim(),
            }

        const paymentResponse = await initiatePayment({
          cart: cartPayload,
          shipping: shippingPayload,
          billing: billingPayload,
          expected: subtotal,
          currency: 'TRY',
          installments: normalizeInstallmentMonths(selectedInstallments) || undefined,
          savedCardToken: selectedSavedCardId || '',
          cvc: payment.cvc,
          card: selectedSavedCardId ? null : payment,
        })

        if (paymentResponse?.redirect3DS && paymentResponse?.target) {
          savePending3DSCheckoutSnapshot(
            createPending3DSCheckoutSnapshot({
              items,
              delivery,
              billing,
              useShippingAsBilling,
              selectedAddressId,
              selectedSavedCardId,
              payment,
              savedCards,
              saveCardForLater,
              selectedInstallments,
              installmentSelectionLabel: activeInstallmentLabel,
              subtotal,
              serviceFee,
              total,
            }),
          )
          open3DSTargetSameTab(paymentResponse.target)
          return
        }

        if (paymentResponse?.redirect3DS && !paymentResponse?.target) {
          throw new Error(
            '3D Secure was requested, but the payment page could not be opened.',
          )
        }

        throw new Error(
          'The secure payment handoff was not started. Please try again.',
        )
      } catch (submitError) {
        setErrors((current) => ({
          ...current,
          payment: formatPaymentError(submitError, 'Payment could not be submitted'),
        }))
      } finally {
        setPaymentBusy(false)
      }
    })()
  }

  const handleApplySavedAddress = (addressId) => {
    if (!addressId) {
      setSelectedAddressId('')
      return
    }

    void (async () => {
      try {
        const address = await fetchSavedAddressById(addressId)

        if (!address) {
          return
        }

        setDelivery(buildDeliveryFromAddress(address, session?.email || delivery.email || ''))
        setSelectedAddressId(address.id)
        if (useShippingAsBilling) {
          setBilling(buildBillingFromDelivery(buildDeliveryFromAddress(address, session?.email || delivery.email || '')))
        }
        setErrors({})
      } catch (loadError) {
        setErrors((current) => ({
          ...current,
          delivery: formatPaymentError(loadError, 'Could not load saved address'),
        }))
      }
    })()
  }

  const renderFieldError = (field) =>
    errors[field] ? (
      <p className="mt-2 text-sm font-medium text-[var(--aurora-text-strong)]">
        {errors[field]}
      </p>
    ) : null

  const cityOptions = getCityOptions(delivery.province)
  const billingCityOptions = getCityOptions(billing.province)
  const activePaymentSummary = paymentSummaryOverride || {
    ...buildPaymentSummary({
      payment,
      savedCards,
      selectedSavedCardId,
    }),
    ...(activeInstallmentLabel ? { installmentLabel: activeInstallmentLabel } : {}),
  }

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
                Current total aligned with backend cart validation.
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
                    <span className="aurora-field-label">
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
                          {address.label || address.fullName || address.summaryTitle || `Address ${address.id}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              <label className="block">
                <span className="aurora-field-label">
                  First name
                </span>
                <input
                  type="text"
                  value={delivery.firstName}
                  onChange={(event) => handleDeliveryChange('firstName', event.target.value)}
                  className="aurora-input"
                />
                {renderFieldError('firstName')}
              </label>

              <label className="block">
                <span className="aurora-field-label">
                  Last name
                </span>
                <input
                  type="text"
                  value={delivery.lastName}
                  onChange={(event) => handleDeliveryChange('lastName', event.target.value)}
                  className="aurora-input"
                />
                {renderFieldError('lastName')}
              </label>

              <label className="block sm:col-span-2">
                <span className="aurora-field-label">
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
                <span className="aurora-field-label">
                  Address line 1
                </span>
                <input
                  type="text"
                  value={delivery.addressLine1}
                  onChange={(event) => handleDeliveryChange('addressLine1', event.target.value)}
                  className="aurora-input"
                />
                {renderFieldError('addressLine1')}
              </label>

              <label className="block sm:col-span-2">
                <span className="aurora-field-label">
                  Address line 2 (optional)
                </span>
                <input
                  type="text"
                  value={delivery.addressLine2}
                  onChange={(event) => handleDeliveryChange('addressLine2', event.target.value)}
                  className="aurora-input"
                />
              </label>

              <label className="block">
                <span className="aurora-field-label">
                  Province
                </span>
                <select
                  value={delivery.province}
                  onChange={(event) => handleDeliveryChange('province', event.target.value)}
                  className="aurora-select"
                >
                  <option value="">Select a province</option>
                  {cityOptions.map((option) => (
                    <option key={option} value={getCityOptionValue(option)}>
                      {option}
                    </option>
                  ))}
                </select>
                {renderFieldError('province')}
              </label>

              <label className="block">
                <span className="aurora-field-label">
                  District
                </span>
                <input
                  type="text"
                  value={delivery.district}
                  onChange={(event) => handleDeliveryChange('district', event.target.value)}
                  className="aurora-input"
                />
                {renderFieldError('district')}
              </label>

              <label className="block">
                <span className="aurora-field-label">
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

              <label className="block">
                <span className="aurora-field-label">
                  Phone
                </span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={delivery.phone}
                  onChange={(event) => handleDeliveryChange('phone', event.target.value)}
                  className="aurora-input"
                />
                {renderFieldError('phone')}
              </label>

              <div className="aurora-showroom-subpanel p-5 sm:col-span-2">
                <div className="aurora-widget-header">
                  <div className="aurora-widget-heading">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      Billing address
                    </p>
                    <p className="text-sm leading-7 text-[var(--aurora-text)]">
                      Use shipping details by default, or enter a separate billing address.
                    </p>
                  </div>
                </div>

                <label className="glass-toggle mt-4 block">
                  <input
                    type="checkbox"
                    checked={useShippingAsBilling}
                    onChange={(event) => {
                      const nextValue = event.target.checked
                      setUseShippingAsBilling(nextValue)

                      if (!nextValue) {
                        setBilling(buildBillingFromDelivery(delivery))
                      }

                      setErrors((current) => ({
                        ...current,
                        billingFirstName: '',
                        billingLastName: '',
                        billingAddressLine1: '',
                        billingProvince: '',
                        billingDistrict: '',
                        billingPostalCode: '',
                        billingPhone: '',
                      }))
                    }}
                    className="toggle-input"
                  />
                  <span className="toggle-track">
                    <span className="glass-filter" />
                    <span className="glass-overlay" />
                    <span className="glass-specular" />
                    <span className="toggle-thumb">
                      <span className="glass-filter" />
                      <span className="glass-overlay" />
                      <span className="glass-specular" />
                    </span>
                  </span>
                  <span className="toggle-label">Same as shipping</span>
                </label>

                {!useShippingAsBilling ? (
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <LiquidGlassButton
                        type="button"
                        variant="quiet"
                        size="compact"
                        onClick={() => setBilling(buildBillingFromDelivery(delivery))}
                      >
                        Copy shipping address
                      </LiquidGlassButton>
                    </div>

                    <label className="block">
                      <span className="aurora-field-label">
                        Billing first name
                      </span>
                      <input
                        type="text"
                        value={billing.firstName}
                        onChange={(event) => handleBillingChange('firstName', event.target.value)}
                        className="aurora-input"
                      />
                      {renderFieldError('billingFirstName')}
                    </label>

                    <label className="block">
                      <span className="aurora-field-label">
                        Billing last name
                      </span>
                      <input
                        type="text"
                        value={billing.lastName}
                        onChange={(event) => handleBillingChange('lastName', event.target.value)}
                        className="aurora-input"
                      />
                      {renderFieldError('billingLastName')}
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="aurora-field-label">
                        Billing address line 1
                      </span>
                      <input
                        type="text"
                        value={billing.addressLine1}
                        onChange={(event) => handleBillingChange('addressLine1', event.target.value)}
                        className="aurora-input"
                      />
                      {renderFieldError('billingAddressLine1')}
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="aurora-field-label">
                        Billing address line 2 (optional)
                      </span>
                      <input
                        type="text"
                        value={billing.addressLine2}
                        onChange={(event) => handleBillingChange('addressLine2', event.target.value)}
                        className="aurora-input"
                      />
                    </label>

                    <label className="block">
                      <span className="aurora-field-label">
                        Billing province
                      </span>
                      <select
                        value={billing.province}
                        onChange={(event) => handleBillingChange('province', event.target.value)}
                        className="aurora-select"
                      >
                        <option value="">Select a province</option>
                        {billingCityOptions.map((option) => (
                          <option key={option} value={getCityOptionValue(option)}>
                            {option}
                          </option>
                        ))}
                      </select>
                      {renderFieldError('billingProvince')}
                    </label>

                    <label className="block">
                      <span className="aurora-field-label">
                        Billing district
                      </span>
                      <input
                        type="text"
                        value={billing.district}
                        onChange={(event) => handleBillingChange('district', event.target.value)}
                        className="aurora-input"
                      />
                      {renderFieldError('billingDistrict')}
                    </label>

                    <label className="block">
                      <span className="aurora-field-label">
                        Billing postal code
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        value={billing.postalCode}
                        onChange={(event) =>
                          handleBillingChange(
                            'postalCode',
                            sanitizePostalCode(event.target.value),
                          )
                        }
                        className="aurora-input"
                      />
                      {renderFieldError('billingPostalCode')}
                    </label>

                    <label className="block">
                      <span className="aurora-field-label">
                        Billing phone
                      </span>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={billing.phone}
                        onChange={(event) => handleBillingChange('phone', event.target.value)}
                        className="aurora-input"
                      />
                      {renderFieldError('billingPhone')}
                    </label>
                  </div>
                ) : null}
              </div>

              {errors.delivery ? (
                <p className="sm:col-span-2 text-sm font-medium text-[var(--aurora-text-strong)]">
                  {errors.delivery}
                </p>
              ) : null}
            </div>
          ) : null}

          {currentStep.key === 'payment' ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {savedCards.length ? (
                <div className="aurora-showroom-subpanel p-5 sm:col-span-2">
                  <div className="aurora-widget-header">
                    <div className="aurora-widget-heading">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                        Saved cards
                      </p>
                      <p className="text-sm leading-7 text-[var(--aurora-text)]">
                        Select a saved card or enter a new one for this order.
                      </p>
                    </div>
                    {selectedSavedCardId ? (
                      <button
                        type="button"
                        className="aurora-link text-sm"
                        onClick={() => {
                          setPaymentSummaryOverride(null)
                          setSelectedSavedCardId('')
                        }}
                      >
                        Use a new card
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    {savedCards.map((card) => (
                      <div key={card.id} className="aurora-ops-card flex items-center justify-between gap-3 px-4 py-3">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            setPaymentSummaryOverride(null)
                            setSelectedSavedCardId(card.id)
                          }}
                        >
                          <p className="font-semibold text-[var(--aurora-text-strong)]">
                            {card.alias || card.family || 'Saved card'}
                          </p>
                          <p className="mt-1 text-sm text-[var(--aurora-text)]">
                            {maskSavedCard(card)} · {card.provider || card.bank || 'Card'}
                          </p>
                        </button>
                        <div className="flex items-center gap-3">
                          {selectedSavedCardId === card.id ? (
                            <span className="aurora-chip">Selected</span>
                          ) : null}
                          <button
                            type="button"
                            className="aurora-link text-sm"
                            onClick={() => {
                              void (async () => {
                                try {
                                  await deletePaymentMethod(card.id)
                                  const nextCards = await fetchPaymentMethods()
                                  setSavedCards(nextCards)
                                  setPaymentSummaryOverride(null)
                                  setSelectedSavedCardId((current) =>
                                    current === card.id ? '' : current,
                                  )
                                } catch (deleteError) {
                                  setErrors((current) => ({
                                    ...current,
                                    payment: formatPaymentError(deleteError, 'Could not delete saved card'),
                                  }))
                                }
                              })()
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!selectedSavedCardId ? (
                <>
                  <label className="block sm:col-span-2">
                    <span className="aurora-field-label">
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
                    <span className="aurora-field-label">
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
                    <span className="aurora-field-label">
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
                </>
              ) : (
                <div className="aurora-showroom-subpanel p-5 sm:col-span-2">
                  <p className="text-sm leading-7 text-[var(--aurora-text)]">
                    Using {maskSavedCard(savedCards.find((card) => card.id === selectedSavedCardId))}.
                  </p>
                </div>
              )}

              <label className="block">
                <span className="aurora-field-label">
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

              {!selectedSavedCardId ? (
                <label className="glass-toggle sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={saveCardForLater}
                    onChange={(event) => setSaveCardForLater(event.target.checked)}
                    className="toggle-input"
                  />
                  <span className="toggle-track">
                    <span className="glass-filter" />
                    <span className="glass-overlay" />
                    <span className="glass-specular" />
                    <span className="toggle-thumb">
                      <span className="glass-filter" />
                      <span className="glass-overlay" />
                      <span className="glass-specular" />
                    </span>
                  </span>
                  <span className="toggle-label">Save this card for next time</span>
                </label>
              ) : null}

              {installmentInfo?.card ? (
                <div className="aurora-showroom-subpanel p-5 text-sm leading-7 text-[var(--aurora-text)] sm:col-span-2">
                  <div className="aurora-installment-header">
                    <div>
                      <p className="aurora-field-label">Installments</p>
                      <p className="mt-2 font-semibold text-[var(--aurora-text-strong)]">
                        {installmentInfo.card.provider || 'Card'} · {installmentInfo.card.type || 'Card'}
                      </p>
                    </div>
                    <div className="aurora-installment-summary">
                      <span className="aurora-chip">
                        {selectedInstallments
                          ? `${selectedInstallments} installments`
                          : 'Pay in full'}
                      </span>
                    </div>
                  </div>
                  {installmentOptions.length ? (
                    <>
                      <p className="mt-3">
                        Choose how you want to split this payment.
                      </p>
                      <div className="aurora-installment-grid mt-4">
                        <button
                          type="button"
                          className={`aurora-installment-option${!selectedInstallments ? ' is-selected' : ''}`}
                          onClick={() => setSelectedInstallments('')}
                          aria-pressed={!selectedInstallments}
                        >
                          <span className="aurora-installment-option__meta">Single charge</span>
                          <span className="aurora-installment-option__title">Pay in full</span>
                          <span className="aurora-installment-option__price">
                            {formatCurrency(total)}
                          </span>
                          <span className="aurora-installment-option__caption">Charged today</span>
                        </button>

                        {installmentOptions.map((item) => (
                          <button
                            key={item.months}
                            type="button"
                            className={`aurora-installment-option${String(item.months) === selectedInstallments ? ' is-selected' : ''}`}
                            onClick={() => setSelectedInstallments(String(item.months))}
                            aria-pressed={String(item.months) === selectedInstallments}
                          >
                            <span className="aurora-installment-option__meta">Flexible plan</span>
                            <span className="aurora-installment-option__title">
                              {item.months} installments
                            </span>
                            <span className="aurora-installment-option__price">
                              {formatCurrency(item.permonth)}
                              <span className="aurora-installment-option__price-unit"> / month</span>
                            </span>
                            <span className="aurora-installment-option__caption">
                              Total {formatCurrency(item.total)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="mt-2">No installment options were returned for this card.</p>
                  )}
                </div>
              ) : null}

              {errors.payment ? (
                <p className="sm:col-span-2 text-sm font-medium text-[var(--aurora-text-strong)]">
                  {errors.payment}
                </p>
              ) : null}
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
                        {getDeliveryFullName(delivery)}
                      </span>
                      <br />
                      {delivery.email}
                      {getDeliveryAddressLines(delivery).map((line) => (
                        <span key={line}>
                          <br />
                          {line}
                        </span>
                      ))}
                      <br />
                      {delivery.district}, {delivery.province} {delivery.postalCode}
                    </p>
                  </div>
                </div>
              </div>

              <div className="aurora-showroom-subpanel p-6">
                <div className="aurora-widget-body">
                  <div className="aurora-widget-heading">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      Billing summary
                    </p>
                  </div>
                  <div className="aurora-widget-subsurface p-5">
                    {useShippingAsBilling ? (
                      <p className="text-sm leading-8 text-[var(--aurora-text)]">
                        Same as shipping address.
                      </p>
                    ) : (
                      <p className="text-sm leading-8 text-[var(--aurora-text)]">
                        <span className="font-semibold text-[var(--aurora-text-strong)]">
                          {getAddressFullName(billing)}
                        </span>
                        {getAddressLines(billing).map((line) => (
                          <span key={line}>
                            <br />
                            {line}
                          </span>
                        ))}
                        <br />
                        {billing.district}, {billing.province} {billing.postalCode}
                        <br />
                        {billing.phone}
                      </p>
                    )}
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
                        {activePaymentSummary.cardholder || 'Payment method'}
                      </span>
                      <br />
                      {activePaymentSummary.maskedCardNumber}
                      {!selectedSavedCardId && activePaymentSummary.expiry ? (
                        <>
                          <br />
                          Expires {activePaymentSummary.expiry}
                        </>
                      ) : null}
                      {activePaymentSummary.installmentLabel ? (
                        <>
                          <br />
                          {activePaymentSummary.installmentLabel}
                          <br />
                          {activeInstallmentDescription}
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
              </div>

              {errors.payment ? (
                <div className="aurora-message aurora-message-error">
                  {errors.payment}
                </div>
              ) : null}

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
                          {renderCartItemOptions(item)}
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
                    {submittedOrder.delivery.district || submittedOrder.delivery.city}
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
                  disabled={paymentBusy}
                  size="hero"
                >
                  {paymentBusy ? 'Submitting order' : 'Place order'}
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
                    {renderCartItemOptions(item)}
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
                : 'Review the current cart, delivery details, and payment method before sending the order to the payment endpoint.'}
            </div>
          </div>
        </aside>
      </section>
    </StorefrontLayout>
  )
}
