import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout'
import ProductCard from '../components/ProductCard'
import { products } from '../data/products'
import {
  accountDataChangeEvent,
  getFavoriteProductIds,
} from '../lib/accountData'

export default function FavoritesPage() {
  const [favoriteIds, setFavoriteIds] = useState(() => getFavoriteProductIds())

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

  const favoriteProducts = products.filter((product) =>
    favoriteIds.includes(product.id),
  )

  return (
    <AccountLayout
      eyebrow="Favorites"
      title="Saved coffees worth revisiting"
      description="Your favorites live here as product-level saves, so you can come back to a coffee and choose the exact package when you are ready to buy."
    >
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
            <ProductCard key={product.id} product={product} compact />
          ))}
        </div>
      )}
    </AccountLayout>
  )
}
