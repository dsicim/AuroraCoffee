import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../components/LiquidGlassButton'
import { authChangeEvent } from '../lib/auth'
import {
  fetchOrders,
  getCachedOrders,
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

export default function OrdersPage() {
  const [orders, setOrders] = useState(() => getCachedOrders())
  const [loading, setLoading] = useState(() => !getCachedOrders().length)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const syncOrders = () => {
      if (!active) {
        return
      }

      setOrders(getCachedOrders())
    }

    const loadOrders = async () => {
      if (active) {
        setLoading(true)
      }

      try {
        const nextOrders = await fetchOrders()

        if (!active) {
          return
        }

        setOrders(nextOrders)
        setError('')
      } catch (loadError) {
        if (!active) {
          return
        }

        setOrders(getCachedOrders())
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

      {loading && !orders.length ? (
        <div className="aurora-ops-card border-dashed px-6 py-12 text-center">
          <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
            Loading orders
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--aurora-text)]">
            Pulling the latest order timeline from the backend.
          </p>
        </div>
      ) : !orders.length ? (
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

            return (
              <Link
                key={order.id}
                to={`/account/orders/${encodeURIComponent(order.id)}`}
                className="aurora-order-row"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                    Order ID
                  </p>
                  <h2 className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                    {order.id}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                    Submitted on {formatTimestamp(order.submittedAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <span className={`aurora-order-status-chip is-${status.key}`}>
                    {status.label}
                  </span>
                  <span className="text-sm font-semibold text-[var(--aurora-sky-deep)]">
                    Open order
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </AccountLayout>
  )
}
