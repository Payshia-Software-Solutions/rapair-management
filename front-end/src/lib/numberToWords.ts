/**
 * Convert number to words in Sri Lankan Rupees & Cents
 * Example: 1520.50 -> "Rupees One Thousand Five Hundred Twenty and Cents Fifty Only"
 */
export function numberToWordsLKR(num: number | string): string {
  const n = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(n) || n === 0) return "Rupees Zero Only";

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];

  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
  ];

  function convertSection(num: number): string {
    let result = "";
    if (num >= 100) {
      result += ones[Math.floor(num / 100)] + " Hundred ";
      num %= 100;
    }
    if (num >= 20) {
      result += tens[Math.floor(num / 10)] + " ";
      num %= 10;
    }
    if (num > 0) {
      result += ones[num] + " ";
    }
    return result.trim();
  }

  const isNegative = n < 0;
  const absNum = Math.abs(n);
  const rupees = Math.floor(absNum);
  const cents = Math.round((absNum - rupees) * 100);

  let words = "";

  if (rupees > 0) {
    const billions = Math.floor(rupees / 1000000000);
    const millions = Math.floor((rupees % 1000000000) / 1000000);
    const thousands = Math.floor((rupees % 1000000) / 1000);
    const remainder = rupees % 1000;

    if (billions > 0) {
      words += convertSection(billions) + " Billion ";
    }
    if (millions > 0) {
      words += convertSection(millions) + " Million ";
    }
    if (thousands > 0) {
      words += convertSection(thousands) + " Thousand ";
    }
    if (remainder > 0) {
      words += convertSection(remainder) + " ";
    }
    words = "Rupees " + words.trim();
  } else {
    words = "Rupees Zero";
  }

  if (cents > 0) {
    words += " and Cents " + convertSection(cents);
  }

  words += " Only";
  if (isNegative) {
    words = "Minus " + words;
  }

  return words.replace(/\s+/g, " ").trim();
}
