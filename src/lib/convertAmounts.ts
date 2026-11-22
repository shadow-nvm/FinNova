import { convertAmount } from "./currencies";
import type { Budget, Goal, Reminder, Transaction } from "../types";

export type AmountCollection = "transactions" | "budgets" | "goals" | "reminders";

/** One record whose money fields must be rewritten. */
export interface AmountUpdate {
  collection: AmountCollection;
  id: string;
  /** Only the money fields, already converted. */
  data: Record<string, number>;
}

export interface AmountData {
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  reminders: Reminder[];
}

/**
 * The money-bearing fields of every record, as one list: Firestore writes, the
 * demo workspace and the tests all read this mapping, so they cannot disagree
 * about which fields hold amounts.
 */
export function amountUpdates(data: AmountData, from: string, to: string): AmountUpdate[] {
  const updates: AmountUpdate[] = [];
  for (const tx of data.transactions) {
    updates.push({
      collection: "transactions",
      id: tx.id,
      data: { amount: convertAmount(tx.amount, from, to) },
    });
  }
  for (const budget of data.budgets) {
    updates.push({
      collection: "budgets",
      id: budget.id,
      data: { amount: convertAmount(budget.amount, from, to) },
    });
  }
  for (const goal of data.goals) {
    updates.push({
      collection: "goals",
      id: goal.id,
      data: {
        targetAmount: convertAmount(goal.targetAmount, from, to),
        savedAmount: convertAmount(goal.savedAmount, from, to),
      },
    });
  }
  for (const reminder of data.reminders) {
    updates.push({
      collection: "reminders",
      id: reminder.id,
      data: { amount: convertAmount(reminder.amount, from, to) },
    });
  }
  return updates;
}

/** Applies `amountUpdates` to the local data, leaving every other field alone. */
export function applyAmountUpdates(data: AmountData, updates: AmountUpdate[]): AmountData {
  const patches = new Map(
    updates.map((update) => [`${update.collection}/${update.id}`, update.data]),
  );
  const patchFor = (collection: AmountCollection, id: string): Record<string, number> =>
    patches.get(`${collection}/${id}`) ?? {};
  return {
    transactions: data.transactions.map((tx) => ({ ...tx, ...patchFor("transactions", tx.id) })),
    budgets: data.budgets.map((budget) => ({ ...budget, ...patchFor("budgets", budget.id) })),
    goals: data.goals.map((goal) => ({ ...goal, ...patchFor("goals", goal.id) })),
    reminders: data.reminders.map((reminder) => ({
      ...reminder,
      ...patchFor("reminders", reminder.id),
    })),
  };
}
