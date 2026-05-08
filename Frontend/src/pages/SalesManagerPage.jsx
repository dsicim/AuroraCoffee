import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
import RoleOverviewLayout from '../components/RoleOverviewLayout'
import { formatCurrency } from '../lib/currency'
import {
  fetchAdminOrderById,
  fetchAdminOrders,
  getOrderStatusPresentation,
  orderStatusOptions,
  updateOrderStatus,
} from '../features/orders/application/orders'
import OrderPdfDownloadButton from '../features/invoices/presentation/OrderPdfDownloadButton'

function formatTimestamp(value) {
  const timestamp = Date.parse(value || '')

  if (!Number.isFinite(timestamp)) {
    return 'Time unavailable'
  }

  return new Date(timestamp).toLocaleString('en-GB', {
    hour12: false,
  })
}

function formatStatusLabel(status) {
  return getOrderStatusPresentation(status).label
}

function getOrderStatusFeedback(result, nextStatus) {
  const responseMessage = result?.msg || result?.message

  if (responseMessage) {
    return responseMessage
  }

  if (nextStatus === 'delivered') {
    return 'This user can now comment.'
  }

  return 'Order status updated successfully.'
}

function formatShortDate(value) {
  const timestamp = Date.parse(value || '')

  if (!Number.isFinite(timestamp)) {
    return '—'
  }

  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

function getOrderLocation(order) {
  return [
    order?.delivery?.district || order?.delivery?.city,
    order?.delivery?.province,
    order?.delivery?.postalCode,
  ].filter(Boolean).join(', ') || 'Address unavailable'
}

function MetricTile({ label, value, description }) {
  return (
    <div className="aurora-summary-card p-5">
      <div className="aurora-widget-body gap-3">
        <div className="aurora-widget-heading">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--aurora-olive-deep)]">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl text-[var(--aurora-text-strong)]">
            {value}
          </p>
        </div>
        <p className="text-sm leading-6 text-[var(--aurora-text)]">
          {description}
        </p>
      </div>
    </div>
  )
}

export default function SalesManagerPage() {
  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let active = true

    setOrdersLoading(true)
    setError('')

    void fetchAdminOrders()
      .then((nextOrders) => {
        if (!active) {
          return
        }

        setOrders(nextOrders)
        setSelectedOrderId((currentOrderId) => (
          currentOrderId && nextOrders.some((order) => order.id === currentOrderId)
            ? currentOrderId
            : nextOrders[0]?.id || ''
        ))
      })
      .catch((ordersError) => {
        if (!active) {
          return
        }

        setError(ordersError?.message || 'Could not load orders.')
        setOrders([])
        setSelectedOrderId('')
      })
      .finally(() => {
        if (active) {
          setOrdersLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    if (!selectedOrderId) {
      setSelectedOrder(null)
      return () => {
        active = false
      }
    }

    setDetailLoading(true)
    setError('')

    void fetchAdminOrderById(selectedOrderId)
      .then((order) => {
        if (!active) {
          return
        }

        setSelectedOrder(order)
      })
      .catch((detailError) => {
        if (!active) {
          return
        }

        setSelectedOrder(null)
        setError(detailError?.message || 'Could not load order details.')
      })
      .finally(() => {
        if (active) {
          setDetailLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [selectedOrderId])

  const activeOrders = useMemo(
    () => orders.filter((order) => !['delivered', 'cancelled'].includes(order.statusKey)),
    [orders],
  )
  const deliveredOrders = useMemo(
    () => orders.filter((order) => order.statusKey === 'delivered'),
    [orders],
  )
  const cancelledOrders = useMemo(
    () => orders.filter((order) => order.statusKey === 'cancelled'),
    [orders],
  )
  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return orders.filter((order) => {
      const statusMatches = statusFilter === 'all' || order.statusKey === statusFilter
      const queryMatches = !normalizedQuery || [
        order.id,
        order.purchaseId,
        order.statusLabel,
        order.submittedAt,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery))

      return statusMatches && queryMatches
    })
  }, [orders, query, statusFilter])
  const selectedOrderIndex = filteredOrders.findIndex((order) => order.id === selectedOrderId)
  const selectedStatus = selectedOrder?.statusKey || selectedOrder?.status || ''
  const selectedSummary = orders.find((order) => order.id === selectedOrderId) || null

  const handleRefresh = async () => {
    setOrdersLoading(true)
    setFeedback('')
    setError('')

    try {
      const nextOrders = await fetchAdminOrders()
      setOrders(nextOrders)
      setSelectedOrderId((currentOrderId) => (
        currentOrderId && nextOrders.some((order) => order.id === currentOrderId)
          ? currentOrderId
          : nextOrders[0]?.id || ''
      ))
      setFeedback('Orders refreshed.')
    } catch (refreshError) {
      setError(refreshError?.message || 'Could not refresh orders.')
    } finally {
      setOrdersLoading(false)
    }
  }

  const handleStatusChange = async (event) => {
    const nextStatus = event.target.value

    if (!selectedOrderId || !nextStatus || nextStatus === selectedStatus) {
      return
    }

    setStatusBusy(true)
    setFeedback('')
    setError('')

    try {
      const result = await updateOrderStatus(selectedOrderId, nextStatus)
      const [nextOrders, nextOrder] = await Promise.all([
        fetchAdminOrders(),
        fetchAdminOrderById(selectedOrderId),
      ])

      setOrders(nextOrders)
      setSelectedOrder(nextOrder)
      setFeedback(getOrderStatusFeedback(result, nextStatus))
    } catch (statusError) {
      setError(statusError?.message || 'Could not update order status.')
    } finally {
      setStatusBusy(false)
    }
  }

  return (
    <RoleOverviewLayout
      eyebrow="Sales manager"
      title="Manage live orders"
      description="A focused fulfillment console for order lookup, invoice access, delivery review, and status movement."
    >
      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-8">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Active"
              value={activeOrders.length}
              description="Not delivered or cancelled."
            />
            <MetricTile
              label="All orders"
              value={orders.length}
              description="Visible through admin order access."
            />
            <MetricTile
              label="Delivered"
              value={deliveredOrders.length}
              description="Completed fulfillment records."
            />
            <MetricTile
              label="Cancelled"
              value={cancelledOrders.length}
              description="Stopped or voided orders."
            />
          </section>

          <section id="activity" className="aurora-ops-panel p-8">
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Orders
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Backend order queue
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-[var(--aurora-text)]">
                  {filteredOrders.length} shown
                </span>
                <LiquidGlassButton
                  type="button"
                  variant="secondary"
                  size="compact"
                  loading={ordersLoading}
                  onClick={handleRefresh}
                >
                  Refresh
                </LiquidGlassButton>
              </div>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_220px]">
              <label className="block">
                <span className="sr-only">Search orders</span>
                <input
                  type="search"
                  className="aurora-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search order number, purchase id, status, or date"
                />
              </label>
              <label className="block">
                <span className="sr-only">Filter by status</span>
                <select
                  className="aurora-select"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  {orderStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? (
              <p className="aurora-message aurora-message-error mt-6" role="alert">
                {error}
              </p>
            ) : null}
            {feedback ? (
              <p className="aurora-message aurora-message-success mt-6" role="status" aria-live="polite">
                {feedback}
              </p>
            ) : null}

            {ordersLoading && !orders.length ? (
              <div className="aurora-ops-card mt-8 border-dashed px-6 py-10 text-center">
                <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                  Loading orders
                </p>
                <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                  Fetching the sales manager order list from the backend.
                </p>
              </div>
            ) : !orders.length ? (
              <div className="aurora-ops-card mt-8 border-dashed px-6 py-10 text-center">
                <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                  No orders found
                </p>
                <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                  New checkout orders will appear here after the backend returns them.
                </p>
              </div>
            ) : !filteredOrders.length ? (
              <div className="aurora-ops-card mt-8 border-dashed px-6 py-10 text-center">
                <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                  No matching orders
                </p>
                <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                  Clear the search or status filter to return to the full queue.
                </p>
              </div>
            ) : (
              <div className="mt-8 overflow-hidden rounded-[1.4rem] border border-[rgba(73,92,65,0.14)] bg-[rgba(255,255,255,0.34)]">
                <div className="grid grid-cols-[minmax(0,1.2fr)_140px_120px] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--aurora-olive-deep)] max-md:hidden">
                  <span>Order</span>
                  <span>Date</span>
                  <span className="text-right">Status</span>
                </div>
                <div className="divide-y divide-[rgba(73,92,65,0.12)]">
                  {filteredOrders.map((order) => {
                  const status = getOrderStatusPresentation(order)
                  const selected = order.id === selectedOrderId

                  return (
                    <button
                      key={order.id}
                      type="button"
                      className={`grid w-full gap-4 px-5 py-4 text-left transition hover:bg-[rgba(255,255,255,0.42)] md:grid-cols-[minmax(0,1.2fr)_140px_120px] md:items-center ${selected ? 'bg-[rgba(117,150,107,0.14)]' : ''}`.trim()}
                      onClick={() => {
                        setFeedback('')
                        setSelectedOrderId(order.id)
                      }}
                    >
                      <span>
                        <span className="block break-all text-sm font-semibold text-[var(--aurora-text-strong)]">
                          {order.id}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--aurora-text)]">
                          {order.purchaseId ? `Purchase ${order.purchaseId}` : 'No purchase id returned'}
                        </span>
                      </span>
                      <span className="text-sm text-[var(--aurora-text)]">
                        <span className="md:hidden">Submitted </span>
                        {formatShortDate(order.submittedAt)}
                      </span>
                      <span className="md:text-right">
                        <span className={`aurora-order-status-chip is-${status.key} inline-flex`}>
                          {status.label}
                        </span>
                      </span>
                    </button>
                  )
                })}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section className="aurora-ops-panel p-8 xl:sticky xl:top-6">
            <div className="aurora-widget-body">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="aurora-widget-heading">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                    Selected order
                  </p>
                  <h2 className="mt-3 break-all font-display text-3xl text-[var(--aurora-text-strong)]">
                    {selectedOrderId || 'No order selected'}
                  </h2>
                </div>
                {selectedOrderId && selectedOrderIndex >= 0 ? (
                  <span className="aurora-order-status-chip is-processing">
                    Queue #{selectedOrderIndex + 1}
                  </span>
                ) : null}
              </div>

              {detailLoading ? (
                <p className="aurora-message aurora-message-info">Loading selected order details.</p>
              ) : null}

              {selectedSummary && !selectedOrder ? (
                <div className="aurora-widget-subsurface p-5 text-sm leading-7 text-[var(--aurora-text)]">
                  Select an order to load its decrypted detail payload.
                </div>
              ) : null}

              {selectedOrder ? (
                <>
                  <div className="aurora-widget-subsurface p-5">
                    <div className="grid gap-4 sm:grid-cols-4">
                      <div>
                        <p className="aurora-kicker">Status</p>
                        <p className="mt-2 text-lg font-semibold text-[var(--aurora-text-strong)]">
                          {formatStatusLabel(selectedStatus)}
                        </p>
                      </div>
                      <div>
                        <p className="aurora-kicker">Submitted</p>
                        <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                          {formatTimestamp(selectedOrder.submittedAt)}
                        </p>
                      </div>
                      <div>
                        <p className="aurora-kicker">Items</p>
                        <p className="mt-2 text-lg font-semibold text-[var(--aurora-text-strong)]">
                          {selectedOrder.itemCount}
                        </p>
                      </div>
                      <div>
                        <p className="aurora-kicker">Total</p>
                        <p className="mt-2 text-lg font-semibold text-[var(--aurora-text-strong)]">
                          {formatCurrency(selectedOrder.total)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="aurora-widget-subsurface p-5">
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                      <label>
                        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                          Fulfillment status
                        </span>
                        <select
                          id="sales-manager-order-status"
                          className="aurora-select mt-3"
                          value={selectedStatus}
                          disabled={statusBusy}
                          onChange={handleStatusChange}
                        >
                          {orderStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {formatStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="aurora-widget-actions md:justify-end">
                        <OrderPdfDownloadButton
                          orderId={selectedOrder.id}
                          label="PDF"
                          downloadingLabel="PDF"
                          onError={(message) => setError(message)}
                          onSuccess={() => setFeedback('PDF download started.')}
                        />
                        <LiquidGlassButton as={Link} to="/products" variant="quiet" size="compact">
                          Catalog
                        </LiquidGlassButton>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="aurora-widget-subsurface p-5">
                      <p className="aurora-kicker">Delivery</p>
                      <p className="mt-3 text-sm font-semibold text-[var(--aurora-text-strong)]">
                        {selectedOrder.delivery?.fullName || 'Customer name unavailable'}
                      </p>
                      <p className="text-sm leading-7 text-[var(--aurora-text)]">
                        {getOrderLocation(selectedOrder)}
                      </p>
                      {selectedOrder.delivery?.phone ? (
                        <p className="text-sm leading-7 text-[var(--aurora-text)]">
                          {selectedOrder.delivery.phone}
                        </p>
                      ) : null}
                    </div>

                    <div className="aurora-widget-subsurface p-5">
                      <p className="aurora-kicker">Payment</p>
                      <p className="mt-3 text-sm font-semibold text-[var(--aurora-text-strong)]">
                        {selectedOrder.payment?.summary || 'Payment details unavailable'}
                      </p>
                      <p className="text-sm leading-7 text-[var(--aurora-text)]">
                        {selectedOrder.payment?.installmentCount > 1
                          ? `${selectedOrder.payment.installmentCount} installments`
                          : 'Single payment'}
                      </p>
                    </div>
                  </div>

                  <div className="aurora-widget-subsurface p-5">
                    <div className="flex items-center justify-between gap-4">
                      <p className="aurora-kicker">Items</p>
                      <p className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                        {formatCurrency(selectedOrder.subtotal)}
                      </p>
                    </div>
                    <div className="mt-4 divide-y divide-[rgba(73,92,65,0.12)]">
                      {selectedOrder.items.map((item) => (
                        <div key={`${item.lineItemId || item.productId}:${item.variantId || item.variantCode || item.name}`} className="flex items-start justify-between gap-4 py-3 text-sm">
                          <div>
                            <p className="font-semibold text-[var(--aurora-text-strong)]">{item.name}</p>
                            <p className="mt-1 text-[var(--aurora-text)]">
                              {item.quantity} × {formatCurrency(item.price)}
                            </p>
                          </div>
                          <p className="font-semibold text-[var(--aurora-text-strong)]">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </RoleOverviewLayout>
  )
}
