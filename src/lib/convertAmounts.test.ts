import { describe, expect, it } from "vitest";
import { amountUpdates, applyAmountUpdates, type AmountData } from "./convertAmounts";
import type { Budget, Goal, Reminder, Transaction } from "../types";

function transaction(id: string, amount: number): Transaction {
  return { id, type: "expense", category: "Food", amount, date: "2026-01-15", note: "Lunch" };
}

function budget(id: string, amount: number): Budget {
  return { id, category: "Food", amount, period: "monthly" };
}

function goal(id: string, targetAmount: number, savedAmount: number): Goal {
  return {
    id,
    name: "Japan trip",
    icon: "✈️",
    targetAmount,
    savedAmount,
    targetDate: "2026-12-15",
  };
}

function reminder(id: string, amount: number): Reminder {
  return { id, type: "bill", title: "Rent", amount, day: 5, lastPaidDate: null };
}

function sample(): AmountData {
  return {
    transactions: [transaction("t1", 1_000)],
    budgets: [budget("b1", 5_000)],
    goals: [goal("g1", 1_00_000, 25_000)],
    reminders: [reminder("r1", 800)],
  };
}

describe("amountUpdates", () => {
  it("converts every money field with the reference rates", () => {
    expect(amountUpdates(sample(), "INR", "USD")).toEqual([
      { collection: "transactions", id: "t1", data: { amount: 12 } },
      { collection: "budgets", id: "b1", data: { amount: 60 } },
      { collection: "goals", id: "g1", data: { targetAmount: 1_200, savedAmount: 300 } },
      { collection: "reminders", id: "r1", data: { amount: 9.6 } },
    ]);
  });

  it("returns one update per record and only the money fields of a goal", () => {
    const updates = amountUpdates(sample(), "INR", "USD");
    expect(updates).toHaveLength(4);
    const goalUpdate = updates.find((update) => update.collection === "goals");
    expect(Object.keys(goalUpdate?.data ?? {}).sort()).toEqual(["savedAmount", "targetAmount"]);
  });

  it("leaves amounts unchanged in the same currency", () => {
    const updates = amountUpdates(sample(), "INR", "INR");
    expect(updates.map((update) => update.data)).toEqual([
      { amount: 1_000 },
      { amount: 5_000 },
      { targetAmount: 1_00_000, savedAmount: 25_000 },
      { amount: 800 },
    ]);
  });
});

describe("applyAmountUpdates", () => {
  it("rewrites money without touching ids, dates, notes or goals' other fields", () => {
    const data = sample();
    const converted = applyAmountUpdates(data, amountUpdates(data, "INR", "USD"));

    expect(converted.transactions[0]).toEqual({ ...transaction("t1", 1_000), amount: 12 });
    expect(converted.transactions[0].date).toBe("2026-01-15");
    expect(converted.transactions[0].note).toBe("Lunch");
    expect(converted.budgets[0]).toMatchObject({ id: "b1", category: "Food", amount: 60 });
    expect(converted.goals[0]).toMatchObject({
      id: "g1",
      name: "Japan trip",
      targetAmount: 1_200,
      savedAmount: 300,
      targetDate: "2026-12-15",
    });
    expect(converted.reminders[0]).toMatchObject({
      id: "r1",
      title: "Rent",
      amount: 9.6,
      lastPaidDate: null,
    });
    // The input is not mutated.
    expect(data.transactions[0].amount).toBe(1_000);
  });

  it("returns a copy even when there is nothing to convert", () => {
    const data = sample();
    const same = applyAmountUpdates(data, amountUpdates(data, "INR", "INR"));
    expect(same.transactions[0].amount).toBe(1_000);
    expect(same).not.toBe(data);
  });
});
