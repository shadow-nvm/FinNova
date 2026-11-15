export interface Article {
  id: string;
  category: ArticleCategory;
  emoji: string;
  title: string;
  readMins: number;
  content: string[];
}

export type ArticleCategory = "basics" | "budgeting" | "saving" | "investing" | "safety";

export const ARTICLE_CATEGORIES: Record<ArticleCategory, { emoji: string; label: string }> = {
  basics: { emoji: "🌱", label: "Basics" },
  budgeting: { emoji: "🗺️", label: "Budgeting" },
  saving: { emoji: "🐖", label: "Saving" },
  investing: { emoji: "📈", label: "Investing" },
  safety: { emoji: "🛡️", label: "Avoiding scams" },
};

export const ARTICLES: Article[] = [
  {
    id: "budget-501030",
    category: "budgeting",
    emoji: "🗺️",
    title: "The 50/30/20 rule",
    readMins: 4,
    content: [
      "The 50/30/20 rule is a simple way to budget that works for most people. Split your after-tax income into three buckets:",
      "• 50% — Needs. Rent, groceries, utilities and transport — the essentials.\n• 30% — Wants. Dining out, streaming, hobbies and shopping — the fun stuff.\n• 20% — Savings & debt. Emergency fund, investments and paying off high-interest debt.",
      'It is flexible: if your rent is high, shift a little from "wants" into "needs" for a while. The goal is not perfection — it is being intentional about where your money goes every single month.',
    ],
  },
  {
    id: "begin-budget",
    category: "budgeting",
    emoji: "🧮",
    title: "How to start budgeting as a student",
    readMins: 5,
    content: [
      "As a student, your income is often fixed (allowance, loan or part-time job), so budgeting is about making that money last.",
      'Start by tracking every expense for one month — a tracking app like FinNova makes this effortless. You will quickly see the "money leaks": daily coffee, impulse deliveries, forgotten subscriptions.',
      "Next, plan your month: subtract fixed costs (rent, tuition, phone) from income, split the remainder into spending and saving, then set a realistic daily cap. Revisit each week and adjust — budgeting is a habit, not a one-time task.",
    ],
  },
  {
    id: "emergency-fund",
    category: "saving",
    emoji: "🛟",
    title: "Build an emergency fund",
    readMins: 3,
    content: [
      "An emergency fund is cash set aside for unexpected events: a broken laptop, a sudden bill, or a job gap. It stops you from relying on credit cards or loans.",
      "Aim for 3–6 months of essential expenses as a long-term goal, but start small — a first goal of ₹500 already cushions most surprises.",
      "Tips: keep it separate from your daily account, automate a regular transfer (even ₹20/week adds up to ~₹1,000 a year), and only touch it for real emergencies.",
    ],
  },
  {
    id: "compound-interest",
    category: "investing",
    emoji: "🌱",
    title: "Compound interest, explained simply",
    readMins: 4,
    content: [
      "Compound interest is when your interest earns interest. It is the reason the wealthiest investors rely on time, not chance.",
      "Example: invest ₹1,000 at 7% a year. Year one earns ₹70. Year two earns 7% on ₹1,070 — ₹74.90. Each year, your base grows, so growth accelerates. Over 30 years, that ₹1,000 could grow to over ₹7,600 without adding a cent.",
      "The takeaway: start early. The earlier you start, the more years compound in your favour — even small amounts grow powerfully over decades.",
    ],
  },
  {
    id: "spot-scams",
    category: "safety",
    emoji: "🛡️",
    title: "How to spot a financial scam",
    readMins: 5,
    content: [
      'Scammers rely on urgency and emotion. If someone pressures you to "act now", that is a red flag.',
      'Watch for: promises of guaranteed or absurdly high returns, requests to pay in gift cards or crypto, unexpected "prizes" that need a fee to claim, and unsolicited calls or texts about your bank account.',
      "Defend yourself: never share passwords or verification codes, always send money through official platforms, verify requests by calling the bank or company directly, and enable two-factor authentication everywhere. When in doubt, hang up and double-check.",
    ],
  },
  {
    id: "phishing",
    category: "safety",
    emoji: "📧",
    title: "Spotting phishing emails & texts",
    readMins: 4,
    content: [
      "Phishing is a fake message pretending to be a trusted company to steal your login or money.",
      'Signs: urgent language ("account suspended!"), a link that does not match the sender\'s real domain, generic greetings like "Dear customer", and requests for personal details or codes.',
      "Stay safe: hover over links before clicking, type the official website yourself instead of using emailed links, verify the sender's address carefully, and never enter credentials after clicking a link you were not expecting.",
    ],
  },
  {
    id: "savings-plant-senior",
    category: "saving",
    emoji: "🐖",
    title: "Small savings habits that compound",
    readMins: 3,
    content: [
      "You do not need big income to build wealth — you need repeatable small habits.",
      'Easy wins: pack lunch twice a week, cancel one forgotten subscription, use a "cool-off" 48 hours before buying anything over ₹50, and round up purchases into savings.',
      "Automate the process. When saving is the default and spending is the decision, your future self thanks you every single month.",
    ],
  },
  {
    id: "needs-vs-wants",
    category: "basics",
    emoji: "🌱",
    title: "Needs vs wants — and spending leaks",
    readMins: 3,
    content: [
      "A need is essential to live and work: housing, groceries, transport, utilities, minimum debt payments. Everything else is a want — even if it feels essential.",
      'The "money leak" test: if a ₹10-a-month subscription went unnoticed for a year, you did not need it. Review recurring charges once a month.',
      "Reframing wants as choices, not obligations, puts you back in control. Enjoy them — deliberately, and within your budget.",
    ],
  },
  {
    id: "first-investment",
    category: "investing",
    emoji: "💼",
    title: "Your first investment, safely",
    readMins: 6,
    content: [
      "First, build your emergency fund and pay off high-interest debt — investing money you might urgently need is risky.",
      "If you are just starting, simple options beat clever ones: a diversified index fund or a recurring SIP gives broad exposure for low fees.",
      "Rules of thumb: invest only money you will not need for 5+ years, keep costs low, and ignore short-term noise. Regular, consistent contributions matter more than timing the market perfectly.",
    ],
  },
  {
    id: "credit-score",
    category: "basics",
    emoji: "📊",
    title: "Your credit score, without the mystery",
    readMins: 4,
    content: [
      "A credit score is a lender's shorthand for how reliably you repay borrowed money. In India it is usually a three-digit number from CIBIL or Experian, and it decides the interest rate you are offered.",
      "The biggest factors are simple: pay every bill on time, keep credit-card balances low relative to your limit, avoid opening many loans at once, and let accounts age. A single missed payment can sting for months.",
      "Check your score for free once a year, dispute anything that looks wrong, and remember: using a credit card is not bad — carrying an unpaid balance month after month is.",
    ],
  },
  {
    id: "emergency-vs-invest",
    category: "saving",
    emoji: "🪜",
    title: "Emergency fund first, investing second",
    readMins: 3,
    content: [
      "Investing before you have a cushion is how people are forced to sell at the worst possible moment. Your emergency fund is insurance against having to sell investments at a loss.",
      "Keep three to six months of essential expenses somewhere safe and instantly accessible — a savings account or liquid fund, not equity.",
      "Only once that base exists should you invest surplus cash. Then your investments can stay invested through a bad month instead of being raided for a repair bill.",
    ],
  },
  {
    id: "upi-safety",
    category: "safety",
    emoji: "📱",
    title: "Using UPI safely",
    readMins: 4,
    content: [
      "UPI is fast, which is exactly what scammers like. Remember the golden rule: you never need to enter a PIN or scan a code to receive money.",
      'Common tricks: a "buyer" sends a collect request instead of paying, fake customer-care numbers from a search result, and QR codes that withdraw instead of deposit. Check the payee name on every request before approving.',
      "Never share your UPI PIN, OTP or screen with anyone — not even someone claiming to be from your bank. If a payment goes wrong, report it in the app immediately; the sooner it is flagged, the better the chance of recovery.",
    ],
  },
];
