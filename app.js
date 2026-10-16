// Interface handlers. Load converter.js before this file.
// --- Tab Switching Logic ---
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(tabId).classList.add('active');
    btnElement.classList.add('active');
}

// --- Native Dark Mode Handler ---
function toggleDarkMode() {
    const html = document.documentElement;
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    document.querySelector('.theme-btn').setAttribute('aria-pressed', String(isDark));
    document.querySelector('.theme-btn').setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    document.querySelector('.theme-btn').setAttribute('aria-pressed', 'true');
    document.querySelector('.theme-btn').setAttribute('aria-label', 'Switch to light theme');
}

// --- Clipboard Controls ---
// Update child nodes so feedback never removes the icon markup.
const clipboardTimers = new WeakMap();

function showClipboardFeedback(button, symbol, label, success = false) {
    clearTimeout(clipboardTimers.get(button));
    const icon = button.querySelector('.material-icon');
    const text = button.querySelector('.button-label');
    icon.querySelector('use').setAttribute('href', 'icons.svg#' + symbol);
    icon.classList.toggle('is-success', success);
    icon.classList.toggle('is-error', symbol === 'error');
    text.textContent = label;
    const isPaste = button.classList.contains('paste-btn');
    clipboardTimers.set(button, setTimeout(() => {
        icon.querySelector('use').setAttribute('href', 'icons.svg#' + (isPaste ? 'content_paste' : 'content_copy'));
        icon.classList.remove('is-success', 'is-error');
        text.textContent = isPaste ? 'Paste' : 'Copy';
        clipboardTimers.delete(button);
    }, success ? 1500 : 2500));
}

async function copyToClipboard(elementId, btnElement) {
    if (btnElement.disabled) return;
    const textToCopy = document.getElementById(elementId).textContent;
    try {
        await navigator.clipboard.writeText(textToCopy);
        showClipboardFeedback(btnElement, 'check', 'Copied!', true);
    } catch (error) {
        showClipboardFeedback(btnElement, 'error', 'Copy failed');
    }
}

async function pasteArabic(btnElement) {
    const errorEl = document.getElementById('arabicError');
    try {
        const raw = (await navigator.clipboard.readText()).trim();
        const number = Number(raw);
        if (!raw || !Number.isInteger(number) || number < 1 || number > 3999) {
            errorEl.textContent = 'Paste a whole number from 1 to 3999.';
            showClipboardFeedback(btnElement, 'error', 'Invalid number');
            return;
        }
        document.getElementById('arabicInput').value = String(number);
        convertArabicToRoman();
        showClipboardFeedback(btnElement, 'check', 'Pasted!', true);
    } catch (error) {
        errorEl.textContent = 'Clipboard access unavailable. Paste directly into the number field.';
        showClipboardFeedback(btnElement, 'error', 'Paste failed');
    }
}

function setCopyEnabled(resultId, enabled) {
    document.getElementById(resultId).parentElement.querySelector('.copy-btn').disabled = !enabled;
}

function updateBreakdown(direction) {
    const toggle = document.getElementById(direction + 'BreakdownToggle');
    const panel = document.getElementById(direction + 'Breakdown');
    const numeral = direction === 'arabic'
        ? document.getElementById('arabicResult').textContent
        : currentChips.join('');
    const explanation = toggle.checked ? romanBreakdown(numeral) : '';
    panel.textContent = explanation;
    panel.hidden = !explanation;
}

async function pasteRoman(btnElement) {
    try {
        const raw = await navigator.clipboard.readText();
        document.getElementById('romanInput').value = raw.trim().toUpperCase();
        convertRomanInput();
        const valid = analyzeRoman(raw).valid;
        showClipboardFeedback(btnElement, valid ? 'check' : 'error', valid ? 'Pasted!' : 'Invalid numeral', valid);
    } catch (error) {
        document.getElementById('romanError').textContent = 'Clipboard access unavailable. Paste directly into the Roman numeral field.';
        showClipboardFeedback(btnElement, 'error', 'Paste failed');
    }
}

function convertRomanInput() {
    const raw = document.getElementById('romanInput').value;
    currentChips = Array.from(raw.trim().toUpperCase());
    updateChipDisplay(false);
}

// --- Roman Chip Builder State ---
let currentChips = [];

// --- UI Interactions ---
function convertArabicToRoman() {
    const input = document.getElementById('arabicInput');
    const raw = input.value.trim();
    const num = Number(raw);
    const resEl = document.getElementById('arabicResult');
    const errorEl = document.getElementById('arabicError');
    const valid = raw !== '' && Number.isInteger(num) && num >= 1 && num <= 3999 && input.validity.valid;
    resEl.textContent = valid ? arabicToRoman(num) : '---';
    errorEl.textContent = raw && !valid ? 'Enter a whole number from 1 to 3999.' : '';
    input.setAttribute('aria-invalid', String(raw !== '' && !valid));
    setCopyEnabled('arabicResult', valid);
    updateBreakdown('arabic');
}

function appendRoman(char) {
    if (!/^[MDCLXVI]$/.test(char)) return;
    if (currentChips.length >= 15) return;
    currentChips.push(char);
    updateChipDisplay();
}

function backspaceRoman() {
    currentChips.pop();
    updateChipDisplay();
}

function clearChips() {
    currentChips = [];
    updateChipDisplay();
}

function updateChipDisplay(syncInput = true) {
    const numeral = currentChips.join('');
    const input = document.getElementById('romanInput');
    if (syncInput) input.value = numeral;
    const result = analyzeRoman(numeral);
    const container = document.getElementById('chipDisplay');
    container.innerHTML = '';

    if (!currentChips.length) {
        container.innerHTML = '<span class="placeholder-text font-sans" id="placeholderText">Tap chips below...</span>';
    } else {
        // Invalid text stays in the editable field; only Roman letters become chips.
        currentChips.filter(char => /^[MDCLXVI]$/.test(char)).slice(0, 15).forEach(char => {
            const chip = document.createElement('span');
            chip.className = 'chip-item font-mono-num';
            chip.textContent = char;
            container.appendChild(chip);
        });
    }

    const resultEl = document.getElementById('romanResult');
    resultEl.textContent = result.valid ? result.value : (numeral ? 'Invalid Roman Numeral' : '0');
    resultEl.className = result.valid || !numeral
        ? 'result-value font-mono-num' : 'result-value font-sans is-invalid';
    document.getElementById('romanError').textContent = result.error;
    input.setAttribute('aria-invalid', String(Boolean(numeral) && !result.valid));
    setCopyEnabled('romanResult', result.valid);
    updateBreakdown('roman');
}

// Run default state setup on load
document.getElementById('arabicInput').value = 1888;
convertArabicToRoman();
