const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

function loadCartUtilities() {
  const filename = path.join(__dirname, '..', 'apiendpoints/cart.js');
  const source = `${fs.readFileSync(filename, 'utf8')}\nmodule.exports = { validateOptions };`;
  const module = { exports: {} };

  vm.runInNewContext(source, {
    console,
    module,
    exports: module.exports,
    require(request) {
      if (request.includes('Database/server')) return {};
      return {};
    },
  }, { filename });

  return module.exports;
}

test('validateOptions rejects missing required non-variant options', () => {
  const { validateOptions } = loadCartUtilities();
  const result = validateOptions({
    options: [{
      group_code: 'grind',
      is_required: true,
      store_as_variant: false,
      values: [{ value_code: 'whole-bean' }],
    }],
  });

  assert.equal(result.s, false);
  assert.equal(result.e, 'Invalid or missing required options');
});
