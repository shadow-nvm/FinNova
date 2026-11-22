import { describe, expect, it } from "vitest";
import { monthCsv, parseTransactionsCsv, transactionsCsv } from "./csv";
import type { Transaction } from "../types";

const HEADER = "Date,Type,Category,Amount,Note";

function transaction(patch: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    type: "expense",
    category: "Food",
    amount: 10,
    date: new Date(2026, 0, 15, 12).toISOString(),
    note: "Lunch",
    ...patch,
  };
}

function localDate(iso: string): { month: number; day: number } {
  const date = new Date(iso);
  return { month: date.getMonth(), day: date.getDate() };
}

describe("parseTransactionsCsv", () => {
  it("accepts a UTF-8 BOM from spreadsheet exports", () => {
    const result = parseTransactionsCsv(`\uFEFF${HEADER}\r\n2026-01-15,expense,Food,100,Lunch`);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ type: "expense", category: "Food", amount: 100 });
  });

  it("reads ambiguous numeric dates day-first and still accepts month-first only dates", () => {
    const result = parseTransactionsCsv(
      `${HEADER}\n05/03/2026,expense,Food,100,March\n12/31/2026,expense,Food,100,December`,
    );
    expect(result.errors).toEqual([]);
    expect(localDate(result.rows[0].date)).toEqual({ month: 2, day: 5 });
    expect(localDate(result.rows[1].date)).toEqual({ month: 11, day: 31 });
  });

  it("rejects impossible calendar dates instead of rolling them forward", () => {
    const result = parseTransactionsCsv(`${HEADER}\n31/02/2026,expense,Food,100,Invalid`);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]).toContain("Line 2");
  });

  it("reads decimal commas and both thousands conventions", () => {
    const result = parseTransactionsCsv(
      `${HEADER}\n2026-01-15,expense,Food,"12,50",EU\n2026-01-15,expense,Food,"1,234.56",US\n2026-01-15,expense,Food,"1.234,56",EU2`,
    );
    expect(result.errors).toEqual([]);
    expect(result.rows.map((row) => row.amount)).toEqual([12.5, 1234.56, 1234.56]);
  });

  it("reports values the security rules would reject", () => {
    const longCategory = "x".repeat(41);
    const result = parseTransactionsCsv(
      `${HEADER}\n2026-01-15,expense,Food,1000000001,TooBig\n2026-01-15,expense,${longCategory},10,TooLong`,
    );
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
  });

  it("round-trips notes that could be spreadsheet formulas", () => {
    const csv = transactionsCsv([transaction({ note: "=1+1" })]);
    expect(csv).toContain("'=1+1");
    const back = parseTransactionsCsv(csv);
    expect(back.errors).toEqual([]);
    expect(back.rows[0].note).toBe("=1+1");
  });
});

describe("monthCsv", () => {
  it("groups by the local calendar month, not the UTC date prefix", () => {
    // Just after local midnight on 1 June: the ISO timestamp can still be
    // 31 May in UTC.
    const firstOfJune = transaction({
      date: new Date(2026, 5, 1, 0, 30).toISOString(),
      note: "Groceries",
    });
    expect(transactionsCsv([firstOfJune])).toContain("2026-06-01");
    expect(monthCsv([firstOfJune], "2026-06")).toContain("Groceries");
    expect(monthCsv([firstOfJune], "2026-05")).not.toContain("Groceries");
  });
});
