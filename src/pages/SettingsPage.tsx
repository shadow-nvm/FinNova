import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Modal, PageHead, SectionTitle, useToast } from "../components/ui";
import { COUNTRIES, CURRENCIES, currencyByCode, conversionRate } from "../lib/currencies";
import { fullBackupJson } from "../lib/csv";
import { compactMoney, downloadBlob, initials, money, todayInput } from "../lib/format";
import { useData } from "../store/DataProvider";
import { useSettings } from "../store/SettingsProvider";

const SORTED_COUNTRIES = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
const SORTED_CURRENCIES = Object.values(CURRENCIES).sort((a, b) => a.code.localeCompare(b.code));

function formatRate(value: number): string {
  if (!Number.isFinite(value)) return "1";
  if (value >= 100) return value.toFixed(0);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

export function SettingsPage() {
  const { user, mode, logout, demoEnabled } = useAuth();
  const data = useData();
  const notify = useToast();
  const {
    country,
    currency,
    storedCurrency,
    theme,
    setCountry,
    setCurrency,
    setStoredCurrency,
    setTheme,
    resetRegion,
    syncState,
  } = useSettings();
  const [confirmReset, setConfirmReset] = useState(false);
  const [converting, setConverting] = useState(false);
  // Region/currency must not change while the account's saved values load,
  // otherwise the account would overwrite the user's fresh choice.
  const syncing = syncState === "loading";

  const countryDef = COUNTRIES.find((entry) => entry.code === country);
  const currencyDef = currencyByCode(currency);
  const storedDef = currencyByCode(storedCurrency);
  const recordCount =
    data.transactions.length + data.budgets.length + data.goals.length + data.reminders.length;
  const needsConversion = currency !== storedCurrency && recordCount > 0;
  const factor = conversionRate(storedCurrency, currency);

  // With nothing stored yet there is nothing to convert, so the new currency
  // becomes the storage currency straight away.
  const markStoredIfEmpty = (code: string) => {
    if (recordCount === 0 && !data.loading) setStoredCurrency(code);
  };

  const changeCountry = (code: string) => {
    setCountry(code);
    const next = COUNTRIES.find((entry) => entry.code === code);
    if (next) markStoredIfEmpty(next.currency);
  };

  const changeCurrency = (code: string) => {
    setCurrency(code);
    markStoredIfEmpty(code);
  };

  const convert = async () => {
    setConverting(true);
    try {
      await data.convertCurrency(storedCurrency, currency);
      setStoredCurrency(currency);
      notify(`Converted ${recordCount} records from ${storedDef.code} to ${currencyDef.code}.`);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Conversion failed.", "error");
    } finally {
      setConverting(false);
    }
  };

  const keepNumbers = () => {
    setStoredCurrency(currency);
    notify(`Amounts are now read as ${currencyDef.code} without conversion.`, "info");
  };

  const backup = () => {
    downloadBlob(
      fullBackupJson(data.transactions, data.budgets, data.goals, data.reminders),
      `finnova-backup-${todayInput()}.json`,
      "application/json",
    );
    notify("Full backup downloaded.");
  };

  return (
    <div className="page">
      <PageHead title="Settings" sub="Country, currency, appearance and your account" />

      <div className="grid cols-2" style={{ marginBottom: 20 }}>
        <section className="card settings-card">
          <SectionTitle>🌍 Country &amp; currency</SectionTitle>

          <div className="field">
            <label htmlFor="settings-country">Country</label>
            <select
              id="settings-country"
              value={country}
              disabled={converting || syncing}
              onChange={(event) => changeCountry(event.target.value)}
            >
              {SORTED_COUNTRIES.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.flag} {entry.name}
                </option>
              ))}
            </select>
            <div className="field-hint">
              Choosing a country switches to its usual currency. You can pick a different one below.
            </div>
          </div>

          <div className="field">
            <label htmlFor="settings-currency">Currency</label>
            <select
              id="settings-currency"
              value={currency}
              disabled={converting || syncing}
              onChange={(event) => changeCurrency(event.target.value)}
            >
              {SORTED_CURRENCIES.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.code} — {entry.name} ({entry.symbol})
                </option>
              ))}
            </select>
            <div className="field-hint">
              Used for every amount, chart, report, budget and goal across the app.
            </div>
          </div>

          <div className="currency-preview" aria-label="Currency preview">
            <div className="preview-line">
              <span className="muted">Full amount</span>
              <span>{money(1234.5)}</span>
            </div>
            <div className="preview-line">
              <span className="muted">Compact (charts)</span>
              <span>{compactMoney(125000)}</span>
            </div>
            <div className="preview-line">
              <span className="muted">Zero</span>
              <span>{money(0)}</span>
            </div>
          </div>

          <div className="rate-note">
            Region: {countryDef ? `${countryDef.flag} ${countryDef.name}` : country} ·{" "}
            {currencyDef.decimals === 0 ? "no decimals" : `${currencyDef.decimals} decimals`} ·{" "}
            {currencyDef.locale}
          </div>

          <button
            className="btn btn-sm btn-ghost"
            type="button"
            onClick={resetRegion}
            disabled={converting || syncing}
          >
            Use my device's region
          </button>
        </section>

        <section className="card settings-card">
          <SectionTitle>💱 Convert existing amounts</SectionTitle>

          {needsConversion ? (
            <div className="convert-panel">
              <div>
                Your numbers are still stored in <strong>{storedDef.code}</strong>. Converting
                rewrites {recordCount} record{recordCount === 1 ? "" : "s"} at the reference rate
                below so totals keep the same real value.
              </div>
              <div className="convert-rate">
                1 {storedDef.code} ≈ {formatRate(factor)} {currencyDef.code}
              </div>
              <div className="row-actions">
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={() => void convert()}
                  disabled={converting || syncing}
                >
                  {converting
                    ? "Converting…"
                    : syncing
                      ? "Checking your account…"
                      : `Convert to ${currencyDef.code}`}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={keepNumbers}
                  disabled={converting || syncing}
                >
                  Keep numbers as they are
                </button>
              </div>
            </div>
          ) : (
            <div className="muted settings-note">
              Amounts are stored in <strong>{storedDef.code}</strong>. If you change currency,
              FinNova offers to convert your existing transactions, budgets, goals and reminders —
              nothing is rewritten until you confirm.
            </div>
          )}

          {syncState === "synced" && (
            <div className="sync-note">
              ☁️ Saved to your account — this currency is used on your other devices too.
            </div>
          )}
          {syncState === "error" && (
            <div className="sync-note error">
              ⚠️ Account sync failed. Deploy the updated Firestore rules for the <code>users</code>{" "}
              collection, then reload. This device keeps the currency until then.
            </div>
          )}

          <div className="rate-note">
            Reference rates are built in and approximate; they do not fetch live market data.
            Bank or card rates will differ slightly.
          </div>

          <div className="settings-rows">
            <div className="setting-row">
              <div>
                <div className="setting-title">Total records</div>
                <div className="muted setting-sub">
                  {data.transactions.length} transactions · {data.budgets.length} budgets ·{" "}
                  {data.goals.length} goals · {data.reminders.length} reminders
                </div>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <div className="setting-title">Export a backup</div>
                <div className="muted setting-sub">One JSON file with everything in your account.</div>
              </div>
              <button className="btn btn-sm" type="button" onClick={backup}>
                ⬇ Download
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="grid cols-2">
        <section className="card settings-card">
          <SectionTitle>🎨 Appearance</SectionTitle>
          <div className="chip-row" role="group" aria-label="Theme">
            <button
              type="button"
              className={`chip${theme === "dark" ? " on" : ""}`}
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
            >
              🌙 Dark
            </button>
            <button
              type="button"
              className={`chip${theme === "light" ? " on" : ""}`}
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
            >
              ☀️ Light
            </button>
          </div>
          <div className="rate-note">
            The theme is remembered on this device. Country and currency are remembered here too.
          </div>
        </section>

        <section className="card settings-card">
          <SectionTitle>👤 Account</SectionTitle>
          <div className="user-chip settings-user">
            <div className="avatar">{initials(user?.name)}</div>
            <div className="user-meta">
              <div className="user-name">{user?.name || "User"}</div>
              <div className="user-email">{user?.email || ""}</div>
            </div>
          </div>
          <div className="rate-note">
            {mode === "firebase"
              ? "Signed in with Firebase Authentication. Your data is synced to Cloud Firestore."
              : "Demo workspace — data stays in this browser only."}
          </div>
          <div className="row-actions">
            <button
              className="btn btn-danger btn-sm"
              type="button"
              onClick={() => setConfirmReset(true)}
            >
              Sign out
            </button>
            {demoEnabled && mode === "demo" && (
              <span className="pill med">Development demo session</span>
            )}
          </div>
        </section>
      </div>

      {confirmReset && (
        <Modal title="Sign out?" onClose={() => setConfirmReset(false)}>
          <p className="confirm-text">
            You will need to sign in again to reach your Firestore data. Nothing is deleted.
          </p>
          <div className="form-actions">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setConfirmReset(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              type="button"
              onClick={() => {
                setConfirmReset(false);
                void logout();
              }}
            >
              Sign out
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
