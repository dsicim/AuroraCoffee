import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  identityDocumentTypes,
  sanitizePassportNumber,
  sanitizeTaxIdentityNumber,
  sanitizeTurkishIdentityNumber,
  validateIdentityDocument,
  validatePassportNumber,
  validateTaxIdentityNumber,
  validateTurkishIdentityNumber,
} from '../validation.js'

test('sanitizeTurkishIdentityNumber keeps only eleven digits', () => {
  assert.equal(sanitizeTurkishIdentityNumber('100-000-001-46-99'), '10000000146')
})

test('sanitizePassportNumber keeps only nine alphanumeric characters', () => {
  assert.equal(sanitizePassportNumber('ab-123456789-tr'), 'AB1234567')
})

test('sanitizeTaxIdentityNumber keeps only ten digits', () => {
  assert.equal(sanitizeTaxIdentityNumber('123-456-7890-11'), '1234567890')
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

test('validateIdentityDocument skips T.C. Kimlik checksum for passport numbers', () => {
  assert.deepEqual(validateIdentityDocument('ab12345', identityDocumentTypes.foreignPassport), {
    s: true,
    value: 'AB12345',
  })
})

test('validatePassportNumber allows up to nine alphanumeric characters', () => {
  assert.deepEqual(validatePassportNumber('A12345678'), {
    s: true,
    value: 'A12345678',
  })
})

test('validateIdentityDocument accepts a ten-digit tax id for business purchases', () => {
  assert.deepEqual(validateIdentityDocument('1234567890', identityDocumentTypes.taxId), {
    s: true,
    value: '1234567890',
  })
})

test('validateTaxIdentityNumber rejects non-ten-digit values', () => {
  assert.equal(validateTaxIdentityNumber('123456789').s, false)
})

test('validatePassportNumber still requires a value', () => {
  assert.equal(validatePassportNumber('   ').s, false)
})
