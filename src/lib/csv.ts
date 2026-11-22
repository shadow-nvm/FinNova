import type { Budget, Goal, Reminder, Transaction } from "../types";
import { dateInput, monthKeyOf } from "./format";

/** A leading one of these makes spreadsheets treat a cell as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;
/** Limits enforced by `firestore.rules` for transactions. */
const MAX_AMOUNT = 1_000_000_000;
const MAX_CATEGORY_LENGTH = 40;

function escapeCell(value: unknown): string {
  let text = String(value ?? "");
  // Spreadsheet formula injection: =, +, -, @, tab and CR can be executed when
  // the CSV is opened in Excel/Sheets. Prefix an apostrophe; `unescapeCell`
  // removes it on import so FinNova's own exports round-trip cleanly.
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Reverses the apostrophe protection added by `escapeCell`. */
function unescapeCell(value: string): string {
  return value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers.join(","), ...rows.map((row) => row.map(escapeCell).join(","))].join("\r\n");
}

export function transactionsCsv(transactions: Transaction[]): string {
  return toCsv(
    ["Date", "Type", "Category", "Amount", "Note"],
    [...transactions]
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map((tx) => [
        dateInput(tx.date) || (tx.date || "").slice(0, 10),
        tx.type,
        tx.category,
        Number(tx.amount || 0).toFixed(2),
        tx.note || "",
      ]),
  );
}

export function fullBackupJson(
  transactions: Transaction[],
  budgets: Budget[],
  goals: Goal[],
  reminders: Reminder[],
): string {
  return JSON.stringify(
    {
      app: "FinNova",
      version: 2,
      exportedAt: new Date().toISOString(),
      transactions,
      budgets,
      goals,
      reminders,
    },
    null,
    2,
  );
}

export interface CsvRow {
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
  note: string;
}

export interface CsvParseResult {
  rows: CsvRow[];
  errors: string[];
}

/** Minimal RFC-4180 CSV parser: handles quotes, embedded commas and newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

function findKey(headers: string[], candidates: string[]): number {
  const normalized = headers.map((header) => header.trim().toLowerCase());
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index !== -1) return index;
  }
  return -1;
}

function parseAmount(raw: string): number {
  // Strip any currency symbol, spaces and thousands separators, so exports
  // from another currency or locale still import cleanly.
  let cleaned = raw.replace(/[^\d.,-]/g, "");
  if (cleaned.includes(".") && cleaned.includes(",")) {
    // 1.234,56 (European) vs 1,234.56 (US): keep the rightmost separator.
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    // "12,50" is a decimal comma; "1,234" and "12,34,567" group thousands.
    cleaned =
      parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2
        ? parts.join(".")
        : cleaned.replace(/,/g, "");
  }
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : NaN;
}

/** Local noon on a valid calendar date, or null for impossible dates. */
function localNoon(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day, 12);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function parseDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  // ISO date or date-time, which is what FinNova and most trackers export.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(value);
  const isoDate = iso ? localNoon(Number(iso[1]), Number(iso[2]), Number(iso[3])) : null;
  if (isoDate) return isoDate.toISOString();
  // Numeric day-first and month-first dates. Ambiguous values such as
  // 05/03/2026 are read day-first (the format this importer documents); a value
  // that can only be month-first (12/31/2026) is still accepted.
  const numeric = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (numeric) {
    let day = Number(numeric[1]);
    let month = Number(numeric[2]);
    if (month > 12 && day <= 12) [day, month] = [month, day];
    const parsed = localNoon(Number(numeric[3]), month, day);
    return parsed ? parsed.toISOString() : null;
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
}

/**
 * Parses a transactions CSV. Accepts headers: date, type, category, amount, note
 * (aliases: description/memo for note, value for amount). Rows with problems are
 * reported instead of silently dropped.
 */
export function parseTransactionsCsv(input: string): CsvParseResult {
  // Spreadsheet exports often start with a UTF-8 BOM; without stripping it the
  // first header ("\uFEFFDate") is not recognised.
  const rows = parseCsv(input.replace(/^\uFEFF/, ""));
  const errors: string[] = [];
  if (rows.length < 2) return { rows: [], errors: ["The file is empty or has no data rows."] };

  const headers = rows[0];
  const dateIndex = findKey(headers, ["date", "when", "transaction date"]);
  const typeIndex = findKey(headers, ["type", "kind"]);
  const categoryIndex = findKey(headers, ["category", "cat"]);
  const amountIndex = findKey(headers, ["amount", "value", "sum"]);
  const noteIndex = findKey(headers, ["note", "description", "details", "memo", "title"]);

  if (dateIndex === -1 || amountIndex === -1) {
    return {
      rows: [],
      errors: [
        'Missing required columns. Include at least "Date" and "Amount" (optionally Type, Category, Note).',
      ],
    };
  }

  const parsedRows: CsvRow[] = [];
  rows.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const date = parseDate(cells[dateIndex] || "");
    if (!date) {
      errors.push(`Line ${line}: could not read the date "${cells[dateIndex] || ""}".`);
      return;
    }
    const amountValue = parseAmount(cells[amountIndex] || "");
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      errors.push(`Line ${line}: amount must be a positive number.`);
      return;
    }
    if (amountValue > MAX_AMOUNT) {
      errors.push(
        `Line ${line}: amount is above the ${MAX_AMOUNT.toLocaleString("en-US")} limit.`,
      );
      return;
    }
    const rawType = (typeIndex >= 0 ? cells[typeIndex] : "").trim().toLowerCase();
    const type: "income" | "expense" =
      rawType === "income" || rawType === "credit" || rawType === "in"
        ? "income"
        : rawType === "expense" || rawType === "debit" || rawType === "out"
          ? "expense"
          : "expense";
    const category =
      unescapeCell((categoryIndex >= 0 ? cells[categoryIndex] : "").trim()) || "Other";
    if (category.length > MAX_CATEGORY_LENGTH) {
      errors.push(
        `Line ${line}: category must be ${MAX_CATEGORY_LENGTH} characters or fewer.`,
      );
      return;
    }
    const note = unescapeCell((noteIndex >= 0 ? cells[noteIndex] : "").trim());
    parsedRows.push({ type, category, amount: amountValue, date, note });
  });

  return { rows: parsedRows, errors };
}

/**
 * One month of transactions, grouped the same way the app groups months
 * (local calendar month, not the UTC date prefix of the stored timestamp).
 */
export function monthCsv(transactions: Transaction[], key: string): string {
  return transactionsCsv(transactions.filter((tx) => monthKeyOf(tx.date) === key));
}
