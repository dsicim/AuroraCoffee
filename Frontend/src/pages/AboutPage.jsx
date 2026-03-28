import { Link } from 'react-router-dom'
import CoffeeBeanDecor from '../components/CoffeeBeanDecor'
import Footer from '../components/Footer'
import Header from '../components/Header'

const timelineMilestones = [
  {
    year: '2019',
    title: 'A smaller coffee list on purpose',
    description:
      'The idea for Aurora started with a preference for tighter menus and clearer flavor direction. Instead of carrying every profile at once, the goal was to build a lineup that felt edited, calm, and easy to return to.',
  },
  {
    year: '2021',
    title: 'Roasting around balance and repeatability',
    description:
      'The roasting philosophy settled around sweetness, structure, and cups that stay readable at home. The target was coffee that works for daily ritual, not only for one perfect brew on one perfect day.',
  },
  {
    year: '2023',
    title: 'From shelf thinking to customer flow',
    description:
      'The brand direction expanded beyond the beans themselves. Product pages, saved favorites, and repeat ordering became part of the experience, because good coffee retail should feel as smooth as the cup it delivers.',
  },
  {
    year: 'Now',
    title: 'A storefront built for slower mornings',
    description:
      'Today the shop is centered on curated coffees, variant-aware product detail, and the small conveniences that make people come back: easy reorder paths, saved addresses, and a cleaner catalog journey.',
  },
]

const guidingPoints = [
  'Keep the lineup focused enough that every coffee earns attention.',
  'Favor sweetness, clarity, and balance over noise.',
  'Make the digital storefront feel calm, useful, and easy to revisit.',
]

export default function AboutPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#f7e6d9_0%,#efd3bf_34%,#e0b495_64%,#cf9877_100%)]">
      <CoffeeBeanDecor />
      <Header />

      <main className="relative z-10 px-6 pb-16 pt-6 lg:px-10">
        <section className="mx-auto max-w-7xl rounded-[2.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.84)] p-8 shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                Our story
              </p>
              <h1 className="mt-4 max-w-2xl font-display text-5xl leading-tight text-[var(--aurora-text-strong)] md:text-6xl">
                A coffee timeline shaped by clarity, ritual, and return visits.
              </h1>
            </div>

            <div>
              <p className="text-base leading-8 text-[var(--aurora-text)]">
                Aurora Coffee grew from a preference for smaller menus, warmer cups,
                and a storefront that feels intentional instead of crowded. The
                roastery story is less about chasing novelty and more about building
                a lineup people want to come back to.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/products"
                  className="rounded-full border border-[#d89270] bg-[var(--aurora-primary)] px-5 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] shadow-[0_10px_24px_rgba(235,176,144,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-primary-soft)]"
                >
                  Explore the coffees
                </Link>
                <Link
                  to="/"
                  className="rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.92)] px-5 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-cream)]"
                >
                  Back to home
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
            <aside className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.86)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)]">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                Guiding points
              </p>
              <div className="mt-6 space-y-4">
                {guidingPoints.map((point) => (
                  <div
                    key={point}
                    className="rounded-[1.5rem] border border-[rgba(138,144,119,0.22)] bg-[rgba(255,247,242,0.96)] px-5 py-4 text-sm leading-7 text-[var(--aurora-text)]"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </aside>

            <section className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                Timeline
              </p>
              <div className="mt-8 space-y-6">
                {timelineMilestones.map((milestone, index) => (
                  <article
                    key={milestone.year + milestone.title}
                    className="relative rounded-[2rem] border border-[rgba(138,144,119,0.22)] bg-[rgba(255,247,242,0.96)] p-6 pl-8"
                  >
                    <div className="absolute left-0 top-0 h-full w-8">
                      <span className="absolute left-3 top-8 h-3 w-3 rounded-full bg-[var(--aurora-sky)] shadow-[0_0_0_6px_rgba(144,180,196,0.18)]" />
                      {index < timelineMilestones.length - 1 ? (
                        <span className="absolute left-[0.95rem] top-12 h-[calc(100%-1rem)] w-px bg-[rgba(138,144,119,0.28)]" />
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--aurora-olive-deep)]">
                          {milestone.year}
                        </p>
                        <h2 className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)]">
                          {milestone.title}
                        </h2>
                      </div>
                    </div>
                    <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--aurora-text)]">
                      {milestone.description}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
