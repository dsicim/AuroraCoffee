import { Link } from 'react-router-dom'
import CoffeeBeanDecor from '../components/CoffeeBeanDecor'
import Footer from '../components/Footer'
import Header from '../components/Header'

export default function NotFoundPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#f7e6d9_0%,#efd3bf_34%,#e0b495_64%,#cf9877_100%)]">
      <CoffeeBeanDecor />
      <Header />

      <main className="relative z-10 px-6 pb-16 pt-6 lg:px-10">
        <div className="mx-auto max-w-4xl rounded-[2.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.86)] p-10 text-center shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
            Page not found
          </p>
          <h1 className="mt-4 font-display text-5xl text-[var(--aurora-text-strong)]">
            This route does not exist
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--aurora-text)]">
            The address you opened does not match a frontend page in this build.
            Return to the shop or go back to the homepage.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to="/"
              className="inline-flex rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
            >
              Go home
            </Link>
            <Link
              to="/products"
              className="inline-flex rounded-full border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.82)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-cream)]"
            >
              Browse products
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
