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
    document.getElementById('themeIcon').textContent = isDark ? '☀️' : '🌙';
    document.querySelector('.theme-btn').setAttribute('aria-pressed', String(isDark));
    document.querySelector('.theme-btn').setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    document.getElementById('themeIcon').textContent = '☀️';
    document.querySelector('.theme-btn').setAttribute('aria-pressed', 'true');
    document.querySelector('.theme-btn').setAttribute('aria-label', 'Switch to light theme');
}

// --- Copy to Clipboard Helper ---
async function copyToClipboard(elementId, btnElement) {
    if (btnElement.disabled) return;
    const textToCopy = document.getElementById(elementId).textContent;
    try {
        await navigator.clipboard.writeText(textToCopy);
        btnElement.textContent = "✅ Copied!";
        setTimeout(() => { btnElement.textContent = "📋 Copy"; }, 1500);
    } catch (error) {
        btnElement.textContent = "Copy failed";
        setTimeout(() => { btnElement.textContent = "📋 Copy"; }, 2000);
    }
}

function setCopyEnabled(resultId, enabled) {
    document.getElementById(resultId).parentElement.querySelector('.copy-btn').disabled = !enabled;
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
}

function appendRoman(char) {
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

function updateChipDisplay() {
    const container = document.getElementById('chipDisplay');
    container.innerHTML = '';
    
    if (currentChips.length === 0) {
        container.innerHTML = '<span class="placeholder-text font-sans" id="placeholderText">Tap chips below...</span>';
        document.getElementById('romanResult').textContent = '0';
        setCopyEnabled('romanResult', false);
        return;
    }

    currentChips.forEach((char) => {
        const chip = document.createElement('span');
        chip.className = 'chip-item font-mono-num';
        chip.textContent = char;
        container.appendChild(chip);
    });

    const romanString = currentChips.join('');
    const result = romanToArab(romanString);
    
    const resultEl = document.getElementById('romanResult');
    resultEl.textContent = result;
    setCopyEnabled("romanResult", typeof result === "number" && result > 0);
    
    if (result === "Invalid Roman Numeral") {
        resultEl.style.color = "var(--danger)";
        resultEl.style.fontSize = "1.25rem";
        resultEl.className = "result-value font-sans"; 
    } else {
        resultEl.style.color = "var(--primary)";
        resultEl.style.fontSize = "1.75rem";
        resultEl.className = "result-value font-mono-num"; 
    }
}

// Run default state setup on load
document.getElementById('arabicInput').value = 1888;
convertArabicToRoman();
