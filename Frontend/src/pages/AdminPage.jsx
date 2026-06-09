import { Link } from 'react-router-dom'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
import RoleOverviewLayout from '../components/RoleOverviewLayout'
import { roleAccessLevels, userRoles } from '../features/auth/domain/roles'

const adminWorkspaceNotes = {
  [userRoles.customer]: 'Review account tools, orders, addresses, cards, and favorites.',
  [userRoles.productManager]: 'Update catalog details, stock, images, categories, and comment queues.',
  [userRoles.salesManager]: 'Review live orders, invoices, delivery state, and fulfillment status.',
}

const adminWorkspaces = roleAccessLevels
  .filter(({ role }) => role !== userRoles.admin)
  .map((workspace) => ({
    ...workspace,
    description: adminWorkspaceNotes[workspace.role],
  }))

export default function AdminPage() {
  return (
    <RoleOverviewLayout
      eyebrow="Admin"
      title="Control every workspace"
      description="Move quickly between account, catalog, and order operations from one clean admin surface."
    >
      <div className="aurora-sales-manager-page space-y-6">
        <section className="aurora-sales-dashboard p-6">
          <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
            <div className="flex min-h-full flex-col justify-between gap-8">
              <div>
                <p className="aurora-sales-dashboard-kicker">Admin overview</p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  One role, every tool.
                </h2>
                <p className="aurora-sales-dashboard-muted mt-3 max-w-2xl">
                  Admin users keep full access while the manager roles stay focused on their own
                  workspaces.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="aurora-chip">Full access</span>
                <span className="aurora-chip">{adminWorkspaces.length} workspaces</span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {adminWorkspaces.map(({ role, label, to, description }) => (
                <article key={role} className="aurora-sales-dashboard-card p-5">
                  <div className="flex min-h-full flex-col gap-6">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
                        {role}
                      </p>
                      <h3 className="font-display text-2xl text-[var(--aurora-text-strong)]">
                        {label}
                      </h3>
                      <p className="text-sm leading-6 text-[var(--sales-page-muted)]">
                        {description}
                      </p>
                    </div>
                    <div className="mt-auto aurora-widget-actions">
                      <LiquidGlassButton as={Link} to={to} variant="secondary" size="compact">
                        Open
                      </LiquidGlassButton>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="aurora-ops-panel p-8">
          <div className="aurora-widget-body">
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-normal text-[var(--sales-page-accent)]">
                  Current access
                </p>
                <h2 className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                  Admin is unrestricted
                </h2>
              </div>
              <span className="aurora-chip">Active role</span>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="aurora-widget-subsurface p-5">
                <p className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                  Customer tools
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--aurora-text)]">
                  Account profile, orders, addresses, payment methods, and favorites.
                </p>
              </div>
              <div className="aurora-widget-subsurface p-5">
                <p className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                  Product tools
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--aurora-text)]">
                  Catalog edits, stock, images, categories, comments, and order tracking.
                </p>
              </div>
              <div className="aurora-widget-subsurface p-5">
                <p className="text-sm font-semibold text-[var(--aurora-text-strong)]">
                  Sales tools
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--aurora-text)]">
                  Sales dashboard, fulfillment review, invoices, and order status work.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </RoleOverviewLayout>
  )
}
