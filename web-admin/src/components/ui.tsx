/**
 * The building blocks every web-admin page is made of, so the pages differ
 * in content, never in how a card, a figure or an empty list looks.
 */

import type {ReactNode} from "react";

import {IconClose} from "@/components/icons";

export function PageHeader({title, subtitle, actions}: {title: string; subtitle?: ReactNode; actions?: ReactNode}) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
  flush = false,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`panel ${className}`}>
      {title || action ? (
        <div className="panel-head">
          <div>
            {title ? <h2 className="panel-title">{title}</h2> : null}
            {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
          </div>
          {action ? <div className="panel-action">{action}</div> : null}
        </div>
      ) : null}
      <div className={flush ? "panel-body-flush" : "panel-body"}>{children}</div>
    </section>
  );
}

export type Tone = "green" | "lime" | "amber" | "coral" | "blue" | "purple" | "gray";

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "green",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon tone-${tone}`}>{icon}</div>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub ? <div className="stat-sub">{sub}</div> : null}
      </div>
    </div>
  );
}

export function Pill({children, tone = "gray"}: {children: ReactNode; tone?: Tone | "red" | "yellow"}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function EmptyState({icon, title, body, action}: {icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode}) {
  return (
    <div className="empty">
      {icon ? <div className="empty-icon">{icon}</div> : null}
      <div className="empty-title">{title}</div>
      {body ? <div className="empty-body">{body}</div> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function Skeleton({height = 16, width = "100%"}: {height?: number; width?: number | string}) {
  return <span className="skeleton" style={{height, width}} aria-hidden="true" />;
}

export function Meter({value, max, tone = "green", label}: {value: number; max: number; tone?: Tone; label?: string}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <span className="meter" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span className={`meter-fill tone-bg-${tone}`} style={{width: `${pct}%`}} />
    </span>
  );
}

export function Modal({title, onClose, children, wide = false}: {title: string; onClose: () => void; children: ReactNode; wide?: boolean}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2 className="panel-title">{title}</h2>
          <button className="icon-btn" aria-label="Đóng" onClick={onClose}>
            <IconClose size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: {value: T; label: string}[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({message, tone = "green", onDone}: {message: string; tone?: "green" | "red"; onDone: () => void}) {
  return (
    <div className={`toast toast-${tone}`} role="status" onAnimationEnd={onDone}>
      {message}
    </div>
  );
}
