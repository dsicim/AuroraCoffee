import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CoffeeBeanDecor from '../components/CoffeeBeanDecor'
import Footer from '../components/Footer'
import Header from '../components/Header'
import ProductCard from '../components/ProductCard'
import {
  accountDataChangeEvent,
  getDefaultSavedAddress,
  getFavoriteProductIds,
  getOrderHistory,
} from '../lib/accountData'
import {
  buildRestoreMessage,
  getOrderStatus,
  restoreOrderItemsToCart,
} from '../lib/accountActions'
import { authChangeEvent, getAuthSession } from '../lib/auth'
import { cartChangeEvent, getCartCount, getCartSubtotal } from '../lib/cart'
import { featuredProducts, products } from '../data/products'

const curatedProducts = featuredProducts.slice(0, 3)

const highlights = [
  'Featured coffees up front, full catalog one click away',
  'Saved favorites, repeat orders, and faster checkout for signed-in shoppers',
  'Variant-aware products with weight and grind selection on detail pages',
]

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function buildLoginPath(nextPath) {
  return `/login?next=${encodeURIComponent(nextPath)}`
}

export default function HomePage() {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getAuthSession())
  const [orders, setOrders] = useState(() => getOrderHistory())
  const [favoriteIds, setFavoriteIds] = useState(() => getFavoriteProductIds())
  const [cartCount, setCartCount] = useState(() => getCartCount())
  const [cartSubtotal, setCartSubtotal] = useState(() => getCartSubtotal())
  const [feedback, setFeedback] = useState('')

  const hasSession = Boolean(session?.token)
  const mostRecentOrder = orders[0] || null
  const defaultAddress = getDefaultSavedAddress()
  const currentOrderStatus = mostRecentOrder ? getOrderStatus(mostRecentOrder) : null

  useEffect(() => {
    const syncPageState = () => {
      setSession(getAuthSession())
      setOrders(getOrderHistory())
      setFavoriteIds(getFavoriteProductIds())
      setCartCount(getCartCount())
      setCartSubtotal(getCartSubtotal())
    }

    window.addEventListener('storage', syncPageState)
    window.addEventListener(authChangeEvent, syncPageState)
    window.addEventListener(accountDataChangeEvent, syncPageState)
    window.addEventListener(cartChangeEvent, syncPageState)
    const initialSyncId = window.setTimeout(syncPageState, 0)

    return () => {
      window.removeEventListener('storage', syncPageState)
      window.removeEventListener(authChangeEvent, syncPageState)
      window.removeEventListener(accountDataChangeEvent, syncPageState)
      window.removeEventListener(cartChangeEvent, syncPageState)
      window.clearTimeout(initialSyncId)
    }
  }, [])

  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback('')
    }, 3200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [feedback])

  const handleReorderLatest = () => {
    if (!mostRecentOrder) {
      return
    }

    const result = restoreOrderItemsToCart(mostRecentOrder.items)
    setFeedback(buildRestoreMessage(result, 'Latest order'))

    if (result.addedCount) {
      navigate('/cart')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#f7e6d9_0%,#efd3bf_34%,#e0b495_64%,#cf9877_100%)]">
      <CoffeeBeanDecor />
      <Header />

      <main className="relative z-10">
        <section className="px-6 pb-18 pt-6 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                Specialty coffee e-commerce
              </p>
              <h1 className="mt-5 max-w-2xl font-display text-5xl leading-tight text-[var(--aurora-text-strong)] md:text-6xl">
                Curated coffees first. Full catalog when you want it.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--aurora-text)]">
                Start with a focused storefront, open any coffee for full detail,
                and head to the catalog when you want the whole lineup.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/products"
                  className="rounded-full border border-[#d89270] bg-[var(--aurora-primary)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-text-strong)] shadow-[0_14px_36px_rgba(235,176,144,0.38)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-primary-soft)]"
                >
                  Browse full catalog
                </Link>
                <Link
                  to={`/products/${curatedProducts[0].id}`}
                  className="rounded-full border border-[var(--aurora-olive)] bg-[rgba(255,247,242,0.92)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-olive-deep)] shadow-[0_10px_28px_rgba(138,144,119,0.12)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-olive-soft)]"
                >
                  Open featured coffee
                </Link>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.84)] p-4">
                  <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                    {curatedProducts.length}
                  </p>
                  <p className="mt-1 text-sm text-[var(--aurora-text)]">
                    Curated coffees on the first screen
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.84)] p-4">
                  <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                    {products.length}
                  </p>
                  <p className="mt-1 text-sm text-[var(--aurora-text)]">
                    Total products in the full catalog
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.84)] p-4">
                  <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                    {hasSession ? 'Live' : 'Login'}
                  </p>
                  <p className="mt-1 text-sm text-[var(--aurora-text)]">
                    {hasSession
                      ? 'Customer tools are unlocked below'
                      : 'Saved tools unlock after sign-in'}
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
                    Storefront preview
                  </span>
                  <span className="text-sm text-[#fff1e8]">
                    {hasSession ? 'Signed in' : 'Guest mode'}
                  </span>
                </div>

                <div className="mt-10 rounded-[2rem] bg-[linear-gradient(160deg,#f4c7ae_0%,#ebb090_50%,#d98f6b_100%)] p-6 text-[var(--aurora-text-strong)]">
                  <p className="text-sm uppercase tracking-[0.3em] text-[var(--aurora-text)]">
                    Shopping continuity
                  </p>
                  <p className="mt-4 font-display text-4xl">
                    {hasSession ? 'Your saved tools are ready' : 'See what unlocks after login'}
                  </p>
                  <p className="mt-3 max-w-sm text-sm leading-7 text-[var(--aurora-text)]">
                    Favorites, repeat purchase, and faster checkout stay visible on
                    the storefront instead of hiding behind a separate landing page.
                  </p>

                  <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-white/35 p-4">
                      <p className="text-[var(--aurora-text)]">Favorites</p>
                      <p className="mt-2 font-medium">
                        {hasSession ? `${favoriteIds.length} saved` : 'Login required'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[rgba(144,180,196,0.24)] p-4">
                      <p className="text-[var(--aurora-sky-deep)]">Checkout</p>
                      <p className="mt-2 font-medium">
                        {defaultAddress ? 'Address ready' : 'Saved addresses'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between text-sm text-[#fff3eb]">
                  <span>Curated products on the first page, full catalog after that</span>
                  <span className="rounded-full bg-white/20 px-3 py-1">
                    Demo ready
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
                  Curated now
                </p>
                <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Start with a short list, then open the full catalog
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[var(--aurora-text)]">
                These coffees give the front page a focused first impression.
                Use the full catalog when you want search, filters, and the whole lineup.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {curatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} compact />
              ))}
            </div>

            <div className="mt-10 flex justify-center">
              <Link
                to="/products"
                className="inline-flex rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
              >
                Show all products
              </Link>
            </div>
          </div>
        </section>

        <section className="px-6 py-14 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                  Customer tools
                </p>
                <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                  Visible on the storefront, unlocked after login
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[var(--aurora-text)]">
                Guests can see the flow. Signed-in shoppers can use it immediately.
              </p>
            </div>

            {feedback ? (
              <div className="mt-8 rounded-[1.5rem] border border-[rgba(138,144,119,0.28)] bg-[rgba(230,232,222,0.44)] px-5 py-4 text-sm font-medium text-[var(--aurora-olive-deep)]">
                {feedback}
              </div>
            ) : null}

            <div className="mt-8 grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.9)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.08)]">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                  Favorites
                </p>
                <h3 className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                  {hasSession ? favoriteIds.length : 'Saved picks'}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                  {hasSession
                    ? 'Jump back to coffees you already saved and add a default package fast.'
                    : 'Save coffees for later and reopen them quickly after signing in.'}
                </p>
                <Link
                  to={hasSession ? '/account/favorites' : buildLoginPath('/account/favorites')}
                  className="mt-6 inline-flex rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.96)] px-4 py-2.5 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-primary-pale)]"
                >
                  {hasSession ? 'Open favorites' : 'Login to use favorites'}
                </Link>
              </article>

              <article className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.9)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.08)]">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                  Repeat purchase
                </p>
                <h3 className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                  {hasSession && mostRecentOrder ? currentOrderStatus : 'Latest order'}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                  {hasSession && mostRecentOrder
                    ? `${mostRecentOrder.reference} is ${currentOrderStatus?.toLowerCase()}. You can restore the same variants back to cart.`
                    : 'Recent orders stay accessible here so repeat purchases are one click away.'}
                </p>
                {hasSession ? (
                  mostRecentOrder ? (
                    <button
                      type="button"
                      onClick={handleReorderLatest}
                      className="mt-6 inline-flex rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.48)] px-4 py-2.5 text-sm font-semibold text-[var(--aurora-olive-deep)] transition hover:bg-[rgba(230,232,222,0.62)]"
                    >
                      Reorder latest
                    </button>
                  ) : (
                    <Link
                      to="/products"
                      className="mt-6 inline-flex rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.96)] px-4 py-2.5 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-primary-pale)]"
                    >
                      Start with the catalog
                    </Link>
                  )
                ) : (
                  <Link
                    to={buildLoginPath('/account/orders')}
                    className="mt-6 inline-flex rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.96)] px-4 py-2.5 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-primary-pale)]"
                  >
                    Login for order history
                  </Link>
                )}
              </article>

              <article className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.9)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.08)]">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                  Faster checkout
                </p>
                <h3 className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                  {hasSession
                    ? defaultAddress
                      ? defaultAddress.label || defaultAddress.fullName
                      : 'No default yet'
                    : 'Saved address'}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                  {hasSession
                    ? defaultAddress
                      ? `${defaultAddress.city}, ${defaultAddress.postalCode} is ready to prefill checkout.`
                      : 'Add a default address once and reuse it during checkout.'
                    : 'Store delivery details once so checkout starts prefilled next time.'}
                </p>
                <Link
                  to={
                    hasSession
                      ? '/account/addresses'
                      : buildLoginPath('/account/addresses')
                  }
                  className="mt-6 inline-flex rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.96)] px-4 py-2.5 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-primary-pale)]"
                >
                  {hasSession ? 'Manage addresses' : 'Login for saved addresses'}
                </Link>
              </article>

              <article className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.9)] p-6 shadow-[0_24px_70px_rgba(108,69,51,0.08)]">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                  Cart and account
                </p>
                <h3 className="mt-4 font-display text-3xl text-[var(--aurora-text-strong)]">
                  {cartCount} item{cartCount === 1 ? '' : 's'}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                  {cartCount
                    ? `${formatCurrency(cartSubtotal)} currently waiting in cart.`
                    : 'Keep your cart, account tools, and checkout flow close to the storefront.'}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to={cartCount ? '/cart' : '/products'}
                    className="inline-flex rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.96)] px-4 py-2.5 text-sm font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-primary-pale)]"
                  >
                    {cartCount ? 'Open cart' : 'Shop now'}
                  </Link>
                  <Link
                    to={hasSession ? '/account' : buildLoginPath('/account')}
                    className="inline-flex rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.42)] px-4 py-2.5 text-sm font-semibold text-[var(--aurora-olive-deep)] transition hover:bg-[rgba(230,232,222,0.58)]"
                  >
                    {hasSession ? 'Account tools' : 'Login for account tools'}
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="about" className="px-6 py-14 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.8)] p-8 shadow-[0_20px_60px_rgba(140,84,60,0.06)] lg:grid-cols-[0.9fr_1.1fr] lg:p-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                Why this entry point works
              </p>
              <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                Product-first now, deeper tools when needed
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
