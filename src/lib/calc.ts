import type { Budget, Goal, Reminder, Transaction } from "../types";
import {
  clamp,
  currentMonthKey,
  lastMonthKeys,
  money,
  monthKeyOf,
  monthShort,
  parseDate,
} from "./format";

export interface MonthStats {
  income: number;
  expense: number;
  net: number;
}

export interface MonthPoint extends MonthStats {
  key: string;
}

export interface BudgetProgress extends Budget {
  spent: number;
  pct: number;
  remaining: number;
  over: boolean;
}

export interface GoalProgress {
  pct: number;
  daysLeft: number | null;
  done: boolean;
  monthlyNeeded: number | null;
}

export type InsightPriority = "high" | "med" | "low";

export interface Insight {
  key: string;
  priority: InsightPriority;
  emoji: string;
  title: string;
  detail: string;
  body: string;
}

export const sum = (items: Transaction[]): number =>
  items.reduce((total, item) => total + Number(item.amount || 0), 0);

export const ofType = (items: Transaction[], type: Transaction["type"]): Transaction[] =>
  items.filter((item) => item.type === type);

export const inMonth = (items: Transaction[], key: string): Transaction[] =>
  items.filter((item) => monthKeyOf(item.date) === key);

export function monthStats(items: Transaction[], key = currentMonthKey()): MonthStats {
  const month = inMonth(items, key);
  const income = sum(ofType(month, "income"));
  const expense = sum(ofType(month, "expense"));
  return { income, expense, net: income - expense };
}

export function allTimeStats(items: Transaction[]): MonthStats {
  const income = sum(ofType(items, "income"));
  const expense = sum(ofType(items, "expense"));
  return { income, expense, net: income - expense };
}

/** Share of income kept, in percent. */
export function savingsRate(stats: MonthStats): number {
  return stats.income > 0 ? Math.round(((stats.income - stats.expense) / stats.income) * 100) : 0;
}

export function trend(items: Transaction[], count = 6): MonthPoint[] {
  return lastMonthKeys(count).map((key) => ({ key, ...monthStats(items, key) }));
}

export function categoryTotals(items: Transaction[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of items) {
    const category = item.category || "Other";
    totals[category] = (totals[category] || 0) + Number(item.amount || 0);
  }
  return totals;
}

export function topCategories(
  items: Transaction[],
  count = 5,
): { name: string; value: number; color?: string }[] {
  return Object.entries(categoryTotals(items))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count);
}

/** Budget usage is computed against the current month's expenses in that category. */
export function budgetProgress(budgets: Budget[], transactions: Transaction[]): BudgetProgress[] {
  const monthExpenses = ofType(inMonth(transactions, currentMonthKey()), "expense");
  return budgets.map((budget) => {
    const spent = sum(monthExpenses.filter((tx) => tx.category === budget.category));
    const limit = Number(budget.amount || 0);
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    return {
      ...budget,
      spent,
      pct,
      remaining: limit - spent,
      over: spent > limit,
    };
  });
}

export function goalProgress(goal: Goal, today = new Date()): GoalProgress {
  const target = Number(goal.targetAmount || 0);
  const saved = Number(goal.savedAmount || 0);
  const pct = target > 0 ? clamp((saved / target) * 100, 0, 100) : 0;
  const targetDate = parseDate(goal.targetDate);
  const daysLeft = targetDate
    ? Math.ceil((targetDate.getTime() - today.getTime()) / 86_400_000)
    : null;
  const remaining = target - saved;
  const monthsLeft =
    daysLeft != null && daysLeft > 0 ? Math.max(1, Math.ceil(daysLeft / 30)) : null;
  return {
    pct,
    daysLeft,
    done: saved >= target && target > 0,
    monthlyNeeded:
      monthsLeft != null && remaining > 0 ? Math.round((remaining / monthsLeft) * 100) / 100 : null,
  };
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

/** Next date this recurring reminder is due, clamped to the 28th. */
export function nextDue(reminder: Reminder, today = new Date()): Date {
  const day = clamp(Number(reminder.day) || 1, 1, 28);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let due = new Date(today.getFullYear(), today.getMonth(), day);
  if (due.getTime() < startOfToday.getTime()) due = addMonths(due, 1);
  if (reminder.lastPaidDate) {
    const paid = parseDate(reminder.lastPaidDate);
    if (!paid) return due;
    if (
      paid.getFullYear() === due.getFullYear() &&
      paid.getMonth() === due.getMonth()
    ) {
      due = addMonths(due, 1);
    }
  }
  return due;
}

export function daysUntil(date: Date, today = new Date()): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((date.getTime() - start.getTime()) / 86_400_000);
}

/** Full rule-based insights engine (runs client-side, no data leaves the browser). */
export function buildInsights(
  data: {
    transactions: Transaction[];
    budgets: Budget[];
    goals: Goal[];
    reminders: Reminder[];
  },
  today = new Date(),
): Insight[] {
  const { transactions, budgets, goals, reminders } = data;
  const insights: Insight[] = [];
  const monthExpenses = ofType(inMonth(transactions, currentMonthKey()), "expense");
  const stats = monthStats(transactions);
  const rate = savingsRate(stats);

  if (transactions.length === 0) {
    insights.push({
      key: "welcome",
      priority: "med",
      emoji: "👋",
      title: "Welcome to FinNova!",
      detail: "Add your first income or expense to unlock insights",
      body: "Once you log a few transactions, FinNova will help you spot trends, catch overspending and reach your goals faster.",
    });
    return insights;
  }

  if (stats.income === 0 && monthExpenses.length > 0) {
    insights.push({
      key: "no-income",
      priority: "high",
      emoji: "🧾",
      title: "No income recorded this month",
      detail: "Expenses are logged without matching income",
      body: "Add this month's salary, allowance or freelance income so your savings rate and net figures are accurate.",
    });
  } else if (stats.income > 0 && stats.net < 0) {
    insights.push({
      key: "month-deficit",
      priority: "high",
      emoji: "⚠️",
      title: "Monthly deficit",
      detail: "Spending exceeded income",
      body: `Your spending (${money(stats.expense)}) exceeded your income (${money(
        stats.income,
      )}) by ${money(-stats.net)}. Trim one flexible category like Food or Shopping to get back on track.`,
    });
  } else if (stats.income > 0 && rate < 10) {
    insights.push({
      key: "low-savings-rate",
      priority: "high",
      emoji: "🐢",
      title: "Savings rate under 10%",
      detail: `You're saving only ${rate}% of income`,
      body: `Aim to save at least 10%–20% of your income. Review Entertainment, Shopping and Food for small weekly cuts. A ${money(
        stats.income * 0.05,
      )} monthly shift would lift your rate to ~${rate + 5}%.`,
    });
  } else if (stats.income > 0 && rate >= 20) {
    insights.push({
      key: "great-savings-rate",
      priority: "low",
      emoji: "🏆",
      title: `Strong savings rate — ${rate}%`,
      detail: "You're keeping a healthy share of income",
      body: `You kept ${money(stats.net)} this month. Consider moving part of it into a goal or an emergency fund so it compounds instead of sitting idle.`,
    });
  }

  const progress = budgetProgress(budgets, transactions);
  const overBudget = progress.filter((b) => b.over);
  const closeToLimit = progress
    .filter((b) => !b.over && b.pct >= 80)
    .sort((a, b) => b.pct - a.pct);

  overBudget.forEach((b) => {
    insights.push({
      key: `budget-over-${b.id}`,
      priority: "high",
      emoji: "🚨",
      title: `${b.category} over budget`,
      detail: `${money(-b.remaining)} over limit`,
      body: `You've spent ${money(b.spent)} on ${b.category}; your budget is ${money(
        b.amount,
      )} (${Math.round(b.pct)}%). Reduce further ${b.category.toLowerCase()} spending for the rest of the month.`,
    });
  });

  closeToLimit.forEach((b) => {
    insights.push({
      key: `budget-close-${b.id}`,
      priority: "med",
      emoji: "🟠",
      title: `${b.category} nearing its limit`,
      detail: `${Math.round(b.pct)}% of budget used`,
      body: `You've used ${Math.round(b.pct)}% of your ${b.category} budget (${money(
        b.amount,
      )}). Only ${money(b.remaining)} left this month.`,
    });
  });

  const topCategory = topCategories(monthExpenses, 1)[0];
  if (topCategory && stats.expense > 0 && topCategory.value / stats.expense > 0.35) {
    const share = Math.round((topCategory.value / stats.expense) * 100);
    insights.push({
      key: "top-category-share",
      priority: "med",
      emoji: "🍕",
      title: `${topCategory.name} is ${share}% of your spending`,
      detail: "One category dominates this month",
      body: `${money(topCategory.value)} of ${money(
        stats.expense,
      )} went to ${topCategory.name}. A weekly cap of ${money(
        Math.max(20, topCategory.value * 0.25),
      )} would bring this share closer to 25%.`,
    });
  }

  const months = trend(transactions, 3);
  if (months.length >= 3) {
    const [first, second, third] = months;
    const average = (first.expense + second.expense) / 2;
    if (average > 0) {
      const change = ((third.expense - average) / average) * 100;
      if (change > 18) {
        insights.push({
          key: "spending-rise",
          priority: "med",
          emoji: "📈",
          title: "Spending on the rise",
          detail: `${Math.round(change)}% higher than your 2-month average`,
          body: `${money(third.expense)} this month vs a ~${money(
            average,
          )} average. Check which categories grew to spot the driver.`,
        });
      } else if (change < -15) {
        insights.push({
          key: "spending-drop",
          priority: "low",
          emoji: "📉",
          title: "Spending down — nice work",
          detail: `${Math.round(Math.abs(change))}% below your 2-month average`,
          body: `Great momentum! Consider putting the freed-up ${money(
            average - third.expense,
          )} into a savings goal.`,
        });
      }
    }
  }

  goals.forEach((goal) => {
    const progressInfo = goalProgress(goal, today);
    if (progressInfo.done) {
      insights.push({
        key: `goal-done-${goal.id}`,
        priority: "med",
        emoji: "🎉",
        title: `${goal.name} goal complete!`,
        detail: "Target reached",
        body: `You hit your ${goal.name} target. Celebrate smart — roll the habit into your next goal.`,
      });
      return;
    }
    const remaining = Number(goal.targetAmount || 0) - Number(goal.savedAmount || 0);
    if (remaining <= 0 || !goal.targetDate) return;
    const perMonth = progressInfo.monthlyNeeded ?? 0;
    if (perMonth > stats.income * 0.5 && stats.income > 0) {
      insights.push({
        key: `goal-ambitious-${goal.id}`,
        priority: "med",
        emoji: "🎯",
        title: `${goal.name} may be ambitious`,
        detail: `Needs ~${money(perMonth)}/month`,
        body: `To finish by ${(parseDate(goal.targetDate) ?? new Date()).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })}, you'd need about ${money(
          perMonth,
        )} per month. Extend the date or set up a small auto-transfer.`,
      });
    } else {
      insights.push({
        key: `goal-healthy-${goal.id}`,
        priority: "low",
        emoji: "⏱️",
        title: `${goal.name} — on track`,
        detail: perMonth > 0 ? `~${money(perMonth)}/month to finish` : "Keep going",
        body: `Keep contributing ~${money(perMonth)} a month and you'll reach ${money(
          goal.targetAmount,
        )} on schedule.`,
      });
    }
  });

  reminders.forEach((reminder) => {
    const due = nextDue(reminder, today);
    const days = daysUntil(due, today);
    if (days <= 5) {
      insights.push({
        key: `reminder-${reminder.id}`,
        priority: days <= 2 ? "high" : "med",
        emoji: "🔔",
        title: `${reminder.title} due ${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}`,
        detail: `${money(reminder.amount || 0)} ${reminder.type === "bill" ? "bill" : "saving"}`,
        body:
          reminder.type === "bill"
            ? "Keep auto-pay on or schedule it now to avoid a late fee."
            : `Time to move ${money(reminder.amount || 0)} into your savings goal.`,
      });
    }
  });

  const rank: Record<InsightPriority, number> = { high: 0, med: 1, low: 2 };
  return insights.sort(
    (a, b) => rank[a.priority] - rank[b.priority] || a.title.localeCompare(b.title),
  );
}

export interface ReportRow extends MonthStats {
  key: string;
  label: string;
  savingsRate: number;
}

export function reportRows(transactions: Transaction[], count = 6): ReportRow[] {
  return trend(transactions, count).map((point) => ({
    key: point.key,
    label: monthShort(point.key),
    income: point.income,
    expense: point.expense,
    net: point.net,
    savingsRate: savingsRate(point),
  }));
}
