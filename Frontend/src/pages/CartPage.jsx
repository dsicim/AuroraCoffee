import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuroraWidget, { AuroraInset } from '../components/AuroraWidget'
import LiquidGlassButton, { LiquidGlassStepperButton } from '../components/LiquidGlassButton'
import StorefrontLayout from '../components/StorefrontLayout'
import { getAuthSession } from '../lib/auth'
import { formatCurrency } from '../lib/currency'
import {
  cartChangeEvent,
  getCartItems,
  reconcileCartStorageWithAuth,
  removeCartItem,
  updateCartItemQuantity,
} from '../lib/cart'

export default function CartPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState(() => getCartItems())
  const [session, setSession] = useState(() => getAuthSession())

  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0)
  const totalItems = items.reduce((total, item) => total + item.quantity, 0)
  const isLoggedIn = Boolean(session?.token)

  useEffect(() => {
    const syncFromStorage = () => {
      void (async () => {
        await reconcileCartStorageWithAuth()
        setItems(getCartItems())
        setSession(getAuthSession())
      })()
    }

    const syncCartState = () => {
      setItems(getCartItems())
      setSession(getAuthSession())
    }

    window.addEventListener('storage', syncFromStorage)
    window.addEventListener(cartChangeEvent, syncCartState)
    const initialSyncId = window.setTimeout(syncFromStorage, 0)

    return () => {
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener(cartChangeEvent, syncCartState)
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
    <StorefrontLayout contentClassName="aurora-stack-12">
      <section className="aurora-content-split lg:grid-cols-[1.12fr_0.88fr]">
        <div className="aurora-showroom-panel p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="aurora-kicker">Your cart</p>
              <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                Review your order
              </h2>
            </div>
            <span className="aurora-chip">
              {totalItems} item{totalItems === 1 ? '' : 's'}
            </span>
          </div>

          {!items.length ? (
            <div className="aurora-showroom-subpanel mt-8 px-6 py-12 text-center">
              <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                Your cart is empty
              </p>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--aurora-text)]">
                Add a few coffees from the catalog to start building your next order.
              </p>
              <LiquidGlassButton as={Link} to="/products" size="hero" className="mt-6">
                Browse the catalog
              </LiquidGlassButton>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {items.map((item) => (
                <AuroraWidget
                  key={item.id}
                  title={item.name}
                  subtitle={item.roast}
                  icon="coffee"
                  className="aurora-showroom-subpanel p-5 sm:p-6"
                  headerAside={<span className="aurora-chip">{item.typeLabel || item.category || 'Product'}</span>}
                >
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                    <div className="min-w-0">
                      <p className="max-w-2xl text-sm leading-7 text-[var(--aurora-text)]">
                        {item.description}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                            {item.notes.map((note) => (
                          <span key={note} className="aurora-chip">
                            {note}
                          </span>
                        ))}
                      </div>
                    </div>

                    <AuroraInset className="flex min-w-[15rem] flex-col items-stretch gap-4 p-4 sm:min-w-[16rem]">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--aurora-olive-deep)]">
                          Line total
                        </p>
                        <p className="mt-2 font-display text-3xl text-[var(--aurora-text-strong)]">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>

                      <div className="aurora-widget-subsurface flex items-center justify-between gap-3 px-3 py-2">
                        <LiquidGlassStepperButton
                          type="button"
                          aria-label={`Decrease ${item.name} quantity`}
                          onClick={() => {
                            void updateCartItemQuantity(item.id, item.quantity - 1)
                          }}
                        >
                          -
                        </LiquidGlassStepperButton>
                        <span className="min-w-8 text-center text-sm font-semibold text-[var(--aurora-text-strong)]">
                          {item.quantity}
                        </span>
                        <LiquidGlassStepperButton
                          type="button"
                          aria-label={`Increase ${item.name} quantity`}
                          onClick={() => {
                            void updateCartItemQuantity(item.id, item.quantity + 1)
                          }}
                        >
                          +
                        </LiquidGlassStepperButton>
                      </div>

                      <LiquidGlassButton
                        type="button"
                        onClick={() => {
                          void removeCartItem(item.id)
                        }}
                        variant="quiet"
                        size="compact"
                        className="w-full"
                      >
                        Remove item
                      </LiquidGlassButton>
                    </AuroraInset>
                  </div>
                </AuroraWidget>
              ))}
            </div>
          )}
        </div>

        <AuroraWidget
          title="Ready for checkout"
          subtitle="Order summary"
          icon="orders"
          className="aurora-operational-card h-fit rounded-[2rem] p-6 sm:p-7"
        >
          <AuroraInset className="mt-4">
            <div className="space-y-4 text-sm text-[var(--aurora-text)]">
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
                  {isLoggedIn ? 'Linked to current auth choice' : 'Guest cart'}
                </span>
              </div>
            </div>
          </AuroraInset>

          <AuroraInset className="mt-6 text-sm leading-7 text-[var(--aurora-text)]">
            {isLoggedIn
              ? 'You are signed in. Continue to checkout to enter delivery and payment details and place your order.'
              : 'You can build the cart while browsing. When you continue, you will be asked to sign in first and then returned directly to checkout.'}
          </AuroraInset>

          <LiquidGlassButton
            type="button"
            onClick={handleOrderNow}
            disabled={!items.length}
            size="hero"
            className="mt-6 w-full"
          >
            {isLoggedIn ? 'Continue to checkout' : 'Login to continue'}
          </LiquidGlassButton>

          <div className="mt-5 flex flex-wrap gap-3">
              <LiquidGlassButton as={Link} to="/products" variant="secondary">
              Add more products
              </LiquidGlassButton>
              <LiquidGlassButton as={Link} to="/" variant="quiet">
              Back to home
              </LiquidGlassButton>
          </div>
        </AuroraWidget>
      </section>
    </StorefrontLayout>
  )
}
