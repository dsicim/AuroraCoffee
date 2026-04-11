import { useEffect, useMemo, useState } from 'react'
import { buildApiUrl } from './api'

export const productCatalogChangeEvent = 'aurora-product-catalog-change'

let cachedProducts = []
let cachedProductsLoaded = false
let productsPromise = null
const cachedProductsById = new Map()

function dispatchProductCatalogChange(type = 'sync') {
  window.dispatchEvent(
    new CustomEvent(productCatalogChangeEvent, {
      detail: { type },
    }),
  )
}

function clearProductsCache({ emit = true } = {}) {
  const hadState =
    cachedProducts.length > 0 ||
    cachedProductsLoaded ||
    productsPromise !== null ||
    cachedProductsById.size > 0

  cachedProducts = []
  cachedProductsLoaded = false
  productsPromise = null
  cachedProductsById.clear()

  if (emit && hadState) {
    dispatchProductCatalogChange('clear')
  }
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toNumber(value) {
  const numericValue =
    typeof value === 'number'
      ? value
      : Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''))

  return Number.isFinite(numericValue) ? numericValue : 0
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildSlugMap(rawProducts) {
  const baseSlugCounts = new Map()

  for (const product of rawProducts) {
    const baseSlug = slugify(product.name) || 'product'
    baseSlugCounts.set(baseSlug, (baseSlugCounts.get(baseSlug) || 0) + 1)
  }

  return rawProducts.map((product) => {
    const baseSlug = slugify(product.name) || 'product'
    const slug =
      (baseSlugCounts.get(baseSlug) || 0) > 1
        ? `${baseSlug}-${product.id}`
        : baseSlug

    return { ...product, slug }
  })
}

function normalizeProduct(rawProduct) {
  return {
    id: Number(rawProduct.id),
    slug: rawProduct.slug,
    name: normalizeText(rawProduct.name),
    description: normalizeText(rawProduct.description),
    price: toNumber(rawProduct.price),
    stock: Math.max(0, Number(rawProduct.stock) || 0),
    origin: normalizeText(rawProduct.origin),
    roastLevel: normalizeText(rawProduct.roast_level),
    acidity: normalizeText(rawProduct.acidity),
    flavorNotes: normalizeText(rawProduct.flavor_notes),
    material: normalizeText(rawProduct.material),
    capacity: normalizeText(rawProduct.capacity),
    imageUrl: normalizeText(rawProduct.image_url),
    categoryName: normalizeText(rawProduct.category_name),
    parentCategoryName: normalizeText(rawProduct.parent_category_name),
    createdAt: rawProduct.created_at || '',
  }
}

function storeProducts(products, { replace = false, markLoaded = cachedProductsLoaded } = {}) {
  const normalizedProducts = products.map(normalizeProduct)
  const nextLoaded = markLoaded || cachedProductsLoaded

  if (replace || !cachedProducts.length) {
    cachedProducts = normalizedProducts
  } else {
    const merged = new Map(cachedProducts.map((product) => [product.id, product]))
    for (const product of normalizedProducts) {
      merged.set(product.id, product)
    }
    cachedProducts = Array.from(merged.values())
  }

  cachedProductsById.clear()
  for (const product of cachedProducts) {
    cachedProductsById.set(product.id, product)
  }

  cachedProductsLoaded = nextLoaded
  dispatchProductCatalogChange(nextLoaded ? 'list' : 'partial')

  return normalizedProducts
}

function hydrateWithKnownSlugs(rawProducts) {
  if (!cachedProducts.length) {
    return buildSlugMap(rawProducts)
  }

  return rawProducts.map((product) => {
    const existing = cachedProductsById.get(Number(product.id))
    return {
      ...product,
      slug: existing?.slug || slugify(product.name) || `product-${product.id}`,
    }
  })
}

async function requestJson(path) {
  const response = await fetch(buildApiUrl(path))
  const payload = await response.json().catch(() => ({}))
  const data = payload?.d ?? payload

  if (!response.ok || data?.e || payload?.e) {
    throw new Error(data?.e || payload?.e || 'Request failed')
  }

  return data
}

async function requestProducts() {
  const payload = await requestJson('/products/all')
  const normalizedProducts = storeProducts(
    buildSlugMap(payload?.products || []),
    { replace: true, markLoaded: true },
  )
  return normalizedProducts
}

export async function fetchAllProducts({ force = false } = {}) {
  if (!force && productsPromise) {
    return productsPromise
  }

  productsPromise = requestProducts().finally(() => {
    productsPromise = null
  })

  return productsPromise
}

export async function fetchProductsByIds(ids) {
  const normalizedIds = Array.from(
    new Set(
      (ids || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  )

  if (!normalizedIds.length) {
    return []
  }

  const cachedMatches = normalizedIds
    .map((id) => cachedProductsById.get(id))
    .filter(Boolean)

  if (cachedMatches.length === normalizedIds.length) {
    return cachedMatches
  }

  const payload = await requestJson(`/products?ids=${normalizedIds.join(',')}`)
  const hydratedProducts = hydrateWithKnownSlugs(payload?.products || [])
  storeProducts(hydratedProducts, { markLoaded: false })

  return normalizedIds
    .map((id) => cachedProductsById.get(id))
    .filter(Boolean)
}

export async function searchProducts(query, sortBy = 'newest') {
  const normalizedQuery = String(query || '').trim()

  if (!normalizedQuery) {
    return fetchAllProducts()
  }

  const backendSort =
    sortBy === 'price-asc'
      ? 'price_asc'
      : sortBy === 'price-desc'
        ? 'price_desc'
        : sortBy === 'oldest'
          ? 'oldest'
          : 'newest'

  const payload = await requestJson(
    `/products/search?q=${encodeURIComponent(normalizedQuery)}&s=${encodeURIComponent(backendSort)}`,
  )
  const hydratedProducts = hydrateWithKnownSlugs(payload?.products || [])
  storeProducts(hydratedProducts, { markLoaded: false })
  return hydratedProducts.map(normalizeProduct)
}

export function getCachedProducts() {
  return cachedProducts
}

export function getProductCatalogSnapshot() {
  return {
    products: getCachedProducts(),
    loaded: cachedProductsLoaded,
  }
}

export function invalidateProductCatalogCache() {
  clearProductsCache()
}

export async function findProductBySlug(slug) {
  const products = await fetchAllProducts()
  return products.find((product) => product.slug === slug) || null
}

export async function findProductByReference(reference) {
  const normalizedReference = String(reference || '').trim()

  if (!normalizedReference) {
    return null
  }

  const numericReference = Number(normalizedReference)

  if (Number.isFinite(numericReference) && numericReference > 0) {
    const byId = await fetchProductsByIds([numericReference])
    if (byId[0]) {
      return byId[0]
    }
  }

  const products = await fetchAllProducts()

  return (
    products.find((product) => product.slug === normalizedReference) ||
    products.find((product) => String(product.id) === normalizedReference) ||
    null
  )
}

export function getProductAvailability(product) {
  return {
    hasStock: (product?.stock || 0) > 0,
    totalStock: Math.max(0, Number(product?.stock) || 0),
  }
}

export function getProductFlavorNotes(product) {
  return normalizeText(product?.flavorNotes)
    .split(',')
    .map((note) => note.trim())
    .filter(Boolean)
}

export function isCoffeeProduct(product) {
  return (
    product?.parentCategoryName?.toLowerCase() === 'coffee' ||
    Boolean(product?.roastLevel || product?.origin || product?.flavorNotes)
  )
}

export function getProductCategoryName(product) {
  return product?.categoryName || product?.parentCategoryName || ''
}

export function getProductCategoryLabel(product) {
  return getProductCategoryName(product) || 'Catalog'
}

export function getProductTypeLabel(product) {
  if (isCoffeeProduct(product)) {
    return product?.roastLevel || getProductCategoryLabel(product)
  }

  return getProductCategoryLabel(product)
}

export function getProductMetaLine(product) {
  const pieces = isCoffeeProduct(product)
    ? [product?.origin, product?.acidity ? `${product.acidity} acidity` : '']
    : [product?.material, product?.capacity]

  return pieces.filter(Boolean).join(' · ')
}

export function getProductSearchText(product) {
  return [
    product?.name,
    product?.description,
    product?.origin,
    product?.roastLevel,
    product?.acidity,
    product?.flavorNotes,
    product?.material,
    product?.capacity,
    product?.categoryName,
    product?.parentCategoryName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function getProductCategories(products) {
  return [
    'All',
    ...new Set(
      (products || [])
        .map((product) => getProductCategoryName(product))
        .filter(Boolean),
    ),
  ]
}

export function getRelatedProducts(products, targetProduct, limit = 3) {
  return (products || [])
    .filter((product) => product.slug !== targetProduct?.slug)
    .sort((left, right) => {
      const leftScore =
        (left.categoryName === targetProduct?.categoryName ? 2 : 0) +
        (left.parentCategoryName === targetProduct?.parentCategoryName ? 1 : 0)
      const rightScore =
        (right.categoryName === targetProduct?.categoryName ? 2 : 0) +
        (right.parentCategoryName === targetProduct?.parentCategoryName ? 1 : 0)

      if (rightScore !== leftScore) {
        return rightScore - leftScore
      }

      return right.stock - left.stock
    })
    .slice(0, limit)
}

export function useProductCatalog() {
  const [snapshot, setSnapshot] = useState(() => getProductCatalogSnapshot())
  const [loading, setLoading] = useState(() => !getProductCatalogSnapshot().loaded)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const syncSnapshot = () => {
      if (!active) {
        return
      }

      const nextSnapshot = getProductCatalogSnapshot()
      setSnapshot(nextSnapshot)

      if (nextSnapshot.loaded) {
        setLoading(false)
      }
    }

    window.addEventListener(productCatalogChangeEvent, syncSnapshot)
    syncSnapshot()

    fetchAllProducts()
      .then((nextProducts) => {
        if (!active) {
          return
        }

        setSnapshot({
          products: nextProducts,
          loaded: true,
        })
        setError('')
      })
      .catch((fetchError) => {
        if (!active) {
          return
        }

        setError(fetchError.message || 'Could not load products')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
      window.removeEventListener(productCatalogChangeEvent, syncSnapshot)
    }
  }, [])

  return {
    products: snapshot.products,
    loaded: snapshot.loaded,
    loading,
    error,
  }
}

export function useProductBySlug(slug) {
  const catalog = useProductCatalog()

  const product = useMemo(
    () => catalog.products.find((item) => item.slug === slug) || null,
    [catalog.products, slug],
  )

  return {
    ...catalog,
    product,
  }
}
