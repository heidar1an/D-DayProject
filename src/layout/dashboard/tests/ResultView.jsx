/*
 * Smart Review — صفحهٔ تحلیل نتیجهٔ آزمون.
 * فقط Score نمی‌دهد: تحلیل موضوعی، زمان، و مرور سؤال‌به‌سؤال با تحلیل کامل هر سؤال.
 */
import { useState } from 'react';
import { ProgressBar } from '../league/leagueShared';
import {
  EmptyState,
  faNum,
  formatClock,
  Icon,
  toFa,
} from './intlShared';
import QuestionExplanation from './QuestionExplanation';

/* حلقهٔ درصد امتیاز — مینیمال و هم‌پالت داشبورد */
function ScoreRing({ percentage }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, percentage)) / 100) * circumference;

  return (
    <div className="relative grid h-36 w-36 place-items-center" role="img" aria-label={`امتیاز شما ${toFa(percentage)} درصد`}>
      <svg viewBox="0 0 128 128" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="rgb(var(--wash-rgb) / 0.08)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="var(--purple-ink)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          style={{ transition: 'stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="text-center">
        <strong className="block text-3xl leading-8 [font-family:'Doran','Vazir',Tahoma,sans-serif]">{toFa(percentage)}٪</strong>
        <span className="text-[11px] text-[var(--faint)]">امتیاز شما</span>
      </div>
    </div>
  );
}

/* ردیف مرور سؤال */
function ReviewRow({ question, index, answer, expanded, onToggle }) {
  if (!question) return null;
  const status = !answer
    ? { label: 'بی‌پاسخ', cls: 'bg-white/6 text-[var(--faint)]' }
    : answer.isCorrect
      ? { label: 'صحیح', cls: 'bg-[#77b787]/12 text-[var(--green-soft-ink)]' }
      : { label: 'غلط', cls: 'bg-[#e26d6d]/12 text-[var(--red-ink)]' };

  return (
    <li className="overflow-hidden rounded-[1.75rem] border border-white/6 bg-[var(--surface-soft)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-right transition-colors hover:bg-white/[0.03] md:px-5"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-sm text-[var(--muted)] [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          {toFa(index + 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] text-[var(--white)]" dir="ltr">
            {question.stem}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--faint)]">
            <span>پاسخ شما: <strong className="text-[var(--muted)]">{answer?.selectedAnswer ?? '—'}</strong></span>
            <span>پاسخ صحیح: <strong className="text-[var(--green-soft-ink)]">{question.correctAnswer}</strong></span>
            {answer && <span>زمان: {formatClock(answer.timeSpent ?? 0)}</span>}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] ${status.cls}`}>{status.label}</span>
        <Icon name="chevron" className={`h-4 w-4 shrink-0 text-[var(--faint)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-white/6 p-4 md:p-5">
          <QuestionExplanation question={question} languageMode="fa" selectedAnswer={answer?.selectedAnswer} compact />
        </div>
      )}
    </li>
  );
}

export default function ResultView({ attempt, questions, onReviewMistakes, onNewExam, onHome }) {
  const [expandedId, setExpandedId] = useState(null);
  const result = attempt?.result;

  if (!result) {
    return <EmptyState icon="alert" title="نتیجه‌ای پیدا نشد" note="این آزمون هنوز ثبت نشده است." />;
  }

  const incorrectIds = attempt.questionIds.filter((questionId) => {
    const answer = attempt.answers?.[questionId];
    return answer && !answer.isCorrect;
  });

  const stats = [
    { label: 'پاسخ صحیح', value: `${toFa(result.correct)}`, accent: '#77b787' },
    { label: 'پاسخ غلط', value: `${toFa(result.incorrect)}`, accent: '#e26d6d' },
    { label: 'بی‌پاسخ', value: `${toFa(result.skipped)}`, accent: '#8a8a8a' },
    { label: 'زمان کل', value: formatClock(result.totalTime), accent: '#e0b45c' },
  ];

  return (
    <div className="dash-stagger space-y-5">
      {/* خلاصهٔ امتیاز */}
      <section className="rounded-[2.5rem] border border-white/8 bg-[var(--surface-soft)] p-6 md:p-8" aria-label="تحلیل نتیجه">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <ScoreRing percentage={result.percentage} />
            <div>
              <h1 className="text-xl [font-family:'Doran','Vazir',Tahoma,sans-serif] md:text-2xl">تحلیل آزمون</h1>
              <p className="mt-1 text-sm text-[var(--faint)]">{attempt.title}</p>
              <p className="mt-2 text-xs text-[var(--faint)]">
                {toFa(result.answered)} از {toFa(result.totalQuestions)} سؤال پاسخ داده شد · بهترین رگبار صحیح: {toFa(attempt.bestStreak ?? 0)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3 text-center">
                <strong className="block text-xl [font-family:'Doran','Vazir',Tahoma,sans-serif]" style={{ color: stat.accent }}>
                  {stat.value}
                </strong>
                <span className="text-[11px] text-[var(--faint)]">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* تحلیل موضوعی */}
      {result.topics.length > 0 && (
        <section className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-7" aria-label="تحلیل موضوعی">
          <h2 className="flex items-center gap-2 text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            <Icon name="chart" className="h-4.5 w-4.5 text-[var(--purple-ink)]" />
            کجا قوی هستی، کجا نه؟
          </h2>
          <div className="mt-5 space-y-3.5">
            {result.topics.map((topic) => (
              <div key={topic.subjectId} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-xs text-[var(--muted)]">{topic.subject?.nameFa ?? topic.subjectId}</span>
                <ProgressBar
                  value={topic.accuracy}
                  max={100}
                  color={topic.accuracy >= 70 ? '#77b787' : topic.accuracy >= 50 ? '#e0b45c' : '#e26d6d'}
                  height={7}
                  className="min-w-0 flex-1"
                />
                <span className="w-12 shrink-0 text-xs tabular-nums text-[var(--muted)]">{toFa(topic.accuracy)}٪</span>
                <span className="hidden w-16 shrink-0 text-[10px] text-[var(--faint)] sm:inline">
                  {toFa(topic.correct)}/{toFa(topic.total)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-white/6 pt-3 text-[11px] leading-5 text-[var(--faint)]">
            موضوعات زیر ۵۰٪ به «اشتباهات من» اضافه می‌شوند تا در مرور بعدی سراغشان بروی.
          </p>
        </section>
      )}

      {/* اقدام‌ها */}
      <div className="flex flex-wrap gap-2.5">
        {incorrectIds.length > 0 && (
          <button
            type="button"
            onClick={() => onReviewMistakes(incorrectIds)}
            className="cursor-pointer rounded-xl bg-[#e26d6d]/15 px-5 py-2.5 text-sm font-bold text-[var(--red-ink)] transition-transform hover:-translate-y-0.5"
          >
            مرور اشتباهات این آزمون ({toFa(incorrectIds.length)} سؤال)
          </button>
        )}
        <button
          type="button"
          onClick={onNewExam}
          className="cursor-pointer rounded-xl bg-[var(--purple-bright)] px-5 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5"
        >
          آزمون جدید بساز
        </button>
        <button
          type="button"
          onClick={onHome}
          className="cursor-pointer rounded-xl bg-white/8 px-5 py-2.5 text-sm transition-colors hover:bg-white/12"
        >
          بازگشت به صفحه اصلی
        </button>
      </div>

      {/* مرور سؤال‌به‌سؤال */}
      <section aria-labelledby="result-review-title">
        <h2 id="result-review-title" className="mb-3 text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          مرور پاسخ‌ها
        </h2>
        <ul className="space-y-2.5">
          {attempt.questionIds.map((questionId, index) => (
            <ReviewRow
              key={questionId}
              question={questions.find((item) => item.id === questionId)}
              index={index}
              answer={attempt.answers?.[questionId]}
              expanded={expandedId === questionId}
              onToggle={() => setExpandedId((prev) => (prev === questionId ? null : questionId))}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
