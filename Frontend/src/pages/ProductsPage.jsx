import { useEffect, useMemo, useState } from 'react'
import AuroraWidget from '../components/AuroraWidget'
import LiquidGlassButton from '../components/LiquidGlassButton'
import LiquidGlassFrame from '../components/LiquidGlassFrame'
import ProductCard from '../components/ProductCard'
import StorefrontLayout from '../components/StorefrontLayout'
import {
  getProductCategories,
  getProductCategoryLabel,
  searchProducts,
  useProductCatalog,
} from '../lib/products'

const sortOptions = [
  { value: 'newest', label: 'Newest first' },
  { value: 'name', label: 'Name: A to Z' },
  { value: 'price-asc', label: 'Price: Low to high' },
  { value: 'price-desc', label: 'Price: High to low' },
]

function sortProducts(items, sortBy) {
  const sortableItems = [...items]

  if (sortBy === 'name') {
    return sortableItems.sort((left, right) => left.name.localeCompare(right.name))
  }

  if (sortBy === 'price-asc') {
    return sortableItems.sort((left, right) => left.price - right.price)
  }

  if (sortBy === 'price-desc') {
    return sortableItems.sort((left, right) => right.price - left.price)
  }

  return sortableItems.sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )
}

export default function ProductsPage() {
  const { products, loading, error } = useProductCatalog()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sortBy, setSortBy] = useState('newest')
  const [remoteResults, setRemoteResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  const categories = useMemo(() => getProductCategories(products), [products])
  const normalizedSearch = search.trim().toLowerCase()
  const sourceProducts = remoteResults || products

  useEffect(() => {
    if (!normalizedSearch) {
      const frameId = window.requestAnimationFrame(() => {
        setRemoteResults(null)
        setSearchError('')
        setSearchLoading(false)
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }

    let active = true
    const timeoutId = window.setTimeout(() => {
      setSearchLoading(true)
      searchProducts(normalizedSearch, sortBy === 'name' ? 'newest' : sortBy)
        .then((nextProducts) => {
          if (!active) {
            return
          }

          setRemoteResults(nextProducts)
          setSearchError('')
        })
        .catch((requestError) => {
          if (!active) {
            return
          }

          setSearchError(requestError.message || 'Search unavailable')
          setRemoteResults([])
        })
        .finally(() => {
          if (active) {
            setSearchLoading(false)
          }
        })
    }, 220)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [normalizedSearch, sortBy])

  const filteredProducts = useMemo(
    () =>
      sortProducts(
        sourceProducts.filter((product) => category === 'All' || getProductCategoryLabel(product) === category),
        sortBy,
      ),
    [category, sourceProducts, sortBy],
  )

  return (
    <StorefrontLayout contentClassName="aurora-stack-12">
      <section className="aurora-content-split">
        <LiquidGlassFrame
          as="div"
          className="aurora-glass-dock glass-search rounded-[2.2rem]"
          contentClassName="p-4 sm:p-6 lg:p-7"
        >
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <label className="block">
              <span className="aurora-field-label">
                Search products
              </span>
              <div className="glass-search-field">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-[var(--aurora-text)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, category, notes, or description"
                  className="glass-search-input"
                />
              </div>
            </label>

            <label className="block">
              <span className="aurora-field-label">
                Sort results
              </span>
              <div className="glass-dropdown-surface">
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="glass-dropdown-select"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {categories.map((option) => (
              <LiquidGlassButton
                key={option}
                type="button"
                variant="chip"
                size="compact"
                selected={category === option}
                onClick={() => setCategory(option)}
              >
                {option}
              </LiquidGlassButton>
            ))}
          </div>
        </LiquidGlassFrame>

        <AuroraWidget
          title={`${filteredProducts.length} products`}
          subtitle="Catalog view"
          icon="package"
          className="aurora-operational-card hidden h-fit rounded-[2rem] p-6 lg:block"
        >
          <p className="text-sm leading-8 text-[var(--aurora-text)]">
              {loading || searchLoading
                ? 'Loading the live catalog.'
              : error || searchError
                ? error || searchError
                : 'Results are coming directly from the backend product feed.'}
          </p>
        </AuroraWidget>
      </section>

      <section className="aurora-stack-6">
        <div>
          <p className="aurora-kicker">Catalog results</p>
          <h2 className="mt-3 font-display text-3xl text-[var(--aurora-text-strong)] sm:mt-4 sm:text-4xl">
            {loading ? 'Loading products' : `${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'}`}
          </h2>
        </div>

        {loading || searchLoading ? (
          <div className="aurora-solid-plate rounded-[2rem] px-6 py-12 text-center">
            <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
              Loading products
            </p>
          </div>
        ) : error || searchError ? (
          <div className="aurora-solid-plate rounded-[2rem] px-6 py-12 text-center">
            <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
              Catalog unavailable
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
              {error || searchError}
            </p>
          </div>
        ) : filteredProducts.length ? (
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.slug} product={product} compact />
            ))}
          </div>
        ) : (
          <div className="aurora-solid-plate rounded-[2rem] px-6 py-12 text-center">
            <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
              No products match that search
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
              Try a broader term or a different category.
            </p>
          </div>
        )}
      </section>
    </StorefrontLayout>
  )
}
