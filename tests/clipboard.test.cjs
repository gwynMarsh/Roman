'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function classes(...initial) {
  const values = new Set(initial);
  return {
    contains: value => values.has(value),
    remove: (...items) => items.forEach(item => values.delete(item)),
    toggle(value, force = !values.has(value)) {
      if (force) values.add(value); else values.delete(value);
      return force;
    }
  };
}

function button(paste = false) {
  const use = { setAttribute(name, value) { this[name] = value; } };
  const icon = { classList: classes(), querySelector: () => use };
  const label = { textContent: paste ? 'Paste' : 'Copy' };
  return {
    disabled: false, classList: classes(...(paste ? ['paste-btn'] : [])),
    querySelector: selector => selector === '.material-icon' ? icon : label,
    icon, use, label
  };
}

function load(clipboard) {
  const copy = button();
  const elements = {
    arabicInput: { value: '', validity: { valid: true }, setAttribute() {} },
    arabicResult: { textContent: '', parentElement: { querySelector: () => copy } },
    arabicError: { textContent: '' },
    arabicBreakdownToggle: { checked: false },
    arabicBreakdown: {},
    romanInput: { value: '', setAttribute() {} },
    romanError: { textContent: '' },
    romanResult: { textContent: '', parentElement: { querySelector: () => button() } },
    romanBreakdownToggle: { checked: false },
    romanBreakdown: {},
    chipDisplay: { innerHTML: '', appendChild() {} }
  };
  const timers = new Map();
  let timerId = 0;
  const context = vm.createContext({
    document: { getElementById: id => elements[id], createElement: () => ({}) },
    localStorage: { getItem: () => 'light' },
    navigator: { clipboard },
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  });
  // Match browser input.value string coercion during default initialization.
  let value = '';
  Object.defineProperty(elements.arabicInput, 'value', {
    get: () => value, set: next => { value = String(next); }
  });
  for (const file of ['converter.js', 'app.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  return {
    context, elements, copy, timers,
    run: expression => vm.runInContext(expression, context),
    reset() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } }
  };
}

test('copy writes the result, shows a check, and restores the copy icon', async () => {
  let written;
  const app = load({ writeText: async text => { written = text; } });
  app.context.btn = app.copy;
  await app.run('copyToClipboard("arabicResult", btn)');
  assert.equal(written, 'MDCCCLXXXVIII');
  assert.equal(app.copy.use.href, 'icons.svg#check');
  assert.equal(app.copy.icon.classList.contains('is-success'), true);
  assert.equal(app.copy.label.textContent, 'Copied!');
  await app.run('copyToClipboard("arabicResult", btn)');
  assert.equal(app.timers.size, 1, 'Repeated clicks replace the previous reset timer');
  app.reset();
  assert.equal(app.copy.use.href, 'icons.svg#content_copy');
  assert.equal(app.copy.icon.classList.contains('is-success'), false);
  assert.equal(app.copy.label.textContent, 'Copy');
});

test('copy failures preserve the control and disabled results are not copied', async () => {
  let calls = 0;
  const app = load({ writeText: async () => { calls++; throw Error('denied'); } });
  app.context.btn = app.copy;
  app.copy.disabled = true;
  await app.run('copyToClipboard("arabicResult", btn)');
  assert.equal(calls, 0);
  app.copy.disabled = false;
  await app.run('copyToClipboard("arabicResult", btn)');
  assert.equal(app.copy.use.href, 'icons.svg#error');
  assert.equal(app.copy.label.textContent, 'Copy failed');
  app.reset();
  assert.equal(app.copy.use.href, 'icons.svg#content_copy');
  assert.equal(app.copy.icon.classList.contains('is-error'), false);
});

test('paste converts a valid number and restores its paste icon', async () => {
  const app = load({ readText: async () => ' 2026 ' });
  const paste = button(true);
  app.context.btn = paste;
  await app.run('pasteArabic(btn)');
  assert.equal(app.elements.arabicInput.value, '2026');
  assert.equal(app.elements.arabicResult.textContent, 'MMXXVI');
  assert.equal(paste.label.textContent, 'Pasted!');
  app.reset();
  assert.equal(paste.use.href, 'icons.svg#content_paste');
  assert.equal(paste.label.textContent, 'Paste');
});

test('invalid clipboard numbers preserve the existing input', async () => {
  for (const value of ['', '12.9', '4000', '-1', 'XV', 'NaN']) {
    const app = load({ readText: async () => value });
    app.context.btn = button(true);
    await app.run('pasteArabic(btn)');
    assert.equal(app.elements.arabicInput.value, '1888');
    assert.equal(app.context.btn.label.textContent, 'Invalid number');
    assert.match(app.elements.arabicError.textContent, /whole number/);
  }
});

test('unavailable clipboard access provides manual paste guidance', async () => {
  const app = load({});
  app.context.btn = button(true);
  await app.run('pasteArabic(btn)');
  assert.equal(app.context.btn.label.textContent, 'Paste failed');
  assert.match(app.elements.arabicError.textContent, /Paste directly/);
});

test('Roman paste accepts lowercase and whitespace and synchronizes the result', async () => {
  const app = load({ readText: async () => ' mcmxcviii\n' });
  app.context.btn = button(true);
  await app.run('pasteRoman(btn)');
  assert.equal(app.elements.romanInput.value, 'MCMXCVIII');
  assert.equal(app.elements.romanResult.textContent, 1998);
  assert.equal(app.context.btn.label.textContent, 'Pasted!');
  app.reset();
  assert.equal(app.context.btn.use.href, 'icons.svg#content_paste');
});

test('invalid Roman paste remains editable with explanatory feedback', async () => {
  const app = load({ readText: async () => 'IIII' });
  app.context.btn = button(true);
  await app.run('pasteRoman(btn)');
  assert.equal(app.elements.romanInput.value, 'IIII');
  assert.equal(app.elements.romanResult.textContent, 'Invalid Roman Numeral');
  assert.match(app.elements.romanError.textContent, /IV for 4/);
  assert.equal(app.context.btn.label.textContent, 'Invalid numeral');
});

test('denied Roman paste offers a manual alternative without replacing input', async () => {
  const app = load({ readText: async () => { throw Error('denied'); } });
  app.elements.romanInput.value = 'XIV';
  app.context.btn = button(true);
  await app.run('pasteRoman(btn)');
  assert.equal(app.elements.romanInput.value, 'XIV');
  assert.match(app.elements.romanError.textContent, /Paste directly/);
  assert.equal(app.context.btn.label.textContent, 'Paste failed');
});
