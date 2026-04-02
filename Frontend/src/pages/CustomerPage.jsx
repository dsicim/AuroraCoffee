import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import {
  accountDataChangeEvent,
  getDefaultSavedAddress,
  getFavoriteProductIds,
  getOrderHistory,
  getSavedAddresses,
} from '../lib/accountData'
import {
  addDefaultProductToCart,
  buildRestoreMessage,
  getOrderStatus,
  restoreOrderItemsToCart,
} from '../lib/accountActions'
import { cartChangeEvent, getCartCount, getCartItems, getCartSubtotal } from '../lib/cart'
import { formatCurrency } from '../lib/currency'
import { useProductCatalog } from '../lib/products'

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
  const [cartItems, setCartItems] = useState(() => getCartItems())
  const [cartCount, setCartCount] = useState(() => getCartCount())
  const [cartSubtotal, setCartSubtotal] = useState(() => getCartSubtotal())
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const syncAccountState = () => {
      setOrders(getOrderHistory())
      setAddresses(getSavedAddresses())
      setFavoriteIds(getFavoriteProductIds())
    }

    const syncCartState = () => {
      setCartItems(getCartItems())
      setCartCount(getCartCount())
      setCartSubtotal(getCartSubtotal())
    }

    window.addEventListener('storage', syncAccountState)
    window.addEventListener(accountDataChangeEvent, syncAccountState)
    window.addEventListener(cartChangeEvent, syncCartState)
    const initialSyncId = window.setTimeout(() => {
      syncAccountState()
      syncCartState()
    }, 0)

    return () => {
      window.removeEventListener('storage', syncAccountState)
      window.removeEventListener(accountDataChangeEvent, syncAccountState)
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

      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          <section className="aurora-summary-strip">
            <div className="aurora-summary-lead p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="aurora-kicker">Customer snapshot</p>
                  <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                    {mostRecentOrder ? currentStatus : 'No order yet'}
                  </h2>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  {mostRecentOrder
                    ? `${mostRecentOrder.reference} is currently ${currentStatus?.toLowerCase()}.`
                    : 'Place your first order to start tracking it here.'}
                </p>
              </div>
            </div>

            <div className="aurora-summary-card p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Cart
                  </p>
                  <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                    {cartCount} item{cartCount === 1 ? '' : 's'}
                  </p>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  {cartCount
                    ? `${formatCurrency(cartSubtotal)} ready for checkout.`
                    : 'Your cart is ready for the next coffee you add.'}
                </p>
              </div>
            </div>

            <div className="aurora-summary-card p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Favorites
                  </p>
                  <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                    {favoriteIds.length}
                  </p>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  Return to your saved coffees and add a package fast.
                </p>
              </div>
            </div>

            <div className="aurora-summary-card p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Default address
                  </p>
                  <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                    {defaultAddress ? defaultAddress.label || 'Ready' : 'Missing'}
                  </p>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  {defaultAddress
                    ? `${defaultAddress.city}, ${defaultAddress.postalCode}`
                    : 'Add a default address to speed up checkout.'}
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
                  What do you want to do next?
                </h2>
              </div>
              <Link
                to="/account"
                className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
              >
                Open account tools
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
                Open cart
              </LiquidGlassButton>
              <LiquidGlassButton
                as={Link}
                to="/account/orders"
                variant="quiet"
              >
                Order history
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
                  Reorder latest order
                </LiquidGlassButton>
              ) : null}
            </div>
          </section>

          <section className="aurora-ops-panel p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Favorites at a glance
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Saved products ready to return
                </h2>
              </div>
              <Link
                to="/account/favorites"
                className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
              >
                View all favorites
              </Link>
            </div>

            {!favoriteProducts.length ? (
              <p className="mt-6 text-sm leading-7 text-[var(--aurora-text)]">
                Save a few products from the catalog and they will appear here with one-click add shortcuts.
              </p>
            ) : (
              <div className="mt-8 grid gap-4 lg:grid-cols-3">
                {favoriteProducts.map((product) => (
                  <div
                    key={product.slug}
                    className="aurora-ops-card p-5"
                  >
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      {product.categoryName || product.parentCategoryName || 'Product'}
                    </p>
                    <h3 className="mt-3 font-display text-2xl text-[var(--aurora-text-strong)]">
                      {product.name}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                      {product.description}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
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
          </section>

          <section className="aurora-ops-panel p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Cart snapshot
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {cartCount ? formatCurrency(cartSubtotal) : 'Empty cart'}
                </h2>
              </div>
              <Link
                to="/cart"
                className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
              >
                Open cart
              </Link>
            </div>

            {cartItems.length ? (
              <div className="mt-6 space-y-3">
                {cartItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
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
            ) : (
              <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                Once you add a few coffees, the latest cart snapshot will appear here for a quick return to checkout.
              </p>
            )}
          </section>
        </div>
      </div>
    </AccountLayout>
  )
}
