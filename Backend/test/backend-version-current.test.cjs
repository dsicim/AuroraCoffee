const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleAPI } = require('../apiendpoints/version.js');

test('version endpoint returns the configured current version by default', async () => {
  const response = await handleAPI({ version: '0.4.200' }, 'GET', [], {}, null, {}, null);

  assert.equal(response.d, '0.4.200');
});
