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

test('validateOptions converts selected variant codes to variant ids', () => {
  const { validateOptions } = loadCartUtilities();
  const result = validateOptions({
    options: [{
      group_code: 'size',
      is_required: true,
      store_as_variant: true,
      values: [{ value_code: '500g' }],
    }],
    variants: [{ id: 7, variant_code: '500g' }],
  }, {}, '500g');

  assert.equal(result.s, true);
  assert.equal(result.variant, 7);
});
