import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import coffeeSketch from '../assets/coffee-sketch.jpeg'

function normalizeMediaEntry(entry, index) {
  if (!entry) {
    return null
  }

  if (typeof entry === 'string') {
    const src = String(entry || '').trim()

    if (!src) {
      return null
    }

    return {
      key: `product-media-${index}`,
      src,
      alt: '',
      label: '',
      variantKey: '',
    }
  }

  if (typeof entry !== 'object') {
    return null
  }

  const src = String(entry.src || entry.url || entry.imageUrl || entry.href || '').trim()

  if (!src) {
    return null
  }

  const label = String(entry.label || entry.title || entry.alt || '').trim()

  return {
    key: String(entry.key || entry.id || entry.name || `${src}-${index}`).trim() || `product-media-${index}`,
    src,
    alt: String(entry.alt || label || '').trim(),
    label,
    variantKey: String(entry.variantKey || entry.size || entry.sizeCode || '').trim(),
  }
}

function wrapIndex(index, length) {
  if (!length) {
    return 0
  }

  return ((index % length) + length) % length
}

function getFallbackMedia(product) {
  const productImageUrl = String(product?.imageUrl || '').trim()

  return {
    key: product?.slug ? `${product.slug}-fallback` : 'product-media-fallback',
    src: productImageUrl || coffeeSketch,
    alt: product?.name ? `${product.name} product image` : 'Aurora Coffee product image',
    label: '',
    variantKey: '',
  }
}

export default function ProductMedia({
  product,
  images = null,
  activeIndex = undefined,
  defaultActiveIndex = 0,
  onActiveIndexChange,
  showControls = undefined,
  showDots = undefined,
  className = '',
  imageClassName = '',
  loading = 'lazy',
  enableLightbox = false,
}) {
  const normalizedImages = useMemo(() => {
    const galleryEntries = Array.isArray(images) ? images : []
    const normalizedEntries = galleryEntries
      .map((entry, index) => normalizeMediaEntry(entry, index))
      .filter(Boolean)

    if (normalizedEntries.length) {
      return normalizedEntries
    }

    return [getFallbackMedia(product)]
  }, [images, product])

  const supportsCarousel = normalizedImages.length > 1
  const shouldShowControls = showControls ?? supportsCarousel
  const shouldShowDots = showDots ?? supportsCarousel
  const isControlled = Number.isInteger(activeIndex)
  const [internalActiveIndex, setInternalActiveIndex] = useState(defaultActiveIndex)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  const resolvedActiveIndex = wrapIndex(
    isControlled ? activeIndex : internalActiveIndex,
    normalizedImages.length,
  )

  const activeImage = normalizedImages[resolvedActiveIndex] || getFallbackMedia(product)

  const alt = activeImage.alt || (product?.name ? `${product.name} product image` : 'Aurora Coffee product image')

  const updateActiveIndex = (nextIndex) => {
    const normalizedIndex = wrapIndex(nextIndex, normalizedImages.length)

    if (isControlled) {
      onActiveIndexChange?.(normalizedIndex)
      return
    }

    setInternalActiveIndex(normalizedIndex)
  }

  const handleImageError = () => {
    if (supportsCarousel) {
      updateActiveIndex(resolvedActiveIndex + 1)
    }
  }

  const handleLightboxKeyDown = useEffectEvent((event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setIsLightboxOpen(false)
      return
    }

    if (!supportsCarousel) {
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      updateActiveIndex(resolvedActiveIndex - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      updateActiveIndex(resolvedActiveIndex + 1)
    }
  })

  useEffect(() => {
    if (!enableLightbox || !isLightboxOpen || typeof document === 'undefined') {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => handleLightboxKeyDown(event)

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enableLightbox, isLightboxOpen])

  const imageElement = (
    <img
      src={activeImage.src}
      alt={alt}
      width="800"
      height="800"
      loading={loading}
      decoding="async"
      className={`aurora-product-media-image ${imageClassName}`.trim()}
      onError={handleImageError}
    />
  )

  const lightbox = enableLightbox && isLightboxOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="aurora-product-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${product?.name || 'Product'} image viewer`}
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="aurora-product-lightbox-frame"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="aurora-product-media-control aurora-product-lightbox-close"
              aria-label="Close enlarged image"
              onClick={() => setIsLightboxOpen(false)}
            >
              <span aria-hidden="true">×</span>
            </button>

            {supportsCarousel ? (
              <button
                type="button"
                className="aurora-product-media-control aurora-product-lightbox-nav is-prev"
                aria-label="Previous enlarged image"
                onClick={() => updateActiveIndex(resolvedActiveIndex - 1)}
              >
                <span aria-hidden="true">‹</span>
              </button>
            ) : null}

            <figure className="aurora-product-lightbox-figure">
              <img
                src={activeImage.src}
                alt={alt}
                className="aurora-product-lightbox-image"
              />
              {activeImage.label ? (
                <figcaption className="aurora-product-lightbox-caption">
                  {activeImage.label}
                </figcaption>
              ) : null}
            </figure>

            {supportsCarousel ? (
              <button
                type="button"
                className="aurora-product-media-control aurora-product-lightbox-nav is-next"
                aria-label="Next enlarged image"
                onClick={() => updateActiveIndex(resolvedActiveIndex + 1)}
              >
                <span aria-hidden="true">›</span>
              </button>
            ) : null}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <div
        className={`aurora-product-media ${supportsCarousel ? 'is-gallery' : ''} ${enableLightbox ? 'is-lightbox-enabled' : ''} ${className}`.trim()}
        data-carousel={supportsCarousel ? 'true' : 'false'}
      >
        {enableLightbox ? (
          <button
            type="button"
            className="aurora-product-media-launch"
            aria-label={`Open enlarged view for ${alt}`}
            onClick={() => setIsLightboxOpen(true)}
          >
            {imageElement}
            <span className="aurora-product-media-zoom-hint">Click to enlarge</span>
          </button>
        ) : imageElement}
      {shouldShowControls && supportsCarousel ? (
        <div className="aurora-product-media-controls" aria-label="Product image navigation">
          <button
            type="button"
            className="aurora-product-media-control is-prev"
            aria-label="Previous product image"
            onClick={() => updateActiveIndex(resolvedActiveIndex - 1)}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            className="aurora-product-media-control is-next"
            aria-label="Next product image"
            onClick={() => updateActiveIndex(resolvedActiveIndex + 1)}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      ) : null}
      {shouldShowDots && supportsCarousel ? (
        <div className="aurora-product-media-dots" aria-label="Select product image">
          {normalizedImages.map((image, index) => {
            const selected = index === resolvedActiveIndex
            const label = image.label || `Image ${index + 1}`

            return (
              <button
                key={image.key}
                type="button"
                className={`aurora-product-media-dot ${selected ? 'is-selected' : ''}`}
                aria-label={`Show ${label}`}
                aria-current={selected ? 'true' : undefined}
                onClick={() => updateActiveIndex(index)}
              />
            )
          })}
        </div>
      ) : null}
      </div>
      {lightbox}
    </>
  )
}
