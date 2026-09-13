/* ── اجزای مشترک بخش یادداشت ──
   آیکون‌های خطی، مودال و چیپ‌های موضوع/نوع — همه از یک منبع تا زبان بصری
   یادداشت‌ها با بقیهٔ داشبورد یکدست بماند. اعداد فارسی و Skeleton از leagueShared. */

import { useEffect, useRef, useState } from 'react';
import { Skeleton, toFa } from '../league/leagueShared';
import { subjectAccent, subjectLabel } from '../../../services/notes/notesService';

export { Skeleton, toFa };

/* ─────────────────────────── آیکون‌ها ─────────────────────────── */

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function Icon({ name, size = 18, className = '', style }) {
  const paths = {
    note: (
      <>
        <path d="M6 3.5h9.5L19.5 7.5V20a.9.9 0 0 1-.9.9H6a.9.9 0 0 1-.9-.9V4.4A.9.9 0 0 1 6 3.5z" />
        <path d="M15 3.8V8h4.2" />
        <path d="M8.5 12.5h7M8.5 16h4.5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    pin: <path d="M9.5 3.5h5l-.7 6 3 2.5v1.5H5.2v-1.5l3-2.5-.7-6zM12 13.5V20.5" />,
    pinFilled: (
      <path
        d="M9.5 3.5h5l-.7 6 3 2.5v1.5H5.2v-1.5l3-2.5-.7-6zM12 13.5V20.5"
        fill="currentColor"
      />
    ),
    edit: <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17zM13.5 6.5l3 3" />,
    trash: <path d="M4.5 6.5h15M9.5 6V4.5A1 1 0 0 1 10.5 3.5h3a1 1 0 0 1 1 1V6M6.5 6.5l1 13h9l1-13M10 10.5v5M14 10.5v5" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    back: <path d="M11 19l-7-7 7-7M4 12h16" />,
    check: <path d="m5 13 4.2 4.2L19 7.5" />,
    list: <path d="M8 6h12M8 12h12M8 18h12M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
    text: <path d="M5 6h14M12 6v13M9 19h6" />,
    link: (
      <>
        <path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.24 4.24 0 0 0-6-6l-1.5 1.5" />
        <path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.24 4.24 0 0 0 6 6L12.5 17.5" />
      </>
    ),
    tag: (
      <>
        <path d="M3.5 12.5v-7a2 2 0 0 1 2-2h7L21 12l-8.5 8.5z" />
        <circle cx="8" cy="8" r="1.4" />
      </>
    ),
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M3.5 10h17M8 2.8V6M16 2.8V6" />
      </>
    ),
    spark: <path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18.2l-1.8-5.6L4.7 10.8 10.2 9 12 3.5z" />,
    warn: (
      <>
        <path d="M12 3.5 21.5 20h-19z" />
        <path d="M12 10v4M12 17h.01" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2.4" />
        <path d="M5 15V6a2 2 0 0 1 2-2h9" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
      {...strokeProps}
    >
      {paths[name] ?? paths.note}
    </svg>
  );
}

/* چیپ موضوع با اکسنت همان درس */
export function SubjectChip({ subjectId, className = '' }) {
  return (
    <span className={`nt-subject-chip ${className}`} style={{ '--accent': subjectAccent(subjectId) }}>
      {subjectLabel(subjectId)}
    </span>
  );
}

/* نشان نوع یادداشت: متنی یا چک‌لیست */
export function KindBadge({ kind }) {
  return (
    <span className={`nt-kind-badge ${kind === 'checklist' ? 'nt-kind-badge--checklist' : ''}`}>
      <Icon name={kind === 'checklist' ? 'list' : 'text'} size={12} />
      {kind === 'checklist' ? 'چک‌لیست' : 'متنی'}
    </span>
  );
}

/* دکمهٔ حذف دومرحله‌ای — کلیک اول «مطمئنی؟»، کلیک دوم حذف واقعی؛ ۳ ثانیه بعد برمی‌گردد */
export function DeleteButton({ onConfirm, label = 'حذف یادداشت', compact = false }) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const handleClick = () => {
    if (armed) {
      window.clearTimeout(timerRef.current);
      setArmed(false);
      onConfirm?.();
      return;
    }
    setArmed(true);
    timerRef.current = window.setTimeout(() => setArmed(false), 3000);
  };

  return (
    <button
      type="button"
      aria-label={label}
      onClick={handleClick}
      className={`nt-delete-btn ${armed ? 'nt-delete-btn--armed' : ''} ${compact ? 'nt-delete-btn--compact' : ''}`}
    >
      <Icon name="trash" size={compact ? 14 : 15} />
      {!compact && <span>{armed ? 'مطمئنی؟ حذف کن' : 'حذف'}</span>}
    </button>
  );
}

/* مودال پایه — Escape می‌بندد، کلیک روی پس‌زمینه می‌بندد */
export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="بستن" className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className={`nt-modal relative max-h-[88vh] w-full overflow-y-auto rounded-[2rem] border border-white/10 bg-[#232323] p-6 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.9)] md:p-8 ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <header className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg [font-family:'Doran',Tahoma,sans-serif]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl bg-white/5 text-[#aaa] transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon name="close" size={16} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
