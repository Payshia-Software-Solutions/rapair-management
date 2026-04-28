/**
 * Number To Words utility
 */
const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export const numberToWords = (num: number | string): string => {
    let n = typeof num === 'string' ? parseInt(num, 10) : Math.floor(num);
    if (isNaN(n) || n === 0) return 'ZERO';

    const convert = (n: number): string => {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
        if (n < 1000) return a[Math.floor(n / 100)] + 'hundred ' + (n % 100 !== 0 ? 'and ' + convert(n % 100) : '');
        if (n < 1000000) return convert(Math.floor(n / 1000)) + ' thousand ' + (n % 1000 !== 0 ? convert(n % 1000) : '');
        if (n < 1000000000) return convert(Math.floor(n / 1000000)) + ' million ' + (n % 1000000 !== 0 ? convert(n % 1000000) : '');
        return 'too big';
    };

    return convert(n).trim().toUpperCase();
};

export const amountToWords = (amount: number | string): string => {
    const numValue = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numValue) || numValue === 0) return "ZERO ONLY";
    
    const parts = numValue.toFixed(2).split('.');
    const main = parseInt(parts[0], 10);
    const cents = parseInt(parts[1], 10);

    let res = numberToWords(main);
    if (cents > 0) {
        res += " AND " + numberToWords(cents) + " CENTS";
    }
    return res + " ONLY";
};
