'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Test conversion functions without a browser or a duplicate implementation.
function loadConverter() {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'converter.js'), 'utf8'), context, { filename: 'converter.js' });
  return { run: expr => vm.runInContext(expr, context) };
}

// Exercise the actual scripts in the order shipped in index.html.
function loadApp() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map(match => match[1]);
  assert.deepEqual(scripts, ['converter.js', 'app.js'], 'Conversion functions load before the UI');
  const copyButtons = { arabicResult: { disabled: true }, romanResult: { disabled: true } };
  const elements = {};
  for (const id of ['arabicInput', 'arabicResult', 'arabicError', 'romanInput', 'romanError', 'romanResult', 'chipDisplay', 'arabicBreakdownToggle', 'arabicBreakdown', 'romanBreakdownToggle', 'romanBreakdown']) {
    elements[id] = { value: '', textContent: '', style: {}, className: '',
      validity: { valid: true }, setAttribute() {}, appendChild() {},
      parentElement: { querySelector: () => copyButtons[id] } };
  }
  // Browser input.value coerces assigned numbers to strings.
  let inputValue = '';
  Object.defineProperty(elements.arabicInput, 'value', {
    get: () => inputValue,
    set: value => { inputValue = String(value); }
  });
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
  for (const filename of scripts) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', filename), 'utf8'), context, { filename });
  }
  return { context, elements, copyButtons, run: expr => vm.runInContext(expr, context) };
}

test('Roman analysis groups sum correctly for every supported numeral', () => {
  const app = loadConverter();
  for (let n = 1; n <= 3999; n++) {
    const result = app.run('analyzeRoman(arabicToRoman(' + n + '))');
    assert.equal(result.valid, true);
    assert.equal(result.value, n);
    assert.equal(result.groups.reduce((sum, group) => sum + group.value, 0), n);
  }
  for (const n of [12.9, NaN, Infinity, -1, 0, 4000]) {
    assert.equal(app.run('arabicToRoman(' + String(n) + ')'), 'Out of range (1-3999)');
  }
});

test('Roman warnings explain repetition and reject non-Roman input', () => {
  const app = loadConverter();
  assert.match(app.run('analyzeRoman("IIII").error'), /IV for 4/);
  assert.match(app.run('analyzeRoman("XXXX").error'), /XL for 40/);
  assert.match(app.run('analyzeRoman("CCCC").error'), /CD for 400/);
  assert.match(app.run('analyzeRoman("MMMM").error'), /3999/);
  assert.match(app.run('analyzeRoman("VV").error'), /cannot repeat/);
  assert.match(app.run('analyzeRoman("IC").error'), /subtractive pairs/);
  for (const raw of ['ABC', 'X V', '<img>', 'M'.repeat(16)]) {
    assert.equal(app.run('analyzeRoman(' + JSON.stringify(raw) + ').valid'), false);
  }
  assert.equal(app.run('analyzeRoman(" xiv ").value'), 14);
});

test('breakdown shows place-value groups and explains subtractive pairs', () => {
  const app = loadConverter();
  const explanation = app.run('romanBreakdown("MCMXCVIII")');
  assert.equal(explanation, 'M + CM + XC + VIII\n= 1000 + 900 + 90 + 8\n= 1998\nCM = 1000 − 100 = 900\nXC = 100 − 10 = 90');
  assert.equal(app.run('romanBreakdown("IIII")'), '');
  assert.equal(app.run('romanBreakdown("")'), '');
});

test('typed Roman input, chips, deletion and clearing stay synchronized', () => {
  const app = loadApp();
  app.elements.romanInput.value = ' xiv ';
  app.run('convertRomanInput()');
  assert.equal(app.elements.romanResult.textContent, 14);
  assert.equal(app.copyButtons.romanResult.disabled, false);
  app.run('appendRoman("I")');
  assert.equal(app.elements.romanInput.value, 'XIVI');
  assert.equal(app.copyButtons.romanResult.disabled, true);
  app.run('backspaceRoman()');
  assert.equal(app.elements.romanInput.value, 'XIV');
  assert.equal(app.elements.romanResult.textContent, 14);
  app.elements.romanInput.value = 'IIII';
  app.run('convertRomanInput()');
  assert.match(app.elements.romanError.textContent, /IV for 4/);
  app.run('clearChips()');
  assert.equal(app.elements.romanInput.value, '');
  assert.equal(app.elements.romanError.textContent, '');
  assert.equal(app.elements.romanResult.className, 'result-value font-mono-num');
  assert.equal(app.elements.romanResult.textContent, '0');
  assert.equal(app.copyButtons.romanResult.disabled, true);
});

test('breakdowns start hidden, follow input, and clear for invalid or empty values', () => {
  const app = loadApp();
  assert.equal(app.elements.arabicBreakdown.hidden, true);
  app.elements.arabicBreakdownToggle.checked = true;
  app.run('updateBreakdown("arabic")');
  assert.match(app.elements.arabicBreakdown.textContent, /= 1888/);
  assert.equal(app.elements.arabicBreakdown.hidden, false);
  app.elements.arabicInput.value = '4000';
  app.run('convertArabicToRoman()');
  assert.equal(app.elements.arabicBreakdown.hidden, true);
  app.elements.romanInput.value = 'IX';
  app.run('convertRomanInput()');
  assert.equal(app.elements.romanBreakdown.hidden, true);
  app.elements.romanBreakdownToggle.checked = true;
  app.run('updateBreakdown("roman")');
  assert.match(app.elements.romanBreakdown.textContent, /IX = 10 − 1 = 9/);
  assert.equal(app.elements.romanBreakdown.hidden, false);
  app.elements.romanInput.value = 'IIII';
  app.run('convertRomanInput()');
  assert.equal(app.elements.romanBreakdown.hidden, true);
  assert.equal(app.elements.romanBreakdown.textContent, '');
  app.elements.romanInput.value = 'IV';
  app.run('convertRomanInput()');
  assert.equal(app.elements.romanBreakdown.hidden, false);
  app.elements.romanBreakdownToggle.checked = false;
  app.run('updateBreakdown("roman")');
  assert.equal(app.elements.romanBreakdown.hidden, true);
});

test('every number 1–3999 round-trips and yields a canonical Roman numeral', () => {
  const app = loadConverter();
  const canonical = /^(?=.+$)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
  for (let n = 1; n <= 3999; n++) {
    const roman = app.run('arabicToRoman(' + n + ')');
    assert.match(roman, canonical, 'Numeral for ' + n);
    assert.equal(app.run('romanToArab(' + JSON.stringify(roman) + ')'), n, 'Round trip for ' + n);
  }
});

test('important subtractive forms and range endpoints', () => {
  const app = loadConverter();
  for (const [n, expected] of [[1,'I'],[4,'IV'],[9,'IX'],[40,'XL'],[49,'XLIX'],[90,'XC'],[400,'CD'],[900,'CM'],[944,'CMXLIV'],[1888,'MDCCCLXXXVIII'],[2026,'MMXXVI'],[3999,'MMMCMXCIX']]) {
    assert.equal(app.run('arabicToRoman(' + n + ')'), expected);
  }
});

test('malformed Roman numerals are rejected', () => {
  const app = loadConverter();
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
