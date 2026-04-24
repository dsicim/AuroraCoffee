import { Link } from 'react-router-dom'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
import StorefrontLayout from '../shared/components/layout/StorefrontLayout'

export default function NotFoundPage() {
  const hero = (
    <section className="aurora-shell mx-auto max-w-4xl p-8 text-center sm:p-10">
      <p className="aurora-kicker">Page not found</p>
      <h1 className="aurora-heading mt-4 text-5xl">This page is not available.</h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--aurora-text)]">
        The address you opened does not match a page in the current site. Head
        back to the catalog or return to the home page to keep browsing.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <LiquidGlassButton as={Link} to="/" variant="secondary" size="hero">
          Go home
        </LiquidGlassButton>
        <LiquidGlassButton as={Link} to="/products" variant="quiet" size="hero">
          Browse coffees
        </LiquidGlassButton>
      </div>
    </section>
  )

  return <StorefrontLayout hero={hero} />
}
