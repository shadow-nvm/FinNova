/**
 * Live market feed.
 *
 * CoinGecko's public API is used because it is keyless and sends
 * `Access-Control-Allow-Origin: *`, so a static Firebase-hosted build can call
 * it directly from the browser. Prices are quoted in the user's active
 * currency. The last good snapshot is cached locally so the lab still shows
 * prices when the network drops.
 */

const API_URL = "https://api.coingecko.com/api/v3/coins/markets";

/** Coins shown in the Trade Lab watchlist, in display order. */
export const WATCHLIST = [
  "bitcoin",
  "ethereum",
  "solana",
  "ripple",
  "cardano",
  "dogecoin",
] as const;

const CACHE_KEY = "finnova_market_cache_v1";
const CACHE_TTL = 1000 * 60 * 10;

export interface MarketAsset {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change1h: number | null;
  change24h: number;
  change7d: number | null;
  marketCap: number;
  high24h: number;
  low24h: number;
  /** Downsampled 7-day price series (relative shape only). */
  sparkline: number[];
  updatedAt: string;
}

export interface MarketSnapshot {
  assets: MarketAsset[];
  currency: string;
  fetchedAt: number;
}

export type MarketErrorKind = "rate-limit" | "network" | "bad-currency" | "unknown";

export class MarketError extends Error {
  kind: MarketErrorKind;

  constructor(message: string, kind: MarketErrorKind) {
    super(message);
    this.name = "MarketError";
    this.kind = kind;
  }
}

interface RawCoin {
  id?: string;
  symbol?: string;
  name?: string;
  image?: string;
  current_price?: number | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  market_cap?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  last_updated?: string;
  sparkline_in_7d?: { price?: number[] };
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNum(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Keeps the sparkline light: at most `max` evenly spaced points. */
function downsample(values: number[], max = 56): number[] {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length <= max) return clean;
  const step = (clean.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, index) => clean[Math.round(index * step)]);
}

function cacheKey(currency: string): string {
  return `${CACHE_KEY}:${currency.toUpperCase()}`;
}

export function readCachedMarket(currency: string): MarketSnapshot | null {
  try {
    const raw = localStorage.getItem(cacheKey(currency));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MarketSnapshot;
    if (!Array.isArray(parsed.assets) || parsed.assets.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedMarket(snapshot: MarketSnapshot): void {
  try {
    localStorage.setItem(cacheKey(snapshot.currency), JSON.stringify(snapshot));
  } catch {
    /* cache is best-effort */
  }
}

export function marketCacheAge(currency: string): number | null {
  const cached = readCachedMarket(currency);
  return cached ? Date.now() - cached.fetchedAt : null;
}

export { CACHE_TTL };

export async function fetchMarketSnapshot(
  currency: string,
  signal?: AbortSignal,
): Promise<MarketSnapshot> {
  const params = new URLSearchParams({
    vs_currency: currency.toLowerCase(),
    ids: WATCHLIST.join(","),
    order: "market_cap_desc",
    sparkline: "true",
    price_change_percentage: "1h,24h,7d",
    precision: "full",
  });

  let response: Response;
  try {
    response = await fetch(`${API_URL}?${params.toString()}`, {
      signal,
      headers: { accept: "application/json" },
    });
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") throw error;
    throw new MarketError("Could not reach the market feed. Check your connection.", "network");
  }

  if (response.status === 429) {
    throw new MarketError(
      "The market feed is rate-limited right now. Prices will refresh in a minute.",
      "rate-limit",
    );
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new MarketError(`No market prices available in ${currency}.`, "bad-currency");
    }
    throw new MarketError(`Market feed returned ${response.status}.`, "network");
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    const message =
      (payload as { error?: string })?.error || "The market feed returned an unexpected response.";
    throw new MarketError(message, "unknown");
  }

  const assets = (payload as RawCoin[])
    .map((coin): MarketAsset | null => {
      if (!coin?.id || !coin?.symbol) return null;
      return {
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name || coin.symbol.toUpperCase(),
        image: coin.image || "",
        price: num(coin.current_price),
        change1h: optionalNum(coin.price_change_percentage_1h_in_currency),
        change24h: num(
          coin.price_change_percentage_24h_in_currency ?? coin.price_change_percentage_24h,
        ),
        change7d: optionalNum(coin.price_change_percentage_7d_in_currency),
        marketCap: num(coin.market_cap),
        high24h: num(coin.high_24h),
        low24h: num(coin.low_24h),
        sparkline: downsample(coin.sparkline_in_7d?.price || []),
        updatedAt: coin.last_updated || new Date().toISOString(),
      };
    })
    .filter((asset): asset is MarketAsset => asset !== null && asset.price > 0);

  if (assets.length === 0) {
    throw new MarketError("No live prices came back. Try refreshing in a moment.", "unknown");
  }

  const snapshot: MarketSnapshot = {
    assets,
    currency: currency.toUpperCase(),
    fetchedAt: Date.now(),
  };
  writeCachedMarket(snapshot);
  return snapshot;
}
