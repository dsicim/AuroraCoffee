import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CoffeeBeanDecor from '../components/CoffeeBeanDecor'
import FavoriteToggleButton from '../components/FavoriteToggleButton'
import Footer from '../components/Footer'
import Header from '../components/Header'
import ProductCard from '../components/ProductCard'
import { addCartItem } from '../lib/cart'
import {
  getDefaultVariant,
  getProductAvailability,
  getProductById,
  getRelatedProducts,
} from '../data/products'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function renderStars(rating) {
  const roundedRating = Math.round(rating)
  return '★'.repeat(roundedRating) + '☆'.repeat(5 - roundedRating)
}

export default function ProductDetailPage() {
  const { productId } = useParams()
  const product = getProductById(productId)
  const [feedback, setFeedback] = useState('')
  const [selectedWeight, setSelectedWeight] = useState(() =>
    product ? getDefaultVariant(product)?.weight || '' : '',
  )
  const [selectedGrind, setSelectedGrind] = useState(() =>
    product ? getDefaultVariant(product)?.grind || '' : '',
  )

  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback('')
    }, 2400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [feedback])

  if (!product) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#f7e6d9_0%,#efd3bf_34%,#e0b495_64%,#cf9877_100%)]">
        <CoffeeBeanDecor />
        <Header />

        <main className="relative z-10 px-6 pb-16 pt-6 lg:px-10">
          <div className="mx-auto max-w-4xl rounded-[2.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.86)] p-10 text-center shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
              Product unavailable
            </p>
            <h1 className="mt-4 font-display text-5xl text-[var(--aurora-text-strong)]">
              That coffee could not be found
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--aurora-text)]">
              The product route does not match anything in the current demo
              catalog. Return to the shop to continue browsing.
            </p>
            <Link
              to="/products"
              className="mt-8 inline-flex rounded-full border border-[#d89270] bg-[var(--aurora-primary)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-text-strong)] shadow-[0_14px_36px_rgba(235,176,144,0.28)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-primary-soft)]"
            >
              Back to products
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    )
  }

  const relatedProducts = getRelatedProducts(product)
  const availability = getProductAvailability(product)
  const availableWeights = [...new Set(product.variants.map((variant) => variant.weight))]
  const availableGrinds = product.variants
    .filter((variant) => variant.weight === selectedWeight)
    .map((variant) => variant.grind)
  const selectedVariant =
    product.variants.find(
      (variant) =>
        variant.weight === selectedWeight && variant.grind === selectedGrind,
    ) || getDefaultVariant(product)
  const isOutOfStock = !selectedVariant || selectedVariant.stock <= 0

  const handleWeightChange = (weight) => {
    setSelectedWeight(weight)

    const matchingVariant =
      product.variants.find(
        (variant) => variant.weight === weight && variant.grind === selectedGrind,
      ) ||
      product.variants.find(
        (variant) => variant.weight === weight && variant.stock > 0,
      ) ||
      product.variants.find((variant) => variant.weight === weight)

    if (matchingVariant) {
      setSelectedGrind(matchingVariant.grind)
    }
  }

  const handleAddToCart = () => {
    if (isOutOfStock) {
      return
    }

    addCartItem(product, selectedVariant)
    setFeedback(
      `Added ${selectedVariant.weight} / ${selectedVariant.grind} to cart`,
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#f7e6d9_0%,#efd3bf_34%,#e0b495_64%,#cf9877_100%)]">
      <CoffeeBeanDecor />
      <Header />

      <main className="relative z-10 px-6 pb-16 pt-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center gap-2 text-sm text-[var(--aurora-text)]">
            <Link to="/" className="transition hover:text-[var(--aurora-text-strong)]">
              Home
            </Link>
            <span>/</span>
            <Link
              to="/products"
              className="transition hover:text-[var(--aurora-text-strong)]"
            >
              Products
            </Link>
            <span>/</span>
            <span className="font-semibold text-[var(--aurora-text-strong)]">
              {product.name}
            </span>
          </div>

          <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="overflow-hidden rounded-[2.75rem] border border-[var(--aurora-border)] bg-[linear-gradient(160deg,#f4c7ae_0%,#ebb090_50%,#d98f6b_100%)] p-8 text-[var(--aurora-cream)] shadow-[0_35px_100px_rgba(176,110,78,0.24)]">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-[rgba(255,247,242,0.3)] bg-[rgba(255,247,242,0.16)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.26em]">
                  {product.category}
                </span>
                <span className="text-sm text-[#fff4ee]">{product.origin}</span>
              </div>

              <div className="mt-10">
                <p className="text-sm uppercase tracking-[0.3em] text-[#fff0e6]">
                  {product.roast}
                </p>
                <h1 className="mt-4 font-display text-5xl leading-tight text-[var(--aurora-cream)]">
                  {product.name}
                </h1>
                <p className="mt-5 max-w-xl text-base leading-8 text-[#fff4ee]">
                  {product.story}
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.5rem] bg-white/18 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#fff4ee]">
                    Rating
                  </p>
                  <p className="mt-2 font-display text-3xl">{product.rating.toFixed(1)}</p>
                </div>
                <div className="rounded-[1.5rem] bg-white/18 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#fff4ee]">
                    Reviews
                  </p>
                  <p className="mt-2 font-display text-3xl">{product.reviewCount}</p>
                </div>
                <div className="rounded-[1.5rem] bg-white/18 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#fff4ee]">
                    Stock
                  </p>
                  <p className="mt-2 font-display text-3xl">
                    {availability.hasStock ? availability.totalStock : 'Sold out'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                    Product details
                  </p>
                </div>
                <FavoriteToggleButton
                  productId={product.id}
                  productName={product.name}
                />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-[rgba(138,144,119,0.24)] bg-[rgba(230,232,222,0.36)] px-4 py-2 text-sm font-semibold text-[var(--aurora-olive-deep)]">
                  {renderStars(product.rating)}
                </span>
                <span className="text-sm font-medium text-[var(--aurora-text)]">
                  {product.reviewCount} read-only customer notes
                </span>
              </div>

              <p className="mt-6 text-lg leading-8 text-[var(--aurora-text)]">
                {product.description}
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                {product.notes.map((note) => (
                  <span
                    key={note}
                    className="rounded-full border border-[rgba(122,130,96,0.34)] bg-[rgba(223,227,209,0.28)] px-3 py-1 text-xs text-[var(--aurora-olive-deep)]"
                  >
                    {note}
                  </span>
                ))}
              </div>

              <div className="mt-8 rounded-[2rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.8)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                      Selected package
                    </p>
                    <p className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
                      {selectedVariant
                        ? formatCurrency(selectedVariant.price)
                        : 'Unavailable'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      isOutOfStock
                        ? 'bg-[rgba(217,144,107,0.24)] text-[var(--aurora-text-strong)]'
                        : 'bg-[var(--aurora-olive-soft)] text-[var(--aurora-olive-deep)]'
                    }`}
                  >
                    {isOutOfStock
                      ? 'Variant out of stock'
                      : `${selectedVariant.stock} bags ready`}
                  </span>
                </div>

                <p className="mt-5 text-sm leading-7 text-[var(--aurora-text)]">
                  {product.brewGuide}
                </p>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--aurora-text-strong)]">
                      Weight
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {availableWeights.map((weight) => (
                        <button
                          key={weight}
                          type="button"
                          onClick={() => handleWeightChange(weight)}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                            selectedWeight === weight
                              ? 'border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] text-[var(--aurora-cream)]'
                              : 'border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.92)] text-[var(--aurora-text-strong)] hover:bg-[var(--aurora-primary-pale)]'
                          }`}
                        >
                          {weight}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-[var(--aurora-text-strong)]">
                      Grind
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {availableGrinds.map((grind) => {
                        const variant = product.variants.find(
                          (candidate) =>
                            candidate.weight === selectedWeight &&
                            candidate.grind === grind,
                        )
                        const grindOutOfStock = !variant || variant.stock <= 0

                        return (
                          <button
                            key={grind}
                            type="button"
                            onClick={() => setSelectedGrind(grind)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                              selectedGrind === grind
                                ? 'border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] text-[var(--aurora-cream)]'
                                : 'border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.92)] text-[var(--aurora-text-strong)] hover:bg-[var(--aurora-primary-pale)]'
                            } ${grindOutOfStock ? 'opacity-60' : ''}`}
                          >
                            {grind}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {selectedVariant ? (
                  <p className="mt-5 text-sm leading-7 text-[var(--aurora-text)]">
                    {selectedVariant.weight} / {selectedVariant.grind}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className="mt-6 w-full rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-6 py-3.5 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_14px_36px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {isOutOfStock ? 'Currently unavailable' : 'Add to cart'}
                </button>

                {feedback ? (
                  <p className="mt-4 rounded-[1.25rem] border border-[rgba(138,144,119,0.28)] bg-[rgba(230,232,222,0.5)] px-4 py-3 text-sm font-medium text-[var(--aurora-olive-deep)]">
                    {feedback}
                  </p>
                ) : null}
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.95)] p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Origin
                  </p>
                  <p className="mt-3 text-base font-semibold text-[var(--aurora-text-strong)]">
                    {product.origin}
                  </p>
                </div>
                <div className="rounded-[1.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.95)] p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--aurora-olive-deep)]">
                    Roast profile
                  </p>
                  <p className="mt-3 text-base font-semibold text-[var(--aurora-text-strong)]">
                    {product.roast}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                Customer impressions
              </p>
              <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                Read-only review preview
              </h2>

              <div className="mt-8 space-y-4">
                {product.reviews.map((review) => (
                  <article
                    key={`${product.id}-${review.author}`}
                    className="rounded-[1.75rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.95)] p-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-semibold text-[var(--aurora-text-strong)]">
                        {review.author}
                      </p>
                      <p className="text-sm text-[var(--aurora-primary)]">
                        {renderStars(review.score)}
                      </p>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                      {review.quote}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.88)] p-8 shadow-[0_24px_70px_rgba(108,69,51,0.1)] backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                You may also like
              </p>
              <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                More from the lineup
              </h2>

              <div className="mt-8 grid gap-6 xl:grid-cols-2">
                {relatedProducts.map((relatedProduct) => (
                  <ProductCard
                    key={relatedProduct.id}
                    product={relatedProduct}
                    compact
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
