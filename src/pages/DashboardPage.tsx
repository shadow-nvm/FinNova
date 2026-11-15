import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../auth/AuthProvider";
import { TransactionModal } from "../components/TransactionModal";
import {
  EmptyState,
  LoadingPage,
  Modal,
  PageHead,
  ProgressBar,
  SectionTitle,
  StatCard,
  useToast,
} from "../components/ui";
import {
  allTimeStats,
  budgetProgress,
  buildInsights,
  categoryTotals,
  daysUntil,
  goalProgress,
  inMonth,
  monthStats,
  nextDue,
  ofType,
  savingsRate,
  trend,
} from "../lib/calc";
import { CATEGORY_COLORS, CATEGORY_EMOJI } from "../lib/constants";
import {
  compactMoney,
  currentMonthKey,
  dateShort,
  monthLong,
  monthShort,
  money,
} from "../lib/format";
import { useData } from "../store/DataProvider";

const TOOLTIP_STYLE = {
  backgroundColor: "var(--card-2)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  color: "var(--text)",
  fontSize: 12,
};

export function DashboardPage() {
  const { user } = useAuth();
  const data = useData();
  const notify = useToast();
  const [adding, setAdding] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const { transactions, budgets, goals, reminders } = data;

  const stats = useMemo(() => {
    const allTime = allTimeStats(transactions);
    const current = monthStats(transactions);
    const monthly = trend(transactions, 6);
    const categories = inMonth(transactions, currentMonthKey());
    const catTotals = categoryTotals(ofType(categories, "expense"));
    const chartData = Object.entries(catTotals)
      .map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] || "#94a3b8" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    return {
      allTime,
      current,
      monthly: monthly.map((point) => ({ ...point, label: monthShort(point.key) })),
      categories: chartData,
      rate: savingsRate(current),
    };
  }, [transactions]);

  const insights = useMemo(
    () => buildInsights({ transactions, budgets, goals, reminders }),
    [transactions, budgets, goals, reminders],
  );

  const recent = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .slice(0, 6),
    [transactions],
  );

  const budgetRows = useMemo(
    () => budgetProgress(budgets, transactions).slice(0, 4),
    [budgets, transactions],
  );

  const goalRows = useMemo(
    () => goals.map((goal) => ({ goal, progress: goalProgress(goal) })).slice(0, 3),
    [goals],
  );

  const upcoming = useMemo(
    () =>
      reminders
        .map((reminder) => ({ ...reminder, due: nextDue(reminder) }))
        .sort((a, b) => a.due.getTime() - b.due.getTime())
        .slice(0, 4),
    [reminders],
  );

  if (data.loading) return <LoadingPage />;

  return (
    <div className="page">
      <PageHead
        title="Dashboard"
        sub={`${monthLong(currentMonthKey())} overview · your money at a glance`}
        actions={
          <button className="btn btn-primary" onClick={() => setAdding(true)} type="button">
            + Add transaction
          </button>
        }
      />

      <div className="grid cols-4" style={{ marginBottom: 20 }}>
        <StatCard
          label="Income (this month)"
          value={money(stats.current.income)}
          emoji="💰"
          tone="pos"
        />
        <StatCard
          label="Spending (this month)"
          value={money(stats.current.expense)}
          emoji="💸"
          tone="neg"
        />
        <StatCard
          label="Net saved"
          value={money(stats.current.net)}
          emoji="🏦"
          tone={stats.current.net >= 0 ? "pos" : "neg"}
          foot={`${stats.rate}% of income`}
        />
        <StatCard
          label="All-time net"
          value={money(stats.allTime.net)}
          emoji="🌍"
          tone={stats.allTime.net >= 0 ? "pos" : "neg"}
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
            Income vs Spending
          </SectionTitle>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={stats.monthly} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#5b6a92"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#5b6a92"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={compactMoney}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => money(Number(value))}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke="#34d399"
                  fill="url(#gradIncome)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Expenses"
                  stroke="#f43f5e"
                  fill="url(#gradExpense)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <SectionTitle
            right={
              <button className="btn btn-sm btn-ghost" onClick={() => setShowInsights(true)}>
                View all
              </button>
            }
          >
            🤖 FinNova Insights
          </SectionTitle>
          <div className="insight-list">
            {insights.slice(0, 4).map((insight) => (
              <button
                className="insight insight-button"
                key={insight.key}
                onClick={() => setShowInsights(true)}
                type="button"
              >
                <span className="emoji" aria-hidden="true">
                  {insight.emoji}
                </span>
                <span className="insight-main">
                  <span className="insight-title">{insight.title}</span>
                  <span className="muted insight-detail">{insight.detail}</span>
                </span>
                <span className={`pill ${insight.priority}`}>{insight.priority}</span>
              </button>
            ))}
            {insights.length === 0 && (
              <div className="muted" style={{ fontSize: "0.9rem" }}>
                Add some transactions to see personalised insights.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <SectionTitle
          right={
            <Link to="/transactions" className="section-link">
              All transactions →
            </Link>
          }
        >
          Spending by category
        </SectionTitle>
        {stats.categories.length === 0 ? (
          <div className="chart-empty muted">No spending this month yet.</div>
        ) : (
          <div className="category-layout">
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={stats.categories}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={50}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {stats.categories.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => money(Number(value))} />
                  <Legend iconType="circle" verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="category-rows">
              {stats.categories.map((entry) => (
                <div className="category-row" key={entry.name}>
                  <span className="dot" style={{ background: entry.color }} />
                  <span>{entry.name}</span>
                  <span className="muted">{money(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <SectionTitle
            right={
              <Link to="/budgets" className="section-link">
                Manage →
              </Link>
            }
          >
            🎯 Budgets
          </SectionTitle>
          {budgetRows.length === 0 && (
            <div className="muted mini-empty">No budgets set yet.</div>
          )}
          {budgetRows.map((budget) => (
            <div key={budget.id} className="mini-progress">
              <div className="mini-progress-head">
                <span>
                  {CATEGORY_EMOJI[budget.category]} {budget.category}
                </span>
                <span className="muted">
                  {compactMoney(budget.spent)} <span className="faint">/ {compactMoney(budget.amount)}</span>
                </span>
              </div>
              <ProgressBar
                pct={budget.pct}
                tone={budget.over ? "over" : budget.pct >= 80 ? "warn" : undefined}
              />
            </div>
          ))}
        </div>

        <div className="card">
          <SectionTitle
            right={
              <Link to="/goals" className="section-link">
                Manage →
              </Link>
            }
          >
            🎁 Savings goals
          </SectionTitle>
          {goalRows.length === 0 && <div className="muted mini-empty">No goals yet.</div>}
          {goalRows.map(({ goal, progress }) => (
            <div key={goal.id} className="mini-progress">
              <div className="mini-progress-head">
                <span>
                  {goal.icon} {goal.name}
                </span>
                <span className="muted">
                  {compactMoney(goal.savedAmount)} / {compactMoney(goal.targetAmount)}
                </span>
              </div>
              <ProgressBar pct={progress.pct} />
            </div>
          ))}
        </div>

        <div className="card">
          <SectionTitle
            right={
              <Link to="/reminders" className="section-link">
                Manage →
              </Link>
            }
          >
            🔔 Upcoming
          </SectionTitle>
          {upcoming.length === 0 && <div className="muted mini-empty">No reminders yet.</div>}
          {upcoming.map((reminder) => {
            const days = daysUntil(reminder.due);
            return (
              <div className="tx-row compact" key={reminder.id}>
                <span className="tx-ico" aria-hidden="true">
                  {reminder.type === "bill" ? "🧾" : "🐖"}
                </span>
                <div className="tx-main">
                  <div className="tx-title">{reminder.title}</div>
                  <div className="tx-sub">Due {dateShort(reminder.due.toISOString())}</div>
                </div>
                <span
                  className="due-badge"
                  style={{
                    background: days <= 3 ? "rgba(244,63,94,0.16)" : "var(--card-2)",
                    color: days <= 3 ? "var(--red)" : "var(--muted)",
                  }}
                >
                  {days <= 0 ? "today" : `${days}d`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <SectionTitle
          right={
            <Link to="/transactions" className="section-link">
              View all →
            </Link>
          }
        >
          Recent activity
        </SectionTitle>
        {recent.length === 0 ? (
          <EmptyState
            emoji="🧾"
            title="No transactions yet"
            subtitle={`Start by adding your first income or expense — it takes 10 seconds, ${user?.name?.split(" ")[0] || "friend"}.`}
            action={
              <button className="btn btn-primary" onClick={() => setAdding(true)} type="button">
                + Add transaction
              </button>
            }
          />
        ) : (
          recent.map((transaction) => (
            <div className="tx-row" key={transaction.id}>
              <span className="tx-ico" aria-hidden="true">
                {CATEGORY_EMOJI[transaction.category] || "💠"}
              </span>
              <div className="tx-main">
                <div className="tx-title">{transaction.note || transaction.category}</div>
                <div className="tx-sub">
                  {transaction.category} · {dateShort(transaction.date)}
                </div>
              </div>
              <span className={`tx-amt ${transaction.type === "income" ? "pos" : "neg"}`}>
                {transaction.type === "income" ? "+" : "−"}
                {money(transaction.amount)}
              </span>
            </div>
          ))
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

      {showInsights && (
        <Modal title="🤖 All insights" onClose={() => setShowInsights(false)} wide>
          <div className="insight-list">
            {insights.map((insight) => (
              <div className="insight" key={insight.key}>
                <span className="emoji" aria-hidden="true">
                  {insight.emoji}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="insight-title">{insight.title}</div>
                  <div className="muted insight-detail">{insight.detail}</div>
                  <div className="insight-body">{insight.body}</div>
                </div>
                <span className={`pill ${insight.priority}`} style={{ marginLeft: "auto" }}>
                  {insight.priority}
                </span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
