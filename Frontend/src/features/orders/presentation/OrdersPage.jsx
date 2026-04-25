import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountLayout from '../../../components/AccountLayout'
import LiquidGlassButton from '../../../shared/components/ui/LiquidGlassButton'
import OrderPdfDownloadButton from '../../invoices/presentation/OrderPdfDownloadButton'
import { authChangeEvent } from '../../auth/application/auth'
import {
  fetchOrders,
  getOrdersSnapshot,
  getOrderStatusPresentation,
  ordersChangeEvent,
} from '../application/orders'

function formatTimestamp(value) {
  const timestamp = Date.parse(value || '')

  if (!Number.isFinite(timestamp)) {
    return 'Time unavailable'
  }

  return new Date(timestamp).toLocaleString('en-GB', {
    hour12: false,
  })
}

export default function OrdersPage() {
  const [orders, setOrders] = useState(() => getOrdersSnapshot().orders)
  const [ordersLoaded, setOrdersLoaded] = useState(() => getOrdersSnapshot().loaded)
  const [loading, setLoading] = useState(() => !getOrdersSnapshot().loaded)
  const [error, setError] = useState('')
  const [pdfFeedback, setPdfFeedback] = useState(null)

  useEffect(() => {
    let active = true

    const syncOrders = () => {
      if (!active) {
        return
      }

      const snapshot = getOrdersSnapshot()
      setOrders(snapshot.orders)
      setOrdersLoaded(snapshot.loaded)

      if (snapshot.loaded) {
        setLoading(false)
      }
    }

    const loadOrders = async () => {
      if (active && !getOrdersSnapshot().loaded) {
        setLoading(true)
      }

      try {
        const nextOrders = await fetchOrders()

        if (!active) {
          return
        }

        setOrders(nextOrders)
        setOrdersLoaded(true)
        setError('')
      } catch (loadError) {
        if (!active) {
          return
        }

        const snapshot = getOrdersSnapshot()
        setOrders(snapshot.orders)
        setOrdersLoaded(snapshot.loaded)
        setError(loadError instanceof Error ? loadError.message : 'Orders could not be loaded.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    window.addEventListener('storage', loadOrders)
    window.addEventListener(authChangeEvent, loadOrders)
    window.addEventListener(ordersChangeEvent, syncOrders)
    void loadOrders()

    return () => {
      active = false
      window.removeEventListener('storage', loadOrders)
      window.removeEventListener(authChangeEvent, loadOrders)
      window.removeEventListener(ordersChangeEvent, syncOrders)
    }
  }, [])

  useEffect(() => {
    if (!pdfFeedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setPdfFeedback(null)
    }, 3500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [pdfFeedback])

  const showPdfSuccess = ({ orderId }) => {
    setPdfFeedback({
      type: 'success',
      message: `PDF download started for order ${orderId}.`,
    })
  }

  const showPdfError = (message, orderId) => {
    setPdfFeedback({
      type: 'error',
      message: `PDF could not be downloaded for order ${orderId}. ${message}`,
    })
  }

  return (
    <AccountLayout
      eyebrow="Account orders"
      title="Order history"
      description="Scan the orders placed on this account, then open any order to review package details and delivery progress."
    >
      {error ? (
        <div className="aurora-message aurora-message-error mb-6">
          {error}
        </div>
      ) : null}

      {pdfFeedback ? (
        <div
          className={`aurora-message aurora-message-${pdfFeedback.type} mb-6`}
          role="status"
          aria-live="polite"
        >
          {pdfFeedback.message}
        </div>
      ) : null}

      {loading && !ordersLoaded ? (
        <div className="aurora-ops-card border-dashed px-6 py-12 text-center">
          <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
            Loading orders
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--aurora-text)]">
            Pulling the latest order timeline from the backend.
          </p>
        </div>
      ) : ordersLoaded && !orders.length ? (
        <div className="aurora-ops-card border-dashed px-6 py-12 text-center">
          <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
            No orders yet
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--aurora-text)]">
            Once you complete checkout, your backend orders will appear here with current status and submit time.
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
        <div className="aurora-order-list">
          {orders.map((order) => {
            const status = getOrderStatusPresentation(order)
            const orderPath = `/account/orders/${encodeURIComponent(order.id)}`

            return (
              <article
                key={order.id}
                className="aurora-order-row"
              >
                <Link
                  to={orderPath}
                  className="aurora-order-row-main min-w-0"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                    Order ID
                  </p>
                  <h2 className="aurora-break-token mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                    {order.id}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                    Submitted on {formatTimestamp(order.submittedAt)}
                  </p>
                </Link>

                <div className="aurora-order-row-actions">
                  <span className={`aurora-order-status-chip is-${status.key}`}>
                    {status.label}
                  </span>
                  <div className="aurora-order-row-controls">
                    <LiquidGlassButton
                      as={Link}
                      to={orderPath}
                      variant="quiet"
                      size="compact"
                    >
                      Open order
                    </LiquidGlassButton>
                    <OrderPdfDownloadButton
                      orderId={order.id}
                      variant="secondary"
                      size="compact"
                      onSuccess={showPdfSuccess}
                      onError={showPdfError}
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </AccountLayout>
  )
}
