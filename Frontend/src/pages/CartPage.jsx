import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CoffeeBeanDecor from '../components/CoffeeBeanDecor'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { getAuthSession } from '../lib/auth'
import {
  cartChangeEvent,
  getCartItems,
  getCartSubtotal,
  reconcileCartStorageWithAuth,
  removeCartItem,
  updateCartItemQuantity,
} from '../lib/cart'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export default function CartPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState(() => getCartItems())
  const [session, setSession] = useState(() => getAuthSession())

  const subtotal = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  )
  const totalItems = items.reduce((total, item) => total + item.quantity, 0)
  const isLoggedIn = Boolean(session?.token)

  useEffect(() => {
    const syncCart = () => {
      reconcileCartStorageWithAuth()
      setItems(getCartItems())
      setSession(getAuthSession())
    }

    window.addEventListener('storage', syncCart)
    window.addEventListener(cartChangeEvent, syncCart)
    const initialSyncId = window.setTimeout(syncCart, 0)

    return () => {
      window.removeEventListener('storage', syncCart)
      window.removeEventListener(cartChangeEvent, syncCart)
      window.clearTimeout(initialSyncId)
    }
  }, [])

  const handleOrderNow = () => {
    if (!items.length) {
      return
    }

    if (!isLoggedIn) {
      navigate('/login?next=%2Fcheckout')
      return
    }

    navigate('/checkout')
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#f7e6d9_0%,#efd3bf_34%,#e0b495_64%,#cf9877_100%)]">
      <CoffeeBeanDecor />
      <Header />

      <main className="relative z-10 px-6 pb-16 pt-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                    Your cart
                  </p>
                  <h1 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                    Review your order
                  </h1>
                </div>
                <span className="rounded-full border border-[rgba(138,144,119,0.26)] bg-[rgba(230,232,222,0.48)] px-4 py-2 text-sm font-semibold text-[var(--aurora-olive-deep)]">
                  {totalItems} item{totalItems === 1 ? '' : 's'}
                </span>
              </div>

              {!items.length ? (
                <div className="mt-8 rounded-[2rem] border border-dashed border-[rgba(138,144,119,0.35)] bg-[rgba(255,247,242,0.7)] px-6 py-10 text-center">
                  <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                    Your cart is empty
                  </p>
                  <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                    Add a few coffees from the shop to start building your next
                    order.
                  </p>
                  <Link
                    to="/"
                    className="mt-6 inline-flex rounded-full border border-[#d89270] bg-[var(--aurora-primary)] px-6 py-3 text-sm font-semibold text-[var(--aurora-text-strong)] shadow-[0_14px_36px_rgba(235,176,144,0.28)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-primary-soft)]"
                  >
                    Back to shop
                  </Link>
                </div>
              ) : (
                <div className="mt-8 space-y-4">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.92)] p-5 shadow-[0_18px_48px_rgba(108,69,51,0.08)]"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-xl">
                          <p className="text-xs uppercase tracking-[0.28em] text-[var(--aurora-olive-deep)]">
                            {item.roast}
                          </p>
                          <h2 className="mt-2 font-display text-2xl text-[var(--aurora-text-strong)]">
                            {item.name}
                          </h2>
                          <p className="mt-2 text-sm font-semibold text-[var(--aurora-text-strong)]">
                            {item.weight} / {item.grind}
                          </p>
                          <p className="mt-3 text-sm leading-7 text-[var(--aurora-text)]">
                            {item.description}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.notes.map((note) => (
                              <span
                                key={note}
                                className="rounded-full border border-[rgba(122,130,96,0.34)] bg-[rgba(223,227,209,0.28)] px-3 py-1 text-xs text-[var(--aurora-olive-deep)]"
                              >
                                {note}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-4 lg:items-end">
                          <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                          <div className="flex items-center gap-3 rounded-full border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.96)] px-3 py-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateCartItemQuantity(
                                  item.id,
                                  item.quantity - 1,
                                )
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--aurora-border)] bg-white/80 text-lg font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-primary-pale)]"
                            >
                              -
                            </button>
                            <span className="min-w-8 text-center text-sm font-semibold text-[var(--aurora-text-strong)]">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateCartItemQuantity(
                                  item.id,
                                  item.quantity + 1,
                                )
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--aurora-border)] bg-white/80 text-lg font-semibold text-[var(--aurora-text-strong)] transition hover:bg-[var(--aurora-primary-pale)]"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCartItem(item.id)}
                            className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
                          >
                            Remove item
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <aside className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                Order summary
              </p>
              <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                Checkout demo
              </h2>

              <div className="mt-8 space-y-4 rounded-[2rem] border border-[rgba(138,144,119,0.26)] bg-[rgba(230,232,222,0.34)] p-5 text-sm text-[var(--aurora-text)]">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[var(--aurora-text-strong)]">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Saved items</span>
                  <span className="font-semibold text-[var(--aurora-text-strong)]">
                    {totalItems}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Storage mode</span>
                  <span className="font-semibold text-[var(--aurora-text-strong)]">
                    {session ? 'Linked to current auth choice' : 'Guest cart'}
                  </span>
                </div>
              </div>

              <div className="mt-8 rounded-[1.75rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.78)] p-5 text-sm leading-7 text-[var(--aurora-text)]">
                {isLoggedIn
                  ? 'You are signed in. Continue to checkout to enter delivery and payment details, review the invoice preview, and finish the demo order.'
                  : 'You can build your cart while browsing. When you continue to checkout, you will be asked to sign in first and then brought into the checkout flow.'}
              </div>

              <button
                type="button"
                onClick={handleOrderNow}
                disabled={!items.length}
                className="mt-8 w-full rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {isLoggedIn ? 'Continue to checkout' : 'Login to continue'}
              </button>

              {items.length ? (
                <p className="mt-4 text-center text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                  Subtotal preview: {formatCurrency(getCartSubtotal())}
                </p>
              ) : null}
            </aside>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
