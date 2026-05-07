import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
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
  getCartErrorMessage,
  getCartCount,
  getCartSubtotal,
  reconcileCartStorageWithAuth,
} from '../lib/cart'
import { commentsChangeEvent, fetchCurrentUserComments } from '../lib/comments'
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

function formatCommentTimestamp(value) {
  const timestamp = Date.parse(value || '')

  if (!Number.isFinite(timestamp)) {
    return 'Time unavailable'
  }

  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatCommentRating(value) {
  if (!value) {
    return 'No rating'
  }

  return `${Number.isInteger(value) ? value : value.toFixed(1)} / 5`
}

function getCustomerCommentStatusCopy(comment) {
  switch (String(comment?.status || '').trim().toLowerCase()) {
    case 'pending':
      return comment?.draftAvailable
        ? 'Awaiting moderation before it appears on the product page.'
        : 'Awaiting moderation. The current API does not return the pending draft text yet.'
    case 'rejected':
      return 'Rejected by moderation. Open the product page to revise and resubmit it.'
    case 'pending_edit':
      return 'A newer edit is in moderation while your approved version stays live on the product page.'
    case 'edit_rejected':
      return 'Your last edit was rejected. The currently approved version is still visible on the product page.'
    default:
      return 'Visible on the product page.'
  }
}

export default function CustomerPage() {
  const { products, loaded: productsLoaded } = useProductCatalog()
  const [orders, setOrders] = useState(() => getOrdersSnapshot().orders)
  const [ordersLoaded, setOrdersLoaded] = useState(() => getOrdersSnapshot().loaded)
  const [addresses, setAddresses] = useState(() => getAddressBookSnapshot().addresses)
  const [addressesLoaded, setAddressesLoaded] = useState(() => getAddressBookSnapshot().loaded)
  const [favoriteIds, setFavoriteIds] = useState(() => getFavoriteProductIds())
  const [cartCount, setCartCount] = useState(() => getCartCount())
  const [cartSubtotal, setCartSubtotal] = useState(() => getCartSubtotal())
  const [feedback, setFeedback] = useState('')
  const [feedbackType, setFeedbackType] = useState('success')
  const [activityTab, setActivityTab] = useState('favorites')
  const [customerComments, setCustomerComments] = useState([])
  const [customerCommentsLoading, setCustomerCommentsLoading] = useState(false)
  const [customerCommentsLoaded, setCustomerCommentsLoaded] = useState(false)
  const [customerCommentsError, setCustomerCommentsError] = useState('')
  const [commentsRefreshKey, setCommentsRefreshKey] = useState(0)

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
    const handleCommentsChange = () => {
      setCommentsRefreshKey((currentValue) => currentValue + 1)
    }

    window.addEventListener(commentsChangeEvent, handleCommentsChange)

    return () => {
      window.removeEventListener(commentsChangeEvent, handleCommentsChange)
    }
  }, [])

  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback('')
      setFeedbackType('success')
    }, 3000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [feedback])

  useEffect(() => {
    let active = true

    if (activityTab !== 'comments') {
      return undefined
    }

    const loadCustomerComments = async () => {
      if (!active) {
        return
      }

      setCustomerCommentsLoading(true)
      setCustomerCommentsLoaded(false)
      setCustomerCommentsError('')

      if (!productsLoaded) {
        return
      }

      try {
        const nextComments = await fetchCurrentUserComments(products)

        if (!active) {
          return
        }

        setCustomerComments(nextComments)
      } catch (loadError) {
        if (!active) {
          return
        }

        setCustomerComments([])
        setCustomerCommentsError(
          loadError instanceof Error ? loadError.message : 'Comments could not be loaded.',
        )
      } finally {
        if (active && productsLoaded) {
          setCustomerCommentsLoading(false)
          setCustomerCommentsLoaded(true)
        }
      }
    }

    void loadCustomerComments()

    return () => {
      active = false
    }
  }, [activityTab, commentsRefreshKey, products, productsLoaded])

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
    let result

    try {
      result = await addDefaultProductToCart(productSlug)
    } catch (error) {
      setFeedbackType('error')
      setFeedback(getCartErrorMessage(error))
      return
    }

    if (result.status === 'added') {
      setFeedbackType('success')
      setFeedback(`Added ${result.product.name} to cart.`)
      return
    }

    if (result.status === 'sold-out') {
      setFeedbackType('error')
      setFeedback(`${result.product.name} is sold out right now.`)
      return
    }

    setFeedbackType('error')
    setFeedback('That coffee is no longer available.')
  }

  return (
    <AccountLayout
      eyebrow="Customer home"
      title="Welcome back to your coffee flow"
      description="Pick up your latest order, jump back into the cart, and get to the coffees you save most often."
    >
      {feedback ? (
        <div
          className={`aurora-message aurora-message-${feedbackType} mb-6`}
          role={feedbackType === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Personal activity
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {activityTab === 'comments' ? 'Your comments' : 'Saved products'}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`aurora-pill ${activityTab === 'favorites' ? 'aurora-pill-active' : ''}`.trim()}
                  onClick={() => {
                    setActivityTab('favorites')
                  }}
                >
                  Favorites
                </button>
                <button
                  type="button"
                  className={`aurora-pill ${activityTab === 'comments' ? 'aurora-pill-active' : ''}`.trim()}
                  onClick={() => {
                    setActivityTab('comments')
                  }}
                >
                  Comments
                </button>
              </div>
            </div>

            {activityTab === 'favorites' ? (
              !favoriteProducts.length ? (
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
              )
            ) : (
              <>
                {customerCommentsError ? (
                  <div className="aurora-message aurora-message-error mt-6">
                    {customerCommentsError}
                  </div>
                ) : null}

                {customerCommentsLoading && !customerCommentsLoaded ? (
                  <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                    Loading the comments you have left across delivered products.
                  </p>
                ) : !customerComments.length ? (
                  <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                    Comments you leave on delivered products will appear here with their current moderation status.
                  </p>
                ) : (
                  <div className="mt-6 space-y-3">
                    {customerComments.map((comment) => (
                      <div key={comment.id} className="aurora-ops-card p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--aurora-text-strong)]">
                              {comment.productName}
                            </p>
                            <p className="mt-1 text-sm text-[var(--aurora-text)]">
                              {[comment.productCategory, formatCommentTimestamp(comment.editedAt || comment.createdAt)]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <span className="aurora-chip text-[11px] tracking-[0.14em]">
                              {comment.statusLabel}
                            </span>
                            {comment.rating ? (
                              <span className="aurora-chip text-[11px] tracking-[0.14em]">
                                {formatCommentRating(comment.rating)}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                          {comment.comment || 'No written comment.'}
                        </p>

                        <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                          {getCustomerCommentStatusCopy(comment)}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <Link
                            to={`/products/${encodeURIComponent(comment.productSlug || String(comment.productId))}`}
                            className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
                          >
                            Open product
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
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
