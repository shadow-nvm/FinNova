import { activeCurrency } from "./currencies";

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const fullFormatters = new Map<string, Intl.NumberFormat>();
const compactFormatters = new Map<string, Intl.NumberFormat>();

function fullFormatter(): Intl.NumberFormat {
  const { code, locale, decimals } = activeCurrency();
  const key = `${locale}|${code}|${decimals}`;
  let formatter = fullFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    fullFormatters.set(key, formatter);
  }
  return formatter;
}

function compactFormatter(): Intl.NumberFormat {
  const { code, locale } = activeCurrency();
  const key = `${locale}|${code}`;
  let formatter = compactFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      notation: "compact",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    compactFormatters.set(key, formatter);
  }
  return formatter;
}

/** Full money value in the active currency, e.g. ₹1,234.50 or $1,234.50 */
export function money(value: unknown): string {
  return fullFormatter().format(Number(value || 0));
}

/** Compact money for chart axes and tight cards, e.g. ₹12.5k, ₹1.2L, $12.5K */
export function compactMoney(value: unknown): string {
  const n = Number(value || 0);
  try {
    return compactFormatter().format(n);
  } catch {
    return money(n);
  }
}

/** Symbol of the active currency, for input prefixes. */
export function currencySymbol(): string {
  return activeCurrency().symbol;
}

/** Timezone-safe parser: date-only strings are read as local dates. */
export function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  // Date-only values (goal/reminder dates) must be read as local dates;
  // `new Date("2026-12-15")` is UTC and can show the previous day in western
  // timezones. Full ISO timestamps already carry their own offset.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** e.g. Aug 23, 2026 */
export function dateLong(value?: string | null): string {
  const d = parseDate(value);
  return d
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
}

/** e.g. Aug 23 */
export function dateShort(value?: string | null): string {
  const d = parseDate(value);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
}

/** YYYY-MM key for a transaction date. */
export function monthKeyOf(value?: string | null): string {
  const d = parseDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Last N month keys, oldest first. */
export function lastMonthKeys(count: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** "2026-08" → "Aug '26" */
export function monthShort(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return `${MONTHS[m - 1]} '${String(y).slice(2)}`;
}

/** "2026-08" → "August 2026" */
export function monthLong(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return `${new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long" })} ${y}`;
}

export function todayInput(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

/** YYYY-MM-DD in local time, for <input type="date"> and CSV exports. */
export function dateInput(value?: string | null): string {
  const d = parseDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function normalizeDate(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toISOString();
  if (value instanceof Date) return value.toISOString();
  const maybe = value as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === "function") {
    try {
      return maybe.toDate().toISOString();
    } catch {
      return "";
    }
  }
  if (typeof maybe.seconds === "number") return new Date(maybe.seconds * 1000).toISOString();
  return "";
}

export function initials(name?: string): string {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function downloadBlob(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
