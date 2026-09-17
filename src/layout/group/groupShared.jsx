import { useEffect, useRef, useState } from 'react';

/*
 * ── ابزارهای مشترک لایهٔ اشتراک گروهی ──
 *
 * فقط چیزهایی که بیش از یک‌بار مصرف می‌شوند: آیکون‌های خطی، دکمهٔ کپی و
 * کنترلر سگمنتی. هیچ متن یا عددی این‌جا نیست (همه از `groupService`).
 */

/* ── آیکون‌ها: همه با currentColor تا رنگ کارت خودش بنشیند ── */
const base = (className) => ({
  className,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

export function UsersIcon({ className = 'grp-icon' }) {
  return (
    <svg {...base(className)}>
      <circle cx="9" cy="8.4" r="3.4" />
      <path d="M2.8 19.4c0-3.1 2.8-5.2 6.2-5.2s6.2 2.1 6.2 5.2" />
      <path d="M16.4 5.6a3 3 0 0 1 0 5.6M17.6 14.6c2.2.5 3.6 2 3.6 4" />
    </svg>
  );
}

export function KeyIcon({ className = 'grp-icon' }) {
  return (
    <svg {...base(className)}>
      <circle cx="8.2" cy="8.2" r="4.4" />
      <path d="M11.4 11.4 20 20M17 17l-1.9 1.9M14.4 14.4l-1.8 1.8" />
    </svg>
  );
}

export function CopyIcon({ className = 'grp-icon' }) {
  return (
    <svg {...base(className)}>
      <rect x="8.6" y="8.6" width="11.6" height="11.6" rx="2.6" />
      <path d="M15.4 5.8V5.4A1.8 1.8 0 0 0 13.6 3.6H5.8A1.8 1.8 0 0 0 4 5.4v7.8a1.8 1.8 0 0 0 1.8 1.8h.4" />
    </svg>
  );
}

export function CheckIcon({ className = 'grp-icon' }) {
  return (
    <svg {...base(className)}>
      <path d="M4.8 12.6 9.6 17.4 19.2 6.8" />
    </svg>
  );
}

export function LinkIcon({ className = 'grp-icon' }) {
  return (
    <svg {...base(className)}>
      <path d="M9.6 14.4a3.6 3.6 0 0 0 5.1 0l2.9-2.9a3.6 3.6 0 0 0-5.1-5.1l-.9.9" />
      <path d="M14.4 9.6a3.6 3.6 0 0 0-5.1 0l-2.9 2.9a3.6 3.6 0 0 0 5.1 5.1l.9-.9" />
    </svg>
  );
}

export function RefreshIcon({ className = 'grp-icon' }) {
  return (
    <svg {...base(className)}>
      <path d="M20 11.4a8 8 0 1 0-2.6 6.2" />
      <path d="M20 5.4v6h-6" />
    </svg>
  );
}

export function CrownIcon({ className = 'grp-icon' }) {
  return (
    <svg {...base(className)}>
      <path d="M3.4 7.6l3.4 3 5.2-5.6 5.2 5.6 3.4-3-1.6 10.2H5z" />
      <path d="M6 20.6h12" />
    </svg>
  );
}

export function ExitIcon({ className = 'grp-icon' }) {
  return (
    <svg {...base(className)}>
      <path d="M14.6 8.2V5.4A1.8 1.8 0 0 0 12.8 3.6H5.4A1.8 1.8 0 0 0 3.6 5.4v13.2a1.8 1.8 0 0 0 1.8 1.8h7.4a1.8 1.8 0 0 0 1.8-1.8v-2.8" />
      <path d="M9.4 12h11M17.6 8.8 20.8 12l-3.2 3.2" />
    </svg>
  );
}

export function AlertIcon({ className = 'grp-icon' }) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.8v5M12 16.2h.01" />
    </svg>
  );
}

export function ArrowIcon({ className = 'grp-icon' }) {
  return (
    <svg {...base(className)}>
      <path d="M19.2 12H4.8M10.4 5.6 4 12l6.4 6.4" />
    </svg>
  );
}

/*
 * ── دکمهٔ کپی ──
 *
 * وضعیت «کپی شد» فقط وقتی نشان داده می‌شود که نوشتن در کلیپ‌بورد **موفق شده**
 * باشد؛ اگر مرورگر API را ندهد یا رد کند، همان «کپی نشد» می‌آید. تیک سبزِ
 * بی‌پشتوانه در این پروژه ممنوع است.
 */
export function CopyButton({
  text,
  label,
  doneLabel = 'کپی شد',
  failedLabel = 'کپی نشد',
  className = 'grp-copy',
}) {
  const [state, setState] = useState({ copied: false, ok: true });
  const timer = useRef(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const handleCopy = async () => {
    let ok = false;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }

    setState({ copied: true, ok });

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState({ copied: false, ok: true }), 2400);
  };

  const isFailed = state.copied && !state.ok;

  return (
    <button
      type="button"
      className={`${className} ${state.copied ? 'is-copied' : ''} ${isFailed ? 'is-failed' : ''}`}
      onClick={handleCopy}
    >
      <span className="grp-copy__icon" aria-hidden="true">
        {state.copied && state.ok ? <CheckIcon /> : <CopyIcon />}
      </span>
      <span className="grp-copy__label" role="status">
        {state.copied ? (state.ok ? doneLabel : failedLabel) : label}
      </span>
    </button>
  );
}

/*
 * ── فیلد نام نمایشی ──
 *
 * در دو مسیر (ساخت گروه و پیوستن با کد) یک چیز است، پس یک‌بار نوشته شده.
 * نام در فهرست اعضای گروه دیده می‌شود؛ پیش‌فرضش از پروفایل کاربر می‌آید.
 */
export function DisplayNameField({ id, value, onChange, hint }) {
  return (
    <div className="grp-field">
      <label className="grp-field__label" htmlFor={id}>
        نام تو در گروه
      </label>
      <input
        className="grp-field__input"
        id={id}
        name="displayName"
        type="text"
        autoComplete="name"
        maxLength={24}
        placeholder="مثلاً: علی"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="grp-field__hint">{hint}</span>
    </div>
  );
}

/*
 * ── کنترلر سگمنتی (دورهٔ پرداخت) ──
 *
 * همان قرارداد کنترلرهای پروژه: `radiogroup` + `radio` + `aria-checked` و
 * پیمایش با کلیدهای جهت‌دار. چون رابط راست‌به‌چپ است، کلید چپ به گزینهٔ بعدی
 * می‌رود. (نسخهٔ تعرفه‌ها نشانگر لغزان دارد؛ این‌جا عمداً ساده‌تر است.)
 */
export function SegmentedControl({ label, options, value, onChange }) {
  const refs = useRef([]);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );

  const move = (index) => {
    const next = (index + options.length) % options.length;
    onChange(options[next].id);
    refs.current[next]?.focus();
  };

  const handleKeyDown = (event) => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        move(activeIndex + 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        move(activeIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        move(0);
        break;
      case 'End':
        event.preventDefault();
        move(options.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="grp-seg" role="radiogroup" aria-label={label} onKeyDown={handleKeyDown}>
      {options.map((option, index) => {
        const isActive = option.id === value;

        return (
          <button
            className={`grp-seg__option ${isActive ? 'is-active' : ''}`}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            key={option.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            onClick={() => onChange(option.id)}
          >
            <span className="grp-seg__label">{option.label}</span>
            {option.hint && <small className="grp-seg__hint">{option.hint}</small>}
          </button>
        );
      })}
    </div>
  );
}
