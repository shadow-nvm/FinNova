import { useEffect, useRef, useState } from "react";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, MAX_STORED_AMOUNT } from "../lib/constants";
import { currencySymbol, dateInput, todayInput } from "../lib/format";
import type { Transaction, TxInput, TxType } from "../types";
import { Modal } from "./ui";

interface Draft {
  type: TxType;
  category: string;
  amount: string;
  date: string;
  note: string;
}

function blankDraft(type: TxType = "expense"): Draft {
  return {
    type,
    category: type === "income" ? "Salary" : "Food",
    amount: "",
    date: todayInput(),
    note: "",
  };
}

export function TransactionModal({
  open,
  initial,
  duplicate,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: Transaction | null;
  /** Prefills a brand-new transaction (used by "Copy"). */
  duplicate?: Transaction | null;
  onClose: () => void;
  onSave: (input: TxInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    setSaving(false);
    if (initial) {
      setDraft({
        type: initial.type,
        category: initial.category,
        amount: String(initial.amount ?? ""),
        date: dateInput(initial.date) || todayInput(),
        note: initial.note || "",
      });
    } else if (duplicate) {
      setDraft({
        type: duplicate.type,
        category: duplicate.category,
        amount: String(duplicate.amount ?? ""),
        date: todayInput(),
        note: duplicate.note || "",
      });
    } else {
      setDraft(blankDraft());
    }
  }, [open, initial, duplicate]);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => amountRef.current?.focus(), 60);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const categories = draft.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  // Keep categories that came from older data selectable instead of silently
  // showing (and later saving) the first option in the list.
  const options: string[] = [...categories];
  if (draft.category && !options.includes(draft.category)) options.unshift(draft.category);

  const submit = async () => {
    const value = Number(draft.amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    if (value > MAX_STORED_AMOUNT) {
      setError(`Enter an amount of ${MAX_STORED_AMOUNT.toLocaleString("en-US")} or less.`);
      return;
    }
    if (!draft.date) {
      setError("Enter a date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        type: draft.type,
        category: draft.category,
        amount: Math.round(value * 100) / 100,
        date: new Date(`${draft.date}T12:00:00`).toISOString(),
        note: draft.note.trim(),
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the transaction.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit transaction" : "Add transaction"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {error && <div className="error-box">{error}</div>}

        <div className="input-radio" style={{ marginBottom: 14 }}>
          {(["expense", "income"] as TxType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={`radio-btn${draft.type === type ? " on" : ""}`}
              aria-pressed={draft.type === type}
              onClick={() =>
                update({
                  type,
                  category: type === "income" ? "Salary" : "Food",
                })
              }
            >
              {type === "expense" ? "− Expense" : "+ Income"}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="tx-amount">Amount</label>
            <div className="input-split">
              <span className="pre">{currencySymbol()}</span>
              <input
                id="tx-amount"
                ref={amountRef}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={draft.amount}
                onChange={(event) => update({ amount: event.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="tx-category">Category</label>
            <select
              id="tx-category"
              value={draft.category}
              onChange={(event) => update({ category: event.target.value })}
            >
              {options.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="tx-date">Date</label>
            <input
              id="tx-date"
              type="date"
              value={draft.date}
              onChange={(event) => update({ date: event.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="tx-note">Note (optional)</label>
            <input
              id="tx-note"
              placeholder="e.g. Weekly groceries"
              value={draft.note}
              maxLength={80}
              onChange={(event) => update({ note: event.target.value })}
            />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : initial ? "Save changes" : "Add transaction"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
