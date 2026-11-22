import { useMemo, useRef, useState } from "react";
import { ConfirmDialog, EmptyState, LoadingPage, Modal, PageHead, useToast } from "../components/ui";
import { TransactionModal } from "../components/TransactionModal";
import { CATEGORY_EMOJI } from "../lib/constants";
import { parseTransactionsCsv, transactionsCsv, type CsvRow } from "../lib/csv";
import {
  dateLong,
  downloadBlob,
  money,
  monthKeyOf,
  monthLong,
  todayInput,
} from "../lib/format";
import type { Transaction } from "../types";
import { useData } from "../store/DataProvider";

type TypeFilter = "all" | "expense" | "income";
type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

const TYPE_OPTIONS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "expense", label: "Expenses" },
  { id: "income", label: "Income" },
];

interface ImportPreview {
  rows: CsvRow[];
  errors: string[];
  filename: string;
}

export function TransactionsPage() {
  const data = useData();
  const notify = useToast();
  const [type, setType] = useState<TypeFilter>("all");
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [duplicating, setDuplicating] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const months = useMemo(
    () => [...new Set(data.transactions.map((tx) => monthKeyOf(tx.date)).filter(Boolean))].sort().reverse(),
    [data.transactions],
  );

  const filtered = useMemo(() => {
    let rows = [...data.transactions];
    if (type !== "all") rows = rows.filter((tx) => tx.type === type);
    if (month) rows = rows.filter((tx) => monthKeyOf(tx.date) === month);
    const query = search.trim().toLowerCase();
    if (query) {
      rows = rows.filter(
        (tx) =>
          tx.note?.toLowerCase().includes(query) ||
          tx.category.toLowerCase().includes(query),
      );
    }
    rows.sort((a, b) => {
      switch (sort) {
        case "date-asc":
          return (a.date || "").localeCompare(b.date || "");
        case "amount-desc":
          return Number(b.amount) - Number(a.amount);
        case "amount-asc":
          return Number(a.amount) - Number(b.amount);
        default:
          return (b.date || "").localeCompare(a.date || "");
      }
    });
    return rows;
  }, [data.transactions, type, month, search, sort]);

  const totals = useMemo(() => {
    const income = filtered
      .filter((tx) => tx.type === "income")
      .reduce((total, tx) => total + Number(tx.amount || 0), 0);
    const expense = filtered
      .filter((tx) => tx.type === "expense")
      .reduce((total, tx) => total + Number(tx.amount || 0), 0);
    return { income, expense, net: income - expense };
  }, [filtered]);

  const grouped = useMemo(() => {
    if (sort !== "date-desc" && sort !== "date-asc") return null;
    const map = new Map<string, Transaction[]>();
    for (const tx of filtered) {
      const key = monthKeyOf(tx.date) || "unknown";
      const bucket = map.get(key);
      if (bucket) bucket.push(tx);
      else map.set(key, [tx]);
    }
    return [...map.entries()];
  }, [filtered, sort]);

  const hasFilters = type !== "all" || month !== "" || search.trim() !== "";

  const resetFilters = () => {
    setType("all");
    setMonth("");
    setSearch("");
  };

  const exportCsv = () => {
    if (filtered.length === 0) {
      notify("Nothing to export with the current filters.", "info");
      return;
    }
    downloadBlob(
      transactionsCsv(filtered),
      `finnova-transactions-${todayInput()}.csv`,
      "text/csv;charset=utf-8;",
    );
    notify(`Exported ${filtered.length} transactions.`);
  };

  const openImport = () => fileInput.current?.click();

  const onFileChosen = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseTransactionsCsv(text);
      if (parsed.rows.length === 0) {
        notify(parsed.errors[0] || "No usable rows found in that file.", "error");
        return;
      }
      setPreview({ rows: parsed.rows, errors: parsed.errors, filename: file.name });
    } catch {
      notify("Could not read that file. Please try a plain CSV file.", "error");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const count = await data.importTransactions(
        preview.rows.map((row) => ({ ...row })),
      );
      notify(`Imported ${count} transactions.`);
      setPreview(null);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Import failed.", "error");
    } finally {
      setImporting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await data.deleteTransaction(deleting.id);
      notify("Transaction deleted.");
      setDeleting(null);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Delete failed.", "error");
    } finally {
      setDeletingBusy(false);
    }
  };

  const row = (transaction: Transaction) => (
    <div className="tx-row" key={transaction.id}>
      <span className="tx-ico" aria-hidden="true">
        {CATEGORY_EMOJI[transaction.category] || "💠"}
      </span>
      <div className="tx-main">
        <div className="tx-title">{transaction.note || transaction.category}</div>
        <div className="tx-sub">
          {transaction.category} · {dateLong(transaction.date)}
        </div>
      </div>
      <span className={`tx-amt ${transaction.type === "income" ? "pos" : "neg"}`}>
        {transaction.type === "income" ? "+" : "−"}
        {money(transaction.amount)}
      </span>
      <div className="row-actions">
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setDuplicating(transaction)}
          type="button"
          title="Duplicate this transaction"
        >
          Copy
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => setEditing(transaction)} type="button">
          Edit
        </button>
        <button
          className="btn btn-sm btn-danger"
          onClick={() => setDeleting(transaction)}
          type="button"
        >
          Del
        </button>
      </div>
    </div>
  );

  if (data.loading) return <LoadingPage />;

  return (
    <div className="page">
      <PageHead
        title="Transactions"
        sub={
          <>
            {filtered.length} transaction{filtered.length === 1 ? "" : "s"} · net{" "}
            <span className={totals.net >= 0 ? "pos" : "neg"}>{money(totals.net)}</span>
          </>
        }
        actions={
          <div className="page-actions">
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(event) => void onFileChosen(event.target.files?.[0])}
            />
            <button className="btn" onClick={openImport} type="button" title="Import transactions from CSV">
              ⬆ Import
            </button>
            <button className="btn" onClick={exportCsv} type="button" title="Export to CSV">
              ⬇ Export
            </button>
            <button className="btn btn-primary" onClick={() => setAdding(true)} type="button">
              + Add transaction
            </button>
          </div>
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-grid filters-grid">
          <div className="field">
            <label htmlFor="filter-type">Type</label>
            <select
              id="filter-type"
              value={type}
              onChange={(event) => setType(event.target.value as TypeFilter)}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-month">Month</label>
            <select
              id="filter-month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              <option value="">All months</option>
              {months.map((key) => (
                <option key={key} value={key}>
                  {monthLong(key)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-sort">Sort</label>
            <select
              id="filter-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="amount-desc">Highest amount</option>
              <option value="amount-asc">Lowest amount</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-search">Search</label>
            <input
              id="filter-search"
              placeholder="Search by note or category…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="filter-summary">
          <span className="pill low">Income {money(totals.income)}</span>
          <span className="pill high">Expenses {money(totals.expense)}</span>
          {hasFilters && (
            <button className="link-btn inline" onClick={resetFilters} type="button">
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <EmptyState
            emoji="🧾"
            title="No transactions found"
            subtitle="Try adjusting your filters, or add a new transaction."
            action={
              <button className="btn btn-primary" onClick={() => setAdding(true)} type="button">
                + Add transaction
              </button>
            }
          />
        ) : grouped ? (
          grouped.map(([key, rows]) => {
            const net = rows.reduce(
              (total, tx) => total + (tx.type === "income" ? 1 : -1) * Number(tx.amount || 0),
              0,
            );
            return (
              <div className="tx-group" key={key}>
                <div className="tx-group-head">
                  <span>{key === "unknown" ? "Unknown date" : monthLong(key)}</span>
                  <span className="muted">
                    {rows.length} · <span className={net >= 0 ? "pos" : "neg"}>{money(net)}</span>
                  </span>
                </div>
                {rows.map((transaction) => row(transaction))}
              </div>
            );
          })
        ) : (
          filtered.slice(0, 400).map((transaction) => row(transaction))
        )}
      </div>

      <TransactionModal
        open={adding}
        onClose={() => setAdding(false)}
        onSave={async (input) => {
          await data.addTransaction(input);
          notify("Transaction added.");
        }}
      />

      <TransactionModal
        open={Boolean(editing)}
        initial={editing}
        onClose={() => setEditing(null)}
        onSave={async (input) => {
          if (!editing) return;
          await data.updateTransaction(editing.id, input);
          notify("Transaction updated.");
        }}
      />

      <TransactionModal
        open={Boolean(duplicating)}
        duplicate={duplicating}
        onClose={() => setDuplicating(null)}
        onSave={async (input) => {
          await data.addTransaction(input);
          notify("Transaction copied.");
        }}
      />

      {deleting && (
        <ConfirmDialog
          title="Delete transaction?"
          message={`"${deleting.note || deleting.category}" (${money(deleting.amount)}) will be permanently removed.`}
          busy={deletingBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}

      {preview && (
        <Modal title="Import transactions" onClose={() => setPreview(null)}>
          <div className="notice-box">
            <strong>{preview.filename}</strong> — {preview.rows.length} row
            {preview.rows.length === 1 ? "" : "s"} ready to import.
          </div>
          {preview.errors.length > 0 && (
            <div className="error-box">
              {preview.errors.length} row{preview.errors.length === 1 ? "" : "s"} will be skipped:
              <ul className="error-list">
                {preview.errors.slice(0, 5).map((message) => (
                  <li key={message}>{message}</li>
                ))}
                {preview.errors.length > 5 && <li>…and {preview.errors.length - 5} more.</li>}
              </ul>
            </div>
          )}
          <div className="import-preview">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 6).map((row, index) => (
                  <tr key={`${row.date}-${index}`}>
                    <td>{new Date(row.date).toLocaleDateString()}</td>
                    <td>{row.type}</td>
                    <td>{row.category}</td>
                    <td style={{ textAlign: "right" }}>{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 6 && (
              <div className="muted import-more">…and {preview.rows.length - 6} more rows.</div>
            )}
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setPreview(null)} disabled={importing}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => void confirmImport()} disabled={importing}>
              {importing ? "Importing…" : `Import ${preview.rows.length} transactions`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
