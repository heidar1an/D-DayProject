/*
 * ExamRoom — محیط برگزاری آزمون (تمرکز کامل صفحه، خارج از حس داشبورد).
 *
 * اصول:
 *  - Timer مطلق است: هر ثانیه باقی‌مانده = attempt.endsAt − getServerTime().
 *    هیچ شمارندهٔ نسبی فرانت‌اندی وجود ندارد؛ بعداً همین قرارداد با سرور کار می‌کند.
 *  - هر تغییر پاسخ/علامت همان لحظه از طریق saveAttemptProgress ذخیره می‌شود
 *    (autosave) تا Refresh یا قطعی اینترنت وضعیت آزمون را از بین نبرد؛ Resume
 *    در لایهٔ روتر با fetchAttempt انجام می‌شود.
 *  - کلید پاسخ هیچ‌جا در دسترس UI نیست؛ تصحیح فقط با submitAttempt.
 *  - هشدار زمان (۱۰/۵/۱ دقیقه) یک‌بار برای هر آستانه و بدون انیمیشن آزاردهنده.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getServerTime,
  saveAttemptProgress,
  submitAttempt,
} from '../../../../services/coordinatedExams/coordinatedExamService';
import { Icon, faNum, formatElapsed, toFa } from './coordinatedShared';
import useOverflowFlag from '../useOverflowFlag';

const OPTION_LABELS = ['۱', '۲', '۳', '۴'];
const WARN_THRESHOLDS = [
  { at: 600, message: '۱۰ دقیقه باقی مانده', level: 'warn' },
  { at: 300, message: '۵ دقیقه باقی مانده', level: 'warn' },
  { at: 60, message: '۱ دقیقه باقی مانده', level: 'danger' },
];

function timerLevel(remaining) {
  if (remaining <= 60) return 'danger';
  if (remaining <= 300) return 'warn';
  if (remaining <= 600) return 'caution';
  return 'ok';
}

export default function ExamRoom({ userData, exam, attempt, questions, onFinished, onExit }) {
  const userId = userData?.id ?? userData?.phone;
  const [answers, setAnswers] = useState(() => ({ ...(attempt.answers ?? {}) }));
  const [marked, setMarked] = useState(() => [...(attempt.marked ?? [])]);
  const [currentIndex, setCurrentIndex] = useState(() => {
    /* resume: اول همان سؤالی که کاربر در آن بوده؛ نبودِ ذخیره = اولین سؤال بی‌پاسخ */
    const answeredCount = Object.keys(attempt.answers ?? {}).length;
    const saved = Number.isInteger(attempt.currentIndex) ? attempt.currentIndex : answeredCount;
    return Math.max(0, Math.min(saved, attempt.questionIds.length - 1));
  });
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.floor((attempt.endsAt - getServerTime()) / 1000)));
  const [warned, setWarned] = useState(() => new Set());
  const [announce, setAnnounce] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showFullMap, setShowFullMap] = useState(false); // پاپ‌آپ لیست کامل سؤال‌ها در دسکتاپ
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const autoSubmittedRef = useRef(false);

  const total = attempt.questionIds.length;
  const currentQuestion = questions[currentIndex];

  /* ── Timer مطلق ── */
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.floor((attempt.endsAt - getServerTime()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [attempt.endsAt]);

  /* هشدارهای زمانی — هر آستانه فقط یک‌بار، با aria-live ملایم */
  useEffect(() => {
    const level = timerLevel(remaining);
    if (level === 'ok') return;
    if (!warned.has(level)) {
      setWarned((previous) => {
        const next = new Set(previous);
        next.add(level);
        return next;
      });
      const threshold = WARN_THRESHOLDS.find((item) => item.level === level);
      if (threshold) setAnnounce(threshold.message);
    }
  }, [remaining, warned]);

  /* ── پایان زمان → ثبت خودکار (یک‌بار) ── */
  const finishSubmit = useCallback(
    async (reason) => {
      if (autoSubmittedRef.current) return;
      autoSubmittedRef.current = true;
      setSubmitting(true);
      try {
        const payload = await submitAttempt(userId, attempt.id, { reason });
        onFinished?.({ ...payload, reason });
      } finally {
        setSubmitting(false);
      }
    },
    [attempt.id, onFinished, userId],
  );

  useEffect(() => {
    if (remaining <= 0) {
      finishSubmit('timeout');
    }
  }, [remaining, finishSubmit]);

  /* ── وضعیت آنلاین (Connection Lost UI) ── */
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const selectAnswer = (optionIndex) => {
    if (!currentQuestion) return;
    const nextAnswers = { ...answers };
    /* کلیک دوباره روی همان گزینه = لغو پاسخ؛ سؤال به حالت بی‌پاسخ برمی‌گردد */
    const isDeselect = nextAnswers[currentQuestion.id]?.selected === optionIndex;
    if (isDeselect) {
      delete nextAnswers[currentQuestion.id];
    } else {
      nextAnswers[currentQuestion.id] = {
        selected: optionIndex,
        answeredAt: getServerTime(),
      };
    }
    setAnswers(nextAnswers);
    /* برای لغو، مقدار null فرستاده می‌شود تا ادغام سمت سرویس هم کلید قبلی را حذف کند */
    persist(isDeselect ? { ...nextAnswers, [currentQuestion.id]: null } : nextAnswers, marked, currentIndex);
  };

  const toggleMark = () => {
    if (!currentQuestion) return;
    const nextMarked = marked.includes(currentQuestion.id)
      ? marked.filter((id) => id !== currentQuestion.id)
      : [...marked, currentQuestion.id];
    setMarked(nextMarked);
    persist(answers, nextMarked, currentIndex);
  };

  const go = (index) => {
    const clamped = Math.max(0, Math.min(total - 1, index));
    setCurrentIndex(clamped);
    setShowNavigator(false);
    setShowFullMap(false);
    persist(answers, marked, clamped);
  };

  /* ناوبری کیبورد — در RTL: چپ = بعدی، راست = قبلی */
  useEffect(() => {
    const handleKey = (event) => {
      if (showSubmitModal || showExitModal) return;
      if (event.key === 'Escape' && showFullMap) {
        setShowFullMap(false);
        return;
      }
      if (showFullMap) return;
      if (event.key === 'ArrowLeft') go(currentIndex + 1);
      if (event.key === 'ArrowRight') go(currentIndex - 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, showSubmitModal, showExitModal, showFullMap, total]);

  const stats = useMemo(() => {
    const answered = Object.keys(answers).length;
    return { answered, unanswered: total - answered, marked: marked.length };
  }, [answers, marked.length, total]);

  /* ── بخش درس‌ها (آزمون‌های جامع چند‌درسی): نقشهٔ سؤال‌ها هم می‌تواند فیلتر شود ── */
  const subjects = useMemo(() => {
    const seen = [];
    for (const question of questions) {
      if (question?.subject && !seen.includes(question.subject)) seen.push(question.subject);
    }
    return seen;
  }, [questions]);
  const subjectOf = useCallback(
    (questionId) => questions.find((question) => question.id === questionId)?.subject ?? null,
    [questions],
  );
  const multiSubject = subjects.length > 1;
  /* ناوبری درس‌ها فقط بین خود درس‌هاست؛ پیش‌فرض اولین درس (یا درس ذخیره‌شده بعد از Refresh) */
  const [subjectTab, setSubjectTab] = useState(() =>
    subjects.includes(attempt.subjectTab) ? attempt.subjectTab : (subjects[0] ?? 'all'),
  );

  /* ── ذخیرهٔ خودکار وضعیت ── */
  const persist = useCallback(
    (nextAnswers, nextMarked, nextIndex) => {
      saveAttemptProgress(userId, {
        ...attempt,
        answers: nextAnswers,
        marked: nextMarked,
        currentIndex: nextIndex,
        subjectTab, /* برای بازگشت به همان درس بعد از Refresh */
      });
    },
    [attempt, subjectTab, userId],
  );

  const selectSubject = (subject) => {
    setSubjectTab(subject);
    if (subject !== 'all') {
      const firstIndex = attempt.questionIds.findIndex((id) => subjectOf(id) === subject);
      if (firstIndex >= 0) go(firstIndex);
    }
  };

  const subjectTabs = multiSubject && (
    <div className="exm-navtabs" role="tablist" aria-label="بخش درس‌ها">
      {subjects.map((subject) => {
        const count = questions.filter((question) => question.subject === subject).length;
        return (
          <button key={subject} type="button" aria-pressed={subjectTab === subject} onClick={() => selectSubject(subject)}>
            {subject}
            <span className="exm-navtabs__count">({faNum(count)})</span>
          </button>
        );
      })}
    </div>
  );

  /* پیشرفت هر درس — مبنای دکمهٔ «رفتن به درس بعدی» وقتی سؤال‌های یک درس تمام شود */
  const subjectStats = useMemo(
    () =>
      subjects.map((subject) => {
        const ids = attempt.questionIds.filter((id) => subjectOf(id) === subject);
        const answered = ids.filter((id) => answers[id] !== undefined).length;
        return { subject, total: ids.length, answered, complete: ids.length > 0 && answered === ids.length };
      }),
    [subjects, attempt.questionIds, answers, subjectOf],
  );

  /* درس بعدی (با چرخش به ابتدای فهرست) — دکمهٔ پرش همواره زیر سؤال‌ها نمایش داده می‌شود */
  const nextSubject = useMemo(() => {
    if (!multiSubject) return null;
    const currentIndex = subjects.indexOf(subjectTab);
    return subjects[(currentIndex + 1) % subjects.length] ?? null;
  }, [multiSubject, subjects, subjectTab]);

  const currentSubjectComplete = subjectTab !== 'all' && (subjectStats.find((entry) => entry.subject === subjectTab)?.complete ?? false);

  const visibleCount = useMemo(
    () => attempt.questionIds.filter((questionId) => subjectTab === 'all' || subjectOf(questionId) === subjectTab).length,
    [attempt.questionIds, subjectTab, subjectOf],
  );
  /* تشخیص سرریز نقشهٔ سؤال‌ها — با هر تغییر تعداد سؤال‌های نمایش‌داده‌شده دوباره اندازه می‌گیرد */
  const [navScrollRef, navOverflowing] = useOverflowFlag(visibleCount);

  /* راهنمای رنگ‌ها — مشترک بین سایدبار دسکتاپ و پاپ‌آپ لیست کامل */
  const legendList = (
    <ul className="mt-4 space-y-2 border-t border-white/[0.07] pt-3 text-[10.5px] text-[var(--faint)]">
      <li className="flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-[#61D192]/50" aria-hidden="true" />
        پاسخ داده‌شده ({faNum(stats.answered)})
      </li>
      <li className="flex items-center gap-2">
        <span className="h-3 w-3 rounded border border-white/20 bg-white/5" aria-hidden="true" />
        بی‌پاسخ ({faNum(stats.unanswered)})
      </li>
      <li className="flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-[#e0b45c]/60" aria-hidden="true" />
        علامت‌گذاری‌شده ({faNum(stats.marked)})
      </li>
    </ul>
  );

  const level = timerLevel(remaining);
  const levelClass = level === 'danger' ? 'exm-timer--danger' : level === 'warn' || level === 'caution' ? 'exm-timer--warn' : '';
  const currentAnswer = currentQuestion ? answers[currentQuestion.id]?.selected : undefined;
  const isMarked = currentQuestion ? marked.includes(currentQuestion.id) : false;

  const handleSubmit = async () => {
    await finishSubmit('user');
  };

  const navigatorGrid = (
    <div className="exm-navgrid" role="navigation" aria-label="ناوبری سؤال‌ها">
      {attempt.questionIds
        .map((questionId, index) => ({ questionId, index }))
        .filter(({ questionId }) => subjectTab === 'all' || subjectOf(questionId) === subjectTab)
        .map(({ questionId, index }) => {
          const isAnswered = answers[questionId] !== undefined;
          const isMarkedChip = marked.includes(questionId);
          return (
            <button
              key={questionId}
              type="button"
              onClick={() => go(index)}
              aria-label={`سؤال ${toFa(index + 1)}${isAnswered ? ' — پاسخ داده‌شده' : ''}${isMarkedChip ? ' — علامت‌گذاری‌شده' : ''}`}
              aria-current={index === currentIndex ? 'true' : undefined}
              className={`exm-navchip ${isAnswered ? 'is-answered' : ''} ${isMarkedChip ? 'is-marked' : ''} ${
                index === currentIndex ? 'is-current' : ''
              }`}
            >
              {toFa(index + 1)}
              {isMarkedChip && <span className="exm-navchip__flag" aria-hidden="true" />}
            </button>
          );
        })}
    </div>
  );

  if (!currentQuestion) return null;

  return (
    <div className="exm-room" dir="rtl">
      <div className="exm-room__shell">
        {/* ── هدر آزمون — بدون پس‌زمینه ── */}
        <header className="sticky top-0 z-20 -mx-1 mb-6 flex flex-wrap items-center gap-3 px-1 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-white [font-family:'Doran','Vazir',Tahoma,sans-serif] md:text-lg">{exam.title}</p>
            <p className="mt-0.5 text-[11px] text-[var(--faint)]">
              سؤال {toFa(currentIndex + 1)} از {toFa(total)} • {faNum(stats.answered)} پاسخ داده‌شده
            </p>
          </div>

          {!isOnline && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#e0b45c]/12 px-3 py-2 text-[11px] text-[var(--gold-ink)]">
              <Icon name="wifi" className="h-3.5 w-3.5" />
              اتصال قطع است — پاسخ‌ها در همین دستگاه ذخیره می‌شود
            </span>
          )}

          <span className={`exm-timer ${levelClass}`} role="timer" aria-label={`زمان باقی‌مانده ${formatElapsed(remaining)}`}>
            <Icon name="timer" className="h-4.5 w-4.5" />
            {formatElapsed(remaining)}
          </span>

          <button
            type="button"
            onClick={() => setShowExitModal(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-white/[0.1] hover:text-white"
          >
            <Icon name="logout" className="h-4 w-4" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </header>

        <div aria-live="polite" className="sr-only">
          {announce}
        </div>

        {/* ── صحنهٔ آزمون: کل سؤال و کادرها وسطِ صفحه (افقی و عمودی) ── */}
        <div className="exm-room__stage">
          <div className="exm-room__grid grid gap-6 lg:grid-cols-[1fr_16rem] lg:items-start">
          {/* ── ستون سؤال ── */}
          <div>
            <div className="exm-question mx-auto w-full max-w-[46rem]" key={currentQuestion.id}>
              {isMarked && (
                <div className="mb-4">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#e0b45c]/12 px-2.5 py-1 text-xs text-[var(--gold-ink)]">
                    <Icon name="flag" className="h-3 w-3" />
                    برای مرور علامت خورده
                  </span>
                </div>
              )}

              <p className="mb-6 text-[17px] leading-9 text-white md:text-[19px]">{currentQuestion.stem}</p>

              <div className="space-y-3" role="radiogroup" aria-label={`گزینه‌های سؤال ${toFa(currentIndex + 1)}`}>
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    type="button"
                    role="radio"
                    aria-checked={currentAnswer === index}
                    onClick={() => selectAnswer(index)}
                    className={`exm-option ${currentAnswer === index ? 'is-selected' : ''}`}
                  >
                    <span className="exm-option__index">{OPTION_LABELS[index]}</span>
                    <span>{option}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── ناوبری پایین — هم‌تراز با لبهٔ راست کادر سؤال ── */}
            <div className="mx-auto mt-7 flex w-full max-w-[46rem] flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => go(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/[0.06] px-4 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-white/[0.1] disabled:cursor-default disabled:opacity-35"
              >
                <Icon name="back" className="h-4 w-4" />
                سؤال قبلی
              </button>
              <button
                type="button"
                onClick={() => go(currentIndex + 1)}
                disabled={currentIndex === total - 1}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/[0.06] px-4 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-white/[0.1] disabled:cursor-default disabled:opacity-35"
              >
                سؤال بعدی
                <Icon name="back" className="h-4 w-4 rotate-180" />
              </button>
              {exam.rules?.allowMarking !== false && (
                <button
                  type="button"
                  onClick={toggleMark}
                  aria-pressed={isMarked}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs transition-colors ${
                    isMarked ? 'bg-[#e0b45c]/15 text-[var(--gold-ink)]' : 'bg-white/[0.06] text-[var(--muted)] hover:bg-white/[0.1]'
                  }`}
                >
                  <Icon name="flag" className="h-4 w-4" />
                  {isMarked ? 'برداشتن علامت' : 'علامت برای مرور'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="mr-auto flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--green-vivid)] px-5 py-2.5 text-xs font-bold text-[#0d1f16] transition-colors hover:bg-[#74dd9f]"
              >
                <Icon name="check" className="h-4 w-4" />
                پایان و ثبت آزمون
              </button>
            </div>

            {/* دکمهٔ پرش به درس بعدی — همواره زیر سؤال‌ها در آزمون‌های چند‌درسی */}
            {multiSubject && nextSubject && (
              <div className="mx-auto mt-3 w-full max-w-[46rem]">
                <button
                  type="button"
                  onClick={() => selectSubject(nextSubject)}
                  className="flex w-full cursor-pointer flex-wrap items-center justify-center gap-2 rounded-xl border border-[#61D192]/30 bg-[#61D192]/[0.08] px-4 py-3 text-xs font-bold text-[var(--green-ink)] transition-colors hover:bg-[#61D192]/[0.16]"
                >
                  {currentSubjectComplete && <span>همهٔ سؤال‌های «{subjectTab}» پاسخ داده شد</span>}
                  <Icon name="back" className="h-4 w-4 rotate-180" />
                  <span>رفتن به درس «{nextSubject}»</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Navigator دسکتاپ: نقشهٔ سؤال‌ها + کادر حرکت بین درس‌ها (آزمون جامع) ── */}
          <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block">
            <div className="rounded-[1.6rem] border border-white/[0.07] bg-[var(--background)] p-4">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-bold text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">
                <Icon name="grid" className="h-4 w-4 text-[var(--purple-ink)]" />
                نقشهٔ سؤال‌ها
              </h2>
              {/* وقتی تعداد سؤال‌ها از ظرفیت کادر بیشتر شود، نقشه داخل همین ظرف اسکرول
                  می‌شود (به‌جای سرریز از چهارچوب) و دکمهٔ لیست کامل نمایش داده می‌شود */}
              <div ref={navScrollRef} className="exm-navscroll">
                {navigatorGrid}
              </div>
              {navOverflowing && (
                <button type="button" onClick={() => setShowFullMap(true)} className="exm-navmore">
                  <Icon name="grid" className="h-3.5 w-3.5" />
                  لیست کامل سؤال‌ها ({faNum(visibleCount)})
                </button>
              )}
              {legendList}
            </div>

            {multiSubject && (
              <div className="rounded-[1.6rem] border border-white/[0.07] bg-[var(--background)] p-4">
                <h2 className="mb-3 flex items-center gap-2 text-xs font-bold text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">
                  <Icon name="book" className="h-4 w-4 text-[var(--green-ink)]" />
                  حرکت بین درس‌ها
                </h2>
                {subjectTabs}
              </div>
            )}
          </aside>
          </div>
        </div>
      </div>

      {/* ── نوار پایین موبایل + Drawer نقشه ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-white/[0.08] bg-[#17171a]/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => go(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.07] text-white disabled:opacity-35"
          aria-label="سؤال قبلی"
        >
          <Icon name="back" className="h-4.5 w-4.5" />
        </button>
        <button
          type="button"
          onClick={() => go(currentIndex + 1)}
          disabled={currentIndex === total - 1}
          className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.07] text-white disabled:opacity-35"
          aria-label="سؤال بعدی"
        >
          <Icon name="back" className="h-4.5 w-4.5 rotate-180" />
        </button>
        <button
          type="button"
          onClick={() => setShowNavigator(true)}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/[0.07] py-2.5 text-xs text-[var(--muted)]"
        >
          <Icon name="grid" className="h-4 w-4" />
          نقشهٔ سؤال‌ها ({faNum(stats.answered)}/{toFa(total)})
        </button>
        <button
          type="button"
          onClick={() => setShowSubmitModal(true)}
          className="rounded-xl bg-[var(--green-vivid)] px-4 py-2.5 text-xs font-bold text-[#0d1f16]"
        >
          ثبت
        </button>
      </div>

      {showNavigator && (
        <>
          <div className="exm-drawer__scrim" onClick={() => setShowNavigator(false)} aria-hidden="true" />
          <div className="exm-drawer" role="dialog" aria-label="نقشهٔ سؤال‌ها">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" aria-hidden="true" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">نقشهٔ سؤال‌ها</h2>
              <button type="button" onClick={() => setShowNavigator(false)} className="cursor-pointer text-xs text-[var(--faint)]">
                بستن
              </button>
            </div>
            {subjectTabs}
            {navigatorGrid}
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10.5px] text-[var(--faint)]">
              <li className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-[#61D192]/50" aria-hidden="true" />
                پاسخ داده‌شده
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-[#e0b45c]/60" aria-hidden="true" />
                علامت‌گذاری‌شده
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded border border-white/20 bg-white/5" aria-hidden="true" />
                بی‌پاسخ
              </li>
            </ul>
          </div>
        </>
      )}

      {/* ── پاپ‌آپ لیست کامل سؤال‌ها (وقتی نقشهٔ سایدبار سرریز شده) ── */}
      {showFullMap && (
        <div
          className="exm-modal__scrim"
          role="dialog"
          aria-modal="true"
          aria-label="لیست کامل سؤال‌ها"
          onClick={() => setShowFullMap(false)}
        >
          <div className="exm-modal exm-modal--map" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">
                <Icon name="grid" className="h-4.5 w-4.5 text-[var(--purple-ink)]" />
                لیست کامل سؤال‌ها ({faNum(visibleCount)})
              </h2>
              <button
                type="button"
                onClick={() => setShowFullMap(false)}
                className="cursor-pointer rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:bg-white/[0.1] hover:text-white"
              >
                بستن
              </button>
            </div>
            {multiSubject && subjectTabs}
            <div className="exm-modal__mapbody">
              {navigatorGrid}
            </div>
            {legendList}
          </div>
        </div>
      )}

      {/* ── مودال ثبت نهایی ── */}
      {showSubmitModal && (
        <div className="exm-modal__scrim" role="dialog" aria-modal="true" aria-label="ثبت نهایی آزمون">
          <div className="exm-modal space-y-5">
            <h2 className="text-lg text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              آیا از ثبت نهایی آزمون اطمینان دارید؟
            </h2>
            <div className="space-y-2.5 rounded-2xl bg-black/30 p-4 text-sm">
              <div className="flex items-center justify-between text-[var(--muted)]">
                <span>پاسخ داده‌شده</span>
                <strong className="text-[var(--green-ink)]">{faNum(stats.answered)} از {toFa(total)}</strong>
              </div>
              <div className="flex items-center justify-between text-[var(--muted)]">
                <span>بی‌پاسخ</span>
                <strong>{faNum(stats.unanswered)}</strong>
              </div>
              {stats.marked > 0 && (
                <div className="flex items-center justify-between text-[var(--muted)]">
                  <span>علامت‌گذاری‌شده برای مرور</span>
                  <strong className="text-[var(--gold-ink)]">{faNum(stats.marked)}</strong>
                </div>
              )}
              {exam.rules?.negativeMarking < 0 && stats.unanswered > 0 && (
                <p className="border-t border-white/[0.07] pt-2.5 text-[11.5px] leading-6 text-[var(--faint)]">
                  سؤال‌های بی‌پاسخ نمرهٔ منفی ندارند؛ پاسخ غلط {faNum(Math.abs(exam.rules.negativeMarking))} نمرهٔ منفی دارد.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="flex-1 cursor-pointer rounded-2xl bg-[var(--green-vivid)] py-3 text-sm font-bold text-[#0d1f16] transition-colors hover:bg-[#74dd9f] disabled:opacity-50"
              >
                {submitting ? 'در حال ثبت…' : 'ثبت نهایی'}
              </button>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="cursor-pointer rounded-2xl bg-white/[0.06] px-5 py-3 text-sm text-[var(--muted)] transition-colors hover:bg-white/[0.1] hover:text-white"
              >
                بازگشت به آزمون
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── مودال خروج (آزمون ادامه پیدا می‌کند) ── */}
      {showExitModal && (
        <div className="exm-modal__scrim" role="dialog" aria-modal="true" aria-label="خروج از محیط آزمون">
          <div className="exm-modal space-y-4">
            <h2 className="text-lg text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">از محیط آزمون خارج می‌شوی؟</h2>
            <p className="text-[13px] leading-7 text-[var(--muted)]">
              زمان آزمون ادامه دارد و پاسخ‌هایت تا این لحظه ذخیره شده است؛ از همان‌جا که رفتی می‌توانی ادامه بدهی.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onExit}
                className="flex-1 cursor-pointer rounded-2xl bg-[var(--red)] py-3 text-sm font-bold text-[#2a1010] transition-colors hover:bg-[var(--red)]"
              >
                خروج و ادامه بعداً
              </button>
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="cursor-pointer rounded-2xl bg-white/[0.06] px-5 py-3 text-sm text-[var(--muted)] transition-colors hover:bg-white/[0.1] hover:text-white"
              >
                ماندن در آزمون
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
