/*
 * ExamsDrilldown — تحلیل آزمون‌ها: فهرست sortable → صفحهٔ اختصاصی آزمون
 * (Score Overview + توزیع پاسخ‌ها + دشواری + تحلیل سؤال‌به‌سؤال).
 */
import { useMemo, useState } from 'react';
import {
  Card,
  EmptyState,
  Icon,
  RingScore,
  DonutChart,
  ColumnChart,
  DifficultyBadge,
  FilterChip,
  formatPercent,
  formatSeconds,
  formatShortDate,
  formatFullDate,
  faNum,
  toFa,
  errorTypeLabel,
} from './analyticsShared';

const SORT_OPTIONS = [
  { key: 'newest', label: 'جدیدترین' },
  { key: 'best', label: 'بهترین عملکرد' },
  { key: 'worst', label: 'ضعیف‌ترین عملکرد' },
  { key: 'hardest', label: 'سخت‌ترین آزمون' },
  { key: 'mostQuestions', label: 'بیشترین سؤال' },
];

export function ExamListView({ exams, onOpenExam, onBack }) {
  const [sort, setSort] = useState('newest');

  const sorted = useMemo(() => {
    const list = [...exams];
    switch (sort) {
      case 'best':
        return list.sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
      case 'worst':
        return list.sort((a, b) => (a.percentage ?? 0) - (b.percentage ?? 0));
      case 'hardest':
        return list.sort((a, b) => (b.difficulty ?? 0) - (a.difficulty ?? 0));
      case 'mostQuestions':
        return list.sort((a, b) => b.total - a.total);
      default:
        return list.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
    }
  }, [exams, sort]);

  if (exams.length === 0) {
    return <EmptyState icon="bolt" title="هنوز آزمونی تکمیل نکرده‌ای" note="وقتی آزمون‌های هماهنگ یا شخصی بدهی، تحلیل کاملشان اینجا می‌آید." action={onBack && <BackButton onClick={onBack} label="بازگشت به تحلیل" />} />;
  }

  return (
    <div className="space-y-5">
      <Card title="تحلیل آزمون‌ها" icon="bolt" hint="هر آزمون با کارنامهٔ کامل و تحلیل سؤال‌به‌سؤال" action={onBack && <BackButton onClick={onBack} label="بازگشت به تحلیل" />} className="dashboard-layer-reveal">
        <div className="an-chiprow mb-4" role="group" aria-label="مرتب‌سازی آزمون‌ها">
          {SORT_OPTIONS.map((option) => (
            <FilterChip key={option.key} active={sort === option.key} onClick={() => setSort(option.key)}>
              {option.label}
            </FilterChip>
          ))}
        </div>
        <div className="space-y-3">
          {sorted.map((exam) => (
            <button
              key={exam.examId}
              type="button"
              onClick={() => onOpenExam?.(exam.examId)}
              className="w-full cursor-pointer rounded-2xl border border-white/8 bg-[var(--surface-soft)] p-4 text-right transition-colors hover:border-white/20 focus-visible:outline-2 focus-visible:outline-[var(--green-vivid)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[14px] font-bold">{exam.title}</h3>
                  <p className="mt-0.5 text-[11.5px] text-[var(--faint)]">
                    {formatFullDate(exam.submittedAt)}
                    {exam.durationMinutes ? ` · ${toFa(exam.durationMinutes)} دقیقه` : ''}
                    {` · ${faNum(exam.total)} سؤال`}
                    {exam.negativeMarking ? ' · نمرهٔ منفی' : ''}
                    {exam.timedOut ? ' · پایان زمان' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {exam.percentile !== null && exam.percentile !== undefined && (
                    <div className="text-center">
                      <strong className="block text-[15px] text-[var(--purple-ink)]">{faNum(exam.percentile)}</strong>
                      <span className="text-[10px] text-[var(--faint)]">صدک</span>
                    </div>
                  )}
                  {exam.rank !== null && exam.rank !== undefined && (
                    <div className="text-center">
                      <strong className="block text-[15px] text-[var(--gold-ink)]">{faNum(exam.rank)}</strong>
                      <span className="text-[10px] text-[var(--faint)]">رتبه</span>
                    </div>
                  )}
                  <RingScore score={exam.percentage} size={64} stroke={7} accent={exam.percentage >= 70 ? '#61D192' : exam.percentage >= 50 ? '#e0b45c' : '#e26d6d'} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-[var(--faint)]">
                <span className="text-[var(--green-ink)]">درست {faNum(exam.correct)}</span>
                <span className="text-[var(--red-ink)]">غلط {faNum(exam.wrong)}</span>
                <span className="text-[var(--faint)]">نزده {faNum(exam.unansweredCount)}</span>
                <span>میانگین زمان {formatSeconds(exam.averageTime)}</span>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ─────────────── صفحهٔ اختصاصی آزمون ─────────────── */

const STATUS_FILTERS = [
  { key: 'all', label: 'همه' },
  { key: 'correct', label: 'درست' },
  { key: 'wrong', label: 'غلط' },
  { key: 'unanswered', label: 'نزده' },
];

export function ExamDetailView({ detail, onBack, onOpenQuestion }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const { exam, difficulty, errors, questions } = detail;

  const filteredQuestions = questions.filter((question) => {
    if (statusFilter === 'correct') return question.correctCount > 0 && question.wrongCount === 0;
    if (statusFilter === 'wrong') return question.wrongCount > 0;
    if (statusFilter === 'unanswered') return question.unansweredCount > 0 || question.correctCount === 0;
    return true;
  });

  const difficultyColumns = difficulty.rows
    .filter((row) => row.count > 0)
    .map((row) => ({
      key: row.difficulty,
      label: { easy: 'آسان', medium: 'متوسط', hard: 'سخت', very_hard: 'بسیار سخت' }[row.difficulty],
      value: row.accuracy,
      display: formatPercent(row.accuracy),
      accent: { easy: '#77b787', medium: '#e0b45c', hard: '#ef9196', very_hard: '#e26d6d' }[row.difficulty],
    }));

  return (
    <div className="space-y-5">
      {/* سربرگ آزمون */}
      <Card className="dashboard-layer-reveal" ariaLabel={`خلاصهٔ آزمون ${exam.title}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold [font-family:'Doran','Vazir',Tahoma,sans-serif]">{exam.title}</h2>
            <p className="mt-1 text-[12px] text-[var(--faint)]">
              {formatFullDate(exam.submittedAt)}
              {exam.durationMinutes ? ` · ${toFa(exam.durationMinutes)} دقیقه` : ''}
              {` · ${faNum(exam.total)} سؤال`}
              {exam.subtitle ? ` — ${exam.subtitle}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11.5px]">
              {exam.rank !== null && exam.rank !== undefined && <span className="an-status" style={{ background: 'rgba(224,180,92,0.12)', color: 'var(--gold-ink)' }}>رتبه {faNum(exam.rank)}</span>}
              {exam.percentile !== null && exam.percentile !== undefined && <span className="an-status" style={{ background: 'rgba(147,127,205,0.12)', color: 'var(--purple-ink)' }}>صدک {faNum(exam.percentile)}</span>}
              {exam.timedOut && <span className="an-status" style={{ background: 'rgba(226,109,109,0.12)', color: 'var(--red-ink)' }}>پایان زمان</span>}
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-center">
              <strong className="block text-2xl font-extrabold [font-family:'Doran','Vazir',Tahoma,sans-serif]" style={{ color: exam.percentage >= 70 ? '#61D192' : exam.percentage >= 50 ? '#e0b45c' : '#e26d6d' }}>
                {formatPercent(exam.percentage)}
              </strong>
              <span className="text-[10.5px] text-[var(--faint)]">درصد نهایی</span>
            </div>
            <BackButton onClick={onBack} label="بازگشت به آزمون‌ها" />
          </div>
        </div>
      </Card>

      {/* Score Overview + توزیع */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="توزیع پاسخ‌ها" icon="chart" className="dashboard-layer-reveal">
          <div className="flex items-center gap-6">
            <DonutChart
              segments={[
                { key: 'correct', value: exam.correct, accent: '#61D192' },
                { key: 'wrong', value: exam.wrong, accent: '#e26d6d' },
                { key: 'unanswered', value: exam.unansweredCount, accent: '#6b6b6b' },
              ]}
              centerLabel={formatPercent(exam.accuracy)}
              centerSub="دقت"
              ariaLabel={`توزیع پاسخ‌های آزمون: ${faNum(exam.correct)} درست، ${faNum(exam.wrong)} غلط، ${faNum(exam.unansweredCount)} بی‌پاسخ`}
              size={140}
              stroke={17}
            />
            <div className="space-y-2 text-[12.5px]">
              <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[var(--green-vivid)]" />درست: <strong>{faNum(exam.correct)}</strong></p>
              <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[var(--red)]" />غلط: <strong>{faNum(exam.wrong)}</strong></p>
              <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[var(--light-fill)]" />بی‌پاسخ: <strong>{faNum(exam.unansweredCount)}</strong></p>
              <p className="pt-1 text-[11.5px] text-[var(--faint)]">میانگین زمان هر سؤال: {formatSeconds(exam.averageTime)}</p>
            </div>
          </div>
        </Card>

        {difficultyColumns.length > 0 && (
          <Card title="عملکرد بر اساس سختی سؤال‌ها" icon="target" hint="فقط درصد کلی کافی نیست — ببین در کدام سطح افت کردی" className="dashboard-layer-reveal">
            <ColumnChart columns={difficultyColumns} ariaLabel="دقت بر اساس سختی در این آزمون" />
          </Card>
        )}
      </div>

      {/* نکتهٔ تحلیلی آزمون */}
      {errors.totalWrong > 0 && errors.distribution.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] px-4 py-3 text-[12.5px] leading-6 text-[var(--muted)] dashboard-layer-reveal">
          <Icon name="spark" className="ml-1.5 inline h-4 w-4 -translate-y-0.5 text-[var(--green-ink)]" />
          بیشترین غلط‌های این آزمون از نوع <strong className="text-[var(--gold-ink)]">{errorTypeLabel(errors.distribution[0].type)}</strong> بوده‌اند ({faNum(errors.distribution[0].count)} مورد از {faNum(errors.totalWrong)} غلط).
          {exam.unansweredCount > 0 && exam.unansweredCount >= 3 && ' همچنین تعداد بی‌پاسخ‌ها نشان می‌دهد مدیریت زمان در انتهای آزمون فشار داشته.'}
        </div>
      )}

      {/* تحلیل سؤال‌به‌سؤال */}
      <Card
        title="تحلیل سؤال‌به‌سؤال"
        icon="card"
        action={
          <div className="an-chiprow" role="group" aria-label="فیلتر وضعیت">
            {STATUS_FILTERS.map((option) => (
              <FilterChip key={option.key} active={statusFilter === option.key} onClick={() => setStatusFilter(option.key)}>
                {option.label}
              </FilterChip>
            ))}
          </div>
        }
        className="dashboard-layer-reveal"
      >
        <div className="overflow-x-auto">
          <table className="an-qtable min-w-[700px]">
            <thead>
              <tr>
                <th>#</th>
                <th>موضوع</th>
                <th>پاسخ تو</th>
                <th>وضعیت</th>
                <th>زمان</th>
                <th>اطمینان</th>
                <th>سختی</th>
                <th>نوع خطا</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.map((question) => {
                const lastAttempt = question.timeline[question.timeline.length - 1];
                const order = exam.items.findIndex((item) => item.questionId === question.questionId) + 1;
                return (
                  <tr key={question.questionId} tabIndex={0} onClick={() => onOpenQuestion?.(question)} onKeyDown={(event) => event.key === 'Enter' && onOpenQuestion?.(question)}>
                    <td data-label="شماره">{toFa(order)}</td>
                    <td data-label="موضوع"><span className="max-w-[220px] truncate">{question.topicPath.join(' › ')}</span></td>
                    <td data-label="پاسخ تو">{lastAttempt && lastAttempt.selected !== null ? toFa(['A', 'B', 'C', 'D'][lastAttempt.selected] ?? lastAttempt.selected + 1) : '—'}</td>
                    <td data-label="وضعیت">
                      <span className="an-status" style={{ background: lastAttempt.correct ? 'rgba(97,209,146,0.13)' : lastAttempt.correct === false ? 'rgba(226,109,109,0.12)' : 'rgb(var(--wash-rgb) / 0.05)', color: lastAttempt.correct ? '#61D192' : lastAttempt.correct === false ? '#e26d6d' : '#999' }}>
                        {lastAttempt.correct ? 'درست' : lastAttempt.correct === false ? 'غلط' : 'بی‌پاسخ'}
                      </span>
                    </td>
                    <td data-label="زمان">{formatSeconds(lastAttempt.timeSpent)}</td>
                    <td data-label="اطمینان">{lastAttempt.confidence ? { high: 'مطمئن', medium: 'نیمه', low: 'نامطمئن' }[lastAttempt.confidence] : '—'}</td>
                    <td data-label="سختی"><DifficultyBadge difficulty={question.difficulty} compact /></td>
                    <td data-label="نوع خطا">{lastAttempt.correct === false ? errorTypeLabel(lastAttempt.errorType) : '—'}</td>
                    <td data-label=""><Icon name="eye" className="h-4 w-4 text-[var(--faint)]" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredQuestions.length === 0 && <p className="py-6 text-center text-[12px] text-[var(--faint)]">سؤالی با این وضعیت در آزمون نیست.</p>}
        </div>
        <p className="mt-3 text-[11px] text-[var(--faint)]">برای دیدن صورت سؤال و تحلیل کامل، روی هر ردیف بزن.</p>
      </Card>
    </div>
  );
}

function BackButton({ onClick, label = 'بازگشت' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--surface-soft)] px-3.5 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-strong)] hover:text-white focus-visible:outline-2 focus-visible:outline-[var(--green-vivid)]"
    >
      <Icon name="back" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
