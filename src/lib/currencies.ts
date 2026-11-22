/**
 * Country + currency catalogue.
 *
 * Amounts in FinNova are stored as plain numbers in the user's own currency.
 * `usd` is an approximate offline reference rate (value of one unit in USD)
 * used only when the user explicitly converts existing amounts after switching
 * currency. It is not a live feed — the settings screen says so.
 */

export interface CurrencyDef {
  code: string;
  name: string;
  symbol: string;
  /** Fraction digits used for display. */
  decimals: number;
  /** Locale used for grouping/formatting this currency. */
  locale: string;
  /** Approximate value of 1 unit in USD. */
  usd: number;
}

export interface CountryDef {
  code: string;
  name: string;
  flag: string;
  currency: string;
  locale: string;
}

export const CURRENCIES: Record<string, CurrencyDef> = {
  INR: { code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2, locale: "en-IN", usd: 0.012 },
  USD: { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, locale: "en-US", usd: 1 },
  EUR: { code: "EUR", name: "Euro", symbol: "€", decimals: 2, locale: "de-DE", usd: 1.08 },
  GBP: { code: "GBP", name: "British Pound", symbol: "£", decimals: 2, locale: "en-GB", usd: 1.27 },
  JPY: { code: "JPY", name: "Japanese Yen", symbol: "¥", decimals: 0, locale: "ja-JP", usd: 0.0066 },
  CNY: { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimals: 2, locale: "zh-CN", usd: 0.138 },
  HKD: { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimals: 2, locale: "zh-HK", usd: 0.128 },
  TWD: { code: "TWD", name: "New Taiwan Dollar", symbol: "NT$", decimals: 0, locale: "zh-TW", usd: 0.031 },
  KRW: { code: "KRW", name: "South Korean Won", symbol: "₩", decimals: 0, locale: "ko-KR", usd: 0.00075 },
  SGD: { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimals: 2, locale: "en-SG", usd: 0.745 },
  MYR: { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", decimals: 2, locale: "ms-MY", usd: 0.21 },
  IDR: { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimals: 0, locale: "id-ID", usd: 0.000063 },
  THB: { code: "THB", name: "Thai Baht", symbol: "฿", decimals: 2, locale: "th-TH", usd: 0.028 },
  PHP: { code: "PHP", name: "Philippine Peso", symbol: "₱", decimals: 2, locale: "en-PH", usd: 0.017 },
  VND: { code: "VND", name: "Vietnamese Dong", symbol: "₫", decimals: 0, locale: "vi-VN", usd: 0.00004 },
  AUD: { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2, locale: "en-AU", usd: 0.66 },
  NZD: { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimals: 2, locale: "en-NZ", usd: 0.61 },
  CAD: { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimals: 2, locale: "en-CA", usd: 0.735 },
  CHF: { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimals: 2, locale: "de-CH", usd: 1.13 },
  SEK: { code: "SEK", name: "Swedish Krona", symbol: "kr", decimals: 2, locale: "sv-SE", usd: 0.095 },
  NOK: { code: "NOK", name: "Norwegian Krone", symbol: "kr", decimals: 2, locale: "nb-NO", usd: 0.093 },
  DKK: { code: "DKK", name: "Danish Krone", symbol: "kr", decimals: 2, locale: "da-DK", usd: 0.145 },
  PLN: { code: "PLN", name: "Polish Zloty", symbol: "zł", decimals: 2, locale: "pl-PL", usd: 0.25 },
  CZK: { code: "CZK", name: "Czech Koruna", symbol: "Kč", decimals: 2, locale: "cs-CZ", usd: 0.043 },
  HUF: { code: "HUF", name: "Hungarian Forint", symbol: "Ft", decimals: 0, locale: "hu-HU", usd: 0.0028 },
  RON: { code: "RON", name: "Romanian Leu", symbol: "lei", decimals: 2, locale: "ro-RO", usd: 0.22 },
  TRY: { code: "TRY", name: "Turkish Lira", symbol: "₺", decimals: 2, locale: "tr-TR", usd: 0.031 },
  RUB: { code: "RUB", name: "Russian Ruble", symbol: "₽", decimals: 2, locale: "ru-RU", usd: 0.011 },
  UAH: { code: "UAH", name: "Ukrainian Hryvnia", symbol: "₴", decimals: 2, locale: "uk-UA", usd: 0.024 },
  ILS: { code: "ILS", name: "Israeli New Shekel", symbol: "₪", decimals: 2, locale: "he-IL", usd: 0.27 },
  AED: { code: "AED", name: "UAE Dirham", symbol: "AED", decimals: 2, locale: "en-AE", usd: 0.272 },
  SAR: { code: "SAR", name: "Saudi Riyal", symbol: "SAR", decimals: 2, locale: "ar-SA", usd: 0.267 },
  QAR: { code: "QAR", name: "Qatari Riyal", symbol: "QAR", decimals: 2, locale: "ar-QA", usd: 0.275 },
  KWD: { code: "KWD", name: "Kuwaiti Dinar", symbol: "KWD", decimals: 2, locale: "ar-KW", usd: 3.26 },
  OMR: { code: "OMR", name: "Omani Rial", symbol: "OMR", decimals: 2, locale: "ar-OM", usd: 2.6 },
  BHD: { code: "BHD", name: "Bahraini Dinar", symbol: "BHD", decimals: 2, locale: "ar-BH", usd: 2.65 },
  EGP: { code: "EGP", name: "Egyptian Pound", symbol: "E£", decimals: 2, locale: "en-EG", usd: 0.021 },
  ZAR: { code: "ZAR", name: "South African Rand", symbol: "R", decimals: 2, locale: "en-ZA", usd: 0.054 },
  NGN: { code: "NGN", name: "Nigerian Naira", symbol: "₦", decimals: 2, locale: "en-NG", usd: 0.00067 },
  KES: { code: "KES", name: "Kenyan Shilling", symbol: "KSh", decimals: 2, locale: "en-KE", usd: 0.0077 },
  GHS: { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵", decimals: 2, locale: "en-GH", usd: 0.067 },
  TZS: { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", decimals: 0, locale: "sw-TZ", usd: 0.00039 },
  UGX: { code: "UGX", name: "Ugandan Shilling", symbol: "USh", decimals: 0, locale: "en-UG", usd: 0.00027 },
  ETB: { code: "ETB", name: "Ethiopian Birr", symbol: "Br", decimals: 2, locale: "am-ET", usd: 0.017 },
  BRL: { code: "BRL", name: "Brazilian Real", symbol: "R$", decimals: 2, locale: "pt-BR", usd: 0.2 },
  MXN: { code: "MXN", name: "Mexican Peso", symbol: "MX$", decimals: 2, locale: "es-MX", usd: 0.058 },
  ARS: { code: "ARS", name: "Argentine Peso", symbol: "AR$", decimals: 2, locale: "es-AR", usd: 0.0011 },
  CLP: { code: "CLP", name: "Chilean Peso", symbol: "CLP$", decimals: 0, locale: "es-CL", usd: 0.00105 },
  COP: { code: "COP", name: "Colombian Peso", symbol: "COL$", decimals: 0, locale: "es-CO", usd: 0.00025 },
  PEN: { code: "PEN", name: "Peruvian Sol", symbol: "S/", decimals: 2, locale: "es-PE", usd: 0.27 },
  PKR: { code: "PKR", name: "Pakistani Rupee", symbol: "₨", decimals: 2, locale: "en-PK", usd: 0.0036 },
  BDT: { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", decimals: 2, locale: "bn-BD", usd: 0.0085 },
  LKR: { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs", decimals: 2, locale: "si-LK", usd: 0.0033 },
  NPR: { code: "NPR", name: "Nepalese Rupee", symbol: "रू", decimals: 2, locale: "ne-NP", usd: 0.0075 },
};

export const COUNTRIES: CountryDef[] = [
  { code: "IN", name: "India", flag: "🇮🇳", currency: "INR", locale: "en-IN" },
  { code: "US", name: "United States", flag: "🇺🇸", currency: "USD", locale: "en-US" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: "GBP", locale: "en-GB" },
  { code: "CA", name: "Canada", flag: "🇨🇦", currency: "CAD", locale: "en-CA" },
  { code: "AU", name: "Australia", flag: "🇦🇺", currency: "AUD", locale: "en-AU" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", currency: "NZD", locale: "en-NZ" },
  { code: "IE", name: "Ireland", flag: "🇮🇪", currency: "EUR", locale: "en-IE" },
  { code: "DE", name: "Germany", flag: "🇩🇪", currency: "EUR", locale: "de-DE" },
  { code: "FR", name: "France", flag: "🇫🇷", currency: "EUR", locale: "fr-FR" },
  { code: "ES", name: "Spain", flag: "🇪🇸", currency: "EUR", locale: "es-ES" },
  { code: "IT", name: "Italy", flag: "🇮🇹", currency: "EUR", locale: "it-IT" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", currency: "EUR", locale: "nl-NL" },
  { code: "BE", name: "Belgium", flag: "🇧🇪", currency: "EUR", locale: "nl-BE" },
  { code: "AT", name: "Austria", flag: "🇦🇹", currency: "EUR", locale: "de-AT" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", currency: "EUR", locale: "pt-PT" },
  { code: "GR", name: "Greece", flag: "🇬🇷", currency: "EUR", locale: "el-GR" },
  { code: "FI", name: "Finland", flag: "🇫🇮", currency: "EUR", locale: "fi-FI" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", currency: "CHF", locale: "de-CH" },
  { code: "SE", name: "Sweden", flag: "🇸🇪", currency: "SEK", locale: "sv-SE" },
  { code: "NO", name: "Norway", flag: "🇳🇴", currency: "NOK", locale: "nb-NO" },
  { code: "DK", name: "Denmark", flag: "🇩🇰", currency: "DKK", locale: "da-DK" },
  { code: "PL", name: "Poland", flag: "🇵🇱", currency: "PLN", locale: "pl-PL" },
  { code: "CZ", name: "Czechia", flag: "🇨🇿", currency: "CZK", locale: "cs-CZ" },
  { code: "HU", name: "Hungary", flag: "🇭🇺", currency: "HUF", locale: "hu-HU" },
  { code: "RO", name: "Romania", flag: "🇷🇴", currency: "RON", locale: "ro-RO" },
  { code: "TR", name: "Türkiye", flag: "🇹🇷", currency: "TRY", locale: "tr-TR" },
  { code: "RU", name: "Russia", flag: "🇷🇺", currency: "RUB", locale: "ru-RU" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", currency: "UAH", locale: "uk-UA" },
  { code: "IL", name: "Israel", flag: "🇮🇱", currency: "ILS", locale: "he-IL" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", currency: "AED", locale: "en-AE" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", currency: "SAR", locale: "ar-SA" },
  { code: "QA", name: "Qatar", flag: "🇶🇦", currency: "QAR", locale: "ar-QA" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼", currency: "KWD", locale: "ar-KW" },
  { code: "OM", name: "Oman", flag: "🇴🇲", currency: "OMR", locale: "ar-OM" },
  { code: "BH", name: "Bahrain", flag: "🇧🇭", currency: "BHD", locale: "ar-BH" },
  { code: "EG", name: "Egypt", flag: "🇪🇬", currency: "EGP", locale: "en-EG" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", currency: "ZAR", locale: "en-ZA" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN", locale: "en-NG" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", currency: "KES", locale: "en-KE" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", currency: "GHS", locale: "en-GH" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", currency: "TZS", locale: "sw-TZ" },
  { code: "UG", name: "Uganda", flag: "🇺🇬", currency: "UGX", locale: "en-UG" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹", currency: "ETB", locale: "am-ET" },
  { code: "JP", name: "Japan", flag: "🇯🇵", currency: "JPY", locale: "ja-JP" },
  { code: "CN", name: "China", flag: "🇨🇳", currency: "CNY", locale: "zh-CN" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰", currency: "HKD", locale: "zh-HK" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼", currency: "TWD", locale: "zh-TW" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", currency: "KRW", locale: "ko-KR" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", currency: "SGD", locale: "en-SG" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", currency: "MYR", locale: "ms-MY" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", currency: "IDR", locale: "id-ID" },
  { code: "TH", name: "Thailand", flag: "🇹🇭", currency: "THB", locale: "th-TH" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", currency: "PHP", locale: "en-PH" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", currency: "VND", locale: "vi-VN" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", currency: "PKR", locale: "en-PK" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", currency: "BDT", locale: "bn-BD" },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰", currency: "LKR", locale: "si-LK" },
  { code: "NP", name: "Nepal", flag: "🇳🇵", currency: "NPR", locale: "ne-NP" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", currency: "BRL", locale: "pt-BR" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", currency: "MXN", locale: "es-MX" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", currency: "ARS", locale: "es-AR" },
  { code: "CL", name: "Chile", flag: "🇨🇱", currency: "CLP", locale: "es-CL" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", currency: "COP", locale: "es-CO" },
  { code: "PE", name: "Peru", flag: "🇵🇪", currency: "PEN", locale: "es-PE" },
];

export const DEFAULT_COUNTRY = "IN";
export const DEFAULT_CURRENCY = "INR";

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

/** Language-only fallbacks, e.g. `en` → United States, `hi` → India. */
const LANGUAGE_DEFAULTS: Record<string, string> = {
  en: "US",
  hi: "IN",
  de: "DE",
  fr: "FR",
  es: "ES",
  it: "IT",
  nl: "NL",
  pt: "BR",
  ja: "JP",
  ko: "KR",
  zh: "CN",
  ar: "AE",
  ru: "RU",
  tr: "TR",
  sv: "SE",
  nb: "NO",
  no: "NO",
  da: "DK",
  fi: "FI",
  pl: "PL",
  th: "TH",
  vi: "VN",
  id: "ID",
  ms: "MY",
  bn: "BD",
  ur: "PK",
  ne: "NP",
  sw: "TZ",
  he: "IL",
};

export function countryByCode(code: string | null | undefined): CountryDef | null {
  if (!code) return null;
  return COUNTRY_BY_CODE.get(code.toUpperCase()) ?? null;
}

export function currencyByCode(code: string | null | undefined): CurrencyDef {
  if (code) {
    const found = CURRENCIES[code.toUpperCase()];
    if (found) return found;
  }
  return CURRENCIES[DEFAULT_CURRENCY];
}

/** Best-effort country guess from a BCP-47 locale such as `en-GB`. */
export function countryFromLocale(locale: string | null | undefined): CountryDef | null {
  if (!locale) return null;
  const match = /^([a-zA-Z]{2,3})(?:[-_]([a-zA-Z]{2}))?/.exec(locale);
  if (!match) return null;
  const [, language, region] = match;
  if (region) {
    const byRegion = countryByCode(region);
    if (byRegion) return byRegion;
  }
  const fallback = LANGUAGE_DEFAULTS[language.toLowerCase()];
  return fallback ? countryByCode(fallback) : null;
}

export function isCurrencyCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(CURRENCIES, value.toUpperCase())
  );
}

let currentCurrencyCode = DEFAULT_CURRENCY;

export function setActiveCurrency(code: string): void {
  currentCurrencyCode = currencyByCode(code).code;
}

export function activeCurrency(): CurrencyDef {
  return currencyByCode(currentCurrencyCode);
}

export function activeCurrencyCode(): string {
  return activeCurrency().code;
}

/** Value of `from` expressed in `to`, using the reference rates. */
export function conversionRate(from: string, to: string): number {
  const source = currencyByCode(from);
  const target = currencyByCode(to);
  if (!target.usd) return 1;
  return source.usd / target.usd;
}

/** Smallest amount the app stores: every amount keeps two decimals. */
const MIN_MONEY_UNIT = 0.01;

/** Rounds to two decimals, the precision every stored amount uses. */
export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Converts an amount between currencies and rounds it like stored amounts. */
export function convertAmount(value: number, from: string, to: string): number {
  const source = Number(value || 0);
  const converted = roundMoney(source * conversionRate(from, to));
  if (source === 0 || converted !== 0) return converted || 0;
  // A tiny but real amount must not collapse to 0.00: zeroed transactions
  // break the "amounts are positive" invariant (and the security rules).
  return source > 0 ? MIN_MONEY_UNIT : -MIN_MONEY_UNIT;
}
