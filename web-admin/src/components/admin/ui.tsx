"use client";

/**
 * Bộ thành phần giao diện chung của trang quản trị: tiêu đề trang, khung, thẻ số
 * liệu, bảng có phân trang, hộp thoại, trạng thái rỗng/đang tải.
 *
 * Mọi trang dùng cùng bộ này để khoảng cách, cỡ chữ và trạng thái giống nhau;
 * kiểu dáng nằm ở `app/admin.css`.
 */

import {ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState} from "react";

import {Icon, type IconName} from "./Icon";

/* ------------------------------ tiêu đề trang ------------------------------ */

export function PageHeader({title, subtitle, actions}: {title: string; subtitle?: ReactNode; actions?: ReactNode}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

/* ---------------------------------- khung ---------------------------------- */

export function Panel({
  title,
  subtitle,
  actions,
  children,
  flush = false,
  id,
}: {
  title?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Không đệm trong — dành cho bảng cần sát mép khung. */
  flush?: boolean;
  id?: string;
}) {
  return (
    <section className="panel" id={id}>
      {title || actions ? (
        <div className="panel-head">
          <div>
            {title ? <h2 className="panel-title">{title}</h2> : null}
            {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={flush ? "panel-body panel-body-flush" : "panel-body"}>{children}</div>
    </section>
  );
}

/* -------------------------------- thẻ số liệu ------------------------------- */

export type Tone = "green" | "amber" | "red" | "gray" | "blue";

export function Kpi({
  label,
  value,
  hint,
  icon,
  tone = "green",
  negative = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: IconName;
  tone?: Tone;
  negative?: boolean;
}) {
  return (
    <div className="kpi">
      <span className={`kpi-icon tone-${tone}`}>
        <Icon name={icon} size={20} />
      </span>
      <div className="kpi-body">
        <span className="kpi-label">{label}</span>
        <span className={negative ? "kpi-value kpi-negative" : "kpi-value"}>{value}</span>
        {hint ? <span className="kpi-hint">{hint}</span> : null}
      </div>
    </div>
  );
}

export function Pill({tone = "gray", children}: {tone?: Tone; children: ReactNode}) {
  return <span className={`pill tone-${tone}`}>{children}</span>;
}

/* ------------------------------ trạng thái rỗng ----------------------------- */

export function EmptyState({
  icon = "search",
  title,
  hint,
  action,
}: {
  icon?: IconName;
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <p className="empty-title">{title}</p>
      {hint ? <p className="empty-hint">{hint}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function TableSkeleton({rows = 6, cols = 5}: {rows?: number; cols?: number}) {
  return (
    <div className="skeleton-table" aria-busy="true" aria-label="Đang tải">
      {Array.from({length: rows}, (_, r) => (
        <div className="skeleton-row" key={r}>
          {Array.from({length: cols}, (_, c) => (
            <span className="skeleton" key={c} style={{width: `${60 + ((r * 7 + c * 13) % 35)}%`}} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Notice({tone = "red", children}: {tone?: "red" | "green" | "amber" | "blue"; children: ReactNode}) {
  return (
    <div className={`notice tone-${tone}`} role={tone === "red" ? "alert" : "status"}>
      {children}
    </div>
  );
}

/* ----------------------------- tìm kiếm và lọc ----------------------------- */

export function SearchBox({
  value,
  onChange,
  placeholder = "Tìm kiếm…",
  label = "Tìm kiếm",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <label className="searchbox">
      <span className="sr-only">{label}</span>
      <Icon name="search" size={16} />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
    </label>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly {value: string; label: string}[];
}) {
  return (
    <label className="filter">
      <span className="filter-label">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* --------------------------------- phân trang -------------------------------- */

export function usePaged<T>(items: readonly T[], pageSize: number) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  // Lọc làm danh sách ngắn đi thì quay về trang cuối còn tồn tại, không để trang trống.
  const safePage = Math.min(page, pageCount - 1);
  const slice = useMemo(() => items.slice(safePage * pageSize, safePage * pageSize + pageSize), [items, safePage, pageSize]);
  return {page: safePage, setPage, pageCount, slice, total: items.length, pageSize};
}

export function Pager({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
  noun = "mục",
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  noun?: string;
}) {
  if (total === 0) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, page * pageSize + pageSize);
  return (
    <nav className="pager" aria-label="Phân trang">
      <span className="pager-info">
        Hiển thị {from}–{to} / {total} {noun}
      </span>
      <div className="pager-controls">
        <button type="button" className="icon-btn" onClick={() => onPage(page - 1)} disabled={page === 0} aria-label="Trang trước">
          <Icon name="chevronLeft" size={16} />
        </button>
        <span className="pager-page">
          Trang {page + 1} / {pageCount}
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount - 1}
          aria-label="Trang sau"
        >
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </nav>
  );
}

/* ---------------------------------- hộp thoại --------------------------------- */

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Đưa tiêu điểm vào hộp thoại để bàn phím không còn trôi ra trang nền.
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-layer" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={wide ? "dialog dialog-wide" : "dialog"} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="dialog-head">
          <h2 id={titleId} className="dialog-title">
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer ? <div className="dialog-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

/** Thay `window.confirm`: hộp thoại cùng kiểu với phần còn lại, trả về Promise<boolean>. */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & {resolve: (ok: boolean) => void}) | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>(resolve => setState({...options, resolve})),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      state?.resolve(ok);
      setState(null);
    },
    [state],
  );

  const dialog = state ? (
    <Modal
      title={state.title}
      onClose={() => close(false)}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={() => close(false)}>
            Huỷ
          </button>
          <button type="button" className={state.danger ? "btn btn-danger-solid" : "btn btn-primary"} onClick={() => close(true)}>
            {state.confirmLabel ?? "Đồng ý"}
          </button>
        </>
      }
    >
      <p className="dialog-text">{state.message}</p>
    </Modal>
  ) : null;

  return {confirm, dialog};
}

/* --------------------------------- trường nhập -------------------------------- */

export function Field({label, hint, children, htmlFor}: {label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}
