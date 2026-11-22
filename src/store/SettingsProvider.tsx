import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../lib/firebase";
import {
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  countryByCode,
  countryFromLocale,
  currencyByCode,
  isCurrencyCode,
  setActiveCurrency,
} from "../lib/currencies";

export type Theme = "dark" | "light";
export type SettingsSync = "local" | "loading" | "synced" | "error";

export interface AppSettings {
  /** ISO country code, e.g. `IN`. */
  country: string;
  /** Currency amounts are displayed in, e.g. `USD`. */
  currency: string;
  /** Currency the saved amounts are actually stored in, e.g. `INR`. */
  storedCurrency: string;
  theme: Theme;
}

const STORAGE_KEY = "finnova_settings_v1";
const THEME_KEY = "finnova_theme";

function detectCountry(): string {
  try {
    const candidates = [navigator.language, ...(navigator.languages || [])];
    for (const locale of candidates) {
      const country = countryFromLocale(locale);
      if (country) return country.code;
    }
  } catch {
    /* ignore — fall back to the default */
  }
  return DEFAULT_COUNTRY;
}

function loadSettings(): AppSettings {
  // Deliberately start with INR (the app's original data was entered in ₹)
  // instead of guessing from the browser language: silently relabelling
  // stored amounts would misstate people's money. Users pick their country in
  // Settings, and "Use my device's region" detects it on request.
  const defaults: AppSettings = {
    country: DEFAULT_COUNTRY,
    currency: DEFAULT_CURRENCY,
    storedCurrency: DEFAULT_CURRENCY,
    theme: "dark",
  };
  try {
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme === "light" || storedTheme === "dark") defaults.theme = storedTheme;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const country = countryByCode(parsed.country);
    if (country) defaults.country = country.code;
    if (isCurrencyCode(parsed.currency)) defaults.currency = parsed.currency.toUpperCase();
    // Settings saved before this field existed: assume the visible currency is
    // the one amounts are in, so nothing is offered for conversion twice.
    defaults.storedCurrency = isCurrencyCode(parsed.storedCurrency)
      ? parsed.storedCurrency.toUpperCase()
      : defaults.currency;
    if (parsed.theme === "light" || parsed.theme === "dark") defaults.theme = parsed.theme;
  } catch {
    /* storage can be unavailable (private mode); defaults still work */
  }
  return defaults;
}

type AccountPreferences = Pick<AppSettings, "country" | "currency" | "storedCurrency">;

/** Only known fields with valid values are accepted from the account document. */
function readAccountPreferences(raw: Record<string, unknown> | undefined): Partial<AccountPreferences> | null {
  if (!raw) return null;
  const prefs: Partial<AccountPreferences> = {};
  const country = countryByCode(typeof raw.country === "string" ? raw.country : null);
  if (country) prefs.country = country.code;
  if (isCurrencyCode(raw.currency)) prefs.currency = raw.currency.toUpperCase();
  if (isCurrencyCode(raw.storedCurrency)) prefs.storedCurrency = raw.storedCurrency.toUpperCase();
  return Object.keys(prefs).length > 0 ? prefs : null;
}

function accountPayload(settings: AccountPreferences) {
  return {
    country: settings.country,
    currency: settings.currency,
    storedCurrency: settings.storedCurrency,
    updatedAt: serverTimestamp(),
  };
}

function regionPayload(settings: AccountPreferences) {
  return {
    country: settings.country,
    currency: settings.currency,
    updatedAt: serverTimestamp(),
  };
}

// Only the region part is tracked for whole-document writes. `storedCurrency`
// is written on its own so a stale device changing country/currency can never
// overwrite a conversion another device just recorded.
function regionSignature(uid: string, settings: AccountPreferences): string {
  return `${uid}|${settings.country}|${settings.currency}`;
}

interface SettingsContextValue extends AppSettings {
  setCountry: (code: string) => void;
  setCurrency: (code: string) => void;
  /** Records which currency the stored amounts are in (after a conversion). */
  setStoredCurrency: (code: string) => void;
  setTheme: (theme: Theme) => void;
  /** Resets the region (and its currency) to the browser default. */
  resetRegion: () => void;
  /** Whether region/currency are saved to the signed-in account. */
  syncState: SettingsSync;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, isDemo } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [syncState, setSyncState] = useState<SettingsSync>("local");
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // Account the preferences were successfully read from; writes are gated on
  // this so a half-loaded session can never overwrite another account's data.
  const syncedUser = useRef<string | null>(null);
  const lastWritten = useRef("");

  // Configure the money formatters before children render so the first paint
  // already uses the saved currency (no flash of ₹ or $).
  setActiveCurrency(settings.currency);

  // Apply the theme before the browser paints so switching never flashes.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = countryByCode(settings.country)?.locale || "en";
    document.documentElement.dataset.currency = settings.currency;
  }, [settings.theme, settings.country, settings.currency]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      localStorage.setItem(THEME_KEY, settings.theme);
    } catch {
      /* ignore */
    }
  }, [settings]);

  // Read the account's saved region/currency once per signed-in user.
  useEffect(() => {
    if (!db || !user || isDemo) {
      syncedUser.current = null;
      lastWritten.current = "";
      setSyncState("local");
      return undefined;
    }
    const uid = user.id;
    if (syncedUser.current === uid) return undefined;
    let cancelled = false;
    const accountRef = doc(db, "users", uid);
    setSyncState("loading");

    const load = async () => {
      try {
        const snapshot = await getDoc(accountRef);
        if (cancelled) return;
        const remote = readAccountPreferences(snapshot.data());
        const current = settingsRef.current;
        if (remote) {
          const next: AppSettings = { ...current, ...remote };
          lastWritten.current = regionSignature(uid, next);
          syncedUser.current = uid;
          setSettings(next);
        } else {
          await setDoc(accountRef, accountPayload(current));
          if (cancelled) return;
          lastWritten.current = regionSignature(uid, current);
          syncedUser.current = uid;
        }
        setSyncState("synced");
      } catch (cause) {
        console.warn("[FinNova] Account currency sync is unavailable:", cause);
        if (cancelled) return;
        syncedUser.current = null;
        lastWritten.current = "";
        setSyncState("error");
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isDemo]);

  // Persist country/currency changes to the account (theme stays per device).
  useEffect(() => {
    if (!db || !user || isDemo) return;
    if (syncedUser.current !== user.id) return;
    const sig = regionSignature(user.id, settings);
    if (sig === lastWritten.current) return;
    lastWritten.current = sig;
    setDoc(doc(db, "users", user.id), regionPayload(settings), { merge: true })
      .then(() => {
        if (syncedUser.current === user.id) setSyncState("synced");
      })
      .catch((cause) => {
        console.warn("[FinNova] Could not save account preferences:", cause);
        lastWritten.current = "";
        setSyncState("error");
      });
  }, [settings.country, settings.currency, user?.id, isDemo]);

  const setCountry = useCallback((code: string) => {
    const country = countryByCode(code);
    if (!country) return;
    setSettings((current) => ({ ...current, country: country.code, currency: country.currency }));
  }, []);

  const setCurrency = useCallback((code: string) => {
    setSettings((current) => ({ ...current, currency: currencyByCode(code).code }));
  }, []);

  const setStoredCurrency = useCallback(
    (code: string) => {
      const next = currencyByCode(code).code;
      setSettings((current) => ({ ...current, storedCurrency: next }));
      // `storedCurrency` is never included in the region writes above, so this
      // is the only place it is persisted after the initial document.
      if (!db || !user || isDemo || syncedUser.current !== user.id) return;
      setDoc(
        doc(db, "users", user.id),
        { storedCurrency: next, updatedAt: serverTimestamp() },
        { merge: true },
      ).catch((cause) => {
        console.warn("[FinNova] Could not save the stored currency:", cause);
        setSyncState("error");
      });
    },
    [user, isDemo],
  );

  const setTheme = useCallback((theme: Theme) => {
    setSettings((current) => ({ ...current, theme }));
  }, []);

  const resetRegion = useCallback(() => {
    const country = detectCountry();
    setSettings((current) => ({
      ...current,
      country,
      currency: countryByCode(country)?.currency ?? DEFAULT_CURRENCY,
    }));
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      setCountry,
      setCurrency,
      setStoredCurrency,
      setTheme,
      resetRegion,
      syncState,
    }),
    [settings, setCountry, setCurrency, setStoredCurrency, setTheme, resetRegion, syncState],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider");
  return context;
}
