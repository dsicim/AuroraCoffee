import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import ReviewPrivacyMatrix from '../features/comments/presentation/ReviewPrivacyMatrix'
import {
  buildReviewPrivacyCode,
  buildReviewPrivacySelection,
  buildReviewPrivacySelectionFromCode,
  getReviewPrivacyFallbackMode,
  normalizeReviewPrivacyMode,
  resolveReviewPrivacySelection,
} from '../features/comments/presentation/reviewPrivacy'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
import PasswordField from '../shared/components/ui/PasswordField'
import {
  reconcileAccountStorageWithAuth,
} from '../lib/accountData'
import {
  addressBookChangeEvent,
  fetchSavedAddresses,
  getAddressBookSnapshot,
} from '../lib/addressBook'
import {
  authChangeEvent,
  changeCurrentPassword,
  currentUserChangeEvent,
  getAuthStateSnapshot,
  updateCurrentUserProfile,
} from '../lib/auth'
import {
  fetchOrders,
  getOrdersSnapshot,
  getOrderStatusPresentation,
  ordersChangeEvent,
} from '../lib/orders'
import {
  fetchWishlistItems,
  getWishlistProductReferences,
  wishlistChangeEvent,
} from '../lib/wishlist'
import {
  identityDocumentTypes,
  sanitizePassportNumber,
  sanitizeTaxIdentityNumber,
  sanitizeTurkishIdentityNumber,
  validateIdentityDocument,
  validatePassword,
  validateTurkishIdentityNumber,
} from '../lib/validation'

function getUserDisplayName(user) {
  return user?.displayname || user?.name || ''
}

function getUserPrivacy(user) {
  return user?.privacy || user?.comment_privacy || user?.commentPrivacy || ''
}

function getUserTaxId(user) {
  return user?.taxId || user?.tax_id || ''
}

function getUserIdentityType(user) {
  const taxId = getUserTaxId(user)

  if (!taxId) {
    return identityDocumentTypes.tcKimlik
  }

  return validateTurkishIdentityNumber(taxId).s
    ? identityDocumentTypes.tcKimlik
    : taxId.length === 10 && /^\d+$/.test(taxId)
      ? identityDocumentTypes.taxId
      : identityDocumentTypes.foreignPassport
}

function getPurchaseTypeLabel(identityType) {
  if (identityType === identityDocumentTypes.taxId) {
    return 'Turkish resident business purchase'
  }

  return identityType === identityDocumentTypes.foreignPassport
    ? 'Foreign citizen passport'
    : 'Turkish resident personal purchase'
}

function getAccountErrorMessage(error, fallback) {
  const message = String(error?.message || '').trim()
  return message || fallback
}

function formatTimestamp(value) {
  const timestamp = Date.parse(value || '')

  if (!Number.isFinite(timestamp)) {
    return 'Time unavailable'
  }

  return new Date(timestamp).toLocaleString('en-GB', {
    hour12: false,
  })
}

export default function AccountPage() {
  const [authState, setAuthState] = useState(() => getAuthStateSnapshot())
  const [orders, setOrders] = useState(() => getOrdersSnapshot().orders)
  const [ordersLoaded, setOrdersLoaded] = useState(() => getOrdersSnapshot().loaded)
  const [addresses, setAddresses] = useState(() => getAddressBookSnapshot().addresses)
  const [addressesLoaded, setAddressesLoaded] = useState(() => getAddressBookSnapshot().loaded)
  const [favoriteIds, setFavoriteIds] = useState(() => getWishlistProductReferences())
  const currentUser = authState.user
  const [profileName, setProfileName] = useState(() => getUserDisplayName(currentUser))
  const [profileTaxId, setProfileTaxId] = useState(() => getUserTaxId(currentUser))
  const [profileIdentityType, setProfileIdentityType] = useState(() =>
    getUserIdentityType(currentUser),
  )
  const [profilePrivacySelection, setProfilePrivacySelection] = useState(() =>
    buildReviewPrivacySelectionFromCode(
      getUserPrivacy(currentUser),
      getUserDisplayName(currentUser),
    ),
  )
  const [profilePrivacyMenuOpen, setProfilePrivacyMenuOpen] = useState(true)
  const [profileFeedback, setProfileFeedback] = useState('')
  const [profileFeedbackType, setProfileFeedbackType] = useState('success')
  const [profileSaving, setProfileSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmNextPassword, setConfirmNextPassword] = useState('')
  const [passwordFeedback, setPasswordFeedback] = useState('')
  const [passwordFeedbackType, setPasswordFeedbackType] = useState('success')
  const [passwordSaving, setPasswordSaving] = useState(false)

  useEffect(() => {
    let active = true

    const syncAuthState = () => {
      if (!active) {
        return
      }

      setAuthState(getAuthStateSnapshot())
    }

    const syncRemoteState = () => {
      if (!active) {
        return
      }

      const orderSnapshot = getOrdersSnapshot()
      const addressSnapshot = getAddressBookSnapshot()

      setOrders(orderSnapshot.orders)
      setOrdersLoaded(orderSnapshot.loaded)
      setAddresses(addressSnapshot.addresses)
      setAddressesLoaded(addressSnapshot.loaded)
    }

    const syncWishlistState = () => {
      if (!active) {
        return
      }

      setFavoriteIds(getWishlistProductReferences())
    }

    const loadAccountState = async () => {
      reconcileAccountStorageWithAuth()
      syncAuthState()
      syncWishlistState()
      syncRemoteState()
      await Promise.allSettled([fetchOrders(), fetchSavedAddresses(), fetchWishlistItems()])

      if (!active) {
        return
      }

      syncWishlistState()
      syncRemoteState()
    }

    window.addEventListener('storage', loadAccountState)
    window.addEventListener(authChangeEvent, loadAccountState)
    window.addEventListener(currentUserChangeEvent, syncAuthState)
    window.addEventListener(addressBookChangeEvent, syncRemoteState)
    window.addEventListener(ordersChangeEvent, syncRemoteState)
    window.addEventListener(wishlistChangeEvent, syncWishlistState)
    void loadAccountState()

    return () => {
      active = false
      window.removeEventListener('storage', loadAccountState)
      window.removeEventListener(authChangeEvent, loadAccountState)
      window.removeEventListener(currentUserChangeEvent, syncAuthState)
      window.removeEventListener(addressBookChangeEvent, syncRemoteState)
      window.removeEventListener(ordersChangeEvent, syncRemoteState)
      window.removeEventListener(wishlistChangeEvent, syncWishlistState)
    }
  }, [])

  useEffect(() => {
    const nextProfileName = getUserDisplayName(currentUser)

    setProfileName(nextProfileName)
    setProfileTaxId(getUserTaxId(currentUser))
    setProfileIdentityType(getUserIdentityType(currentUser))
    setProfilePrivacySelection(
      buildReviewPrivacySelectionFromCode(getUserPrivacy(currentUser), nextProfileName),
    )
    setProfilePrivacyMenuOpen(true)
  }, [currentUser])

  const mostRecentOrder = ordersLoaded ? orders[0] || null : null
  const mostRecentOrderStatus = mostRecentOrder
    ? getOrderStatusPresentation(mostRecentOrder)
    : null
  const hasSavedAddresses = addressesLoaded && addresses.length > 0
  const latestOrderPath = mostRecentOrder
    ? `/account/orders/${encodeURIComponent(mostRecentOrder.id)}`
    : '/account/orders'
  const handleProfileSubmit = async (event) => {
    event.preventDefault()

    const trimmedName = profileName.trim()
    const profilePrivacyCode = buildReviewPrivacyCode(profilePrivacySelection, trimmedName)

    if (!trimmedName) {
      setProfileFeedback('Display name is required.')
      setProfileFeedbackType('error')
      return
    }

    if (!profilePrivacyCode) {
      setProfileFeedback('Choose how your display name should appear.')
      setProfileFeedbackType('error')
      return
    }

    const identityValidation = validateIdentityDocument(profileTaxId, profileIdentityType)

    if (!identityValidation.s) {
      setProfileFeedback(identityValidation.e)
      setProfileFeedbackType('error')
      return
    }

    setProfileSaving(true)
    setProfileFeedback('')

    try {
      await updateCurrentUserProfile({
        name: trimmedName,
        privacy: profilePrivacyCode,
        taxId: identityValidation.value,
      })
      setProfileFeedback('Profile updated.')
      setProfileFeedbackType('success')
    } catch (error) {
      setProfileFeedback(getAccountErrorMessage(error, 'Profile could not be updated.'))
      setProfileFeedbackType('error')
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()

    if (!currentPassword || !nextPassword || !confirmNextPassword) {
      setPasswordFeedback('Fill in all password fields.')
      setPasswordFeedbackType('error')
      return
    }

    if (nextPassword !== confirmNextPassword) {
      setPasswordFeedback('New passwords do not match.')
      setPasswordFeedbackType('error')
      return
    }

    const passwordValidation = validatePassword(nextPassword, [
      currentUser?.email,
      getUserDisplayName(currentUser),
    ])

    if (!passwordValidation.s) {
      setPasswordFeedback(passwordValidation.e)
      setPasswordFeedbackType('error')
      return
    }

    setPasswordSaving(true)
    setPasswordFeedback('')

    try {
      await changeCurrentPassword({
        currentPassword,
        nextPassword,
      })
      setCurrentPassword('')
      setNextPassword('')
      setConfirmNextPassword('')
      setPasswordFeedback('Password updated. Your active session was refreshed.')
      setPasswordFeedbackType('success')
    } catch (error) {
      setPasswordFeedback(getAccountErrorMessage(error, 'Password could not be updated.'))
      setPasswordFeedbackType('error')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <AccountLayout
      eyebrow="Account"
      title="Your coffee account"
      description="Track recent orders, manage delivery details, and keep favorite products ready for the next checkout."
    >
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="min-w-0 space-y-8">
          <section className="aurora-ops-panel p-8">
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Profile
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Display identity
                </h2>
              </div>
            </div>

            <form className="mt-6 grid gap-5" onSubmit={handleProfileSubmit}>
              <label className="block">
                <span className="aurora-field-label">Display name</span>
                <input
                  type="text"
                  name="displayName"
                  autoComplete="name"
                  value={profileName}
                  onChange={(event) => {
                    const nextProfileName = event.target.value

                    setProfileName(nextProfileName)
                    setProfilePrivacySelection((currentSelection) =>
                      resolveReviewPrivacySelection(
                        currentSelection,
                        nextProfileName,
                        getReviewPrivacyFallbackMode(currentSelection),
                      ),
                    )
                    setProfileFeedback('')
                  }}
                  className="aurora-input"
                />
              </label>

              <fieldset className="grid gap-3">
                <legend className="aurora-field-label">Identity document</legend>
                <div className="aurora-segmented-control">
                  {[
                    { value: 'turkishResident', label: 'Turkish resident' },
                    { value: identityDocumentTypes.foreignPassport, label: 'Foreign citizen' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`aurora-segmented-option${
                        (option.value === 'turkishResident'
                          ? profileIdentityType !== identityDocumentTypes.foreignPassport
                          : profileIdentityType === option.value)
                          ? ' is-selected'
                          : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="identityResidency"
                        value={option.value}
                        checked={
                          option.value === 'turkishResident'
                            ? profileIdentityType !== identityDocumentTypes.foreignPassport
                            : profileIdentityType === option.value
                        }
                        onChange={() => {
                          const nextType =
                            option.value === 'turkishResident'
                              ? identityDocumentTypes.tcKimlik
                              : identityDocumentTypes.foreignPassport
                          setProfileIdentityType(nextType)
                          setProfileTaxId((currentValue) =>
                            nextType === identityDocumentTypes.tcKimlik
                              ? sanitizeTurkishIdentityNumber(currentValue)
                              : sanitizePassportNumber(currentValue),
                          )
                          setProfileFeedback('')
                        }}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                {profileIdentityType !== identityDocumentTypes.foreignPassport && (
                  <div className="aurora-segmented-control">
                    {[
                      { value: identityDocumentTypes.tcKimlik, label: 'Personal' },
                      { value: identityDocumentTypes.taxId, label: 'Business' },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`aurora-segmented-option${
                          profileIdentityType === option.value ? ' is-selected' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="identityType"
                          value={option.value}
                          checked={profileIdentityType === option.value}
                          onChange={() => {
                            setProfileIdentityType(option.value)
                            setProfileTaxId((currentValue) =>
                              option.value === identityDocumentTypes.tcKimlik
                                ? sanitizeTurkishIdentityNumber(currentValue)
                                : sanitizeTaxIdentityNumber(currentValue),
                            )
                            setProfileFeedback('')
                          }}
                          className="sr-only"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>

              <label className="block">
                <span className="aurora-field-label">
                  {profileIdentityType === identityDocumentTypes.tcKimlik
                    ? 'T.C. Kimlik No'
                    : profileIdentityType === identityDocumentTypes.taxId
                      ? 'Tax ID'
                      : 'Passport number'}
                </span>
                <input
                  type="text"
                  name="taxId"
                  autoComplete="off"
                  value={profileTaxId}
                  inputMode={
                    profileIdentityType === identityDocumentTypes.foreignPassport
                      ? 'text'
                      : 'numeric'
                  }
                  maxLength={
                    profileIdentityType === identityDocumentTypes.tcKimlik
                      ? 11
                      : profileIdentityType === identityDocumentTypes.taxId
                        ? 10
                        : 9
                  }
                  onChange={(event) => {
                    setProfileTaxId(
                      profileIdentityType === identityDocumentTypes.tcKimlik
                        ? sanitizeTurkishIdentityNumber(event.target.value)
                        : profileIdentityType === identityDocumentTypes.taxId
                          ? sanitizeTaxIdentityNumber(event.target.value)
                          : sanitizePassportNumber(event.target.value),
                    )
                    setProfileFeedback('')
                  }}
                  className="aurora-input"
                />
                <span className="mt-2 block text-sm leading-6 text-[var(--aurora-text-muted)]">
                  {getPurchaseTypeLabel(profileIdentityType)} will be used for checkout and invoices.
                </span>
              </label>

              <div>
                <span className="aurora-field-label">Name visibility</span>
                <ReviewPrivacyMatrix
                  displayName={profileName}
                  selection={profilePrivacySelection}
                  open={profilePrivacyMenuOpen}
                  disabled={profileSaving}
                  onToggle={setProfilePrivacyMenuOpen}
                  onToggleAll={(mode) => {
                    setProfilePrivacySelection(buildReviewPrivacySelection(profileName, mode))
                    setProfileFeedback('')
                  }}
                  onChange={(wordIndex, mode) => {
                    setProfilePrivacySelection((currentSelection) => {
                      const nextSelection = resolveReviewPrivacySelection(
                        currentSelection,
                        profileName,
                      )
                      nextSelection[wordIndex] = normalizeReviewPrivacyMode(mode)
                      return nextSelection
                    })
                    setProfileFeedback('')
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <LiquidGlassButton type="submit" disabled={profileSaving}>
                  {profileSaving ? 'Saving...' : 'Save profile'}
                </LiquidGlassButton>
                {profileFeedback ? (
                  <p
                    className={`aurora-message aurora-message-${profileFeedbackType}`}
                    role={profileFeedbackType === 'error' ? 'alert' : 'status'}
                  >
                    {profileFeedback}
                  </p>
                ) : null}
              </div>
            </form>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="aurora-summary-lead p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="aurora-kicker">Orders</p>
                  <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                    {ordersLoaded ? orders.length : '—'}
                  </h2>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  {mostRecentOrder
                    ? 'Latest order ready to review'
                    : ordersLoaded
                      ? 'No orders yet'
                      : 'Loading latest order'}
                </p>
              </div>
            </div>

            <div className="aurora-summary-card p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Saved addresses
                  </p>
                  <p className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                    {addressesLoaded ? addresses.length : '—'}
                  </p>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  {hasSavedAddresses
                    ? 'Ready for checkout'
                    : addressesLoaded
                      ? 'No saved addresses yet'
                      : 'Loading saved addresses'}
                </p>
              </div>
            </div>

            <div className="aurora-summary-card p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Favorites
                  </p>
                  <p className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                    {favoriteIds.length}
                  </p>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  Saved for later
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-8">
          <section className="aurora-ops-panel p-8">
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Security
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Change password
                </h2>
              </div>
            </div>

            <form className="mt-6 grid gap-5" onSubmit={handlePasswordSubmit}>
              <PasswordField
                id="account-current-password"
                label="Current password"
                name="currentPassword"
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value)
                  setPasswordFeedback('')
                }}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
              <PasswordField
                id="account-next-password"
                label="New password"
                name="nextPassword"
                value={nextPassword}
                onChange={(event) => {
                  setNextPassword(event.target.value)
                  setPasswordFeedback('')
                }}
                placeholder="Enter new password"
                autoComplete="new-password"
              />
              <PasswordField
                id="account-confirm-next-password"
                label="Confirm new password"
                name="confirmNextPassword"
                value={confirmNextPassword}
                onChange={(event) => {
                  setConfirmNextPassword(event.target.value)
                  setPasswordFeedback('')
                }}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />

              <div className="flex flex-wrap items-center gap-3">
                <LiquidGlassButton type="submit" disabled={passwordSaving}>
                  {passwordSaving ? 'Updating...' : 'Update password'}
                </LiquidGlassButton>
                {passwordFeedback ? (
                  <p
                    className={`aurora-message aurora-message-${passwordFeedbackType}`}
                    role={passwordFeedbackType === 'error' ? 'alert' : 'status'}
                  >
                    {passwordFeedback}
                  </p>
                ) : null}
              </div>
            </form>
          </section>

          <section className="aurora-ops-panel p-8">
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Latest order
                </p>
                <h2 className="aurora-break-token mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {mostRecentOrder
                    ? mostRecentOrder.id
                    : ordersLoaded
                      ? 'No orders yet'
                      : 'Loading orders'}
                </h2>
              </div>
              <Link
                to={latestOrderPath}
                className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
              >
                {mostRecentOrder ? 'Open order' : 'View orders'}
              </Link>
            </div>

            {mostRecentOrder ? (
              <>
                <div className="aurora-widget-subsurface mt-4 p-5">
                  <p className="text-sm leading-7 text-[var(--aurora-text)]">
                    Submitted on {formatTimestamp(mostRecentOrder.submittedAt)}.
                  </p>
                  <div className="mt-4">
                    <span className={`aurora-order-status-chip is-${mostRecentOrderStatus.key}`}>
                      {mostRecentOrderStatus.label}
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <LiquidGlassButton
                    as={Link}
                    to={latestOrderPath}
                    variant="soft"
                  >
                    Open latest order
                  </LiquidGlassButton>
                  <LiquidGlassButton
                    as={Link}
                    to="/account/orders"
                    variant="secondary"
                  >
                    View all orders
                  </LiquidGlassButton>
                </div>
              </>
            ) : (
              <>
                <div className="aurora-widget-subsurface mt-4 p-5">
                  <p className="text-sm leading-7 text-[var(--aurora-text)]">
                    {ordersLoaded
                      ? 'No backend orders are available on this account yet.'
                      : 'Loading the latest backend order for this account.'}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <LiquidGlassButton as={Link} to="/products">
                    Browse products
                  </LiquidGlassButton>
                  <LiquidGlassButton as={Link} to="/cart" variant="secondary">
                    View cart
                  </LiquidGlassButton>
                </div>
              </>
            )}
          </section>

          <section className="aurora-ops-panel p-8">
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Saved addresses
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {hasSavedAddresses
                    ? 'Available'
                    : addressesLoaded
                      ? 'Not set'
                      : 'Loading'}
                </h2>
              </div>
              <Link
                to="/account/addresses"
                className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
              >
                Manage addresses
              </Link>
            </div>

            {hasSavedAddresses ? (
              <div className="aurora-widget-subsurface mt-4 p-5">
                <p className="text-sm leading-8 text-[var(--aurora-text)]">
                  {addresses.length} saved address
                  {addresses.length === 1 ? '' : 'es'} are ready for checkout when you need them.
                </p>
              </div>
            ) : !addressesLoaded ? (
              <div className="aurora-widget-subsurface mt-4 p-5">
                <p className="text-sm leading-8 text-[var(--aurora-text)]">
                  Loading saved addresses for this account.
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <LiquidGlassButton as={Link} to="/account/addresses" variant="quiet">
                  Add address
                </LiquidGlassButton>
              </div>
            )}
          </section>
        </div>
      </div>
    </AccountLayout>
  )
}
