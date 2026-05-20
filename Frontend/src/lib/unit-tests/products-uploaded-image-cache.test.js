import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mergeUploadedProductImage } from '../../features/products/domain/productImageCache.js'

test('mergeUploadedProductImage appends uploaded images without replacing the primary image', () => {
  const product = {
    imageUrl: '/uploads/old.webp',
    images: [
      {
        id: 1,
        url: 'old.webp',
        src: '/uploads/old.webp',
        isPrimary: true,
        variantId: null,
        sortOrder: 0,
      },
    ],
  }

  const nextProduct = mergeUploadedProductImage(product, {
    url: 'new.webp',
    sortOrder: 1,
    variantId: 42,
    primary: false,
  })

  assert.equal(nextProduct.imageUrl, '/uploads/old.webp')
  assert.deepEqual(nextProduct.images.map((image) => image.url), ['old.webp', 'new.webp'])
  assert.deepEqual(nextProduct.images.map((image) => image.isPrimary), [true, false])
  assert.equal(nextProduct.images[1].variantId, 42)
})

test('mergeUploadedProductImage marks the first uploaded image as primary', () => {
  const nextProduct = mergeUploadedProductImage({ imageUrl: '', images: [] }, {
    url: 'first.webp',
    sortOrder: 0,
    primary: false,
  })

  assert.equal(nextProduct.imageUrl, '/uploads/first.webp')
  assert.equal(nextProduct.images[0].isPrimary, true)
})

test('mergeUploadedProductImage replaces the current primary image when requested', () => {
  const product = {
    imageUrl: '/uploads/old.webp',
    images: [
      {
        id: 1,
        url: 'old.webp',
        src: '/uploads/old.webp',
        isPrimary: true,
        variantId: null,
        sortOrder: 0,
      },
    ],
  }

  const nextProduct = mergeUploadedProductImage(product, {
    url: 'new.webp',
    sortOrder: 1,
    primary: true,
  })

  assert.equal(nextProduct.imageUrl, '/uploads/new.webp')
  assert.deepEqual(nextProduct.images.map((image) => image.isPrimary), [false, true])
})
