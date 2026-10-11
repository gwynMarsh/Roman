// --- Conversion Engines ---
const romanMap = { M: 1000, D: 500, C: 100, L: 50, X: 10, V: 5, I: 1 };

function arabicToRoman(num) {
    if (num < 1 || num > 3999) return "Out of range (1-3999)";
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
