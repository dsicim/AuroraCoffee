import Header from '../components/Header'
import Footer from '../components/Footer'
import ProductCard from '../components/ProductCard'
import CoffeeBeanDecor from '../components/CoffeeBeanDecor'
import { featuredProducts } from '../data/products'

const highlights = [
  'Small-batch roasting every Tuesday and Friday',
  'Fresh stock visibility for every featured coffee',
  'Built for subscriptions, wishlists, and seasonal drops',
]

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#f7e6d9_0%,#efd3bf_34%,#e0b495_64%,#cf9877_100%)]">
      <CoffeeBeanDecor />
      <Header />

      <main className="relative z-10">
        <section className="px-6 pb-18 pt-6 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                Specialty coffee e-commerce
              </p>
              <h1 className="mt-5 max-w-2xl font-display text-5xl leading-tight text-[var(--aurora-text-strong)] md:text-6xl">
                Aurora Coffee Roastery brings warm, modern coffee retail online.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--aurora-text)]">
                A clean starting homepage for your CS308 store project. It sets
                the tone for a coffee brand while leaving room for product
                listings, authentication, cart, and backend integration later.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="#featured"
                  className="rounded-full border border-[#d89270] bg-[var(--aurora-primary)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-text-strong)] shadow-[0_14px_36px_rgba(235,176,144,0.38)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-primary-soft)]"
                >
                  Shop featured beans
                </a>
                <a
                  href="#about"
                  className="rounded-full border border-[var(--aurora-olive)] bg-[rgba(255,247,242,0.92)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-olive-deep)] shadow-[0_10px_28px_rgba(138,144,119,0.12)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-olive-soft)]"
                >
                  Learn the brand
                </a>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.84)] p-4">
                  <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                    12h
                  </p>
                  <p className="mt-1 text-sm text-[var(--aurora-text)]">
                    Roast-to-dispatch target
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.84)] p-4">
                  <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                    3
                  </p>
                  <p className="mt-1 text-sm text-[var(--aurora-text)]">
                    Featured launch coffees
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.84)] p-4">
                  <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                    4.9
                  </p>
                  <p className="mt-1 text-sm text-[var(--aurora-text)]">
                    Visual rating target
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-8 top-10 h-28 w-28 rounded-full bg-[var(--aurora-olive)]/18 blur-2xl" />
              <div className="absolute bottom-6 right-8 h-32 w-32 rounded-full bg-[#f2c5ad]/40 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2.5rem] border border-[var(--aurora-border)] bg-[linear-gradient(180deg,#e7a987_0%,#d9906b_58%,#c97d5e_100%)] p-8 text-[var(--aurora-cream)] shadow-[0_35px_100px_rgba(176,110,78,0.24)]">
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-[rgba(230,232,222,0.38)] bg-[rgba(144,180,196,0.18)] px-3 py-1 text-xs uppercase tracking-[0.24em] text-[var(--aurora-cream)]">
                    House release
                  </span>
                  <span className="text-sm text-[#fff1e8]">Spring menu</span>
                </div>

                <div className="mt-10 rounded-[2rem] bg-[linear-gradient(160deg,#f4c7ae_0%,#ebb090_50%,#d98f6b_100%)] p-6 text-[var(--aurora-text-strong)]">
                  <p className="text-sm uppercase tracking-[0.3em] text-[var(--aurora-text)]">
                    Aurora No. 01
                  </p>
                  <p className="mt-4 font-display text-4xl">Signature Blend</p>
                  <p className="mt-3 max-w-sm text-sm leading-7 text-[var(--aurora-text)]">
                    A balanced everyday coffee designed as the visual anchor of
                    the homepage until the full catalog pages are ready.
                  </p>

                  <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-white/35 p-4">
                      <p className="text-[var(--aurora-text)]">Notes</p>
                      <p className="mt-2 font-medium">Cocoa, fig, hazelnut</p>
                    </div>
                    <div className="rounded-2xl bg-[rgba(144,180,196,0.24)] p-4">
                      <p className="text-[var(--aurora-sky-deep)]">Stock</p>
                      <p className="mt-2 font-medium">32 bags available</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between text-sm text-[#fff3eb]">
                  <span>Designed for desktop and mobile first demos</span>
                  <span className="rounded-full bg-white/20 px-3 py-1">
                    Homepage only
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="featured" className="px-6 py-14 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                  Featured coffee
                </p>
                <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                  A simple product strip for the landing page
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[var(--aurora-text)]">
                These cards can later be connected to backend product endpoints
                without redesigning the homepage structure.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {featuredProducts.map((product) => (
                <ProductCard key={product.name} product={product} />
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="px-6 py-14 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.8)] p-8 shadow-[0_20px_60px_rgba(140,84,60,0.06)] lg:grid-cols-[0.9fr_1.1fr] lg:p-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                Why this starter works
              </p>
              <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                Minimal now, extendable later
              </h2>
            </div>

            <div className="space-y-4">
              {highlights.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-[rgba(138,144,119,0.26)] bg-[rgba(255,247,242,0.92)] px-5 py-4 text-[var(--aurora-text)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
