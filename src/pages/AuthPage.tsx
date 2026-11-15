import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { firebaseEnabled } from "../lib/firebase";

type Tab = "login" | "signup";

export function AuthPage() {
  const { user, authReady, login, signup, resetPassword, startDemo } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  if (!authReady) {
    return (
      <div className="auth-wrap">
        <div style={{ textAlign: "center" }}>
          <div className="brand-logo auth-loading-logo" aria-hidden="true">
            💠
          </div>
          <div className="muted">Restoring your session…</div>
        </div>
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;

  const update = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const switchTab = (next: Tab) => {
    setTab(next);
    setError("");
    setNotice("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!form.email.trim() || !form.password || (tab === "signup" && !form.name.trim())) {
      setError("Please fill in all fields.");
      return;
    }
    setBusy(true);
    try {
      const result =
        tab === "login"
          ? await login(form.email, form.password)
          : await signup(form.name, form.email, form.password);
      if (!result.ok) setError(result.error);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    setError("");
    setNotice("");
    const result = await resetPassword(form.email);
    if (result.ok) {
      setNotice(`Password reset link sent to ${form.email.trim()}. Check your inbox and spam folder.`);
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="auth-logo">
          <div className="brand-logo auth-brand-logo" aria-hidden="true">
            💠
          </div>
          <div>
            <div className="brand-name auth-brand-name">FinNova</div>
            <div className="auth-sub">Smart Personal Finance Hub</div>
          </div>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Authentication">
          <button
            className={`auth-tab${tab === "login" ? " on" : ""}`}
            onClick={() => switchTab("login")}
            type="button"
            role="tab"
            aria-selected={tab === "login"}
          >
            Log in
          </button>
          <button
            className={`auth-tab${tab === "signup" ? " on" : ""}`}
            onClick={() => switchTab("signup")}
            type="button"
            role="tab"
            aria-selected={tab === "signup"}
          >
            Create account
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}
        {notice && <div className="notice-box">{notice}</div>}

        <form onSubmit={submit} noValidate>
          {tab === "signup" && (
            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor="auth-name">Full name</label>
              <input
                id="auth-name"
                autoComplete="name"
                placeholder="Alex Morgan"
                value={form.name}
                onChange={(event) => update({ name: event.target.value })}
              />
            </div>
          )}

          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(event) => update({ email: event.target.value })}
            />
          </div>

          <div className="field" style={{ marginBottom: 18 }}>
            <label htmlFor="auth-password">Password</label>
            <div className="password-field">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={form.password}
                onChange={(event) => update({ password: event.target.value })}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? "One moment…" : tab === "login" ? "Log in to FinNova" : "Create my account"}
          </button>
        </form>

        {tab === "login" && (
          <button className="link-btn" type="button" onClick={() => void forgotPassword()}>
            Forgot password?
          </button>
        )}


        <div className="auth-divider">
          <span>or</span>
        </div>

        <button className="btn btn-block" type="button" onClick={startDemo}>
          ✨ Explore the demo (no account needed)
        </button>

        <div className="note-line">
          {firebaseEnabled
            ? "Protected by Firebase Authentication — your data is stored in your own account."
            : "Firebase is not configured in this build. The demo stores data only in this browser."}
        </div>
      </div>
    </div>
  );
}
