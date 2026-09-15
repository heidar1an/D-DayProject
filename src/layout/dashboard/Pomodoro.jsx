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

/* ── موج‌های گوی پومودو ──
   هر مسیر سه دورهٔ کامل موج می‌کشد؛ با جابه‌جایی دقیقاً یک دوره، حلقه بی‌درز می‌شود.
   عرض viewBox ثابت است و با preserveAspectRatio روی عرض واقعی گوی کشیده می‌شود. */
const WAVE_VIEWBOX_WIDTH = 600;
const WAVE_HEIGHT = 36;

function buildWavePath(period, amplitude) {
  const mid = WAVE_HEIGHT / 2;
  const cycles = Math.ceil((WAVE_VIEWBOX_WIDTH * 3) / period);
  let path = `M0 ${mid}`;

  for (let index = 0; index < cycles; index += 1) {
    const start = index * period;
    const peak = index % 2 === 0 ? mid - amplitude * 2 : mid + amplitude * 2;
    path += ` Q ${start + period / 2} ${peak} ${start + period} ${mid}`;
  }

  return `${path} L ${cycles * period} ${WAVE_HEIGHT} L 0 ${WAVE_HEIGHT} Z`;
}

/* موج پشت (کم‌رنگ‌تر و بلندتر) و موج رو (هم‌رنگ سطح مایع تا لبه یکدست بماند) */
const WAVE_BACK_PATH = buildWavePath(420, 15);
const WAVE_FRONT_PATH = buildWavePath(300, 11);

/* حباب‌های ریز داخل مایع؛ هر کدام ریتم و اندازهٔ خودش را دارد تا حرکت زنده به نظر برسد */
const POMODORO_BUBBLES = [
  { x: '12%', size: '7px', duration: '7.2s', delay: '-1.4s' },
  { x: '27%', size: '4px', duration: '5.8s', delay: '-4.2s' },
  { x: '44%', size: '9px', duration: '8.6s', delay: '-2.6s' },
  { x: '63%', size: '5px', duration: '6.6s', delay: '-5.4s' },
  { x: '81%', size: '7px', duration: '9.4s', delay: '-3.2s' },
];

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
        <div className={circleClassName} style={{ '--pomodoro-fill': elapsedRatio }}>
          <div
            className="pomodoro__water"
            style={{ height: `${elapsedRatio * 100}%` }}
            aria-hidden="true"
          >
            {/* بدنهٔ مایع: گرادیان عمقی + جلوه‌های سطح و حباب‌ها */}
            <span className="pomodoro__liquid">
              <span className="pomodoro__depth" />
              <span className="pomodoro__sheen" />
              {POMODORO_BUBBLES.map((bubble) => (
                <span
                  key={bubble.x}
                  className="pomodoro__bubble"
                  style={{
                    '--bubble-x': bubble.x,
                    '--bubble-size': bubble.size,
                    '--bubble-duration': bubble.duration,
                    '--bubble-delay': bubble.delay,
                  }}
                />
              ))}
            </span>

            {/* موج‌ها دقیقاً روی خط آب می‌نشینند و سطح مایع را زنده می‌کنند */}
            <svg
              className="pomodoro__waves"
              viewBox={`0 0 ${WAVE_VIEWBOX_WIDTH} ${WAVE_HEIGHT}`}
              preserveAspectRatio="none"
              focusable="false"
            >
              <defs>
                {/* برق سطح: از تاج موج تا خط آب محو می‌شود، پس روی تم آبی و سبز یکسان کار می‌کند */}
                <linearGradient id="pomodoro-surface-light" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                  <stop offset="55%" stopColor="#ffffff" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="pomodoro__wave-path pomodoro__wave-path--back" d={WAVE_BACK_PATH} />
              <path className="pomodoro__wave-path pomodoro__wave-path--front" d={WAVE_FRONT_PATH} />
              <path className="pomodoro__wave-path pomodoro__wave-gloss" d={WAVE_FRONT_PATH} />
            </svg>
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
