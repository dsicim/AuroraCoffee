import CoffeeBeanDecor from './CoffeeBeanDecor'
import Footer from './Footer'
import Header from './Header'

export default function RoleOverviewLayout({
  eyebrow,
  title,
  description,
  children,
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#f7e6d9_0%,#efd3bf_34%,#e0b495_64%,#cf9877_100%)]">
      <CoffeeBeanDecor />
      <Header />

      <main className="relative z-10 px-6 pb-16 pt-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-[2.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur lg:p-10">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                {eyebrow}
              </p>
              <h1 className="mt-4 font-display text-5xl text-[var(--aurora-text-strong)]">
                {title}
              </h1>
              <p className="mt-5 text-lg leading-8 text-[var(--aurora-text)]">
                {description}
              </p>
            </div>
          </section>

          <section className="mt-10">
            {children}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
