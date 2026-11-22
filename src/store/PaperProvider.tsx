import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { money } from "../lib/format";
import {
  isPaperAccount,
  MIN_TRADE,
  newPaperAccount,
  STARTING_CASH,
  type PaperAccount,
} from "../lib/trading";

interface TradeAsset {
  id: string;
  symbol: string;
  name: string;
}

export type BuyResult = { ok: true } | { ok: false; error: string };
export type CloseResult = { ok: true; realized: number } | { ok: false; error: string };

interface PaperContextValue {
  account: PaperAccount;
  buy: (
    asset: TradeAsset,
    amount: number,
    price: number,
    stop: number | null,
    target: number | null,
  ) => BuyResult;
  close: (positionId: string, price: number) => CloseResult;
  reset: () => void;
}

const PaperContext = createContext<PaperContextValue | null>(null);

const STORAGE_PREFIX = "finnova_paper_v1";

function storageKeyFor(userId: string | undefined): string {
  return `${STORAGE_PREFIX}:${userId || "guest"}`;
}

function loadAccount(key: string): PaperAccount {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isPaperAccount(parsed)) return parsed;
    }
  } catch {
    /* fall through to a fresh account */
  }
  return newPaperAccount(STARTING_CASH);
}

function saveAccount(key: string, account: PaperAccount): void {
  try {
    localStorage.setItem(key, JSON.stringify(account));
  } catch {
    /* storage can be full or blocked; the in-memory account still works */
  }
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function PaperProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storageKey = storageKeyFor(user?.id);
  const loadedKey = useRef(storageKey);
  const [account, setAccount] = useState<PaperAccount>(() => loadAccount(storageKey));

  // Sign-in or a different account loads its own practice portfolio.
  useEffect(() => {
    if (loadedKey.current === storageKey) return;
    loadedKey.current = storageKey;
    setAccount(loadAccount(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (loadedKey.current !== storageKey) return;
    saveAccount(storageKey, account);
  }, [account, storageKey]);

  const buy = useCallback<PaperContextValue["buy"]>(
    (asset, amountInput, price, stop, target) => {
      const amount = Math.round(Number(amountInput) * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, error: "Enter an amount greater than zero." };
      }
      if (amount < MIN_TRADE) {
        return { ok: false, error: `The smallest practice trade is ${money(MIN_TRADE)}.` };
      }
      if (!Number.isFinite(price) || price <= 0) {
        return { ok: false, error: "Waiting for a live price. Try again in a moment." };
      }
      if (amount > account.cash + 0.005) {
        return { ok: false, error: "That is more than your available practice cash." };
      }

      const qty = amount / price;
      const now = new Date().toISOString();

      setAccount((current) => {
        const existing = current.positions.find((position) => position.assetId === asset.id);
        const positions = existing
          ? current.positions.map((position) =>
              position.assetId === asset.id
                ? {
                    ...position,
                    qty: position.qty + qty,
                    avgPrice:
                      (position.qty * position.avgPrice + amount) / (position.qty + qty),
                    stop: stop ?? position.stop,
                    target: target ?? position.target,
                  }
                : position,
            )
          : [
              ...current.positions,
              {
                id: makeId("pos"),
                assetId: asset.id,
                symbol: asset.symbol,
                name: asset.name,
                qty,
                avgPrice: price,
                openedAt: now,
                stop,
                target,
              },
            ];

        return {
          ...current,
          cash: Math.round((current.cash - amount) * 100) / 100,
          positions,
          trades: [
            ...current.trades,
            {
              id: makeId("trade"),
              assetId: asset.id,
              symbol: asset.symbol,
              name: asset.name,
              side: "buy",
              qty,
              price,
              amount,
              realized: null,
              at: now,
            },
          ],
        };
      });

      return { ok: true };
    },
    [account.cash],
  );

  const close = useCallback<PaperContextValue["close"]>(
    (positionId, price) => {
      const position = account.positions.find((item) => item.id === positionId);
      if (!position) return { ok: false, error: "That position no longer exists." };
      if (!Number.isFinite(price) || price <= 0) {
        return { ok: false, error: "Waiting for a live price. Try again in a moment." };
      }

      const proceeds = position.qty * price;
      const realized = (price - position.avgPrice) * position.qty;
      const now = new Date().toISOString();

      setAccount((current) => ({
        ...current,
        cash: Math.round((current.cash + proceeds) * 100) / 100,
        positions: current.positions.filter((item) => item.id !== positionId),
        trades: [
          ...current.trades,
          {
            id: makeId("trade"),
            assetId: position.assetId,
            symbol: position.symbol,
            name: position.name,
            side: "sell",
            qty: position.qty,
            price,
            amount: proceeds,
            realized,
            at: now,
          },
        ],
      }));

      return { ok: true, realized };
    },
    [account.positions],
  );

  const reset = useCallback(() => {
    setAccount((current) => newPaperAccount(current.startingCash || STARTING_CASH));
  }, []);

  const value = useMemo<PaperContextValue>(
    () => ({ account, buy, close, reset }),
    [account, buy, close, reset],
  );

  return <PaperContext.Provider value={value}>{children}</PaperContext.Provider>;
}

export function usePaper(): PaperContextValue {
  const context = useContext(PaperContext);
  if (!context) throw new Error("usePaper must be used inside PaperProvider");
  return context;
}
