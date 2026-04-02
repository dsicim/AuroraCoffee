import { Link } from 'react-router-dom'
import auroraLogo from '../assets/aurora-logo.jpeg'
import AuroraAtmosphere from './AuroraAtmosphere'
import LiquidGlassButton from './LiquidGlassButton'
import LiquidGlassFrame from './LiquidGlassFrame'
import LiquidGlassDefs from './LiquidGlassDefs'

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
  return (
    <div className="aurora-page px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <LiquidGlassDefs />
      <AuroraAtmosphere sketch />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-4">
            <img
              src={auroraLogo}
              alt="Aurora Coffee Roastery logo"
              className="h-18 w-18 rounded-[1.8rem] border border-white/20 object-cover shadow-[0_22px_52px_rgba(31,19,13,0.14)] sm:h-20 sm:w-20"
            />
            <div>
              <p className="font-display text-2xl text-[var(--aurora-text-strong)]">
                Aurora Coffee
              </p>
              <p className="aurora-kicker mt-1">Account access</p>
            </div>
          </Link>

          <LiquidGlassButton
            as={Link}
            to={topLinkTo}
            variant="quiet"
            size="default"
          >
            {topLinkLabel}
          </LiquidGlassButton>
        </header>

        <main className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[0.76fr_1.24fr] lg:py-10">
          <section className="aurora-stack-6">
            <div className="aurora-stack-4">
              <p className="aurora-kicker">{eyebrow}</p>
              <h1 className="aurora-heading text-5xl md:text-6xl">{title}</h1>
              <p className="aurora-copy max-w-xl text-lg">{description}</p>
            </div>

            {chips.length ? (
              <div className="flex flex-wrap gap-3">
                {chips.map((chip) => (
                  <span key={chip} className="aurora-chip">
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}

            {aside ? <div>{aside}</div> : null}
          </section>

          <LiquidGlassFrame
            as="section"
            className="aurora-showcase-band glass-form"
            contentClassName="p-6 sm:p-8 lg:p-10"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="aurora-kicker">{cardEyebrow}</p>
                <h2 className="aurora-heading mt-3 text-4xl">{cardTitle}</h2>
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

            <div className="mt-8 rounded-[1.8rem] border border-white/14 bg-[rgba(255,252,248,0.74)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] sm:p-5">
              {children}
            </div>

            {helper ? (
              <div className="mt-8 aurora-solid-plate rounded-[1.7rem] p-5 text-sm leading-7 text-[var(--aurora-text)]">
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
