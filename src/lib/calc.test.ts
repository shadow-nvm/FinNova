import { describe, expect, it } from "vitest";
import { buildInsights, goalProgress } from "./calc";
import type { Goal, Transaction } from "../types";

function goal(patch: Partial<Goal> = {}): Goal {
  return {
    id: "g1",
    name: "Japan trip",
    icon: "✈️",
    targetAmount: 1_000,
    savedAmount: 100,
    targetDate: null,
    ...patch,
  };
}

const income: Transaction = {
  id: "t1",
  type: "income",
  category: "Salary",
  amount: 1_000,
  date: "2026-06-01T12:00:00.000Z",
  note: "",
};

describe("goalProgress", () => {
  it("counts whole calendar days and needs no monthly figure on the due date", () => {
    const progress = goalProgress(goal({ targetDate: "2026-12-31" }), new Date(2026, 11, 31, 18));
    expect(progress.daysLeft).toBe(0);
    expect(progress.monthlyNeeded).toBeNull();
    expect(progress.done).toBe(false);
  });

  it("reports an overdue target without inventing a monthly figure", () => {
    const progress = goalProgress(goal({ targetDate: "2026-01-01" }), new Date(2026, 5, 15));
    expect(progress.daysLeft).toBeLessThan(0);
    expect(progress.monthlyNeeded).toBeNull();
  });

  it("spreads the remaining amount over the months left", () => {
    const progress = goalProgress(goal({ targetDate: "2026-03-01" }), new Date(2026, 0, 1));
    expect(progress.daysLeft).toBe(59);
    expect(progress.monthlyNeeded).toBeCloseTo(450, 2);
  });

  it("detects a completed goal", () => {
    expect(goalProgress(goal({ savedAmount: 1_000 })).done).toBe(true);
  });
});

describe("buildInsights", () => {
  it("reports an overdue goal instead of a zero monthly contribution", () => {
    const insights = buildInsights(
      {
        transactions: [income],
        budgets: [],
        goals: [goal({ targetDate: "2026-01-01" })],
        reminders: [],
      },
      new Date(2026, 5, 15),
    );
    const due = insights.find((insight) => insight.key === "goal-due-g1");
    expect(due?.detail).toBe("Target date has passed");
    expect(due?.title).toContain("needs");
    expect(insights.some((insight) => insight.key === "goal-healthy-g1")).toBe(false);
  });

  it("says the target is today when it is due today", () => {
    const insights = buildInsights(
      {
        transactions: [income],
        budgets: [],
        goals: [goal({ targetDate: "2026-06-15" })],
        reminders: [],
      },
      new Date(2026, 5, 15),
    );
    expect(insights.find((insight) => insight.key === "goal-due-g1")?.detail).toBe(
      "Target date is today",
    );
  });
});
