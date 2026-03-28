import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import { accountDataChangeEvent, getOrderHistory } from '../lib/accountData'
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

export default function OrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState(() => getOrderHistory())
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const syncOrders = () => {
      setOrders(getOrderHistory())
    }

    window.addEventListener('storage', syncOrders)
    window.addEventListener(accountDataChangeEvent, syncOrders)
    const initialSyncId = window.setTimeout(syncOrders, 0)

    return () => {
      window.removeEventListener('storage', syncOrders)
      window.removeEventListener(accountDataChangeEvent, syncOrders)
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

  const buildRestoreMessage = (result, label) => {
    if (!result.addedCount && result.skippedItems.length) {
      return `Could not restore ${label}. ${result.skippedItems.join(', ')} is no longer available.`
    }

    if (result.skippedItems.length) {
      return `${label} added to cart. Skipped ${result.skippedItems.join(', ')} because it is no longer available.`
    }

    return `${label} added to cart.`
  }

  const handleRestoreOrder = (order, redirectToCart = false) => {
    const result = restoreOrderItemsToCart(order.items)
    setFeedback(buildRestoreMessage(result, order.reference))

    if (redirectToCart && result.addedCount) {
      navigate('/cart')
    }
  }

  const handleRestoreItem = (orderReference, item) => {
    const result = restoreOrderItemsToCart([item])
    setFeedback(buildRestoreMessage(result, `${item.name} from ${orderReference}`))
  }

  return (
    <AccountLayout
      eyebrow="Account orders"
      title="Your order history"
      description="Review completed checkouts, inspect the packages that were placed, and send any available items back into the cart."
    >
      {feedback ? (
        <div className="mb-6 rounded-[1.5rem] border border-[rgba(138,144,119,0.28)] bg-[rgba(230,232,222,0.44)] px-5 py-4 text-sm font-medium text-[var(--aurora-olive-deep)]">
          {feedback}
        </div>
      ) : null}

      {!orders.length ? (
        <div className="rounded-[2.25rem] border border-dashed border-[rgba(138,144,119,0.35)] bg-[rgba(255,247,242,0.72)] px-6 py-12 text-center">
          <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
            No orders yet
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--aurora-text)]">
            Once you complete the demo checkout flow, your submitted orders will
            appear here with totals, package details, and delivery summary.
          </p>
          <Link
            to="/products"
            className="mt-6 inline-flex rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
          >
            Browse coffees
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <article
              key={order.reference}
              className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                    {order.reference}
                  </p>
                  <h2 className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                    Demo order placed
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                    Submitted on {formatTimestamp(order.submittedAt)}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleRestoreOrder(order, true)}
                      className="rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-4 py-2.5 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_10px_24px_rgba(144,180,196,0.22)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
                    >
                      Reorder all
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestoreOrder(order)}
                      className="rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.4)] px-4 py-2.5 text-sm font-semibold text-[var(--aurora-olive-deep)] transition hover:bg-[rgba(230,232,222,0.58)]"
                    >
                      Add items to cart
                    </button>
                  </div>
                </div>
                <span className="rounded-full border border-[rgba(138,144,119,0.26)] bg-[rgba(230,232,222,0.48)] px-4 py-2 text-sm font-semibold text-[var(--aurora-olive-deep)]">
                  {order.items.reduce((total, item) => total + item.quantity, 0)} item
                  {order.items.reduce((total, item) => total + item.quantity, 0) === 1
                    ? ''
                    : 's'}
                </span>
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  {order.items.map((item) => (
                    <div
                      key={`${order.reference}-${item.id}`}
                      className="rounded-[1.75rem] border border-[rgba(138,144,119,0.18)] bg-[rgba(255,247,242,0.94)] px-5 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-[var(--aurora-text-strong)]">
                            {item.name}
                          </p>
                          <p className="mt-1 text-sm text-[var(--aurora-text)]">
                            {item.weight} / {item.grind}
                          </p>
                          <p className="mt-1 text-sm text-[var(--aurora-text)]">
                            Qty {item.quantity}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRestoreItem(order.reference, item)}
                            className="mt-3 text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
                          >
                            Add again
                          </button>
                        </div>
                        <p className="font-semibold text-[var(--aurora-text-strong)]">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.75rem] border border-[rgba(138,144,119,0.18)] bg-[rgba(230,232,222,0.38)] p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      Delivery summary
                    </p>
                    <p className="mt-4 text-sm leading-8 text-[var(--aurora-text)]">
                      <span className="font-semibold text-[var(--aurora-text-strong)]">
                        {order.delivery.fullName}
                      </span>
                      <br />
                      {order.delivery.email}
                      <br />
                      {order.delivery.address}
                      <br />
                      {order.delivery.city}, {order.delivery.postalCode}
                    </p>
                    {order.delivery.notes ? (
                      <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                        Notes: {order.delivery.notes}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-[1.75rem] border border-[rgba(138,144,119,0.18)] bg-[rgba(255,247,242,0.94)] p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      Totals
                    </p>
                    <div className="mt-4 space-y-3 text-sm text-[var(--aurora-text)]">
                      <div className="flex items-center justify-between">
                        <span>Subtotal</span>
                        <span className="font-semibold text-[var(--aurora-text-strong)]">
                          {formatCurrency(order.subtotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Service fee</span>
                        <span className="font-semibold text-[var(--aurora-text-strong)]">
                          {formatCurrency(order.serviceFee)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-[rgba(138,144,119,0.18)] pt-3">
                        <span>Total</span>
                        <span className="font-semibold text-[var(--aurora-text-strong)]">
                          {formatCurrency(order.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AccountLayout>
  )
}
