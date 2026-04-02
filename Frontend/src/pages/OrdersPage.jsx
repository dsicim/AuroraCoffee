import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import { accountDataChangeEvent, getOrderHistory } from '../lib/accountData'
import {
  buildRestoreMessage,
  getOrderStatus,
  restoreOrderItemsToCart,
} from '../lib/accountActions'
import { formatCurrency } from '../lib/currency'

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

  const handleRestoreOrder = async (order, redirectToCart = false) => {
    const result = await restoreOrderItemsToCart(order.items)
    setFeedback(buildRestoreMessage(result, order.reference))

    if (redirectToCart && result.addedCount) {
      navigate('/cart')
    }
  }

  const handleRestoreItem = async (orderReference, item) => {
    const result = await restoreOrderItemsToCart([item])
    setFeedback(buildRestoreMessage(result, `${item.name} from ${orderReference}`))
  }

  return (
    <AccountLayout
      eyebrow="Account orders"
      title="Your order history"
      description="Review completed checkouts, inspect the packages that were placed, and send any available items back into the cart."
    >
      {feedback ? (
        <div className="aurora-message aurora-message-success mb-6">
          {feedback}
        </div>
      ) : null}

      {!orders.length ? (
        <div className="aurora-ops-card border-dashed px-6 py-12 text-center">
          <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
            No orders yet
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--aurora-text)]">
            Once you complete checkout, your submitted orders will
            appear here with totals, package details, and delivery summary.
          </p>
          <LiquidGlassButton
            as={Link}
            to="/products"
            variant="secondary"
            size="hero"
            className="mt-6"
          >
            Browse coffees
          </LiquidGlassButton>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <article
              key={order.reference}
              className="aurora-ops-panel p-8"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                    {order.reference}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-3xl text-[var(--aurora-text-strong)]">
                      {getOrderStatus(order)}
                    </h2>
                    <span className="rounded-full border border-[rgba(138,144,119,0.26)] bg-[rgba(230,232,222,0.48)] px-4 py-2 text-sm font-semibold text-[var(--aurora-olive-deep)]">
                      {order.items.reduce((total, item) => total + item.quantity, 0)} item
                      {order.items.reduce((total, item) => total + item.quantity, 0) === 1
                        ? ''
                        : 's'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                    Submitted on {formatTimestamp(order.submittedAt)} · total{' '}
                    <span className="font-semibold text-[var(--aurora-text-strong)]">
                      {formatCurrency(order.total)}
                    </span>
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <LiquidGlassButton
                      type="button"
                      variant="secondary"
                      size="compact"
                      onClick={() => handleRestoreOrder(order, true)}
                    >
                      Reorder all
                    </LiquidGlassButton>
                    <LiquidGlassButton
                      type="button"
                      variant="soft"
                      size="compact"
                      onClick={() => handleRestoreOrder(order)}
                    >
                      Add items to cart
                    </LiquidGlassButton>
                  </div>
                </div>
                <div className="aurora-ops-card px-5 py-4 text-sm leading-7 text-[var(--aurora-text)] sm:max-w-[18rem]">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Delivery status
                  </p>
                  <p className="mt-3 font-semibold text-[var(--aurora-text-strong)]">
                    {getOrderStatus(order)}
                  </p>
                  <p className="mt-2">
                    {order.delivery.city}, {order.delivery.postalCode}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  {order.items.map((item) => (
                    <div
                      key={`${order.reference}-${item.id}`}
                      className="aurora-ops-card px-5 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-[var(--aurora-text-strong)]">
                            {item.name}
                          </p>
                          <p className="mt-1 text-sm text-[var(--aurora-text)]">
                            {item.metaLine || item.category || 'Product'}
                          </p>
                          <p className="mt-1 text-sm text-[var(--aurora-text)]">
                            Qty {item.quantity}
                          </p>
                          <LiquidGlassButton
                            type="button"
                            variant="quiet"
                            size="compact"
                            onClick={() => handleRestoreItem(order.reference, item)}
                            className="mt-3"
                          >
                            Add again
                          </LiquidGlassButton>
                        </div>
                        <p className="font-semibold text-[var(--aurora-text-strong)]">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="aurora-solid-plate rounded-[1.75rem] p-5">
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

                  <div className="aurora-ops-card p-5">
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
