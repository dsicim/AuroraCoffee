import { fetchAuthJson } from './authRequest'
import { findProductByReference } from './products'

export class WishlistRequestError extends Error {
  constructor(message, status = 500, details = null) {
    super(message)
    this.name = 'WishlistRequestError'
    this.status = status
    this.details = details
  }
}

async function requestWishlistJson(path = '', options = {}) {
  const { response, payload, data } = await fetchAuthJson(`/wishlist${path}`, {
    ...options,
    json: true,
  })

  if (!response.ok || data?.e || payload?.e) {
    throw new WishlistRequestError(
      data?.e || payload?.e || 'Wishlist request failed',
      response.status,
      data,
    )
  }

  return data
}

async function resolveWishlistProduct(productReference) {
  const product = await findProductByReference(productReference)

  if (!product?.id) {
    throw new WishlistRequestError('Product could not be found.', 404)
  }

  return product
}

export async function fetchWishlistItems() {
  const data = await requestWishlistJson('', { method: 'GET' })
  return Array.isArray(data?.wishlist) ? data.wishlist : []
}

export async function addProductToWishlist(productReference) {
  const product = await resolveWishlistProduct(productReference)
  const data = await requestWishlistJson('', {
    method: 'POST',
    body: JSON.stringify({ id: product.id }),
  })

  return {
    ...data,
    product,
  }
}

export async function removeProductFromWishlist(productReference) {
  const product = await resolveWishlistProduct(productReference)
  const data = await requestWishlistJson(`?id=${encodeURIComponent(product.id)}`, {
    method: 'DELETE',
  })

  return {
    ...data,
    product,
  }
}