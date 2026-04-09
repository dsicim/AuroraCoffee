import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import {
  accountDataChangeEvent,
  getFavoriteProductIds,
} from '../lib/accountData'
import {
  addressBookChangeEvent,
  fetchSavedAddresses,
  getSavedAddresses,
} from '../lib/addressBook'
import { authChangeEvent } from '../lib/auth'
import {
  fetchOrders,
  getCachedOrders,
  getOrderStatusPresentation,
  ordersChangeEvent,
} from '../lib/orders'

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
  const [orders, setOrders] = useState(() => getCachedOrders())
  const [addresses, setAddresses] = useState(() => getSavedAddresses())
  const [favoriteIds, setFavoriteIds] = useState(() => getFavoriteProductIds())

  useEffect(() => {
    let active = true

    const syncAccountState = () => {
      if (!active) {
        return
      }

      setOrders(getCachedOrders())
      setAddresses(getSavedAddresses())
      setFavoriteIds(getFavoriteProductIds())
    }

    const loadAccountState = async () => {
      await Promise.allSettled([fetchOrders(), fetchSavedAddresses()])

      if (!active) {
        return
      }

      syncAccountState()
    }

    window.addEventListener('storage', loadAccountState)
    window.addEventListener(authChangeEvent, loadAccountState)
    window.addEventListener(accountDataChangeEvent, syncAccountState)
    window.addEventListener(addressBookChangeEvent, loadAccountState)
    window.addEventListener(ordersChangeEvent, syncAccountState)
    void loadAccountState()

    return () => {
      active = false
      window.removeEventListener('storage', loadAccountState)
      window.removeEventListener(authChangeEvent, loadAccountState)
      window.removeEventListener(accountDataChangeEvent, syncAccountState)
      window.removeEventListener(addressBookChangeEvent, loadAccountState)
      window.removeEventListener(ordersChangeEvent, syncAccountState)
    }
  }, [])

  const mostRecentOrder = orders[0] || null
  const mostRecentOrderStatus = mostRecentOrder
    ? getOrderStatusPresentation(mostRecentOrder)
    : null
  const hasSavedAddresses = addresses.length > 0
  const latestOrderPath = mostRecentOrder
    ? `/account/orders/${encodeURIComponent(mostRecentOrder.id)}`
    : '/account/orders'

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
                  {mostRecentOrder ? mostRecentOrder.id : 'No orders yet'}
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
                  {mostRecentOrder ? mostRecentOrder.id : 'No orders yet'}
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
    </AccountLayout>
  )
}
