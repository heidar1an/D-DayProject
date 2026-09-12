import { useEffect, useRef, useState } from 'react';
import './pomodoro.css';

const POMODORO_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;
const STATS_STORAGE_KEY = 'tapesh:pomodoro-stats';

/* آمار پومودوی امروز با کلید تاریخ ذخیره می‌شود تا با رفرش صفحه از بین نرود */
function loadTodayStats() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STATS_STORAGE_KEY) || 'null');
    if (parsed && parsed.date === new Date().toDateString()) {
      return {
        count: Number(parsed.count) || 0,
        seconds: Number(parsed.seconds) || 0,
      };
    }
  } catch {
    // داده خراب؛ مثل روز جدید از صفر شروع می‌شود
  }
  return { count: 0, seconds: 0 };
}

function saveTodayStats(stats) {
  window.localStorage.setItem(
    STATS_STORAGE_KEY,
    JSON.stringify({ date: new Date().toDateString(), ...stats }),
  );
}

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
  const [isBreak, setIsBreak] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [todayStats, setTodayStats] = useState(loadTodayStats);
  const isBreakRef = useRef(false);
  const studiedSecondsRef = useRef(0);

  useEffect(() => {
    isBreakRef.current = isBreak;
  }, [isBreak]);

  useEffect(() => {
    saveTodayStats(todayStats);
  }, [todayStats]);

  useEffect(() => {
    if (!isRunning) return undefined;

    const timer = window.setInterval(() => {
      // زمان استراحت جزو دقایق مطالعه حساب نمی‌شود
      if (!isBreakRef.current) {
        studiedSecondsRef.current += 1;
      }
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  // رسیدن شمارش معکوس به صفر: پایان پومودو یا پایان استراحت
  useEffect(() => {
    if (!isRunning || secondsLeft > 0) return undefined;

    setIsRunning(false);

    if (isBreak) {
      setIsBreak(false);
      setSecondsLeft(POMODORO_DURATION);
      return;
    }

    studiedSecondsRef.current = 0;
    setTodayStats((stats) => ({
      count: stats.count + 1,
      seconds: stats.seconds + POMODORO_DURATION,
    }));
    setIsFinished(true);
  }, [isBreak, isRunning, secondsLeft]);

  const toggle = () => {
    if (isBreak || isFinished) return;

    if (isRunning) {
      setIsRunning(false);
      return;
    }

    if (secondsLeft <= 0 || secondsLeft === POMODORO_DURATION) {
      studiedSecondsRef.current = 0;
    }
    if (secondsLeft <= 0) {
      setSecondsLeft(POMODORO_DURATION);
    }
    setIsRunning(true);
  };

  /* دکمه «پایان پومودو»: یک پومودو و دقایق خوانده‌شده جلسه را ثبت می‌کند؛
     در حالت پایان/استراحت فقط به حالت اولیه برمی‌گرداند */
  const finish = () => {
    if (isBreak) {
      setIsRunning(false);
      setIsBreak(false);
      setIsFinished(false);
      setSecondsLeft(POMODORO_DURATION);
      return;
    }

    if (isFinished) {
      setIsFinished(false);
      setSecondsLeft(POMODORO_DURATION);
      return;
    }

    const studiedSeconds = studiedSecondsRef.current;
    studiedSecondsRef.current = 0;
    setTodayStats((stats) => ({
      count: stats.count + 1,
      seconds: stats.seconds + studiedSeconds,
    }));
    setIsRunning(false);
    setSecondsLeft(0);
    setIsFinished(true);
  };

  const startBreak = () => {
    studiedSecondsRef.current = 0;
    setIsFinished(false);
    setIsBreak(true);
    setSecondsLeft(BREAK_DURATION);
    setIsRunning(true);
  };

  return {
    secondsLeft,
    isRunning: isRunning && !isBreak,
    isBreak,
    isFinished,
    todayCount: todayStats.count,
    todayMinutes: Math.floor(todayStats.seconds / 60),
    toggle,
    finish,
    startBreak,
  };
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

export default function Pomodoro({
  secondsLeft,
  isRunning,
  isBreak,
  isFinished,
  todayCount,
  todayMinutes,
  onToggle,
  onFinish,
  onStartBreak,
}) {
  const duration = isBreak ? BREAK_DURATION : POMODORO_DURATION;
  const elapsedRatio = 1 - secondsLeft / duration;
  const buttonLabel = useAnimatedLabel(isRunning ? 'توقف' : 'شروع پومودورو');
  const circleClassName = [
    'pomodoro__circle',
    isRunning && !isBreak ? 'is-running' : '',
    isBreak ? 'is-break' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const showFinishButton = isBreak || isRunning || secondsLeft < duration;

  return (
    <div className="pomodoro dash-stagger" dir="rtl">
      <div className="pomodoro__hero">
        <div className={circleClassName}>
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

        {isFinished && !isBreak ? (
          <>
            <p className="pomodoro__finish-message" role="status">
              پایان پومودو
            </p>
            <div className="pomodoro__actions">
              <button className="pomodoro__break-btn" type="button" onClick={onStartBreak}>
                استراحت کنید
              </button>
              <button className="pomodoro__finish-btn" type="button" onClick={onFinish}>
                پایان پومودو
              </button>
            </div>
          </>
        ) : (
          <div className="pomodoro__actions">
            {!isBreak && (
              <button className="pomodoro__start-btn" type="button" onClick={onToggle}>
                {buttonLabel}
                <span className="sr-only" aria-live="polite" />
              </button>
            )}
            {showFinishButton && (
              <button className="pomodoro__finish-btn" type="button" onClick={onFinish}>
                پایان پومودو
              </button>
            )}
          </div>
        )}
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
          <span className="pomodoro-card__today-minutes">
            مجموع دقایق مطالعه امروز:{' '}
            <strong>{toPersianDigits(todayMinutes)} دقیقه</strong>
          </span>
        </section>
      </div>
    </div>
  );
}
