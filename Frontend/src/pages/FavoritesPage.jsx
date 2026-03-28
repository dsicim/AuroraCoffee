import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import ProductCard from '../components/ProductCard'
import { products } from '../data/products'
import { addDefaultProductToCart } from '../lib/accountActions'
import {
  accountDataChangeEvent,
  getFavoriteProductIds,
} from '../lib/accountData'

export default function FavoritesPage() {
  const [favoriteIds, setFavoriteIds] = useState(() => getFavoriteProductIds())
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const syncFavorites = () => {
      setFavoriteIds(getFavoriteProductIds())
    }

    window.addEventListener('storage', syncFavorites)
    window.addEventListener(accountDataChangeEvent, syncFavorites)
    const initialSyncId = window.setTimeout(syncFavorites, 0)

    return () => {
      window.removeEventListener('storage', syncFavorites)
      window.removeEventListener(accountDataChangeEvent, syncFavorites)
      window.clearTimeout(initialSyncId)
    }
  }, [])

  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback('')
    }, 2600)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [feedback])

  const favoriteProducts = products.filter((product) =>
    favoriteIds.includes(product.id),
  )

  const handleQuickAdd = (productId) => {
    const result = addDefaultProductToCart(productId)

    if (result.status === 'added') {
      setFeedback(
        `Added ${result.product.name} · ${result.variant.weight} / ${result.variant.grind} to cart.`,
      )
      return
    }

    if (result.status === 'sold-out') {
      setFeedback(`${result.product.name} is sold out right now.`)
      return
    }

    setFeedback('That coffee is no longer available.')
  }

  return (
    <AccountLayout
      eyebrow="Favorites"
      title="Saved coffees worth revisiting"
      description="Come back to saved coffees, jump into product details, or send the default package straight into the cart."
    >
      {feedback ? (
        <div className="mb-6 rounded-[1.5rem] border border-[rgba(138,144,119,0.28)] bg-[rgba(230,232,222,0.44)] px-5 py-4 text-sm font-medium text-[var(--aurora-olive-deep)]">
          {feedback}
        </div>
      ) : null}

      {!favoriteProducts.length ? (
        <div className="rounded-[2.25rem] border border-dashed border-[rgba(138,144,119,0.35)] bg-[rgba(255,247,242,0.72)] px-6 py-12 text-center">
          <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
            No favorites saved yet
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--aurora-text)]">
            Use the heart action on product cards or product detail pages to
            build a shortlist here.
          </p>
          <Link
            to="/products"
            className="mt-6 inline-flex rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
          >
            Explore products
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {favoriteProducts.map((product) => (
            <div key={product.id} className="space-y-4">
              <ProductCard product={product} compact />
              <div className="flex items-center gap-3 rounded-[1.5rem] border border-[rgba(138,144,119,0.18)] bg-[rgba(255,247,242,0.82)] px-4 py-4">
                <Link
                  to={`/products/${product.id}`}
                  className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
                >
                  View product
                </Link>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(product.id)}
                  className="rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.42)] px-4 py-2.5 text-sm font-semibold text-[var(--aurora-olive-deep)] transition hover:bg-[rgba(230,232,222,0.58)]"
                >
                  Add default package
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AccountLayout>
  )
}
