import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { canonicalStatus } from '../lib';

/* ---------- loading / empty / error ---------- */

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <div className="spinner" />
      <span className="muted">{label}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {hint && <p className="muted">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-banner" role="alert">
      <span className="error-icon">⚠</span>
      <div className="error-body">
        <strong>Something went wrong</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-outline" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/* ---------- badges / stars ---------- */

const STATUS_TONES: Record<string, string> = {
  pending: 'amber',
  confirmed: 'teal',
  cancelled: 'gray',
  completed: 'navy',
};

export function StatusBadge({ status }: { status: string }) {
  const canon = canonicalStatus(status);
  return <span className={`badge badge-${STATUS_TONES[canon] ?? 'gray'}`}>{canon}</span>;
}

export function Stars({
  value,
  onRate,
  size = 18,
}: {
  value: number;
  onRate?: (v: number) => void;
  size?: number;
}) {
  const filled = Math.round(value);
  return (
    <span className="stars" aria-label={onRate ? 'Rate' : `Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          className={`star ${i <= filled ? 'on' : ''} ${onRate ? 'clickable' : ''}`}
          style={{ fontSize: size }}
          disabled={!onRate}
          onClick={onRate ? () => onRate(i) : undefined}
          aria-label={onRate ? `Rate ${i} star${i > 1 ? 's' : ''}` : undefined}
        >
          ★
        </button>
      ))}
    </span>
  );
}

/* ---------- modal ---------- */

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- form fields ---------- */

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input textarea ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input select ${props.className ?? ''}`} />;
}

/* ---------- misc ---------- */

export function Avatar({ name, size = 52 }: { name: string; size?: number }) {
  const word = name.replace(/^Dr\.?\s*/i, '').trim() || name;
  const init = word
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {init}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </div>
  );
}
