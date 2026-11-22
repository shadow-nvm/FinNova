import { applyAmountUpdates, amountUpdates } from "../lib/convertAmounts";
import type {
  Budget,
  BudgetInput,
  Goal,
  GoalInput,
  Reminder,
  ReminderInput,
  Transaction,
  TxInput,
} from "../types";

interface DemoState {
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  reminders: Reminder[];
}

const STORAGE_KEY = "finnova_demo_v2";

function makeId(): string {
  return `demo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function dateInMonth(monthsAgo: number, day: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day, 10, 0, 0);
  return d.toISOString();
}

function futureDate(monthsAhead: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + monthsAhead, 15)
    .toISOString()
    .slice(0, 10);
}

function rng(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seed(): DemoState {
  const random = rng(20261115);
  const now = new Date();
  const transactions: Transaction[] = [];
  const budgets: Budget[] = [];
  const goals: Goal[] = [];
  const reminders: Reminder[] = [];

  const expenses: { category: string; base: number; count: number; notes: string[] }[] = [
    { category: "Food", base: 9_500, count: 8, notes: ["Groceries", "Dinner out", "Coffee & snacks"] },
    { category: "Transport", base: 3_200, count: 4, notes: ["Metro card", "Fuel", "Cab"] },
    { category: "Shopping", base: 5_800, count: 3, notes: ["Online order", "Clothing", "Home supplies"] },
    { category: "Entertainment", base: 2_100, count: 2, notes: ["Movie night", "Streaming"] },
    { category: "Utilities", base: 3_600, count: 3, notes: ["Electricity", "Internet", "Mobile recharge"] },
    { category: "Health", base: 1_700, count: 2, notes: ["Pharmacy", "Gym"] },
    { category: "Education", base: 1_400, count: 1, notes: ["Course material"] },
    { category: "Travel", base: 2_000, count: 1, notes: ["Weekend trip"] },
  ];

  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo--) {
    transactions.push({
      id: makeId(),
      type: "income",
      category: "Salary",
      amount: 92_000,
      date: dateInMonth(monthsAgo, 1),
      note: "Monthly salary",
    });
    if (random() > 0.35) {
      transactions.push({
        id: makeId(),
        type: "income",
        category: "Freelance",
        amount: Math.round(4_000 + random() * 9_000),
        date: dateInMonth(monthsAgo, 12 + Math.floor(random() * 8)),
        note: "Freelance project",
      });
    }
    for (const bucket of expenses) {
      const perExpense = bucket.base / bucket.count;
      const lastDay =
        monthsAgo === 0
          ? Math.max(1, new Date().getDate())
          : new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0).getDate();
      for (let i = 0; i < bucket.count; i++) {
        const day = Math.min(lastDay, 2 + Math.floor(random() * 25));
        transactions.push({
          id: makeId(),
          type: "expense",
          category: bucket.category,
          amount: Math.max(120, Math.round(perExpense * (0.7 + random() * 0.7))),
          date: dateInMonth(monthsAgo, day),
          note: bucket.notes[Math.floor(random() * bucket.notes.length)],
        });
      }
    }
  }

  const budgetPlan: [string, number][] = [
    ["Food", 12_000],
    ["Transport", 4_000],
    ["Shopping", 7_000],
    ["Entertainment", 2_500],
    ["Utilities", 4_500],
    ["Health", 2_000],
  ];
  budgetPlan.forEach(([category, limit]) =>
    budgets.push({ id: makeId(), category, amount: limit, period: "monthly" }),
  );

  goals.push(
    {
      id: makeId(),
      name: "Emergency fund",
      icon: "🛟",
      targetAmount: 5_00_000,
      savedAmount: 1_85_000,
      targetDate: futureDate(8),
    },
    {
      id: makeId(),
      name: "Japan trip",
      icon: "✈️",
      targetAmount: 2_50_000,
      savedAmount: 42_000,
      targetDate: futureDate(12),
    },
    {
      id: makeId(),
      name: "New laptop",
      icon: "💻",
      targetAmount: 1_20_000,
      savedAmount: 68_000,
      targetDate: futureDate(4),
    },
  );

  const reminderPlan: Omit<Reminder, "id">[] = [
    { type: "bill", title: "Apartment rent", amount: 18_000, day: 5, lastPaidDate: null },
    { type: "bill", title: "Electricity bill", amount: 2_400, day: 18, lastPaidDate: null },
    { type: "bill", title: "Internet / Wi-Fi", amount: 999, day: 10, lastPaidDate: null },
    { type: "bill", title: "Streaming subscription", amount: 649, day: 12, lastPaidDate: null },
    { type: "saving", title: "Auto top-up to emergency fund", amount: 5_000, day: 27, lastPaidDate: null },
  ];
  reminderPlan.forEach((reminder) => reminders.push({ ...reminder, id: makeId() }));

  return {
    transactions,
    budgets,
    goals,
    reminders: reminders.map((r) => ({ ...r, day: Math.min(r.day, 28) })),
  };
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DemoState>;
      if (Array.isArray(parsed.transactions) && Array.isArray(parsed.budgets)) {
        return {
          transactions: parsed.transactions ?? [],
          budgets: parsed.budgets ?? [],
          goals: parsed.goals ?? [],
          reminders: parsed.reminders ?? [],
        };
      }
    }
  } catch {
    /* fall through to a fresh seed */
  }
  const fresh = seed();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    /* storage may be unavailable; keep in memory */
  }
  return fresh;
}

const EMPTY_STATE: DemoState = {
  transactions: [],
  budgets: [],
  goals: [],
  reminders: [],
};

// Nothing is read from or written to localStorage until the dev-only demo is
// actually opened. Production accounts always go through Cloud Firestore.
let seeded = false;
let state: DemoState = EMPTY_STATE;
const listeners = new Set<() => void>();

function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  state = load();
  listeners.forEach((listener) => listener());
}

function commit(next: DemoState): void {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
  listeners.forEach((listener) => listener());
}

export const demoStore = {
  /** Seeds the sample workspace on first use (never called in production). */
  ensure(): void {
    ensureSeeded();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot(): DemoState {
    return state;
  },
  convertAmounts(from: string, to: string): void {
    if (from === to) return;
    commit(applyAmountUpdates(state, amountUpdates(state, from, to)));
  },
  addTransaction(input: TxInput): void {
    commit({
      ...state,
      transactions: [...state.transactions, { ...input, id: makeId() }],
    });
  },
  updateTransaction(id: string, patch: Partial<TxInput>): void {
    commit({
      ...state,
      transactions: state.transactions.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)),
    });
  },
  removeTransaction(id: string): void {
    commit({ ...state, transactions: state.transactions.filter((tx) => tx.id !== id) });
  },
  addManyTransactions(inputs: TxInput[]): void {
    commit({
      ...state,
      transactions: [...state.transactions, ...inputs.map((input) => ({ ...input, id: makeId() }))],
    });
  },
  addBudget(input: BudgetInput): void {
    commit({ ...state, budgets: [...state.budgets, { ...input, id: makeId() }] });
  },
  updateBudget(id: string, patch: Partial<BudgetInput>): void {
    commit({
      ...state,
      budgets: state.budgets.map((budget) =>
        budget.id === id ? { ...budget, ...patch } : budget,
      ),
    });
  },
  removeBudget(id: string): void {
    commit({ ...state, budgets: state.budgets.filter((budget) => budget.id !== id) });
  },
  addGoal(input: GoalInput): void {
    commit({ ...state, goals: [...state.goals, { ...input, savedAmount: 0, id: makeId() }] });
  },
  updateGoal(id: string, patch: Partial<GoalInput> & { savedAmount?: number }): void {
    commit({
      ...state,
      goals: state.goals.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)),
    });
  },
  removeGoal(id: string): void {
    commit({ ...state, goals: state.goals.filter((goal) => goal.id !== id) });
  },
  addReminder(input: ReminderInput): void {
    commit({ ...state, reminders: [...state.reminders, { ...input, id: makeId() }] });
  },
  updateReminder(id: string, patch: Partial<ReminderInput>): void {
    commit({
      ...state,
      reminders: state.reminders.map((reminder) =>
        reminder.id === id ? { ...reminder, ...patch } : reminder,
      ),
    });
  },
  removeReminder(id: string): void {
    commit({ ...state, reminders: state.reminders.filter((reminder) => reminder.id !== id) });
  },
};
