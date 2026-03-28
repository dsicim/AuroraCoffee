import { useEffect, useState } from 'react'
import AccountLayout from '../components/AccountLayout'
import {
  accountDataChangeEvent,
  deleteSavedAddress,
  getSavedAddresses,
  saveSavedAddress,
  setDefaultSavedAddress,
} from '../lib/accountData'
import { validateEmail } from '../lib/validation'

const initialFormState = {
  id: '',
  label: '',
  fullName: '',
  email: '',
  address: '',
  city: '',
  postalCode: '',
  notes: '',
  isDefault: false,
}

function validateAddressForm(form) {
  const errors = {}

  if (!form.fullName.trim()) {
    errors.fullName = 'Recipient name is required'
  }

  const emailValidation = validateEmail(form.email)
  if (!emailValidation.s) {
    errors.email = emailValidation.e
  }

  if (!form.address.trim()) {
    errors.address = 'Address is required'
  }

  if (!form.city.trim()) {
    errors.city = 'City is required'
  }

  if (!form.postalCode.trim()) {
    errors.postalCode = 'Postal code is required'
  }

  return errors
}

export default function AddressesPage() {
  const [addresses, setAddresses] = useState(() => getSavedAddresses())
  const [form, setForm] = useState(initialFormState)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const syncAddresses = () => {
      setAddresses(getSavedAddresses())
    }

    window.addEventListener('storage', syncAddresses)
    window.addEventListener(accountDataChangeEvent, syncAddresses)
    const initialSyncId = window.setTimeout(syncAddresses, 0)

    return () => {
      window.removeEventListener('storage', syncAddresses)
      window.removeEventListener(accountDataChangeEvent, syncAddresses)
      window.clearTimeout(initialSyncId)
    }
  }, [])

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
    setErrors((current) => ({
      ...current,
      [field]: '',
    }))
  }

  const resetForm = () => {
    setForm(initialFormState)
    setErrors({})
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const nextErrors = validateAddressForm(form)

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    const nextAddresses = saveSavedAddress(form)
    setAddresses(nextAddresses)
    resetForm()
  }

  const handleEdit = (address) => {
    setForm({
      id: address.id,
      label: address.label || '',
      fullName: address.fullName,
      email: address.email,
      address: address.address,
      city: address.city,
      postalCode: address.postalCode,
      notes: address.notes || '',
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

  return (
    <AccountLayout
      eyebrow="Saved addresses"
      title="Faster checkout starts here"
      description="Build a local address book for the demo storefront. A default address can prefill checkout automatically, and any saved address can be applied during delivery."
    >
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur">
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
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.82)] px-5 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-cream)]"
              >
                Cancel edit
              </button>
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
                className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                Recipient full name
              </span>
              <input
                type="text"
                value={form.fullName}
                onChange={(event) => handleChange('fullName', event.target.value)}
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
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
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
                value={form.address}
                onChange={(event) => handleChange('address', event.target.value)}
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
                value={form.city}
                onChange={(event) => handleChange('city', event.target.value)}
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
                value={form.postalCode}
                onChange={(event) => handleChange('postalCode', event.target.value)}
                className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
              />
              {renderFieldError('postalCode')}
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                Delivery notes
              </span>
              <textarea
                rows="4"
                value={form.notes}
                onChange={(event) => handleChange('notes', event.target.value)}
                className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
              />
            </label>

            <label className="flex items-center gap-3 text-sm font-medium text-[var(--aurora-text-strong)] sm:col-span-2">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(event) => handleChange('isDefault', event.target.checked)}
                className="h-4 w-4 rounded border-[var(--aurora-border)] accent-[var(--aurora-sky)]"
              />
              Set as default checkout address
            </label>

            <button
              type="submit"
              className="sm:col-span-2 rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
            >
              {form.id ? 'Save address changes' : 'Add saved address'}
            </button>
          </form>
        </section>

        <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
            Address book
          </p>
          <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
            {addresses.length} saved address{addresses.length === 1 ? '' : 'es'}
          </h2>

          {!addresses.length ? (
            <div className="mt-8 rounded-[2rem] border border-dashed border-[rgba(138,144,119,0.35)] bg-[rgba(255,247,242,0.72)] px-6 py-10 text-center">
              <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                No saved addresses yet
              </p>
              <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                Save one here and checkout can prefill it the next time you
                place a demo order.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {addresses.map((address) => (
                <article
                  key={address.id}
                  className="rounded-[1.9rem] border border-[rgba(138,144,119,0.2)] bg-[rgba(255,247,242,0.94)] p-5"
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
                        {address.address}
                        <br />
                        {address.city}, {address.postalCode}
                      </p>
                      {address.notes ? (
                        <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                          Notes: {address.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!address.isDefault ? (
                        <button
                          type="button"
                          onClick={() => setAddresses(setDefaultSavedAddress(address.id))}
                          className="rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.36)] px-4 py-2 text-sm font-semibold text-[var(--aurora-olive-deep)] transition hover:bg-[rgba(230,232,222,0.56)]"
                        >
                          Make default
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleEdit(address)}
                        className="rounded-full border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.86)] px-4 py-2 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-cream)]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextAddresses = deleteSavedAddress(address.id)
                          setAddresses(nextAddresses)

                          if (form.id === address.id) {
                            resetForm()
                          }
                        }}
                        className="rounded-full border border-[rgba(217,144,107,0.28)] bg-[rgba(248,227,214,0.62)] px-4 py-2 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[rgba(248,227,214,0.82)]"
                      >
                        Delete
                      </button>
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
