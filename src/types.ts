export type TxType = "income" | "expense";

export interface Transaction {
  id: string;
  ownerId?: string;
  type: TxType;
  category: string;
  amount: number;
  /** ISO date-time string (legacy) or date-only string. */
  date: string;
  note?: string;
  createdAt?: unknown;
}

export interface Budget {
  id: string;
  ownerId?: string;
  category: string;
  amount: number;
  period: "monthly";
  createdAt?: unknown;
}

export interface Goal {
  id: string;
  ownerId?: string;
  name: string;
  icon: string;
  targetAmount: number;
  savedAmount: number;
  targetDate?: string | null;
  createdAt?: unknown;
}

export interface Reminder {
  id: string;
  ownerId?: string;
  type: "bill" | "saving";
  title: string;
  amount: number;
  /** Day of month the reminder is due (1–28). */
  day: number;
  lastPaidDate?: string | null;
  createdAt?: unknown;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
}

export type CollectionName = "transactions" | "budgets" | "goals" | "reminders";

export type TxInput = Pick<Transaction, "type" | "category" | "amount" | "date" | "note">;
export type BudgetInput = Pick<Budget, "category" | "amount" | "period">;
export type GoalInput = Pick<Goal, "name" | "icon" | "targetAmount" | "targetDate"> & {
  savedAmount?: number;
};
export type ReminderInput = Pick<Reminder, "type" | "title" | "amount" | "day"> & {
  lastPaidDate?: string | null;
};
