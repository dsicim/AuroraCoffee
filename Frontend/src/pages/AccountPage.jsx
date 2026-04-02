import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import { formatCurrency } from '../lib/currency'
import {
  accountDataChangeEvent,
  getDefaultSavedAddress,
  getFavoriteProductIds,
  getOrderHistory,
  getSavedAddresses,
} from '../lib/accountData'
import { buildRestoreMessage, restoreOrderItemsToCart } from '../lib/accountActions'

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
      eyebrow="Account tools"
      title="Manage saved shopping details"
      description="Use this area for your deeper customer tools: order history, saved addresses, and favorites built around the shopping experience."
    >
      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          <section className="aurora-summary-strip">
            <div className="aurora-summary-lead p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="aurora-kicker">Account snapshot</p>
                  <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                    {mostRecentOrder ? mostRecentOrder.reference : 'No orders yet'}
                  </h2>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  {mostRecentOrder
                    ? `Latest order totals ${formatCurrency(mostRecentOrder.total)} and stays ready for quick reorder.`
                    : 'Complete checkout once and this area becomes the fastest route back into saved shopping details.'}
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
                  {defaultAddress
                    ? `${defaultAddress.label || defaultAddress.fullName} is ready for checkout.`
                    : 'Add a default address to speed up delivery details.'}
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
                  Return to saved coffees and add a package when ready.
                </p>
              </div>
            </div>
          </section>

          <section className="aurora-ops-panel p-8">
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
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

            <div className="aurora-widget-actions mt-8">
              <LiquidGlassButton
                as={Link}
                to="/products"
              >
                Continue shopping
              </LiquidGlassButton>
              <LiquidGlassButton
                as={Link}
                to="/cart"
                variant="secondary"
              >
                View cart
              </LiquidGlassButton>
              <LiquidGlassButton
                as={Link}
                to="/account/favorites"
                variant="quiet"
              >
                Go to favorites
              </LiquidGlassButton>
              {mostRecentOrder ? (
                <LiquidGlassButton
                  type="button"
                  variant="soft"
                  onClick={handleReorderLatest}
                >
                  Reorder latest
                </LiquidGlassButton>
              ) : null}
            </div>

            {feedback ? (
              <p className="aurora-message aurora-message-success mt-6">
                {feedback}
              </p>
            ) : null}
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
              </>
            ) : (
              <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                Complete checkout once and the latest order summary will appear here with a direct reorder shortcut.
              </p>
            )}
          </section>

          <section className="aurora-ops-panel p-8">
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
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
              <div className="aurora-widget-subsurface mt-4 p-5">
                <p className="text-sm leading-8 text-[var(--aurora-text)]">
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
              </div>
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
