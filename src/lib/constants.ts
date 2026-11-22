export const EXPENSE_CATEGORIES = [
  "Food",
  "Housing",
  "Transport",
  "Shopping",
  "Entertainment",
  "Health",
  "Utilities",
  "Education",
  "Travel",
  "Other",
] as const;

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Allowance",
  "Investments",
  "Gifts",
  "Other income",
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  Food: "#f43f5e",
  Housing: "#8b5cf6",
  Transport: "#22d3ee",
  Shopping: "#f59e0b",
  Entertainment: "#ec4899",
  Health: "#34d399",
  Utilities: "#60a5fa",
  Education: "#a78bfa",
  Travel: "#2dd4bf",
  Other: "#94a3b8",
  Salary: "#34d399",
  Freelance: "#22d3ee",
  Allowance: "#fbbf24",
  Investments: "#60a5fa",
  Gifts: "#f472b6",
  "Other income": "#a78bfa",
};

export const CATEGORY_EMOJI: Record<string, string> = {
  Food: "🍕",
  Housing: "🏠",
  Transport: "🚗",
  Shopping: "🛍️",
  Entertainment: "🎬",
  Health: "💊",
  Utilities: "💡",
  Education: "📚",
  Travel: "✈️",
  Other: "📦",
  Salary: "💼",
  Freelance: "🧑‍💻",
  Allowance: "🪙",
  Investments: "📈",
  Gifts: "🎁",
  "Other income": "💰",
};

export const GOAL_ICONS = ["🛟", "💻", "✈️", "🚗", "🏠", "🎓", "💍", "🎮", "🎁", "🏖️"];

export const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/transactions", label: "Transactions", icon: "🧾" },
  { to: "/budgets", label: "Budgets", icon: "🎯" },
  { to: "/goals", label: "Goals", icon: "🎁" },
  { to: "/reminders", label: "Reminders", icon: "🔔" },
  { to: "/reports", label: "Reports", icon: "📈" },
  { to: "/learn", label: "Learn", icon: "📚" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
] as const;

export const MAX_REMINDER_DAY = 28;
