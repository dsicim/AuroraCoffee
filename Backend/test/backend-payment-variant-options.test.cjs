const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

function loadPaymentUtilities() {
  const filename = path.join(__dirname, '..', 'apiendpoints/payment.js');
  const source = `${fs.readFileSync(filename, 'utf8')}\nmodule.exports = { parseVariantOptions };`;
  const module = { exports: {} };

  vm.runInNewContext(source, {
    Buffer,
    Date,
    Map,
    console,
    module,
    exports: module.exports,
    require(request) {
      if (request.includes('Database/server')) return {};
      if (request === 'crypto') return require('node:crypto');
      if (request === 'fs') return require('node:fs');
      return {};
    },
  }, { filename });

  return module.exports;
}

test('parseVariantOptions decodes base64 JSON option maps', () => {
  const { parseVariantOptions } = loadPaymentUtilities();
  const encoded = Buffer.from(JSON.stringify({ size: '250g' })).toString('base64');
  const result = parseVariantOptions(encoded);

  assert.equal(result.size, '250g');
});
