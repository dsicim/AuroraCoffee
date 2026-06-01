const assert = require('node:assert/strict');
const { test } = require('node:test');

const { taxIDType } = require('../components/idvalidate.js');

test('taxIDType accepts empty values as optional identity data', () => {
  assert.equal(taxIDType(null).s, true);
  assert.equal(taxIDType('').t, 'None');
});

test('taxIDType validates only all-digit eleven-character T.C. Kimlik numbers', () => {
  assert.deepEqual(taxIDType('10000000146'), {
    s: true,
    t: 'Turkish ID',
  });
  assert.equal(taxIDType('10000000147').s, false);
  assert.deepEqual(taxIDType('A0000000146'), {
    s: false,
    t: 'unknown',
    e: 'Invalid Tax ID format',
  });
});

test('taxIDType validates all-digit ten-character values with the VKN checksum', () => {
  assert.deepEqual(taxIDType('1234567890'), {
    s: true,
    t: 'Turkish Corporate Tax ID',
  });
  assert.deepEqual(taxIDType('1234567891'), {
    s: false,
    t: 'Turkish Corporate Tax ID',
    e: 'Invalid Number',
  });
  assert.deepEqual(taxIDType('A234567890'), {
    s: false,
    t: 'unknown',
    e: 'Invalid Tax ID format',
  });
});

test('taxIDType rejects unsupported identity characters and excessive length', () => {
  assert.equal(taxIDType('AB-123').s, false);
  assert.equal(taxIDType('ABCDEFGHIJKL').s, false);
});
