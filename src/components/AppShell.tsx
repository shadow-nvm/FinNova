import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { NAV_ITEMS } from "../lib/constants";
import { initials } from "../lib/format";
import { useData } from "../store/DataProvider";

const THEME_KEY = "finnova_theme";
type Theme = "dark" | "light";

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function AppShell() {
  const { user, mode, logout } = useAuth();
  const { error, clearError } = useData();
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

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
            {mode === "firebase" ? "🔐 Firebase sync enabled" : "Demo mode · local data"}
          </div>

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

      <header className="mobile-topbar">
        <div className="mt-brand">
          <span className="logo" aria-hidden="true">
            💠
          </span>
          <span>FinNova</span>
        </div>
        <div className="mt-actions">
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

      <main className="main">
        {error && (
          <div className="data-error-banner" role="alert">
            <span>⚠️ {error}</span>
            <button onClick={clearError} aria-label="Dismiss warning">
              ×
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
