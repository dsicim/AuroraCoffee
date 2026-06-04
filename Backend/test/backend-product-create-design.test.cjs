const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const vm = require('node:vm');

function loadDbFunctions(fakeConnection) {
  const filename = path.join(__dirname, '..', '..', 'Database', 'db_functions.js');
  const source = fs.readFileSync(filename, 'utf8');
  const module = { exports: {} };
  const localRequire = createRequire(filename);

  vm.runInNewContext(source, {
    console,
    Buffer,
    __dirname: path.dirname(filename),
    module,
    exports: module.exports,
    process,
    require(request) {
      if (request === 'mysql2/promise') {
        return {
          createPool: () => ({
            getConnection: async () => fakeConnection,
            execute: async (...args) => fakeConnection.execute(...args),
          }),
        };
      }

      return localRequire(request);
    },
  }, { filename });

  return module.exports;
}

function createFakeConnection() {
  const calls = [];
  const connection = {
    calls,
    beginTransactionCalled: false,
    commitCalled: false,
    rollbackCalled: false,
    released: false,
    async execute(sql, values = []) {
      calls.push({ sql, values });

      if (String(sql).includes('information_schema.COLUMNS')) {
        return [[
          { COLUMN_NAME: 'model' },
          { COLUMN_NAME: 'serial_number' },
          { COLUMN_NAME: 'warranty_status' },
          { COLUMN_NAME: 'distributor_information' },
        ]];
      }

      if (String(sql).includes('INSERT INTO products')) {
        return [{ insertId: 321 }];
      }

      return [{}];
    },
    async beginTransaction() {
      this.beginTransactionCalled = true;
    },
    async commit() {
      this.commitCalled = true;
    },
    async rollback() {
      this.rollbackCalled = true;
    },
    release() {
      this.released = true;
    },
  };

  return connection;
}

test('addProduct inserts the PDF-required product design fields', async () => {
  const connection = createFakeConnection();
  const db = loadDbFunctions(connection);
  await db.initDB();

  const result = await db.addProduct({
    product_code: 'SKU-7',
    model: 'M-7',
    serial_number: 'SN-7',
    name: 'Design Coffee',
    description: 'A traceable product record.',
    price: 12.5,
    stock: 8,
    warranty_status: 'Two years',
    distributor_information: 'Aurora Supply',
  });

  const insertCall = connection.calls.find((call) => call.sql.includes('INSERT INTO products'));

  assert.equal(result.productId, 321);
  assert.ok(insertCall.sql.includes('model'));
  assert.ok(insertCall.sql.includes('serial_number'));
  assert.ok(insertCall.sql.includes('warranty_status'));
  assert.ok(insertCall.sql.includes('distributor_information'));
  assert.deepEqual(Array.from(insertCall.values.slice(0, 8)), [
    'SKU-7',
    'M-7',
    'SN-7',
    'Design Coffee',
    'A traceable product record.',
    12.5,
    0.00,
    8,
  ]);
  assert.equal(insertCall.values.at(-2), 'Two years');
  assert.equal(insertCall.values.at(-1), 'Aurora Supply');
  assert.equal(connection.beginTransactionCalled, true);
  assert.equal(connection.commitCalled, true);
  assert.equal(connection.released, true);
});

test('addProduct rejects records missing PDF-required design fields', async () => {
  const connection = createFakeConnection();
  const db = loadDbFunctions(connection);
  await db.initDB();

  await assert.rejects(
    () => db.addProduct({
      product_code: 'SKU-8',
      serial_number: 'SN-8',
      name: 'Incomplete Product',
      description: 'Missing model.',
      price: 8,
      stock: 3,
      warranty_status: 'One year',
      distributor_information: 'Aurora Supply',
    }),
    {
      status: 400,
      message: 'Model is required',
    },
  );

  assert.equal(connection.calls.some((call) => call.sql.includes('INSERT INTO products')), false);
});
