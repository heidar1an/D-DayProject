/*
 * BankSession — محیط حل سؤال بانک تست. یک Room واحد با سه حالت:
 *   practice → بازخورد فوری + تحلیل + گلچین/نیاز به مرور/گزارش
 *   exam     → تایمر (endsAt از سرویس)، پاسخ مخفی، علامت‌گذاری، ثبت نهایی و تایم‌اوت
 *   review   → مرور سشن ثبت‌شده با نمایش پاسخ و تحلیل
 * Desktop: نویگیتور سایدبار چسبان | Mobile: نویگیتور در Bottom Sheet.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchHistory,
  fetchQuestionAttemptStats,
  reportQuestion,
  saveSessionProgress,
  submitSession,
  toggleBookmark,
  toggleNeedReview,
  DIFFICULTIES,
  QUESTION_TYPES,
  SOURCES,
  SUBJECTS,
  bankKindOf,
  trackOf,
} from '../../../../services/testBank/testBankService';
import {
  BankKindBadge,
  DifficultyBadge,
  EmptyState,
  Icon,
  Modal,
  OptionButton,
  QuestionFigure,
  SourceBadge,
  TrackBadge,
  TypeBadge,
  faNum,
  formatClock,
  formatFullDate,
  formatFullTime,
  toFa,
} from './bankShared';
import useOverflowFlag from '../useOverflowFlag';

const REPORT_REASONS = ['ایراد علمی', 'ایراد نگارشی', 'گزینه‌های مبهم', 'تصویر مشکل دارد', 'پاسخ اشتباه', 'سایر'];

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

/* ── پنل تحلیل سؤال — از متن سؤال جدا ولی یکپارچه ── */
function ExplanationPanel({ question, userAnswer, myAttempts }) {
  const stats = question.stats ?? {};
  const explanation = question.explanation ?? {};

  return (
    <section className="tb-reveal overflow-hidden rounded-[2rem] border border-[#61D192]/20 bg-[var(--green-deep)] p-5 md:p-6" aria-label="پاسخ تشریحی">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/8 pb-3">
        <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#61D192]/15 text-[var(--green-ink)]">
          <Icon name="book" className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">تحلیل و پاسخ تشریحی</h3>
      </header>

      <div className="mt-4 space-y-4 text-[13.5px] leading-7 text-[var(--muted)]">
        {explanation.summary && (
          <p>
            <strong className="text-[var(--green-ink)]">چرا؟ </strong>
            {explanation.summary}
          </p>
        )}
        {explanation.deep && <p className="text-[var(--muted)]">{explanation.deep}</p>}

        {explanation.keyPoint && (
          <div className="rounded-2xl border border-[#937fcd]/25 bg-[#937fcd]/[0.08] p-4">
            <strong className="flex items-center gap-1.5 text-[13px] text-[var(--purple-soft-ink)]">
              <Icon name="spark" className="h-3.5 w-3.5" />
              نکتهٔ مهم
            </strong>
            <p className="mt-1.5">{explanation.keyPoint}</p>
          </div>
        )}

        {explanation.trap && (
          <div className="rounded-2xl border border-[#e0b45c]/25 bg-[#e0b45c]/[0.07] p-4">
            <strong className="flex items-center gap-1.5 text-[13px] text-[var(--gold-ink)]">
              <Icon name="alert" className="h-3.5 w-3.5" />
              دام تستی
            </strong>
            <p className="mt-1.5">{explanation.trap}</p>
          </div>
        )}

        {explanation.whyWrong?.length > 0 && (
          <div>
            <strong className="text-[13px] text-[var(--muted)]">چرا گزینه‌های دیگر غلط‌اند؟</strong>
            <ul className="mt-2 space-y-2">
              {explanation.whyWrong.map((item) => (
                <li key={item.index} className="flex gap-2.5 rounded-xl bg-white/[0.04] px-3.5 py-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#e26d6d]/15 text-[11px] font-bold text-[var(--red-ink)]">
                    {OPTION_KEYS[item.index] ?? toFa(item.index + 1)}
                  </span>
                  <span className="min-w-0">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* آمار سؤال — جامعه + خود کاربر */}
      {stats.solves != null && (
        <footer className="mt-5 border-t border-white/8 pt-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-[var(--faint)]">
            <span className="flex items-center gap-1.5">
              <Icon name="users" className="h-3.5 w-3.5" />
              {faNum(stats.solves)} نفر حل کرده‌اند
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="check" className="h-3.5 w-3.5 text-[var(--green-ink)]" />
              {toFa(stats.correctPercent)}٪ پاسخ صحیح
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="clock" className="h-3.5 w-3.5" />
              میانگین زمان: {toFa(stats.avgTimeSec ?? '—')} ثانیه
            </span>
            {myAttempts > 0 && (
              <span className="flex items-center gap-1.5">
                <Icon name="history" className="h-3.5 w-3.5" />
                تو {toFa(myAttempts)} بار حل کرده‌ای
              </span>
            )}
          </div>

          {/* توزیع گزینه‌ها در جامعه */}
          <div className="mt-3.5 space-y-1.5" aria-label="درصد انتخاب هر گزینه">
            {(stats.optionPercents ?? []).map((percent, index) => {
              const isCorrect = index === question.correctAnswer;
              return (
                <div key={index} className="flex items-center gap-2.5">
                  <span className={`w-5 shrink-0 text-center text-[11px] font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif] ${isCorrect ? 'text-[var(--green-ink)]' : 'text-[var(--faint)]'}`}>
                    {OPTION_KEYS[index]}
                  </span>
                  <span className="tb-bar flex-1" style={{ height: '7px' }}>
                    <span
                      className="tb-bar__fill block"
                      style={{ width: `${percent}%`, background: isCorrect ? '#61D192' : 'rgb(var(--wash-rgb) / 0.22)' }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-left text-[11px] text-[var(--faint)]">{toFa(percent)}٪</span>
                  {userAnswer?.selected === index && (
                    <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9.5px] text-[var(--muted)]">انتخاب تو</span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3.5 text-[11px] text-[var(--faint)]">
            منبع: {SOURCES[question.source]?.label ?? '—'} · سال {toFa(question.year)}
          </p>
        </footer>
      )}
    </section>
  );
}

/* ── مودال گزارش سؤال ──
   شناسهٔ سؤال به کاربر نشان داده نمی‌شود؛ فقط در بدنهٔ گزارش سرویس می‌رود.
   انتخاب دلیل با رنگ قرمز پروژه مشخص می‌شود و با «سایر»، عنوان دلخواه (تا ۲۰ کاراکتر) گرفته می‌شود. */
function ReportDialog({ userId, questionId, onClose }) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [otherTitle, setOtherTitle] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const resolvedReason = reason === 'سایر' && otherTitle.trim() ? `سایر: ${otherTitle.trim()}` : reason;
    await reportQuestion(userId, questionId, { reason: resolvedReason, note });
    setSent(true);
  };

  return (
    <Modal open onClose={sent ? onClose : () => {}} title="گزارش مشکل سؤال" width="min(26rem, 100%)">
      {sent ? (
        <div className="py-4 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#61D192]/15 text-[var(--green-ink)]">
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
          <p className="mt-1.5 text-xs text-[var(--faint)]">مشکل را انتخاب کن؛ توضیح بیشتر هم می‌تواند کمک‌کننده باشد.</p>
          <fieldset className="mt-4 grid grid-cols-2 gap-1.5">
            <legend className="sr-only">دلیل گزارش</legend>
            {REPORT_REASONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setReason(item)}
                aria-pressed={reason === item}
                className={`cursor-pointer rounded-xl border px-3 py-2.5 text-[12.5px] transition-colors ${
                  reason === item
                    ? 'border-[#e26d6d]/60 bg-[#e26d6d]/12 text-[var(--red-ink)]'
                    : 'border-white/8 text-[var(--muted)] hover:border-white/20'
                }`}
              >
                {item}
              </button>
            ))}
          </fieldset>
          {reason === 'سایر' && (
            <input
              type="text"
              value={otherTitle}
              onChange={(event) => setOtherTitle(event.target.value)}
              maxLength={20}
              placeholder="عنوان مشکل (حداکثر ۲۰ کاراکتر)…"
              aria-label="عنوان مشکل"
              className="mt-3 w-full rounded-xl border border-[#e26d6d]/40 bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--ghost)] focus:border-[#e26d6d]/70 focus:outline-none"
            />
          )}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="توضیح اختیاری…"
            rows={2}
            className="mt-3 w-full resize-none rounded-xl border border-[#e26d6d]/40 bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--ghost)] focus:border-[#e26d6d]/70 focus:outline-none"
          />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={submit}
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
    </Modal>
  );
}

/* ── نویگیتور سؤال‌ها ──
   onExpand فقط در سایدبار دسکتاپ پاس داده می‌شود؛ وقتی گرید از ظرفیت کادر سرریز
   کند، دکمهٔ «لیست کامل سؤال‌ها» برای باز کردن پاپ‌آپ نمایش داده می‌شود. */
function QuestionNavigator({ questions, answers, marked, currentIndex, reviewMode, onJump, onExpand }) {
  /* تشخیص سرریز — با هر تغییر تعداد سؤال‌ها دوباره اندازه می‌گیرد */
  const [gridRef, overflowing] = useOverflowFlag(questions.length);
  const stateOf = (question, index) => {
    const answer = answers[question.id];
    if (index === currentIndex) return 'current';
    if (answer && reviewMode) return 'answered';
    if (answer && answer.isCorrect === true) return 'answered';
    if (answer && answer.isCorrect === false) return 'wrong';
    if (answer) return 'answered';
    return 'idle';
  };

  return (
    <div>
      <div ref={gridRef} className={onExpand ? 'tb-navscroll' : undefined}>
        <div className="tb-navgrid" role="list" aria-label="ناوبری سؤال‌ها">
          {questions.map((question, index) => {
            const state = stateOf(question, index);
            const isMarked = marked.includes(question.id);
            return (
              <button
                key={question.id}
                type="button"
                role="listitem"
                onClick={() => onJump(index)}
                aria-label={`سؤال ${toFa(index + 1)}${state === 'answered' ? '، پاسخ داده شده' : state === 'wrong' ? '، غلط' : state === 'idle' ? '، حل‌نشده' : '، فعلی'}${isMarked ? '، علامت‌گذاری شده' : ''}`}
                aria-current={index === currentIndex ? 'step' : undefined}
                className={`tb-navchip ${state === 'answered' ? 'is-answered' : ''} ${state === 'wrong' ? 'is-wrong' : ''} ${state === 'current' ? 'is-current' : ''} ${isMarked ? 'is-marked' : ''}`}
              >
                {toFa(index + 1)}
                {isMarked && <span className="tb-navchip__flag" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      {onExpand && overflowing && (
        <button type="button" onClick={onExpand} className="tb-navmore">
          <Icon name="grid" className="h-3.5 w-3.5" />
          لیست کامل سؤال‌ها ({toFa(questions.length)})
        </button>
      )}

      <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/8 pt-3 text-[11px] text-[var(--faint)]">
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-md bg-[#61D192]/60" aria-hidden="true" /> پاسخ داده‌شده
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-md bg-[#e26d6d]/60" aria-hidden="true" /> غلط
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-md bg-[var(--gold)]" aria-hidden="true" /> علامت‌گذاری‌شده
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-md bg-white/20" aria-hidden="true" /> حل‌نشده
        </li>
      </ul>
    </div>
  );
}

/* ── پنل سمت چپ: پیشرفت همین تمرین + شکست تلاش‌های کاربر روی سؤال جاری ──
   همهٔ عددها از سرویس می‌آید؛ «کل بار» = تعداد بارهایی که سؤال در سشن‌های ثبت‌شده ظاهر شده. */
function SessionInsights({ answeredCount, total, questionStats }) {
  const stat = questionStats;
  /* رنگ هر ردیف همان رنگ راهنمای پایین همین کادر است (نقشهٔ سؤال‌ها) */
  const rows = [
    { key: 'appearances', label: 'کل بار', value: stat?.appearances ?? 0, dot: 'bg-[var(--gold)]' },
    { key: 'correct', label: 'درست', value: stat?.correct ?? 0, dot: 'bg-[#61D192]/60' },
    { key: 'wrong', label: 'غلط', value: stat?.wrong ?? 0, dot: 'bg-[#e26d6d]/60' },
    { key: 'skipped', label: 'بی‌پاسخ', value: stat?.skipped ?? 0, dot: 'bg-white/20' },
  ];

  return (
    <>
      {/* پیشرفت پاسخ‌دهی همین تمرین */}
      <div className="rounded-2xl bg-white/[0.04] px-3.5 py-3">
        <span className="text-[11px] text-[var(--faint)]">پیشرفت این تمرین</span>
        <strong className="mt-1 block text-[13px] [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          {faNum(answeredCount)} از {faNum(total)} پاسخ داده شده
        </strong>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/8" aria-hidden="true">
          <span
            className="block h-full rounded-full bg-gradient-to-l from-[var(--green-vivid)] to-[#61D192]/70"
            style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }}
          />
        </span>
      </div>

      {/* شکست تلاش‌های کاربر روی همین سؤال */}
      <section className="mt-3 rounded-2xl bg-white/[0.04] px-3.5 py-3" aria-label="آمار این سؤال">
        <h4 className="flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--muted)] [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          <Icon name="chart" className="h-3.5 w-3.5 text-[var(--green-ink)]" />
          آمار این سؤال
        </h4>

        {stat === null ? (
          <p className="mt-2 text-[11.5px] text-[var(--faint)]">در حال خواندن…</p>
        ) : stat.appearances === 0 ? (
          <p className="mt-2 text-[11.5px] text-[var(--faint)]">این سؤال را هنوز نزده‌ای.</p>
        ) : (
          <>
            <dl className="mt-2.5 space-y-1.5 text-[11.5px]">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.05] px-2.5 py-1.5"
                >
                  <dt className="flex items-center gap-2 text-[var(--faint)]">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-md ${row.dot}`} aria-hidden="true" />
                    {row.label}
                  </dt>
                  <dd className="font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">{toFa(row.value)}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-5 text-[var(--faint)]">
              <Icon name="history" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {stat.lastAnsweredAt
                  ? `آخرین پاسخ: ${formatFullTime(stat.lastAnsweredAt)} · ${formatFullDate(stat.lastAnsweredAt)}`
                  : 'پاسخی ثبت نشده؛ فقط بی‌پاسخ مانده است.'}
              </span>
            </p>
          </>
        )}
      </section>
    </>
  );
}

/* ══════════════════════════ BankSession ══════════════════════════ */
export default function BankSession({ userId, session, questions, onFinished, onExit }) {
  const mode = session.mode; // practice | exam | review
  const isExam = mode === 'exam';
  const isReview = mode === 'review';

  const [currentIndex, setCurrentIndex] = useState(session.currentIndex ?? 0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState(
    isReview
      ? Object.fromEntries(
          questions
            .filter((question) => question.userAnswer)
            .map((question) => [question.id, { selected: question.userAnswer.selected, isCorrect: question.userAnswer.isCorrect ?? question.userAnswer.selected === question.correctAnswer }]),
        )
      : session.answers ?? {},
  );
  const [marked, setMarked] = useState(session.marked ?? []);
  const [bookmarks, setBookmarks] = useState([]); // qid[] — گلچین
  const [reviewFlags, setReviewFlags] = useState([]); // qid[] — نیاز به مرور
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [fullMapOpen, setFullMapOpen] = useState(false); // پاپ‌آپ لیست کامل سؤال‌ها در دسکتاپ
  const [reportOpen, setReportOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - session.startedAt) / 1000));
  const [submitting, setSubmitting] = useState(false);
  const [questionStats, setQuestionStats] = useState(null); // شکست تلاش‌های کاربر روی سؤال جاری
  const [statsTick, setStatsTick] = useState(0); // با هر ثبت پاسخ زیاد می‌شود تا «آمار این سؤال» تازه شود
  const lastStatsQidRef = useRef(null);
  const questionStartRef = useRef(Date.now());
  const autoSubmittedRef = useRef(false);

  const question = questions[currentIndex];
  const answer = answers[question?.id];
  const revealed = isReview || (!isExam && Boolean(answer));

  /* گلچین و نیاز به مرور فعلی کاربر — از سرویس، فقط در practice */
  useEffect(() => {
    if (isExam) return undefined;
    let alive = true;
    fetchHistory(userId)
      .then((data) => {
        if (!alive) return;
        setBookmarks(data.bookmarks.map((item) => item.id));
        setReviewFlags(data.review.map((item) => item.id));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, isExam]);

  /* شکست تلاش‌های کاربر روی سؤال جاری — با تعویض سؤال و با هر ثبت پاسخ دوباره خوانده می‌شود */
  useEffect(() => {
    const qid = question?.id;
    if (isReview || !qid) {
      lastStatsQidRef.current = null;
      setQuestionStats(null);
      return undefined;
    }
    let alive = true;
    /* با تعویض سؤال، آمار قبلی پاک می‌شود؛ ولی پس از ثبت پاسخ روی همین سؤال، عدد قدیمی
       می‌ماند تا پاسخ تازهٔ سرویس بدون فلش «در حال خواندن…» جایگزینش شود */
    if (lastStatsQidRef.current !== qid) setQuestionStats(null);
    lastStatsQidRef.current = qid;
    fetchQuestionAttemptStats(userId, qid)
      .then((data) => alive && setQuestionStats(data))
      .catch(() => alive && setQuestionStats(null));
    return () => {
      alive = false;
    };
  }, [userId, question?.id, isReview, statsTick]);

  /* تایمر فقط در «آزمون» معنا دارد؛ تمرین‌های آموزشی بی‌زمان‌اند و شمارنده ندارند */
  useEffect(() => {
    if (!isExam) return undefined;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - session.startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isExam, session.startedAt]);

  const remaining = session.endsAt ? Math.floor((session.endsAt - Date.now()) / 1000) : null;

  const finish = useCallback(
    async (reason = 'user') => {
      if (submitting) return;
      setSubmitting(true);
      const submitted = await submitSession(userId, session.id, { reason });
      onFinished(submitted);
    },
    [onFinished, session.id, submitting, userId],
  );

  /* پایان خودکار در اتمام زمان */
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !autoSubmittedRef.current && !submitting) {
      autoSubmittedRef.current = true;
      finish('timeout');
    }
  }, [finish, remaining, submitting]);

  const persist = (patch) => {
    if (isReview) return;
    saveSessionProgress(userId, { ...session, ...patch });
  };

  const goTo = (index) => {
    const next = Math.max(0, Math.min(questions.length - 1, index));
    setCurrentIndex(next);
    setSelected(isReview ? answers[questions[next]?.id]?.selected ?? null : null);
    questionStartRef.current = Date.now();
    setNavigatorOpen(false);
    setFullMapOpen(false);
    if (!isReview) persist({ currentIndex: next, answers });
  };

  /* ثبت پاسخ — practice: تصحیح فوری | exam: فقط ذخیره انتخاب */
  const handleSubmitAnswer = async () => {
    if (selected == null || revealed || submitting) return;
    const timeSpent = Math.round((Date.now() - questionStartRef.current) / 1000);
    const entry = {
      selected,
      ...(isExam ? {} : { isCorrect: selected === question.correctAnswer }),
      timeSpent,
      answeredAt: Date.now(),
    };
    const nextAnswers = { ...answers, [question.id]: entry };
    setAnswers(nextAnswers);
    persist({ answers: { [question.id]: entry } });
    /* آمار سؤال (کل بار / درست / غلط / آخرین پاسخ) بلافاصله بعد از ثبت، دوباره خوانده می‌شود */
    setStatsTick((tick) => tick + 1);
  };

  const toggleMark = () => {
    const isOn = !marked.includes(question.id);
    setMarked((prev) => (isOn ? [...prev, question.id] : prev.filter((id) => id !== question.id)));
    persist({ marked: isOn ? [...marked, question.id] : marked.filter((id) => id !== question.id) });
  };

  const handleBookmark = async () => {
    const isOn = await toggleBookmark(userId, question.id);
    setBookmarks((prev) => (isOn ? [...new Set([...prev, question.id])] : prev.filter((id) => id !== question.id)));
  };

  const handleReviewFlag = async () => {
    const isOn = await toggleNeedReview(userId, question.id);
    setReviewFlags((prev) => (isOn ? [...new Set([...prev, question.id])] : prev.filter((id) => id !== question.id)));
  };

  /* میان‌برهای کیبورد: ۱-۴ انتخاب گزینه، Enter ثبت/بعدی */
  useEffect(() => {
    const handleKey = (event) => {
      if (reportOpen || submitOpen) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const digit = Number(event.key);
      if (digit >= 1 && digit <= question?.options.length && !revealed) {
        setSelected(digit - 1);
      } else if (event.key === 'Enter' && !isReview) {
        if (!revealed && selected != null) handleSubmitAnswer();
        else if (revealed && currentIndex < questions.length - 1) goTo(currentIndex + 1);
      } else if (event.key === 'ArrowRight' && currentIndex > 0) {
        goTo(currentIndex - 1);
      } else if (event.key === 'ArrowLeft' && currentIndex < questions.length - 1) {
        goTo(currentIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  const answeredCount = Object.keys(answers).length;
  const progress = questions.length ? (answeredCount / questions.length) * 100 : 0;
  const isLast = currentIndex === questions.length - 1;
  const subject = SUBJECTS.find((item) => item.id === question?.subject);
  const bookmarked = bookmarks.includes(question?.id);
  const reviewFlagged = reviewFlags.includes(question?.id);
  const isMarked = marked.includes(question?.id);

  const timerClass = useMemo(() => {
    if (remaining === null) return '';
    if (remaining <= 60) return 'tb-timer--danger';
    if (remaining <= 300) return 'tb-timer--warn';
    return 'tb-timer--ok';
  }, [remaining]);

  if (!question) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <EmptyState
          icon="alert"
          title="سؤالی برای نمایش نیست"
          note="این سشن فعلاً بدون سؤال است."
          action={
            <button type="button" onClick={onExit} className="mt-3 cursor-pointer rounded-xl bg-[var(--green-vivid)] px-5 py-2 text-sm font-bold text-[#12271a]">
              بازگشت
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto w-full max-w-[62rem]">
      {/* ── نوار کنترلی — بدون کادر و بدون عنوان سشن؛ شمارش پاسخ‌ها در پنل سمت چپ است ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (isExam ? onExit() : finish())}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/6 px-3 py-2 text-xs text-[var(--muted)] transition-colors hover:bg-white/12 hover:text-white"
        >
          <Icon name="back" className="h-3.5 w-3.5" />
          خروج
        </button>

        <div className="flex items-center gap-2">
          {isExam && (
            <span className={`tb-timer ${timerClass}`} role="timer" aria-label={remaining !== null ? 'زمان باقی‌مانده' : 'زمان سپری‌شده'}>
              <Icon name="clock" className="h-4 w-4" />
              {remaining !== null ? formatClock(remaining) : formatClock(elapsed)}
            </span>
          )}
          {!isReview && (
            <button
              type="button"
              onClick={() => (isExam ? setSubmitOpen(true) : finish())}
              disabled={submitting}
              className="cursor-pointer rounded-xl bg-[var(--purple-bright)] px-4 py-2 text-xs font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {isExam ? 'پایان و تحلیل' : 'پایان تمرین'}
            </button>
          )}
        </div>
      </div>

      {/* نوار پیشرفت */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-l from-[var(--green-vivid)] to-[#61D192]/70 transition-[width] duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* ── ستون سؤال ── */}
        <div>
          <div key={question.id} className="tb-question rounded-[2rem] border border-white/8 bg-[var(--surface)] p-5 md:p-7">
            {/* سربرگ سؤال */}
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#61D192]/12 px-3 py-1 text-xs text-[var(--green-soft-ink)] [font-family:'Doran','Vazir',Tahoma,sans-serif]">
                  سؤال {toFa(currentIndex + 1)} از {toFa(questions.length)}
                </span>
                {subject && (
                  <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: subject.accent }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: subject.accent }} aria-hidden="true" />
                    {subject.name}
                  </span>
                )}
                <span className="text-[11px] text-[var(--faint)]">{question.topicPath.join(' › ')}</span>
                <BankKindBadge kind={bankKindOf(question)} />
                <TrackBadge track={trackOf(question)} />
                <DifficultyBadge difficulty={question.difficulty} />
              </div>

              <div className="flex items-center gap-1.5">
                {/* نشان‌های وضعیت کاربر روی سؤال */}
                {!isExam && (
                  <>
                    <button
                      type="button"
                      onClick={handleBookmark}
                      aria-pressed={bookmarked}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-colors ${
                        bookmarked ? 'bg-[#e26d6d]/15 text-[var(--red-ink)]' : 'bg-white/6 text-[var(--muted)] hover:text-white'
                      }`}
                    >
                      <Icon name={bookmarked ? 'heartFilled' : 'heart'} className="h-4 w-4" />
                      {bookmarked ? 'گلچین شد' : 'گلچین'}
                    </button>
                    <button
                      type="button"
                      onClick={handleReviewFlag}
                      aria-pressed={reviewFlagged}
                      className={`cursor-pointer rounded-xl p-2 transition-colors ${reviewFlagged ? 'bg-[#937fcd]/20 text-[var(--purple-soft-ink)]' : 'bg-white/6 text-[var(--muted)] hover:text-white'}`}
                      aria-label="علامت نیاز به مرور"
                      title="نیاز به مرور"
                    >
                      <Icon name="refresh" className="h-4 w-4" />
                    </button>
                  </>
                )}
                {isExam && (
                  <button
                    type="button"
                    onClick={toggleMark}
                    aria-pressed={isMarked}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-colors ${
                      isMarked ? 'bg-[#e0b45c]/15 text-[var(--gold-ink)]' : 'bg-white/6 text-[var(--muted)] hover:text-white'
                    }`}
                  >
                    <Icon name="flag" className="h-4 w-4" />
                    {isMarked ? 'علامت‌دار' : 'علامت'}
                  </button>
                )}
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

            {/* متن سؤال — تایپوگرافی مطالعهٔ طولانی */}
            <h2 className="mt-5 text-[15.5px] leading-8 text-white md:text-base">{question.stem}</h2>

            {question.figure && <QuestionFigure name={question.figure} />}

            {/* گزینه‌ها */}
            <div className="mt-5 space-y-2.5" role="group" aria-label="گزینه‌های سؤال">
              {question.options.map((option, index) => {
                let state = 'idle';
                if (revealed) {
                  if (index === question.correctAnswer) state = 'correct';
                  else if (index === answer?.selected) state = 'wrong';
                  else state = 'muted';
                } else if (selected === index) {
                  state = 'selected';
                }
                return (
                  <OptionButton
                    key={index}
                    option={option}
                    index={index}
                    state={state}
                    disabled={revealed || submitting}
                    onSelect={() => setSelected(index)}
                  />
                );
              })}
            </div>

            {/* ثبت پاسخ (فقط تا قبل از reveal) */}
            {!revealed && (
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={selected == null || submitting}
                  className="flex-1 cursor-pointer rounded-2xl bg-[var(--green-vivid)] py-3 text-sm font-bold text-[#12271a] transition-all hover:-translate-y-0.5 hover:bg-[var(--green-vivid)] disabled:cursor-default disabled:translate-y-0 disabled:bg-white/8 disabled:text-[var(--faint)] disabled:hover:translate-y-0"
                >
                  {selected == null ? 'یک گزینه را انتخاب کن' : isExam ? 'ذخیرهٔ پاسخ' : 'ثبت پاسخ و دیدن تحلیل'}
                </button>
                {selected != null && !isExam && (
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="cursor-pointer rounded-2xl bg-white/6 px-4 py-3 text-sm transition-colors hover:bg-white/12"
                  >
                    پاک کردن
                  </button>
                )}
              </div>
            )}

            {/* نتیجهٔ پاسخ پس از reveal */}
            {revealed && !isReview && answer && (
              <div className="tb-reveal mt-4 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="rounded-full bg-white/6 px-3 py-1.5 text-[var(--muted)]">
                  پاسخ تو: <strong className="text-white">{OPTION_KEYS[answer.selected]}</strong>
                </span>
                <span className="rounded-full bg-[#61D192]/12 px-3 py-1.5 text-[var(--green-soft-ink)]">
                  پاسخ صحیح: <strong>{OPTION_KEYS[question.correctAnswer]}</strong>
                </span>
                <span
                  className={`rounded-full px-3 py-1.5 font-bold ${
                    answer.isCorrect ? 'bg-[#61D192]/15 text-[var(--green-ink)]' : 'bg-[#e26d6d]/12 text-[var(--red-ink)]'
                  }`}
                >
                  {answer.isCorrect ? 'صحیح' : 'نادرست'}
                </span>
              </div>
            )}
          </div>

          {/* پنل تحلیل — بعد از ثبت در practice و همیشه در review؛ «فقط گزینهٔ صحیح» تحلیل را مخفی می‌کند */}
          {revealed && question.explanation && (isReview || session.explainDepth !== 'answer-only') && (
            <div className="mt-4">
              <ExplanationPanel
                question={question}
                userAnswer={answer ?? null}
                myAttempts={null}
              />
            </div>
          )}

          {/* ناوبری قبلی/بعدی */}
          <div className="mt-4 hidden items-center justify-between gap-3 lg:flex">
            <button
              type="button"
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="cursor-pointer rounded-xl bg-white/6 px-4 py-2.5 text-sm transition-colors hover:bg-white/12 disabled:cursor-default disabled:opacity-40"
            >
              سؤال قبلی
            </button>
            {isLast && isExam ? (
              <button
                type="button"
                onClick={() => setSubmitOpen(true)}
                disabled={submitting}
                className="cursor-pointer rounded-xl bg-[var(--green-vivid)] px-5 py-2.5 text-sm font-bold text-[#12271a] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                پایان آزمون و مشاهدهٔ کارنامه
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goTo(currentIndex + 1)}
                disabled={isLast}
                title={isLast ? 'به آخرین سؤال رسیده‌ای' : undefined}
                className="cursor-pointer rounded-xl bg-[var(--purple-bright)] px-5 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-default disabled:opacity-40 disabled:hover:translate-y-0"
              >
                سؤال بعدی
              </button>
            )}
          </div>
        </div>

        {/* ── پنل سمت چپ: پیشرفت تمرین + آمار سؤال + نقشهٔ سؤال‌ها ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-[1.75rem] border border-white/8 bg-[var(--surface)] p-4">
            <SessionInsights answeredCount={answeredCount} total={questions.length} questionStats={questionStats} />

            <h3 className="mb-3 mt-4 flex items-center gap-2 text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              <Icon name="grid" className="h-4 w-4 text-[var(--green-ink)]" />
              نقشهٔ سؤال‌ها
            </h3>
            <QuestionNavigator
              questions={questions}
              answers={answers}
              marked={marked}
              currentIndex={currentIndex}
              reviewMode={isReview}
              onJump={goTo}
              onExpand={() => setFullMapOpen(true)}
            />
          </div>
        </aside>
      </div>

      {/* ── نوار پایین موبایل ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#171719]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <button
            type="button"
            onClick={() => setNavigatorOpen(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/8 px-3.5 py-2.5 text-xs"
          >
            <Icon name="grid" className="h-4 w-4 text-[var(--green-ink)]" />
            نقشه
          </button>
          <button
            type="button"
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="cursor-pointer rounded-xl bg-white/8 p-2.5 text-[var(--muted)] disabled:opacity-40"
            aria-label="سؤال قبلی"
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => (isLast && isExam ? setSubmitOpen(true) : goTo(currentIndex + 1))}
            disabled={submitting || (isLast && !isExam)}
            className="shrink-0 cursor-pointer rounded-xl bg-[var(--green-vivid)] px-4 py-2.5 text-xs font-bold text-[#12271a] disabled:opacity-60"
          >
            {isLast && isExam ? 'پایان' : 'سؤال بعدی'}
          </button>
        </div>
      </div>

      {/* Bottom Sheet نویگیتور */}
      {navigatorOpen && (
        <>
          <div className="tb-drawer__scrim" onClick={() => setNavigatorOpen(false)} aria-hidden="true" />
          <div className="tb-drawer" role="dialog" aria-label="نقشهٔ سؤال‌ها">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">نقشهٔ سؤال‌ها</h3>
              <button type="button" onClick={() => setNavigatorOpen(false)} aria-label="بستن" className="cursor-pointer rounded-lg bg-white/6 p-1.5">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-4">
              <SessionInsights answeredCount={answeredCount} total={questions.length} questionStats={questionStats} />
            </div>
            <QuestionNavigator
              questions={questions}
              answers={answers}
              marked={marked}
              currentIndex={currentIndex}
              reviewMode={isReview}
              onJump={goTo}
            />
          </div>
        </>
      )}

      {/* پاپ‌آپ لیست کامل سؤال‌ها — وقتی نقشهٔ سایدبار دسکتاپ سرریز شده */}
      <Modal open={fullMapOpen} onClose={() => setFullMapOpen(false)} title="لیست کامل سؤال‌ها" width="min(26rem, 100%)">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            <Icon name="grid" className="h-4.5 w-4.5 text-[var(--green-ink)]" />
            لیست کامل سؤال‌ها ({toFa(questions.length)})
          </h3>
          <button type="button" onClick={() => setFullMapOpen(false)} aria-label="بستن" className="cursor-pointer rounded-lg bg-white/6 p-1.5">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="tb-mapbody">
          <QuestionNavigator
            questions={questions}
            answers={answers}
            marked={marked}
            currentIndex={currentIndex}
            reviewMode={isReview}
            onJump={goTo}
          />
        </div>
      </Modal>

      {/* مودال پایان آزمون — تمرین هیچ مودالی ندارد و مستقیم تمام می‌شود */}
      <Modal open={submitOpen} onClose={() => setSubmitOpen(false)} title="پایان آزمون">
        <h3 className="text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]">آزمون را تمام می‌کنی؟</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--faint)]">
          {answeredCount < questions.length
            ? `${faNum(questions.length - answeredCount)} سؤال بی‌پاسخ مانده؛ بی‌پاسخ‌ها غلط حساب می‌شوند.`
            : 'به همهٔ سؤال‌ها پاسخ دادی. آمادهٔ دیدن کارنامه‌ای.'}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSubmitOpen(false);
              finish();
            }}
            disabled={submitting}
            className="flex-1 cursor-pointer rounded-xl bg-[var(--green-vivid)] px-4 py-2.5 text-sm font-bold text-[#12271a] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            ثبت نهایی و کارنامه
          </button>
          <button
            type="button"
            onClick={() => {
              setSubmitOpen(false);
              onExit();
            }}
            className="cursor-pointer rounded-xl bg-white/8 px-4 py-2.5 text-sm transition-colors hover:bg-white/12"
          >
            ادامه بعداً
          </button>
        </div>
      </Modal>

      {reportOpen && <ReportDialog userId={userId} questionId={question.id} onClose={() => setReportOpen(false)} />}
    </div>
  );
}
