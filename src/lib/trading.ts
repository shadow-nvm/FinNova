/**
 * Paper-trading model and the rule-based coach.
 *
 * The coach is deterministic: it reads the practice account and grades
 * discipline (position sizing, stops, diversification, trade frequency). It is
 * intentionally not presented as an AI model — there is no external LLM here.
 */

export const STARTING_CASH = 100_000;
export const MIN_TRADE = 100;

export interface PaperPosition {
  id: string;
  assetId: string;
  symbol: string;
  name: string;
  qty: number;
  avgPrice: number;
  openedAt: string;
  stop: number | null;
  target: number | null;
}

export interface PaperTrade {
  id: string;
  assetId: string;
  symbol: string;
  name: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  amount: number;
  realized: number | null;
  at: string;
}

export interface PaperAccount {
  startingCash: number;
  cash: number;
  positions: PaperPosition[];
  trades: PaperTrade[];
}

export function newPaperAccount(startingCash = STARTING_CASH): PaperAccount {
  return {
    startingCash,
    cash: startingCash,
    positions: [],
    trades: [],
  };
}

export function isPaperAccount(value: unknown): value is PaperAccount {
  const candidate = value as Partial<PaperAccount> | null;
  return (
    !!candidate &&
    typeof candidate.startingCash === "number" &&
    typeof candidate.cash === "number" &&
    Array.isArray(candidate.positions) &&
    Array.isArray(candidate.trades)
  );
}

export function priceOf(assetId: string, prices: Record<string, number>, fallback: number): number {
  const live = prices[assetId];
  return Number.isFinite(live) && live > 0 ? live : fallback;
}

export function positionValue(position: PaperPosition, price: number): number {
  return position.qty * price;
}

export function unrealizedPnl(position: PaperPosition, price: number): number {
  return (price - position.avgPrice) * position.qty;
}

export interface AccountSummary {
  holdings: number;
  total: number;
  pnl: number;
  pnlPct: number;
  investedPct: number;
}

export function accountSummary(
  account: PaperAccount,
  prices: Record<string, number>,
): AccountSummary {
  const holdings = account.positions.reduce(
    (sum, position) => sum + positionValue(position, priceOf(position.assetId, prices, position.avgPrice)),
    0,
  );
  const total = account.cash + holdings;
  const pnl = total - account.startingCash;
  return {
    holdings,
    total,
    pnl,
    pnlPct: account.startingCash > 0 ? (pnl / account.startingCash) * 100 : 0,
    investedPct: total > 0 ? (holdings / total) * 100 : 0,
  };
}

export type CoachTone = "good" | "warn" | "bad";

export interface CoachTip {
  id: string;
  tone: CoachTone;
  title: string;
  detail: string;
}

export interface CoachMetrics {
  openPositions: number;
  exposurePct: number;
  largestWeightPct: number;
  protectedPct: number;
  closedTrades: number;
  winRate: number;
  profitFactor: number | null;
  buysLast24h: number;
}

export interface CoachReport {
  score: number;
  grade: string;
  headline: string;
  tips: CoachTip[];
  metrics: CoachMetrics;
}

const TONE_ORDER: Record<CoachTone, number> = { bad: 0, warn: 1, good: 2 };

export function buildCoach(
  account: PaperAccount,
  prices: Record<string, number>,
): CoachReport {
  const summary = accountSummary(account, prices);
  const positions = account.positions.map((position) => {
    const price = priceOf(position.assetId, prices, position.avgPrice);
    return {
      position,
      price,
      value: positionValue(position, price),
      weight: summary.total > 0 ? (positionValue(position, price) / summary.total) * 100 : 0,
    };
  });

  const largestWeightPct = positions.reduce((max, item) => Math.max(max, item.weight), 0);
  const protectedPct =
    positions.length === 0
      ? 100
      : (positions.filter((item) => item.position.stop !== null).length / positions.length) * 100;

  const sells = account.trades.filter(
    (trade): trade is PaperTrade & { realized: number } =>
      trade.side === "sell" && trade.realized !== null,
  );
  const wins = sells.filter((trade) => trade.realized > 0);
  const losses = sells.filter((trade) => trade.realized < 0);
  const grossWin = wins.reduce((sum, trade) => sum + trade.realized, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.realized, 0));
  const profitFactor =
    grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Number.POSITIVE_INFINITY : null;

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const buysLast24h = account.trades.filter(
    (trade) => trade.side === "buy" && new Date(trade.at).getTime() >= dayAgo,
  ).length;

  const metrics: CoachMetrics = {
    openPositions: positions.length,
    exposurePct: summary.investedPct,
    largestWeightPct,
    protectedPct,
    closedTrades: sells.length,
    winRate: sells.length > 0 ? (wins.length / sells.length) * 100 : 0,
    profitFactor,
    buysLast24h,
  };

  const tips: CoachTip[] = [];
  let score = 55;

  if (positions.length === 0) {
    tips.push({
      id: "first-trade",
      tone: "warn",
      title: "Place your first practice trade",
      detail:
        "Pick one asset from the live market above and buy a small amount. Set a stop-loss in the ticket — the coach scores whether every position has an exit plan.",
    });
  } else {
    if (positions.length >= 3) {
      score += 8;
    } else {
      tips.push({
        id: "concentration-count",
        tone: "warn",
        title: "Own at least three different assets",
        detail:
          "A single position makes your whole account one story. Three or more unrelated assets softens a bad day in any one of them.",
      });
    }

    if (largestWeightPct <= 40) {
      score += 8;
    } else {
      tips.push({
        id: "largest-weight",
        tone: "bad",
        title: `One position is ${Math.round(largestWeightPct)}% of your account`,
        detail:
          "Keep any single holding under about 40% of the portfolio. If it is larger, trim it or add to the others.",
      });
    }

    if (protectedPct >= 80) {
      score += 12;
    } else {
      tips.push({
        id: "stops",
        tone: "bad",
        title: `${Math.round(100 - protectedPct)}% of your positions have no stop-loss`,
        detail:
          "A stop is the price where you admit the idea was wrong. Decide it before you buy, not after the price falls.",
      });
    }

    const risky = positions.find(({ position, price }) => {
      if (position.stop === null || price <= 0) return false;
      const riskPct = ((price - position.stop) / price) * 100;
      return riskPct * (positionValue(position, price) / Math.max(summary.total, 1)) > 2.5;
    });
    if (risky) {
      tips.push({
        id: "risk-size",
        tone: "warn",
        title: "Risk per trade is above 2%",
        detail:
          "With this stop, a hit on this position would cost more than 2% of your account. Reduce the amount or tighten the stop.",
      });
    }
  }

  if (summary.total > 0 && summary.investedPct > 95) {
    tips.push({
      id: "no-cash",
      tone: "warn",
      title: "You have almost no cash left",
      detail:
        "Keeping 10–20% in cash lets you add to a good idea later without selling something else first.",
    });
  } else if (summary.total > 0 && positions.length > 0) {
    score += 6;
  }

  if (buysLast24h > 3) {
    tips.push({
      id: "overtrading",
      tone: "bad",
      title: `${buysLast24h} buys in the last 24 hours`,
      detail:
        "Frequent trading usually adds fees and emotion, not edge. Write the reason for the next trade before placing it.",
    });
  } else if (buysLast24h > 0) {
    score += 4;
  }

  if (sells.length >= 3) {
    if (profitFactor !== null && profitFactor >= 1.5) {
      score += 12;
    } else if (profitFactor !== null && profitFactor < 1) {
      tips.push({
        id: "profit-factor",
        tone: "warn",
        title: "Losses are bigger than your wins",
        detail:
          "Your average losing trade outweighs your average winner. Aim for at least 1.5× reward to risk before entering.",
      });
    }
    if (metrics.winRate >= 50) score += 4;
  } else {
    tips.push({
      id: "sample",
      tone: "good",
      title: "Close a few trades to unlock performance feedback",
      detail:
        "After three closed trades the coach can compare your win rate, average win and average loss.",
    });
  }

  if (summary.pnl < 0 && account.trades.length > 0) {
    tips.push({
      id: "drawdown",
      tone: "good",
      title: "A drawdown is data, not failure",
      detail:
        "Losing practice money is the cheapest lesson you will get. Note what you expected versus what happened, then size the next trade smaller.",
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade =
    score >= 85
      ? "Disciplined"
      : score >= 70
        ? "On track"
        : score >= 55
          ? "Developing"
          : "Just starting";

  const headline =
    positions.length === 0
      ? "Start small. The coach scores process, not profit."
      : summary.pnl >= 0
        ? "Your practice account is in profit — keep the process boring."
        : "Your practice account is down — check your stops before adding anything.";

  return {
    score,
    grade,
    headline,
    tips: tips.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]).slice(0, 4),
    metrics,
  };
}

/** Formats a fractional coin quantity without noisy trailing zeros. */
export function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return "0";
  return qty.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: qty < 1 ? 6 : 4,
  });
}
