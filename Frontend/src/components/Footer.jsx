import { Link } from 'react-router-dom'
import LiquidGlassButton from './LiquidGlassButton'

const footerLinks = [
  { label: 'Home', to: '/' },
  { label: 'Products', to: '/products' },
  { label: 'Account', to: '/account' },
]

export default function Footer() {
  return (
    <footer id="footer" className="relative z-10 px-4 pb-6 pt-2 sm:px-6 lg:px-10">
      <div className="aurora-container">
        <div className="aurora-showcase-band grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[1.25fr_0.75fr_0.7fr] lg:px-8 lg:py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--aurora-olive-deep)]">
              Aurora Coffee
            </p>
            <p className="mt-2 font-display text-2xl text-[var(--aurora-text-strong)] lg:text-[2.1rem]">
              Aurora Coffee Roastery
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--aurora-text)]">
              Small-batch coffees with a cleaner path from discovery to checkout.
            </p>
          </div>

          <div>
            <p className="aurora-kicker">Browse</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {footerLinks.map((item) => (
                <LiquidGlassButton
                  key={item.to}
                  as={Link}
                  to={item.to}
                  variant="chip"
                  size="compact"
                >
                  {item.label}
                </LiquidGlassButton>
              ))}
            </div>
          </div>

          <div>
            <p className="aurora-kicker">Store promise</p>
            <p className="mt-3 text-sm leading-6 text-[var(--aurora-text)]">
              Fresh roast detail, practical account tools, and faster repeat ordering.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
