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
        text.textContent = isPaste ? 'Paste' : (button.dataset?.label || 'Copy');
        clipboardTimers.delete(button);
    }, success ? 1500 : 2500));
}

async function copyToClipboard(elementId, btnElement, plain = false) {
    if (btnElement.disabled) return;
    const resultText = document.getElementById(elementId).textContent;
    const textToCopy = plain ? romanPlainText(resultText) : resultText;
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
        if (!raw || !Number.isInteger(number) || number < 1 || number > maximumArabic()) {
            errorEl.textContent = 'Paste a whole number from 1 to ' + maximumArabic().toLocaleString('en-US') + '.';
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
    const explanation = toggle.checked ? romanBreakdown(numeral, isExtendedMode()) : '';
    panel.textContent = explanation;
    panel.hidden = !explanation;
}

async function pasteRoman(btnElement) {
    try {
        const raw = await navigator.clipboard.readText();
        document.getElementById('romanInput').value = raw.trim().toUpperCase();
        convertRomanInput();
        const valid = analyzeRoman(raw, isExtendedMode()).valid;
        showClipboardFeedback(btnElement, valid ? 'check' : 'error', valid ? 'Pasted!' : 'Invalid numeral', valid);
    } catch (error) {
        document.getElementById('romanError').textContent = 'Clipboard access unavailable. Paste directly into the Roman numeral field.';
        showClipboardFeedback(btnElement, 'error', 'Paste failed');
    }
}

function convertRomanInput() {
    const raw = document.getElementById('romanInput').value;
    const analysis = analyzeRoman(raw, isExtendedMode());
    currentChips = splitRomanSymbols(analysis.valid ? analysis.normalized : raw.trim().toUpperCase());
    updateChipDisplay(false);
}

// --- Numeral Mode ---
function isExtendedMode() {
    return document.getElementById('extendedMode')?.checked === true;
}

function maximumArabic() {
    return isExtendedMode() ? 3999999 : 3999;
}

function changeNumeralMode() {
    const enabled = isExtendedMode();
    document.getElementById('arabicInput').max = String(maximumArabic());
    document.getElementById('arabicLabel').textContent = 'Arabic Number (1 - ' + maximumArabic().toLocaleString('en-US') + ')';
    document.getElementById('extendedHint').hidden = !enabled;
    document.getElementById('overlineChipControl').hidden = !enabled;
    if (!enabled) document.getElementById('overlineChips').checked = false;
    updateChipPalette();
    convertArabicToRoman();
    convertRomanInput();
}

function updateChipPalette() {
    const barred = isExtendedMode() && document.getElementById('overlineChips').checked;
    document.querySelectorAll('.chip-btn').forEach(button => {
        const letter = button.dataset.roman;
        button.querySelector('.chip-letter').textContent = barred ? overlineRoman(letter) : letter;
        button.querySelector('.chip-sub').textContent = (romanMap[letter] * (barred ? 1000 : 1)).toLocaleString('en-US');
    });
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
    const valid = raw !== '' && Number.isInteger(num) && num >= 1 && num <= maximumArabic() && input.validity.valid;
    resEl.textContent = valid ? arabicToRoman(num, isExtendedMode()) : '---';
    errorEl.textContent = raw && !valid ? 'Enter a whole number from 1 to ' + maximumArabic().toLocaleString('en-US') + '.' : '';
    input.setAttribute('aria-invalid', String(raw !== '' && !valid));
    setCopyEnabled('arabicResult', valid);
    updateBreakdown('arabic');
    const plainButton = document.getElementById('copyPlainButton');
    if (plainButton) plainButton.hidden = !valid || !resEl.textContent.includes('\u0305');
}

function appendRoman(char) {
    if (!/^[MDCLXVI]$/.test(char)) return;
    if (currentChips.length >= (isExtendedMode() ? 27 : 15)) return;
    const barred = isExtendedMode() && document.getElementById('overlineChips').checked;
    currentChips.push(barred ? char + '\u0305' : char);
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
    const result = analyzeRoman(numeral, isExtendedMode());
    const container = document.getElementById('chipDisplay');
    container.innerHTML = '';

    if (!currentChips.length) {
        container.innerHTML = '<span class="placeholder-text font-sans" id="placeholderText">Tap chips below...</span>';
    } else {
        // Invalid text stays in the editable field; only Roman letters become chips.
        currentChips.filter(char => /^[MDCLXVI]\u0305?$/.test(char)).slice(0, isExtendedMode() ? 27 : 15).forEach(char => {
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
