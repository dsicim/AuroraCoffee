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

      if (String(sql).includes('UPDATE products')) {
        return [{ affectedRows: 1 }];
      }

      if (String(sql).includes('UPDATE product_variants')) {
        return [{ affectedRows: 1 }];
      }

      if (String(sql).includes('SELECT id FROM categories WHERE id = ?')) {
        return [Number(values[0]) === 999 ? [] : [{ id: Number(values[0]) }]];
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

test('updateVariant accepts non-negative manufacturing cost edits', async () => {
  const connection = createFakeConnection();
  const db = loadDbFunctions(connection);
  await db.initDB();

  await db.updateVariant(42, { cost: 14.75 });

  const updateCall = connection.calls.find((call) => call.sql.includes('UPDATE product_variants'));

  assert.ok(updateCall);
  assert.ok(updateCall.sql.includes('cost = ?'));
  assert.deepEqual(Array.from(updateCall.values), [14.75, 42]);
  assert.equal(connection.commitCalled, true);
});

test('updateVariant rejects negative manufacturing cost edits', async () => {
  const connection = createFakeConnection();
  const db = loadDbFunctions(connection);
  await db.initDB();

  await assert.rejects(
    () => db.updateVariant(42, { cost: -1 }),
    {
      status: 400,
      message: 'Variant manufacturing cost must be a non-negative number',
    },
  );

  assert.equal(connection.calls.some((call) => call.sql.includes('UPDATE product_variants')), false);
});

test('updateProduct rejects negative manufacturing cost edits', async () => {
  const connection = createFakeConnection();
  const db = loadDbFunctions(connection);
  await db.initDB();

  await assert.rejects(
    () => db.updateProduct(7, { cost: -3 }),
    {
      status: 400,
      message: 'Manufacturing cost must be a non-negative number',
    },
  );

  assert.equal(connection.calls.some((call) => call.sql.includes('UPDATE products')), false);
});

test('updateProduct persists valid category edits with category_id', async () => {
  const connection = createFakeConnection();
  const db = loadDbFunctions(connection);
  await db.initDB();

  await db.updateProduct(7, { category_id: '12' });

  const categoryCheck = connection.calls.find((call) =>
    call.sql.includes('SELECT id FROM categories WHERE id = ?'));
  const updateCall = connection.calls.find((call) => call.sql.includes('UPDATE products'));

  assert.deepEqual(Array.from(categoryCheck.values), [12]);
  assert.ok(updateCall.sql.includes('category_id = ?'));
  assert.deepEqual(Array.from(updateCall.values), [12, 7]);
  assert.equal(connection.commitCalled, true);
});

test('updateProduct rejects missing category edits before claiming success', async () => {
  const connection = createFakeConnection();
  const db = loadDbFunctions(connection);
  await db.initDB();

  await assert.rejects(
    () => db.updateProduct(7, { category_id: 999 }),
    {
      status: 404,
      message: 'Category not found',
    },
  );

  assert.equal(connection.calls.some((call) => call.sql.includes('UPDATE products')), false);
  assert.equal(connection.rollbackCalled, true);
});

test('addProduct accepts records without optional model', async () => {
  const connection = createFakeConnection();
  const db = loadDbFunctions(connection);
  await db.initDB();

  const result = await db.addProduct({
    product_code: 'SKU-8',
    serial_number: 'SN-8',
    name: 'Model Optional Product',
    description: 'Model is optional for this product.',
    price: 8,
    stock: 3,
    warranty_status: 'One year',
    distributor_information: 'Aurora Supply',
  });

  const insertCall = connection.calls.find((call) => call.sql.includes('INSERT INTO products'));

  assert.equal(result.productId, 321);
  assert.equal(insertCall.values[1], null);
});
