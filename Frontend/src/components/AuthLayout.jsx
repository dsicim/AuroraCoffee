import { Link } from 'react-router-dom'
import auroraLogoDark from '../assets/aurora-logo-dark.png'
import auroraLogoLight from '../assets/aurora-logo-light.png'
import AuroraAtmosphere from './AuroraAtmosphere'
import LiquidGlassButton from './LiquidGlassButton'
import LiquidGlassFrame from './LiquidGlassFrame'
import LiquidGlassDefs from './LiquidGlassDefs'
import { useTheme } from '../lib/theme-context'

const toneClasses = {
  error: 'aurora-message aurora-message-error',
  success: 'aurora-message aurora-message-success',
  info: 'aurora-message aurora-message-info',
}

export default function AuthLayout({
  topLinkTo,
  topLinkLabel,
  eyebrow,
  title,
  description,
  chips = [],
  aside = null,
  notice = '',
  noticeTone = 'info',
  cardEyebrow,
  cardTitle,
  cardBadge = null,
  feedback = '',
  feedbackTone = 'error',
  helper = null,
  footer = null,
  children,
}) {
  const { resolvedTheme } = useTheme()
  const brandLogo = resolvedTheme === 'dark' ? auroraLogoDark : auroraLogoLight

  return (
    <div className="aurora-page px-3 py-4 sm:px-6 lg:px-10 lg:py-8">
      <LiquidGlassDefs />
      <AuroraAtmosphere sketch />

      <div className="aurora-auth-shell relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full flex-col">
        <header className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
          <Link to="/" className="flex min-w-0 items-center gap-3 sm:gap-4">
            <img
              src={brandLogo}
              alt="Aurora Coffee Roastery logo"
              className="aurora-brand-mark h-14 w-14 rounded-[1rem] object-contain p-0 sm:h-20 sm:w-20 sm:rounded-[1.35rem]"
            />
            <div className="min-w-0">
              <p className="font-display text-[1.15rem] leading-tight text-[var(--aurora-text-strong)] sm:text-2xl">
                Aurora Coffee
              </p>
              <p className="aurora-kicker mt-1">Account access</p>
            </div>
          </Link>

          <LiquidGlassButton
            as={Link}
            to={topLinkTo}
            variant="quiet"
            size="compact"
            className="shrink-0"
            contentClassName="whitespace-nowrap"
          >
            {topLinkLabel}
          </LiquidGlassButton>
        </header>

        <main className="grid flex-1 items-start gap-6 py-5 sm:py-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-center lg:gap-8 lg:py-10 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
          <section className="order-2 aurora-stack-5 px-1 lg:order-1">
            <div className="aurora-stack-3 sm:aurora-stack-4">
              <p className="aurora-kicker">{eyebrow}</p>
              <h1 className="aurora-heading text-[clamp(2.85rem,13vw,5rem)] leading-[0.92] md:text-6xl">
                {title}
              </h1>
              <p className="aurora-copy max-w-xl text-base sm:text-lg">{description}</p>
            </div>

            {chips.length ? (
              <div className="hidden flex-wrap gap-3 sm:flex">
                {chips.map((chip) => (
                  <span key={chip} className="aurora-chip">
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}

            {aside ? <div className="hidden md:block">{aside}</div> : null}
          </section>

          <LiquidGlassFrame
            as="section"
            className="order-1 aurora-showcase-band glass-form lg:order-2"
            contentClassName="p-5 sm:p-8 lg:p-10"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="aurora-kicker">{cardEyebrow}</p>
                <h2 className="aurora-heading mt-3 text-3xl sm:text-4xl">{cardTitle}</h2>
              </div>
              {cardBadge}
            </div>

            {notice ? (
              <div className={`mt-6 ${toneClasses[noticeTone] || toneClasses.info}`}>
                {notice}
              </div>
            ) : null}

            {feedback ? (
              <div className={`mt-6 ${toneClasses[feedbackTone] || toneClasses.error}`}>
                {feedback}
              </div>
            ) : null}

            <div className="aurora-form-surface sm:mt-8 sm:p-5">
              {children}
            </div>

            {helper ? (
              <div className="aurora-form-helper aurora-solid-plate rounded-[1.7rem] sm:mt-8 sm:p-5">
                {helper}
              </div>
            ) : null}

            {footer ? (
              <div className="mt-6 text-sm text-[var(--aurora-text)]">
                {footer}
              </div>
            ) : null}
          </LiquidGlassFrame>
        </main>
      </div>
    </div>
  )
}
