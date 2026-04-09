import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import { formatCurrency } from '../lib/currency'
import {
  accountDataChangeEvent,
  getFavoriteProductIds,
  getOrderHistory,
} from '../lib/accountData'
import { buildRestoreMessage, restoreOrderItemsToCart } from '../lib/accountActions'
import {
  addressBookChangeEvent,
  fetchSavedAddresses,
  getSavedAddresses,
} from '../lib/addressBook'

function formatTimestamp(value) {
  return new Date(value).toLocaleString('en-GB', {
    hour12: false,
  })
}

export default function AccountPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState(() => getOrderHistory())
  const [addresses, setAddresses] = useState(() => getSavedAddresses())
  const [favoriteIds, setFavoriteIds] = useState(() => getFavoriteProductIds())
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const syncAccountState = () => {
      void (async () => {
        setOrders(getOrderHistory())
        await fetchSavedAddresses({ force: true })
        setAddresses(getSavedAddresses())
        setFavoriteIds(getFavoriteProductIds())
      })()
    }

    window.addEventListener('storage', syncAccountState)
    window.addEventListener(accountDataChangeEvent, syncAccountState)
    window.addEventListener(addressBookChangeEvent, syncAccountState)
    const initialSyncId = window.setTimeout(syncAccountState, 0)

    return () => {
      window.removeEventListener('storage', syncAccountState)
      window.removeEventListener(accountDataChangeEvent, syncAccountState)
      window.removeEventListener(addressBookChangeEvent, syncAccountState)
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
  const hasSavedAddresses = addresses.length > 0

  const handleReorderLatest = async () => {
    if (!mostRecentOrder) {
      return
    }

    const result = await restoreOrderItemsToCart(mostRecentOrder.items)
    setFeedback(buildRestoreMessage(result, 'Latest order'))

    if (result.addedCount) {
      navigate('/cart')
    }
  }

  return (
    <AccountLayout
      eyebrow="Account"
      title="Saved details"
      description="Orders, addresses, and favorites."
    >
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-3">
            <div className="aurora-summary-lead p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="aurora-kicker">Orders</p>
                  <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                    {orders.length}
                  </h2>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  {mostRecentOrder ? mostRecentOrder.reference : 'No orders yet'}
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
                    {addresses.length}
                  </p>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  {hasSavedAddresses ? 'Saved addresses available' : 'No saved addresses yet'}
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
                  Saved products
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="aurora-ops-panel p-8">
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Latest order
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {mostRecentOrder ? mostRecentOrder.reference : 'No orders yet'}
                </h2>
              </div>
              <Link
                to="/account/orders"
                className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
              >
                View orders
              </Link>
            </div>

            {mostRecentOrder ? (
              <>
                <div className="aurora-widget-subsurface mt-4 p-5">
                  <p className="text-sm leading-7 text-[var(--aurora-text)]">
                    Submitted on {formatTimestamp(mostRecentOrder.submittedAt)} with{' '}
                    {mostRecentOrder.items.reduce((total, item) => total + item.quantity, 0)} item
                    {mostRecentOrder.items.reduce((total, item) => total + item.quantity, 0) === 1 ? '' : 's'} for{' '}
                    <span className="font-semibold text-[var(--aurora-text-strong)]">
                      {formatCurrency(mostRecentOrder.total)}
                    </span>
                    .
                  </p>
                </div>
                <div className="aurora-widget-list mt-6">
                  {mostRecentOrder.items.slice(0, 3).map((item) => (
                    <div
                      key={`${mostRecentOrder.reference}-${item.id}`}
                      className="aurora-ops-card px-4 py-3"
                    >
                      <p className="font-semibold text-[var(--aurora-text-strong)]">
                        {item.name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--aurora-text)]">
                        {item.metaLine || item.category || 'Product'} · Qty {item.quantity}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <LiquidGlassButton
                    type="button"
                    variant="soft"
                    onClick={handleReorderLatest}
                  >
                    Reorder latest
                  </LiquidGlassButton>
                  <LiquidGlassButton
                    as={Link}
                    to="/cart"
                    variant="secondary"
                  >
                    View cart
                  </LiquidGlassButton>
                </div>
              </>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3">
                <LiquidGlassButton as={Link} to="/products">
                  Browse products
                </LiquidGlassButton>
                <LiquidGlassButton as={Link} to="/cart" variant="secondary">
                  View cart
                </LiquidGlassButton>
              </div>
            )}
          </section>

          <section className="aurora-ops-panel p-8">
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Saved addresses
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {hasSavedAddresses ? 'Available' : 'Not set'}
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

      {feedback ? (
        <p className="aurora-message aurora-message-success mt-6">
          {feedback}
        </p>
      ) : null}
    </AccountLayout>
  )
}
