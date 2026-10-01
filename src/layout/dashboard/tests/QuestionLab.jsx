/*
 * Question Lab — محیط حل سؤال؛ مهم‌ترین سطح تجربهٔ این بخش.
 * Desktop: نویگیتور سایدبار چسبان | Mobile: نویگیتور و فیلتر به‌صورت Bottom Sheet.
 * هر پاسخ همان لحظه از طریق سرویس ثبت و برای Resume ذخیره می‌شود؛ UI هرگز مستقیم به
 * localStorage دست نمی‌زند — همه‌چیز از قرارداد internationalService می‌گذرد.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addToCollection,
  createCollection,
  fetchBookmarkedQuestions,
  fetchCollections,
  recordAnswer,
  saveAttemptProgress,
  submitAttempt,
  toggleBookmark,
  trackEvent,
} from '../../../services/international/internationalService';
import { FEEDBACK_SOURCES, sendFeedback } from '../../../services/feedback/userFeedback';
import {
  BilingualText,
  DIFFICULTY_ORDER,
  DifficultyBadge,
  difficultyLabel,
  EmptyState,
  formatClock,
  Icon,
  LanguageToggle,
  SampleTag,
  toFa,
} from './intlShared';
import QuestionExplanation from './QuestionExplanation';
import useOverflowFlag from './useOverflowFlag';

/* ── دکمهٔ گزینهٔ سؤال ── */
function OptionButton({ option, state, onSelect, langMode, disabled }) {
  const skin =
    state === 'correct'
      ? 'border-[#77b787]/45 bg-[#77b787]/[0.09] text-[var(--white)]'
      : state === 'wrong'
        ? 'border-[#e26d6d]/45 bg-[#e26d6d]/[0.08] text-[var(--white)]'
        : state === 'selected'
          ? 'border-[#937fcd]/70 bg-[#937fcd]/[0.12] text-white'
          : 'border-white/8 bg-[var(--surface-soft)] text-[var(--muted)] hover:border-white/20 hover:bg-[var(--surface-soft)]';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`intl-option flex w-full cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 text-right disabled:cursor-default ${skin}`}
      aria-pressed={state === 'selected' || state === 'correct' || state === 'wrong'}
    >
      <span
        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl text-sm font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif] ${
          state === 'correct'
            ? 'bg-[#77b787]/25 text-[var(--green-soft-ink)]'
            : state === 'wrong'
              ? 'bg-[#e26d6d]/25 text-[var(--red-ink)]'
              : state === 'selected'
                ? 'bg-[#937fcd]/30 text-white'
                : 'bg-white/6 text-[var(--faint)]'
        }`}
        aria-hidden="true"
      >
        {option.key}
      </span>
      <span className="min-w-0 flex-1">
        {langMode !== 'fa' && (
          <span className="block text-[14px] leading-6" dir="ltr">
            {option.en}
          </span>
        )}
        {langMode !== 'en' && (
          <span className={`block text-[14px] leading-6 ${langMode === 'dual' ? 'mt-1.5 text-[var(--muted)]' : ''}`}>
            {option.fa}
          </span>
        )}
      </span>
      {state === 'correct' && <Icon name="check" className="mt-1 h-4.5 w-4.5 shrink-0 text-[var(--green-soft-ink)]" />}
      {state === 'wrong' && <Icon name="x" className="mt-1 h-4.5 w-4.5 shrink-0 text-[var(--red-ink)]" />}
    </button>
  );
}

/* ── نویگیتور سؤال: اعداد با وضعیت حل‌شده/غلط/گلچین/فعلی ──
   onExpand فقط در سایدبار دسکتاپ پاس داده می‌شود؛ وقتی گرید از ظرفیت کادر سرریز
   کند، دکمهٔ «لیست کامل سؤال‌ها» برای باز کردن پاپ‌آپ نمایش داده می‌شود. */
function QuestionNavigator({ questions, currentIndex, answers, bookmarks, filter, onFilter, onJump, onExpand }) {
  const filtered = filter
    ? questions.map((question, index) => ({ question, index })).filter((entry) => entry.question.difficulty === filter)
    : questions.map((question, index) => ({ question, index }));
  /* تشخیص سرریز — با هر تغییر تعداد سؤال‌های فیلترشده دوباره اندازه می‌گیرد */
  const [gridRef, overflowing] = useOverflowFlag(filtered.length);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="فیلتر سطح سختی">
        <button
          type="button"
          onClick={() => onFilter(null)}
          aria-pressed={filter === null}
          className={`cursor-pointer rounded-full px-3 py-1.5 text-[11px] transition-colors ${
            filter === null ? 'bg-[var(--purple-bright)] text-white' : 'bg-white/5 text-[var(--muted)] hover:text-white'
          }`}
        >
          همه
        </button>
        {DIFFICULTY_ORDER.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onFilter(level)}
            aria-pressed={filter === level}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-[11px] transition-colors ${
              filter === level ? 'bg-[var(--purple-bright)] text-white' : 'bg-white/5 text-[var(--muted)] hover:text-white'
            }`}
          >
            {difficultyLabel(level)}
          </button>
        ))}
      </div>

      <div ref={gridRef} className={onExpand ? 'intl-navscroll mt-4' : 'mt-4'}>
        <div className="grid grid-cols-5 gap-2" role="list" aria-label="ناوبری سؤال‌ها">
          {filtered.map(({ question, index }) => {
            const answer = answers[question.id];
            const isCurrent = index === currentIndex;
            const isBookmarked = bookmarks.includes(question.id);
            return (
              <button
                key={question.id}
                type="button"
                role="listitem"
                onClick={() => onJump(index)}
                aria-label={`سؤال ${toFa(index + 1)}${
                  answer ? (answer.isCorrect ? '، صحیح' : '، غلط') : '، حل‌نشده'
                }${isBookmarked ? '، گلچین‌شده' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`relative grid h-10 place-items-center cursor-pointer rounded-xl border text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif] transition-colors ${
                  isCurrent
                    ? 'border-[var(--purple-bright)] bg-[#937fcd]/25 text-white'
                    : answer?.isCorrect
                      ? 'border-[#77b787]/35 bg-[#77b787]/12 text-[var(--green-soft-ink)]'
                      : answer && !answer.isCorrect
                        ? 'border-[#e26d6d]/35 bg-[#e26d6d]/12 text-[var(--red-ink)]'
                        : 'border-white/8 bg-white/[0.04] text-[var(--muted)] hover:border-white/25'
                }`}
              >
                {toFa(index + 1)}
                {isBookmarked && (
                  <span className="absolute -left-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--surface)] text-[var(--red-ink)]" aria-hidden="true">
                    <Icon name="heart" className="h-2.5 w-2.5" strokeWidth={2.4} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {onExpand && overflowing && (
        <button type="button" onClick={onExpand} className="intl-navmore">
          <Icon name="grid" className="h-3.5 w-3.5" />
          لیست کامل سؤال‌ها ({toFa(filtered.length)})
        </button>
      )}

      <ul className="mt-4 space-y-2 border-t border-white/8 pt-3 text-[11px] text-[var(--faint)]">
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-md bg-[#77b787]/60" aria-hidden="true" /> صحیح
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-md bg-[#e26d6d]/60" aria-hidden="true" /> غلط
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-md bg-white/20" aria-hidden="true" /> حل‌نشده
        </li>
      </ul>
    </div>
  );
}

/* ── پاپ‌اور «افزودن به مجموعه» ── */
function AddToCollectionPopover({ userId, questionId, onClose }) {
  const [collections, setCollections] = useState(null);
  const [note, setNote] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [addedTo, setAddedTo] = useState([]);
  const popRef = useRef(null);

  useEffect(() => {
    let alive = true;
    fetchCollections(userId).then((items) => alive && setCollections(items));
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    const handlePointer = (event) => {
      if (!popRef.current?.contains(event.target)) onClose();
    };
    const handleKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleAdd = async (collection) => {
    await addToCollection(userId, collection.id, questionId, note);
    setAddedTo((prev) => [...prev, collection.id]);
    trackEvent('question_added_to_collection', { collectionId: collection.id });
  };

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    const collection = await createCollection(userId, { name: newName });
    await addToCollection(userId, collection.id, questionId, note);
    setCollections((prev) => [...(prev ?? []), { ...collection, questions: [] }]);
    setAddedTo((prev) => [...prev, collection.id]);
    setNewName('');
    setCreating(false);
  };

  return (
    <div
      ref={popRef}
      className="intl-pop absolute left-0 top-full z-30 mt-2 w-[min(19rem,calc(100vw-3rem))] rounded-3xl border border-white/10 bg-[var(--surface)] p-3 shadow-[0_24px_60px_-20px_rgb(var(--shadow-rgb) / 0.85)]"
      role="dialog"
      aria-label="افزودن سؤال به مجموعه"
    >
      <p className="px-1.5 py-1.5 text-[13px] [font-family:'Doran','Vazir',Tahoma,sans-serif]">افزودن به مجموعه</p>

      {!collections ? (
        <p className="px-1.5 py-3 text-xs text-[var(--faint)]">در حال بارگذاری مجموعه‌ها…</p>
      ) : collections.length === 0 ? (
        <p className="px-1.5 py-2 text-xs leading-5 text-[var(--faint)]">هنوز مجموعه‌ای نساخته‌ای؛ اولین مجموعه‌ات را بساز.</p>
      ) : (
        <ul className="max-h-44 space-y-1 overflow-y-auto">
          {collections.map((collection) => {
            const isAdded = addedTo.includes(collection.id) || collection.questions?.some((q) => q?.id === questionId);
            return (
              <li key={collection.id}>
                <button
                  type="button"
                  disabled={isAdded}
                  onClick={() => handleAdd(collection)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-[13px] transition-colors ${
                    isAdded ? 'bg-[#77b787]/10 text-[var(--green-soft-ink)]' : 'text-[var(--muted)] hover:bg-white/5'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon name="layers" className="h-4 w-4 shrink-0 text-[var(--purple-ink)]" />
                    <span className="truncate">{collection.name}</span>
                  </span>
                  {isAdded ? (
                    <span className="flex shrink-0 items-center gap-1 text-[11px]">
                      <Icon name="check" className="h-3.5 w-3.5" /> اضافه شد
                    </span>
                  ) : (
                    <Icon name="plus" className="h-3.5 w-3.5 shrink-0 text-[var(--faint)]" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2 border-t border-white/8 pt-2.5">
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="یادداشت اختیاری برای این سؤال"
          className="w-full rounded-xl border border-white/8 bg-[var(--surface-soft)] px-3 py-2 text-xs text-white placeholder:text-[var(--ghost)] focus:border-[#937fcd]/50 focus:outline-none"
        />
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="مجموعهٔ جدید…"
            className="min-w-0 flex-1 rounded-xl border border-white/8 bg-[var(--surface-soft)] px-3 py-2 text-xs text-white placeholder:text-[var(--ghost)] focus:border-[#937fcd]/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="cursor-pointer rounded-xl bg-[var(--purple-bright)] px-3 py-2 text-xs text-white transition-transform hover:-translate-y-0.5 disabled:cursor-default disabled:opacity-50"
          >
            ساخت
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── دیالوگ Report سؤال (Mock؛ در نسخهٔ واقعی به QuestionReport API می‌رود) ── */
const REPORT_REASONS = [
  'پاسخ صحیح اشتباه به نظر می‌رسد',
  'توضیح ناقص یا نادرست است',
  'متن سؤال مبهم است',
  'مشکل در ترجمهٔ فارسی',
  'مشکل فنی در نمایش',
];

function ReportDialog({ questionId, onClose }) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [sent, setSent] = useState(false);

  return (
    <div className="intl-fade fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="گزارش مشکل سؤال" onClick={onClose}>
      <div
        className="intl-pop w-[min(24rem,100%)] rounded-[2rem] border border-white/10 bg-[var(--surface-soft)] p-6"
        onClick={(event) => event.stopPropagation()}
      >
        {sent ? (
          <div className="py-4 text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#77b787]/15 text-[var(--green-soft-ink)]">
              <Icon name="check" className="h-6 w-6" />
            </span>
            <strong className="block [font-family:'Doran','Vazir',Tahoma,sans-serif]">گزارشت ثبت شد</strong>
            <p className="mt-1.5 text-sm leading-6 text-[var(--faint)]">تیم محتوای تپش بررسی می‌کند؛ ممنون که کمک می‌کنی بانک سؤال بهتر شود.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 cursor-pointer rounded-xl bg-white/8 px-5 py-2 text-sm transition-colors hover:bg-white/12"
            >
              بستن
            </button>
          </div>
        ) : (
          <>
            <h3 className="flex items-center gap-2 text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              <Icon name="flag" className="h-4.5 w-4.5 text-[var(--gold-ink)]" />
              گزارش مشکل سؤال
            </h3>
            <p className="mt-1.5 text-xs text-[var(--faint)]">شناسه سؤال: {questionId}</p>
            <fieldset className="mt-4 space-y-1.5">
              <legend className="sr-only">دلیل گزارش</legend>
              {REPORT_REASONS.map((item) => (
                <label
                  key={item}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] transition-colors ${
                    reason === item ? 'border-[#937fcd]/60 bg-[#937fcd]/10 text-white' : 'border-white/8 text-[var(--muted)] hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={item}
                    checked={reason === item}
                    onChange={() => setReason(item)}
                    className="accent-[var(--purple-ink)]"
                  />
                  {item}
                </label>
              ))}
            </fieldset>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  trackEvent('question_reported', { questionId, reason });
                  /* گزارش به سرور می‌رود تا در پنل با منبع «آزمون‌های بین‌الملل» دیده شود */
                  await sendFeedback({
                    source: FEEDBACK_SOURCES.questionLab,
                    subject: reason,
                    category: 'گزارش ایراد سؤال',
                    message: '',
                    meta: { questionId },
                  });
                  setSent(true);
                }}
                className="flex-1 cursor-pointer rounded-xl bg-[var(--purple-bright)] px-4 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5"
              >
                ارسال گزارش
              </button>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-xl bg-white/8 px-4 py-2.5 text-sm transition-colors hover:bg-white/12"
              >
                انصراف
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════ Question Lab ══════════════════════════ */
export default function QuestionLab({ userData, exam, questions, attempt, onExit, onFinish }) {
  const userId = userData?.id ?? 'guest';
  const [currentIndex, setCurrentIndex] = useState(attempt.currentIndex ?? 0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState(attempt.answers ?? {});
  const [bookmarks, setBookmarks] = useState([]);
  const [langMode, setLangMode] = useState('dual');
  const [filter, setFilter] = useState(null);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [fullMapOpen, setFullMapOpen] = useState(false); // پاپ‌آپ لیست کامل سؤال‌ها در دسکتاپ
  const [collectionPop, setCollectionPop] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - attempt.startedAt) / 1000));
  const [submitting, setSubmitting] = useState(false);
  const questionStartRef = useRef(Date.now());
  const autoSubmittedRef = useRef(false);

  const question = questions[currentIndex];
  const answer = answers[question?.id];
  const revealed = Boolean(answer);

  /* گلچین‌های فعلی کاربر برای نویگیتور */
  useEffect(() => {
    let alive = true;
    fetchBookmarkedQuestions(userId).then((items) => {
      if (alive) setBookmarks(items.map((item) => item.id));
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  /* تایمر کل آزمون + پایان خودکار در آزمون زمان‌دار */
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - attempt.startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [attempt.startedAt]);

  const remaining = attempt.durationMinutes ? attempt.durationMinutes * 60 - elapsed : null;

  const finish = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    const submitted = await submitAttempt(userId, attempt.id);
    onFinish(submitted);
  }, [attempt.id, onFinish, submitting, userId]);

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !autoSubmittedRef.current && !submitting) {
      autoSubmittedRef.current = true;
      finish();
    }
  }, [finish, remaining, submitting]);

  const persistIndex = (index) => {
    saveAttemptProgress(userId, { ...attempt, currentIndex: index, answers });
  };

  const goTo = (index) => {
    const next = Math.max(0, Math.min(questions.length - 1, index));
    setCurrentIndex(next);
    setSelected(answers[questions[next]?.id]?.selectedAnswer ?? null);
    questionStartRef.current = Date.now();
    setCollectionPop(false);
    setNavigatorOpen(false);
    setFullMapOpen(false);
    persistIndex(next);
  };

  /* بستن پاپ‌آپ لیست کامل با Escape */
  useEffect(() => {
    if (!fullMapOpen) return undefined;
    const handleKey = (event) => event.key === 'Escape' && setFullMapOpen(false);
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullMapOpen]);

  const handleSubmitAnswer = async () => {
    if (selected == null || revealed || submitting) return;
    const timeSpent = Date.now() - questionStartRef.current;
    setSubmitting(true);
    await recordAnswer(userId, attempt, question, selected, timeSpent);
    setAnswers((prev) => ({
      ...prev,
      [question.id]: { selectedAnswer: selected, isCorrect: selected === question.correctAnswer, timeSpent: Math.round(timeSpent / 1000) },
    }));
    saveAttemptProgress(userId, { ...attempt, currentIndex, answers: { ...answers, [question.id]: { selectedAnswer: selected } } });
    setSubmitting(false);
  };

  const handleBookmark = async () => {
    const isBookmarked = await toggleBookmark(userId, question.id);
    setBookmarks((prev) => (isBookmarked ? [...prev, question.id] : prev.filter((id) => id !== question.id)));
  };

  const answeredCount = Object.keys(answers).length;
  const progress = questions.length ? (answeredCount / questions.length) * 100 : 0;
  const isLast = currentIndex === questions.length - 1;

  const examMeta = useMemo(
    () => ({ title: attempt.title, source: attempt.source }),
    [attempt.title, attempt.source],
  );

  if (!question) {
    return (
      <EmptyState
        icon="alert"
        title="سؤالی برای نمایش نیست"
        note="این آزمون فعلاً بدون سؤال است."
        action={
          <button type="button" onClick={onExit} className="mt-3 cursor-pointer rounded-xl bg-[var(--purple-bright)] px-5 py-2 text-sm">
            بازگشت
          </button>
        }
      />
    );
  }

  return (
    <div className="intl-layer relative" dir="rtl">
      {/* ── نوار بالای محیط حل ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-white/8 bg-[var(--surface-soft)] px-4 py-3 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/6 px-3 py-2 text-xs transition-colors hover:bg-white/12"
          >
            <Icon name="back" className="h-3.5 w-3.5" />
            خروج
          </button>
          <div className="min-w-0">
            <strong className="block truncate text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">{examMeta.title}</strong>
            <span className="text-[11px] text-[var(--faint)]">
              {exam?.shortName ?? 'آزمون بین‌الملل'} · {toFa(answeredCount)} از {toFa(questions.length)} پاسخ داده شده
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm [font-variant-numeric:tabular-nums] ${
              remaining !== null && remaining < 300 ? 'bg-[#e26d6d]/15 text-[var(--red-ink)]' : 'bg-white/6 text-[var(--muted)]'
            }`}
            aria-label={`زمان سپری‌شده: ${formatClock(elapsed)}`}
          >
            <Icon name="clock" className="h-4 w-4" />
            {remaining !== null ? formatClock(remaining) : formatClock(elapsed)}
          </span>
          <button
            type="button"
            onClick={finish}
            disabled={submitting}
            className="cursor-pointer rounded-xl bg-[var(--purple-bright)] px-4 py-2 text-xs font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            پایان و تحلیل
          </button>
        </div>
      </div>

      {/* نوار پیشرفت */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="intl-progress-fill h-full rounded-full bg-gradient-to-l from-[var(--purple-bright)] to-[#937fcd]/70" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-5 grid gap-6 pb-28 lg:grid-cols-[minmax(0,1fr)_290px] lg:pb-0">
        {/* ── ستون سؤال ── */}
        <div>
          <div key={question.id} className="intl-question-in rounded-[2rem] border border-white/8 bg-[var(--surface-soft)] p-5 md:p-7">
            {/* سربرگ سؤال */}
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#937fcd]/15 px-3 py-1 text-xs text-[var(--purple-soft-ink)] [font-family:'Doran','Vazir',Tahoma,sans-serif]">
                  سؤال {toFa(currentIndex + 1)} / {toFa(questions.length)}
                </span>
                <SampleTag />
                <DifficultyBadge difficulty={question.difficulty} />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleBookmark}
                  aria-pressed={bookmarks.includes(question.id)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-colors ${
                    bookmarks.includes(question.id) ? 'bg-[#e26d6d]/15 text-[var(--red-ink)]' : 'bg-white/6 text-[var(--muted)] hover:text-white'
                  }`}
                >
                  <Icon name="heart" className={`h-4 w-4 ${bookmarks.includes(question.id) ? '' : 'opacity-60'}`} strokeWidth={bookmarks.includes(question.id) ? 2.2 : 1.7} />
                  {bookmarks.includes(question.id) ? 'گلچین شد' : 'گلچین'}
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCollectionPop((prev) => !prev)}
                    aria-expanded={collectionPop}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/6 px-3 py-2 text-xs text-[var(--muted)] transition-colors hover:text-white"
                  >
                    <Icon name="layers" className="h-4 w-4" />
                    <span className="hidden sm:inline">افزودن به مجموعه</span>
                  </button>
                  {collectionPop && (
                    <AddToCollectionPopover userId={userId} questionId={question.id} onClose={() => setCollectionPop(false)} />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  aria-label="گزارش مشکل این سؤال"
                  className="cursor-pointer rounded-xl bg-white/6 p-2 text-[var(--muted)] transition-colors hover:text-white"
                >
                  <Icon name="flag" className="h-4 w-4" />
                </button>
              </div>
            </header>

            {/* متن سؤال */}
            <BilingualText
              as="h2"
              en={question.stem}
              fa={question.stemFa}
              mode={langMode}
              split
              className="mt-5 text-[15.5px] leading-8 text-white md:text-base"
            />

            {/* گزینه‌ها */}
            <div className="mt-5 space-y-2.5" role="group" aria-label="گزینه‌های سؤال">
              {question.options.map((option) => {
                let state = 'idle';
                if (revealed) {
                  if (option.key === question.correctAnswer) state = 'correct';
                  else if (option.key === answer?.selectedAnswer) state = 'wrong';
                } else if (selected === option.key) {
                  state = 'selected';
                }
                return (
                  <OptionButton
                    key={option.key}
                    option={option}
                    state={state}
                    langMode={langMode}
                    disabled={revealed || submitting}
                    onSelect={() => setSelected(option.key)}
                  />
                );
              })}
            </div>

            {/* ثبت پاسخ */}
            {!revealed && (
              <button
                type="button"
                onClick={handleSubmitAnswer}
                disabled={selected == null || submitting}
                className="mt-5 w-full cursor-pointer rounded-2xl bg-[var(--purple-bright)] py-3 text-sm font-bold transition-all hover:-translate-y-0.5 hover:bg-[var(--purple-bright)] disabled:cursor-default disabled:translate-y-0 disabled:bg-white/8 disabled:text-[var(--faint)]"
              >
                {submitting ? 'در حال ثبت…' : selected == null ? 'یک گزینه را انتخاب کن' : 'ثبت پاسخ'}
              </button>
            )}

            {/* پاسخ شما / صحیح */}
            {revealed && (
              <div className="intl-reveal mt-4 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="rounded-full bg-white/6 px-3 py-1.5 text-[var(--muted)]">
                  پاسخ شما: <strong className="text-white">{answer?.selectedAnswer}</strong>
                </span>
                <span className="rounded-full bg-[#77b787]/12 px-3 py-1.5 text-[var(--green-soft-ink)]">
                  پاسخ صحیح: <strong>{question.correctAnswer}</strong>
                </span>
                <span
                  className={`rounded-full px-3 py-1.5 font-bold ${
                    answer?.isCorrect ? 'bg-[#77b787]/15 text-[var(--green-soft-ink)]' : 'bg-[#e26d6d]/12 text-[var(--red-ink)]'
                  }`}
                >
                  {answer?.isCorrect ? 'صحیح' : 'نادرست'}
                </span>
              </div>
            )}
          </div>

          {/* تحلیل سؤال پس از ثبت */}
          {revealed && <div className="mt-4"><QuestionExplanation question={question} exam={exam} languageMode={langMode} selectedAnswer={answer?.selectedAnswer} /></div>}

          {/* ناوبری قبلی/بعدی */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="cursor-pointer rounded-xl bg-white/6 px-4 py-2.5 text-sm transition-colors hover:bg-white/12 disabled:cursor-default disabled:opacity-40"
            >
              سؤال قبلی
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={finish}
                disabled={submitting}
                className="cursor-pointer rounded-xl bg-[var(--green-bright)] px-5 py-2.5 text-sm font-bold text-[#12271a] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                پایان آزمون و مشاهدهٔ تحلیل
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goTo(currentIndex + 1)}
                className="cursor-pointer rounded-xl bg-[var(--purple-bright)] px-5 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5"
              >
                سؤال بعدی
              </button>
            )}
          </div>
        </div>

        {/* ── نویگیتور دسکتاپ ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded-[1.75rem] border border-white/8 bg-[var(--surface-soft)] p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              <Icon name="grid" className="h-4 w-4 text-[var(--purple-ink)]" />
              نقشهٔ سؤال‌ها
            </h3>
            <QuestionNavigator
              questions={questions}
              currentIndex={currentIndex}
              answers={answers}
              bookmarks={bookmarks}
              filter={filter}
              onFilter={setFilter}
              onJump={goTo}
              onExpand={() => setFullMapOpen(true)}
            />
            <div className="mt-4 border-t border-white/8 pt-3">
              <p className="mb-2 text-[11px] text-[var(--faint)]">زبان سؤال</p>
              <LanguageToggle value={langMode} onChange={setLangMode} className="w-full" />
            </div>
          </div>
        </aside>
      </div>

      {/* ── نوار پایین موبایل: نویگیتور / زبان / بعدی ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#1c1c1c]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <button
            type="button"
            onClick={() => setNavigatorOpen(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/8 px-3.5 py-2.5 text-xs"
          >
            <Icon name="grid" className="h-4 w-4 text-[var(--purple-ink)]" />
            نقشه
          </button>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="cursor-pointer rounded-xl bg-white/8 p-2.5 text-[var(--muted)]"
            aria-label="فیلتر سطح سختی"
          >
            <Icon name="filter" className="h-4 w-4" />
          </button>
          <LanguageToggle value={langMode} onChange={setLangMode} className="ms-auto scale-90" />
          <button
            type="button"
            onClick={() => (isLast ? finish() : goTo(currentIndex + 1))}
            disabled={submitting}
            className="shrink-0 cursor-pointer rounded-xl bg-[var(--purple-bright)] px-4 py-2.5 text-xs font-bold disabled:opacity-60"
          >
            {isLast ? 'پایان' : 'بعدی'}
          </button>
        </div>
      </div>

      {/* Bottom Sheet نویگیتور */}
      {navigatorOpen && (
        <div className="intl-fade fixed inset-0 z-50 bg-black/70 lg:hidden" onClick={() => setNavigatorOpen(false)}>
          <div
            className="intl-sheet absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-[2rem] border-t border-white/10 bg-[var(--surface-soft)] p-5 pb-8"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="نقشهٔ سؤال‌ها"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">نقشهٔ سؤال‌ها</h3>
              <button type="button" onClick={() => setNavigatorOpen(false)} aria-label="بستن" className="cursor-pointer rounded-lg bg-white/6 p-1.5">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <QuestionNavigator
              questions={questions}
              currentIndex={currentIndex}
              answers={answers}
              bookmarks={bookmarks}
              filter={filter}
              onFilter={setFilter}
              onJump={goTo}
            />
          </div>
        </div>
      )}

      {/* پاپ‌آپ لیست کامل سؤال‌ها — وقتی نقشهٔ سایدبار دسکتاپ سرریز شده */}
      {fullMapOpen && (
        <div
          className="intl-fade fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="لیست کامل سؤال‌ها"
          onClick={() => setFullMapOpen(false)}
        >
          <div
            className="intl-pop flex max-h-[85vh] w-[min(26rem,100%)] flex-col rounded-[2rem] border border-white/10 bg-[var(--surface-soft)] p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">
                <Icon name="grid" className="h-4 w-4 text-[var(--purple-ink)]" />
                لیست کامل سؤال‌ها
              </h3>
              <button type="button" onClick={() => setFullMapOpen(false)} aria-label="بستن" className="cursor-pointer rounded-lg bg-white/6 p-1.5">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <div className="intl-mapbody">
              <QuestionNavigator
                questions={questions}
                currentIndex={currentIndex}
                answers={answers}
                bookmarks={bookmarks}
                filter={filter}
                onFilter={setFilter}
                onJump={goTo}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet فیلتر */}
      {filterOpen && (
        <div className="intl-fade fixed inset-0 z-50 bg-black/70 lg:hidden" onClick={() => setFilterOpen(false)}>
          <div
            className="intl-sheet absolute inset-x-0 bottom-0 rounded-t-[2rem] border-t border-white/10 bg-[var(--surface-soft)] p-5 pb-8"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="فیلتر سطح سختی"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">فیلتر سطح سختی</h3>
              <button type="button" onClick={() => setFilterOpen(false)} aria-label="بستن" className="cursor-pointer rounded-lg bg-white/6 p-1.5">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFilter(null);
                  setFilterOpen(false);
                }}
                aria-pressed={filter === null}
                className={`cursor-pointer rounded-xl px-3 py-2.5 text-sm ${filter === null ? 'bg-[var(--purple-bright)] text-white' : 'bg-white/6 text-[var(--muted)]'}`}
              >
                همه سؤال‌ها
              </button>
              {DIFFICULTY_ORDER.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => {
                    setFilter(level);
                    setFilterOpen(false);
                  }}
                  aria-pressed={filter === level}
                  className={`cursor-pointer rounded-xl px-3 py-2.5 text-sm ${filter === level ? 'bg-[var(--purple-bright)] text-white' : 'bg-white/6 text-[var(--muted)]'}`}
                >
                  {difficultyLabel(level)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {reportOpen && <ReportDialog questionId={question.id} onClose={() => setReportOpen(false)} />}
    </div>
  );
}
