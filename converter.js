// --- Conversion Engines ---
const romanMap = { M: 1000, D: 500, C: 100, L: 50, X: 10, V: 5, I: 1 };

function arabicToRoman(num, extended = false) {
    const maximum = extended ? 3999999 : 3999;
    if (!Number.isInteger(num) || num < 1 || num > maximum) return 'Out of range (1-' + maximum + ')';
    if (num > 3999) {
        const thousands = arabicToRoman(Math.floor(num / 1000));
        const remainder = num % 1000;
        return overlineRoman(thousands) + (remainder ? arabicToRoman(remainder) : '');
    }
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
function overlineRoman(numeral) {
    return Array.from(numeral, letter => letter + '\u0305').join('');
}

function splitRomanSymbols(input) {
    return input.match(/[MDCLXVI]\u0305?|[\s\S]/g) || [];
}

function analyzeRoman(input, extended = false) {
    const normalized = String(input).trim().toUpperCase();
    if (!/[\u0305()]/.test(normalized)) return analyzeStandardRoman(normalized);
    const invalid = error => ({ normalized, valid: false, value: null, error, groups: [] });
    if (!extended) return invalid('Enable Extended numerals to use overlines or parentheses (×1,000).');

    // Accept one leading overlined block, or its explicitly documented plain-text equivalent.
    const parentheses = normalized.match(/^\(([MDCLXVI]+)\)([MDCLXVI]*)$/);
    const unicode = normalized.match(/^((?:[MDCLXVI]\u0305)+)([MDCLXVI]*)$/);
    if (!parentheses && !unicode) {
        return invalid('Put one overline on each letter in the leading thousands group, followed by any unbarred remainder. Example: I̅V̅XII or (IV)XII = 4012.');
    }
    const high = parentheses ? parentheses[1] : unicode[1].replace(/\u0305/g, '');
    const low = parentheses ? parentheses[2] : unicode[2];
    const thousands = analyzeStandardRoman(high);
    const remainder = low ? analyzeStandardRoman(low) : { valid: true, value: 0, groups: [] };
    if (!thousands.valid) return invalid('Inside the overline: ' + thousands.error);
    if (!remainder.valid) return invalid('After the overline: ' + remainder.error);
    if (remainder.value >= 1000) {
        return invalid('The unbarred remainder must be below 1000. Include all thousands in the overlined group.');
    }
    const value = thousands.value * 1000 + remainder.value;
    const barred = overlineRoman(high);
    const groups = [{
        numeral: barred, value: thousands.value * 1000, multiplier: 1000,
        base: high, baseGroups: thousands.groups
    }, ...remainder.groups];
    return { normalized: barred + low, valid: true, value, error: '', groups };
}

function romanPlainText(input) {
    const result = analyzeRoman(input, true);
    if (!result.valid) return '';
    const first = result.groups[0];
    return first.multiplier === 1000
        ? '(' + first.base + ')' + result.groups.slice(1).map(group => group.numeral).join('')
        : result.normalized;
}

// Arithmetic within an overlined place-value group, before multiplying by 1000.
function romanGroupExpression(numeral) {
    const pairs = { IV: '5 − 1', IX: '10 − 1', XL: '50 − 10', XC: '100 − 10', CD: '500 − 100', CM: '1000 − 100' };
    if (pairs[numeral]) return '(' + pairs[numeral] + ')';
    const runs = numeral.match(/M+|D|C+|L|X+|V|I+/g);
    return runs.map(run => {
        const value = romanMap[run[0]];
        return run.length > 1 ? '(' + value + ' × ' + run.length + ')' : String(value);
    }).join(' + ');
}

function analyzeStandardRoman(input) {
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

function romanBreakdown(input, extended = false) {
    const result = analyzeRoman(input, extended);
    if (!result.valid) return '';
    const lines = [
        result.groups.map(group => group.numeral).join(' + '),
        '= ' + result.groups.map(group => group.value).join(' + '),
        '= ' + result.value
    ];
    const pairs = { IV: [5, 1], IX: [10, 1], XL: [50, 10], XC: [100, 10], CD: [500, 100], CM: [1000, 100] };
    for (const group of result.groups) {
        if (group.multiplier === 1000) {
            const expression = group.baseGroups.map(part => romanGroupExpression(part.numeral)).join(' + ');
            const grouped = group.baseGroups.length > 1 ? '(' + expression + ')' : expression;
            lines.push(group.numeral + ' = ' + grouped + ' × 1000 = ' + group.value);
        } else if (pairs[group.numeral]) {
            const [larger, smaller] = pairs[group.numeral];
            lines.push(group.numeral + ' = ' + larger + ' − ' + smaller + ' = ' + group.value);
        } else if (group.numeral.length > 1) {
            const runs = group.numeral.match(/M+|D|C+|L|X+|V|I+/g);
            const expression = runs.map(run => {
                const value = romanMap[run[0]];
                if (run.length === 1) return String(value);
                const multiplication = value + ' × ' + run.length;
                return runs.length > 1 ? '(' + multiplication + ')' : multiplication;
            }).join(' + ');
            lines.push(group.numeral + ' = ' + expression + ' = ' + group.value);
        }
    }
    return lines.join('\n');
}

function romanToArab(str, extended = false) {
    if (extended) {
        if (!str.trim()) return 0;
        const result = analyzeRoman(str, true);
        return result.valid ? result.value : 'Invalid Roman Numeral';
    }
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
