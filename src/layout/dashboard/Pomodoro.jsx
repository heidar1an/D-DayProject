import { useEffect, useRef, useState } from 'react';
import './pomodoro.css';

const POMODORO_DURATION = 25 * 60;

export const toPersianDigits = (value) =>
  String(value).replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

export const formatTimer = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${toPersianDigits(String(minutes).padStart(2, '0'))}:${toPersianDigits(
    String(seconds).padStart(2, '0'),
  )}`;
};

export function usePomodoro() {
  const [secondsLeft, setSecondsLeft] = useState(POMODORO_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    if (!isRunning) return undefined;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setIsRunning(false);
          setTodayCount((count) => count + 1);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  const toggle = () => {
    if (isRunning) {
      setIsRunning(false);
      return;
    }
    if (secondsLeft === 0) {
      setSecondsLeft(POMODORO_DURATION);
    }
    setIsRunning(true);
  };

  return { secondsLeft, isRunning, todayCount, toggle };
}

/* نوشتن نرم برچسب دکمه هنگام تغییر بین «شروع پومودورو» و «توقف» */
function useAnimatedLabel(label) {
  const [displayed, setDisplayed] = useState(label);
  const labelRef = useRef(label);

  useEffect(() => {
    if (labelRef.current === label) return undefined;

    const target = Array.from(label);
    let step = 0;
    setDisplayed('');

    const timer = window.setInterval(() => {
      step += 1;
      setDisplayed(target.slice(0, step).join(''));

      if (step >= target.length) {
        window.clearInterval(timer);
        labelRef.current = label;
      }
    }, 45);

    return () => window.clearInterval(timer);
  }, [label]);

  return displayed;
}

export default function Pomodoro({ secondsLeft, isRunning, todayCount, onToggle }) {
  const elapsedRatio = 1 - secondsLeft / POMODORO_DURATION;
  const buttonLabel = useAnimatedLabel(isRunning ? 'توقف' : 'شروع پومودورو');

  return (
    <div className="pomodoro" dir="rtl">
      <div className="pomodoro__hero">
        <div className={`pomodoro__circle ${isRunning ? 'is-running' : ''}`}>
          <div
            className="pomodoro__water"
            style={{ height: `${elapsedRatio * 100}%` }}
            aria-hidden="true"
          >
            <span className="pomodoro__wave pomodoro__wave--back" />
            <span className="pomodoro__wave pomodoro__wave--front" />
          </div>
          <span className="pomodoro__time">{formatTimer(secondsLeft)}</span>
        </div>

        <span className="pomodoro__mini-time">{formatTimer(secondsLeft)}</span>

        <button className="pomodoro__start-btn" type="button" onClick={onToggle}>
          {buttonLabel}
          <span className="sr-only" aria-live="polite" />
        </button>
      </div>

      <div className="pomodoro__cards">
        <section className="pomodoro-card pomodoro-card--chart" aria-label="نمودار مطالعه هفتگی">
          <h2 className="pomodoro-card__title">تعداد مطالعه پومودو هفت روز اخیر</h2>
          <div className="pomodoro-card__chart-body" aria-hidden="true" />
        </section>

        <section className="pomodoro-card pomodoro-card--today" aria-label="پومودوهای امروز">
          <span className="pomodoro-card__clock-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.5 2" />
            </svg>
          </span>
          <span className="pomodoro-card__today-label">تعداد پومودو امروز</span>
          <strong className="pomodoro-card__today-value">{toPersianDigits(todayCount)}</strong>
        </section>
      </div>
    </div>
  );
}
