import { Link } from 'react-router-dom'
import RoleOverviewLayout from '../components/RoleOverviewLayout'
import { getOrderHistory } from '../lib/accountData'
import { getOrderStatus } from '../lib/accountActions'

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
      description="This landing page is focused on customer-facing operations: recent order movement, active fulfillment states, and the next likely actions for keeping the storefront responsive."
    >
      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Orders tracked
              </p>
              <p className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                {orders.length}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                Demo order history visible in this browser session.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Active orders
              </p>
              <p className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                {activeOrders.length}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                Orders still moving through receiving, prep, or delivery.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Delivered
              </p>
              <p className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                {deliveredOrders.length}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                Orders that have completed the current demo status flow.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                Tracked value
              </p>
              <p className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                {formatCurrency(orderValue)}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
                Combined value across the orders currently visible here.
              </p>
            </div>
          </section>

          <section
            id="activity"
            className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
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
                Open storefront
              </Link>
            </div>

            {!recentOrders.length ? (
              <div className="mt-8 rounded-[2rem] border border-dashed border-[rgba(138,144,119,0.35)] bg-[rgba(255,247,242,0.72)] px-6 py-10 text-center">
                <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                  No order activity yet
                </p>
                <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                  Once demo checkout is used in this browser, the latest order movement
                  will appear here for operational review.
                </p>
              </div>
            ) : (
              <div className="mt-8 space-y-4">
                {recentOrders.map((order) => (
                  <article
                    key={order.reference}
                    className="rounded-[1.75rem] border border-[rgba(138,144,119,0.18)] bg-[rgba(255,247,242,0.94)] p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                          {order.reference}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-[var(--aurora-text-strong)]">
                          {getOrderStatus(order)}
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-[var(--aurora-text)]">
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
          <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
              Quick actions
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#activity"
                className="rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-5 py-3 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_10px_24px_rgba(144,180,196,0.22)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
              >
                Review latest orders
              </a>
              <Link
                to="/products"
                className="rounded-full border border-[#d89270] bg-[var(--aurora-primary)] px-5 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] shadow-[0_10px_24px_rgba(235,176,144,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-primary-soft)]"
              >
                View live catalog
              </Link>
              <Link
                to="/"
                className="rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.92)] px-5 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-cream)]"
              >
                Browse storefront
              </Link>
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(230,232,222,0.44)] p-8 shadow-[0_24px_70px_rgba(138,144,119,0.1)] backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
              Operations focus
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--aurora-text)]">
              <li>Track which orders are still in prep or delivery.</li>
              <li>Watch for growing activity as the storefront gets used more often.</li>
              <li>Keep the public buying flow aligned with actual order movement.</li>
            </ul>
          </section>
        </div>
      </div>
    </RoleOverviewLayout>
  )
}
