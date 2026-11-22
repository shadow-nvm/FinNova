import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";
import { amountUpdates } from "../lib/convertAmounts";
import { db, firebaseEnabled, friendlyError } from "../lib/firebase";
import { normalizeDate } from "../lib/format";
import type {
  Budget,
  BudgetInput,
  CollectionName,
  Goal,
  GoalInput,
  Reminder,
  ReminderInput,
  Transaction,
  TxInput,
} from "../types";
import { demoStore } from "./demo";

const COLLECTIONS: CollectionName[] = ["transactions", "budgets", "goals", "reminders"];
/** Firestore allows 500 writes per transaction and per batch; stay below both. */
const TRANSACTION_WRITE_LIMIT = 500;
const BATCH_WRITE_LIMIT = 400;
/** A single batch commits atomically, so imports of up to this size cannot be
 *  left half-written; bigger files fall back to several batches. */
const IMPORT_BATCH_LIMIT = 499;
const CONVERSION_CONFLICT = "finnova/conversion-conflict";
const CONVERSION_INCOMPLETE = "finnova/conversion-incomplete";
const EMPTY = {
  transactions: [] as Transaction[],
  budgets: [] as Budget[],
  goals: [] as Goal[],
  reminders: [] as Reminder[],
};

type AppData = typeof EMPTY;

interface DataContextValue extends AppData {
  loading: boolean;
  error: string | null;
  /** True while Firestore is serving from its offline cache. */
  fromCache: boolean;
  clearError: () => void;
  retry: () => void;
  addTransaction: (input: TxInput) => Promise<void>;
  updateTransaction: (id: string, input: TxInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  importTransactions: (inputs: TxInput[]) => Promise<number>;
  addBudget: (input: BudgetInput) => Promise<void>;
  updateBudget: (id: string, input: BudgetInput) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  addGoal: (input: GoalInput) => Promise<void>;
  updateGoal: (id: string, patch: Partial<GoalInput> & { savedAmount?: number }) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addReminder: (input: ReminderInput) => Promise<void>;
  updateReminder: (id: string, patch: Partial<ReminderInput>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  /** Converts every stored amount from one currency to another. */
  convertCurrency: (from: string, to: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

function normalizeTransaction(id: string, raw: Record<string, unknown>): Transaction {
  return {
    ...(raw as unknown as Transaction),
    id,
    type: raw.type === "income" ? "income" : "expense",
    category: String(raw.category || "Other"),
    amount: Number(raw.amount || 0),
    date: normalizeDate(raw.date),
    note: typeof raw.note === "string" ? raw.note : "",
  };
}

function normalizeBudget(id: string, raw: Record<string, unknown>): Budget {
  return {
    ...(raw as unknown as Budget),
    id,
    category: String(raw.category || "Other"),
    amount: Number(raw.amount || 0),
    period: "monthly",
  };
}

function normalizeGoal(id: string, raw: Record<string, unknown>): Goal {
  return {
    ...(raw as unknown as Goal),
    id,
    name: String(raw.name || "Goal"),
    icon: String(raw.icon || "🎯"),
    targetAmount: Number(raw.targetAmount || 0),
    savedAmount: Number(raw.savedAmount || 0),
    targetDate: raw.targetDate ? normalizeDate(raw.targetDate).slice(0, 10) : null,
  };
}

function normalizeReminder(id: string, raw: Record<string, unknown>): Reminder {
  return {
    ...(raw as unknown as Reminder),
    id,
    type: raw.type === "saving" ? "saving" : "bill",
    title: String(raw.title || "Reminder"),
    amount: Number(raw.amount || 0),
    day: Number(raw.day || 1),
    lastPaidDate: raw.lastPaidDate ? normalizeDate(raw.lastPaidDate).slice(0, 10) : null,
  };
}

function normalize(name: CollectionName, raw: Record<string, unknown>, id: string) {
  switch (name) {
    case "transactions":
      return normalizeTransaction(id, raw);
    case "budgets":
      return normalizeBudget(id, raw);
    case "goals":
      return normalizeGoal(id, raw);
    case "reminders":
      return normalizeReminder(id, raw);
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isDemo } = useAuth();
  const demoData = useSyncExternalStore(
    demoStore.subscribe,
    demoStore.snapshot,
    demoStore.snapshot,
  );
  const [remote, setRemote] = useState<AppData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const { transactions, budgets, goals, reminders } = isDemo ? demoData : remote;

  // The demo workspace is lazy: seeding happens only if it is actually opened.
  useEffect(() => {
    if (isDemo) demoStore.ensure();
  }, [isDemo]);

  useEffect(() => {
    if (isDemo) {
      setLoading(false);
      return;
    }
    if (!firebaseEnabled || !db || !user) {
      setRemote(EMPTY);
      setLoading(false);
      setFromCache(false);
      return;
    }
    setLoading(true);
    setRemote(EMPTY);
    setError(null);
    const resolved = new Set<CollectionName>();
    const cacheState = new Map<CollectionName, boolean>();
    const database = db;
    const subscriptions = COLLECTIONS.map((name) =>
      onSnapshot(
        query(collection(database, name), where("ownerId", "==", user.id)),
        (snapshot) => {
          const items = snapshot.docs.map((entry) =>
            normalize(name, entry.data() as Record<string, unknown>, entry.id),
          );
          setRemote((previous) => ({
            ...previous,
            [name]: items,
          }));
          cacheState.set(name, snapshot.metadata.fromCache);
          setFromCache([...cacheState.values()].some(Boolean));
          resolved.add(name);
          if (resolved.size === COLLECTIONS.length) setLoading(false);
        },
        (snapshotError) => {
          console.error(`[FinNova] onSnapshot:${name}`, snapshotError);
          setError(friendlyError(snapshotError));
          resolved.add(name);
          if (resolved.size === COLLECTIONS.length) setLoading(false);
        },
      ),
    );
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [user, isDemo, retryToken]);

  const fail = useCallback((cause: unknown): never => {
    console.error("[FinNova data error]", cause);
    const message = friendlyError(cause);
    setError(message);
    throw new Error(message);
  }, []);

  const requireUid = useCallback((): string => {
    if (!user) throw new Error("Not signed in yet — please wait a moment and try again.");
    return user.id;
  }, [user]);

  const clearError = useCallback(() => setError(null), []);

  /** Re-subscribes to Firestore after a permission/network failure. */
  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRemote(EMPTY);
    setRetryToken((token) => token + 1);
  }, []);

  const convertCurrency = useCallback(
    async (from: string, to: string) => {
      if (from === to) return;
      if (isDemo) {
        demoStore.convertAmounts(from, to);
        return;
      }
      try {
        const uid = requireUid();
        const database = db!;
        const accountRef = doc(database, "users", uid);
        const updates = amountUpdates({ transactions, budgets, goals, reminders }, from, to);
        // One transaction can hold the currency claim plus every amount write
        // for all but very large accounts, which makes the whole conversion
        // all-or-nothing. The claim itself always runs first: if another device
        // recorded a different stored currency, nothing is touched.
        const atomic = updates.length + 1 <= TRANSACTION_WRITE_LIMIT;

        await runTransaction(database, async (transaction) => {
          const account = await transaction.get(accountRef);
          const stored = account.data()?.storedCurrency;
          if (typeof stored === "string" && stored !== from) {
            throw Object.assign(
              new Error(
                `Your account already stores amounts in ${stored}, so this conversion was skipped to avoid converting twice.`,
              ),
              { code: CONVERSION_CONFLICT },
            );
          }
          transaction.set(
            accountRef,
            { storedCurrency: to, updatedAt: serverTimestamp() },
            { merge: true },
          );
          if (atomic) {
            updates.forEach((update) =>
              transaction.update(doc(database, update.collection, update.id), update.data),
            );
          }
        });

        if (atomic) return;
        // More writes than a transaction allows: the claim above still stops a
        // second conversion, but these batches cannot be atomic.
        try {
          for (let index = 0; index < updates.length; index += BATCH_WRITE_LIMIT) {
            const batch = writeBatch(database);
            updates.slice(index, index + BATCH_WRITE_LIMIT).forEach((update) => {
              batch.update(doc(database, update.collection, update.id), update.data);
            });
            await batch.commit();
          }
        } catch (cause) {
          throw Object.assign(
            new Error(
              `Conversion stopped after only some records were updated. Your account now records amounts in ${to} — reload, review the amounts, and do not convert again.`,
            ),
            { code: CONVERSION_INCOMPLETE, cause },
          );
        }
      } catch (cause) {
        const code = (cause as { code?: string } | null)?.code;
        if (code === CONVERSION_CONFLICT || code === CONVERSION_INCOMPLETE) throw cause;
        return fail(cause);
      }
    },
    [isDemo, requireUid, transactions, budgets, goals, reminders, fail],
  );

  const addTransaction = useCallback(
    async (input: TxInput) => {
      if (isDemo) return demoStore.addTransaction(input);
      try {
        await addDoc(collection(db!, "transactions"), {
          ...input,
          ownerId: requireUid(),
          createdAt: serverTimestamp(),
        });
      } catch (cause) {
        fail(cause);
      }
    },
    [isDemo, requireUid, fail],
  );

  const updateTransaction = useCallback(
    async (id: string, input: TxInput) => {
      if (isDemo) return demoStore.updateTransaction(id, input);
      try {
        await updateDoc(doc(db!, "transactions", id), { ...input });
      } catch (cause) {
        fail(cause);
      }
    },
    [isDemo, fail],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (isDemo) return demoStore.removeTransaction(id);
      try {
        await deleteDoc(doc(db!, "transactions", id));
      } catch (cause) {
        fail(cause);
      }
    },
    [isDemo, fail],
  );

  const importTransactions = useCallback(
    async (inputs: TxInput[]) => {
      if (inputs.length === 0) return 0;
      if (isDemo) {
        demoStore.addManyTransactions(inputs);
        return inputs.length;
      }
      try {
        const uid = requireUid();
        const database = db!;
        for (let index = 0; index < inputs.length; index += IMPORT_BATCH_LIMIT) {
          const batch = writeBatch(database);
          inputs.slice(index, index + IMPORT_BATCH_LIMIT).forEach((input) => {
            batch.set(doc(collection(database, "transactions")), {
              ...input,
              ownerId: uid,
              createdAt: serverTimestamp(),
            });
          });
          await batch.commit();
        }
        return inputs.length;
      } catch (cause) {
        return fail(cause);
      }
    },
    [isDemo, requireUid, fail],
  );

  const addBudget = useCallback(
    async (input: BudgetInput) => {
      if (isDemo) return demoStore.addBudget(input);
      try {
        await addDoc(collection(db!, "budgets"), {
          ...input,
          ownerId: requireUid(),
          createdAt: serverTimestamp(),
        });
      } catch (cause) {
        fail(cause);
      }
    },
    [isDemo, requireUid, fail],
  );

  const updateBudget = useCallback(
    async (id: string, input: BudgetInput) => {
      if (isDemo) return demoStore.updateBudget(id, input);
      try {
        await updateDoc(doc(db!, "budgets", id), { ...input });
      } catch (cause) {
        fail(cause);
      }
    },
    [isDemo, fail],
  );

  const deleteBudget = useCallback(
    async (id: string) => {
      if (isDemo) return demoStore.removeBudget(id);
      try {
        await deleteDoc(doc(db!, "budgets", id));
      } catch (cause) {
        fail(cause);
      }
    },
    [isDemo, fail],
  );

  const addGoal = useCallback(
    async (input: GoalInput) => {
      const payload = {
        name: input.name,
        icon: input.icon,
        targetAmount: input.targetAmount,
        savedAmount: input.savedAmount ?? 0,
        targetDate: input.targetDate || null,
      };
      if (isDemo) return demoStore.addGoal(payload);
      try {
        await addDoc(collection(db!, "goals"), {
          ...payload,
          ownerId: requireUid(),
          createdAt: serverTimestamp(),
        });
      } catch (cause) {
        fail(cause);
      }
    },
    [isDemo, requireUid, fail],
  );

  const updateGoal = useCallback(
    async (id: string, patch: Partial<GoalInput> & { savedAmount?: number }) => {
      if (isDemo) {
        demoStore.updateGoal(id, patch);
        return;
      }
      try {
        await updateDoc(doc(db!, "goals", id), { ...patch });
      } catch (cause) {
        fail(cause);
      }
    },
    [isDemo, fail],
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      if (isDemo) return demoStore.removeGoal(id);
      try {
        await deleteDoc(doc(db!, "goals", id));
      } catch (cause) {
        fail(cause);
      }
    },
    [isDemo, fail],
  );

  const addReminder = useCallback(
    async (input: ReminderInput) => {
      const payload = { ...input, lastPaidDate: input.lastPaidDate ?? null };
      if (isDemo) return demoStore.addReminder(payload);
      try {
        await addDoc(collection(db!, "reminders"), {
          ...payload,
          ownerId: requireUid(),
          createdAt: serverTimestamp(),
        });
      } catch (cause) {
        fail(cause);
      }
    },
    [isDemo, requireUid, fail],
  );

  const updateReminder = useCallback(
    async (id: string, patch: Partial<ReminderInput>) => {
      if (isDemo) return demoStore.updateReminder(id, patch);
      try {
        await updateDoc(doc(db!, "reminders", id), { ...patch });
      } catch (cause) {
        fail(cause);
      }
    },
    [isDemo, fail],
  );

  const deleteReminder = useCallback(
    async (id: string) => {
      if (isDemo) return demoStore.removeReminder(id);
      try {
        await deleteDoc(doc(db!, "reminders", id));
      } catch (cause) {
        fail(cause);
      }
    },
    [isDemo, fail],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      ...(isDemo ? demoData : remote),
      loading: isDemo ? false : loading,
      error,
      fromCache: isDemo ? false : fromCache,
      clearError,
      retry,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      importTransactions,
      addBudget,
      updateBudget,
      deleteBudget,
      addGoal,
      updateGoal,
      deleteGoal,
      addReminder,
      updateReminder,
      deleteReminder,
      convertCurrency,
    }),
    [
      isDemo,
      demoData,
      remote,
      loading,
      error,
      fromCache,
      clearError,
      retry,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      importTransactions,
      addBudget,
      updateBudget,
      deleteBudget,
      addGoal,
      updateGoal,
      deleteGoal,
      addReminder,
      updateReminder,
      deleteReminder,
      convertCurrency,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used inside DataProvider");
  return context;
}
