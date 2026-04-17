import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AuroraWidget from '../components/AuroraWidget'
import LiquidGlassButton from '../components/LiquidGlassButton'
import LiquidGlassFrame from '../components/LiquidGlassFrame'
import ProductCard from '../components/ProductCard'
import StorefrontLayout from '../components/StorefrontLayout'
import {
  getProductCategories,
  getProductCategoryName,
  getProductRequestErrorMessage,
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
  const { products, loaded, loading, error } = useProductCatalog()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') || ''
  const [category, setCategory] = useState('All')
  const [sortBy, setSortBy] = useState('newest')
  const [remoteResults, setRemoteResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  const categories = useMemo(
    () => (loaded ? getProductCategories(products) : []),
    [loaded, products],
  )
  const normalizedSearch = search.trim().toLowerCase()
  const sourceProducts = remoteResults || products

  const updateSearch = (nextSearch) => {
    const nextParams = new URLSearchParams(searchParams)
    const normalizedNextSearch = nextSearch.trim()

    if (normalizedNextSearch) {
      nextParams.set('search', nextSearch)
    } else {
      nextParams.delete('search')
    }

    setSearchParams(nextParams, { replace: true })
  }

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

          setSearchError(getProductRequestErrorMessage(requestError, 'Search unavailable'))
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
        sourceProducts.filter(
          (product) => category === 'All' || getProductCategoryName(product) === category,
        ),
        sortBy,
      ),
    [category, sourceProducts, sortBy],
  )
  const activeCatalogCopy = category === 'All'
    ? 'Showing every coffee and brewing product.'
    : `Filtered to ${category}.`
  const loadingCatalog = loading || searchLoading
  const catalogMessage = loadingCatalog
    ? 'Loading the live catalog.'
    : error || searchError
      ? error || searchError
      : activeCatalogCopy
  const hero = (
    <section className="aurora-showcase-band aurora-shop-hero p-6 sm:p-8 lg:p-10">
      <p className="aurora-kicker">Shop Aurora</p>
      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(16rem,0.28fr)] lg:items-end">
        <div>
          <h1 className="font-display text-5xl leading-[0.98] text-[var(--aurora-text-strong)] md:text-6xl">
            Coffee, gear, and refills in one place.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--aurora-text)] sm:text-lg">
            Search by flavor, brew method, or equipment, then sort by price or newest arrivals without leaving the product grid.
          </p>
        </div>
        <div className="aurora-solid-plate hidden rounded-[1.7rem] p-5 sm:block">
          <p className="aurora-kicker">Available now</p>
          <p className="mt-3 font-display text-4xl text-[var(--aurora-text-strong)]">
            {loading ? '...' : products.length}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--aurora-text)]">
            Products loaded from the current catalog.
          </p>
        </div>
      </div>
    </section>
  )

  return (
    <StorefrontLayout hero={hero} contentClassName="aurora-stack-12">
      <section className="aurora-content-split">
        <LiquidGlassFrame
          as="div"
          className="aurora-glass-dock glass-search rounded-[2.2rem]"
          contentClassName="p-4 sm:p-6 lg:p-7"
        >
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="aurora-kicker">Find products</p>
              <h2 className="font-display text-3xl text-[var(--aurora-text-strong)]">
                Shop the catalog
              </h2>
            </div>
            <p className="text-sm leading-6 text-[var(--aurora-text)]">
              {catalogMessage}
            </p>
          </div>

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
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder="Search coffee, notes, gear, or brew method"
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

          <div className="aurora-product-filter-row mt-5 flex flex-wrap gap-2.5">
            {!loaded && !error ? (
              <p className="text-sm leading-7 text-[var(--aurora-text)]">
                Loading categories
              </p>
            ) : (
              categories.map((option) => (
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
              ))
            )}
          </div>
        </LiquidGlassFrame>

        <AuroraWidget
          title={loadingCatalog ? 'Loading products' : `${filteredProducts.length} products`}
          subtitle={category === 'All' ? 'All categories' : category}
          icon="package"
          className="aurora-operational-card hidden h-fit rounded-[2rem] p-6 lg:block"
        >
          <p className="text-sm leading-8 text-[var(--aurora-text)]">
            {catalogMessage}
          </p>
        </AuroraWidget>
      </section>

      <section className="aurora-stack-6">
        <div>
          <p className="aurora-kicker">Results</p>
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
