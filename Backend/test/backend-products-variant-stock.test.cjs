const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

function loadProductsEndpoint(sql) {
  const filename = path.join(__dirname, '..', 'apiendpoints/products.js');
  const source = fs.readFileSync(filename, 'utf8');
  const module = { exports: {} };

  vm.runInNewContext(source, {
    console,
    Buffer,
    module,
    exports: module.exports,
    require(request) {
      if (request.includes('Database/server')) return sql;
      if (request.includes('components/upload')) return {};
      return require(request);
    },
    __dirname: path.dirname(filename),
  }, { filename });

  return module.exports;
}

test('products endpoint reports variant stock sum for variant products', async () => {
  const sql = {
    getAllProducts: async () => ({
      success: true,
      products: [
        {
          id: 12,
          name: 'Variant Product',
          stock: 1,
          sales: 50,
          has_variants: 1,
          variants: [
            { id: 21, stock: 3, sales: 10 },
            { id: 22, stock: 4, sales: 12 },
            { id: 23, stock: -2, sales: 1 },
          ],
        },
      ],
    }),
  };
  const { handleAPI } = loadProductsEndpoint(sql);
  const response = await handleAPI({}, 'GET', ['all'], {}, null, {}, null);
  const product = response.d.products[0];

  assert.equal(response.s, 200);
  assert.equal(product.stock, 7);
  assert.equal(product.sales, undefined);
  assert.equal(product.variants[0].sales, undefined);
});

test('today pick endpoint uses dedicated product selection', async () => {
  let usedDedicatedPick = false;
  const sql = {
    getAllProducts: async () => {
      throw new Error('today pick should not use products/all');
    },
    getTodaysPick: async () => {
      usedDedicatedPick = true;
      return {
        success: true,
        reason: 'Dedicated daily selection',
        product: {
          id: 14,
          name: 'Daily Pick',
          stock: 2,
          sales: 20,
          has_variants: 1,
          variants: [
            { id: 41, stock: 5, sales: 8 },
            { id: 42, stock: 1, sales: 3 },
          ],
        },
      };
    },
  };
  const { handleAPI } = loadProductsEndpoint(sql);
  const response = await handleAPI({}, 'GET', ['todays-pick'], {}, null, {}, null);

  assert.equal(response.s, 200);
  assert.equal(usedDedicatedPick, true);
  assert.equal(response.d.product.stock, 6);
  assert.equal(response.d.product.sales, undefined);
  assert.equal(response.d.product.variants[0].sales, undefined);
  assert.equal(response.d.reason, 'Dedicated daily selection');
});
