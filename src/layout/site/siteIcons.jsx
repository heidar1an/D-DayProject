/*
 * آیکون‌ها و نشان برند — بدون هیچ وابستگی به بقیهٔ پوسته.
 *
 * از `src/App.jsx` جدا شد تا آن فایل غولِ تک‌فایلی نماند.
 */

import { useEffect, useRef, useState } from 'react';
import { useEasterEggClick } from '../../hooks/useEasterEggClick';
import { triggerEasterEgg } from '../../components/easter-egg/egBus';
import heartbeatMark from '../../../images/pictures/600ppi/logo-mark.webp';

function Brand({ interactive = true }) {
  const [burst, setBurst] = useState(false);
  const burstTimer = useRef(0);

  useEffect(
    () => () => {
      if (burstTimer.current) window.clearTimeout(burstTimer.current);
    },
    [],
  );

  const { clickCount, handleClick } = useEasterEggClick({
    enabled: interactive,
    onTrigger: () => {
      setBurst(true);
      if (burstTimer.current) window.clearTimeout(burstTimer.current);
      burstTimer.current = window.setTimeout(() => setBurst(false), 640);
      triggerEasterEgg();
    },
  });

  return (
    <a
      className={`brand ${clickCount >= 4 ? 'is-egg-charging' : ''} ${burst ? 'is-egg-burst' : ''}`}
      href="#top"
      aria-label="بازگشت به ابتدای صفحه"
      onClick={handleClick}
    >
      <span className="brand__mark">
        <img src={heartbeatMark} alt="" />
      </span>
      <span className="brand__word">تپش</span>
    </a>
  );
}

function ArrowIcon() {
  return (
    <span className="arrow-icon" aria-hidden="true">
      <svg viewBox="0 0 48 48" focusable="false">
        <path d="M10 38 38 10M19 10h19v19" />
      </svg>
    </span>
  );
}

function ArrowLeftIcon() {
  return <span aria-hidden="true">←</span>;
}

function HeaderUserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-1a6 6 0 0 1 12 0v1" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="var(--blue-ink)"
        d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.42Z"
      />
      <path
        fill="var(--green-ink)"
        d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.55 0-4.7-1.72-5.47-4.03H3.28v2.53A9.74 9.74 0 0 0 12 21.75Z"
      />
      <path
        fill="var(--gold-ink)"
        d="M6.53 13.83A5.85 5.85 0 0 1 6.22 12c0-.64.11-1.26.31-1.83V7.64H3.28A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.03 4.36l3.25-2.53Z"
      />
      <path
        fill="var(--red-ink)"
        d="M12 6.14c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.23 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.72 5.39l3.25 2.53C7.3 7.86 9.45 6.14 12 6.14Z"
      />
    </svg>
  );
}

/* تیکِ دایرهٔ اعتبارسنجی فیلد — همان نشانهٔ سبزی که در چهارچوب مرجع کنار ورودی پُر می‌نشیند */
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M5 12.6l4.4 4.4L19 7.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ستارهٔ چهارپرِ گوشهٔ کارت شناور */
function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 1.6l2.3 6.6 6.6 2.3-6.6 2.3L12 19.4l-2.3-6.6L3.1 10.5l6.6-2.3z"
      />
    </svg>
  );
}

/*
 * ارقام فارسی/عربی → لاتین. در سطح ماژول است چون هم اعتبارسنجیِ زندهٔ فیلد
 * (`handleFieldInput`) و هم ارسال فرم به آن نیاز دارند؛ دو نسخهٔ جدا یعنی
 * «سبز شدن فیلد» و «پذیرش سرور» می‌توانند از هم واگرا شوند.
 */
function normalizeDigits(value) {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}


export { Brand, ArrowIcon, ArrowLeftIcon, HeaderUserIcon, GoogleIcon, CheckIcon, SparkIcon, normalizeDigits };
