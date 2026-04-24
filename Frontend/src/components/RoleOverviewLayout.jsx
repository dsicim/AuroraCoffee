import { Link } from 'react-router-dom'
import AuroraAtmosphere from '../shared/components/common/AuroraAtmosphere'
import Footer from '../shared/components/layout/Footer'
import Header from './Header'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
import LiquidGlassDefs from '../shared/components/ui/LiquidGlassDefs'

export default function RoleOverviewLayout({
  eyebrow,
  title,
  description,
  children,
}) {
  return (
    <div className="aurora-page">
      <LiquidGlassDefs />
      <AuroraAtmosphere opacityClassName="opacity-60" />
      <Header />

      <main className="aurora-main">
        <div className="aurora-container aurora-page-rail">
          <section className="aurora-shell aurora-shell-operational rounded-[2.3rem] p-6 sm:p-8 lg:p-9">
            <div className="aurora-page-intro-split lg:items-start">
              <div className="max-w-4xl">
                <p className="aurora-kicker">
                  {eyebrow}
                </p>
                <h1 className="aurora-heading mt-4 text-5xl md:text-6xl">
                  {title}
                </h1>
                <p className="mt-5 text-lg leading-8 text-[var(--aurora-text)]">
                  {description}
                </p>
              </div>

              <div className="aurora-operational-card rounded-[1.8rem] p-5">
                <p className="aurora-kicker">Operations view</p>
                <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                  This workspace keeps the storefront language, but uses one quieter support block
                  so the actual activity panels can do the work.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <LiquidGlassButton as={Link} to="/" variant="chip" size="compact">
                    Storefront
                  </LiquidGlassButton>
                  <LiquidGlassButton as={Link} to="/products" variant="chip" size="compact">
                    Catalog
                  </LiquidGlassButton>
                </div>
              </div>
            </div>
          </section>

          <section>
            {children}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
