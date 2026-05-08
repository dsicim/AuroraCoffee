import urbanThermosBlackImage from '../../../assets/products/urban-thermos-black.png'
import urbanThermosRedImage from '../../../assets/products/urban-thermos-red.png'
import { getGeneratedProductImageUrl } from './generatedProductImages'

const productAttributeImageModules = import.meta.glob(
  '../../../assets/products/attribute-images/*.jpg',
  {
    eager: true,
    import: 'default',
  },
)

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

const productAttributeImageByFilename = Object.freeze(
  Object.fromEntries(
    Object.entries(productAttributeImageModules).map(([path, src]) => [
      path.split('/').pop(),
      src,
    ]),
  ),
)

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
    normalizedValue.includes('1000g') ||
    normalizedValue.includes('1000gram') ||
    normalizedValue.includes('1kg') ||
    normalizedValue.includes('1kilo') ||
    normalizedValue.includes('1kilogram')
  ) {
    return '1kg'
  }

  return ''
}

function normalizeColorKey(value) {
  const normalizedValue = slugify(value)

  if (!normalizedValue) {
    return ''
  }

  if (normalizedValue.includes('black')) {
    return 'black'
  }

  if (normalizedValue.includes('red')) {
    return 'red'
  }

  return ''
}

function normalizeGalleryVariantKey(value) {
  return normalizeSizeKey(value) || normalizeColorKey(value)
}

function getSelectedSizeKeyFromSelection(selectedOptionsByGroup) {
  if (!selectedOptionsByGroup || typeof selectedOptionsByGroup !== 'object') {
    return ''
  }

  for (const [groupKey, selectedCode] of Object.entries(selectedOptionsByGroup)) {
    const selectedSizeKey = normalizeSizeKey([groupKey, selectedCode].filter(Boolean).join(' '))

    if (selectedSizeKey) {
      return selectedSizeKey
    }
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
  const variantKey = normalizeGalleryVariantKey(
    entry.variantKey || entry.size || entry.sizeCode || entry.color || label,
  )

  return {
    key: normalizeCode(entry.key || entry.id || entry.name || `${src}-${index}`) || `image-${index}`,
    src,
    alt: normalizeText(entry.alt || label),
    label,
    variantKey,
    variantId: Number(entry.variantId ?? entry.variant_id) || null,
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
  ) || normalizeColorKey(
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

function getSelectedVariantImageId(product, selectedOptionsByGroup) {
  const optionGroups = Array.isArray(product?.options) ? product.options : []

  for (const group of optionGroups) {
    if (!group?.storeAsVariant) {
      continue
    }

    const groupKey = normalizeCode(group?.code || group?.id || group?.name)
    const selectedCode = normalizeCode(selectedOptionsByGroup?.[groupKey])

    if (!selectedCode) {
      continue
    }

    const selectedValue = (group?.values || []).find((optionValue) => {
      const valueCode = normalizeCode(optionValue?.valueCode || optionValue?.id || optionValue?.label)
      return valueCode === selectedCode
    })
    const selectedValueId = Number(selectedValue?.id)

    if (Number.isFinite(selectedValueId) && selectedValueId > 0) {
      return selectedValueId
    }
  }

  return null
}

function getSelectedGalleryVariantKey(product, selectedOptionsByGroup) {
  const selectedSizeKey = getSelectedSizeKeyFromSelection(selectedOptionsByGroup)

  if (selectedSizeKey) {
    return selectedSizeKey
  }

  for (const [groupKey, selectedCode] of Object.entries(selectedOptionsByGroup || {})) {
    const selectedColorKey = normalizeColorKey(
      [groupKey, selectedCode].filter(Boolean).join(' '),
    )

    if (selectedColorKey) {
      return selectedColorKey
    }
  }

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
  const gallery = coffeeGallerySizeKeys
    .map((sizeKey, index) =>
      normalizeGalleryEntry(
        {
          key: `${slug}-${sizeKey}`,
          src: productAttributeImageByFilename[`${slug}-${sizeKey}.jpg`] || '',
          alt: product?.name ? `${product.name} ${sizeKey}` : `${sizeKey} coffee product image`,
          label: sizeKey,
          variantKey: sizeKey,
        },
        index,
      ),
    )
    .filter(Boolean)

  if (selectedVariantKey) {
    const preferredIndex = gallery.findIndex((entry) => entry.variantKey === selectedVariantKey)

    if (preferredIndex > 0) {
      const [preferredImage] = gallery.splice(preferredIndex, 1)
      gallery.unshift(preferredImage)
    }
  }

  return gallery
}

function buildUrbanThermosGalleryImages(product, selectedOptionsByGroup) {
  const slug = normalizeCode(product?.slug)

  if (slug !== 'urban-thermos') {
    return []
  }

  const selectedVariantKey = getSelectedGalleryVariantKey(product, selectedOptionsByGroup)
  const gallery = [
    normalizeGalleryEntry(
      {
        key: `${slug}-black`,
        src: urbanThermosBlackImage,
        alt: product?.name ? `${product.name} black` : 'Black thermos product image',
        label: 'Black',
        variantKey: 'black',
        optionValueCodes: { color: 'black' },
      },
      0,
    ),
    normalizeGalleryEntry(
      {
        key: `${slug}-red`,
        src: urbanThermosRedImage,
        alt: product?.name ? `${product.name} red` : 'Red thermos product image',
        label: 'Red',
        variantKey: 'red',
        optionValueCodes: { color: 'red' },
      },
      1,
    ),
  ].filter(Boolean)

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

  const urbanThermosGallery = buildUrbanThermosGalleryImages(product, selectedOptionsByGroup)

  if (urbanThermosGallery.length) {
    return urbanThermosGallery
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

export function getPreferredProductGalleryIndex(
  product,
  selectedOptionsByGroup = {},
  images = [],
  selectedVariantId = null,
) {
  if (!Array.isArray(images) || !images.length) {
    return 0
  }

  const variantImageIds = [
    selectedVariantId,
    getSelectedVariantImageId(product, selectedOptionsByGroup),
  ]

  for (const variantImageId of variantImageIds) {
    const normalizedVariantId = Number(variantImageId)

    if (Number.isFinite(normalizedVariantId) && normalizedVariantId > 0) {
      const variantImageIndex = images.findIndex(
        (entry) => Number(entry?.variantId) === normalizedVariantId,
      )

      if (variantImageIndex >= 0) {
        return variantImageIndex
      }
    }
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

export function getProductGalleryOptionGroups(product, optionGroups = []) {
  return Array.isArray(optionGroups)
    ? optionGroups.filter((group) => Array.isArray(group?.values) && group.values.length)
    : []
}

export { getGeneratedProductImageUrl }
