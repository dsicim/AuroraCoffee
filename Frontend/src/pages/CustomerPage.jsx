import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import {
  accountDataChangeEvent,
  getFavoriteProductIds,
  reconcileAccountStorageWithAuth,
} from '../lib/accountData'
import { addDefaultProductToCart } from '../lib/accountActions'
import {
  addressBookChangeEvent,
  fetchSavedAddresses,
  getAddressBookSnapshot,
} from '../lib/addressBook'
import { authChangeEvent } from '../lib/auth'
import {
  cartChangeEvent,
  getCartCount,
  getCartSubtotal,
  reconcileCartStorageWithAuth,
} from '../lib/cart'
import { formatCurrency } from '../lib/currency'
import {
  fetchOrders,
  getOrdersSnapshot,
  getOrderStatusPresentation,
  ordersChangeEvent,
} from '../lib/orders'
import { useProductCatalog } from '../lib/products'

function formatTimestamp(value) {
  const timestamp = Date.parse(value || '')

  if (!Number.isFinite(timestamp)) {
    return 'Time unavailable'
  }

  return new Date(timestamp).toLocaleString('en-GB', {
    hour12: false,
  })
}

export default function CustomerPage() {
  const { products } = useProductCatalog()
  const [orders, setOrders] = useState(() => getOrdersSnapshot().orders)
  const [ordersLoaded, setOrdersLoaded] = useState(() => getOrdersSnapshot().loaded)
  const [addresses, setAddresses] = useState(() => getAddressBookSnapshot().addresses)
  const [addressesLoaded, setAddressesLoaded] = useState(() => getAddressBookSnapshot().loaded)
  const [favoriteIds, setFavoriteIds] = useState(() => getFavoriteProductIds())
  const [cartCount, setCartCount] = useState(() => getCartCount())
  const [cartSubtotal, setCartSubtotal] = useState(() => getCartSubtotal())
  const [feedback, setFeedback] = useState('')

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

    const syncAccountState = () => {
      if (!active) {
        return
      }

      setFavoriteIds(getFavoriteProductIds())
    }

    const syncCartState = () => {
      if (!active) {
        return
      }

      setCartCount(getCartCount())
      setCartSubtotal(getCartSubtotal())
    }

    const loadAccountState = async () => {
      reconcileAccountStorageWithAuth()
      syncAccountState()
      syncRemoteState()
      await Promise.allSettled([
        reconcileCartStorageWithAuth(),
        fetchOrders(),
        fetchSavedAddresses(),
      ])

      if (!active) {
        return
      }

      syncAccountState()
      syncRemoteState()
      syncCartState()
    }

    window.addEventListener('storage', loadAccountState)
    window.addEventListener(authChangeEvent, loadAccountState)
    window.addEventListener(accountDataChangeEvent, syncAccountState)
    window.addEventListener(addressBookChangeEvent, syncRemoteState)
    window.addEventListener(ordersChangeEvent, syncRemoteState)
    window.addEventListener(cartChangeEvent, syncCartState)
    void loadAccountState()

    return () => {
      active = false
      window.removeEventListener('storage', loadAccountState)
      window.removeEventListener(authChangeEvent, loadAccountState)
      window.removeEventListener(accountDataChangeEvent, syncAccountState)
      window.removeEventListener(addressBookChangeEvent, syncRemoteState)
      window.removeEventListener(ordersChangeEvent, syncRemoteState)
      window.removeEventListener(cartChangeEvent, syncCartState)
    }
  }, [])

  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback('')
    }, 3000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [feedback])

  const mostRecentOrder = ordersLoaded ? orders[0] || null : null
  const latestOrderPath = mostRecentOrder
    ? `/account/orders/${encodeURIComponent(mostRecentOrder.id)}`
    : '/account/orders'
  const latestOrderStatus = mostRecentOrder
    ? getOrderStatusPresentation(mostRecentOrder)
    : null
  const hasSavedAddresses = addressesLoaded && addresses.length > 0
  const favoriteProducts = useMemo(
    () => products.filter((product) => favoriteIds.includes(product.slug)).slice(0, 3),
    [favoriteIds, products],
  )

  const handleQuickAddFavorite = async (productSlug) => {
    const result = await addDefaultProductToCart(productSlug)

    if (result.status === 'added') {
      setFeedback(`Added ${result.product.name} to cart.`)
      return
    }

    if (result.status === 'sold-out') {
      setFeedback(`${result.product.name} is sold out right now.`)
      return
    }

    setFeedback('That coffee is no longer available.')
  }

  return (
    <AccountLayout
      eyebrow="Customer home"
      title="Welcome back to your coffee flow"
      description="Pick up your latest order, jump back into the cart, and get to the coffees you save most often."
    >
      {feedback ? (
        <div className="aurora-message aurora-message-success mb-6">
          {feedback}
        </div>
      ) : null}

      <section className="aurora-ops-panel p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
              At a glance
            </p>
            <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
              Keep the next step simple.
            </h2>
          </div>

          <div className="aurora-widget-actions">
            <LiquidGlassButton as={Link} to="/products">
              Continue shopping
            </LiquidGlassButton>
            <LiquidGlassButton as={Link} to="/cart" variant="secondary">
              Open cart
            </LiquidGlassButton>
            {mostRecentOrder ? (
              <LiquidGlassButton as={Link} to={latestOrderPath} variant="soft">
                Open latest order
              </LiquidGlassButton>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="aurora-ops-card p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
              Latest order
            </p>
              <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                {mostRecentOrder
                  ? latestOrderStatus.label
                  : ordersLoaded
                    ? 'No order'
                    : 'Loading'}
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
              {mostRecentOrder
                ? `${mostRecentOrder.id} is the latest backend order on this account.`
                : ordersLoaded
                  ? 'Place your first order and it will appear here.'
                  : 'Loading the latest backend order for this account.'}
              </p>
            </div>

          <div className="aurora-ops-card p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
              Cart
            </p>
            <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
              {cartCount ? formatCurrency(cartSubtotal) : 'Empty'}
            </p>
            <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
              {cartCount
                ? `${cartCount} item${cartCount === 1 ? '' : 's'} ready for checkout.`
                : 'Your cart is ready for the next product you add.'}
            </p>
          </div>

          <div className="aurora-ops-card p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
              Saved addresses
            </p>
              <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                {addressesLoaded ? addresses.length : '—'}
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
              {hasSavedAddresses
                ? 'Saved addresses available'
                : addressesLoaded
                  ? 'No saved addresses yet'
                  : 'Loading saved addresses'}
              </p>
            </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-8">
          <section className="aurora-ops-panel p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Latest order status
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {mostRecentOrder
                    ? latestOrderStatus.label
                    : ordersLoaded
                      ? 'No order yet'
                      : 'Loading orders'}
                </h2>
              </div>
              {mostRecentOrder ? (
                <Link
                  to={latestOrderPath}
                  className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
                >
                  Open order
                </Link>
              ) : null}
            </div>

            {mostRecentOrder ? (
              <>
                <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                  {mostRecentOrder.id} was placed on {formatTimestamp(mostRecentOrder.submittedAt)} and currently shows as{' '}
                  <span className="font-semibold text-[var(--aurora-text-strong)]">
                    {latestOrderStatus.label}
                  </span>
                  .
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <LiquidGlassButton as={Link} to={latestOrderPath} variant="soft">
                    Open order detail
                  </LiquidGlassButton>
                  <LiquidGlassButton as={Link} to="/account/orders" variant="secondary">
                    Order history
                  </LiquidGlassButton>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                {ordersLoaded
                  ? 'Complete checkout once and the latest backend order summary will appear here.'
                  : 'Loading the latest backend order summary for this account.'}
              </p>
            )}
          </section>

          <section className="aurora-ops-panel p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Favorites
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Saved products
                </h2>
              </div>
              <Link
                to="/account/favorites"
                className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
              >
                View all
              </Link>
            </div>

            {!favoriteProducts.length ? (
              <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                Save products from the catalog and they will appear here for a quick return.
              </p>
            ) : (
              <div className="mt-6 space-y-3">
                {favoriteProducts.slice(0, 2).map((product) => (
                  <div key={product.slug} className="aurora-ops-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--aurora-text-strong)]">
                        {product.name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--aurora-text)]">
                        {product.categoryName || product.parentCategoryName || 'Product'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        to={`/products/${product.slug}`}
                        className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
                      >
                        View product
                      </Link>
                      <LiquidGlassButton
                        type="button"
                        variant="soft"
                        size="compact"
                        onClick={() => handleQuickAddFavorite(product.slug)}
                      >
                        Add to cart
                      </LiquidGlassButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section className="aurora-ops-panel p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
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
              <p className="mt-4 text-sm leading-8 text-[var(--aurora-text)]">
                {addresses.length} saved address
                {addresses.length === 1 ? '' : 'es'} are available for checkout.
              </p>
            ) : !addressesLoaded ? (
              <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                Loading saved addresses for this account.
              </p>
            ) : (
              <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                Add a saved address so delivery details can be reused during checkout.
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <LiquidGlassButton as={Link} to="/account/addresses" variant="quiet">
                Manage addresses
              </LiquidGlassButton>
              <LiquidGlassButton as={Link} to="/account/orders" variant="quiet">
                Order history
              </LiquidGlassButton>
            </div>
          </section>
        </div>
      </div>
    </AccountLayout>
  )
}
