import { Link } from 'react-router-dom'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
import RoleOverviewLayout from '../components/RoleOverviewLayout'

export default function AdminPage() {
  return (
    <RoleOverviewLayout
      eyebrow="Admin"
      title="Choose the control surface you need."
      description="Admin access includes the customer account view, product manager tools, sales manager tools, and service administration."
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr]">
        <section className="aurora-ops-panel p-8">
          <div className="aurora-widget-body">
            <div className="aurora-widget-heading">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                Access levels
              </p>
              <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                Admin can move across every workspace.
              </h2>
            </div>

            <div className="aurora-widget-actions">
              <LiquidGlassButton as={Link} to="/customer" variant="secondary">
                Customer Home
              </LiquidGlassButton>
              <LiquidGlassButton as={Link} to="/product-manager" variant="secondary">
                Product Manager
              </LiquidGlassButton>
              <LiquidGlassButton as={Link} to="/sales-manager" variant="secondary">
                Sales Manager
              </LiquidGlassButton>
              <LiquidGlassButton as={Link} to="/admin" variant="quiet">
                Admin
              </LiquidGlassButton>
            </div>
          </div>
        </section>

        <section className="aurora-solid-plate rounded-[2.5rem] p-8">
          <div className="aurora-widget-body">
            <div className="aurora-widget-heading">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
                Admin level
              </p>
              <h2 className="font-display text-3xl text-[var(--aurora-text-strong)]">
                Four access levels are available from Customer Home.
              </h2>
            </div>
            <p className="text-sm leading-7 text-[var(--aurora-text)]">
              Use the Customer Home dropdown from the account sidebar to switch between
              customer, product manager, sales manager, and admin destinations.
            </p>
          </div>
        </section>
      </div>
    </RoleOverviewLayout>
  )
}
