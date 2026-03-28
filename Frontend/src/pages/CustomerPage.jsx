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
import {
  addDefaultProductToCart,
  buildRestoreMessage,
  getOrderStatus,
  restoreOrderItemsToCart,
} from '../lib/accountActions'
import { cartChangeEvent, getCartCount, getCartItems, getCartSubtotal } from '../lib/cart'
import { products } from '../data/products'

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

export default function CustomerPage() {
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
    () => products.filter((product) => favoriteIds.includes(product.id)).slice(0, 3),
    [favoriteIds],
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

  const handleQuickAddFavorite = (productId) => {
    const result = addDefaultProductToCart(productId)

    if (result.status === 'added') {
      setFeedback(
        `Added ${result.product.name} · ${result.variant.weight} / ${result.variant.grind} to cart.`,
      )
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
        <div className="mb-6 rounded-[1.5rem] border border-[rgba(138,144,119,0.28)] bg-[rgba(230,232,222,0.44)] px-5 py-4 text-sm font-medium text-[var(--aurora-olive-deep)]">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Recent order
              </p>
              <p className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                {mostRecentOrder ? currentStatus : 'None yet'}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                {mostRecentOrder
                  ? `${mostRecentOrder.reference} is currently ${currentStatus?.toLowerCase()}.`
                  : 'Place your first order to start tracking it here.'}
              </p>
            </div>

            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Cart
              </p>
              <p className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                {cartCount} item{cartCount === 1 ? '' : 's'}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                {cartCount
                  ? `${formatCurrency(cartSubtotal)} ready for checkout.`
                  : 'Your cart is ready for the next coffee you add.'}
              </p>
            </div>

            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Favorites
              </p>
              <p className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                {favoriteIds.length}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                Return to your saved coffees and add a package fast.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Default address
              </p>
              <p className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                {defaultAddress ? defaultAddress.label || 'Ready' : 'Missing'}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                {defaultAddress
                  ? `${defaultAddress.city}, ${defaultAddress.postalCode}`
                  : 'Add a default address to speed up checkout.'}
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
                Open cart
              </Link>
              <Link
                to="/account/orders"
                className="rounded-full border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.82)] px-5 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-cream)]"
              >
                Order history
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
                  Reorder latest order
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Favorites at a glance
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Saved coffees ready to return
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
                Save a few coffees from the catalog and they will appear here with one-click package add shortcuts.
              </p>
            ) : (
              <div className="mt-8 grid gap-4 lg:grid-cols-3">
                {favoriteProducts.map((product) => (
                  <div
                    key={product.id}
                    className="rounded-[1.75rem] border border-[rgba(138,144,119,0.2)] bg-[rgba(255,247,242,0.94)] p-5"
                  >
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      {product.roast}
                    </p>
                    <h3 className="mt-3 font-display text-2xl text-[var(--aurora-text-strong)]">
                      {product.name}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                      {product.description}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        to={`/products/${product.id}`}
                        className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
                      >
                        View product
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleQuickAddFavorite(product.id)}
                        className="rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.42)] px-4 py-2.5 text-sm font-semibold text-[var(--aurora-olive-deep)] transition hover:bg-[rgba(230,232,222,0.58)]"
                      >
                        Add default package
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur">
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
                Complete checkout once and the latest order summary will appear here with its current mock delivery stage.
              </p>
            )}
          </section>

          <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur">
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

          <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur">
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
