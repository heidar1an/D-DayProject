/*
 * صفحهٔ اصلی «آزمون‌های بین‌الملل».
 * ترتیب روایت: کارت‌های اقدام (ادامهٔ مطالعه / مرور فاصله‌دار / اشتباهات من) ←
 * مرورگر آزمون‌ها. سرتیتر و ناوبری در سطح لایه (InternationalExamsLayer) است.
 * همهٔ داده‌ها از internationalService می‌آید؛ این کامپوننت فقط نمایش است.
 */
import { ProgressBar } from '../league/leagueShared';
import {
  EmptyState,
  ExamGlyph,
  faNum,
  Icon,
  Skeleton,
  toFa,
} from './intlShared';

/* ── ادامهٔ مطالعه + وقت مرور + اشتباهات من: کارت‌های اقدام ── */
function ActionCards({ overview, onResume, onStartReview, onOpenMistakes }) {
  const { inProgress, stats } = overview;
  const hasActions = inProgress || stats.dueReview > 0 || stats.mistakesCount > 0;
  if (!hasActions) return null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* ادامهٔ مطالعه */}
      {inProgress && (
        <section className="rounded-[2rem] border border-[#937fcd]/30 bg-gradient-to-l from-[#937fcd]/10 to-transparent p-5" aria-label="ادامه مطالعه">
          <h3 className="flex items-center gap-2 text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            <Icon name="play" className="h-4 w-4 text-[var(--purple-soft-ink)]" />
            ادامهٔ مطالعه
          </h3>
          <strong className="mt-3 block text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]">{inProgress.title}</strong>
          <p className="mt-1 text-xs text-[var(--faint)]">
            سؤال {toFa(inProgress.answeredCount + 1)} از {toFa(inProgress.totalQuestions)} · {toFa(inProgress.percent)}٪ کامل شده
          </p>
          <ProgressBar value={inProgress.percent} max={100} height={5} className="mt-3" />
          <button
            type="button"
            onClick={() => onResume(inProgress.id)}
            className="mt-4 cursor-pointer rounded-xl bg-[var(--purple-bright)] px-4 py-2.5 text-xs font-bold transition-transform hover:-translate-y-0.5"
          >
            ادامه آزمون
          </button>
        </section>
      )}

      {/* مرور فاصله‌دار */}
      {stats.dueReview > 0 && (
        <section className="rounded-[2rem] border border-[#e0b45c]/30 bg-gradient-to-l from-[#e0b45c]/[0.08] to-transparent p-5" aria-label="مرور فاصله‌دار">
          <h3 className="flex items-center gap-2 text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            <Icon name="clock" className="h-4 w-4 text-[var(--gold-ink)]" />
            وقت مرور این سؤالات رسیده
          </h3>
          <strong className="mt-3 block text-2xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            {faNum(stats.dueReview)} <span className="text-sm font-normal text-[var(--faint)]">سؤال</span>
          </strong>
          <p className="mt-1 text-xs leading-5 text-[var(--faint)]">سؤال‌هایی که زمان دوباره دیدنشون شده؛ مرور به‌موقع یعنی ماندگاری بیشتر.</p>
          <button
            type="button"
            onClick={() => onStartReview(stats.dueQuestionIds)}
            className="mt-4 cursor-pointer rounded-xl bg-[#e0b45c]/15 px-4 py-2.5 text-xs font-bold text-[var(--gold-ink)] transition-transform hover:-translate-y-0.5"
          >
            شروع مرور
          </button>
        </section>
      )}

      {/* اشتباهات من */}
      {stats.mistakesCount > 0 && (
        <section className="rounded-[2rem] border border-[#e26d6d]/30 bg-gradient-to-l from-[#e26d6d]/[0.08] to-transparent p-5" aria-label="اشتباهات من">
          <h3 className="flex items-center gap-2 text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            <Icon name="flame" className="h-4 w-4 text-[var(--red-ink)]" />
            اشتباهات من
          </h3>
          <strong className="mt-3 block text-2xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            {faNum(stats.mistakesCount)} <span className="text-sm font-normal text-[var(--faint)]">سؤال غلط</span>
          </strong>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stats.weakTopics.slice(0, 3).map((topic) => (
              <span key={topic.subjectId} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-[var(--muted)]">
                {topic.subject?.nameFa} · {toFa(topic.count)} اشتباه
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onOpenMistakes}
            className="mt-4 cursor-pointer rounded-xl bg-[#e26d6d]/15 px-4 py-2.5 text-xs font-bold text-[var(--red-ink)] transition-transform hover:-translate-y-0.5"
          >
            مرور اشتباهات
          </button>
        </section>
      )}
    </div>
  );
}

/* ── مرورگر آزمون‌ها ── */
function ExamExplorer({ exams, onOpenExam }) {
  return (
    <section aria-labelledby="intl-explorer-title">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h2 id="intl-explorer-title" className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            آزمون‌ها را بشناس و انتخاب کن
          </h2>
          <p className="mt-1 text-xs text-[var(--faint)]">هر آزمون محیط حل، تحلیل و بانک سؤال خودش را دارد.</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {exams.map((exam) => (
          <button
            key={exam.id}
            type="button"
            onClick={() => onOpenExam(exam.id)}
            className="group flex cursor-pointer flex-col rounded-[2rem] border border-white/8 bg-[var(--surface-soft)] p-5 text-right transition-all duration-300 hover:-translate-y-1.5 hover:border-white/20 hover:bg-[var(--surface-soft)]"
            aria-label={`مشاهدهٔ آزمون ${exam.shortName} — ${exam.nameFa}`}
          >
            <div className="flex items-start justify-between">
              <span
                className="grid h-12 w-12 place-items-center rounded-2xl"
                style={{ background: `${exam.accent}14`, boxShadow: `inset 0 0 0 1px ${exam.accent}33` }}
              >
                <ExamGlyph glyph={exam.glyph} accent={exam.accent} className="h-6 w-6" />
              </span>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-[var(--faint)]">{exam.level}</span>
            </div>

            <strong className="mt-4 block text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]" style={{ color: exam.accent }}>
              {exam.shortName}
            </strong>
            <span className="mt-0.5 block text-[11px] leading-5 text-[var(--faint)]" dir="ltr">
              {exam.name}
            </span>
            <span className="mt-1.5 block text-[13px] text-[var(--muted)]">{exam.nameFa}</span>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {exam.topics?.slice(0, 3).map((topic) => (
                <span key={topic} className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-[var(--faint)]">
                  {topic}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3.5">
              <span className="flex items-center gap-1.5 text-xs text-[var(--faint)]">
                <Icon name="book" className="h-3.5 w-3.5" />
                {faNum(exam.questionCount)} سؤال موجود
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[var(--purple-soft-ink)] transition-transform duration-300 group-hover:-translate-x-1">
                مشاهده آزمون
                <Icon name="back" className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════ Home ══════════════════════════ */
export default function InternationalHome({ overview, exams, loading, onOpenExam, onResume, onStartReview, onOpenMistakes }) {
  if (loading) {
    return (
      <div className="space-y-5" aria-hidden="true">
        <Skeleton className="h-40 rounded-[2.5rem]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-60 rounded-[2rem]" />
          <Skeleton className="h-60 rounded-[2rem]" />
          <Skeleton className="h-60 rounded-[2rem]" />
        </div>
      </div>
    );
  }

  if (!exams?.length) {
    return (
      <EmptyState
        icon="globe"
        title="هنوز آزمونی منتشر نشده"
        note="بانک آزمون‌های بین‌المللی در حال آماده‌سازی است؛ کمی صبر کن."
      />
    );
  }

  return (
    <div className="dash-stagger space-y-5">
      {overview && <ActionCards overview={overview} onResume={onResume} onStartReview={onStartReview} onOpenMistakes={onOpenMistakes} />}

      <ExamExplorer exams={exams} onOpenExam={onOpenExam} />
    </div>
  );
}
