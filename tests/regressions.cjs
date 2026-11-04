const { test } = require('node:test');
const assert = require('node:assert/strict');
const bot = require('../bot.js');
test('CSV preserves quoted commas, escaped quotes, multiline cells and BOM', () => {
  assert.deepEqual(bot.parseCSV('\ufeffa,b\r\nx,"one, ""two""\nthree"\r\n'), [{a:'x', b:'one, "two"\nthree'}]);
});
test('CSV rejects malformed source data instead of silently shifting columns', () => {
  for (const text of ['a,b\nx,"unfinished', 'a,a\nx,y', 'a,b\nx,y,z']) {
    assert.throws(() => bot.parseCSV(text));
  }
});
