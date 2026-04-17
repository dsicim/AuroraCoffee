import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import {
  accountDataChangeEvent,
  getFavoriteProductIds,
  reconcileAccountStorageWithAuth,
} from '../lib/accountData'
import {
  addressBookChangeEvent,
  fetchSavedAddresses,
  getAddressBookSnapshot,
} from '../lib/addressBook'
import { authChangeEvent } from '../lib/auth'
import {
  fetchOrders,
  getOrdersSnapshot,
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
  const [orders, setOrders] = useState(() => getOrdersSnapshot().orders)
  const [ordersLoaded, setOrdersLoaded] = useState(() => getOrdersSnapshot().loaded)
  const [addresses, setAddresses] = useState(() => getAddressBookSnapshot().addresses)
  const [addressesLoaded, setAddressesLoaded] = useState(() => getAddressBookSnapshot().loaded)
  const [favoriteIds, setFavoriteIds] = useState(() => getFavoriteProductIds())

  useEffect(() => {
    let active = true

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

    const syncLocalState = () => {
      if (!active) {
        return
      }

      setFavoriteIds(getFavoriteProductIds())
    }

    const loadAccountState = async () => {
      reconcileAccountStorageWithAuth()
      syncLocalState()
      syncRemoteState()
      await Promise.allSettled([fetchOrders(), fetchSavedAddresses()])

      if (!active) {
        return
      }

      syncLocalState()
      syncRemoteState()
    }

    window.addEventListener('storage', loadAccountState)
    window.addEventListener(authChangeEvent, loadAccountState)
    window.addEventListener(accountDataChangeEvent, syncLocalState)
    window.addEventListener(addressBookChangeEvent, syncRemoteState)
    window.addEventListener(ordersChangeEvent, syncRemoteState)
    void loadAccountState()

    return () => {
      active = false
      window.removeEventListener('storage', loadAccountState)
      window.removeEventListener(authChangeEvent, loadAccountState)
      window.removeEventListener(accountDataChangeEvent, syncLocalState)
      window.removeEventListener(addressBookChangeEvent, syncRemoteState)
      window.removeEventListener(ordersChangeEvent, syncRemoteState)
    }
  }, [])

  const mostRecentOrder = ordersLoaded ? orders[0] || null : null
  const mostRecentOrderStatus = mostRecentOrder
    ? getOrderStatusPresentation(mostRecentOrder)
    : null
  const hasSavedAddresses = addressesLoaded && addresses.length > 0
  const latestOrderPath = mostRecentOrder
    ? `/account/orders/${encodeURIComponent(mostRecentOrder.id)}`
    : '/account/orders'

  return (
    <AccountLayout
      eyebrow="Account"
      title="Your coffee account"
      description="Track recent orders, manage delivery details, and keep favorite products ready for the next checkout."
    >
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="min-w-0 space-y-8">
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
