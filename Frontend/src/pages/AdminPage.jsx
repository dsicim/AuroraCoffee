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
      title="Choose the control surface you need."
      description="Admin access includes the customer account view, product manager tools, sales manager tools, and the current admin overview."
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr]">
        <section className="aurora-ops-panel p-8">
          <div className="aurora-widget-body">
            <div className="aurora-widget-header">
              <div className="aurora-widget-heading">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                  Workspaces
                </p>
                <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Choose where to continue.
                </h2>
              </div>
              <span className="aurora-chip">Admin access</span>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {adminWorkspaces.map(({ role, label, to, description }) => (
                <article key={role} className="aurora-ops-card p-5">
                  <div className="flex min-h-full flex-col gap-5">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--aurora-olive-deep)]">
                        {role}
                      </p>
                      <h3 className="font-display text-2xl text-[var(--aurora-text-strong)]">
                        {label}
                      </h3>
                      <p className="text-sm leading-6 text-[var(--aurora-text)]">
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
            <div className="aurora-widget-heading">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                Current access
              </p>
              <h2 className="font-display text-3xl text-[var(--aurora-text-strong)]">
                Admin overview
              </h2>
            </div>
            <p className="text-sm leading-7 text-[var(--aurora-text)]">
              This page keeps the admin role visible without sending you back to the
              same route. Use the workspace cards to move into the account, catalog,
              and order tools available to admin users.
            </p>
            <div className="aurora-ops-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--aurora-olive-deep)]">
                Active role
              </p>
              <p className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                Admin
              </p>
            </div>
          </div>
        </section>
      </div>
    </RoleOverviewLayout>
  )
}
