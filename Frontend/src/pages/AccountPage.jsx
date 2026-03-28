import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import {
  accountDataChangeEvent,
  getDefaultSavedAddress,
  getFavoriteProductIds,
  getOrderHistory,
  getSavedAddresses,
} from '../lib/accountData'
import { restoreOrderItemsToCart } from '../lib/accountActions'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatTimestamp(value) {
  return new Date(value).toLocaleString('en-GB', {
    hour12: false,
  })
}

function buildRestoreMessage(result, label) {
  if (!result.addedCount && result.skippedItems.length) {
    return `Could not restore ${label}. ${result.skippedItems.join(', ')} is no longer available.`
  }

  if (result.skippedItems.length) {
    return `${label} added to cart. Skipped ${result.skippedItems.join(', ')} because it is no longer available.`
  }

  return `${label} added to cart.`
}

export default function AccountPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState(() => getOrderHistory())
  const [addresses, setAddresses] = useState(() => getSavedAddresses())
  const [favoriteIds, setFavoriteIds] = useState(() => getFavoriteProductIds())
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const syncAccountState = () => {
      setOrders(getOrderHistory())
      setAddresses(getSavedAddresses())
      setFavoriteIds(getFavoriteProductIds())
    }

    window.addEventListener('storage', syncAccountState)
    window.addEventListener(accountDataChangeEvent, syncAccountState)
    const initialSyncId = window.setTimeout(syncAccountState, 0)

    return () => {
      window.removeEventListener('storage', syncAccountState)
      window.removeEventListener(accountDataChangeEvent, syncAccountState)
      window.clearTimeout(initialSyncId)
    }
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

  const mostRecentOrder = orders[0] || null
  const defaultAddress = useMemo(
    () => getDefaultSavedAddress() || addresses.find((address) => address.isDefault) || null,
    [addresses],
  )

  const handleReorderLatest = () => {
    if (!mostRecentOrder) {
      return
    }

    const result = restoreOrderItemsToCart(mostRecentOrder.items)
    setFeedback(buildRestoreMessage(result, 'Latest order'))

    if (result.addedCount) {
      navigate('/cart')
    }
  }

  return (
    <AccountLayout
      eyebrow="Customer account"
      title="Your saved coffee corner"
      description="Pick up where you left off with recent orders, saved delivery details, and coffees you marked for later."
    >
      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Orders
              </p>
              <p className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                {orders.length}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                Completed checkouts stored locally in this browser.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Saved addresses
              </p>
              <p className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                {addresses.length}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                {defaultAddress
                  ? `${defaultAddress.label || defaultAddress.fullName} is ready for checkout.`
                  : 'Add a default address to speed up delivery details.'}
              </p>
            </div>

            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Favorites
              </p>
              <p className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                {favoriteIds.length}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                Return to saved coffees and add a package when ready.
              </p>
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Quick actions
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Back to shopping fast
                </h2>
              </div>
              <Link
                to="/products"
                className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
              >
                Browse all coffees
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/products"
                className="rounded-full border border-[#d89270] bg-[var(--aurora-primary)] px-5 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] shadow-[0_10px_24px_rgba(235,176,144,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-primary-soft)]"
              >
                Continue shopping
              </Link>
              <Link
                to="/cart"
                className="rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-5 py-3 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_10px_24px_rgba(144,180,196,0.22)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
              >
                View cart
              </Link>
              <Link
                to="/account/favorites"
                className="rounded-full border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.82)] px-5 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-cream)]"
              >
                Go to favorites
              </Link>
              {mostRecentOrder ? (
                <button
                  type="button"
                  onClick={handleReorderLatest}
                  className="rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.48)] px-5 py-3 text-sm font-semibold text-[var(--aurora-olive-deep)] transition hover:bg-[rgba(230,232,222,0.62)]"
                >
                  Reorder latest
                </button>
              ) : null}
            </div>

            {feedback ? (
              <p className="mt-6 rounded-[1.25rem] border border-[rgba(138,144,119,0.28)] bg-[rgba(230,232,222,0.44)] px-4 py-3 text-sm font-medium text-[var(--aurora-olive-deep)]">
                {feedback}
              </p>
            ) : null}
          </section>
        </div>

        <div className="space-y-8">
          <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Latest order
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {mostRecentOrder ? mostRecentOrder.reference : 'Nothing placed yet'}
                </h2>
              </div>
              {mostRecentOrder ? (
                <Link
                  to="/account/orders"
                  className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
                >
                  View all orders
                </Link>
              ) : null}
            </div>

            {mostRecentOrder ? (
              <>
                <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                  Submitted on {formatTimestamp(mostRecentOrder.submittedAt)} with{' '}
                  {mostRecentOrder.items.reduce((total, item) => total + item.quantity, 0)} item
                  {mostRecentOrder.items.reduce((total, item) => total + item.quantity, 0) === 1 ? '' : 's'} for{' '}
                  <span className="font-semibold text-[var(--aurora-text-strong)]">
                    {formatCurrency(mostRecentOrder.total)}
                  </span>
                  .
                </p>
                <div className="mt-6 space-y-3">
                  {mostRecentOrder.items.slice(0, 3).map((item) => (
                    <div
                      key={`${mostRecentOrder.reference}-${item.id}`}
                      className="rounded-[1.5rem] border border-[rgba(138,144,119,0.18)] bg-[rgba(255,247,242,0.94)] px-4 py-3"
                    >
                      <p className="font-semibold text-[var(--aurora-text-strong)]">
                        {item.name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--aurora-text)]">
                        {item.weight} / {item.grind} · Qty {item.quantity}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                Complete checkout once and the latest order summary will appear here with a direct reorder shortcut.
              </p>
            )}
          </section>

          <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Default address
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {defaultAddress ? defaultAddress.label || 'Checkout ready' : 'Not set'}
                </h2>
              </div>
              <Link
                to="/account/addresses"
                className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
              >
                Manage addresses
              </Link>
            </div>

            {defaultAddress ? (
              <p className="mt-4 text-sm leading-8 text-[var(--aurora-text)]">
                <span className="font-semibold text-[var(--aurora-text-strong)]">
                  {defaultAddress.fullName}
                </span>
                <br />
                {defaultAddress.email}
                <br />
                {defaultAddress.address}
                <br />
                {defaultAddress.city}, {defaultAddress.postalCode}
              </p>
            ) : (
              <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                Save a default delivery address to prefill checkout automatically.
              </p>
            )}
          </section>
        </div>
      </div>
    </AccountLayout>
  )
}
