function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase()
    return normalizedValue === 'true' || normalizedValue === '1'
  }

  return false
}

export function normalizeProductImageUrl(value) {
  const url = normalizeText(value)

  if (!url) {
    return ''
  }

  if (/^(?:https?:|data:|blob:|\/)/i.test(url)) {
    return url
  }

  return `/uploads/${encodeURIComponent(url)}`
}

export function normalizeProductImage(rawImage, index) {
  if (!rawImage) {
    return null
  }

  if (typeof rawImage === 'string') {
    const url = normalizeText(rawImage)

    if (!url) {
      return null
    }

    return {
      id: null,
      url,
      src: normalizeProductImageUrl(url),
      isPrimary: index === 0,
      variantId: null,
      sortOrder: index,
    }
  }

  if (typeof rawImage !== 'object') {
    return null
  }

  const url = normalizeText(rawImage.url || rawImage.image_url || rawImage.imageUrl)

  if (!url) {
    return null
  }

  return {
    id: Number(rawImage.id) || null,
    url,
    src: normalizeProductImageUrl(url),
    isPrimary: toBoolean(rawImage.is_primary ?? rawImage.isPrimary),
    variantId: Number(rawImage.variant_id ?? rawImage.variantId) || null,
    sortOrder: Number(rawImage.sort_order ?? rawImage.sortOrder ?? index) || 0,
  }
}

function sortNormalizedProductImages(images) {
  return [...images].sort((left, right) =>
    left.sortOrder - right.sortOrder || Number(left.id || 0) - Number(right.id || 0),
  )
}

export function mergeUploadedProductImage(product, upload) {
  if (!product || typeof product !== 'object') {
    return product
  }

  const existingImages = Array.isArray(product.images) ? product.images : []
  const uploadedImage = normalizeProductImage(
    {
      url: upload?.url,
      isPrimary: Boolean(upload?.primary),
      sortOrder: upload?.sortOrder,
      variantId: upload?.variantId,
    },
    existingImages.length,
  )

  if (!uploadedImage) {
    return product
  }

  const shouldSetPrimary = uploadedImage.isPrimary || existingImages.length === 0
  const retainedImages = existingImages
    .filter((image) => image.url !== uploadedImage.url)
    .map((image) => (shouldSetPrimary ? { ...image, isPrimary: false } : image))
  const nextImage = {
    ...uploadedImage,
    isPrimary: shouldSetPrimary,
  }
  const nextImages = sortNormalizedProductImages([...retainedImages, nextImage])
  const primaryImage = nextImages.find((image) => image.isPrimary) || nextImages[0] || null

  return {
    ...product,
    imageUrl: primaryImage?.src || product.imageUrl,
    images: nextImages,
  }
}
