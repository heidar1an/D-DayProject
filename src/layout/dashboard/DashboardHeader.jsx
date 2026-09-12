import { useLayoutEffect, useRef, useState } from 'react';
import Brand from './Brand';
import settingsIcon from '../../../images/icons/icons8-setting-500.png';

const navigationItems = [
  { id: 'dashboard', label: 'داشبورد' },
  { id: 'courses', label: 'دوره‌ها' },
  { id: 'tests', label: 'تست' },
  { id: 'other', label: 'سایر بخش‌ها' },
  { id: 'league', label: 'لیگ' },
];

const indicatorColors = {
  dashboard: 'var(--brown)',
  courses: 'var(--brown)',
  tests: 'var(--brown)',
  other: 'var(--brown)',
  league: 'var(--purple)',
};

export default function DashboardHeader({
  activeSection,
  onSectionChange,
  isSettingsOpen,
  onSettingsToggle,
  areNotificationsOpen,
  onNotificationsToggle,
  headerTime,
  isPomodoroActive,
  isPomodoroRunning,
  isPomodoroBreak,
  isPomodoroFinished,
  onPomodoroOpen,
}) {
  const [indicator, setIndicator] = useState(null);
  const [indicatorKey, setIndicatorKey] = useState(0);
  const linkRefs = useRef([]);
  const wasOverlayOpenRef = useRef(false);
  const isOverlayOpen = isSettingsOpen || areNotificationsOpen;

  useLayoutEffect(() => {
    if (isOverlayOpen) {
      // یکی از لایه‌ها (تنظیمات/اعلان‌ها) باز است؛ پس‌زمینه پشت سرتیترهای اصلی پنهان می‌شود
      wasOverlayOpenRef.current = true;
      setIndicator((current) => (current ? { ...current, opacity: 0 } : current));
      return undefined;
    }

    const returningFromOverlay = wasOverlayOpenRef.current;
    wasOverlayOpenRef.current = false;

    if (returningFromOverlay) {
      // بعد از خروج از لایه، نشانگر باید همان‌جا که هست ظاهر شود نه با انیمیشن از ناکجاآباد
      setIndicatorKey((key) => key + 1);
    }

    const measureIndicator = () => {
      const activeIndex = navigationItems.findIndex((item) => item.id === activeSection);
      const activeElement = linkRefs.current[activeIndex];

      if (activeElement) {
        setIndicator({
          left: activeElement.offsetLeft,
          width: activeElement.offsetWidth,
          opacity: 1,
        });
      } else {
        // بخش پومودو در ناوبری نیست؛ نشانگر باید کاملاً برداشته شود
        setIndicator(null);
      }
    };

    measureIndicator();
    document.fonts?.ready.then(measureIndicator);
    window.addEventListener('resize', measureIndicator);

    return () => window.removeEventListener('resize', measureIndicator);
  }, [activeSection, isOverlayOpen]);

  return (
    /* هدر داشبورد اولین بار که پنل باز می‌شود، با همان انیمیشن نرم لایه‌ها از بالا ظاهر می‌شود */
    <header className="dashboard-header dashboard-layer-reveal--down">
      <div className="dashboard-header__inner">
        <Brand />

        <nav className="dashboard-nav" aria-label="ناوبری داشبورد">
          {indicator && (
            <span
              key={indicatorKey}
              className="dashboard-nav__indicator"
              style={{
                left: `${indicator.left}px`,
                width: `${indicator.width}px`,
                opacity: indicator.opacity,
                backgroundColor: indicatorColors[activeSection],
              }}
              aria-hidden="true"
            />
          )}

          {navigationItems.map((item, index) => (
            <button
              ref={(el) => (linkRefs.current[index] = el)}
              className={`dashboard-nav__link ${
                activeSection === item.id ? 'dashboard-nav__link--active' : ''
              }`}
              type="button"
              aria-current={activeSection === item.id ? 'page' : undefined}
              key={item.id}
              onClick={() => onSectionChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="dashboard-header__actions">
          <button
            className={`dashboard-header__time ${
              isPomodoroActive ? 'dashboard-header__time--active' : ''
            } ${isPomodoroBreak ? 'is-break' : isPomodoroRunning ? 'is-running' : ''} ${
              isPomodoroFinished ? 'is-finished' : ''
            }`}
            aria-label="بخش پومودو"
            aria-pressed={isPomodoroActive}
            onClick={onPomodoroOpen}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span>{headerTime}</span>
          </button>

          <button
            className={`dashboard-header__icon-btn ${
              areNotificationsOpen ? 'dashboard-header__icon-btn--active' : ''
            }`}
            aria-label="اعلان‌ها"
            aria-pressed={areNotificationsOpen}
            onClick={onNotificationsToggle}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
          </button>

          <button className="dashboard-header__icon-btn" aria-label="تنظیمات" aria-pressed={isSettingsOpen}
            onClick={onSettingsToggle}>
            <img src={settingsIcon} alt="" />
          </button>
        </div>
      </div>
    </header>
  );
}
