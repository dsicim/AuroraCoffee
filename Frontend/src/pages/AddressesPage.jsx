import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import {
  getCityOptions,
  getCityOptionValue,
  sanitizePostalCode,
} from '../lib/address'
import {
  addressBookChangeEvent,
  deleteSavedAddress,
  fetchSavedAddressById,
  fetchSavedAddresses,
  getAddressBookSnapshot,
  saveSavedAddress,
} from '../lib/addressBook'
import { authChangeEvent } from '../lib/auth'
import {
  validateCityPostalCode,
  validateTurkishCity,
} from '../lib/validation'

const initialFormState = {
  id: '',
  label: '',
  firstName: '',
  lastName: '',
  addressLine1: '',
  addressLine2: '',
  province: '',
  district: '',
  postalCode: '',
  phone: '',
}

function validateAddressForm(form) {
  const errors = {}

  if (!form.firstName.trim()) {
    errors.firstName = 'First name is required'
  }

  if (!form.lastName.trim()) {
    errors.lastName = 'Last name is required'
  }

  if (!form.addressLine1.trim()) {
    errors.addressLine1 = 'Address line 1 is required'
  }

  if (!form.phone.trim()) {
    errors.phone = 'Phone is required'
  }

  if (!form.district.trim()) {
    errors.district = 'District is required'
  }

  const cityValidation = validateTurkishCity(form.province)
  if (!cityValidation.s) {
    errors.province = cityValidation.e
  }

  const cityPostalValidation = validateCityPostalCode(form.province, form.postalCode)
  if (!cityPostalValidation.s) {
    if (!errors.province && cityPostalValidation.e === 'Select a valid city from the list') {
      errors.province = cityPostalValidation.e
    } else {
      errors.postalCode = cityPostalValidation.e
    }
  }

  return errors
}

export default function AddressesPage() {
  const location = useLocation()
  const [addresses, setAddresses] = useState(() => getAddressBookSnapshot().addresses)
  const [addressesLoaded, setAddressesLoaded] = useState(() => getAddressBookSnapshot().loaded)
  const [loading, setLoading] = useState(() => !getAddressBookSnapshot().loaded)
  const [form, setForm] = useState(initialFormState)
  const [errors, setErrors] = useState({})
  const returnTo = typeof location.state?.returnTo === 'string' ? location.state.returnTo : ''
  const returnLabel =
    typeof location.state?.returnLabel === 'string' && location.state.returnLabel.trim()
      ? location.state.returnLabel
      : 'Back'

  useEffect(() => {
    let active = true

    const syncAddresses = () => {
      if (!active) {
        return
      }

      const snapshot = getAddressBookSnapshot()
      setAddresses(snapshot.addresses)
      setAddressesLoaded(snapshot.loaded)

      if (snapshot.loaded) {
        setLoading(false)
      }
    }

    const loadAddresses = async () => {
      syncAddresses()

      if (!getAddressBookSnapshot().loaded && active) {
        setLoading(true)
      }

      await fetchSavedAddresses().catch(() => [])

      if (!active) {
        return
      }

      syncAddresses()
      setLoading(false)
    }

    window.addEventListener('storage', loadAddresses)
    window.addEventListener(authChangeEvent, loadAddresses)
    window.addEventListener(addressBookChangeEvent, syncAddresses)
    const initialSyncId = window.setTimeout(loadAddresses, 0)

    return () => {
      active = false
      window.removeEventListener('storage', loadAddresses)
      window.removeEventListener(authChangeEvent, loadAddresses)
      window.removeEventListener(addressBookChangeEvent, syncAddresses)
      window.clearTimeout(initialSyncId)
    }
  }, [])

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
    setErrors((current) => {
      if (field === 'province' || field === 'postalCode') {
        return {
          ...current,
          province: '',
          postalCode: '',
        }
      }

      return {
        ...current,
        [field]: '',
      }
    })
  }

  const resetForm = () => {
    setForm(initialFormState)
    setErrors({})
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    void (async () => {
      const nextErrors = validateAddressForm(form)

      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors)
        return
      }

      try {
        const nextAddresses = await saveSavedAddress(form)
        setAddresses(nextAddresses)
        resetForm()
      } catch (saveError) {
        setErrors((current) => ({
          ...current,
          form: saveError.message || 'Could not save address',
        }))
      }
    })()
  }

  const handleEdit = (addressId) => {
    void (async () => {
      try {
        const address = await fetchSavedAddressById(addressId)

        if (!address) {
          return
        }

        setForm({
          id: address.id,
          label: address.label || '',
          firstName: address.firstName || '',
          lastName: address.lastName || '',
          addressLine1: address.addressLine1 || '',
          addressLine2: address.addressLine2 || '',
          province: address.province || '',
          district: address.district || '',
          postalCode: address.postalCode,
          phone: address.phone || '',
        })
        setErrors({})
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch (loadError) {
        setErrors((current) => ({
          ...current,
          form: loadError.message || 'Could not load address details',
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

  const cityOptions = getCityOptions(form.province)

  return (
    <AccountLayout
      eyebrow="Saved addresses"
      title="Faster checkout starts here"
      description="Build an address book for faster checkout. Any saved address can be applied during checkout or edited here whenever your delivery details change."
    >
      {returnTo ? (
        <div className="mb-6">
          <LiquidGlassButton as={Link} to={returnTo} variant="quiet" size="compact">
            {returnLabel}
          </LiquidGlassButton>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="aurora-ops-panel p-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                {form.id ? 'Edit address' : 'Add address'}
              </p>
              <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                {form.id ? 'Update saved details' : 'Create a new delivery address'}
              </h2>
            </div>
            {form.id ? (
              <LiquidGlassButton
                type="button"
                onClick={resetForm}
                variant="quiet"
              >
                Cancel edit
              </LiquidGlassButton>
            ) : null}
          </div>

          <form className="mt-8 grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit} noValidate>
            <label className="block sm:col-span-2">
              <span className="aurora-field-label">
                Address label
              </span>
              <input
                type="text"
                value={form.label}
                onChange={(event) => handleChange('label', event.target.value)}
                placeholder="Home, Office, Weekend brew station"
                className="aurora-input"
              />
            </label>

            <label className="block">
              <span className="aurora-field-label">
                First name
              </span>
              <input
                type="text"
                value={form.firstName}
                onChange={(event) => handleChange('firstName', event.target.value)}
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
                value={form.lastName}
                onChange={(event) => handleChange('lastName', event.target.value)}
                className="aurora-input"
              />
              {renderFieldError('lastName')}
            </label>

            <label className="block sm:col-span-2">
              <span className="aurora-field-label">
                Address line 1
              </span>
              <input
                type="text"
                value={form.addressLine1}
                onChange={(event) => handleChange('addressLine1', event.target.value)}
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
                value={form.addressLine2}
                onChange={(event) => handleChange('addressLine2', event.target.value)}
                className="aurora-input"
              />
            </label>

            <label className="block">
              <span className="aurora-field-label">
                Province
              </span>
              <select
                value={form.province}
                onChange={(event) => handleChange('province', event.target.value)}
                className="aurora-select"
              >
                <option value="">Select a province</option>
                {cityOptions.map((option) => (
                  <option
                    key={option}
                    value={getCityOptionValue(option)}
                  >
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
                value={form.district}
                onChange={(event) => handleChange('district', event.target.value)}
                className="aurora-input"
              />
              {renderFieldError('district')}
            </label>

            <label className="block">
              <span className="aurora-field-label">
                Phone
              </span>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => handleChange('phone', event.target.value)}
                placeholder="+90 5xx xxx xx xx"
                className="aurora-input"
              />
              {renderFieldError('phone')}
            </label>

            <label className="block">
              <span className="aurora-field-label">
                Postal code
              </span>
              <input
                type="text"
                value={form.postalCode}
                inputMode="numeric"
                maxLength={5}
                onChange={(event) =>
                  handleChange('postalCode', sanitizePostalCode(event.target.value))
                }
                className="aurora-input"
              />
              {renderFieldError('postalCode')}
            </label>

            <LiquidGlassButton
              type="submit"
              variant="secondary"
              size="hero"
              className="sm:col-span-2"
            >
              {form.id ? 'Save address changes' : 'Add saved address'}
            </LiquidGlassButton>

            {errors.form ? (
              <p className="sm:col-span-2 text-sm font-medium text-[var(--aurora-text-strong)]">
                {errors.form}
              </p>
            ) : null}
          </form>
        </section>

        <section className="aurora-ops-panel p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
            Address book
          </p>
          <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
            {addressesLoaded ? addresses.length : '—'} saved address
            {addressesLoaded && addresses.length === 1 ? '' : 'es'}
          </h2>

          {loading && !addressesLoaded ? (
            <div className="aurora-ops-card mt-8 border-dashed px-6 py-10 text-center">
              <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                Loading saved addresses
              </p>
              <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                Pulling the latest saved addresses for this account.
              </p>
            </div>
          ) : !addresses.length ? (
            <div className="aurora-ops-card mt-8 border-dashed px-6 py-10 text-center">
              <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                No saved addresses yet
              </p>
              <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                Save one here and checkout can prefill it the next time you
                place an order.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {addresses.map((address) => (
                <article
                  key={address.id}
                  className="aurora-ops-card p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[var(--aurora-text-strong)]">
                          {address.label || address.summaryTitle || `Address ${address.id}`}
                        </p>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                        {address.summaryDescription || [address.district, address.province].filter(Boolean).join(' / ') || 'Saved address'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <LiquidGlassButton
                        type="button"
                        onClick={() => handleEdit(address.id)}
                        variant="quiet"
                        size="compact"
                      >
                        Edit
                      </LiquidGlassButton>
                      <LiquidGlassButton
                        type="button"
                        variant="danger"
                        size="compact"
                        onClick={() => {
                          void (async () => {
                            const confirmed = window.confirm('Delete this saved address?')

                            if (!confirmed) {
                              return
                            }

                            const nextAddresses = await deleteSavedAddress(address.id)
                            setAddresses(nextAddresses)

                            if (form.id === address.id) {
                              resetForm()
                            }
                          })()
                        }}
                      >
                        Delete
                      </LiquidGlassButton>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AccountLayout>
  )
}
