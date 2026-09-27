import { useEffect, useId, useMemo, useRef, useState } from 'react';
import './pomodoro.css';

const POMODORO_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;
const STATS_STORAGE_KEY = 'tapesh:pomodoro-stats';
const HISTORY_STORAGE_KEY = 'tapesh:pomodoro-history';
/* نمودار هفتگی از همین دفتر می‌خواند؛ بیشتر از این لازم نیست نگه داریم */
const HISTORY_DAYS = 30;
const WEEK_DAYS = 7;

/* کلید روز (YYYY-MM-DD محلی) — همان قرارداد `toDayKey` سرویس قلب */
function dayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function loadHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) || 'null');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // داده خراب؛ دفتر خالی خوانده می‌شود
  }
  return {};
}

/* آمار پومودوی امروز با کلید تاریخ ذخیره می‌شود تا با رفرش صفحه از بین نرود */
function loadTodayStats() {
  const fromHistory = loadHistory()[dayKey(new Date())];

  if (fromHistory) {
    return {
      count: Number(fromHistory.count) || 0,
      seconds: Number(fromHistory.seconds) || 0,
    };
  }

  /* مهاجرت: پیش از دفتر روزانه، آمار فقط در کلید تک‌روز ذخیره می‌شد */
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

/* آمار امروز هم در کلید تک‌روز می‌ماند و هم به دفتر روزانه اضافه می‌شود؛
   دفتر با هر ذخیره به HISTORY_DAYS روز آخر هرس می‌شود تا بی‌مرز رشد نکند */
function saveTodayStats(stats) {
  const today = new Date();

  window.localStorage.setItem(
    STATS_STORAGE_KEY,
    JSON.stringify({ date: today.toDateString(), ...stats }),
  );

  const history = loadHistory();
  history[dayKey(today)] = { count: stats.count, seconds: stats.seconds };

  const trimmed = {};
  Object.keys(history)
    .sort()
    .slice(-HISTORY_DAYS)
    .forEach((key) => {
      trimmed[key] = history[key];
    });

  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
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

  /* دکمه «پایان پومودو»: دقایق خوانده‌شدهٔ جلسه را ثبت می‌کند، ولی شمارندهٔ پومودو
     فقط وقتی یک عدد بالا می‌رود که جلسه کاملِ ۲۵ دقیقه طی شده باشد؛ جلسهٔ نیمه‌کاره
     (مثلاً ۱۵ دقیقه) تنها «مجموع دقایق مطالعهٔ امروز» را بالا می‌برد.
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
      count: stats.count + (studiedSeconds >= POMODORO_DURATION ? 1 : 0),
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

  /* هفت روز اخیر (قدیم به جدید) برای نمودار؛ امروز از state زنده می‌آید تا نقطهٔ
     آخر نمودار همان لحظه‌ای که یک پومودو ثبت می‌شود بالا برود */
  const weekCounts = useMemo(() => {
    const history = loadHistory();
    const today = new Date();
    const days = [];

    for (let offset = WEEK_DAYS - 1; offset >= 0; offset -= 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
      days.push({
        key: dayKey(date),
        date,
        isToday: offset === 0,
        count: offset === 0 ? todayStats.count : Number(history[dayKey(date)]?.count) || 0,
      });
    }

    return days;
  }, [todayStats]);

  return {
    secondsLeft,
    isRunning: isRunning && !isBreak,
    isBreak,
    isFinished,
    todayCount: todayStats.count,
    todayMinutes: Math.floor(todayStats.seconds / 60),
    weekCounts,
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

/* ── نمودار خطی پومودوی هفت روز اخیر ──
   همان زبان بصری نمودار قلب داشبورد (شبکهٔ محور، ناحیهٔ گرادیانی، منحنی نرم، نقاط
   داده، تولتیپ و ستون‌های هاور) اما با پالت آبی پومودو و فقط در هفت روز. */
const CHART_PAD = { top: 18, right: 40, bottom: 32, left: 8 };

const faNumber = new Intl.NumberFormat('fa-IR');
const fWeekdayLong = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' });
const fDayNumber = new Intl.DateTimeFormat('fa-IR', { day: 'numeric' });
const fDayMonth = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' });

const round2 = (value) => Math.round(value * 100) / 100;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/* محور عمودی: شمارش پومودو کسری نیست، پس پله‌ها صحیح‌اند و حداکثر ۵ خط راهنما می‌دهند */
function chartAxis(maxValue) {
  if (!(maxValue > 0)) return { yMax: 4, step: 1, ticks: 4 };

  const headroom = maxValue * 1.08;
  let step = 1;
  let yMax = Math.ceil(headroom);

  while (yMax / step > 5) {
    step += 1;
    yMax = Math.ceil(headroom / step) * step;
  }

  return { yMax, step, ticks: yMax / step };
}

/* منحنی نرم (Catmull-Rom → بزیه)؛ کنترل‌پوینت‌ها داخل ناحیهٔ ترسیم کلمپ می‌شوند
   تا منحنی روی قله‌های تیز از بالا/پایین نزند بیرون */
function smoothPath(coords, top, bottom) {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M${round2(coords[0].x)},${round2(coords[0].y)}`;

  const tension = 0.18;
  let path = `M${round2(coords[0].x)},${round2(coords[0].y)}`;

  for (let index = 0; index < coords.length - 1; index += 1) {
    const p0 = coords[index - 1] ?? coords[index];
    const p1 = coords[index];
    const p2 = coords[index + 1];
    const p3 = coords[index + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = clamp(p1.y + (p2.y - p0.y) * tension, top, bottom);
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = clamp(p2.y - (p3.y - p1.y) * tension, top, bottom);

    path += ` C${round2(c1x)},${round2(c1y)} ${round2(c2x)},${round2(c2y)} ${round2(p2.x)},${round2(p2.y)}`;
  }

  return path;
}

/* عرض/ارتفاع واقعی ناحیهٔ ترسیم — هندسه بدون آن ساخته نمی‌شود */
function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

function PomodoroWeekChart({ days }) {
  const [plotRef, size] = useElementSize();
  const [hover, setHover] = useState(null);
  const areaId = useId();
  const clearHover = () => setHover(null);

  const maxValue = Math.max(...days.map((day) => day.count), 0);
  const axis = useMemo(() => chartAxis(maxValue), [maxValue]);

  const geometry = useMemo(() => {
    if (size.width < 120 || size.height < 90) return null;

    const plotW = size.width - CHART_PAD.left - CHART_PAD.right;
    const plotH = size.height - CHART_PAD.top - CHART_PAD.bottom;
    const baseline = CHART_PAD.top + plotH;
    const slot = plotW / days.length;

    return {
      plotW,
      plotH,
      baseline,
      slot,
      centerX: (index) => CHART_PAD.left + slot * index + slot / 2,
      topY: (value) => baseline - (value / axis.yMax) * plotH,
    };
  }, [size, days.length, axis]);

  if (!geometry) {
    return <div className="pomodoro-chart__plot" ref={plotRef} />;
  }

  const { plotW, plotH, baseline, slot, centerX, topY } = geometry;
  const coords = days.map((day, index) => ({ x: centerX(index), y: topY(day.count) }));
  const linePath = smoothPath(coords, CHART_PAD.top, baseline);
  const areaPath = `${linePath} L${round2(coords[coords.length - 1].x)},${baseline} L${round2(
    coords[0].x,
  )},${baseline} Z`;
  const hovered = hover != null ? days[hover] : null;

  return (
    <div
      className={`pomodoro-chart__plot ${hover != null ? 'is-hovering' : ''}`}
      ref={plotRef}
      onMouseLeave={clearHover}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) clearHover();
      }}
    >
      <svg
        className="pomodoro-chart__svg"
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b8cc7" stopOpacity="0.34" />
            <stop offset="62%" stopColor="#5b8cc7" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#5b8cc7" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* خطوط راهنما + برچسب محور عمودی (سمت راست، RTL) */}
        {Array.from({ length: axis.ticks + 1 }, (_, grid) => {
          const y = CHART_PAD.top + (plotH / axis.ticks) * grid;
          return (
            <g key={grid}>
              <line
                className={`pomodoro-chart__grid ${
                  grid === axis.ticks ? 'pomodoro-chart__grid--base' : ''
                }`}
                x1={CHART_PAD.left}
                x2={CHART_PAD.left + plotW}
                y1={y}
                y2={y}
              />
              <text
                className="pomodoro-chart__ylabel"
                x={size.width - 8}
                y={y + 3.5}
                textAnchor="end"
              >
                {faNumber.format(axis.yMax - axis.step * grid)}
              </text>
            </g>
          );
        })}

        <path className="pomodoro-chart__area" d={areaPath} fill={`url(#${areaId})`} />

        {hover != null && (
          <line
            className="pomodoro-chart__guide"
            x1={coords[hover].x}
            x2={coords[hover].x}
            y1={CHART_PAD.top}
            y2={baseline}
          />
        )}

        <path className="pomodoro-chart__line" d={linePath} pathLength="1" />

        {coords.map((coord, index) => {
          const day = days[index];
          const isHover = hover === index;
          return (
            <g
              key={day.key}
              className={`pomodoro-chart__dot-wrap ${isHover ? 'is-hover' : ''}`}
              style={{ '--i': index }}
            >
              {isHover && (
                <circle className="pomodoro-chart__dot-halo" cx={coord.x} cy={coord.y} r="9" />
              )}
              <circle
                className={`pomodoro-chart__dot ${day.isToday ? 'is-today' : ''} ${
                  isHover ? 'is-hover' : ''
                }`}
                cx={coord.x}
                cy={coord.y}
                r={day.isToday ? 4.4 : 3.1}
              />
              {day.isToday && (
                <>
                  <circle className="pomodoro-chart__pulse-ring" cx={coord.x} cy={coord.y} r="4" />
                  <circle className="pomodoro-chart__pulse-dot" cx={coord.x} cy={coord.y} r="3" />
                </>
              )}
            </g>
          );
        })}

        {/* برچسب محور افقی: «امروز» یا حرف روز، و زیرش شمارهٔ روز */}
        {days.map((day, index) => (
          <g key={day.key}>
            <text
              className={`pomodoro-chart__xlabel ${day.isToday ? 'is-today' : ''}`}
              x={centerX(index)}
              y={size.height - 18}
              style={{ '--i': index }}
            >
              {day.isToday ? 'امروز' : fWeekdayLong.format(day.date).charAt(0)}
            </text>
            <text
              className="pomodoro-chart__xlabel pomodoro-chart__xlabel--sub"
              x={centerX(index)}
              y={size.height - 5}
              style={{ '--i': index }}
            >
              {fDayNumber.format(day.date)}
            </text>
          </g>
        ))}
      </svg>

      {/* ستون‌های شفاف هاور؛ چپ و عرض از همان هندسهٔ svg می‌آید تا دقیقاً روی ستون درست بنشینند */}
      <div
        className="pomodoro-chart__overlay"
        role="list"
        aria-label="تعداد پومودو هفت روز اخیر"
        style={{ '--chart-pad-bottom': `${CHART_PAD.bottom}px` }}
      >
        {days.map((day, index) => (
          <div
            key={day.key}
            role="listitem"
            tabIndex={0}
            className={`pomodoro-chart__column ${hover === index ? 'is-hover' : ''}`}
            style={{
              left: `${round2(CHART_PAD.left + slot * index)}px`,
              width: `${round2(slot)}px`,
            }}
            aria-label={`${fWeekdayLong.format(day.date)} ${fDayMonth.format(
              day.date,
            )}: ${faNumber.format(day.count)} پومودو`}
            onMouseEnter={() => setHover(index)}
            onFocus={() => setHover(index)}
          />
        ))}
      </div>

      {hovered && (
        <div
          className="pomodoro-chart__tooltip"
          style={{
            left: clamp(centerX(hover), 80, size.width - 80),
            bottom: clamp(topY(hovered.count) + 14, 0, size.height - 76),
          }}
        >
          <span className="pomodoro-chart__tooltip-title">
            {fWeekdayLong.format(hovered.date)} {fDayMonth.format(hovered.date)}
            {hovered.isToday && <em>در جریان</em>}
          </span>
          <strong className="pomodoro-chart__tooltip-value">
            {faNumber.format(hovered.count)} <i>پومودو</i>
          </strong>
        </div>
      )}
    </div>
  );
}

export default function Pomodoro({
  secondsLeft,
  isRunning,
  isBreak,
  isFinished,
  todayCount,
  todayMinutes,
  weekCounts,
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
        <section className="pomodoro-card pomodoro-card--chart" aria-label="نمودار پومودوی هفت روز اخیر">
          <h2 className="pomodoro-card__title">تعداد پومودو هفت روز اخیر</h2>
          <PomodoroWeekChart days={weekCounts} />
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
