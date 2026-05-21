import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildReviewPrivacyCode,
  buildReviewPrivacyPreviewName,
  buildReviewPrivacySelectionFromCode,
  buildReviewPrivacyWordPreview,
  getDisplayNameWords,
  normalizeReviewPrivacyMode,
  resolveReviewPrivacySelection,
} from './reviewPrivacy.js'

test('normalizeReviewPrivacyMode falls back to initials for unknown modes', () => {
  assert.equal(normalizeReviewPrivacyMode('friends-only'), 'initials')
})

test('getDisplayNameWords collapses extra whitespace in customer display names', () => {
  assert.deepEqual(getDisplayNameWords('  Ege   Bulutoglu  '), ['Ege', 'Bulutoglu'])
})

test('buildReviewPrivacyWordPreview shows full words when full privacy is selected', () => {
  assert.equal(buildReviewPrivacyWordPreview('Ege', 'full'), 'Ege')
})

test('buildReviewPrivacyWordPreview hides words when anonymous privacy is selected', () => {
  assert.equal(buildReviewPrivacyWordPreview('Ege', 'anonymous'), '-')
})

test('buildReviewPrivacyWordPreview renders initials for initial privacy mode', () => {
  assert.equal(buildReviewPrivacyWordPreview('Bulutoglu', 'initials'), 'B.')
})

test('buildReviewPrivacySelectionFromCode maps stored privacy codes per display-name word', () => {
  assert.deepEqual(buildReviewPrivacySelectionFromCode('shi', 'Ege Can Bulutoglu'), [
    'full',
    'anonymous',
    'initials',
  ])
})

test('buildReviewPrivacySelectionFromCode repeats the first code for missing word codes', () => {
  assert.deepEqual(buildReviewPrivacySelectionFromCode('s', 'Ege Can Bulutoglu'), [
    'full',
    'full',
    'full',
  ])
})

test('resolveReviewPrivacySelection pads short selections with the selection fallback mode', () => {
  assert.deepEqual(resolveReviewPrivacySelection(['anonymous'], 'Ege Can'), [
    'anonymous',
    'anonymous',
  ])
})

test('buildReviewPrivacyPreviewName combines visible full and initial words', () => {
  assert.equal(buildReviewPrivacyPreviewName(['full', 'initials'], 'Ege Bulutoglu'), 'Ege B.')
})

test('buildReviewPrivacyPreviewName returns Anonymous when every word is hidden', () => {
  assert.equal(buildReviewPrivacyPreviewName(['anonymous', 'anonymous'], 'Ege Bulutoglu'), 'Anonymous')
})

test('buildReviewPrivacyCode serializes a per-word privacy selection', () => {
  assert.equal(buildReviewPrivacyCode(['full', 'initials', 'anonymous'], 'Ege Can Bulutoglu'), 'sih')
})

test('buildReviewPrivacyCode returns an empty code for blank display names', () => {
  assert.equal(buildReviewPrivacyCode('full', '   '), '')
})
