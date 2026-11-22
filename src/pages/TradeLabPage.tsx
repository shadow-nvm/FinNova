import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import {
  AnimatedMoney,
  ConfirmDialog,
  Modal,
  PageHead,
  SectionTitle,
  StatCard,
  useToast,
} from "../components/ui";
import { compactMoney, currencySymbol, money } from "../lib/format";
import {
  fetchMarketSnapshot,
  readCachedMarket,
  type MarketAsset,
} from "../lib/market";
import {
  accountSummary,
  buildCoach,
  formatQty,
  MIN_TRADE,
  positionValue,
  priceOf,
  unrealizedPnl,
} from "../lib/trading";
import { usePaper } from "../store/PaperProvider";
import { useSettings } from "../store/SettingsProvider";

/* -------------------------------- helpers --------------------------------- */

function pct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function agoLabel(timestamp: number | null, now: number): string {
  if (!timestamp) return "waiting for data";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 8) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function Sparkline({ values, positive, id }: { values: number[]; positive: boolean; id: string }) {
  const width = 108;
  const height = 34;
  if (values.length < 2) {
    return <span className="sparkline-empty" aria-hidden="true" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = points.join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const color = positive ? "#34d399" : "#f43f5e";
  const gradientId = `spark-${positive ? "up" : "down"}-${id}`;

  return (
    <svg
      className={`sparkline ${positive ? "up" : "down"}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.34" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        className="spark-line"
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
    </svg>
  );
}

/* -------------------------------- buy ticket ------------------------------- */

function BuyTicket({
  asset,
  cash,
  onClose,
  onSubmit,
}: {
  asset: MarketAsset;
  cash: number;
  onClose: () => void;
  onSubmit: (amount: number, stop: number | null, target: number | null) => { ok: true } | { ok: false; error: string };
}) {
  const [amount, setAmount] = useState("");
  const [stop, setStop] = useState(asset.price > 0 ? (asset.price * 0.95).toFixed(2) : "");
  const [target, setTarget] = useState(asset.price > 0 ? (asset.price * 1.1).toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount);
  const stopNum = Number(stop);
  const targetNum = Number(target);
  const hasStop = stop.trim() !== "" && Number.isFinite(stopNum) && stopNum > 0 && stopNum < asset.price;
  const hasTarget =
    target.trim() !== "" && Number.isFinite(targetNum) && targetNum > asset.price;
  const qty = amountNum > 0 && asset.price > 0 ? amountNum / asset.price : 0;
  const risk = hasStop ? (asset.price - stopNum) * qty : null;
  const reward = hasTarget ? (targetNum - asset.price) * qty : null;
  const rewardRisk = risk && reward ? reward / risk : null;
  const tooMuch = amountNum > cash + 0.005;
  const tooSmall = amountNum > 0 && amountNum < MIN_TRADE;
  const valid = amountNum >= MIN_TRADE && !tooMuch && asset.price > 0;

  const submit = () => {
    const result = onSubmit(amountNum, hasStop ? stopNum : null, hasTarget ? targetNum : null);
    if (!result.ok) setError(result.error);
  };

  return (
    <Modal title={`Practice buy · ${asset.name}`} onClose={onClose}>
      <div className="ticket-price">
        <span className="live-dot" aria-hidden="true" />
        <span className="ticket-price-value">{money(asset.price)}</span>
        <span className={asset.change24h >= 0 ? "pos" : "neg"}>{pct(asset.change24h)}</span>
        <span className="faint">24h</span>
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="ticket-amount">Amount to invest</label>
        <div className="input-split">
          <span className="pre">{currencySymbol()}</span>
          <input
            id="ticket-amount"
            type="number"
            min={MIN_TRADE}
            step="0.01"
            inputMode="decimal"
            placeholder={String(MIN_TRADE)}
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
          />
        </div>
        <div className="ticket-chips">
          {[0.1, 0.25, 0.5].map((share) => (
            <button
              key={share}
              type="button"
              className="chip"
              onClick={() => {
                setAmount((Math.floor(cash * share * 100) / 100).toFixed(2));
                setError(null);
              }}
            >
              {share * 100}% of cash
            </button>
          ))}
        </div>
        <div className={`field-hint${tooMuch ? " neg" : ""}`}>
          Available {money(cash)}
          {tooMuch ? " — the amount is larger than your cash balance." : ""}
          {tooSmall ? ` — the minimum trade is ${money(MIN_TRADE)}.` : ""}
        </div>
      </div>

      <div className="form-grid" style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="ticket-stop">Stop-loss (optional)</label>
          <input
            id="ticket-stop"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={stop}
            onChange={(event) => setStop(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ticket-target">Target (optional)</label>
          <input
            id="ticket-target"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </div>
      </div>

      <div className="ticket-preview">
        <div>
          <span className="faint">You get</span>
          <strong>
            {formatQty(qty)} {asset.symbol}
          </strong>
        </div>
        <div>
          <span className="faint">Max loss at stop</span>
          <strong className={risk ? "neg" : ""}>{risk ? money(risk) : "—"}</strong>
        </div>
        <div>
          <span className="faint">Reward : risk</span>
          <strong className={rewardRisk && rewardRisk >= 1.5 ? "pos" : ""}>
            {rewardRisk ? `${rewardRisk.toFixed(1)} : 1` : "—"}
          </strong>
        </div>
      </div>

      <p className="ticket-note">
        This is virtual money. No order is placed with any broker — the goal is to practise the
        decision, not to predict the price.
      </p>

      {error && <div className="error-box">{error}</div>}

      <div className="form-actions">
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={submit}
          disabled={!valid}
        >
          Buy with practice cash
        </button>
      </div>
    </Modal>
  );
}

/* --------------------------------- page ---------------------------------- */

export function TradeLabPage() {
  const { currency } = useSettings();
  const paper = usePaper();
  const notify = useToast();
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "cached" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [ticket, setTicket] = useState<MarketAsset | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setRefreshing(true);
      try {
        const snapshot = await fetchMarketSnapshot(currency, signal);
        setAssets(snapshot.assets);
        setFetchedAt(snapshot.fetchedAt);
        setStatus("live");
        setError(null);
      } catch (cause) {
        if ((cause as { name?: string })?.name === "AbortError") return;
        const cached = readCachedMarket(currency);
        if (cached) {
          setAssets(cached.assets);
          setFetchedAt(cached.fetchedAt);
          setStatus("cached");
        } else {
          setStatus("error");
        }
        setError(cause instanceof Error ? cause.message : "Could not load market data.");
      } finally {
        setRefreshing(false);
      }
    },
    [currency],
  );

  useEffect(() => {
    const cached = readCachedMarket(currency);
    if (cached) {
      setAssets(cached.assets);
      setFetchedAt(cached.fetchedAt);
      setStatus("cached");
    }
    const controller = new AbortController();
    void load(controller.signal);
    const interval = window.setInterval(() => void load(controller.signal), 60_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [currency, load]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(interval);
  }, []);

  const prices = useMemo(
    () => Object.fromEntries(assets.map((asset) => [asset.id, asset.price])),
    [assets],
  );
  const summary = useMemo(
    () => accountSummary(paper.account, prices),
    [paper.account, prices],
  );
  const report = useMemo(() => buildCoach(paper.account, prices), [paper.account, prices]);

  const positions = useMemo(
    () =>
      paper.account.positions.map((position) => {
        const price = priceOf(position.assetId, prices, position.avgPrice);
        return {
          ...position,
          price,
          value: positionValue(position, price),
          pnl: unrealizedPnl(position, price),
          pnlPct: position.avgPrice > 0 ? (price / position.avgPrice - 1) * 100 : 0,
        };
      }),
    [paper.account.positions, prices],
  );

  const history = useMemo(() => [...paper.account.trades].reverse().slice(0, 7), [paper.account.trades]);

  const buy = (asset: MarketAsset, amount: number, stop: number | null, target: number | null) => {
    const result = paper.buy(
      { id: asset.id, symbol: asset.symbol, name: asset.name },
      amount,
      asset.price,
      stop,
      target,
    );
    if (result.ok) {
      setTicket(null);
      notify(`Bought ${money(amount)} of ${asset.name} with practice cash.`);
    }
    return result;
  };

  const closePosition = (positionId: string, symbol: string, price: number) => {
    const result = paper.close(positionId, price);
    if (result.ok) {
      const outcome =
        result.realized > 0
          ? `profit ${money(result.realized)}`
          : result.realized < 0
            ? `loss ${money(Math.abs(result.realized))}`
            : "break-even";
      notify(`Closed ${symbol} · ${outcome}.`, result.realized >= 0 ? "success" : "info");
    } else {
      notify(result.error, "error");
    }
  };

  return (
    <div className="page trade-page">
      <PageHead
        title="Trade Lab"
        sub="Learn to trade with virtual money — live market data, a practice portfolio and a coach that scores your discipline"
        actions={
          <div className="page-actions">
            <button
              className="btn"
              type="button"
              onClick={() => void load()}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing…" : "↻ Refresh prices"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setConfirmReset(true)}>
              Reset practice
            </button>
          </div>
        }
      />

      <div className={`market-status ${status}`} role="status">
        <span className="live-dot" aria-hidden="true" />
        <span>
          {status === "live"
            ? "Live market data"
            : status === "cached"
              ? "Showing last saved prices"
              : status === "error"
                ? "Market feed unavailable"
                : "Connecting to market feed"}
        </span>
        <span className="market-status-sep">·</span>
        <span className="muted">Updated {agoLabel(fetchedAt, now)}</span>
        <span className="market-status-note">Prices from CoinGecko · virtual money only</span>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <StatCard
          label="Practice portfolio"
          value={<AnimatedMoney value={summary.total} />}
          emoji="🧪"
          tone={summary.pnl >= 0 ? "pos" : "neg"}
          foot={`${pct(summary.pnlPct)} vs ${money(paper.account.startingCash)} start`}
        />
        <StatCard
          label="Available cash"
          value={<AnimatedMoney value={paper.account.cash} />}
          emoji="💵"
          foot={`${summary.investedPct.toFixed(0)}% invested`}
        />
        <StatCard
          label="Open P&L"
          value={<AnimatedMoney value={summary.pnl} />}
          emoji="📈"
          tone={summary.pnl >= 0 ? "pos" : "neg"}
          foot={`${positions.length} open ${positions.length === 1 ? "position" : "positions"}`}
        />
      </div>

      <div className="trade-layout">
        <div className="card">
          <SectionTitle
            right={
              <span className={`market-badge ${status}`}>
                <span className="live-dot" aria-hidden="true" />
                {status === "live" ? "Live" : status === "cached" ? "Cached" : "Offline"}
              </span>
            }
          >
            🌍 Live market
          </SectionTitle>

          {error && (
            <div className="market-error">
              <span>{error}</span>
              <button className="banner-retry" type="button" onClick={() => void load()}>
                Retry
              </button>
            </div>
          )}

          <div className="market-list">
            {assets.length === 0 && status !== "error" && (
              <div className="market-skeletons" aria-hidden="true">
                {[0, 1, 2, 3].map((key) => (
                  <div className="skeleton market-skeleton" key={key} />
                ))}
              </div>
            )}
            {assets.map((asset) => (
              <div className="market-row" key={asset.id}>
                <div className="market-id">
                  {asset.image ? (
                    <img src={asset.image} alt="" width={28} height={28} loading="lazy" />
                  ) : (
                    <span className="market-fallback">{asset.symbol.slice(0, 1)}</span>
                  )}
                  <div className="market-name">
                    <span>{asset.name}</span>
                    <span className="market-symbol">{asset.symbol}</span>
                  </div>
                </div>

                <Sparkline
                  values={asset.sparkline}
                  positive={(asset.change7d ?? asset.change24h) >= 0}
                  id={asset.id}
                />

                <div className="market-quote">
                  <span className="market-price">{money(asset.price)}</span>
                  <span className={`change-pill ${asset.change24h >= 0 ? "up" : "down"}`}>
                    {pct(asset.change24h)}
                  </span>
                </div>

                <button
                  className="btn btn-sm btn-primary market-buy"
                  type="button"
                  onClick={() => setTicket(asset)}
                  disabled={asset.price <= 0}
                >
                  Buy
                </button>
              </div>
            ))}
          </div>

          <div className="market-foot">
            <span className="muted">
              {assets.length > 0 ? (
                <>
                  7-day trend · 24h range {compactMoney(assets[0].low24h)} –{" "}
                  {compactMoney(assets[0].high24h)} for {assets[0].name}
                </>
              ) : (
                "Waiting for live prices…"
              )}
            </span>
          </div>
        </div>

        <div className="card coach-card">
          <SectionTitle>🧠 FinNova Coach</SectionTitle>
          <div className="coach-head">
            <div
              className="score-ring"
              style={{ "--score": report.score } as CSSProperties}
              role="img"
              aria-label={`Discipline score ${report.score} out of 100`}
            >
              <div className="score-inner">
                <span className="score-num">{report.score}</span>
                <span className="score-den">/100</span>
              </div>
            </div>
            <div className="coach-head-text">
              <div className="coach-grade">{report.grade}</div>
              <div className="muted coach-note">{report.headline}</div>
            </div>
          </div>

          <div className="coach-metrics">
            <div>
              <span>{report.metrics.openPositions}</span>
              <span>positions</span>
            </div>
            <div>
              <span>{report.metrics.exposurePct.toFixed(0)}%</span>
              <span>invested</span>
            </div>
            <div>
              <span>
                {report.metrics.closedTrades > 0
                  ? `${report.metrics.winRate.toFixed(0)}%`
                  : "—"}
              </span>
              <span>win rate</span>
            </div>
          </div>

          <ul className="coach-tips">
            {report.tips.map((tip) => (
              <li className={tip.tone} key={tip.id}>
                <span className="tip-mark" aria-hidden="true">
                  {tip.tone === "bad" ? "!" : tip.tone === "warn" ? "→" : "✓"}
                </span>
                <span>
                  <strong>{tip.title}</strong>
                  <span className="muted">{tip.detail}</span>
                </span>
              </li>
            ))}
          </ul>

          <Link className="coach-link" to="/learn">
            Read the trading &amp; investing guides <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 20 }}>
        <div className="card">
          <SectionTitle
            right={
              positions.length > 0 ? (
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  {money(summary.holdings)} invested
                </span>
              ) : undefined
            }
          >
            📌 Open positions
          </SectionTitle>

          {positions.length === 0 ? (
            <div className="trade-empty">
              <span className="trade-empty-emoji" aria-hidden="true">
                🧪
              </span>
              <div>
                <strong>No open positions yet</strong>
                <p className="muted">
                  Buy a small amount from the live market above. Set a stop-loss in the ticket so
                  the coach can grade your risk.
                </p>
              </div>
            </div>
          ) : (
            <div className="position-list">
              {positions.map((position) => (
                <div className="position-row" key={position.id}>
                  <div className="position-main">
                    <div className="position-name">
                      {position.name} <span className="faint">{position.symbol}</span>
                    </div>
                    <div className="position-sub">
                      {formatQty(position.qty)} {position.symbol} · avg {money(position.avgPrice)}
                      <span className={position.stop ? "stop-on" : "stop-off"}>
                        {position.stop ? ` · stop ${money(position.stop)}` : " · no stop"}
                      </span>
                    </div>
                  </div>
                  <div className="position-vals">
                    <div className="position-value">{money(position.value)}</div>
                    <div className={position.pnl >= 0 ? "pos" : "neg"}>
                      {position.pnl >= 0 ? "+" : "−"}
                      {money(Math.abs(position.pnl))} ({pct(position.pnlPct)})
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-ghost"
                    type="button"
                    onClick={() =>
                      closePosition(position.id, position.symbol, position.price)
                    }
                  >
                    Close
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <SectionTitle>🧾 Practice history</SectionTitle>
          {history.length === 0 ? (
            <div className="muted mini-empty">Your practice trades will appear here.</div>
          ) : (
            <div className="trade-history">
              {history.map((trade) => (
                <div className="history-row" key={trade.id}>
                  <span className={`side-pill ${trade.side}`}>{trade.side}</span>
                  <div className="history-main">
                    <span>{trade.name}</span>
                    <span className="muted">
                      {formatQty(trade.qty)} {trade.symbol} @ {money(trade.price)}
                    </span>
                  </div>
                  <div className="history-vals">
                    <span>{money(trade.amount)}</span>
                    {trade.realized !== null && (
                      <span className={trade.realized >= 0 ? "pos" : "neg"}>
                        {trade.realized >= 0 ? "+" : "−"}
                        {money(Math.abs(trade.realized))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card playbook" style={{ marginTop: 20 }}>
        <SectionTitle>Trading playbook</SectionTitle>
        <div className="playbook-grid">
          <div className="playbook-item">
            <span className="playbook-num">01</span>
            <strong>Risk 1–2% per trade</strong>
            <p className="muted">
              Size the position from where your stop sits, not from how confident you feel. A
              string of losses should never end the account.
            </p>
          </div>
          <div className="playbook-item">
            <span className="playbook-num">02</span>
            <strong>Set the exit before the entry</strong>
            <p className="muted">
              A stop and a target turn a feeling into a plan. If either one is missing, the trade
              is not ready.
            </p>
          </div>
          <div className="playbook-item">
            <span className="playbook-num">03</span>
            <strong>Expect to be wrong</strong>
            <p className="muted">
              Good traders lose often. What makes them profitable is that winners are bigger than
              losers, not that they are right every time.
            </p>
          </div>
          <div className="playbook-item">
            <span className="playbook-num">04</span>
            <strong>Journal every practice trade</strong>
            <p className="muted">
              One line: why you entered, and what would prove you wrong. Review it before the next
              trade, not after the next loss.
            </p>
          </div>
        </div>
      </div>

      {ticket && (
        <BuyTicket
          asset={ticket}
          cash={paper.account.cash}
          onClose={() => setTicket(null)}
          onSubmit={(amount, stop, target) => buy(ticket, amount, stop, target)}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          title="Reset practice account?"
          message="This clears every practice position and trade and restores your starting virtual balance. Your real FinNova transactions are not touched."
          confirmLabel="Reset practice"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            paper.reset();
            setConfirmReset(false);
            notify("Practice account reset.", "info");
          }}
        />
      )}
    </div>
  );
}
