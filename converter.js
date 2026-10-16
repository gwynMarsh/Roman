// --- Conversion Engines ---
const romanMap = { M: 1000, D: 500, C: 100, L: 50, X: 10, V: 5, I: 1 };

function arabicToRoman(num) {
    if (!Number.isInteger(num) || num < 1 || num > 3999) return "Out of range (1-3999)";
    const lookup = {M:1000, CM:900, D:500, CD:400, C:100, XC:90, L:50, XL:40, X:10, IX:9, V:5, IV:4, I:1};
    let roman = "";
    for (let i in lookup) {
        while (num >= lookup[i]) {
            roman += i;
            num -= lookup[i];
        }
    }
    return roman;
}

// Used by typed input, clipboard input, chip feedback and breakdowns.
function analyzeRoman(input) {
    const normalized = String(input).trim().toUpperCase();
    const invalid = error => ({ normalized, valid: false, value: null, error, groups: [] });
    if (!normalized) return invalid('');
    if (/[^MDCLXVI]/.test(normalized)) {
        return invalid('Use only the Roman letters M, D, C, L, X, V and I, without spaces between them.');
    }
    if (normalized.length > 15) {
        return invalid('Enter a standard Roman numeral from I to MMMCMXCIX (1–3999), using at most 15 letters.');
    }
    const value = romanToArab(normalized);
    if (typeof value !== 'number') {
        if (/IIII/.test(normalized)) {
            return invalid('Use IV for 4. In standard Roman notation, I can repeat at most three times.');
        }
        if (/XXXX/.test(normalized)) return invalid('Use XL for 40. X can repeat at most three times.');
        if (/CCCC/.test(normalized)) return invalid('Use CD for 400. C can repeat at most three times.');
        if (/MMMM/.test(normalized)) return invalid('This converter supports up to 3999 (MMMCMXCIX). M can repeat at most three times.');
        if (/VV|LL|DD/.test(normalized)) return invalid('V, L and D cannot repeat in standard Roman notation.');
        return invalid('Check the order. The only subtractive pairs are IV, IX, XL, XC, CD and CM.');
    }
    const parts = normalized.match(/^(M{0,3})(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/);
    const groups = parts.slice(1).filter(Boolean).map(numeral => ({ numeral, value: romanToArab(numeral) }));
    return { normalized, valid: true, value, error: '', groups };
}

function romanBreakdown(input) {
    const result = analyzeRoman(input);
    if (!result.valid) return '';
    const lines = [
        result.groups.map(group => group.numeral).join(' + '),
        '= ' + result.groups.map(group => group.value).join(' + '),
        '= ' + result.value
    ];
    const pairs = { IV: [5, 1], IX: [10, 1], XL: [50, 10], XC: [100, 10], CD: [500, 100], CM: [1000, 100] };
    for (const group of result.groups) {
        if (pairs[group.numeral]) {
            const [larger, smaller] = pairs[group.numeral];
            lines.push(group.numeral + ' = ' + larger + ' − ' + smaller + ' = ' + group.value);
        }
    }
    return lines.join('\n');
}

function romanToArab(str) {
    str = str.toUpperCase();
    if (!str) return 0;

    const romanRegex = /^(M{0,3})(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
    if (!romanRegex.test(str)) {
        return "Invalid Roman Numeral";
    }

    let total = 0;
    for (let i = 0; i < str.length; i++) {
        let current = romanMap[str[i]];
        let next = romanMap[str[i + 1]];
        if (next && current < next) {
            total += (next - current);
            i++; 
        } else {
            total += current;
        }
    }
    return total;
}
