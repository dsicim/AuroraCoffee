import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildBillingSummary,
  buildDeliverySummary,
  buildPaymentSummary,
} from './payment3ds.js'

test('buildDeliverySummary joins customer name and address lines for the checkout receipt', () => {
  assert.deepEqual(buildDeliverySummary({
    firstName: 'Ege',
    lastName: 'Bulutoglu',
    addressLine1: 'Campus Road',
    addressLine2: 'Dorm 2',
    district: 'Tuzla',
  }), {
    firstName: 'Ege',
    lastName: 'Bulutoglu',
    addressLine1: 'Campus Road',
    addressLine2: 'Dorm 2',
    district: 'Tuzla',
    fullName: 'Ege Bulutoglu',
    address: 'Campus Road\nDorm 2',
    city: 'Tuzla',
  })
})

test('buildBillingSummary omits blank name and address segments from billing details', () => {
  assert.equal(buildBillingSummary({
    firstName: '  Ege  ',
    lastName: '',
    addressLine1: '',
    addressLine2: 'Office',
  }).fullName, 'Ege')
  assert.equal(buildBillingSummary({
    addressLine1: '',
    addressLine2: 'Office',
  }).address, 'Office')
})

test('buildPaymentSummary masks manual card numbers for order confirmation display', () => {
  assert.deepEqual(buildPaymentSummary({
    payment: {
      cardholder: 'Ege Bulutoglu',
      cardNumber: '4111 1111 1111 1234',
      expiry: '12/30',
    },
    savedCards: [],
    selectedSavedCardId: '',
  }), {
    mode: 'manual',
    cardholder: 'Ege Bulutoglu',
    maskedCardNumber: '•••• •••• •••• 1234',
    expiry: '12/30',
  })
})

test('buildPaymentSummary uses the selected saved card mask when a saved card is chosen', () => {
  assert.deepEqual(buildPaymentSummary({
    payment: {},
    savedCards: [{ id: 'card-1', last4dig: '6789' }],
    selectedSavedCardId: 'card-1',
  }), {
    mode: 'saved',
    cardholder: 'Saved card',
    maskedCardNumber: '•••• 6789',
    expiry: '',
  })
})
