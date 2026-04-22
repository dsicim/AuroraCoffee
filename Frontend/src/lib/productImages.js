import brazilSantosImage from '../assets/products/brazil-santos.png'
import burrGrinderProImage from '../assets/products/burr-grinder-pro.png'
import classicFrenchPressImage from '../assets/products/classic-french-press.png'
import colombiaHuilaImage from '../assets/products/colombia-huila.png'
import darkEspressoRoastImage from '../assets/products/dark-espresso-roast.png'
import ethiopiaYirgacheffeImage from '../assets/products/ethiopia-yirgacheffe.png'
import glassDripServerImage from '../assets/products/glass-drip-server.png'
import guatemalaGreenValleyImage from '../assets/products/guatemala-green-valley.png'
import kenyanAaFilterImage from '../assets/products/kenyan-aa-filter.png'
import matteBlackMugImage from '../assets/products/matte-black-mug.png'
import morningBlendImage from '../assets/products/morning-blend.png'
import napoliBlendImage from '../assets/products/napoli-blend.png'
import urbanThermosImage from '../assets/products/urban-thermos.png'
import v60FilterPaperImage from '../assets/products/v60-filter-paper.png'

const productImageBySlug = Object.freeze({
  'brazil-santos': brazilSantosImage,
  'burr-grinder-pro': burrGrinderProImage,
  'classic-french-press': classicFrenchPressImage,
  'colombia-huila': colombiaHuilaImage,
  'dark-espresso-roast': darkEspressoRoastImage,
  'ethiopia-yirgacheffe': ethiopiaYirgacheffeImage,
  'glass-drip-server': glassDripServerImage,
  'guatemala-green-valley': guatemalaGreenValleyImage,
  'kenyan-aa-filter': kenyanAaFilterImage,
  'matte-black-mug': matteBlackMugImage,
  'morning-blend': morningBlendImage,
  'napoli-blend': napoliBlendImage,
  'urban-thermos': urbanThermosImage,
  'v60-filter-paper': v60FilterPaperImage,
})

const coffeeGallerySlugs = new Set([
  'brazil-santos',
  'colombia-huila',
  'dark-espresso-roast',
  'ethiopia-yirgacheffe',
  'guatemala-green-valley',
  'kenyan-aa-filter',
  'morning-blend',
  'napoli-blend',
])

const coffeeGallerySizeKeys = ['250g', '500g', '1kg']

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeCode(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeSizeKey(value) {
  const normalizedValue = slugify(value).replace(/-/g, '')

  if (!normalizedValue) {
    return ''
  }

  if (normalizedValue.includes('250g') || normalizedValue.includes('quarterkilo')) {
    return '250g'
  }

  if (normalizedValue.includes('500g') || normalizedValue.includes('halfkilo')) {
    return '500g'
  }

  if (
    normalizedValue.includes('1kg') ||
    normalizedValue.includes('1kilo') ||
    normalizedValue.includes('1kilogram')
  ) {
    return '1kg'
  }

  return ''
}

function normalizeGalleryEntry(entry, index = 0) {
  if (!entry) {
    return null
  }

  if (typeof entry === 'string') {
    const src = normalizeText(entry)

    if (!src) {
      return null
    }

    return {
      key: `image-${index}`,
      src,
      alt: '',
      label: '',
      variantKey: '',
      optionValueCodes: null,
    }
  }

  if (typeof entry !== 'object') {
    return null
  }

  const src = normalizeText(entry.src || entry.url || entry.imageUrl || entry.href)

  if (!src) {
    return null
  }

  const label = normalizeText(entry.label || entry.title || entry.alt)
  const variantKey = normalizeSizeKey(entry.variantKey || entry.size || entry.sizeCode || label)

  return {
    key: normalizeCode(entry.key || entry.id || entry.name || `${src}-${index}`) || `image-${index}`,
    src,
    alt: normalizeText(entry.alt || label),
    label,
    variantKey,
    optionValueCodes:
      entry.optionValueCodes && typeof entry.optionValueCodes === 'object'
        ? entry.optionValueCodes
        : null,
  }
}

function normalizeSelectedOptionCode(product, selectedOptionsByGroup, group) {
  const groupKey = normalizeCode(group?.code || group?.id || group?.name)
  const selectedCode = normalizeCode(selectedOptionsByGroup?.[groupKey])

  if (!selectedCode) {
    return ''
  }

  const selectedValue = (group?.values || []).find((optionValue) => {
    const valueCode = normalizeCode(optionValue?.valueCode || optionValue?.id || optionValue?.label)
    return valueCode === selectedCode
  })

  return normalizeSizeKey(
    [
      group?.name,
      selectedValue?.label,
      selectedCode,
      product?.name,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function getSelectedGalleryVariantKey(product, selectedOptionsByGroup) {
  const optionGroups = Array.isArray(product?.options) ? product.options : []

  for (const group of optionGroups) {
    const selectedVariantKey = normalizeSelectedOptionCode(product, selectedOptionsByGroup, group)

    if (selectedVariantKey) {
      return selectedVariantKey
    }
  }

  return ''
}

function getProvidedGalleryImages(product) {
  const gallerySource =
    (Array.isArray(product?.images) && product.images) ||
    (Array.isArray(product?.galleryImages) && product.galleryImages) ||
    (Array.isArray(product?.imageGallery) && product.imageGallery) ||
    (Array.isArray(product?.gallery) && product.gallery) ||
    []

  return gallerySource
    .map((entry, index) => normalizeGalleryEntry(entry, index))
    .filter(Boolean)
}

function buildCoffeeGalleryImages(product, selectedOptionsByGroup) {
  const slug = normalizeCode(product?.slug)

  if (!coffeeGallerySlugs.has(slug)) {
    return []
  }

  const selectedVariantKey = getSelectedGalleryVariantKey(product, selectedOptionsByGroup)
  const primaryImage = normalizeGalleryEntry(
    {
      key: `${slug}-primary`,
      src: productImageBySlug[slug] || '',
      alt: product?.name ? `${product.name} product image` : 'Aurora Coffee product image',
      label: 'Primary image',
    },
    0,
  )

  const sizeImages = coffeeGallerySizeKeys
    .map((sizeKey, index) =>
      normalizeGalleryEntry(
        {
          key: `${slug}-${sizeKey}`,
          src: `/src/assets/products/attribute-images/${slug}-${sizeKey}.jpg`,
          alt: product?.name ? `${product.name} ${sizeKey}` : `${sizeKey} coffee product image`,
          label: sizeKey,
          variantKey: sizeKey,
        },
        index,
      ),
    )
    .filter(Boolean)

  const gallery = [...sizeImages]

  if (primaryImage?.src && !gallery.some((entry) => entry.src === primaryImage.src)) {
    gallery.push(primaryImage)
  }

  if (selectedVariantKey) {
    const preferredIndex = gallery.findIndex((entry) => entry.variantKey === selectedVariantKey)

    if (preferredIndex > 0) {
      const [preferredImage] = gallery.splice(preferredIndex, 1)
      gallery.unshift(preferredImage)
    }
  }

  return gallery
}

export function getProductGalleryImages(product, selectedOptionsByGroup = {}) {
  const providedGallery = getProvidedGalleryImages(product)

  if (providedGallery.length) {
    return providedGallery
  }

  const coffeeGallery = buildCoffeeGalleryImages(product, selectedOptionsByGroup)

  if (coffeeGallery.length) {
    return coffeeGallery
  }

  const generatedImage = getGeneratedProductImageUrl(product)

  if (generatedImage) {
    return [
      normalizeGalleryEntry(
        {
          key: normalizeCode(product?.slug || product?.id || 'product-image') || 'product-image',
          src: generatedImage,
          alt: product?.name ? `${product.name} product image` : 'Aurora Coffee product image',
          label: '',
        },
        0,
      ),
    ].filter(Boolean)
  }

  return []
}

export function getPreferredProductGalleryIndex(product, selectedOptionsByGroup = {}, images = []) {
  if (!Array.isArray(images) || !images.length) {
    return 0
  }

  const selectedVariantKey = getSelectedGalleryVariantKey(product, selectedOptionsByGroup)

  if (selectedVariantKey) {
    const preferredIndex = images.findIndex((entry) => entry?.variantKey === selectedVariantKey)

    if (preferredIndex >= 0) {
      return preferredIndex
    }
  }

  return 0
}

export function getGeneratedProductImageUrl(product) {
  return productImageBySlug[String(product?.slug || '').trim()] || ''
}
