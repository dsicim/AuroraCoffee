import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import LiquidGlassButton from '../shared/components/ui/LiquidGlassButton'
import ProductCard from '../features/products/presentation/ProductCard'
import { addDefaultProductToCart } from '../lib/accountActions'
import { getCartErrorMessage } from '../lib/cart'
import {
  fetchWishlistItems,
  getWishlistProductReferences,
  wishlistChangeEvent,
} from '../lib/wishlist'
import {
  fetchProductsByIds,
  fetchProductsBySlugs,
} from '../lib/products'

function splitProductReferences(references) {
  const numericIds = []
  const slugs = []

  for (const reference of references || []) {
    const normalizedReference = String(reference || '').trim()

    if (!normalizedReference) {
      continue
    }

    if (/^\d+$/.test(normalizedReference)) {
      numericIds.push(Number(normalizedReference))
    } else {
      slugs.push(normalizedReference)
    }
  }

  return { numericIds, slugs }
}

export default function FavoritesPage() {
  const [favoriteProducts, setFavoriteProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [feedbackType, setFeedbackType] = useState('success')

  useEffect(() => {
    let active = true

    const syncFavorites = async () => {
      setLoading(true)

      try {
        const references = await fetchWishlistItems()
        const { numericIds, slugs } = splitProductReferences(references || getWishlistProductReferences())
        const [productsById, productsBySlug] = await Promise.all([
          numericIds.length ? fetchProductsByIds(numericIds) : [],
          slugs.length ? fetchProductsBySlugs(slugs) : [],
        ])

        if (!active) {
          return
        }

        const productsByKey = new Map()

        for (const product of [...productsById, ...productsBySlug]) {
          productsByKey.set(product.id, product)
        }

        setFavoriteProducts(Array.from(productsByKey.values()))
      } catch {
        if (active) {
          setFavoriteProducts([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    window.addEventListener(wishlistChangeEvent, syncFavorites)
    void syncFavorites()

    return () => {
      active = false
      window.removeEventListener(wishlistChangeEvent, syncFavorites)
    }
  }, [])

  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback('')
      setFeedbackType('success')
    }, 2600)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [feedback])

  const handleQuickAdd = async (productSlug) => {
    let result

    try {
      result = await addDefaultProductToCart(productSlug)
    } catch (error) {
      setFeedbackType('error')
      setFeedback(getCartErrorMessage(error))
      return
    }

    if (result.status === 'added') {
      setFeedbackType('success')
      setFeedback(`Added ${result.product.name} to cart.`)
      return
    }

    if (result.status === 'sold-out') {
      setFeedbackType('error')
      setFeedback(`${result.product.name} is sold out right now.`)
      return
    }

    setFeedbackType('error')
    setFeedback('That coffee is no longer available.')
  }

  return (
    <AccountLayout
      eyebrow="Favorites"
      title="Saved coffees worth revisiting"
      description="Come back to saved coffees, jump into product details, or send the default package straight into the cart."
    >
      {feedback ? (
        <div
          className={`aurora-message aurora-message-${feedbackType} mb-6`}
          role={feedbackType === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
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
