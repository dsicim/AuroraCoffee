import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  identityDocumentTypes,
  sanitizeTurkishIdentityNumber,
  validateIdentityDocument,
  validateTaxIdentityNumber,
  validateTurkishIdentityNumber,
} from '../validation.js'

test('sanitizeTurkishIdentityNumber keeps only eleven digits', () => {
  assert.equal(sanitizeTurkishIdentityNumber('100-000-001-46-99'), '10000000146')
})

test('validateTurkishIdentityNumber accepts a number with valid checksum digits', () => {
  assert.deepEqual(validateTurkishIdentityNumber('10000000146'), {
    s: true,
    value: '10000000146',
  })
})

test('validateTurkishIdentityNumber rejects checksum mismatches', () => {
  assert.equal(validateTurkishIdentityNumber('10000000147').s, false)
})

test('validateTurkishIdentityNumber rejects leading zero values', () => {
  assert.equal(validateTurkishIdentityNumber('02345678901').s, false)
})

test('validateIdentityDocument skips T.C. Kimlik checksum for tax ids', () => {
  assert.deepEqual(validateIdentityDocument('ACME-TR-001', identityDocumentTypes.taxId), {
    s: true,
    value: 'ACME-TR-001',
  })
})

test('validateTaxIdentityNumber still requires a value', () => {
  assert.equal(validateTaxIdentityNumber('   ').s, false)
})
