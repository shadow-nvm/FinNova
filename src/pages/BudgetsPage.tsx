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
import { budgetProgress, categoryTotals, inMonth, ofType } from "../lib/calc";
import { CATEGORY_EMOJI, EXPENSE_CATEGORIES, MAX_STORED_AMOUNT } from "../lib/constants";
import { currencySymbol, lastMonthKeys, money, monthShort } from "../lib/format";
import type { Budget } from "../types";
import { useData } from "../store/DataProvider";

/** Rounds a spend figure up to a friendly budget limit (e.g. 9,640 → 10,000). */
function niceLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 2;
  return Math.ceil(value / step) * step;
}

export function BudgetsPage() {
  const data = useData();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [suggestBusy, setSuggestBusy] = useState(false);
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

  const lastMonth = lastMonthKeys(2)[0];
  const suggestions = useMemo(
    () =>
      Object.entries(
        categoryTotals(ofType(inMonth(data.transactions, lastMonth), "expense")),
      )
        .filter(([category]) => !data.budgets.some((budget) => budget.category === category))
        .map(([category, spent]) => ({ category, spent, suggested: niceLimit(spent) }))
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 6),
    [data.transactions, data.budgets, lastMonth],
  );

  const openSuggest = () => {
    setChosen(new Set(suggestions.map((item) => item.category)));
    setSuggestOpen(true);
  };

  const addSuggestions = async () => {
    const picks = suggestions.filter((item) => chosen.has(item.category));
    if (picks.length === 0) {
      notify("Pick at least one category.", "info");
      return;
    }
    setSuggestBusy(true);
    try {
      for (const pick of picks) {
        await data.addBudget({
          category: pick.category,
          amount: pick.suggested,
          period: "monthly",
        });
      }
      notify(`${picks.length} budget${picks.length === 1 ? "" : "s"} created from last month's spending.`);
      setSuggestOpen(false);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Could not create the budgets.", "error");
    } finally {
      setSuggestBusy(false);
    }
  };

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
    if (value > MAX_STORED_AMOUNT) {
      setError(`Enter a budget of ${MAX_STORED_AMOUNT.toLocaleString("en-US")} or less.`);
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
          <div className="page-actions">
            <button
              className="btn"
              onClick={openSuggest}
              type="button"
              disabled={suggestions.length === 0}
              title={
                suggestions.length === 0
                  ? "No unbudgeted categories with spending last month"
                  : "Create budgets from last month's spending"
              }
            >
              ✨ Suggest from {monthShort(lastMonth)}
            </button>
            <button className="btn btn-primary" onClick={startCreate} type="button">
              + Add budget
            </button>
          </div>
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
                  <span className="pre">{currencySymbol()}</span>
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

      {suggestOpen && (
        <Modal title={`Suggested budgets for ${monthShort(lastMonth)}`} onClose={() => setSuggestOpen(false)}>
          <div className="muted" style={{ marginBottom: 14, fontSize: "0.9rem" }}>
            Based on what you actually spent last month. Edit any limit afterwards.
          </div>
          <div className="suggest-list">
            {suggestions.map((item) => {
              const active = chosen.has(item.category);
              return (
                <label key={item.category} className={`suggest-row${active ? " on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() =>
                      setChosen((current) => {
                        const next = new Set(current);
                        if (next.has(item.category)) next.delete(item.category);
                        else next.add(item.category);
                        return next;
                      })
                    }
                  />
                  <span className="suggest-emoji" aria-hidden="true">
                    {CATEGORY_EMOJI[item.category] || "📦"}
                  </span>
                  <span className="suggest-name">{item.category}</span>
                  <span className="muted suggest-spent">spent {money(item.spent)}</span>
                  <span className="suggest-amount">{money(item.suggested)}</span>
                </label>
              );
            })}
          </div>
          <div className="form-actions">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setSuggestOpen(false)}
              disabled={suggestBusy}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void addSuggestions()}
              disabled={suggestBusy || chosen.size === 0}
            >
              {suggestBusy ? "Creating…" : `Create ${chosen.size} budget${chosen.size === 1 ? "" : "s"}`}
            </button>
          </div>
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
