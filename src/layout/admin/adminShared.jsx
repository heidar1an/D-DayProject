/*
 * اجزای مشترک پنل مدیریت تپش.
 *
 * همهٔ کامپوننت‌های این لایه از اینجا تغذیه می‌شوند تا رفتار (بارگذاری، خطا،
 * تأیید حذف، پیام موفقیت) در کل پنل یکسان باشد. هیچ کامپوننتی خودش fetch نمی‌زند؛
 * همه از `services/admin/adminService` استفاده می‌کنند.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { IconCheck, IconClose, IconSearch } from './adminIcons';

/* ───────────────────────────── قالب‌بندی فارسی ───────────────────────────── */

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export const toFa = (value) => String(value ?? '').replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

export const faNumber = (value) => toFa(new Intl.NumberFormat('en-US').format(Number(value) || 0));

export function faDate(iso) {
  if (!iso) return '—';
  try {
    return toFa(new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso)));
  } catch {
    return '—';
  }
}

export function faDateTime(iso) {
  if (!iso) return '—';
  try {
    return toFa(
      new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      }).format(new Date(iso)),
    );
  } catch {
    return '—';
  }
}

export function faFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${toFa(size)} بایت`;
  if (size < 1024 * 1024) return `${toFa((size / 1024).toFixed(0))} کیلوبایت`;
  return `${toFa((size / (1024 * 1024)).toFixed(1))} مگابایت`;
}

export function relativeTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);

  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${toFa(minutes)} دقیقه پیش`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${toFa(hours)} ساعت پیش`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${toFa(days)} روز پیش`;

  return faDate(iso);
}

/* ─────────────────────────────── پیام‌ها ─────────────────────────────── */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message, tone = 'success') => {
    counterRef.current += 1;
    const id = counterRef.current;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3600);
  }, [dismiss]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ad-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`ad-toast ad-toast--${toast.tone}`} key={toast.id}>
            <span>{toast.message}</span>
            <button type="button" className="ad-toast__close" onClick={() => dismiss(toast.id)} aria-label="بستن">
              <IconClose width={14} height={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  return context?.notify ?? (() => {});
}

/* ───────────────────────────────‌ گفت‌وگو ─────────────────────────────── */

export function Modal({ open, title, subtitle, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ad-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="ad-modal__scrim" aria-label="بستن" onClick={onClose} />
      <div className={`ad-modal__panel ad-modal__panel--${size}`}>
        <header className="ad-modal__head">
          <div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="ad-iconbtn" onClick={onClose} aria-label="بستن">
            <IconClose />
          </button>
        </header>
        <div className="ad-modal__body">{children}</div>
        {footer ? <footer className="ad-modal__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open, title = 'تأیید عملیات', message, confirmLabel = 'تأیید', tone = 'danger', onConfirm, onCancel, busy = false,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onCancel}
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>انصراف</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      )}
    >
      <p className="ad-confirm__message">{message}</p>
    </Modal>
  );
}

/* ───────────────────────────────‌ کنترل‌ها ─────────────────────────────── */

export function Button({ variant = 'primary', size = 'md', loading = false, children, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`ad-btn ad-btn--${variant} ad-btn--${size} ${className}`.trim()}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <span className="ad-spinner ad-spinner--sm" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function IconButton({ label, tone = 'neutral', children, ...rest }) {
  return (
    <button type="button" className={`ad-iconbtn ad-iconbtn--${tone}`} title={label} aria-label={label} {...rest}>
      {children}
    </button>
  );
}

export function Field({ label, hint, error, required = false, children }) {
  return (
    <label className={`ad-field ${error ? 'is-invalid' : ''}`.trim()}>
      <span className="ad-field__label">
        {label}
        {required ? <em aria-hidden="true">*</em> : null}
      </span>
      {children}
      {error ? <span className="ad-field__error">{error}</span> : hint ? <span className="ad-field__hint">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = '', ...rest }) {
  return <input className={`ad-input ${className}`.trim()} {...rest} />;
}

export function Textarea({ className = '', rows = 4, ...rest }) {
  return <textarea className={`ad-input ad-input--area ${className}`.trim()} rows={rows} {...rest} />;
}

export function Select({ options, className = '', ...rest }) {
  return (
    <select className={`ad-input ad-input--select ${className}`.trim()} {...rest}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="ad-toggle">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange?.(event.target.checked)} />
      <span className="ad-toggle__track" aria-hidden="true"><span className="ad-toggle__thumb" /></span>
      <span className="ad-toggle__text">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'جست‌وجو…', delay = 350 }) {
  const [local, setLocal] = useState(value ?? '');

  useEffect(() => {
    setLocal(value ?? '');
  }, [value]);

  useEffect(() => {
    if (local === (value ?? '')) return undefined;
    const timer = window.setTimeout(() => onChange?.(local), delay);
    return () => window.clearTimeout(timer);
  }, [local, delay, onChange, value]);

  return (
    <div className="ad-search">
      <IconSearch width={16} height={16} />
      <input
        type="search"
        value={local}
        placeholder={placeholder}
        onChange={(event) => setLocal(event.target.value)}
        aria-label={placeholder}
      />
      {local ? (
        <button type="button" onClick={() => setLocal('')} aria-label="پاک کردن">
          <IconClose width={14} height={14} />
        </button>
      ) : null}
    </div>
  );
}

/* ───────────────────────────────‌ نمایش داده ─────────────────────────────── */

const STATUS_LABELS = { draft: 'پیش‌نویس', published: 'منتشرشده', archived: 'بایگانی' };

export function StatusBadge({ status }) {
  return <span className={`ad-badge ad-badge--${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`ad-badge ad-badge--${tone}`}>{children}</span>;
}

export function Card({ title, description, actions, children, className = '', padded = true }) {
  return (
    <section className={`ad-card ${padded ? 'ad-card--padded' : ''} ${className}`.trim()}>
      {title || actions ? (
        <header className="ad-card__head">
          <div>
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="ad-card__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Spinner({ size = 'md' }) {
  return <span className={`ad-spinner ad-spinner--${size}`} role="status" aria-label="در حال بارگذاری" />;
}

export function LoadingBlock({ label = 'در حال بارگذاری…', rows = 4 }) {
  return (
    <div className="ad-loading" aria-busy="true">
      <span className="ad-loading__label"><Spinner size="sm" />{label}</span>
      <div className="ad-loading__rows">
        {Array.from({ length: rows }).map((_, index) => (
          <span className="ad-skeleton" key={index} />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="ad-empty">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const message = error?.message || 'خطای نامشخص';

  return (
    <div className="ad-error" role="alert">
      <strong>مشکلی پیش آمد</strong>
      <p>{message}</p>
      {onRetry ? <Button variant="ghost" size="sm" onClick={onRetry}>تلاش دوباره</Button> : null}
    </div>
  );
}

export function Pagination({ page, pages, total, perPage, onPageChange, onPerPageChange }) {
  if (!total) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div className="ad-pagination">
      <span className="ad-pagination__info">
        {toFa(from)}–{toFa(to)} از {toFa(total)}
      </span>

      <div className="ad-pagination__pages">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          قبلی
        </Button>
        <span className="ad-pagination__current">صفحهٔ {toFa(page)} از {toFa(pages)}</span>
        <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          بعدی
        </Button>
      </div>

      {onPerPageChange ? (
        <label className="ad-pagination__size">
          <span>در هر صفحه</span>
          <select value={perPage} onChange={(event) => onPerPageChange(Number(event.target.value))}>
            {[10, 20, 30, 50].map((size) => (
              <option key={size} value={size}>{toFa(size)}</option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

export function TableWrap({ head, children, empty }) {
  return (
    <div className="ad-table-wrap">
      <table className="ad-table">
        <thead>
          <tr>{head.map((cell) => <th key={cell}>{cell}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty ? <div className="ad-table__empty">{empty}</div> : null}
    </div>
  );
}

export function CheckIcon() {
  return <IconCheck width={15} height={15} />;
}

/* ───────────────────────────────‌ هوک‌ها ─────────────────────────────── */

/*
 * بارگذاری دادهٔ async با حالت‌های loading / error / data.
 * `deps` مثل useEffect کار می‌کند؛ `reload` برای تازه‌سازی دستی است.
 */
export function useAsync(loader, deps = [], { immediate = true } = {}) {
  const [state, setState] = useState({ data: null, loading: immediate, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async (options = {}) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await loaderRef.current(options);
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') return null;
      setState({ data: null, loading: false, error });
      return null;
    }
  }, []);

  useEffect(() => {
    if (!immediate) return undefined;
    let alive = true;

    (async () => {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const data = await loaderRef.current();
        if (alive) setState({ data, loading: false, error: null });
      } catch (error) {
        if (alive && error?.name !== 'AbortError') setState({ data: null, loading: false, error });
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: run, setData: (data) => setState((current) => ({ ...current, data })) };
}

/* تبدیل خطای سرور به نقشهٔ خطای هر فیلد برای فرم‌ها */
export function fieldErrors(error) {
  const fields = error?.fields;
  if (!fields || typeof fields !== 'object') return {};
  return fields;
}
