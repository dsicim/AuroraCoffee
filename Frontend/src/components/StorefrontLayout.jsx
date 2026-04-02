import Footer from './Footer'
import Header from './Header'
import AuroraAtmosphere from './AuroraAtmosphere'
import LiquidGlassDefs from './LiquidGlassDefs'

export default function StorefrontLayout({
  hero = null,
  children,
  contentClassName = '',
}) {
  return (
    <div className="aurora-page">
      <LiquidGlassDefs />
      <AuroraAtmosphere />
      <Header />

      <main className="aurora-main">
        <div className={`aurora-container relative aurora-page-rail ${contentClassName}`}>
          {hero ? (
            <section className="aurora-page-intro relative">
              {hero}
            </section>
          ) : null}
          <div className="aurora-page-body">
            {children}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
