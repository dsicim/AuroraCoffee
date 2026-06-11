import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
import RoleOverviewLayout from '../components/RoleOverviewLayout'
import { formatCurrency } from '../lib/currency'
import { fetchAuthJson } from '../lib/authRequest'
import { getAuthStateSnapshot } from '../features/auth/application/auth'
import { normalizeUserRole, userRoles } from '../features/auth/domain/roles'
import {
  updateProductDetails,
  updateProductVariant,
  useProductCatalog,
} from '../lib/products'
import {
  fetchWishlistNotifyQueue,
  sendWishlistNotifications,
} from '../lib/wishlist'
import {
  fetchAdminOrderById,
  fetchAdminOrders,
  getOrderStatusPresentation,
  orderStatusOptions,
  processOrderRefund,
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

function getDateInputValue(value) {
  const timestamp = Date.parse(value || '')

  if (!Number.isFinite(timestamp)) {
    return ''
  }

  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getDateFromInputValue(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)

  if (!year || !month || !day) {
    return new Date()
  }

  return new Date(year, month - 1, day)
}

function getMonthStart(value) {
  const date = getDateFromInputValue(value)

  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function shiftMonth(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function formatDateRangeLabel(startDate, endDate) {
  if (!startDate && !endDate) {
    return 'Date range'
  }

  if (startDate && endDate) {
    return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`
  }

  return startDate ? `From ${formatShortDate(startDate)}` : `Until ${formatShortDate(endDate)}`
}

function buildCalendarDays(monthDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const firstVisible = new Date(firstOfMonth)
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7

  firstVisible.setDate(firstVisible.getDate() - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisible)

    date.setDate(firstVisible.getDate() + index)

    return {
      date,
      label: String(date.getDate()),
      value: getDateInputValue(date.toISOString()),
      inCurrentMonth: date.getMonth() === monthDate.getMonth(),
    }
  })
}

function getOrderLocation(order) {
  return [
    order?.delivery?.district || order?.delivery?.city,
    order?.delivery?.province,
    order?.delivery?.postalCode,
  ].filter(Boolean).join(', ') || 'Address unavailable'
}

function getDeliveryAddressLines(delivery) {
  if (!delivery) {
    return []
  }

  const areaLine = [
    delivery.district || delivery.city,
    delivery.province,
    delivery.postalCode,
  ].filter(Boolean).join(', ')

  return [
    delivery.fullName,
    delivery.addressLine1,
    delivery.addressLine2,
    areaLine,
    delivery.country,
    delivery.phone,
  ].filter(Boolean)
}

function toFiniteNumber(value) {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : 0
}

function formatCompactCurrency(value) {
  const numberValue = toFiniteNumber(value)

  if (Math.abs(numberValue) >= 1000) {
    return `₺${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    }).format(numberValue / 1000)}K`
  }

  return formatCurrency(numberValue)
}

function getRefundStatus(item) {
  if (item.refunded) {
    return { key: 'refunded', label: 'Refunded', chipClass: 'is-delivered' }
  }

  if (item.refundRejected) {
    return { key: 'rejected', label: 'Rejected', chipClass: 'is-cancelled' }
  }

  if (item.refundRequested) {
    return { key: 'requested', label: 'Refund requested', chipClass: 'is-processing' }
  }

  return null
}

const salesManagerTabs = [
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Revenue, cost, profit, refunds, and order-status movement stay grouped here.',
  },
  {
    key: 'orders',
    label: 'Orders',
    description: 'Search orders, inspect delivery details, move fulfillment status, and review refunds.',
  },
  {
    key: 'wishlist',
    label: 'Wishlist Queue',
    description: 'Review and send the queued wishlist stock and discount notifications.',
  },
  {
    key: 'pricing',
    label: 'Product Pricing',
    description: 'Update product and variant pricing fields approved for Sales Manager access.',
  },
]

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

function roundFactor(value) {
  return Math.round((Number(value) || 0) * 10000) / 10000
}

function normalizePricingNumber(value, label, { min = 0, max = null, fallback = null } = {}) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue && fallback !== null) {
    return fallback
  }

  if (!normalizedValue) {
    throw new Error(`${label} is required.`)
  }

  const numericValue = Number(normalizedValue)

  if (!Number.isFinite(numericValue)) {
    throw new Error(`${label} must be a valid number.`)
  }

  if (min !== null && numericValue < min) {
    throw new Error(`${label} cannot be below ${min}.`)
  }

  if (max !== null && numericValue > max) {
    throw new Error(`${label} cannot be above ${max}.`)
  }

  return numericValue
}

function getVariantTotalPrice(basePrice, priceAdd, priceMult) {
  return roundCurrency((Number(basePrice) + Number(priceAdd)) * Number(priceMult))
}

function getRecentOrderBuckets(orders) {
  const orderTimes = orders
    .map((order) => Date.parse(order.submittedAt || order.createdAt || ''))
    .filter(Number.isFinite)
  const endTime = orderTimes.length ? Math.max(...orderTimes) : Date.now()
  const endDate = new Date(endTime)

  endDate.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(endDate)
    date.setDate(endDate.getDate() - (6 - index))

    const nextDate = new Date(date)
    nextDate.setDate(date.getDate() + 1)

    const count = orders.filter((order) => {
      const submittedTime = Date.parse(order.submittedAt || order.createdAt || '')
      return Number.isFinite(submittedTime) && submittedTime >= date.getTime() && submittedTime < nextDate.getTime()
    }).length

    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      count,
    }
  })
}

async function fetchSalesAnalytics() {
  const { response, payload, data } = await fetchAuthJson('/analytics')

  if (!response.ok || data?.e || payload?.e) {
    throw new Error(data?.e || payload?.e || 'Could not load sales analytics.')
  }

  return {
    summary: {
      totalSales: toFiniteNumber(data?.summary?.totalSales),
      totalCost: toFiniteNumber(data?.summary?.totalCost),
      totalRefunds: toFiniteNumber(data?.summary?.totalRefunds),
      netProfit: toFiniteNumber(data?.summary?.netProfit),
    },
    timeseries: Array.isArray(data?.timeseries)
      ? data.timeseries.map((point) => ({
        date: point?.date || '',
        sales: toFiniteNumber(point?.sales),
        cost: toFiniteNumber(point?.cost),
        profit: toFiniteNumber(point?.profit),
        refunds: toFiniteNumber(point?.refunds),
      })).filter((point) => point.date)
      : [],
  }
}

function SalesGraphicsPanel({ orders, statusBreakdown }) {
  const recentBuckets = useMemo(() => getRecentOrderBuckets(orders), [orders])
  const maxRecentCount = Math.max(1, ...recentBuckets.map((bucket) => bucket.count))
  const totalOrders = Math.max(1, orders.length)
  const orderTicks = [maxRecentCount, Math.ceil(maxRecentCount / 2), 0]

  return (
    <section className="aurora-sales-dashboard p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="aurora-widget-heading">
          <p className="aurora-sales-dashboard-kicker text-xs font-semibold uppercase">
            Sales graphics
          </p>
          <h2 className="mt-2 font-display text-2xl text-[var(--sales-dashboard-text)]">
            Order movement at a glance
          </h2>
        </div>
        <span className="rounded-full border border-[var(--sales-dashboard-border)] bg-[var(--sales-dashboard-card)] px-4 py-2 text-xs font-semibold uppercase tracking-normal text-[var(--sales-dashboard-text)]">
          {orders.length} orders
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="aurora-sales-dashboard-card p-4">
          <div className="flex min-h-full flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-[var(--sales-dashboard-text)]">Recent orders</p>
              <span className="aurora-sales-dashboard-muted text-xs font-semibold">Last 7 days</span>
            </div>
            <div className="aurora-sales-dashboard-chart px-3 py-3" aria-label="Recent order count chart">
              <svg className="h-44 w-full overflow-visible" viewBox="0 0 640 190" role="img" aria-label="Recent orders by day">
                <defs>
                  <linearGradient id="recentOrderBar" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--sales-dashboard-line)" />
                    <stop offset="100%" stopColor="var(--sales-dashboard-profit)" />
                  </linearGradient>
                </defs>
                {orderTicks.map((tick) => {
                  const y = 20 + ((maxRecentCount - tick) / maxRecentCount) * 108

                  return (
                    <g key={tick}>
                      <line className="aurora-sales-chart-grid" x1="46" x2="614" y1={y} y2={y} strokeDasharray={tick ? '4 8' : '0'} />
                      <text className="aurora-sales-chart-text" x="12" y={y + 4} fontSize="11" fontWeight="600">
                        {tick}
                      </text>
                    </g>
                  )
                })}
                <line className="aurora-sales-chart-axis" x1="46" x2="614" y1="128" y2="128" />
                {recentBuckets.map((bucket, index) => {
                  const slotWidth = 568 / recentBuckets.length
                  const barWidth = Math.min(42, slotWidth * 0.48)
                  const x = 46 + (slotWidth * index) + (slotWidth - barWidth) / 2
                  const barHeight = bucket.count ? Math.max(6, (bucket.count / maxRecentCount) * 108) : 2
                  const y = 128 - barHeight

                  return (
                    <g key={bucket.key}>
                      <rect
                        fill="url(#recentOrderBar)"
                        height={barHeight}
                        rx="8"
                        width={barWidth}
                        x={x}
                        y={y}
                      />
                      <text x={x + barWidth / 2} y={Math.max(14, y - 8)} fill="var(--sales-dashboard-text)" fontSize="12" fontWeight="700" textAnchor="middle">
                        {bucket.count}
                      </text>
                      <text className="aurora-sales-chart-text" x={x + barWidth / 2} y="158" fontSize="11" fontWeight="600" textAnchor="middle">
                        {bucket.label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        </div>

        <div className="aurora-sales-dashboard-card p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-[var(--sales-dashboard-text)]">Status mix</p>
            <span className="aurora-sales-dashboard-muted text-xs font-semibold">{statusBreakdown.length} states</span>
          </div>
          <div className="mt-4 space-y-3">
            {statusBreakdown.map((status) => {
              const percent = Math.round((status.count / totalOrders) * 100)

              return (
                <div key={status.key}>
                  <div className="flex items-center justify-between gap-4 text-xs">
                    <span className="font-semibold text-[var(--sales-dashboard-text)]">
                      {status.label}
                    </span>
                    <span className="aurora-sales-dashboard-muted">
                      {status.count} · {percent}%
                    </span>
                  </div>
                  <div className="aurora-sales-status-bar mt-1.5 h-2 overflow-hidden rounded-full">
                    <div
                      className="aurora-sales-status-fill h-full rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function OrderDateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) {
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(startDate || endDate))
  const [rangeStart, rangeEnd] = startDate && endDate && startDate > endDate
    ? [endDate, startDate]
    : [startDate, endDate]
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth])
  const monthLabel = visibleMonth.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
  const rangeLabel = formatDateRangeLabel(rangeStart, rangeEnd)

  function handlePickDate(nextDate) {
    if (!startDate || endDate) {
      onStartDateChange(nextDate)
      onEndDateChange('')
      setVisibleMonth(getMonthStart(nextDate))
      return
    }

    if (nextDate < startDate) {
      onStartDateChange(nextDate)
      onEndDateChange(startDate)
      return
    }

    onEndDateChange(nextDate)
  }

  function handleClear() {
    onStartDateChange('')
    onEndDateChange('')
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="aurora-input flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setVisibleMonth(getMonthStart(startDate || endDate))
          setOpen((currentOpen) => !currentOpen)
        }}
      >
        <span className={rangeStart || rangeEnd ? 'text-[var(--aurora-text-strong)]' : 'text-[var(--aurora-text)]'}>
          {rangeLabel}
        </span>
        <span aria-hidden="true" className="text-sm text-[var(--sales-page-accent)]">
          Calendar
        </span>
      </button>

      {open ? (
        <div
          className="absolute left-0 z-30 mt-2 w-full min-w-[20rem] rounded-[1.35rem] border border-[var(--aurora-border)] bg-[var(--aurora-surface-strong)] p-4 shadow-[var(--aurora-shadow)]"
          role="dialog"
          aria-label="Filter orders by date range"
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="rounded-full border border-[var(--aurora-border)] px-3 py-1.5 text-sm font-semibold text-[var(--aurora-text-strong)]"
              onClick={() => setVisibleMonth((currentMonth) => shiftMonth(currentMonth, -1))}
              aria-label="Previous month"
            >
              Prev
            </button>
            <p className="text-sm font-semibold text-[var(--aurora-text-strong)]">
              {monthLabel}
            </p>
            <button
              type="button"
              className="rounded-full border border-[var(--aurora-border)] px-3 py-1.5 text-sm font-semibold text-[var(--aurora-text-strong)]"
              onClick={() => setVisibleMonth((currentMonth) => shiftMonth(currentMonth, 1))}
              aria-label="Next month"
            >
              Next
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const selected = day.value === rangeStart || day.value === rangeEnd
              const inRange = rangeStart && rangeEnd && day.value > rangeStart && day.value < rangeEnd

              return (
                <button
                  key={day.value}
                  type="button"
                  className={[
                    'min-h-9 rounded-full text-sm font-semibold transition',
                    day.inCurrentMonth ? 'text-[var(--aurora-text-strong)]' : 'text-[var(--aurora-text)] opacity-45',
                    inRange ? 'bg-[var(--aurora-surface-muted)]' : '',
                    selected ? 'bg-[var(--sales-page-accent)] text-white opacity-100' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handlePickDate(day.value)}
                  aria-pressed={selected}
                >
                  {day.label}
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-[var(--aurora-text)]">
              {rangeStart && !rangeEnd ? 'Select an end date' : rangeLabel}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-sm font-semibold text-[var(--aurora-text)]"
                onClick={handleClear}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded-full bg-[var(--aurora-text-strong)] px-4 py-2 text-sm font-semibold text-white"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SalesAnalyticsGraph({ analytics, loading, error }) {
  const timeseries = analytics?.timeseries || []
  const summary = analytics?.summary || {}
  const visiblePoints = timeseries.slice(-10)
  const maxAmount = Math.max(1, ...visiblePoints.flatMap((point) => [
    point.sales,
    point.profit,
  ].map((value) => Math.abs(value))))
  const chartWidth = 700
  const chartHeight = 260
  const chartLeft = 64
  const chartRight = 28
  const chartTop = 22
  const chartBottom = 48
  const plotWidth = chartWidth - chartLeft - chartRight
  const plotHeight = chartHeight - chartTop - chartBottom
  const xStep = visiblePoints.length > 1 ? plotWidth / (visiblePoints.length - 1) : 0
  const chartPoints = visiblePoints.map((point, index) => {
    const x = chartLeft + (visiblePoints.length > 1 ? index * xStep : plotWidth / 2)
    const salesY = chartTop + (1 - (point.sales / maxAmount)) * plotHeight
    const profitY = chartTop + (1 - (point.profit / maxAmount)) * plotHeight

    return {
      ...point,
      x,
      salesY,
      profitY,
    }
  })
  const salesPath = chartPoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.salesY}`).join(' ')
  const profitPath = chartPoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.profitY}`).join(' ')
  const salesAreaPath = chartPoints.length
    ? `${salesPath} L ${chartPoints.at(-1).x} ${chartTop + plotHeight} L ${chartPoints[0].x} ${chartTop + plotHeight} Z`
    : ''
  const amountTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => Math.round(maxAmount * ratio))

  return (
    <section className="aurora-sales-dashboard p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="aurora-widget-heading">
          <p className="aurora-sales-dashboard-kicker text-xs font-semibold uppercase">
            Sales analytics
          </p>
          <h2 className="mt-2 font-display text-2xl text-[var(--sales-dashboard-text)]">
            Revenue and profit trend
          </h2>
        </div>
        <span className="rounded-full border border-[var(--sales-dashboard-border)] bg-[var(--sales-dashboard-card)] px-4 py-2 text-xs font-semibold uppercase tracking-normal text-[var(--sales-dashboard-text)]">
          {loading ? 'Loading' : `${visiblePoints.length} days`}
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="aurora-sales-dashboard-card p-4">
          {error ? (
            <p className="aurora-message aurora-message-error" role="alert">
              {error}
            </p>
          ) : loading ? (
            <div className="aurora-sales-dashboard-muted flex h-40 items-center justify-center text-sm font-semibold">
              Loading sales analytics
            </div>
          ) : visiblePoints.length ? (
            <div className="aurora-sales-dashboard-chart px-3 py-3" aria-label="Sales analytics chart">
              <svg className="h-72 w-full overflow-visible" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Sales and profit trend">
                <defs>
                  <linearGradient id="salesAreaGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="color-mix(in srgb, var(--sales-dashboard-line) 28%, transparent)" />
                    <stop offset="100%" stopColor="color-mix(in srgb, var(--sales-dashboard-line) 3%, transparent)" />
                  </linearGradient>
                </defs>
                {amountTicks.map((tick) => {
                  const y = chartTop + (1 - (tick / maxAmount)) * plotHeight

                  return (
                    <g key={tick}>
                      <line className="aurora-sales-chart-grid" x1={chartLeft} x2={chartLeft + plotWidth} y1={y} y2={y} strokeDasharray={tick ? '4 8' : '0'} />
                      <text className="aurora-sales-chart-text" x="8" y={y + 4} fontSize="11" fontWeight="600">
                        {formatCompactCurrency(tick)}
                      </text>
                    </g>
                  )
                })}
                <line className="aurora-sales-chart-axis" x1={chartLeft} x2={chartLeft} y1={chartTop} y2={chartTop + plotHeight} />
                <line className="aurora-sales-chart-axis" x1={chartLeft} x2={chartLeft + plotWidth} y1={chartTop + plotHeight} y2={chartTop + plotHeight} />
                <path d={salesAreaPath} fill="url(#salesAreaGradient)" />
                <path className="aurora-sales-chart-sales" d={salesPath} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
                <path className="aurora-sales-chart-profit" d={profitPath} fill="none" strokeDasharray="7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                {chartPoints.map((point) => (
                  <g key={point.date}>
                    <line className="aurora-sales-chart-axis" x1={point.x} x2={point.x} y1={chartTop + plotHeight} y2={chartTop + plotHeight + 5} />
                    <circle className="aurora-sales-chart-dot-sales" cx={point.x} cy={point.salesY} r="5" stroke="var(--sales-dashboard-card-strong)" strokeWidth="2" />
                    <circle className="aurora-sales-chart-dot-profit" cx={point.x} cy={point.profitY} r="4" stroke="var(--sales-dashboard-card-strong)" strokeWidth="2" />
                    <text className="aurora-sales-chart-text" x={point.x} y={chartTop + plotHeight + 24} fontSize="11" fontWeight="600" textAnchor="middle">
                      {formatShortDate(point.date)}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          ) : (
            <div className="aurora-sales-dashboard-muted flex h-40 items-center justify-center text-center text-sm leading-7">
              Sales analytics will appear after completed order data is available.
            </div>
          )}
        </div>

        <div className="aurora-sales-dashboard-card grid gap-3 p-4 sm:grid-cols-3 xl:grid-cols-1">
          {[
            ['Total sales', summary.totalSales || 0],
            ['Net profit', summary.netProfit || 0],
            ['Refunds', summary.totalRefunds || 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[1rem] border border-[var(--sales-dashboard-border)] bg-[var(--sales-dashboard-card)] px-4 py-3">
              <p className="aurora-sales-dashboard-kicker text-xs font-semibold">{label}</p>
              <p className="mt-1 font-display text-2xl text-[var(--sales-dashboard-text)]">
                {formatCurrency(value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="aurora-sales-dashboard-muted mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[var(--sales-dashboard-line)]" />
          Sales
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[var(--sales-dashboard-profit)]" />
          Profit
        </span>
      </div>
    </section>
  )
}

function MetricTile({ label, value, description }) {
  return (
    <div className="aurora-summary-card p-5">
      <div className="aurora-widget-body gap-3">
        <div className="aurora-widget-heading">
          <p className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
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

function getWishlistNotifySummary(items) {
  const normalizedItems = Array.isArray(items) ? items : []
  const userIds = new Set()
  const productIds = new Set()
  let blockedUsers = 0

  for (const item of normalizedItems) {
    if (item?.user_id !== undefined && item?.user_id !== null) {
      userIds.add(String(item.user_id))
    }

    if (item?.product_id !== undefined && item?.product_id !== null) {
      productIds.add(String(item.product_id))
    }

    if (item?.emailblocked) {
      blockedUsers += 1
    }
  }

  return {
    entries: normalizedItems.length,
    users: userIds.size,
    products: productIds.size,
    blockedUsers,
  }
}

function WishlistQueuePanel() {
  const [queueState, setQueueState] = useState({
    loading: true,
    error: '',
    discount: [],
    stock: [],
  })
  const [sendState, setSendState] = useState({
    type: '',
    error: '',
    success: '',
    log: '',
  })

  const discountSummary = useMemo(
    () => getWishlistNotifySummary(queueState.discount),
    [queueState.discount],
  )
  const stockSummary = useMemo(
    () => getWishlistNotifySummary(queueState.stock),
    [queueState.stock],
  )
  const busyType = sendState.type

  async function loadQueue({ quiet = false } = {}) {
    setQueueState((current) => ({
      ...current,
      loading: quiet ? current.loading : true,
      error: '',
    }))

    try {
      const queue = await fetchWishlistNotifyQueue()

      setQueueState({
        loading: false,
        error: '',
        discount: queue.discount,
        stock: queue.stock,
      })
    } catch (queueError) {
      setQueueState((current) => ({
        ...current,
        loading: false,
        error: queueError?.message || 'Could not load wishlist notification queue.',
      }))
    }
  }

  useEffect(() => {
    void loadQueue()
  }, [])

  function handleSend(type, summary) {
    if (busyType) {
      return
    }

    if (!summary.entries) {
      setSendState({
        type: '',
        error: '',
        success: `No ${type} notifications are waiting.`,
        log: '',
      })
      return
    }

    if (!window.confirm(`Send ${type} wishlist notifications to ${summary.users} user${summary.users === 1 ? '' : 's'} now?`)) {
      return
    }

    setSendState({
      type,
      error: '',
      success: '',
      log: '',
    })

    void sendWishlistNotifications(type)
      .then((result) => {
        setSendState({
          type: '',
          error: '',
          success: `${type === 'discount' ? 'Discount' : 'Stock'} notifications sent.`,
          log: result?.log || '',
        })
        void loadQueue({ quiet: true })
      })
      .catch((sendError) => {
        setSendState({
          type: '',
          error: sendError?.message || `Could not send ${type} notifications.`,
          success: '',
          log: '',
        })
      })
  }

  const cards = [
    {
      type: 'discount',
      title: 'Discount alerts',
      description: 'Wishlisted products whose discount changed and are waiting for a manager-triggered email.',
      summary: discountSummary,
    },
    {
      type: 'stock',
      title: 'Stock alerts',
      description: 'Wishlisted products that came back in stock and are waiting for a manager-triggered email.',
      summary: stockSummary,
    },
  ]

  return (
    <section id="wishlist-queue" className="aurora-ops-panel p-8">
      <div className="aurora-widget-header">
        <div className="aurora-widget-heading">
          <p className="text-sm font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
            Wishlist queue
          </p>
          <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
            Send queued wishlist emails
          </h2>
        </div>
        <LiquidGlassButton
          type="button"
          variant="quiet"
          size="compact"
          disabled={queueState.loading || Boolean(busyType)}
          onClick={() => {
            void loadQueue()
          }}
        >
          Refresh queue
        </LiquidGlassButton>
      </div>

      {queueState.error ? (
        <div className="aurora-message aurora-message-error mt-6">{queueState.error}</div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {cards.map((card) => (
          <article key={card.type} className="aurora-ops-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
                  {card.summary.entries} queued
                </p>
                <h3 className="mt-3 text-xl font-semibold text-[var(--aurora-text-strong)]">
                  {card.title}
                </h3>
              </div>
              <p className="text-right text-sm font-semibold text-[var(--aurora-text-strong)]">
                {card.summary.users} user{card.summary.users === 1 ? '' : 's'}
              </p>
            </div>

            <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
              {card.description}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
                  Products
                </p>
                <p className="mt-1 font-semibold text-[var(--aurora-text-strong)]">
                  {card.summary.products}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
                  Entries
                </p>
                <p className="mt-1 font-semibold text-[var(--aurora-text-strong)]">
                  {card.summary.entries}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
                  Blocked
                </p>
                <p className="mt-1 font-semibold text-[var(--aurora-text-strong)]">
                  {card.summary.blockedUsers}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--aurora-border)] pt-4">
              <LiquidGlassButton
                type="button"
                variant={card.type === 'discount' ? 'secondary' : 'soft'}
                size="compact"
                loading={busyType === card.type}
                disabled={queueState.loading || Boolean(busyType) || !card.summary.entries}
                onClick={() => {
                  handleSend(card.type, card.summary)
                }}
              >
                Send {card.type}
              </LiquidGlassButton>
              <p className="text-sm leading-7 text-[var(--aurora-text)]">
                Requires confirmation before sending.
              </p>
            </div>
          </article>
        ))}
      </div>

      {sendState.error ? (
        <div className="aurora-message aurora-message-error mt-6">{sendState.error}</div>
      ) : null}
      {sendState.success ? (
        <div className="aurora-message aurora-message-success mt-6">{sendState.success}</div>
      ) : null}
      {sendState.log ? (
        <pre className="mt-4 max-h-48 overflow-auto rounded-[1.2rem] border border-[var(--aurora-border)] bg-[var(--aurora-surface-muted)] p-4 text-xs leading-6 text-[var(--aurora-text)]">
          {sendState.log}
        </pre>
      ) : null}
    </section>
  )
}

function buildProductPricingForm(product) {
  return {
    price: String(roundCurrency(product?.price)),
    cost: String(roundCurrency(product?.cost)),
    discountRate: String(roundCurrency(product?.discountRate)),
    taxRate: String(roundCurrency(product?.taxRate ?? 0)),
  }
}

function buildVariantPricingForm(variant) {
  return {
    priceAdd: String(roundCurrency(variant?.priceAdd)),
    priceMult: String(roundFactor(variant?.priceMult ?? 1)),
    cost: String(roundCurrency(variant?.cost)),
    discountRate: String(roundCurrency(variant?.discountRate)),
  }
}

function ProductPricingPanel({ products, loading, error }) {
  const sortedProducts = useMemo(
    () => [...products].sort((left, right) => left.name.localeCompare(right.name)),
    [products],
  )
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [productForm, setProductForm] = useState(() => buildProductPricingForm(null))
  const [variantForm, setVariantForm] = useState(() => buildVariantPricingForm(null))
  const [saveState, setSaveState] = useState({
    target: '',
    error: '',
    success: '',
  })

  const selectedProduct = useMemo(
    () => sortedProducts.find((product) => String(product.id) === String(selectedProductId)) || null,
    [selectedProductId, sortedProducts],
  )
  const selectedVariant = useMemo(
    () => (selectedProduct?.variants || []).find((variant) => String(variant.id) === String(selectedVariantId)) || null,
    [selectedProduct, selectedVariantId],
  )

  useEffect(() => {
    if (!selectedProductId && sortedProducts.length) {
      setSelectedProductId(String(sortedProducts[0].id))
    }
  }, [selectedProductId, sortedProducts])

  useEffect(() => {
    setProductForm(buildProductPricingForm(selectedProduct))
    setSelectedVariantId((currentVariantId) => (
      selectedProduct?.variants?.some((variant) => String(variant.id) === String(currentVariantId))
        ? currentVariantId
        : ''
    ))
  }, [selectedProduct])

  useEffect(() => {
    setVariantForm(buildVariantPricingForm(selectedVariant))
  }, [selectedVariant])

  const hasVariants = Boolean(selectedProduct?.variants?.length)
  const variantPreviewPrice = selectedVariant
    ? getVariantTotalPrice(selectedProduct?.price || 0, variantForm.priceAdd, variantForm.priceMult)
    : null

  function updateProductField(field, value) {
    setProductForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateVariantField(field, value) {
    setVariantForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSaveProductPricing() {
    if (!selectedProduct) {
      return
    }

    setSaveState({ target: 'product', error: '', success: '' })

    try {
      const nextPrice = roundCurrency(normalizePricingNumber(productForm.price, 'Price'))
      const nextCost = roundCurrency(normalizePricingNumber(productForm.cost, 'Manufacturing cost'))
      const nextDiscount = roundCurrency(normalizePricingNumber(productForm.discountRate, 'Discount', { max: 100 }))
      const nextTax = roundCurrency(normalizePricingNumber(productForm.taxRate, 'Tax', { max: 100 }))
      const edits = {}

      if (nextPrice !== roundCurrency(selectedProduct.price)) edits.price = nextPrice
      if (nextCost !== roundCurrency(selectedProduct.cost)) edits.cost = nextCost
      if (nextDiscount !== roundCurrency(selectedProduct.discountRate)) edits.discount_rate = nextDiscount
      if (nextTax !== roundCurrency(selectedProduct.taxRate ?? 0)) edits.tax = nextTax

      await updateProductDetails(selectedProduct.id, edits)
      setSaveState({
        target: '',
        error: '',
        success: 'Product pricing updated.',
      })
    } catch (saveError) {
      setSaveState({
        target: '',
        error: saveError?.message || 'Could not update product pricing.',
        success: '',
      })
    }
  }

  async function handleSaveVariantPricing() {
    if (!selectedVariant) {
      return
    }

    setSaveState({ target: 'variant', error: '', success: '' })

    try {
      const nextPriceAdd = roundCurrency(normalizePricingNumber(variantForm.priceAdd, 'Addition factor'))
      const nextPriceMult = roundFactor(normalizePricingNumber(variantForm.priceMult, 'Multiplication factor'))
      const nextCost = roundCurrency(normalizePricingNumber(variantForm.cost, 'Variant cost'))
      const nextDiscount = roundCurrency(normalizePricingNumber(variantForm.discountRate, 'Variant discount', { max: 100 }))
      const edits = {}

      if (nextPriceAdd !== roundCurrency(selectedVariant.priceAdd)) edits.price_add = nextPriceAdd
      if (nextPriceMult !== roundFactor(selectedVariant.priceMult ?? 1)) edits.price_mult = nextPriceMult
      if (nextCost !== roundCurrency(selectedVariant.cost)) edits.cost = nextCost
      if (nextDiscount !== roundCurrency(selectedVariant.discountRate)) edits.discount_rate = nextDiscount

      await updateProductVariant(selectedVariant.id, edits)
      setSaveState({
        target: '',
        error: '',
        success: 'Variant pricing updated.',
      })
    } catch (saveError) {
      setSaveState({
        target: '',
        error: saveError?.message || 'Could not update variant pricing.',
        success: '',
      })
    }
  }

  return (
    <section id="product-pricing" className="aurora-ops-panel p-8">
      <div className="aurora-widget-header">
        <div className="aurora-widget-heading">
          <p className="text-sm font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
            Product pricing
          </p>
          <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
            Update prices, costs, tax, and discounts
          </h2>
        </div>
        <span className="aurora-order-status-chip is-processing">
          {loading ? 'Syncing' : `${sortedProducts.length} products`}
        </span>
      </div>

      {error ? (
        <div className="aurora-message aurora-message-error mt-6" role="alert">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
            Product
          </span>
          <select
            className="aurora-select mt-3"
            value={selectedProductId}
            onChange={(event) => {
              setSelectedProductId(event.target.value)
              setSaveState({ target: '', error: '', success: '' })
            }}
          >
            {!sortedProducts.length ? <option value="">No products available</option> : null}
            {sortedProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <div className="aurora-widget-subsurface p-4 text-sm leading-7 text-[var(--aurora-text)]">
          {selectedProduct
            ? `${selectedProduct.categoryName || 'Catalog'} · ${selectedProduct.productCode || selectedProduct.id}`
            : 'Choose a product to edit.'}
        </div>
      </div>

      {saveState.error ? (
        <div className="aurora-message aurora-message-error mt-6" role="alert">{saveState.error}</div>
      ) : null}
      {saveState.success ? (
        <div className="aurora-message aurora-message-success mt-6" role="status" aria-live="polite">{saveState.success}</div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="aurora-ops-card p-5">
          <div className="aurora-widget-heading">
            <p className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
              Base product
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--aurora-text-strong)]">
              {selectedProduct?.name || 'Product pricing'}
            </h3>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">Price</span>
              <input className="aurora-input mt-2" type="number" min="0" step="0.01" value={productForm.price} onChange={(event) => updateProductField('price', event.target.value)} />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">Cost</span>
              <input className="aurora-input mt-2" type="number" min="0" step="0.01" value={productForm.cost} onChange={(event) => updateProductField('cost', event.target.value)} />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">Discount %</span>
              <input className="aurora-input mt-2" type="number" min="0" max="100" step="0.01" value={productForm.discountRate} onChange={(event) => updateProductField('discountRate', event.target.value)} />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">Tax %</span>
              <input className="aurora-input mt-2" type="number" min="0" max="100" step="1" value={productForm.taxRate} onChange={(event) => updateProductField('taxRate', event.target.value)} />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--aurora-border)] pt-4">
            <p className="text-sm leading-7 text-[var(--aurora-text)]">
              Current sale price {formatCurrency((Number(productForm.price) || 0) * ((100 - (Number(productForm.discountRate) || 0)) / 100))}
            </p>
            <LiquidGlassButton
              type="button"
              variant="secondary"
              size="compact"
              loading={saveState.target === 'product'}
              disabled={!selectedProduct || Boolean(saveState.target)}
              onClick={() => {
                void handleSaveProductPricing()
              }}
            >
              Save product pricing
            </LiquidGlassButton>
          </div>
        </article>

        <article className="aurora-ops-card p-5">
          <div className="aurora-widget-heading">
            <p className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
              Variant pricing
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--aurora-text-strong)]">
              {hasVariants ? 'Variant price factors' : 'No variants on this product'}
            </h3>
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
              Variant
            </span>
            <select
              className="aurora-select mt-3"
              value={selectedVariantId}
              disabled={!hasVariants}
              onChange={(event) => {
                setSelectedVariantId(event.target.value)
                setSaveState({ target: '', error: '', success: '' })
              }}
            >
              <option value="">{hasVariants ? 'Choose a variant' : 'No variants available'}</option>
              {(selectedProduct?.variants || []).map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.variantCode || `Variant ${variant.id}`}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">Price add</span>
              <input className="aurora-input mt-2" type="number" min="0" step="0.01" disabled={!selectedVariant} value={variantForm.priceAdd} onChange={(event) => updateVariantField('priceAdd', event.target.value)} />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">Price multiplier</span>
              <input className="aurora-input mt-2" type="number" min="0" step="0.0001" disabled={!selectedVariant} value={variantForm.priceMult} onChange={(event) => updateVariantField('priceMult', event.target.value)} />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">Variant cost</span>
              <input className="aurora-input mt-2" type="number" min="0" step="0.01" disabled={!selectedVariant} value={variantForm.cost} onChange={(event) => updateVariantField('cost', event.target.value)} />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">Variant discount %</span>
              <input className="aurora-input mt-2" type="number" min="0" max="100" step="0.01" disabled={!selectedVariant} value={variantForm.discountRate} onChange={(event) => updateVariantField('discountRate', event.target.value)} />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--aurora-border)] pt-4">
            <p className="text-sm leading-7 text-[var(--aurora-text)]">
              {selectedVariant
                ? `Preview ${formatCurrency(variantPreviewPrice)} before variant discount.`
                : 'Select a variant to edit its price factors.'}
            </p>
            <LiquidGlassButton
              type="button"
              variant="secondary"
              size="compact"
              loading={saveState.target === 'variant'}
              disabled={!selectedVariant || Boolean(saveState.target)}
              onClick={() => {
                void handleSaveVariantPricing()
              }}
            >
              Save variant pricing
            </LiquidGlassButton>
          </div>
        </article>
      </div>
    </section>
  )
}

export default function SalesManagerPage() {
  const [viewerRole] = useState(() => normalizeUserRole(getAuthStateSnapshot().user?.role))
  const { products, loading: productsLoading, error: productsError } = useProductCatalog()
  const [orders, setOrders] = useState([])
  const [salesAnalytics, setSalesAnalytics] = useState(null)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [query, setQuery] = useState('')
  const [orderDateStartFilter, setOrderDateStartFilter] = useState('')
  const [orderDateEndFilter, setOrderDateEndFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [refundBusyKey, setRefundBusyKey] = useState('')
  const [error, setError] = useState('')
  const [analyticsError, setAnalyticsError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [pendingDeliveredStatus, setPendingDeliveredStatus] = useState('')
  const [activeTab, setActiveTab] = useState('analytics')
  const isProductManagerView = viewerRole === userRoles.productManager

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

    if (isProductManagerView) {
      setSalesAnalytics(null)
      setAnalyticsLoading(false)
      setAnalyticsError('')
      return () => {
        active = false
      }
    }

    setAnalyticsLoading(true)
    setAnalyticsError('')

    void fetchSalesAnalytics()
      .then((nextAnalytics) => {
        if (!active) {
          return
        }

        setSalesAnalytics(nextAnalytics)
      })
      .catch((nextAnalyticsError) => {
        if (!active) {
          return
        }

        setSalesAnalytics(null)
        setAnalyticsError(nextAnalyticsError?.message || 'Could not load sales analytics.')
      })
      .finally(() => {
        if (active) {
          setAnalyticsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [isProductManagerView])

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
    const normalizedStartDate = orderDateStartFilter.trim()
    const normalizedEndDate = orderDateEndFilter.trim()
    const [dateRangeStart, dateRangeEnd] = normalizedStartDate && normalizedEndDate && normalizedStartDate > normalizedEndDate
      ? [normalizedEndDate, normalizedStartDate]
      : [normalizedStartDate, normalizedEndDate]

    return orders.filter((order) => {
      const statusMatches = statusFilter === 'all' || order.statusKey === statusFilter
      const orderDate = getDateInputValue(order.submittedAt || order.createdAt)
      const dateMatches =
        (!dateRangeStart || orderDate >= dateRangeStart) &&
        (!dateRangeEnd || orderDate <= dateRangeEnd)
      const queryMatches = !normalizedQuery || [
        order.id,
        order.purchaseId,
        order.statusLabel,
        order.submittedAt,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery))

      return statusMatches && dateMatches && queryMatches
    })
  }, [orderDateEndFilter, orderDateStartFilter, orders, query, statusFilter])
  const selectedOrderIndex = filteredOrders.findIndex((order) => order.id === selectedOrderId)
  const selectedStatus = selectedOrder?.statusKey || selectedOrder?.status || ''
  const selectedSummary = orders.find((order) => order.id === selectedOrderId) || null
  const selectedRefundItems = useMemo(
    () => (selectedOrder?.items || []).filter((item) => (
      item.refundRequested || item.refunded || item.refundRejected
    )),
    [selectedOrder],
  )
  const selectedDeliveryAddressLines = useMemo(
    () => getDeliveryAddressLines(selectedOrder?.delivery),
    [selectedOrder],
  )
  const pendingRefundCount = selectedRefundItems.filter((item) => (
    item.refundRequested && !item.refunded && !item.refundRejected
  )).length
  const statusBreakdown = useMemo(
    () => orderStatusOptions
      .map((status) => {
        const presentation = getOrderStatusPresentation(status)

        return {
          key: presentation.key,
          label: presentation.label,
          count: orders.filter((order) => order.statusKey === presentation.key).length,
        }
      })
      .filter((status) => status.count > 0),
    [orders],
  )
  const activeTabDescription =
    salesManagerTabs.find((tab) => tab.key === activeTab)?.description ||
    salesManagerTabs[0].description

  const handleRefresh = async () => {
    setOrdersLoading(true)
    setAnalyticsLoading(!isProductManagerView)
    setFeedback('')
    setError('')
    setAnalyticsError('')

    try {
      const [ordersResult, analyticsResult] = await Promise.allSettled([
        fetchAdminOrders(),
        isProductManagerView ? Promise.resolve(null) : fetchSalesAnalytics(),
      ])

      if (ordersResult.status === 'fulfilled') {
        const nextOrders = ordersResult.value

        setOrders(nextOrders)
        setSelectedOrderId((currentOrderId) => (
          currentOrderId && nextOrders.some((order) => order.id === currentOrderId)
            ? currentOrderId
            : nextOrders[0]?.id || ''
        ))
      } else {
        setError(ordersResult.reason?.message || 'Could not refresh orders.')
      }

      if (analyticsResult.status === 'fulfilled') {
        setSalesAnalytics(analyticsResult.value)
      } else if (!isProductManagerView) {
        setAnalyticsError(analyticsResult.reason?.message || 'Could not refresh sales analytics.')
      }

      if (ordersResult.status === 'fulfilled' || analyticsResult.status === 'fulfilled') {
        setFeedback(isProductManagerView ? 'Shipping queue refreshed.' : 'Sales manager data refreshed.')
      }
    } catch (refreshError) {
      setError(refreshError?.message || 'Could not refresh orders.')
    } finally {
      setOrdersLoading(false)
      if (!isProductManagerView) {
        setAnalyticsLoading(false)
      }
    }
  }

  const handleRefundDecision = async (item, action) => {
    const busyKey = `${selectedOrderId}:${item.cartId}:${action}`

    setRefundBusyKey(busyKey)
    setFeedback('')
    setError('')

    try {
      const result = await processOrderRefund(selectedOrderId, item.cartId, action)
      const [nextOrders, nextOrder] = await Promise.all([
        fetchAdminOrders(),
        fetchAdminOrderById(selectedOrderId),
      ])

      setOrders(nextOrders)
      setSelectedOrder(nextOrder)
      setFeedback(
        result?.message ||
          result?.msg ||
          (action === 'approve'
            ? 'Refund processed successfully.'
            : 'Refund request rejected successfully.'),
      )
    } catch (refundError) {
      setError(refundError?.message || 'Could not process refund request.')
    } finally {
      setRefundBusyKey('')
    }
  }

  const applyStatusChange = async (nextStatus) => {
    setStatusBusy(true)
    setFeedback('')
    setError('')
    setPendingDeliveredStatus('')

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

  const handleStatusChange = async (event) => {
    const nextStatus = event.target.value

    if (!selectedOrderId || !nextStatus || nextStatus === selectedStatus) {
      return
    }

    if (nextStatus === 'delivered') {
      setPendingDeliveredStatus(nextStatus)
      return
    }

    await applyStatusChange(nextStatus)
  }

  const handleDeliveredConfirm = () => {
    if (!pendingDeliveredStatus) {
      return
    }

    void applyStatusChange(pendingDeliveredStatus)
  }

  const handleDeliveredCancel = () => {
    setPendingDeliveredStatus('')
  }

  const handleCopyDeliveryAddress = async () => {
    if (!selectedDeliveryAddressLines.length) {
      return
    }

    setFeedback('')
    setError('')

    try {
      await navigator.clipboard.writeText(selectedDeliveryAddressLines.join('\n'))
      setFeedback('Delivery address copied.')
    } catch {
      setError('Could not copy the delivery address.')
    }
  }

  return (
    <RoleOverviewLayout
      eyebrow={isProductManagerView ? 'Product manager' : 'Sales manager'}
      title={isProductManagerView ? 'Review shipping details' : 'Manage live orders'}
      description={isProductManagerView
        ? 'A focused fulfillment view for order lookup, delivery review, and shipping status.'
        : 'A focused fulfillment console for order lookup, invoice access, delivery review, and status movement.'}
    >
      <div className="aurora-sales-manager-page space-y-6">
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

        {!isProductManagerView ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm leading-7 text-[var(--aurora-text)]">
                {ordersLoading ? 'Syncing order data.' : 'Backend-backed sales tools are active.'}
              </p>
              <p className="max-w-2xl text-sm leading-7 text-[var(--aurora-text)]">
                {activeTabDescription}
              </p>
            </div>

            <section className="aurora-widget-subsurface p-3">
              <div className="grid gap-2 md:grid-cols-4" role="tablist" aria-label="Sales manager sections">
                {salesManagerTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.key ? 'true' : 'false'}
                    className={`aurora-sales-order-row rounded-[1.1rem] px-4 py-3 text-center text-sm font-semibold transition ${activeTab === tab.key ? 'is-selected' : ''}`.trim()}
                    onClick={() => {
                      setActiveTab(tab.key)
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {!isProductManagerView && activeTab === 'analytics' ? (
          <div className="space-y-4">
            <SalesAnalyticsGraph
              analytics={salesAnalytics}
              loading={analyticsLoading}
              error={analyticsError}
            />
            <SalesGraphicsPanel orders={orders} statusBreakdown={statusBreakdown} />
          </div>
        ) : null}

        {!isProductManagerView && activeTab === 'wishlist' ? (
          <WishlistQueuePanel />
        ) : null}

        {!isProductManagerView && activeTab === 'pricing' ? (
          <ProductPricingPanel
            products={products}
            loading={productsLoading}
            error={productsError}
          />
        ) : null}

      {(isProductManagerView || activeTab === 'orders') ? (
      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-8">
          <section id="activity" className="aurora-ops-panel p-8">
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
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

            <div className="mt-6 grid gap-3 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)_220px]">
              <label className="block">
                <span className="sr-only">Search orders</span>
                <input
                  type="search"
                  className="aurora-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search order number, purchase id, or status"
                />
              </label>
              <OrderDateRangePicker
                startDate={orderDateStartFilter}
                endDate={orderDateEndFilter}
                onStartDateChange={setOrderDateStartFilter}
                onEndDateChange={setOrderDateEndFilter}
              />
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
                  Fetching the order list from the backend.
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
                  Clear the search, date range, or status filter to return to the full queue.
                </p>
              </div>
            ) : (
              <div className="aurora-widget-subsurface mt-8">
                <div className="grid grid-cols-[minmax(0,1.2fr)_140px_120px] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)] max-md:hidden">
                  <span>Order</span>
                  <span>Date</span>
                  <span className="text-right">Status</span>
                </div>
                <div className="aurora-sales-table-divider max-h-[560px] divide-y overflow-y-auto overscroll-contain">
                  {filteredOrders.map((order) => {
                  const status = getOrderStatusPresentation(order)
                  const selected = order.id === selectedOrderId

                  return (
                    <button
                      key={order.id}
                      type="button"
                      className={`aurora-sales-order-row grid w-full gap-4 px-5 py-4 text-left transition md:grid-cols-[minmax(0,1.2fr)_140px_120px] md:items-center ${selected ? 'is-selected' : ''}`.trim()}
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
                  <p className="text-sm font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
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
                    <div className={`grid gap-4 ${isProductManagerView ? 'sm:grid-cols-2' : 'sm:grid-cols-4'}`}>
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
                      {!isProductManagerView ? (
                        <>
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
                        </>
                      ) : null}
                    </div>
                  </div>

                  {!isProductManagerView ? (
                    <div className="aurora-widget-subsurface p-5">
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                      <label>
                        <span className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
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
                          managerScope
                          onError={(message) => setError(message)}
                          onSuccess={() => setFeedback('PDF download started.')}
                        />
                        <LiquidGlassButton as={Link} to="/products" variant="quiet" size="compact">
                          Catalog
                        </LiquidGlassButton>
                      </div>
                    </div>
                  </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="aurora-widget-subsurface p-5">
                      <p className="aurora-kicker">Delivery</p>
                      <p className="mt-3 text-sm font-semibold text-[var(--aurora-text-strong)]">
                        {selectedOrder.delivery?.fullName || 'Customer name unavailable'}
                      </p>
                      {selectedDeliveryAddressLines.length ? (
                        <div className="mt-3 space-y-1">
                          {selectedDeliveryAddressLines
                            .slice(selectedOrder.delivery?.fullName ? 1 : 0)
                            .map((line, index) => (
                              <p key={`${line}-${index}`} className="text-sm leading-7 text-[var(--aurora-text)]">
                                {line}
                              </p>
                            ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                          {getOrderLocation(selectedOrder)}
                        </p>
                      )}
                      <div className="mt-4">
                        <LiquidGlassButton
                          type="button"
                          variant="quiet"
                          size="compact"
                          disabled={!selectedDeliveryAddressLines.length}
                          onClick={handleCopyDeliveryAddress}
                        >
                          Copy address
                        </LiquidGlassButton>
                      </div>
                    </div>

                    {!isProductManagerView ? (
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
                    ) : null}
                  </div>

                  {!isProductManagerView && selectedRefundItems.length ? (
                    <div className="aurora-widget-subsurface p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="aurora-kicker">Refund review</p>
                          <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                            {pendingRefundCount
                              ? `${pendingRefundCount} item${pendingRefundCount === 1 ? '' : 's'} awaiting a manager decision.`
                              : 'No pending refund decisions remain for this order.'}
                          </p>
                        </div>
                        <span className={`aurora-order-status-chip ${pendingRefundCount ? 'is-processing' : 'is-delivered'} inline-flex`}>
                          {pendingRefundCount ? 'Pending' : 'Reviewed'}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {!isProductManagerView ? (
                    <div className="aurora-widget-subsurface p-5">
                    <div className="flex items-center justify-between gap-4">
                      <p className="aurora-kicker">Items</p>
                      <p className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                        {formatCurrency(selectedOrder.subtotal)}
                      </p>
                    </div>
                    <div className="aurora-sales-item-divider mt-4 divide-y">
                      {selectedOrder.items.map((item) => {
                        const refundStatus = getRefundStatus(item)
                        const hasPendingRefund = refundStatus?.key === 'requested'
                        const approveBusyKey = `${selectedOrderId}:${item.cartId}:approve`
                        const rejectBusyKey = `${selectedOrderId}:${item.cartId}:reject`
                        const missingRefundItemId = item.cartId === null || item.cartId === undefined || item.cartId === ''

                        return (
                          <div key={`${item.lineItemId || item.productId}:${item.variantId || item.variantCode || item.name}`} className="py-3 text-sm">
                            <div className="flex items-start justify-between gap-4">
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

                            {refundStatus ? (
                              <div className="aurora-widget-subsurface mt-4 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <span className={`aurora-order-status-chip ${refundStatus.chipClass} inline-flex`}>
                                      {refundStatus.label}
                                    </span>
                                    {item.refundMessage ? (
                                      <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                                        {item.refundMessage}
                                      </p>
                                    ) : null}
                                    {missingRefundItemId && hasPendingRefund ? (
                                      <p className="aurora-message aurora-message-error mt-3" role="alert">
                                        This refund request is missing the item identifier required by the backend.
                                      </p>
                                    ) : null}
                                  </div>

                                  {hasPendingRefund ? (
                                    <div className="aurora-widget-actions justify-end">
                                      <LiquidGlassButton
                                        type="button"
                                        variant="danger"
                                        size="compact"
                                        aria-label={`Reject refund for ${item.name}`}
                                        loading={refundBusyKey === rejectBusyKey}
                                        disabled={Boolean(refundBusyKey) || missingRefundItemId}
                                        onClick={() => {
                                          void handleRefundDecision(item, 'reject')
                                        }}
                                      >
                                        Reject
                                      </LiquidGlassButton>
                                      <LiquidGlassButton
                                        type="button"
                                        variant="secondary"
                                        size="compact"
                                        aria-label={`Approve refund for ${item.name}`}
                                        loading={refundBusyKey === approveBusyKey}
                                        disabled={Boolean(refundBusyKey) || missingRefundItemId}
                                        onClick={() => {
                                          void handleRefundDecision(item, 'approve')
                                        }}
                                      >
                                        Approve refund
                                      </LiquidGlassButton>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </section>
        </div>
      </div>
      ) : null}
      </div>

      {pendingDeliveredStatus ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(38,30,23,0.32)] px-4 py-8 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleDeliveredCancel()
            }
          }}
        >
          <div
            className="aurora-summary-card w-full max-w-lg p-6 shadow-[0_30px_90px_rgba(73,53,36,0.24)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delivered-confirm-title"
            aria-describedby="delivered-confirm-description"
          >
            <div className="aurora-widget-body gap-5">
              <div>
                <p className="aurora-kicker">Confirm delivery</p>
                <h2
                  id="delivered-confirm-title"
                  className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]"
                >
                  Mark this order as delivered?
                </h2>
                <p
                  id="delivered-confirm-description"
                  className="mt-4 text-sm leading-7 text-[var(--aurora-text)]"
                >
                  Once this order is delivered, the customer who purchased it will be able to
                  leave a product review.
                </p>
              </div>

              <div className="aurora-widget-subsurface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="aurora-kicker">Order</p>
                    <p className="mt-2 font-semibold text-[var(--aurora-text-strong)]">
                      {selectedOrder?.displayId || selectedOrder?.id || 'Selected order'}
                    </p>
                  </div>
                  <span className="aurora-order-status-chip is-delivered inline-flex">
                    Delivered
                  </span>
                </div>
              </div>

              <div className="aurora-widget-actions justify-end">
                <LiquidGlassButton
                  type="button"
                  variant="quiet"
                  size="compact"
                  onClick={handleDeliveredCancel}
                >
                  Keep current status
                </LiquidGlassButton>
                <LiquidGlassButton
                  type="button"
                  size="compact"
                  onClick={handleDeliveredConfirm}
                  disabled={statusBusy}
                >
                  Confirm delivered
                </LiquidGlassButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </RoleOverviewLayout>
  )
}
