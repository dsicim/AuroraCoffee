import { useEffect, useMemo, useState } from 'react'
import { buildApiUrl } from './api'

let cachedProducts = null
let productsPromise = null

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
    const slug = (baseSlugCounts.get(baseSlug) || 0) > 1
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

async function requestProducts() {
  const response = await fetch(buildApiUrl('/products/all'))
  const payload = await response.json().catch(() => ({}))

  if (!response.ok || payload?.e) {
    throw new Error(payload?.e || 'Could not load products')
  }

  const normalizedProducts = buildSlugMap(payload?.products || []).map(normalizeProduct)
  cachedProducts = normalizedProducts
  return normalizedProducts
}

export async function fetchAllProducts({ force = false } = {}) {
  if (cachedProducts && !force) {
    return cachedProducts
  }

  if (productsPromise && !force) {
    return productsPromise
  }

  productsPromise = requestProducts().finally(() => {
    productsPromise = null
  })

  return productsPromise
}

export function getCachedProducts() {
  return cachedProducts || []
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

export function getProductCategoryLabel(product) {
  return product?.categoryName || product?.parentCategoryName || 'Catalog'
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
        .map((product) => getProductCategoryLabel(product))
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
  const [products, setProducts] = useState(() => getCachedProducts())
  const [loading, setLoading] = useState(() => !getCachedProducts().length)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    fetchAllProducts()
      .then((nextProducts) => {
        if (!active) {
          return
        }

        setProducts(nextProducts)
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
    }
  }, [])

  return { products, loading, error }
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
