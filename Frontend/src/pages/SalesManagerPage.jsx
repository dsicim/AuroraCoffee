import { Link } from 'react-router-dom'
import LiquidGlassButton from '../components/LiquidGlassButton'
import RoleOverviewLayout from '../components/RoleOverviewLayout'
import { getOrderHistory } from '../lib/accountData'
import { getOrderStatus } from '../lib/accountActions'
import { formatCurrency } from '../lib/currency'

function formatTimestamp(value) {
  return new Date(value).toLocaleString('en-GB', {
    hour12: false,
  })
}

export default function SalesManagerPage() {
  const orders = getOrderHistory()
  const activeOrders = orders.filter((order) => getOrderStatus(order) !== 'Delivered')
  const deliveredOrders = orders.filter((order) => getOrderStatus(order) === 'Delivered')
  const orderValue = orders.reduce((total, order) => total + order.total, 0)
  const recentOrders = orders.slice(0, 4)

  return (
    <RoleOverviewLayout
      eyebrow="Sales manager"
      title="Oversee the current order pulse"
      description="This landing page is focused on customer-facing operations: recent order movement, active fulfillment states, and the next likely actions for keeping service responsive."
    >
      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          <section className="aurora-summary-strip">
            <div className="aurora-summary-lead p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="aurora-kicker">Order pulse</p>
                  <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                    {activeOrders.length} active order{activeOrders.length === 1 ? '' : 's'}
                  </h2>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  Customer-facing operations should open with the active queue, not a wall of equal metrics.
                </p>
              </div>
            </div>

            <div className="aurora-summary-card p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Orders tracked
                  </p>
                  <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                    {orders.length}
                  </p>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  Order history currently visible in this browser session.
                </p>
              </div>
            </div>

            <div className="aurora-summary-card p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Delivered
                  </p>
                  <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                    {deliveredOrders.length}
                  </p>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  Orders that have completed the current delivery status flow.
                </p>
              </div>
            </div>

            <div className="aurora-summary-card p-6">
              <div className="aurora-widget-body">
                <div className="aurora-widget-heading">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Tracked value
                  </p>
                  <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                    {formatCurrency(orderValue)}
                  </p>
                </div>
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  Combined value across the orders currently visible here.
                </p>
              </div>
            </div>
          </section>

          <section
            id="activity"
            className="aurora-ops-panel p-8"
          >
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Recent activity
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Orders that need attention first
                </h2>
              </div>
              <Link
                to="/"
                className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
              >
                Open site
              </Link>
            </div>

            {!recentOrders.length ? (
              <div className="aurora-ops-card mt-8 border-dashed px-6 py-10 text-center">
                <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                  No order activity yet
                </p>
                <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                  Once checkout is used in this browser, the latest order movement
                  will appear here for operational review.
                </p>
              </div>
            ) : (
              <div className="mt-8 space-y-4">
                {recentOrders.map((order) => (
                  <article
                    key={order.reference}
                    className="aurora-ops-card p-5"
                  >
                    <div className="aurora-widget-header">
                      <div className="aurora-widget-heading">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                          {order.reference}
                        </p>
                        <h3 className="text-xl font-semibold text-[var(--aurora-text-strong)]">
                          {getOrderStatus(order)}
                        </h3>
                        <p className="text-sm leading-7 text-[var(--aurora-text)]">
                          {order.items.reduce((total, item) => total + item.quantity, 0)} item
                          {order.items.reduce((total, item) => total + item.quantity, 0) === 1 ? '' : 's'} ·{' '}
                          {order.delivery.city}, {order.delivery.postalCode}
                        </p>
                      </div>
                      <div className="text-sm text-[var(--aurora-text)] sm:text-right">
                        <p>{formatTimestamp(order.submittedAt)}</p>
                        <p className="mt-2 font-semibold text-[var(--aurora-text-strong)]">
                          {formatCurrency(order.total)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section className="aurora-ops-panel p-8">
            <div className="aurora-widget-body">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Quick actions
                </p>
              </div>
              <div className="aurora-widget-actions">
              <LiquidGlassButton
                as="a"
                href="#activity"
                variant="secondary"
              >
                Review latest orders
              </LiquidGlassButton>
              <LiquidGlassButton
                as={Link}
                to="/products"
                variant="secondary"
              >
                View live catalog
              </LiquidGlassButton>
              <LiquidGlassButton
                as={Link}
                to="/"
                variant="quiet"
              >
                Browse site
              </LiquidGlassButton>
              </div>
            </div>
          </section>

          <section className="aurora-solid-plate rounded-[2.5rem] p-8">
            <div className="aurora-widget-body">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Operations focus
                </p>
              </div>
              <div className="aurora-widget-subsurface p-5">
                <ul className="space-y-3 text-sm leading-7 text-[var(--aurora-text)]">
                  <li>Track which orders are still in prep or delivery.</li>
                  <li>Watch for growing activity as the site gets used more often.</li>
                  <li>Keep the public buying flow aligned with actual order movement.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </RoleOverviewLayout>
  )
}
