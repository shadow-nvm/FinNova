import { describe, expect, it } from "vitest";
import {
  conversionRate,
  convertAmount,
  currencyByCode,
  isCurrencyCode,
  roundMoney,
} from "./currencies";

describe("conversionRate", () => {
  it("returns 1 for the same currency", () => {
    expect(conversionRate("INR", "INR")).toBe(1);
    expect(conversionRate("USD", "USD")).toBe(1);
  });

  it("converts using the reference rates in both directions", () => {
    expect(conversionRate("INR", "USD")).toBeCloseTo(0.012, 6);
    expect(conversionRate("USD", "INR")).toBeCloseTo(1 / 0.012, 6);
  });

  it("round-trips a value back to itself within a cent", () => {
    const usd = convertAmount(1000, "INR", "USD");
    expect(convertAmount(usd, "USD", "INR")).toBeCloseTo(1000, 2);
  });

  it("falls back to the default currency for unknown codes", () => {
    expect(currencyByCode("NOPE").code).toBe("INR");
    expect(conversionRate("NOPE", "INR")).toBe(1);
  });
});

describe("roundMoney", () => {
  it("rounds to two decimals", () => {
    expect(roundMoney(1.239)).toBe(1.24);
    expect(roundMoney(12.3456)).toBe(12.35);
    expect(roundMoney(12)).toBe(12);
  });

  it("treats invalid input as zero", () => {
    expect(roundMoney(Number.NaN)).toBe(0);
  });
});

describe("convertAmount", () => {
  it("converts and rounds to cents", () => {
    expect(convertAmount(9640, "INR", "USD")).toBe(115.68);
    expect(convertAmount(100, "USD", "INR")).toBe(8333.33);
  });

  it("leaves amounts untouched in the same currency", () => {
    expect(convertAmount(499.99, "USD", "USD")).toBe(499.99);
  });

  it("preserves the sign", () => {
    expect(convertAmount(-100, "USD", "INR")).toBe(-8333.33);
  });

  it("uses the same stored precision for zero-decimal currencies", () => {
    expect(convertAmount(1000, "USD", "JPY")).toBe(151515.15);
  });

  it("never rounds a real amount down to zero", () => {
    // 1 IDR is far below one US cent, but a zeroed transaction is invalid.
    expect(convertAmount(1, "IDR", "USD")).toBe(0.01);
    expect(convertAmount(-1, "IDR", "USD")).toBe(-0.01);
    expect(convertAmount(0.01, "VND", "USD")).toBe(0.01);
    expect(convertAmount(0, "IDR", "USD")).toBe(0);
  });

  it("keeps very large amounts finite", () => {
    const converted = convertAmount(1_000_000_000, "INR", "USD");
    expect(Number.isFinite(converted)).toBe(true);
    expect(converted).toBe(12_000_000);
  });
});

describe("isCurrencyCode", () => {
  it("accepts known codes in any case", () => {
    expect(isCurrencyCode("usd")).toBe(true);
    expect(isCurrencyCode("INR")).toBe(true);
  });

  it("rejects unknown and non-string values", () => {
    expect(isCurrencyCode("XYZ")).toBe(false);
    expect(isCurrencyCode(null)).toBe(false);
    expect(isCurrencyCode(123)).toBe(false);
  });
});
