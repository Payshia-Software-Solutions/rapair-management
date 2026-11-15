import data from "./market-country-data.json";

// Country presets are derived from Unicode CLDR 48.0.0 territoryInfo and currencyData.
const countries: Record<string, string[][]> = data;
const regions = new Intl.DisplayNames(["en"], { type: "region" });
const languages = new Intl.DisplayNames(["en"], { type: "language" });

export const countryOptions = Object.keys(countries)
  .map((code) => ({ value: code, label: `${regions.of(code) ?? code} (${code})` }))
  .sort((a, b) => a.label.localeCompare(b.label, "en"));

export function getCountryPreset(code?: string) {
  if (!code || !Object.hasOwn(countries, code)) return undefined;
  const [currencies, localLanguages] = countries[code];
  return {
    name: regions.of(code) ?? code,
    currencies,
    languages: [...new Set(["en", ...localLanguages])],
  };
}

export function getLanguagePreset(language: string, country: string) {
  const locale = new Intl.Locale(`${language}-${country}`);
  return {
    language_code: locale.language,
    locale: (language === "zh" ? locale.maximize() : locale).toString(),
  };
}

export function getLanguageName(language: string) {
  return languages.of(language) ?? language;
}
