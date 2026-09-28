/*
 * قطعات مشترک لایهٔ لیگ: زبان بصری «قلب»، آواتار، مدال رتبه، نشان لیگ و ابزارهای عدد فارسی.
 * همهٔ بخش‌های لیگ (پروفایل، جدول، چالش، دستاورد، نوتیفیکیشن) از همین قطعات استفاده می‌کنند
 * تا قلب و آواتار در کل محصول یک شکل و یک رنگ بمانند.
 */
import { useEffect, useRef, useState } from 'react';
import { avatarSrc, fallbackAvatarSrc } from '../setting/avatar/avatarOptions';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** تبدیل ارقام لاتین به فارسی */
export const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/** عدد با جداکنندهٔ هزارگان و ارقام فارسی — ۱۲٬۸۴۰ */
export const faNum = (value) => toFa(Number(value ?? 0).toLocaleString('en-US').replace(/,/g, '٬'));

/* ── آیکن‌ها ── */

export function IconHeart({ className = 'h-[18px] w-[18px]', ariaLabel }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden={ariaLabel ? undefined : true} aria-label={ariaLabel}>
      <defs>
        <linearGradient id="league-heart-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0908d" />
          <stop offset="100%" stopColor="#d15462" />
        </linearGradient>
      </defs>
      <path
        fill="url(#league-heart-grad)"
        d="M12 21c-.4 0-.8-.15-1.1-.42C9.5 19.4 3 14.1 3 9.3 3 6.4 5.2 4 8 4c1.6 0 3.1.8 4 2.1C12.9 4.8 14.4 4 16 4c2.8 0 5 2.4 5 5.3 0 4.8-6.5 10.1-7.9 11.28-.3.27-.7.42-1.1.42z"
      />
      <path
        fill="var(--white)"
        opacity="0.35"
        d="M7.6 6.2c-1.2.4-2.1 1.6-2.2 2.9 0 .4-.5.5-.7.1-.3-.8-.2-1.9.4-2.7.6-.9 1.6-1.4 2.4-1.4.4 0 .5.5.1.7z"
      />
    </svg>
  );
}

const iconPaths = {
  flame: <path d="M12 22c4 0 7-2.8 7-6.8 0-3.1-1.9-5.3-3.4-7-.4-.4-1-.2-1.1.3-.2 1.1-.7 2.3-1.5 3-.1-2.3-1.3-5.4-3.6-7-.4-.3-.9 0-.9.4 0 2-1 3.4-2 4.7C5.5 11 5 12.9 5 15.2 5 19.2 8 22 12 22z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5V5.5M20 18v3H6.5" />
    </>
  ),
  brain: (
    <>
      <path d="M9.5 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3.2 3.2 0 0 0 5 17c0 2 1.8 3.6 4 3.6 1 0 1.5-.4 2.5-.4V3.8A1 1 0 0 0 9.5 3z" />
      <path d="M14.5 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2A3.2 3.2 0 0 1 19 17c0 2-1.8 3.6-4 3.6-1 0-1.5-.4-2.5-.4V3.8A1 1 0 0 1 14.5 3z" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5.5a4 4 0 0 1-8 0z" />
      <path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5" />
      <path d="M12 13.5V17M9 20.5h6M10 17h4l.5 3.5h-5z" />
    </>
  ),
  /* دو شمشیر متقاطع — آیکن چالش‌ها/نبرد (نسخهٔ پیشین مسیر ناقص و شکسته داشت) */
  swords: (
    <>
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
      <path d="m13 19 6-6M16 16l4 4M19 21l2-2" />
      <path d="M5 14 9 18M7 17l-3 3M3 19l2 2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  crown: <path d="M3.5 8.5 7 11l5-6.5L17 11l3.5-2.5-1.5 10h-14zM6 18.5h12" />,
  star: <path d="m12 3 2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 17.2l-5.8 3.6 1.6-6.6-5.2-4.4 6.8-.5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" />
      <path d="M16 5.5a3.5 3.5 0 0 1 0 6.4M18.5 15.6c1.6.8 2.6 2.3 3 4.4" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  diamond: <path d="M12 3 3.5 12 12 21l8.5-9zM3.5 12h17M12 3v18M7.5 7.5 16.5 16.5M16.5 7.5l-9 9" />,
  spark: <path d="M12 2.5c.6 4.8 2.2 6.4 7 7-4.8.6-6.4 2.2-7 7-.6-4.8-2.2-6.4-7-7 4.8-.6 6.4-2.2 7-7zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />,
  shield: <path d="M12 3 5 5.8v5.4c0 4.4 3 8 7 9.8 4-1.8 7-5.4 7-9.8V5.8z" />,
  'shield-star': (
    <>
      <path d="M12 3 5 5.8v5.4c0 4.4 3 8 7 9.8 4-1.8 7-5.4 7-9.8V5.8z" />
      <path d="m12 7.8 1.1 2.4 2.6.2-2 1.7.6 2.5-2.3-1.4-2.3 1.4.6-2.5-2-1.7 2.6-.2z" fill="currentColor" stroke="none" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  warn: (
    <>
      <path d="M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  up: <path d="M12 19V5m-6 6 6-6 6 6" />,
  /* آیکن «؟» — توضیح سطح‌بندی */
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.4A2.7 2.7 0 0 1 12 7.4c1.5 0 2.7 1.1 2.7 2.5 0 1.7-1.6 2.2-2.7 3.1v1" />
      <path d="M12 17.2h.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
};

export function Icon({ name, className = 'h-[18px] w-[18px]', strokeWidth = 1.9, style }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name] ?? iconPaths.star}
    </svg>
  );
}

/* ── آواتار گرد با حلقهٔ رنگی ── */
export function UserAvatar({ avatar, size = 44, ringColor = 'rgb(var(--wash-rgb) / 0.14)', isYou = false }) {
  const src = avatarSrc(avatar) ?? fallbackAvatarSrc();
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-white/5"
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 0 2px ${isYou ? 'rgba(226,109,109,0.85)' : ringColor}`,
      }}
      aria-hidden="true"
    >
      {src && <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
    </span>
  );
}

/* ── مدال رتبه: سه نفر اول ویژه، بقیه خوانا ── */
const MEDALS = { 1: '#e0b45c', 2: '#b9c2cc', 3: '#ab8e7c' };

export function RankChip({ rank, size = 'md' }) {
  const medal = MEDALS[rank];
  const pad = size === 'lg' ? 'h-9 min-w-9 text-base' : 'h-7 min-w-7 text-xs';
  return (
    <span
      className={`grid ${pad} shrink-0 place-items-center rounded-xl [font-family:'Doran','Vazir',Tahoma,sans-serif] ${
        medal ? 'text-[var(--ink-deep)]' : 'bg-white/5 text-[var(--muted)]'
      }`}
      style={medal ? { background: `linear-gradient(150deg, ${medal}, ${medal}bb)` } : undefined}
    >
      {toFa(rank)}
    </span>
  );
}

/* ── نشان لیگ با آیکن اختصاصی ── */
export function TierBadge({ tier, compact = false }) {
  if (!tier) return null;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm"
      style={{ background: `${tier.color}1f`, color: tier.color, boxShadow: `inset 0 0 0 1px ${tier.color}55` }}
    >
      <Icon name={tier.icon} className="h-4 w-4" />
      {compact ? null : <span>لیگ {tier.name}</span>}
    </span>
  );
}

/* ── نوار پیشرفت ── */
export function ProgressBar({ value, max, color = '#937fcd', height = 8, className = '' }) {
  const percent = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <span
      className={`block overflow-hidden rounded-full bg-white/10 ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className="block h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${percent}%`, background: `linear-gradient(270deg, ${color}, ${color}99)` }}
      />
    </span>
  );
}

/* ── پاداش قلب: +۱۰۰ ❤ ── */
export function HeartReward({ amount, size = 'md' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#e26d6d]/12 text-[var(--red-ink)] ${
        size === 'lg' ? 'px-3.5 py-1.5 text-base' : 'px-2.5 py-1 text-xs'
      }`}
      style={{ boxShadow: 'inset 0 0 0 1px rgba(226,109,109,0.35)' }}
      dir="rtl"
    >
      <IconHeart className={size === 'lg' ? 'h-4.5 w-4.5' : 'h-3.5 w-3.5'} />
      <span className="font-bold">+{faNum(amount)}</span>
    </span>
  );
}

export function EmptyState({ icon = 'spark', title, note, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[2rem] border border-dashed border-white/12 bg-white/[0.02] px-6 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/5 text-[var(--faint)]">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <strong className="mt-1 [font-family:'Doran','Vazir',Tahoma,sans-serif]">{title}</strong>
      {note && <p className="max-w-sm text-sm leading-6 text-[var(--faint)]">{note}</p>}
      {action}
    </div>
  );
}

/* ── راهنمای سطح: اطلاعات سطح‌بندی داخل آیکن «؟» کنار نشان لیگ (تب پروفایل) ── */
export function LevelHint({ levelProgress }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  if (!levelProgress) return null;

  return (
    <span ref={boxRef} className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-label="سطح‌بندی چطور کار می‌کند؟"
        onClick={() => setOpen((prev) => !prev)}
        className={`grid h-7 w-7 cursor-pointer place-items-center rounded-full border transition-colors ${
          open
            ? 'border-[#937fcd]/60 bg-[#937fcd]/20 text-[var(--purple-soft-ink)]'
            : 'border-white/12 bg-white/5 text-[var(--muted)] hover:border-white/25 hover:text-white'
        }`}
      >
        <Icon name="help" className="h-4 w-4" />
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-3 block w-60 -translate-x-1/2 rounded-2xl border border-[#937fcd]/30 bg-[#191424]/95 p-4 text-right shadow-[0_18px_40px_-16px_rgb(var(--shadow-rgb)/0.95)] backdrop-blur"
        >
          <strong className="block text-xs [font-family:'Doran','Vazir',Tahoma,sans-serif]">سطح‌بندی چطور کار می‌کند؟</strong>
          <span className="mt-2.5 flex items-center justify-between text-[11px] text-[var(--faint)]">
            <span>سطح فعلی</span>
            <span className="text-sm text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">{toFa(levelProgress.level)}</span>
          </span>
          <ProgressBar value={levelProgress.step} max={levelProgress.stepMax} height={5} className="mt-2" />
          <span className="mt-2 block text-[11px] leading-5 text-[var(--faint)]">
            {toFa(levelProgress.step)} از {toFa(levelProgress.stepMax)} قدم این سطح رفته؛ با هر قلب تازه یک قدم جلو می‌افتی و سطحت بالا می‌رود.
          </span>
        </span>
      )}
    </span>
  );
}

/* ── اسکلت لودینگ ── */
export function Skeleton({ className = '' }) {
  return <span className={`lg-sk block ${className}`} aria-hidden="true" />;
}

/* شمارندهٔ عددی زنده برای اعداد هیرو (قلب، رتبه) */
export function useCountUp(target, { duration = 1100, delay = 250 } = {}) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf;
    let start;
    const tick = (now) => {
      if (start === undefined) start = now;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);
  return value;
}
