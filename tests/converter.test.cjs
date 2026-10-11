'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual script shipped in index.html, not a duplicate implementation.
function loadApp() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(script, 'Inline application script exists');
  const copyButtons = { arabicResult: { disabled: true }, romanResult: { disabled: true } };
  const elements = {};
  for (const id of ['arabicInput', 'arabicResult', 'arabicError', 'romanResult', 'chipDisplay', 'themeIcon']) {
    elements[id] = { value: '', textContent: '', style: {}, className: '',
      validity: { valid: true }, setAttribute() {}, appendChild() {},
      parentElement: { querySelector: () => copyButtons[id] } };
  }
  const document = {
    getElementById: id => elements[id],
    documentElement: { classList: { add() {}, contains: () => false, toggle() {} } },
    querySelector: () => ({ setAttribute() {} }),
    createElement: () => ({ textContent: '', className: '' })
  };
  const context = vm.createContext({
    document, localStorage: { getItem: () => null, setItem() {} },
    window: { matchMedia: () => ({ matches: false }) },
    navigator: { clipboard: { writeText: async () => {} } }, setTimeout
  });
  vm.runInContext(script[1], context, { filename: 'index.html' });
  return { context, elements, copyButtons, run: expr => vm.runInContext(expr, context) };
}

test('every number 1–3999 round-trips and yields a canonical Roman numeral', () => {
  const app = loadApp();
  const canonical = /^(?=.+$)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
  for (let n = 1; n <= 3999; n++) {
    const roman = app.run('arabicToRoman(' + n + ')');
    assert.match(roman, canonical, 'Numeral for ' + n);
    assert.equal(app.run('romanToArab(' + JSON.stringify(roman) + ')'), n, 'Round trip for ' + n);
  }
});

test('important subtractive forms and range endpoints', () => {
  const app = loadApp();
  for (const [n, expected] of [[1,'I'],[4,'IV'],[9,'IX'],[40,'XL'],[49,'XLIX'],[90,'XC'],[400,'CD'],[900,'CM'],[944,'CMXLIV'],[1888,'MDCCCLXXXVIII'],[2026,'MMXXVI'],[3999,'MMMCMXCIX']]) {
    assert.equal(app.run('arabicToRoman(' + n + ')'), expected);
  }
});

test('malformed Roman numerals are rejected', () => {
  const app = loadApp();
  for (const input of ['IIII', 'VV', 'LL', 'DD', 'IC', 'IL', 'XD', 'XM', 'VX', 'IIV', 'XXC', 'MMMM', 'ABC', 'IVIV']) {
    assert.equal(app.run('romanToArab(' + JSON.stringify(input) + ')'), 'Invalid Roman Numeral', input);
  }
  assert.equal(app.run('romanToArab("xiv")'), 14);
  assert.equal(app.run('romanToArab("")'), 0);
});

test('invalid Arabic form inputs cannot produce copyable results', () => {
  const app = loadApp();
  const input = app.elements.arabicInput;
  for (const value of ['', '0', '-1', '12.9', '4000', 'NaN']) {
    input.value = value;
    app.run('convertArabicToRoman()');
    assert.equal(app.elements.arabicResult.textContent, '---', value);
    assert.equal(app.copyButtons.arabicResult.disabled, true, value);
  }
  input.value = '3999';
  app.run('convertArabicToRoman()');
  assert.equal(app.elements.arabicResult.textContent, 'MMMCMXCIX');
  assert.equal(app.copyButtons.arabicResult.disabled, false);
});

test('Roman chip builder disables copying for invalid values and caps input at 15', () => {
  const app = loadApp();
  app.run('appendRoman("I"); appendRoman("I"); appendRoman("I"); appendRoman("I")');
  assert.equal(app.elements.romanResult.textContent, 'Invalid Roman Numeral');
  assert.equal(app.copyButtons.romanResult.disabled, true);
  app.run('clearChips(); appendRoman("I"); appendRoman("V")');
  assert.equal(app.elements.romanResult.textContent, 4);
  assert.equal(app.copyButtons.romanResult.disabled, false);
  app.run('clearChips(); for (let i = 0; i < 30; i++) appendRoman("M")');
  assert.equal(app.run('currentChips.length'), 15);
  app.run('clearChips()');
  assert.equal(app.copyButtons.romanResult.disabled, true);
});
