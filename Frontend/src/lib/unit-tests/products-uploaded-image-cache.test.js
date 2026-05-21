import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  mergeUploadedProductImage,
  normalizeProductImage,
  normalizeProductImageUrl,
} from '../../features/products/domain/productImageCache.js'

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

test('normalizeProductImageUrl returns an empty string for blank input', () => {
  assert.equal(normalizeProductImageUrl('   '), '')
})

test('normalizeProductImageUrl uploads relative file names', () => {
  assert.equal(normalizeProductImageUrl('product shot.webp'), '/uploads/product%20shot.webp')
})

test('normalizeProductImageUrl trims relative file names before encoding', () => {
  assert.equal(normalizeProductImageUrl('  product.webp  '), '/uploads/product.webp')
})

test('normalizeProductImageUrl preserves root-relative URLs', () => {
  assert.equal(normalizeProductImageUrl('/uploads/product.webp'), '/uploads/product.webp')
})

test('normalizeProductImageUrl preserves HTTPS URLs', () => {
  assert.equal(normalizeProductImageUrl('https://example.com/product.webp'), 'https://example.com/product.webp')
})

test('normalizeProductImageUrl preserves HTTP URLs', () => {
  assert.equal(normalizeProductImageUrl('http://example.com/product.webp'), 'http://example.com/product.webp')
})

test('normalizeProductImageUrl preserves data URLs', () => {
  assert.equal(normalizeProductImageUrl('data:image/png;base64,abc'), 'data:image/png;base64,abc')
})

test('normalizeProductImageUrl preserves blob URLs', () => {
  assert.equal(normalizeProductImageUrl('blob:https://example.com/abc'), 'blob:https://example.com/abc')
})

test('normalizeProductImage ignores null image records', () => {
  assert.equal(normalizeProductImage(null, 0), null)
})

test('normalizeProductImage ignores empty string records', () => {
  assert.equal(normalizeProductImage('   ', 0), null)
})

test('normalizeProductImage normalizes string records as uploaded images', () => {
  assert.deepEqual(normalizeProductImage('gallery.webp', 2), {
    id: null,
    url: 'gallery.webp',
    src: '/uploads/gallery.webp',
    isPrimary: false,
    variantId: null,
    sortOrder: 2,
  })
})

test('normalizeProductImage marks the first string record as primary', () => {
  assert.equal(normalizeProductImage('first.webp', 0).isPrimary, true)
})

test('normalizeProductImage reads snake-case image URLs', () => {
  assert.equal(normalizeProductImage({ image_url: 'snake.webp' }, 0).url, 'snake.webp')
})

test('normalizeProductImage reads camel-case image URLs', () => {
  assert.equal(normalizeProductImage({ imageUrl: 'camel.webp' }, 0).url, 'camel.webp')
})

test('normalizeProductImage keeps numeric image ids', () => {
  assert.equal(normalizeProductImage({ id: 42, url: 'image.webp' }, 0).id, 42)
})

test('normalizeProductImage nulls invalid image ids', () => {
  assert.equal(normalizeProductImage({ id: 'nope', url: 'image.webp' }, 0).id, null)
})

test('normalizeProductImage reads string true primary flags', () => {
  assert.equal(normalizeProductImage({ url: 'image.webp', is_primary: 'true' }, 0).isPrimary, true)
})

test('normalizeProductImage reads numeric false primary flags', () => {
  assert.equal(normalizeProductImage({ url: 'image.webp', isPrimary: 0 }, 0).isPrimary, false)
})

test('normalizeProductImage reads snake-case variant ids', () => {
  assert.equal(normalizeProductImage({ url: 'image.webp', variant_id: '12' }, 0).variantId, 12)
})

test('normalizeProductImage reads camel-case variant ids', () => {
  assert.equal(normalizeProductImage({ url: 'image.webp', variantId: 13 }, 0).variantId, 13)
})

test('normalizeProductImage preserves zero sort order', () => {
  assert.equal(normalizeProductImage({ url: 'image.webp', sort_order: '0' }, 5).sortOrder, 0)
})

test('normalizeProductImage falls back to index for missing sort order', () => {
  assert.equal(normalizeProductImage({ url: 'image.webp' }, 5).sortOrder, 5)
})

test('normalizeProductImage falls back to zero for invalid sort order', () => {
  assert.equal(normalizeProductImage({ url: 'image.webp', sort_order: 'bad' }, 5).sortOrder, 0)
})

test('mergeUploadedProductImage returns invalid product values unchanged', () => {
  assert.equal(mergeUploadedProductImage(null, { url: 'image.webp' }), null)
})

test('mergeUploadedProductImage returns the same product when upload URL is missing', () => {
  const product = { imageUrl: '/uploads/old.webp', images: [] }

  assert.equal(mergeUploadedProductImage(product, { url: '' }), product)
})

test('mergeUploadedProductImage handles products without an image array', () => {
  const nextProduct = mergeUploadedProductImage({ imageUrl: '' }, {
    url: 'first.webp',
    sortOrder: 0,
  })

  assert.deepEqual(nextProduct.images.map((image) => image.url), ['first.webp'])
})

test('mergeUploadedProductImage de-duplicates an uploaded URL', () => {
  const nextProduct = mergeUploadedProductImage({
    imageUrl: '/uploads/old.webp',
    images: [
      { url: 'old.webp', src: '/uploads/old.webp', isPrimary: true, variantId: null, sortOrder: 0 },
      { url: 'new.webp', src: '/uploads/new.webp', isPrimary: false, variantId: null, sortOrder: 1 },
    ],
  }, {
    url: 'new.webp',
    sortOrder: 4,
    primary: false,
  })

  assert.deepEqual(nextProduct.images.map((image) => image.url), ['old.webp', 'new.webp'])
  assert.equal(nextProduct.images[1].sortOrder, 4)
})

test('mergeUploadedProductImage sorts uploaded images by sort order', () => {
  const nextProduct = mergeUploadedProductImage({
    imageUrl: '/uploads/old.webp',
    images: [
      { url: 'old.webp', src: '/uploads/old.webp', isPrimary: true, variantId: null, sortOrder: 5 },
    ],
  }, {
    url: 'new.webp',
    sortOrder: 1,
  })

  assert.deepEqual(nextProduct.images.map((image) => image.url), ['new.webp', 'old.webp'])
})

test('mergeUploadedProductImage supports three sequential uploads without losing local state', () => {
  const uploads = ['one.webp', 'two.webp', 'three.webp']
  const product = uploads.reduce((currentProduct, url, index) =>
    mergeUploadedProductImage(currentProduct, {
      url,
      sortOrder: index,
      primary: false,
    }), { imageUrl: '', images: [] })

  assert.deepEqual(product.images.map((image) => image.url), uploads)
  assert.deepEqual(product.images.map((image) => image.sortOrder), [0, 1, 2])
  assert.deepEqual(product.images.map((image) => image.isPrimary), [true, false, false])
  assert.equal(product.imageUrl, '/uploads/one.webp')
})

test('mergeUploadedProductImage preserves unrelated product fields', () => {
  const nextProduct = mergeUploadedProductImage({ id: 7, name: 'Brazil Santos', images: [] }, {
    url: 'first.webp',
  })

  assert.equal(nextProduct.id, 7)
  assert.equal(nextProduct.name, 'Brazil Santos')
})

test('mergeUploadedProductImage clears previous primaries when the uploaded image is primary', () => {
  const nextProduct = mergeUploadedProductImage({
    imageUrl: '/uploads/old.webp',
    images: [
      { url: 'old.webp', src: '/uploads/old.webp', isPrimary: true, variantId: null, sortOrder: 0 },
      { url: 'other.webp', src: '/uploads/other.webp', isPrimary: true, variantId: null, sortOrder: 1 },
    ],
  }, {
    url: 'new.webp',
    sortOrder: 2,
    primary: true,
  })

  assert.deepEqual(nextProduct.images.map((image) => image.isPrimary), [false, false, true])
})
