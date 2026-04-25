import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuroraAtmosphere from '../../../shared/components/common/AuroraAtmosphere'
import Footer from '../../../shared/components/layout/Footer'
import LiquidGlassButton from '../../../shared/components/ui/LiquidGlassButton'
import LiquidGlassDefs from '../../../shared/components/ui/LiquidGlassDefs'
import { getAuthSession } from '../../../lib/auth'
import { clearCart, reconcileCartStorageWithAuth } from '../../../lib/cart'
import { formatCurrency } from '../../../lib/currency'
import { fetchOrderById, fetchOrders } from '../../../lib/orders'
import { formatPaymentError } from '../application/payment'
import { getItemsPriceBreakdown } from '../../../lib/tax'
import {
  buildSubmittedOrderSnapshotFromPending,
  consumePending3DSCheckoutSnapshot,
  parse3DSCallbackResult,
  saveCheckout3DSReturnState,
} from '../application/payment3ds'

function Checkout3DSCallbackLayout({ hero, children }) {
  return (
    <div className="aurora-page">
      <LiquidGlassDefs />
      <AuroraAtmosphere />

      <main className="aurora-main">
        <div className="aurora-container relative aurora-page-rail">
          {hero ? (
            <section className="aurora-page-intro relative">
              {hero}
            </section>
          ) : null}
          <div className="aurora-page-body">
            {children}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function Checkout3DSCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [phase, setPhase] = useState('loading')
  const [submittedOrder, setSubmittedOrder] = useState(null)
  const [orderNumber, setOrderNumber] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const hasSession = Boolean(getAuthSession()?.token)
  const submittedPricing = submittedOrder
    ? getItemsPriceBreakdown(submittedOrder.items, {
        payableTotal: submittedOrder.total,
      })
    : null

  useEffect(() => {
    let active = true

    const finalize = async () => {
      const pendingSnapshot = consumePending3DSCheckoutSnapshot()
      const parsedResult = parse3DSCallbackResult(searchParams.get('result'))

      if (!parsedResult.success) {
        if (!active) {
          return
        }

        setPhase('failure')
        setErrorMessage(parsedResult.error)
        return
      }

      const callbackResult = parsedResult.result

      if (!callbackResult?.success) {
        const message = formatPaymentError(
          callbackResult?.e || callbackResult,
          '3D Secure authentication did not complete.',
        )

        saveCheckout3DSReturnState({
          message,
          snapshot: pendingSnapshot,
        })

        if (active) {
          navigate('/checkout', { replace: true })
        }

        return
      }

      const nextOrder = buildSubmittedOrderSnapshotFromPending(
        pendingSnapshot,
        callbackResult,
      )

      try {
        await clearCart()
        if (getAuthSession()?.token) {
          await reconcileCartStorageWithAuth()
        }
      } catch {
        // Keep the success path moving even if local cart cleanup hits stale state.
      }

      if (!active) {
        return
      }

      if (getAuthSession()?.token) {
        if (callbackResult?.orderNumber) {
          await fetchOrderById(String(callbackResult.orderNumber), { force: true }).catch(() => null)
        } else {
          await fetchOrders({ force: true }).catch(() => null)
        }
      }

      if (!active) {
        return
      }

      if (nextOrder) {
        setSubmittedOrder(nextOrder)
        setOrderNumber(String(nextOrder.orderNumber || callbackResult.orderNumber || ''))
      } else {
        setOrderNumber(String(callbackResult.orderNumber || ''))
      }

      setPhase('success')
    }

    void finalize()

    return () => {
      active = false
    }
  }, [navigate, searchParams])

  const hero = (
    <section className="aurora-showcase-band p-6 text-center sm:p-8 lg:p-10">
      <p className="aurora-kicker">
        {phase === 'loading'
          ? 'Secure payment'
          : phase === 'success'
            ? 'Order confirmed'
            : 'Payment return'}
      </p>
      <h1 className="mt-4 font-display text-5xl text-[var(--aurora-text-strong)] md:text-6xl">
        {phase === 'loading'
          ? 'Finalizing your secure payment'
          : phase === 'success'
            ? 'Your order has been confirmed'
            : 'We could not verify the payment result'}
      </h1>
      <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-[var(--aurora-text)]">
        {phase === 'loading'
          ? 'Please wait while Aurora Coffee checks the bank return and updates your order.'
          : phase === 'success'
            ? 'The 3D Secure handoff completed and the order status has been written back into your checkout flow.'
            : errorMessage || 'The payment return could not be verified. Go back to checkout and try again.'}
      </p>
    </section>
  )

  if (phase === 'loading') {
    return (
      <Checkout3DSCallbackLayout hero={hero}>
        <section className="aurora-showroom-panel p-8">
          <p className="text-sm leading-7 text-[var(--aurora-text)]">
            Waiting for the payment return...
          </p>
        </section>
      </Checkout3DSCallbackLayout>
    )
  }

  if (phase === 'failure') {
    return (
      <Checkout3DSCallbackLayout hero={hero}>
        <section className="aurora-showroom-panel p-8">
          <div className="aurora-message aurora-message-error">
            {errorMessage || 'The payment result could not be verified.'}
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            <LiquidGlassButton as={Link} to="/checkout" size="hero">
              Back to checkout
            </LiquidGlassButton>
            <LiquidGlassButton as={Link} to="/cart" variant="quiet" size="hero">
              View cart
            </LiquidGlassButton>
            <LiquidGlassButton as={Link} to="/" variant="quiet" size="hero">
              Home
            </LiquidGlassButton>
          </div>
        </section>
      </Checkout3DSCallbackLayout>
    )
  }

  return (
    <Checkout3DSCallbackLayout hero={hero}>
      <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="aurora-showroom-panel p-8">
          <div className="aurora-solid-plate rounded-[2rem] p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--aurora-olive-deep)]">
              Secure payment complete
            </p>
            <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
              Order confirmed
            </h2>
            <p className="mt-5 text-lg leading-8 text-[var(--aurora-text)]">
              {orderNumber
                ? `Order #${orderNumber} has been confirmed through the 3D Secure return.`
                : 'Your order has been confirmed through the 3D Secure return.'}
            </p>

            {submittedOrder ? (
              <>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="aurora-ops-card p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Reference
                  </p>
                  <p className="mt-3 font-display text-2xl text-[var(--aurora-text-strong)]">
                    {submittedOrder.reference}
                  </p>
                </div>
                <div className="aurora-ops-card p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Items
                  </p>
                  <p className="mt-3 font-display text-2xl text-[var(--aurora-text-strong)]">
                    {submittedOrder.items.reduce((count, item) => count + item.quantity, 0)}
                  </p>
                </div>
                <div className="aurora-ops-card p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Total
                  </p>
                  <p className="mt-3 font-display text-2xl text-[var(--aurora-text-strong)]">
                    {formatCurrency(submittedOrder.total)}
                  </p>
                </div>
              </div>
              {submittedPricing ? (
                <div className="aurora-ops-card mt-6 p-4">
                  <div className="grid gap-3 text-sm text-[var(--aurora-text)] sm:grid-cols-3">
                    <div className="flex items-center justify-between gap-4 sm:block">
                      <span>Items total</span>
                      <span className="font-semibold text-[var(--aurora-text-strong)]">
                        {formatCurrency(submittedPricing.itemsGross)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:block">
                      <span>Included VAT</span>
                      <span className="font-semibold text-[var(--aurora-text-strong)]">
                        {formatCurrency(submittedOrder.taxTotal ?? submittedPricing.taxTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:block">
                      <span>Installment fee</span>
                      <span className="font-semibold text-[var(--aurora-text-strong)]">
                        {formatCurrency(submittedOrder.installmentFee ?? submittedPricing.installmentFee)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
              </>
            ) : (
              <div className="aurora-ops-card mt-8 p-4">
                <p className="text-sm leading-7 text-[var(--aurora-text)]">
                  The order result was confirmed, but the local checkout snapshot was no longer available. You can still continue from your orders page.
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-4">
              {hasSession ? (
                <LiquidGlassButton
                  as={Link}
                  to={orderNumber ? `/account/orders/${encodeURIComponent(orderNumber)}` : '/account/orders'}
                  variant="secondary"
                  size="hero"
                >
                  {orderNumber ? 'View order detail' : 'View order history'}
                </LiquidGlassButton>
              ) : null}
              <LiquidGlassButton as={Link} to="/products" size="hero">
                Return to shop
              </LiquidGlassButton>
              <LiquidGlassButton as={Link} to="/cart" variant="quiet" size="hero">
                View empty cart
              </LiquidGlassButton>
            </div>
          </div>
        </div>

        <aside className="aurora-showcase-band h-fit p-6 sm:p-8">
          <div className="aurora-widget-body">
            <div className="aurora-widget-heading">
              <p className="aurora-kicker">Payment result</p>
              <h2 className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                Secure handoff completed
              </h2>
            </div>

            <div className="aurora-widget-subsurface p-5 text-sm leading-7 text-[var(--aurora-text)]">
              {orderNumber ? (
                <p>
                  Bank confirmation returned order number{' '}
                  <span className="font-semibold text-[var(--aurora-text-strong)]">
                    {orderNumber}
                  </span>.
                </p>
              ) : (
                <p>
                  The bank return was accepted and checkout is complete.
                </p>
              )}
              {submittedOrder ? (
                <p className="mt-3">
                  The cart has been cleared and the backend order cache has been refreshed for your account views.
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      </section>
    </Checkout3DSCallbackLayout>
  )
}
