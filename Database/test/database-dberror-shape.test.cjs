const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

function loadDatabaseFunctions() {
  const filename = path.join(__dirname, '..', 'db_functions.js');
  const module = { exports: {} };

  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    __dirname: path.join(__dirname, '..'),
    console,
    process,
    module,
    exports: module.exports,
    require(request) {
      if (request === 'fs') {
        return {
          ...fs,
          readFileSync(filePath, encoding) {
            if (String(filePath).endsWith('Backend/config.json')) {
              return JSON.stringify({
                dbport: 3306,
                user: 'test',
                password: 'test',
                database: 'aurora_test',
                verifyemail: false,
              });
            }

            return fs.readFileSync(filePath, encoding);
          },
        };
      }

      if (request === 'mysql2/promise') return { createPool() {} };
      if (request === 'bcryptjs') return { hash: async () => 'hashed', compare: async () => true };
      if (request === 'crypto') return require('node:crypto');
      if (request === 'path') return require('node:path');
      return {};
    },
  }, { filename });

  return module.exports;
}

test('DBError carries status and public error text', () => {
  const { DBError } = loadDatabaseFunctions();
  const error = new DBError(404, 'User not found');

  assert.equal(error.status, 404);
  assert.equal(error.error, 'User not found');
  assert.equal(error.message, 'User not found');
});
