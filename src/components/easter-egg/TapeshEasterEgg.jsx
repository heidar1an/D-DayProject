/*
 * پوستهٔ ایستر اگ — تنها چیزی که در ریشهٔ پروژه مانت می‌شود.
 *
 * • با رویدادِ سراسری باز می‌شود (نه با prop)، پس هر هدری در هر لایه‌ای
 *   می‌تواند فعالش کند.
 * • روی `document.body` پورتال می‌شود تا از هر `overflow`/`transform`/`z-index`
 *   والدینِ درختِ اپ در امان باشد.
 * • با بسته شدن، فرزندِ بازی unmount می‌شود؛ در نتیجه حلقهٔ rAF،
 *   listenerها و بافتِ صدا همه آزاد می‌شوند. بازی بسته = صفر پردازش.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { onEasterEggTrigger } from './egBus';
import { sfx } from './egAudio';
import { readMuted, saveMuted } from './egStorage';
import TapeshPixelGame from './TapeshPixelGame';
import './easterEgg.css';

export default function TapeshEasterEgg() {
  const [open, setOpen] = useState(false);
  const [runId, setRunId] = useState(0);
  const [muted, setMuted] = useState(() => readMuted());
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);

  useEffect(() => {
    sfx.setMuted(muted);
    /* فقط وقتی واقعاً عوض شده بنویس؛ بازِ سایت نباید localStorage را بی‌دلیل دست بزند. */
    if (readMuted() !== muted) saveMuted(muted);
  }, [muted]);

  const openGame = useCallback(() => {
    restoreFocusRef.current = document.activeElement;
    sfx.unlock(); // داخل زنجیرهٔ همان کلیک؛ مرورگر اجازهٔ پخش می‌دهد
    setRunId((id) => id + 1); // اجرای تازه: هیچ وضعیتی از بازی قبلی نمی‌ماند
    setOpen(true);
  }, []);

  useEffect(() => onEasterEggTrigger(openGame), [openGame]);

  const close = useCallback(() => {
    setOpen(false);
    const target = restoreFocusRef.current;
    if (target && typeof target.focus === 'function') {
      try {
        target.focus({ preventScroll: true });
      } catch {
        /* بی‌اهمیت */
      }
    }
  }, []);

  /* Escape + قفلِ اسکرول + تمرکز */
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      /* میان‌برهای کیبوردیِ سایت نباید زیرِ بازی هم فعال بمانند؛
         ترکیب‌های سیستمی (Cmd/Ctrl/Alt) دست‌نخورده می‌مانند. */
      if (!event.metaKey && !event.ctrlKey && !event.altKey) event.stopPropagation();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    panelRef.current?.focus({ preventScroll: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
    };
  }, [open, close]);

  const toggleMute = useCallback((event) => {
    setMuted((value) => !value);
    /* تمرکز از دکمه برداشته می‌شود تا Space بعدی «شلیک» باشد نه فعال‌سازیِ
       دوبارهٔ همین دکمه. */
    event?.currentTarget?.blur?.();
  }, []);

  if (!open) return null;

  return createPortal(
    <div className="eg-root" role="dialog" aria-modal="true" aria-label="بازی پیکسلی تپش">
      <div className="eg-root__backdrop" aria-hidden="true" />

      <div className="eg-root__panel" ref={panelRef} tabIndex={-1}>
        <div className="eg-topbar">
          <span className="eg-topbar__brand">
            <span className="eg-topbar__mark" aria-hidden="true" />
            تپش آرکید
          </span>

          <div className="eg-topbar__actions">
            <button
              type="button"
              className={`eg-icon-btn ${muted ? 'is-muted' : ''}`}
              onClick={toggleMute}
              aria-pressed={muted}
              aria-label={muted ? 'روشن کردن صدا' : 'بی‌صدا کردن بازی'}
            >
              صدا
            </button>
            <button
              type="button"
              className="eg-icon-btn eg-icon-btn--exit"
              onClick={close}
              aria-label="خروج از بازی"
            >
              ✕
            </button>
          </div>
        </div>

        <TapeshPixelGame key={runId} onExit={close} />
      </div>
    </div>,
    document.body,
  );
}
