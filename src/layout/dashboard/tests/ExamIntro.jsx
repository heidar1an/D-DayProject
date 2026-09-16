/*
 * صفحهٔ اختصاصی هر آزمون بین‌المللی — شناسنامهٔ آزمون + بانک سؤال آن.
 * کاربر از اینجا یا «شروع حل سؤال» می‌زند یا سؤال خاصی را از بانک باز می‌کند.
 * وضعیت هر سؤال (صحیح/غلط/گلچین) از Overview کاربر می‌آید، نه از خود سؤال.
 */
import {
  DifficultyBadge,
  EmptyState,
  ExamGlyph,
  faNum,
  Icon,
  SampleTag,
  Skeleton,
  toFa,
} from './intlShared';

/* ردیف یک سؤال در بانک سؤال */
function QuestionRow({ question, index, state, onPractice }) {
  const statusChip = state?.lastResult === 'correct'
    ? { label: 'صحیح', cls: 'bg-[#77b787]/12 text-[var(--green-soft-ink)]' }
    : state?.lastResult === 'incorrect'
      ? { label: state.attempts > 1 ? 'غلط تکراری' : 'غلط', cls: 'bg-[#e26d6d]/12 text-[var(--red-ink)]' }
      : { label: 'جدید', cls: 'bg-white/6 text-[var(--faint)]' };

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-sm text-[var(--muted)] [font-family:'Doran','Vazir',Tahoma,sans-serif]">
        {toFa(index + 1)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] leading-6 text-[var(--white)]" dir="ltr">
          {question.stem}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <DifficultyBadge difficulty={question.difficulty} />
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[var(--faint)]">{question.topic.fa}</span>
          {state?.bookmarked && (
            <span className="flex items-center gap-1 rounded-full bg-[#e26d6d]/12 px-2 py-0.5 text-[10px] text-[var(--red-ink)]">
              <Icon name="heart" className="h-2.5 w-2.5" /> گلچین
            </span>
          )}
        </div>
      </div>
      <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[10px] sm:inline ${statusChip.cls}`}>{statusChip.label}</span>
      <button
        type="button"
        onClick={() => onPractice(question.id)}
        className="shrink-0 cursor-pointer rounded-xl bg-[#937fcd]/15 px-3.5 py-2 text-xs text-[var(--purple-soft-ink)] transition-colors hover:bg-[#937fcd]/25"
      >
        حل سؤال
      </button>
    </li>
  );
}

export default function ExamIntro({ exam, questions, states, loading, onStartAll, onStartSection, onPracticeQuestion }) {
  if (loading) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-56 rounded-[2.5rem]" />
        <Skeleton className="h-24 rounded-[2rem]" />
        <Skeleton className="h-64 rounded-[2rem]" />
      </div>
    );
  }

  if (!exam) {
    return <EmptyState icon="alert" title="آزمون پیدا نشد" note="ممکن است این آزمون حذف یا تغییر نام داده باشد." />;
  }

  const difficultyBreakdown = ['easy', 'medium', 'hard', 'very_hard']
    .map((level) => ({ level, count: questions.filter((question) => question.difficulty === level).length }))
    .filter((entry) => entry.count > 0);

  return (
    <div className="dash-stagger space-y-5">
      {/* سربرگ شناسنامهٔ آزمون */}
      <section className="rounded-[2.5rem] border border-white/8 bg-[var(--surface-soft)] p-6 md:p-8" aria-label={`شناسنامهٔ آزمون ${exam.shortName}`}>
        <div className="flex flex-wrap items-start gap-5">
          <span
            className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl"
            style={{ background: `${exam.accent}14`, boxShadow: `inset 0 0 0 1px ${exam.accent}44` }}
          >
            <ExamGlyph glyph={exam.glyph} accent={exam.accent} className="h-8 w-8" />
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl [font-family:'Doran','Vazir',Tahoma,sans-serif]" style={{ color: exam.accent }}>
              {exam.shortName}
            </h1>
            <p className="mt-0.5 text-xs text-[var(--faint)]" dir="ltr">
              {exam.name}
            </p>
            <p className="mt-1.5 text-sm text-[var(--muted)]">{exam.nameFa}</p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-[var(--muted)]">
                <Icon name="globe" className="me-1 inline h-3 w-3" />
                {exam.country}
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-[var(--muted)]">{exam.organization}</span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-[var(--muted)]">سطح: {exam.level}</span>
              <SampleTag className="ms-auto" />
            </div>
          </div>
        </div>

        <p className="mt-5 max-w-2xl text-[13.5px] leading-7 text-[var(--muted)]">{exam.descriptionFa}</p>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/6 pt-4 text-xs text-[var(--faint)]">
          <span className="flex items-center gap-1.5">
            <Icon name="book" className="h-3.5 w-3.5" />
            {faNum(exam.questionCount)} سؤال در تپش
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="layers" className="h-3.5 w-3.5" />
            موضوعات: {exam.topics?.join('، ')}
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="calendar" className="h-3.5 w-3.5" />
            آخرین به‌روزرسانی: {exam.updatedAtFa}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onStartAll}
            className="cursor-pointer rounded-2xl bg-[var(--purple-bright)] px-6 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
          >
            شروع حل سؤال
          </button>
          {difficultyBreakdown.map((entry) => (
            <span key={entry.level} className="rounded-full bg-white/5 px-3 py-2 text-[11px] text-[var(--faint)]">
              <DifficultyBadge difficulty={entry.level} className="!bg-transparent !px-0" />
              <span className="ms-1">× {toFa(entry.count)}</span>
            </span>
          ))}
        </div>
      </section>

      {/* بخش‌های آزمون (Step / Part) */}
      <section aria-label="بخش‌های آزمون">
        <h2 className="mb-3 text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]">بخش‌های آزمون</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {exam.sectionCounts.map((section) => (
            <div key={section.id} className="flex items-center justify-between gap-3 rounded-[1.75rem] border border-white/6 bg-[var(--surface-soft)] p-4 md:p-5">
              <div className="min-w-0">
                <strong className="block text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">
                  {section.name} <span className="text-[var(--faint)]">· {section.nameFa}</span>
                </strong>
                <p className="mt-1 truncate text-[11px] text-[var(--faint)]">
                  {section.focus} · {faNum(section.questionCount)} سؤال
                </p>
              </div>
              <button
                type="button"
                onClick={() => onStartSection(section.id)}
                disabled={section.questionCount === 0}
                className="shrink-0 cursor-pointer rounded-xl bg-[#937fcd]/15 px-3.5 py-2 text-xs text-[var(--purple-soft-ink)] transition-colors hover:bg-[#937fcd]/25 disabled:cursor-default disabled:opacity-40"
              >
                حل این بخش
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* بانک سؤال */}
      <section aria-labelledby="exam-bank-title">
        <header className="mb-3 flex items-center justify-between">
          <h2 id="exam-bank-title" className="text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            بانک سؤال
          </h2>
          <span className="text-[11px] text-[var(--faint)]">وضعیت هر سؤال برای خودت ثبت می‌شود</span>
        </header>

        {questions.length === 0 ? (
          <EmptyState icon="book" title="این بخش هنوز سؤالی ندارد" note="به‌زودی سؤال‌های تازه اضافه می‌شوند." />
        ) : (
          <ul className="space-y-2.5">
            {questions.map((question, index) => (
              <QuestionRow key={question.id} question={question} index={index} state={states?.[question.id]} onPractice={onPracticeQuestion} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
