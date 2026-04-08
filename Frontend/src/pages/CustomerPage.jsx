import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import {
  accountDataChangeEvent,
  getFavoriteProductIds,
  getOrderHistory,
} from '../lib/accountData'
import {
  addDefaultProductToCart,
  buildRestoreMessage,
  getOrderStatus,
  restoreOrderItemsToCart,
} from '../lib/accountActions'
import {
  cartChangeEvent,
  getCartCount,
  getCartSubtotal,
} from '../lib/cart'
import { formatCurrency } from '../lib/currency'
import { useProductCatalog } from '../lib/products'
import {
  addressBookChangeEvent,
  fetchSavedAddresses,
  getDefaultSavedAddress,
  getSavedAddresses,
} from '../lib/addressBook'

function formatTimestamp(value) {
  return new Date(value).toLocaleString('en-GB', {
    hour12: false,
  })
}

export default function CustomerPage() {
  const { products } = useProductCatalog()
  const navigate = useNavigate()
  const [orders, setOrders] = useState(() => getOrderHistory())
  const [addresses, setAddresses] = useState(() => getSavedAddresses())
  const [favoriteIds, setFavoriteIds] = useState(() => getFavoriteProductIds())
  const [cartCount, setCartCount] = useState(() => getCartCount())
  const [cartSubtotal, setCartSubtotal] = useState(() => getCartSubtotal())
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

    const syncCartState = () => {
      setCartCount(getCartCount())
      setCartSubtotal(getCartSubtotal())
    }

    window.addEventListener('storage', syncAccountState)
    window.addEventListener(accountDataChangeEvent, syncAccountState)
    window.addEventListener(addressBookChangeEvent, syncAccountState)
    window.addEventListener(cartChangeEvent, syncCartState)
    const initialSyncId = window.setTimeout(() => {
      syncAccountState()
      syncCartState()
    }, 0)

    return () => {
      window.removeEventListener('storage', syncAccountState)
      window.removeEventListener(accountDataChangeEvent, syncAccountState)
      window.removeEventListener(addressBookChangeEvent, syncAccountState)
      window.removeEventListener(cartChangeEvent, syncCartState)
      window.clearTimeout(initialSyncId)
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

  const mostRecentOrder = orders[0] || null
  const defaultAddress = useMemo(
    () =>
      getDefaultSavedAddress() ||
      addresses.find((address) => address.isDefault) ||
      null,
    [addresses],
  )
  const favoriteProducts = useMemo(
    () => products.filter((product) => favoriteIds.includes(product.slug)).slice(0, 3),
    [favoriteIds, products],
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

  const currentStatus = mostRecentOrder ? getOrderStatus(mostRecentOrder) : null

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
              <LiquidGlassButton type="button" variant="soft" onClick={handleReorderLatest}>
                Reorder latest
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
              {mostRecentOrder ? currentStatus : 'No order'}
            </p>
            <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
              {mostRecentOrder
                ? `${mostRecentOrder.reference} is the latest order on this account.`
                : 'Place your first order and it will appear here.'}
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
              Saved tools
            </p>
            <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
              {favoriteIds.length} / {defaultAddress ? 'Ready' : 'Add one'}
            </p>
            <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
              {favoriteIds.length} favorite{favoriteIds.length === 1 ? '' : 's'} and{' '}
              {defaultAddress ? 'a default address are in place.' : 'no default address yet.'}
            </p>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-8">
          <section className="aurora-ops-panel p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Latest order status
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {mostRecentOrder ? currentStatus : 'No order yet'}
                </h2>
              </div>
              {mostRecentOrder ? (
                <Link
                  to="/account/orders"
                  className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
                >
                  Track in orders
                </Link>
              ) : null}
            </div>

            {mostRecentOrder ? (
              <>
                <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                  {mostRecentOrder.reference} was placed on {formatTimestamp(mostRecentOrder.submittedAt)} and currently shows as{' '}
                  <span className="font-semibold text-[var(--aurora-text-strong)]">
                    {currentStatus}
                  </span>
                  .
                </p>
                <div className="mt-6 space-y-3">
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
                Complete checkout once and the latest order summary will appear here.
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
                  Checkout readiness
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {defaultAddress ? 'Address ready' : 'Address missing'}
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
                Add a default saved address so delivery details can prefill automatically during checkout.
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
