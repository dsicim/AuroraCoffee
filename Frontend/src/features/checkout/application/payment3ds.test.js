import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildBillingSummary,
  buildDeliverySummary,
  buildPaymentSummary,
  buildSubmittedOrderSnapshotFromPending,
  createPending3DSCheckoutSnapshot,
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

test('createPending3DSCheckoutSnapshot preserves totals and checkout selections for 3DS return', () => {
  const snapshot = createPending3DSCheckoutSnapshot({
    items: [{ id: 1, quantity: 2 }],
    delivery: { firstName: 'Ege', lastName: 'Bulutoglu' },
    billing: {},
    useShippingAsBilling: true,
    selectedAddressId: 42,
    selectedSavedCardId: '',
    payment: { cardNumber: '4111111111111234' },
    savedCards: [],
    selectedInstallments: 3,
    subtotal: '100',
    serviceFee: '5',
    taxTotal: '10',
    installmentFee: '2',
    total: '117',
  })

  assert.equal(snapshot.selectedAddressId, '42')
  assert.equal(snapshot.selectedInstallments, '3')
  assert.equal(snapshot.total, 117)
  assert.equal(snapshot.billingSummary, null)
})

test('buildSubmittedOrderSnapshotFromPending rebuilds delivery and billing summaries when only forms remain', () => {
  const submitted = buildSubmittedOrderSnapshotFromPending({
    reference: 'AUR-TEST1',
    deliveryForm: { firstName: 'Ege', lastName: 'Bulutoglu', district: 'Tuzla' },
    billingForm: { firstName: 'Ada', lastName: 'Buyer', district: 'Kadikoy' },
    subtotal: 100,
    total: 120,
  }, { orderNumber: 'ORD-9' })

  assert.equal(submitted.delivery.fullName, 'Ege Bulutoglu')
  assert.equal(submitted.billing.fullName, 'Ada Buyer')
  assert.equal(submitted.orderNumber, 'ORD-9')
})
