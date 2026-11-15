import { useMemo, useState } from "react";
import {
  ConfirmDialog,
  EmptyState,
  LoadingPage,
  Modal,
  PageHead,
  ProgressBar,
  useToast,
} from "../components/ui";
import { budgetProgress } from "../lib/calc";
import { CATEGORY_EMOJI, EXPENSE_CATEGORIES } from "../lib/constants";
import { money } from "../lib/format";
import type { Budget } from "../types";
import { useData } from "../store/DataProvider";

export function BudgetsPage() {
  const data = useData();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [form, setForm] = useState({ category: "Food", amount: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const progress = useMemo(
    () => budgetProgress(data.budgets, data.transactions),
    [data.budgets, data.transactions],
  );
  const totalLimit = progress.reduce((total, budget) => total + Number(budget.amount || 0), 0);
  const totalSpent = progress.reduce((total, budget) => total + budget.spent, 0);
  const usedPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const usedCategories = new Set(data.budgets.map((budget) => budget.category));

  const startCreate = () => {
    const firstFree = EXPENSE_CATEGORIES.find((category) => !usedCategories.has(category));
    setEditing(null);
    setForm({ category: firstFree || EXPENSE_CATEGORIES[0], amount: "" });
    setError("");
    setOpen(true);
  };

  const startEdit = (budget: Budget) => {
    setEditing(budget);
    setForm({ category: budget.category, amount: String(budget.amount) });
    setError("");
    setOpen(true);
  };

  const save = async () => {
    const value = Number(form.amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid monthly budget amount.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { category: form.category, amount: Math.round(value * 100) / 100, period: "monthly" as const };
      if (editing) {
        await data.updateBudget(editing.id, payload);
        notify("Budget updated.");
      } else {
        await data.addBudget(payload);
        notify("Budget added.");
      }
      setOpen(false);
      setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the budget.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await data.deleteBudget(deleting.id);
      notify("Budget deleted.");
      setDeleting(null);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Delete failed.", "error");
    } finally {
      setDeletingBusy(false);
    }
  };

  if (data.loading) return <LoadingPage />;

  return (
    <div className="page">
      <PageHead
        title="Budgets"
        sub={`${money(totalSpent)} of ${money(totalLimit)} spent this month${
          totalLimit > 0 ? ` · ${usedPct}%` : ""
        }`}
        actions={
          <button className="btn btn-primary" onClick={startCreate} type="button">
            + Add budget
          </button>
        }
      />

      {progress.length === 0 ? (
        <div className="card">
          <EmptyState
            emoji="🎯"
            title="No budgets yet"
            subtitle="Set a monthly limit per category to get overspending alerts and stay on track."
            action={
              <button className="btn btn-primary" onClick={startCreate} type="button">
                + Add your first budget
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid cols-2">
          {progress.map((budget) => (
            <div className="card budget-card" key={budget.id}>
              <div className="budget-head">
                <span className="budget-emoji" aria-hidden="true">
                  {CATEGORY_EMOJI[budget.category] || "📦"}
                </span>
                <div className="budget-main">
                  <div className="budget-name">{budget.category}</div>
                  <div className="muted budget-meta">
                    {money(budget.spent)} of {money(budget.amount)}
                  </div>
                </div>
                <div className="budget-right">
                  <div className={`budget-left ${budget.over ? "neg" : ""}`}>
                    {money(budget.remaining)}
                    <span className="muted"> {budget.over ? "over" : "left"}</span>
                  </div>
                  <div className="row-actions">
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => startEdit(budget)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => setDeleting(budget)}
                      type="button"
                    >
                      Del
                    </button>
                  </div>
                </div>
              </div>
              <ProgressBar
                pct={budget.pct}
                tone={budget.over ? "over" : budget.pct >= 80 ? "warn" : undefined}
              />
              <div className={`budget-foot ${budget.over ? "neg" : "muted"}`}>
                {budget.over
                  ? `${Math.round(budget.pct)}% used — over budget by ${money(-budget.remaining)}`
                  : `${Math.round(budget.pct)}% used${
                      budget.pct >= 80 ? " — close to the limit" : ""
                    }`}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal
          title={editing ? "Edit budget" : "Add budget"}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            {error && <div className="error-box">{error}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="budget-category">Category</label>
                <select
                  id="budget-category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                >
                  {EXPENSE_CATEGORIES.map((category) => (
                    <option
                      key={category}
                      value={category}
                      disabled={!editing && usedCategories.has(category)}
                    >
                      {category}
                      {!editing && usedCategories.has(category) ? " (already budgeted)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="budget-amount">Monthly limit</label>
                <div className="input-split">
                  <span className="pre">₹</span>
                  <input
                    id="budget-amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    autoFocus
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setOpen(false);
                  setEditing(null);
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save" : "Add budget"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete budget?"
          message={`The ${deleting.category} budget of ${money(deleting.amount)} will be removed. Your transactions are not affected.`}
          busy={deletingBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}
