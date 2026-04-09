import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import { authChangeEvent } from '../lib/auth'
import { buildRestoreMessage, restoreOrderItemsToCart } from '../lib/accountActions'
import { formatCartOptionLabel, getCartOptionEntries } from '../lib/cart'
import { formatCurrency } from '../lib/currency'
import {
  fetchOrderById,
  getCachedOrderById,
  getOrderProgressState,
  getOrderStatusPresentation,
  orderProgressSteps,
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

function getAddressLines(address) {
  if (!address) {
    return []
  }

  return [address.addressLine1, address.addressLine2].filter(Boolean)
}

function renderOrderItemOptions(item) {
  const optionEntries = getCartOptionEntries(item?.options)

  if (!optionEntries.length) {
    return null
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {optionEntries.map(([key, value]) => (
        <span key={`${item.id}-${key}`} className="aurora-chip text-[11px] tracking-[0.14em]">
          {formatCartOptionLabel(key)}: {value}
        </span>
      ))}
    </div>
  )
}

function getProgressMessage(progressState) {
  if (progressState.isCancelled) {
    return 'This order was cancelled before the delivery flow could continue.'
  }

  if (progressState.isPending) {
    return 'Payment is still pending confirmation before processing begins.'
  }

  return `${progressState.label} is the latest backend status on this order.`
}

export default function OrderDetailPage() {
  const navigate = useNavigate()
  const { orderId = '' } = useParams()
  const [order, setOrder] = useState(() => getCachedOrderById(orderId) || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let active = true

    const syncOrder = () => {
      if (!active) {
        return
      }

      const cachedOrder = getCachedOrderById(orderId)

      if (cachedOrder) {
        setOrder(cachedOrder)
      }
    }

    const loadOrder = async () => {
      if (active) {
        setLoading(true)
      }

      try {
        const nextOrder = await fetchOrderById(orderId)

        if (!active) {
          return
        }

        setOrder(nextOrder)
        setError('')
      } catch (loadError) {
        if (!active) {
          return
        }

        setOrder(getCachedOrderById(orderId) || null)
        setError(loadError instanceof Error ? loadError.message : 'Order could not be loaded.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    window.addEventListener('storage', loadOrder)
    window.addEventListener(authChangeEvent, loadOrder)
    window.addEventListener(ordersChangeEvent, syncOrder)
    void loadOrder()

    return () => {
      active = false
      window.removeEventListener('storage', loadOrder)
      window.removeEventListener(authChangeEvent, loadOrder)
      window.removeEventListener(ordersChangeEvent, syncOrder)
    }
  }, [orderId])

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

  const handleRestoreOrder = async (redirectToCart = false) => {
    if (!order?.items?.length) {
      return
    }

    const result = await restoreOrderItemsToCart(order.items)
    setFeedback(buildRestoreMessage(result, `Order ${order.id}`))

    if (redirectToCart && result.addedCount) {
      navigate('/cart')
    }
  }

  const handleRestoreItem = async (item) => {
    const result = await restoreOrderItemsToCart([item])
    setFeedback(buildRestoreMessage(result, item.name || 'Item'))
  }

  const progressState = getOrderProgressState(order)
  const status = getOrderStatusPresentation(order)
  const detailReady = Boolean(order && Array.isArray(order.items))

  return (
    <AccountLayout
      eyebrow="Order detail"
      title={order?.id ? `Order ${order.id}` : 'Order detail'}
      description="Follow the backend delivery stages, review the package contents, and reorder any available items."
    >
      {feedback ? (
        <div className="aurora-message aurora-message-success mb-6">
          {feedback}
        </div>
      ) : null}

      {error ? (
        <div className="aurora-message aurora-message-error mb-6">
          {error}
        </div>
      ) : null}

      {(loading && !detailReady) ? (
        <section className="aurora-ops-card border-dashed px-6 py-12 text-center">
          <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
            Loading order
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--aurora-text)]">
            Pulling the backend order detail and delivery state.
          </p>
        </section>
      ) : !order ? (
        <section className="aurora-ops-card border-dashed px-6 py-12 text-center">
          <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
            Order not found
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--aurora-text)]">
            The requested order could not be found for this account.
          </p>
          <LiquidGlassButton
            as={Link}
            to="/account/orders"
            variant="secondary"
            size="hero"
            className="mt-6"
          >
            Back to orders
          </LiquidGlassButton>
        </section>
      ) : (
        <div className="space-y-8">
          <section className="aurora-ops-panel p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`aurora-order-status-chip is-${status.key}`}>
                    {status.label}
                  </span>
                  <span className="text-sm text-[var(--aurora-text)]">
                    Submitted on {formatTimestamp(order.submittedAt)}
                  </span>
                </div>
                <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {order.id}
                </h2>
                {order.purchaseId ? (
                  <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                    Purchase reference {order.purchaseId}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <LiquidGlassButton as={Link} to="/account/orders" variant="quiet" size="compact">
                  Back to orders
                </LiquidGlassButton>
                <LiquidGlassButton type="button" variant="secondary" size="compact" onClick={() => handleRestoreOrder(true)}>
                  Reorder all
                </LiquidGlassButton>
                <LiquidGlassButton type="button" variant="soft" size="compact" onClick={() => handleRestoreOrder(false)}>
                  Add items to cart
                </LiquidGlassButton>
              </div>
            </div>

            <div className="aurora-order-progress mt-8">
              <div className={`aurora-order-progress-line${progressState.isCancelled ? ' is-cancelled' : ''}${progressState.isPending ? ' is-pending' : ''}`} />
              {orderProgressSteps.map((step, index) => {
                const stepState = progressState.stepStates[index]

                return (
                  <div key={step.key} className={`aurora-order-progress-step is-${stepState}`}>
                    <span className="aurora-order-progress-dot" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div className="aurora-step-card aurora-order-progress-card">
                      <span className="aurora-order-progress-label">
                        {step.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="mt-6 text-sm leading-7 text-[var(--aurora-text)]">
              {getProgressMessage(progressState)}
            </p>
          </section>

          <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <div className="aurora-ops-panel p-6">
                <div className="aurora-widget-header">
                  <div className="aurora-widget-heading">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                      Items
                    </p>
                    <h3 className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                      {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
                    </h3>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {order.items.map((item) => (
                    <div key={`${order.id}-${item.lineItemId || item.id}`} className="aurora-ops-card px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-[var(--aurora-text-strong)]">
                            {item.name}
                          </p>
                          <p className="mt-1 text-sm text-[var(--aurora-text)]">
                            {item.metaLine || item.category || 'Product'}
                          </p>
                          <p className="mt-1 text-sm text-[var(--aurora-text)]">
                            Qty {item.quantity}
                          </p>
                          {renderOrderItemOptions(item)}
                          <LiquidGlassButton
                            type="button"
                            variant="quiet"
                            size="compact"
                            onClick={() => handleRestoreItem(item)}
                            className="mt-4"
                          >
                            Add again
                          </LiquidGlassButton>
                        </div>

                        <p className="shrink-0 font-semibold text-[var(--aurora-text-strong)]">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="aurora-solid-plate rounded-[1.75rem] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                  Delivery summary
                </p>
                {order.delivery ? (
                  <div className="mt-4 text-sm leading-8 text-[var(--aurora-text)]">
                    {order.delivery.fullName ? (
                      <p className="font-semibold text-[var(--aurora-text-strong)]">
                        {order.delivery.fullName}
                      </p>
                    ) : null}
                    {getAddressLines(order.delivery).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    <p>
                      {order.delivery.district}, {order.delivery.province} {order.delivery.postalCode}
                    </p>
                    {order.delivery.phone ? <p>{order.delivery.phone}</p> : null}
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                    Delivery details are not available for this order.
                  </p>
                )}
              </div>

              <div className="aurora-ops-card p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                  Payment
                </p>
                <div className="mt-4 space-y-2 text-sm leading-7 text-[var(--aurora-text)]">
                  <p className="font-semibold text-[var(--aurora-text-strong)]">
                    {order.payment?.summary || 'Secure payment'}
                  </p>
                  {order.payment?.maskedCardNumber ? (
                    <p>{order.payment.maskedCardNumber}</p>
                  ) : null}
                  {order.payment?.installmentCount > 1 ? (
                    <p>{order.payment.installmentCount} installments</p>
                  ) : (
                    <p>Paid in full</p>
                  )}
                </div>
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
          </section>
        </div>
      )}
    </AccountLayout>
  )
}
