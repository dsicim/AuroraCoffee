import { useEffect, useState } from 'react'
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
  fetchSavedAddresses,
  getSavedAddresses,
  saveSavedAddress,
  setDefaultSavedAddress,
} from '../lib/addressBook'
import {
  validateCityPostalCode,
  validateEmail,
  validateTurkishCity,
} from '../lib/validation'

const initialFormState = {
  id: '',
  label: '',
  firstName: '',
  lastName: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  province: '',
  district: '',
  postalCode: '',
  phone: '',
  isDefault: false,
}

function validateAddressForm(form) {
  const errors = {}

  if (!form.firstName.trim()) {
    errors.firstName = 'First name is required'
  }

  if (!form.lastName.trim()) {
    errors.lastName = 'Last name is required'
  }

  const emailValidation = validateEmail(form.email)
  if (!emailValidation.s) {
    errors.email = emailValidation.e
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
  const [addresses, setAddresses] = useState(() => getSavedAddresses())
  const [form, setForm] = useState(initialFormState)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const syncAddresses = () => {
      void (async () => {
        await fetchSavedAddresses({ force: true })
        setAddresses(getSavedAddresses())
      })()
    }

    window.addEventListener('storage', syncAddresses)
    window.addEventListener(addressBookChangeEvent, syncAddresses)
    const initialSyncId = window.setTimeout(syncAddresses, 0)

    return () => {
      window.removeEventListener('storage', syncAddresses)
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

  const handleEdit = (address) => {
    setForm({
      id: address.id,
      label: address.label || '',
      firstName: address.firstName || '',
      lastName: address.lastName || '',
      email: address.email,
      addressLine1: address.addressLine1 || '',
      addressLine2: address.addressLine2 || '',
      province: address.province || '',
      district: address.district || '',
      postalCode: address.postalCode,
      phone: address.phone || '',
      isDefault: Boolean(address.isDefault),
    })
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
      description="Build an address book for faster checkout. A default address can prefill delivery details automatically, and any saved address can be applied during checkout."
    >
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
              <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
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
              <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
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
              <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
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
              <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                Email
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                className="aurora-input"
              />
              {renderFieldError('email')}
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
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
              <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
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
              <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
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
              <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
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
              <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
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
              <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
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

            <label className="glass-toggle sm:col-span-2">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(event) => handleChange('isDefault', event.target.checked)}
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
              <span className="toggle-label">Set as default checkout address</span>
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
            {addresses.length} saved address{addresses.length === 1 ? '' : 'es'}
          </h2>

          {!addresses.length ? (
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
                          {address.label || address.fullName}
                        </p>
                        {address.isDefault ? (
                          <span className="rounded-full border border-[rgba(138,144,119,0.26)] bg-[rgba(230,232,222,0.48)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--aurora-olive-deep)]">
                            Default
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm leading-8 text-[var(--aurora-text)]">
                        <span className="font-semibold text-[var(--aurora-text-strong)]">
                          {address.fullName}
                        </span>
                        <br />
                        {address.email}
                        <br />
                        {address.addressLine1}
                        {address.addressLine2 ? (
                          <>
                            <br />
                            {address.addressLine2}
                          </>
                        ) : null}
                        <br />
                        {address.district}, {address.province} {address.postalCode}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!address.isDefault ? (
                        <LiquidGlassButton
                          type="button"
                          variant="soft"
                          size="compact"
                          onClick={() => setAddresses(setDefaultSavedAddress(address.id))}
                        >
                          Make default
                        </LiquidGlassButton>
                      ) : null}
                      <LiquidGlassButton
                        type="button"
                        onClick={() => handleEdit(address)}
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
