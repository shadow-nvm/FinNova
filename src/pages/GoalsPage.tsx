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
import { goalProgress } from "../lib/calc";
import { GOAL_ICONS } from "../lib/constants";
import { compactMoney, currencySymbol, dateInput, dateLong, money } from "../lib/format";
import type { Goal } from "../types";
import { useData } from "../store/DataProvider";

type GoalModal =
  | { mode: "create" }
  | { mode: "edit"; goal: Goal }
  | { mode: "deposit"; goal: Goal }
  | { mode: "withdraw"; goal: Goal }
  | null;

/** Rounds a quick-deposit suggestion to a human-friendly number. */
function niceMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.round(value / magnitude) * magnitude;
}

export function GoalsPage() {
  const data = useData();
  const notify = useToast();
  const [modal, setModal] = useState<GoalModal>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    icon: "🎯",
    targetAmount: "",
    targetDate: "",
  });
  const [amount, setAmount] = useState("");

  const rows = useMemo(
    () => data.goals.map((goal) => ({ goal, progress: goalProgress(goal) })),
    [data.goals],
  );
  const totalSaved = data.goals.reduce((total, goal) => total + Number(goal.savedAmount || 0), 0);
  const totalTarget = data.goals.reduce((total, goal) => total + Number(goal.targetAmount || 0), 0);

  const close = () => {
    setModal(null);
    setError("");
    setAmount("");
  };

  const openCreate = () => {
    setForm({ name: "", icon: "🎯", targetAmount: "", targetDate: "" });
    setError("");
    setModal({ mode: "create" });
  };

  const openEdit = (goal: Goal) => {
    setForm({
      name: goal.name,
      icon: goal.icon || "🎯",
      targetAmount: String(goal.targetAmount || ""),
      targetDate: dateInput(goal.targetDate),
    });
    setError("");
    setModal({ mode: "edit", goal });
  };

  const createGoal = async () => {
    const target = Number(form.targetAmount);
    if (!form.name.trim() || !Number.isFinite(target) || target <= 0) {
      setError("Enter a goal name and a valid target amount.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await data.addGoal({
        name: form.name.trim(),
        icon: form.icon,
        targetAmount: Math.round(target * 100) / 100,
        targetDate: form.targetDate || null,
        savedAmount: 0,
      });
      notify("Savings goal created.");
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the goal.");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (goal: Goal) => {
    const target = Number(form.targetAmount);
    if (!form.name.trim() || !Number.isFinite(target) || target <= 0) {
      setError("Enter a goal name and a valid target amount.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await data.updateGoal(goal.id, {
        name: form.name.trim(),
        icon: form.icon,
        targetAmount: Math.round(target * 100) / 100,
        targetDate: form.targetDate || null,
      });
      notify("Goal updated.");
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the goal.");
    } finally {
      setBusy(false);
    }
  };

  const moveMoney = async (goal: Goal, direction: "deposit" | "withdraw") => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    const current = Number(goal.savedAmount || 0);
    const next = direction === "deposit" ? current + value : current - value;
    if (next < 0) {
      setError(`You can withdraw at most ${money(current)} from this goal.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await data.updateGoal(goal.id, { savedAmount: Math.round(next * 100) / 100 });
      notify(
        direction === "deposit"
          ? `${money(value)} added to ${goal.name}.`
          : `${money(value)} withdrawn from ${goal.name}.`,
      );
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the goal.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await data.deleteGoal(deleting.id);
      notify("Goal deleted.");
      setDeleting(null);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Delete failed.", "error");
    } finally {
      setDeletingBusy(false);
    }
  };

  if (data.loading) return <LoadingPage />;

  const moneyModal = modal && (modal.mode === "deposit" || modal.mode === "withdraw") ? modal : null;
  const quickAmounts = moneyModal
    ? Array.from(
        new Set(
          [0.1, 0.25, 0.5]
            .map((share) =>
              niceMoney(
                (moneyModal.mode === "deposit"
                  ? Math.max(
                      0,
                      Number(moneyModal.goal.targetAmount || 0) -
                        Number(moneyModal.goal.savedAmount || 0),
                    )
                  : Number(moneyModal.goal.savedAmount || 0)) * share,
              ),
            )
            .filter((value) => value > 0),
        ),
      )
    : [];

  return (
    <div className="page">
      <PageHead
        title="Savings Goals"
        sub={`${money(totalSaved)} saved toward ${money(totalTarget)} across ${data.goals.length} goal${
          data.goals.length === 1 ? "" : "s"
        }`}
        actions={
          <button className="btn btn-primary" onClick={openCreate} type="button">
            + New goal
          </button>
        }
      />

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            emoji="🎁"
            title="No goals yet"
            subtitle="Create a savings goal and watch your progress grow."
            action={
              <button className="btn btn-primary" onClick={openCreate} type="button">
                + Create your first goal
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid cols-2">
          {rows.map(({ goal, progress }) => (
            <div className="card goal-card" key={goal.id}>
              <div className="goal-head">
                <span className="goal-emoji" aria-hidden="true">
                  {goal.icon}
                </span>
                <div className="goal-main">
                  <div className="goal-name">{goal.name}</div>
                  <div className="muted goal-meta">
                    {money(goal.savedAmount)} of {money(goal.targetAmount)}
                    {goal.targetDate ? ` · by ${dateLong(goal.targetDate)}` : ""}
                  </div>
                </div>
                {progress.done && <span className="pill low">Done 🎉</span>}
              </div>
              <ProgressBar pct={progress.pct} />
              <div className="goal-foot">
                <span className="muted">
                  {Math.round(progress.pct)}% complete
                  {progress.daysLeft != null && progress.daysLeft >= 0
                    ? ` · ${progress.daysLeft} day${progress.daysLeft === 1 ? "" : "s"} left`
                    : progress.daysLeft != null
                      ? " · target date passed"
                      : ""}
                  {progress.monthlyNeeded != null && !progress.done
                    ? ` · ~${money(progress.monthlyNeeded)}/mo to finish`
                    : ""}
                </span>
                <div className="row-actions">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      setAmount("");
                      setError("");
                      setModal({ mode: "deposit", goal });
                    }}
                    type="button"
                  >
                    + Deposit
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setAmount("");
                      setError("");
                      setModal({ mode: "withdraw", goal });
                    }}
                    type="button"
                  >
                    Withdraw
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => openEdit(goal)} type="button">
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setDeleting(goal)}
                    type="button"
                  >
                    Del
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (modal.mode === "create" || modal.mode === "edit") && (
        <Modal
          title={modal.mode === "create" ? "New savings goal" : "Edit goal"}
          onClose={close}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (modal.mode === "create") void createGoal();
              else void saveEdit(modal.goal);
            }}
          >
            {error && <div className="error-box">{error}</div>}
            <div style={{ marginBottom: 14 }}>
              <label>Icon</label>
              <div className="chip-row">
                {GOAL_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={`chip${form.icon === icon ? " on" : ""}`}
                    style={{ fontSize: "1.1rem", padding: "6px 10px" }}
                    aria-pressed={form.icon === icon}
                    aria-label={`Use ${icon} as the goal icon`}
                    onClick={() => setForm({ ...form, icon })}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="goal-name">Goal name</label>
                <input
                  id="goal-name"
                  placeholder="e.g. Emergency fund"
                  autoFocus
                  maxLength={60}
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="goal-target">Target amount</label>
                <div className="input-split">
                  <span className="pre">{currencySymbol()}</span>
                  <input
                    id="goal-target"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.targetAmount}
                    onChange={(event) => setForm({ ...form, targetAmount: event.target.value })}
                  />
                </div>
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="goal-date">Target date (optional)</label>
                <input
                  id="goal-date"
                  type="date"
                  value={form.targetDate}
                  onChange={(event) => setForm({ ...form, targetDate: event.target.value })}
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" type="button" onClick={close} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : modal.mode === "create" ? "Create goal" : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {moneyModal && (
        <Modal
          title={
            moneyModal.mode === "deposit"
              ? `Deposit to ${moneyModal.goal.name}`
              : `Withdraw from ${moneyModal.goal.name}`
          }
          onClose={close}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void moveMoney(moneyModal.goal, moneyModal.mode);
            }}
          >
            {error && <div className="error-box">{error}</div>}
            <div className="muted" style={{ marginBottom: 12 }}>
              Current balance: {money(moneyModal.goal.savedAmount)} of{" "}
              {money(moneyModal.goal.targetAmount)}
            </div>
            <label htmlFor="goal-amount">Amount</label>
            <div className="input-split" style={{ marginBottom: 12 }}>
              <span className="pre">{currencySymbol()}</span>
              <input
                id="goal-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                autoFocus
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="chip-row" style={{ marginBottom: 16 }}>
              {quickAmounts.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  className="chip"
                  onClick={() => setAmount(String(quick))}
                >
                  {compactMoney(quick)}
                </button>
              ))}
              <button
                type="button"
                className="chip"
                onClick={() => setAmount(String(Math.max(0, Number(moneyModal.goal.savedAmount || 0))))}
              >
                Full balance
              </button>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" type="button" onClick={close} disabled={busy}>
                Cancel
              </button>
              <button
                className={`btn ${moneyModal.mode === "deposit" ? "btn-primary" : "btn-danger"}`}
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "Saving…"
                  : moneyModal.mode === "deposit"
                    ? "Deposit"
                    : "Withdraw"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete goal?"
          message={`"${deleting.name}" and its saved progress will be permanently removed. Your transactions are not affected.`}
          busy={deletingBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}
