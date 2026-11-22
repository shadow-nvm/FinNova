import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { money } from "../lib/format";

/* ---------------------------------- Toasts --------------------------------- */

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    counter.current += 1;
    const id = counter.current;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone}`} role="status">
            <span className="toast-dot" aria-hidden="true" />
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ---------------------------------- Modal ---------------------------------- */

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div
        className={`modal${wide ? " modal-wide" : ""}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-title">
          <span>{title}</span>
          <button className="modal-x" onClick={onClose} aria-label="Close dialog" type="button">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------ ConfirmDialog ------------------------------ */

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="confirm-text">{message}</p>
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onCancel} type="button" disabled={busy}>
          Cancel
        </button>
        <button className="btn btn-danger" onClick={onConfirm} type="button" disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* --------------------------------- Layout --------------------------------- */

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {right}
    </div>
  );
}

/* -------------------------------- EmptyState ------------------------------- */

export function EmptyState({
  emoji = "📭",
  title,
  subtitle,
  action,
}: {
  emoji?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="big" aria-hidden="true">
        {emoji}
      </div>
      <div className="empty-title">{title}</div>
      {subtitle && <div className="empty-sub">{subtitle}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

/* -------------------------------- ProgressBar ------------------------------ */

export function ProgressBar({ pct, tone }: { pct: number; tone?: "warn" | "over" }) {
  const className = tone === "over" ? "bar-fill over" : tone === "warn" ? "bar-fill warn" : "bar-fill";
  return (
    <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className={className} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

/* --------------------------------- StatCard -------------------------------- */

export function StatCard({
  label,
  value,
  foot,
  emoji,
  tone,
}: {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  emoji: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="card stat">
      <span className="stat-emoji" aria-hidden="true">
        {emoji}
      </span>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone || ""}`}>{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}

/* ------------------------------- Skeletons -------------------------------- */

export function LoadingPage() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading your data">
      <div className="skeleton skeleton-title" />
      <div className="grid cols-4" style={{ marginBottom: 20 }}>
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="card skeleton skeleton-card" />
        ))}
      </div>
      <div className="grid cols-2">
        <div className="card skeleton skeleton-chart" />
        <div className="card skeleton skeleton-chart" />
      </div>
    </div>
  );
}

/* ------------------------------ Money display ------------------------------ */

export function Money({ value, signed = false }: { value: number; signed?: boolean }) {
  return (
    <span className={value < 0 ? "neg" : signed ? "pos" : undefined}>
      {value < 0 ? "−" : signed ? "+" : ""}
      {money(Math.abs(value))}
    </span>
  );
}
