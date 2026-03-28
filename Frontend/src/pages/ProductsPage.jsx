import { useState } from 'react'
import Footer from '../components/Footer'
import Header from '../components/Header'
import ProductCard from '../components/ProductCard'
import CoffeeBeanDecor from '../components/CoffeeBeanDecor'
import { getMinimumVariantPrice, productCategories, products } from '../data/products'

const sortOptions = [
  { value: 'popularity', label: 'Most popular' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price-asc', label: 'Price: Low to high' },
  { value: 'price-desc', label: 'Price: High to low' },
]

function sortProducts(items, sortBy) {
  const sortableItems = [...items]

  if (sortBy === 'rating') {
    return sortableItems.sort((left, right) => right.rating - left.rating)
  }

  if (sortBy === 'price-asc') {
    return sortableItems.sort(
      (left, right) =>
        getMinimumVariantPrice(left) - getMinimumVariantPrice(right),
    )
  }

  if (sortBy === 'price-desc') {
    return sortableItems.sort(
      (left, right) =>
        getMinimumVariantPrice(right) - getMinimumVariantPrice(left),
    )
  }

  return sortableItems.sort((left, right) => right.popularity - left.popularity)
}

export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sortBy, setSortBy] = useState('popularity')

  const normalizedSearch = search.trim().toLowerCase()
  const filteredProducts = sortProducts(
    products.filter((product) => {
      const matchesCategory =
        category === 'All' || product.category === category
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.description.toLowerCase().includes(normalizedSearch) ||
        product.notes.some((note) =>
          note.toLowerCase().includes(normalizedSearch),
        )

      return matchesCategory && matchesSearch
    }),
    sortBy,
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_center,#f7e6d9_0%,#efd3bf_34%,#e0b495_64%,#cf9877_100%)]">
      <CoffeeBeanDecor />
      <Header />

      <main className="relative z-10 px-6 pb-16 pt-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-[2.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.86)] p-8 shadow-[0_30px_80px_rgba(108,69,51,0.12)] backdrop-blur lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                  Coffee catalog
                </p>
                <h1 className="mt-4 max-w-3xl font-display text-5xl leading-tight text-[var(--aurora-text-strong)] md:text-6xl">
                  Explore a warmer, more complete storefront for the progress demo.
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--aurora-text)]">
                  Browse signature coffees, compare roast profiles, and move
                  directly into the product detail experience without leaving
                  the existing visual language.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.95)] p-4">
                  <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                    {products.length}
                  </p>
                  <p className="mt-1 text-sm text-[var(--aurora-text)]">
                    Coffee releases
                  </p>
                </div>
                <div className="rounded-[1.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.95)] p-4">
                  <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                    {productCategories.length - 1}
                  </p>
                  <p className="mt-1 text-sm text-[var(--aurora-text)]">
                    Browsable categories
                  </p>
                </div>
                <div className="rounded-[1.75rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.95)] p-4">
                  <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                    4.8
                  </p>
                  <p className="mt-1 text-sm text-[var(--aurora-text)]">
                    Demo rating focus
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-4 rounded-[2rem] border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.72)] p-5 lg:grid-cols-[1.15fr_0.85fr]">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                  Search coffees
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, notes, or description"
                  className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition placeholder:text-[rgba(111,71,56,0.48)] focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--aurora-text-strong)]">
                  Sort catalog
                </span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--aurora-border)] bg-white/85 px-4 py-3.5 text-[var(--aurora-text-strong)] outline-none transition focus:border-[var(--aurora-sky)] focus:ring-2 focus:ring-[rgba(144,180,196,0.22)]"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {productCategories.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCategory(option)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    category === option
                      ? 'border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] text-[var(--aurora-cream)] shadow-[0_10px_24px_rgba(144,180,196,0.22)]'
                      : 'border border-[rgba(138,144,119,0.24)] bg-[rgba(255,247,242,0.9)] text-[var(--aurora-text-strong)] hover:bg-[var(--aurora-primary-pale)]'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--aurora-olive-deep)]">
                  Product lineup
                </p>
                <h2 className="mt-4 font-display text-4xl text-[var(--aurora-text-strong)]">
                  {filteredProducts.length} coffee{filteredProducts.length === 1 ? '' : 's'} matching your view
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[var(--aurora-text)]">
                Out-of-stock coffees remain visible for the demo, but their cart
                actions are disabled.
              </p>
            </div>

            {filteredProducts.length ? (
              <div className="mt-10 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} compact />
                ))}
              </div>
            ) : (
              <div className="mt-10 rounded-[2rem] border border-dashed border-[rgba(138,144,119,0.35)] bg-[rgba(255,247,242,0.72)] px-6 py-12 text-center">
                <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
                  No coffees match that search
                </p>
                <p className="mt-4 text-sm leading-7 text-[var(--aurora-text)]">
                  Try a broader search term or switch to another category.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
