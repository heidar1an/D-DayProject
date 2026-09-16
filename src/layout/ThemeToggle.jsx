import { useEffect, useState } from 'react';

import { getTheme, subscribeTheme, toggleTheme } from '../services/theme/themeService';

/*
 * دکمهٔ تعویض تم — یک نسخهٔ واحد برای همهٔ سرصفحه‌ها.
 *
 * آیکون حالتِ مقصد را نشان می‌دهد: در تم تیره خورشید (بزن تا روشن شود)
 * و در تم روشن ماه. اندازهٔ دکمه با `--theme-toggle-size` قابل تنظیم است،
 * پس هر سرصفحه می‌تواند بدون بازتعریف ظاهر، اندازه را با ریتم خودش هم‌آهنگ کند.
 */

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.4 14.2A8.6 8.6 0 0 1 9.8 3.6a8.6 8.6 0 1 0 10.6 10.6Z" />
    </svg>
  );
}

export default function ThemeToggle({ className = '', label }) {
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => subscribeTheme(setTheme), []);

  const isLight = theme === 'light';
  const targetLabel = isLight ? 'حالت تیره' : 'حالت روشن';

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      aria-label={label ?? `تغییر به ${targetLabel}`}
      title={`تغییر به ${targetLabel}`}
      onClick={() => setTheme(toggleTheme())}
    >
      <span className="theme-toggle__icon">{isLight ? <MoonIcon /> : <SunIcon />}</span>
    </button>
  );
}
