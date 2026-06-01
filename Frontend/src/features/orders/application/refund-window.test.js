import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  isRefundRequestWindowOpen,
  refundRequestWindowMs,
} from './refundWindow.js'

test('isRefundRequestWindowOpen allows orders inside the 30 day window', () => {
  const now = Date.parse('2026-06-01T12:00:00.000Z')
  const submittedAt = new Date(now - refundRequestWindowMs + 1_000).toISOString()

  assert.equal(isRefundRequestWindowOpen({ submittedAt }, now), true)
})

test('isRefundRequestWindowOpen denies orders after the 30 day window', () => {
  const now = Date.parse('2026-06-01T12:00:00.000Z')
  const submittedAt = new Date(now - refundRequestWindowMs - 1_000).toISOString()

  assert.equal(isRefundRequestWindowOpen({ submittedAt }, now), false)
})

test('isRefundRequestWindowOpen keeps unknown dates eligible for backend validation', () => {
  assert.equal(isRefundRequestWindowOpen({ submittedAt: '' }), true)
})
