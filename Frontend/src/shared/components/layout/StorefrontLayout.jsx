import Header from '../../../components/Header'
import Footer from './Footer'
import AuroraAtmosphere from '../common/AuroraAtmosphere'
import LiquidGlassDefs from '../ui/LiquidGlassDefs'

export default function StorefrontLayout({
  hero = null,
  heroFullBleed = false,
  children,
  contentClassName = '',
}) {
  return (
    <div className="aurora-page">
      <LiquidGlassDefs />
      <AuroraAtmosphere />
      <Header />

      <main className={`aurora-main ${heroFullBleed ? 'aurora-main--full-hero' : ''}`.trim()}>
        {hero && heroFullBleed ? (
          <section className="aurora-page-intro aurora-page-intro-full relative">
            {hero}
          </section>
        ) : null}

        <div className={`aurora-container relative aurora-page-rail ${contentClassName}`}>
          {hero && !heroFullBleed ? (
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
