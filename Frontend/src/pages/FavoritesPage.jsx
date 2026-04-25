import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
import ProductCard from '../features/products/presentation/ProductCard'
import { addDefaultProductToCart } from '../lib/accountActions'
import {
  accountDataChangeEvent,
  getFavoriteProductIds,
} from '../lib/accountData'
import { useProductCatalog } from '../lib/products'

export default function FavoritesPage() {
  const { products, loading } = useProductCatalog()
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
    favoriteIds.includes(product.slug),
  )

  const handleQuickAdd = async (productSlug) => {
    const result = await addDefaultProductToCart(productSlug)

    if (result.status === 'added') {
      setFeedback(`Added ${result.product.name} to cart.`)
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
        <div className="aurora-message aurora-message-success mb-6">
          {feedback}
        </div>
      ) : null}

      {!favoriteProducts.length ? (
        <div className="aurora-ops-card border-dashed px-6 py-12 text-center">
          <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
            {loading ? 'Loading favorites' : 'No favorites saved yet'}
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--aurora-text)]">
            Use the heart action on product cards or product detail pages to
            build a shortlist here.
          </p>
          <LiquidGlassButton
            as={Link}
            to="/products"
            variant="secondary"
            size="hero"
            className="mt-6"
          >
            Explore products
          </LiquidGlassButton>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {favoriteProducts.map((product) => (
            <div key={product.slug} className="space-y-4">
              <ProductCard product={product} compact />
              <div className="aurora-ops-card flex items-center gap-3 px-4 py-4">
                <Link
                  to={`/products/${product.slug}`}
                  className="text-sm font-semibold text-[var(--aurora-sky-deep)] transition hover:text-[var(--aurora-text-strong)]"
                >
                  View product
                </Link>
                <LiquidGlassButton
                  type="button"
                  variant="soft"
                  size="compact"
                  onClick={() => handleQuickAdd(product.slug)}
                >
                  Add to cart
                </LiquidGlassButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </AccountLayout>
  )
}
