import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildCartErrorMessage } from './cartErrors.js'

describe('cart error messages', () => {
  it('uses backend string errors for cart feedback', () => {
    assert.equal(
      buildCartErrorMessage(new Error('Requested quantity exceeds available stock. Available stock: 2')),
      'Requested quantity exceeds available stock. Available stock: 2',
    )
  })

  it('formats structured backend errors instead of showing object text', () => {
    assert.equal(
      buildCartErrorMessage({
        what: 'Shopping Cart',
        why: 'Some products in the cart are out of stock',
        resolution: 'Please confirm your cart contents and then try again.',
      }),
      'Shopping Cart - Some products in the cart are out of stock - Please confirm your cart contents and then try again.',
    )
  })
})
