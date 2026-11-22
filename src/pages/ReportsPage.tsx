import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AnimatedMoney,
  LoadingPage,
  PageHead,
  SectionTitle,
  StatCard,
  useToast,
} from "../components/ui";
import { ChartTooltip } from "../components/ChartTooltip";
import {
  categoryTotals,
  inMonth,
  monthStats,
  ofType,
  reportRows,
  savingsRate,
} from "../lib/calc";
import { CATEGORY_COLORS, CATEGORY_EMOJI } from "../lib/constants";
import {
  compactMoney,
  currentMonthKey,
  dateShort,
  downloadBlob,
  lastMonthKeys,
  money,
  monthLong,
  monthShort,
  monthKeyOf,
  todayInput,
} from "../lib/format";
import { fullBackupJson, monthCsv } from "../lib/csv";
import { useData } from "../store/DataProvider";

export function ReportsPage() {
  const data = useData();
  const notify = useToast();
  const [selected, setSelected] = useState(currentMonthKey());

  const monthOptions = useMemo(() => {
    const keys = new Set(lastMonthKeys(12));
    data.transactions.forEach((tx) => {
      const key = monthKeyOf(tx.date);
      if (key) keys.add(key);
    });
    return [...keys].sort().reverse();
  }, [data.transactions]);

  const rows = useMemo(() => reportRows(data.transactions, 6), [data.transactions]);
  const stats = useMemo(() => monthStats(data.transactions, selected), [data.transactions, selected]);
  const rate = savingsRate(stats);

  const categoryRows = useMemo(() => {
    const totals = categoryTotals(ofType(inMonth(data.transactions, selected), "expense"));
    const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
    return Object.entries(totals)
      .map(([name, value]) => ({
        name,
        value,
        pct: total > 0 ? (value / total) * 100 : 0,
        color: CATEGORY_COLORS[name] || "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [data.transactions, selected]);

  const biggest = useMemo(
    () =>
      ofType(inMonth(data.transactions, selected), "expense")
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .slice(0, 5),
    [data.transactions, selected],
  );

  const monthLabel = monthLong(selected);
  const chartData = rows.map((row) => ({ ...row }));

  const exportMonth = () => {
    const rowsForMonth = inMonth(data.transactions, selected);
    if (rowsForMonth.length === 0) {
      notify("No transactions in that month.", "info");
      return;
    }
    downloadBlob(monthCsv(data.transactions, selected), `finnova-${selected}.csv`, "text/csv;charset=utf-8;");
    notify(`Exported ${rowsForMonth.length} transactions for ${monthLabel}.`);
  };

  const exportAll = () => {
    downloadBlob(
      fullBackupJson(data.transactions, data.budgets, data.goals, data.reminders),
      `finnova-backup-${todayInput()}.json`,
      "application/json",
    );
    notify("Full backup downloaded.");
  };

  if (data.loading) return <LoadingPage />;

  return (
    <div className="page">
      <PageHead
        title="Reports"
        sub="Understand where your money went and how your habits are changing"
        actions={
          <div className="page-actions">
            <button className="btn" onClick={exportAll} type="button">
              ⬇ Full backup
            </button>
            <button className="btn btn-primary" onClick={exportMonth} type="button">
              ⬇ Export {monthShort(selected)}
            </button>
          </div>
        }
      />

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="report-controls">
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="report-month">Report month</label>
            <select
              id="report-month"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              {monthOptions.map((key) => (
                <option key={key} value={key}>
                  {monthLong(key)}
                </option>
              ))}
            </select>
          </div>
          <div className="report-note muted">
            Showing {monthLabel} · {inMonth(data.transactions, selected).length} transactions
          </div>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 20 }}>
        <StatCard
          label={`Income · ${monthShort(selected)}`}
          value={<AnimatedMoney value={stats.income} />}
          emoji="💰"
          tone="pos"
        />
        <StatCard label="Spending" value={<AnimatedMoney value={stats.expense} />} emoji="💸" tone="neg" />
        <StatCard
          label="Net saved"
          value={<AnimatedMoney value={stats.net} />}
          emoji="🏦"
          tone={stats.net >= 0 ? "pos" : "neg"}
          foot={`${rate}% of income`}
        />
        <StatCard
          label="Daily average spend"
          value={
            <AnimatedMoney
              value={
                stats.expense /
                Math.max(
                  1,
                  selected === currentMonthKey()
                    ? new Date().getDate()
                    : new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)), 0).getDate(),
                )
              }
            />
          }
          emoji="📅"
          foot={selected === currentMonthKey() ? "this month so far" : `across ${monthShort(selected)}`}
        />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <SectionTitle
            right={
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                Last 6 months
              </span>
            }
          >
            Monthly comparison
          </SectionTitle>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="barIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5eead4" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.55} />
                </linearGradient>
                <linearGradient id="barExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb7185" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--line)"
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="var(--line)"
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={compactMoney}
              />
              <Tooltip
                content={(props) => <ChartTooltip {...props} formatValue={money} />}
                cursor={{ fill: "rgba(148, 170, 220, 0.08)", radius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="income"
                name="Income"
                fill="url(#barIncome)"
                radius={[7, 7, 0, 0]}
                maxBarSize={26}
                animationBegin={0}
                animationDuration={1100}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="expense"
                name="Expenses"
                fill="url(#barExpense)"
                radius={[7, 7, 0, 0]}
                maxBarSize={26}
                animationBegin={200}
                animationDuration={1100}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <SectionTitle>Month by month</SectionTitle>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Income</th>
                  <th>Expenses</th>
                  <th>Net</th>
                  <th>Saved</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className={row.key === selected ? "selected" : undefined}>
                    <td>{row.label}</td>
                    <td>{compactMoney(row.income)}</td>
                    <td>{compactMoney(row.expense)}</td>
                    <td className={row.net >= 0 ? "pos" : "neg"}>{compactMoney(row.net)}</td>
                    <td>{row.savingsRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="muted report-tip">
            Tap a month above with the selector to see its category breakdown.
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <SectionTitle>Where it went · {monthShort(selected)}</SectionTitle>
          {categoryRows.length === 0 ? (
            <div className="muted mini-empty">No expenses recorded in {monthLabel}.</div>
          ) : (
            <div className="category-breakdown">
              {categoryRows.map((category) => (
                <div className="category-breakdown-row" key={category.name} style={{ animationDelay: `${0.06 * categoryRows.indexOf(category)}s` }}>
                  <div className="category-breakdown-head">
                    <span>
                      {CATEGORY_EMOJI[category.name] || "📦"} {category.name}
                    </span>
                    <span className="muted">
                      {money(category.value)} · {Math.round(category.pct)}%
                    </span>
                  </div>
                  <div className="bar">
                    <div
                      className="bar-fill"
                      style={{ width: `${category.pct}%`, background: category.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <SectionTitle>Largest expenses · {monthShort(selected)}</SectionTitle>
          {biggest.length === 0 ? (
            <div className="muted mini-empty">Nothing to show for {monthLabel}.</div>
          ) : (
            biggest.map((tx) => (
              <div className="tx-row compact" key={tx.id}>
                <span className="tx-ico" aria-hidden="true">
                  {CATEGORY_EMOJI[tx.category] || "💠"}
                </span>
                <div className="tx-main">
                  <div className="tx-title">{tx.note || tx.category}</div>
                  <div className="tx-sub">
                    {tx.category} · {dateShort(tx.date)}
                  </div>
                </div>
                <span className="tx-amt neg">−{money(tx.amount)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
