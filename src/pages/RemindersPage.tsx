import { useMemo, useState } from "react";
import {
  ConfirmDialog,
  EmptyState,
  LoadingPage,
  Modal,
  PageHead,
  SectionTitle,
  useToast,
} from "../components/ui";
import { daysUntil, nextDue } from "../lib/calc";
import { MAX_REMINDER_DAY } from "../lib/constants";
import { clamp, currencySymbol, dateShort, money, todayInput } from "../lib/format";
import type { Reminder, ReminderInput } from "../types";
import { useData } from "../store/DataProvider";

export function RemindersPage() {
  const data = useData();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [form, setForm] = useState({
    type: "bill" as ReminderInput["type"],
    title: "",
    amount: "",
    day: "1",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Reminder | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      data.reminders
        .map((reminder) => ({ reminder, due: nextDue(reminder) }))
        .sort((a, b) => a.due.getTime() - b.due.getTime()),
    [data.reminders],
  );
  const bills = rows.filter((row) => row.reminder.type === "bill");
  const savings = rows.filter((row) => row.reminder.type === "saving");

  const openCreate = () => {
    setEditing(null);
    setForm({ type: "bill", title: "", amount: "", day: "1" });
    setError("");
    setOpen(true);
  };

  const openEdit = (reminder: Reminder) => {
    setEditing(reminder);
    setForm({
      type: reminder.type,
      title: reminder.title,
      amount: String(reminder.amount || ""),
      day: String(reminder.day || 1),
    });
    setError("");
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      setError("Enter a title.");
      return;
    }
    const payload: ReminderInput = {
      type: form.type,
      title: form.title.trim(),
      amount: Math.max(0, Number(form.amount) || 0),
      day: clamp(Math.round(Number(form.day) || 1), 1, MAX_REMINDER_DAY),
    };
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await data.updateReminder(editing.id, payload);
        notify("Reminder updated.");
      } else {
        await data.addReminder({ ...payload, lastPaidDate: null });
        notify("Reminder added.");
      }
      setOpen(false);
      setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the reminder.");
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (reminder: Reminder) => {
    setBusyId(reminder.id);
    try {
      const today = todayInput();
      await data.updateReminder(reminder.id, { lastPaidDate: today });
      const due = nextDue({ ...reminder, lastPaidDate: today });
      notify(`Marked paid. Next due ${dateShort(due.toISOString())}.`);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Could not update the reminder.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await data.deleteReminder(deleting.id);
      notify("Reminder deleted.");
      setDeleting(null);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Delete failed.", "error");
    } finally {
      setDeletingBusy(false);
    }
  };

  const renderRow = ({
    reminder,
    due,
  }: {
    reminder: Reminder;
    due: Date;
  }) => {
    const days = daysUntil(due);
    const tone = days <= 2 ? "high" : days <= 5 ? "med" : "low";
    const colors =
      tone === "high"
        ? { background: "rgba(244,63,94,0.16)", color: "var(--red)" }
        : tone === "med"
          ? { background: "rgba(251,191,36,0.16)", color: "var(--amber)" }
          : { background: "var(--card-2)", color: "var(--muted)" };
    return (
      <div className="tx-row" key={reminder.id}>
        <span className="tx-ico" aria-hidden="true">
          {reminder.type === "bill" ? "🧾" : "🐖"}
        </span>
        <div className="tx-main">
          <div className="tx-title">{reminder.title}</div>
          <div className="tx-sub">
            {money(reminder.amount)} · day {reminder.day} · next due{" "}
            {dateShort(due.toISOString())}
            {reminder.lastPaidDate ? ` · last paid ${dateShort(reminder.lastPaidDate)}` : ""}
          </div>
        </div>
        <span className="due-badge" style={colors}>
          {days <= 0 ? "due today" : `in ${days}d`}
        </span>
        <div className="row-actions">
          <button
            className="btn btn-sm btn-primary"
            onClick={() => void markPaid(reminder)}
            disabled={busyId === reminder.id}
            type="button"
          >
            {busyId === reminder.id ? "…" : "Mark paid ✓"}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => openEdit(reminder)} type="button">
            Edit
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => setDeleting(reminder)}
            type="button"
          >
            Del
          </button>
        </div>
      </div>
    );
  };

  if (data.loading) return <LoadingPage />;

  return (
    <div className="page">
      <PageHead
        title="Reminders"
        sub="Recurring bills and savings nudges"
        actions={
          <button className="btn btn-primary" onClick={openCreate} type="button">
            + Add reminder
          </button>
        }
      />

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            emoji="🔔"
            title="No reminders yet"
            subtitle="Add monthly bills or a recurring transfer to your savings goal."
            action={
              <button className="btn btn-primary" onClick={openCreate} type="button">
                + Add your first reminder
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <SectionTitle>Bills & payments</SectionTitle>
            {bills.length === 0 ? (
              <div className="muted mini-empty">No bill reminders.</div>
            ) : (
              bills.map(renderRow)
            )}
          </div>
          <div className="card">
            <SectionTitle>Savings nudges</SectionTitle>
            {savings.length === 0 ? (
              <div className="muted mini-empty">No savings reminders.</div>
            ) : (
              savings.map(renderRow)
            )}
          </div>
        </>
      )}

      {open && (
        <Modal
          title={editing ? "Edit reminder" : "Add reminder"}
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
            <div className="input-radio" style={{ marginBottom: 14 }}>
              {(["bill", "saving"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`radio-btn${form.type === type ? " on" : ""}`}
                  aria-pressed={form.type === type}
                  onClick={() => setForm({ ...form, type })}
                >
                  {type === "bill" ? "🧾 Bill" : "🐖 Savings"}
                </button>
              ))}
            </div>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="reminder-title">Title</label>
                <input
                  id="reminder-title"
                  placeholder={
                    form.type === "bill"
                      ? "e.g. Electricity bill"
                      : "e.g. Auto top-up to Emergency Fund"
                  }
                  autoFocus
                  maxLength={60}
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="reminder-amount">Amount ({currencySymbol()})</label>
                <input
                  id="reminder-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="reminder-day">Day of month</label>
                <input
                  id="reminder-day"
                  type="number"
                  min="1"
                  max={MAX_REMINDER_DAY}
                  value={form.day}
                  onChange={(event) => setForm({ ...form, day: event.target.value })}
                />
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
                {saving ? "Saving…" : editing ? "Save changes" : "Add reminder"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete reminder?"
          message={`"${deleting.title}" will be removed. This does not delete any transactions.`}
          busy={deletingBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}
