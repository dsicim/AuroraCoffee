import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildBillingSummary,
  buildDeliverySummary,
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
