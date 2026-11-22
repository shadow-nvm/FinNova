import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { NAV_ITEMS } from "../lib/constants";
import { activeCurrencyCode, countryByCode } from "../lib/currencies";
import { initials } from "../lib/format";
import { useData } from "../store/DataProvider";
import { useSettings } from "../store/SettingsProvider";

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function AppShell() {
  const { user, logout, isDemo } = useAuth();
  const { error, clearError, retry, fromCache } = useData();
  const { theme, setTheme, country } = useSettings();
  const online = useOnlineStatus();
  const region = countryByCode(country);

  const navLinks = NAV_ITEMS.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
    >
      <span className="ico" aria-hidden="true">
        {item.icon}
      </span>
      <span>{item.label}</span>
    </NavLink>
  ));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo" aria-hidden="true">
            💠
          </div>
          <div>
            <div className="brand-name">FinNova</div>
            <div className="brand-tag">Finance Hub</div>
          </div>
        </div>

        <nav className="side-nav" aria-label="Main">
          {navLinks}
        </nav>

        <div className="sidebar-foot">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "🌙 Dark theme" : "☀️ Light theme"}
            <span className="toggle-track" aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
          </button>

          <div className="mode-badge">
            {isDemo
              ? "Demo mode · local data"
              : fromCache
                ? "📴 Offline cache · will sync"
                : "🔐 Firestore synced"}
          </div>

          <Link className="mode-badge region-badge" to="/settings">
            {region ? `${region.flag} ${region.name}` : country} · {activeCurrencyCode()}
          </Link>

          <div className="user-chip">
            <div className="avatar">{initials(user?.name)}</div>
            <div className="user-meta">
              <div className="user-name" title={user?.name}>
                {user?.name || "User"}
              </div>
              <div className="user-email" title={user?.email}>
                {user?.email || ""}
              </div>
            </div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => void logout()} type="button">
            ↩ Sign out
          </button>
        </div>
      </aside>

      {/* One sticky block on phones so the bar and the tab strip never overlap. */}
      <div className="mobile-head">
        <header className="mobile-topbar">
          <div className="mt-brand">
            <span className="logo" aria-hidden="true">
              💠
            </span>
            <span>FinNova</span>
          </div>
          <div className="mt-actions">
            <Link className="icon-btn" to="/settings" aria-label="Settings">
              ⚙️
            </Link>
            <button
              type="button"
              className="icon-btn"
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
            <span className="avatar">{initials(user?.name)}</span>
            <button
              className="btn btn-sm btn-danger mt-signout"
              onClick={() => void logout()}
              type="button"
            >
              Sign out
            </button>
          </div>
        </header>

        <nav className="mb-nav" aria-label="Main">
          {navLinks}
        </nav>
      </div>

      <main className="main">
        {!online && (
          <div className="offline-banner" role="status">
            <span>📡 You're offline — showing saved data. Changes sync when you reconnect.</span>
          </div>
        )}
        {error && (
          <div className="data-error-banner" role="alert">
            <span>⚠️ {error}</span>
            <div className="banner-actions">
              <button className="banner-retry" onClick={retry} type="button">
                Retry
              </button>
              <button onClick={clearError} aria-label="Dismiss warning" type="button">
                ×
              </button>
            </div>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
