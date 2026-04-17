import { useState } from 'react'
import coffeeSketch from '../assets/coffee-sketch.jpeg'

export default function ProductMedia({
  product,
  className = '',
  imageClassName = '',
  loading = 'lazy',
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const productImageUrl = String(product?.imageUrl || '').trim()
  const src = productImageUrl && !imageFailed ? productImageUrl : coffeeSketch
  const alt = product?.name ? `${product.name} product image` : 'Aurora Coffee product image'

  return (
    <div className={`aurora-product-media ${className}`.trim()}>
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        className={`aurora-product-media-image ${imageClassName}`.trim()}
        onError={() => {
          setImageFailed(true)
        }}
      />
    </div>
  )
}
