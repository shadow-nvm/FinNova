import type { Budget, Goal, Reminder, Transaction } from "../types";
import { money, normalizeDate, todayInput } from "./format";

function escapeCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
        (tx.date || "").slice(0, 10),
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
  const cleaned = raw.replace(/[₹$€£,\s]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : NaN;
}

function parseDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  // Date-only values are interpreted as local noon to avoid off-by-one days.
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (ymd) {
    const [, y, m, d] = ymd;
    const local = new Date(Number(y), Number(m) - 1, Number(d), 12);
    return Number.isNaN(local.getTime()) ? null : local.toISOString();
  }
  const normalized = normalizeDate(value);
  if (normalized) {
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  // Support dd/mm/yyyy and dd-mm-yyyy explicitly.
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (dmy) {
    const [, d, m, y] = dmy;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d), 12);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

/**
 * Parses a transactions CSV. Accepts headers: date, type, category, amount, note
 * (aliases: description/memo for note, value for amount). Rows with problems are
 * reported instead of silently dropped.
 */
export function parseTransactionsCsv(text: string): CsvParseResult {
  const rows = parseCsv(text);
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
    const rawType = (typeIndex >= 0 ? cells[typeIndex] : "").trim().toLowerCase();
    const type: "income" | "expense" =
      rawType === "income" || rawType === "credit" || rawType === "in"
        ? "income"
        : rawType === "expense" || rawType === "debit" || rawType === "out"
          ? "expense"
          : "expense";
    const category = (categoryIndex >= 0 ? cells[categoryIndex] : "").trim() || "Other";
    const note = (noteIndex >= 0 ? cells[noteIndex] : "").trim();
    parsedRows.push({ type, category, amount: amountValue, date, note });
  });

  return { rows: parsedRows, errors };
}

export function monthCsv(transactions: Transaction[], key: string): string {
  return transactionsCsv(
    transactions.filter((tx) => (tx.date || "").slice(0, 7) === key),
  );
}

export function summaryLine(transactions: Transaction[]): string {
  const net = transactions.reduce(
    (total, tx) => total + (tx.type === "income" ? 1 : -1) * Number(tx.amount || 0),
    0,
  );
  return `${transactions.length} transactions · net ${money(net)} · exported ${todayInput()}`;
}
