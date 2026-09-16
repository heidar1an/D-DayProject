/*
 * AnalyticsHome — صفحهٔ اصلی «تحلیل عملکرد».
 * سلسله‌مراتب دوسطحی تجربه:
 *   LEVEL 1 (سریع): KPIها + امتیاز عملکرد + مقایسهٔ تمرین/آزمون
 *   LEVEL 2 (تحلیلی): روند عملکرد، نقشهٔ ضعف، عملکرد درس‌ها، آزمون‌های اخیر
 * همهٔ اعداد از سرویس می‌آید؛ هیچ عددی تزئینی نیست.
 */
import { useState } from 'react';
import {
  Card,
  EmptyState,
  Icon,
  RingScore,
  TrendChart,
  DonutChart,
  BarRow,
  formatPercent,
  formatSeconds,
  formatShortDate,
  faNum,
  toFa,
} from './analyticsShared';

/*
 * سنجه‌های نمودار روند — همه از دادهٔ همین لایه ساخته می‌شوند (سری روزانهٔ سرویس).
 * fixedMax برای سنجه‌های درصدی است؛ بقیه با دادهٔ واقعی بازه مقیاس می‌شوند.
 */
const TREND_METRICS = [
  { key: 'accuracy', label: 'دقت', accent: '#61D192', suffix: '٪', fixedMax: 100, avgLabel: 'میانگین دقت', bestLabel: 'بالاترین روز', worstLabel: 'ضعیف‌ترین روز', betterIsHigher: true },
  { key: 'performanceScore', label: 'امتیاز عملکرد', accent: '#937fcd', suffix: '', fixedMax: 100, avgLabel: 'میانگین امتیاز', bestLabel: 'بالاترین روز', worstLabel: 'پایین‌ترین روز', betterIsHigher: true },
  { key: 'count', label: 'حجم روزانه', accent: '#5b8cc7', suffix: ' تست', avgLabel: 'میانگین روزانه', bestLabel: 'پرکارترین روز', worstLabel: 'کم‌کارترین روز', betterIsHigher: true },
  { key: 'correct', label: 'پاسخ درست', accent: '#4fb783', suffix: ' تست', avgLabel: 'میانگین درست', bestLabel: 'بهترین روز', worstLabel: 'ضعیف‌ترین روز', betterIsHigher: true },
  { key: 'wrong', label: 'پاسخ غلط', accent: '#e26d6d', suffix: ' تست', avgLabel: 'میانگین غلط', bestLabel: 'بیشترین غلط', worstLabel: 'کم‌ترین غلط', betterIsHigher: false },
  { key: 'averageTime', label: 'زمان پاسخ', accent: '#e0b45c', suffix: ' ثانیه', avgLabel: 'میانگین زمان', bestLabel: 'سریع‌ترین روز', worstLabel: 'کندترین روز', betterIsHigher: false },
];

/* سقف محور عمودی با عدد «گرد» و کمی فضای بالای بیشترین مقدار — مقیاس نمودار خوانا می‌ماند */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
function niceCeil(value) {
  if (!value || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = NICE_STEPS.find((candidate) => normalized <= candidate) ?? 10;
  return step * magnitude;
}

const WEAKNESS_BUCKETS = [
  { key: 'critical', title: 'نیازمند توجه فوری', accent: '#e26d6d', icon: 'alert' },
  { key: 'review', title: 'نیازمند مرور', accent: '#e0b45c', icon: 'refresh' },
  { key: 'ok', title: 'وضعیت مناسب', accent: '#61D192', icon: 'check' },
];

export default function AnalyticsHome({ data, onNavigate, onOpenExam }) {
  const [trendMetric, setTrendMetric] = useState('accuracy');
  if (!data) return null;

  const { kpis, performance, consistency, practiceVsExam, trend, subjects, weakness, dataStatus, exams } = data;
  const metricMeta = TREND_METRICS.find((metric) => metric.key === trendMetric) ?? TREND_METRICS[0];

  /* نقاط نمودار = کل سری روزانهٔ سرویس؛ همهٔ فیلدهای روز حفظ می‌شوند تا تولتیپ کامل باشد */
  const labeledPoints = trend.series.map((point, index) => ({ ...point, value: point[trendMetric], index }));
  const examMarkers = trend.examEvents
    .map((event) => {
      const dayIndex = trend.series.findIndex((point) => point.key === event.dayKey);
      return dayIndex >= 0 ? { id: event.id, dayIndex, title: event.title } : null;
    })
    .filter(Boolean);

  /* خلاصهٔ آماری همان سنجه — روی کل روزهای دارای دادهٔ بازه، نه فقط نقاط نمایش‌داده‌شده */
  const trendValues = labeledPoints.map((point) => point.value).filter((value) => value !== null && value !== undefined);
  const trendStats = {
    activeDays: trendValues.length,
    days: labeledPoints.length,
    average: trendValues.length ? trendValues.reduce((total, value) => total + value, 0) / trendValues.length : null,
    best: trendValues.length ? (metricMeta.betterIsHigher ? Math.max(...trendValues) : Math.min(...trendValues)) : null,
    worst: trendValues.length ? (metricMeta.betterIsHigher ? Math.min(...trendValues) : Math.max(...trendValues)) : null,
    first: trendValues.length ? trendValues[0] : null,
    last: trendValues.length ? trendValues[trendValues.length - 1] : null,
    yMax: metricMeta.fixedMax ?? niceCeil(Math.max(...trendValues, 0) * 1.08),
  };
  trendStats.delta = trendStats.first !== null && trendStats.last !== null ? trendStats.last - trendStats.first : null;
  trendStats.deltaGood = trendStats.delta === null || trendStats.delta === 0 ? null : metricMeta.betterIsHigher ? trendStats.delta > 0 : trendStats.delta < 0;

  const answerSegments = [
    { key: 'correct', value: kpis.correct, accent: '#61D192' },
    { key: 'wrong', value: kpis.wrong, accent: '#e26d6d' },
    { key: 'unanswered', value: kpis.unanswered, accent: '#6b6b6b' },
  ];

  const emptyTrendNote = 'در این بازه دادهٔ روزانه‌ای برای رسم روند نیست';

  return (
    <div className="space-y-4">
      {/* ── هشدار حجم داده (Empty State هوشمند) ── */}
      {dataStatus.level !== 'ok' && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-[#e0b45c]/10 px-4 py-2.5 text-[12px] text-[var(--gold-ink)]" role="status">
          <Icon name="info" className="h-4 w-4 shrink-0" />
          {dataStatus.hint}
        </div>
      )}

      {/* امتیاز عملکرد + تمرین در برابر آزمون — یک ردیف */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card title="امتیاز عملکرد" icon="target" hint={performance.note} className="dashboard-layer-reveal">
          <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <div className="flex items-center justify-center gap-4">
              <RingScore
                score={performance.score}
                label="از ۱۰۰"
                size={104}
                stroke={9}
                accent={performance.score >= 70 ? '#61D192' : performance.score >= 55 ? '#e0b45c' : '#e26d6d'}
              />
              <DonutChart
                segments={answerSegments}
                centerLabel={formatPercent(kpis.accuracy)}
                centerSub="پاسخ‌ها"
                ariaLabel={`توزیع پاسخ‌ها: ${faNum(kpis.correct)} درست، ${faNum(kpis.wrong)} غلط، ${faNum(kpis.unanswered)} بی‌پاسخ`}
                size={104}
                stroke={13}
                compact
              />
            </div>
            <div className="space-y-1.5">
              {Object.entries(performance.parts)
                .filter(([, part]) => part.weight > 0)
                .map(([key, part]) => (
                  <div key={key} className="flex items-center gap-2.5">
                    <span className="w-16 shrink-0 text-[11px] text-[var(--faint)]">
                      {{ accuracy: 'دقت', consistency: 'ثبات', speed: 'سرعت', difficulty: 'دشواری', recency: 'روند' }[key] ?? key}
                    </span>
                    <div className="an-bar flex-1">
                      <span className="an-bar__fill" style={{ width: `${Math.min(100, part.score)}%`, background: 'var(--purple-bright)' }} />
                    </div>
                    <span className="w-[74px] shrink-0 text-left text-[10.5px] text-[var(--faint)]">
                      {faNum(Math.round(part.score))} <span className="text-[10px]">· وزن {toFa(Math.round(part.weight * 100))}٪</span>
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/6 pt-2.5 text-[11px]">
            <span className="flex items-center gap-1 text-[var(--green-ink)]"><span className="h-2 w-2 rounded-full bg-[var(--green-vivid)]" />درست {faNum(kpis.correct)}</span>
            <span className="flex items-center gap-1 text-[var(--red-ink)]"><span className="h-2 w-2 rounded-full bg-[var(--red)]" />غلط {faNum(kpis.wrong)}</span>
            <span className="flex items-center gap-1 text-[var(--faint)]"><span className="h-2 w-2 rounded-full bg-[var(--light-fill)]" />نزده {faNum(kpis.unanswered)}</span>
            {consistency.score !== null && (
              <span className="mr-auto text-[var(--faint)]">
                ثبات بین {faNum(consistency.sessions)} سشن:{' '}
                <strong style={{ color: consistency.cv < 0.22 ? '#61D192' : '#e0b45c' }}>{consistency.label}</strong>
              </span>
            )}
          </div>
        </Card>

        {/* تمرین در برابر آزمون */}
        <Card
          title="تمرین در برابر آزمون"
          icon="layers"
          hint="آیا عملکردت در شرایط واقعی آزمون هم حفظ می‌شود؟"
          className="dashboard-layer-reveal"
        >
          {practiceVsExam.sufficient ? (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    { key: 'practice', title: 'تمرینی', accent: '#61D192', icon: 'book' },
                    { key: 'exam', title: 'آزمونی', accent: '#937fcd', icon: 'bolt' },
                  ]
                ).map((side) => {
                  const stats = practiceVsExam[side.key];
                  return (
                    <div key={side.key} className="rounded-2xl border border-white/8 bg-[var(--surface-soft)] p-3.5">
                      <h3 className="mb-2.5 flex items-center gap-2 text-[12.5px] font-bold" style={{ color: side.accent }}>
                        <Icon name={side.icon} className="h-3.5 w-3.5" />
                        {side.title}
                      </h3>
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11.5px]">
                        <span className="text-[var(--faint)]">دقت</span><strong>{formatPercent(stats.accuracy)}</strong>
                        <span className="text-[var(--faint)]">میانگین زمان</span><strong>{formatSeconds(stats.averageTime)}</strong>
                        <span className="text-[var(--faint)]">تعداد تست</span><strong>{faNum(stats.answered)}</strong>
                        <span className="text-[var(--faint)]">سطح دشواری</span><strong>{stats.difficulty ? toFa(stats.difficulty.toFixed(2)) : '—'}</strong>
                        {side.key === 'exam' ? (
                          <>
                            <span className="text-[var(--faint)]">بی‌پاسخ</span><strong>{faNum(stats.unanswered)} سؤال</strong>
                          </>
                        ) : (
                          <>
                            <span className="text-[var(--faint)]">پاسخ مطمئن</span><strong>{stats.confidence === null ? '—' : `${faNum(stats.confidence)}٪`}</strong>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                {practiceVsExam.accuracyDrop !== null && Math.abs(practiceVsExam.accuracyDrop) >= 5 ? (
                  <p className="text-[12px] leading-6 text-[var(--muted)]">
                    {practiceVsExam.accuracyDrop > 0 ? (
                      <>
                        دقت تو در تمرین‌ها <strong className="text-[var(--green-ink)]">{faNum(Math.round(practiceVsExam.practice.accuracy))}٪</strong> است اما در آزمون‌ها به{' '}
                        <strong className="text-[var(--red-ink)]">{faNum(Math.round(practiceVsExam.exam.accuracy))}٪</strong> کاهش پیدا می‌کند؛ تمرین در شرایط شبیه‌سازی‌شدهٔ آزمون (تایمر و بدون وقفه) این فاصله را می‌بندد.
                      </>
                    ) : (
                      <>
                        دقت آزمونی تو ({faNum(Math.round(practiceVsExam.exam.accuracy))}٪) حتی از تمرینی‌ات ({faNum(Math.round(practiceVsExam.practice.accuracy))}٪) بالاتر است؛ نشانهٔ آمادگی آزمونی خوب.
                      </>
                    )}
                  </p>
                ) : (
                  <p className="text-[12px] leading-6 text-[var(--faint)]">دقت تو در تمرین و آزمون تقریباً یکسان است — عملکردت در شرایط فشار حفظ می‌شود.</p>
                )}
              </div>
            </div>
          ) : (
            <EmptyState icon="layers" title="دادهٔ کافی برای مقایسه نیست" note="برای مقایسهٔ معنادار، هم تمرین کافی و هم حداقل یک آزمون کامل لازم است." />
          )}
        </Card>
      </div>

      {/* ══════════ LEVEL 2 — مشکل کجاست؟ ══════════ */}

      {/* روند عملکرد */}
      <Card
        title="روند عملکرد در طول زمان"
        icon="chart"
        hint="یک نقطه برای هر روزِ بازه؛ روزهای بی‌فعالیت خالی می‌مانند، خط‌چین روشن میانگین کل بازه و نقاط زرد روزهای آزمون‌اند. برای دیدن مقدار هر روز، روی نمودار برو."
        action={
          <div className="an-chiprow" role="tablist" aria-label="انتخاب سنجهٔ نمودار">
            {TREND_METRICS.map((metric) => (
              <button
                key={metric.key}
                type="button"
                role="tab"
                aria-selected={trendMetric === metric.key}
                onClick={() => setTrendMetric(metric.key)}
                className={`an-chip ${trendMetric === metric.key ? 'an-chip--on' : ''}`}
                style={trendMetric === metric.key ? { borderColor: `${metric.accent}80`, color: metric.accent, background: `${metric.accent}14` } : undefined}
              >
                {metric.label}
              </button>
            ))}
          </div>
        }
        className="dashboard-layer-reveal"
      >
        <TrendChart
          points={labeledPoints}
          accent={metricMeta.accent}
          ariaLabel={`نمودار ${metricMeta.label} در ${toFa(trendStats.days)} روز؛ ${toFa(trendStats.activeDays)} روز دارای داده`}
          yMax={trendStats.yMax}
          valueFormat={(value) => `${faNum(Math.round(value))}${metricMeta.suffix}`}
          markerEvents={examMarkers}
          emptyNote={emptyTrendNote}
        />

        {/* خلاصهٔ آماری همین سنجه روی کل دادهٔ بازه */}
        <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-white/6 pt-3 sm:grid-cols-4">
          <TrendStat label={metricMeta.avgLabel} value={trendStats.average} suffix={metricMeta.suffix} />
          <TrendStat label={metricMeta.bestLabel} value={trendStats.best} suffix={metricMeta.suffix} accent={metricMeta.accent} />
          <TrendStat label={metricMeta.worstLabel} value={trendStats.worst} suffix={metricMeta.suffix} accent="#9a9a9a" />
          <TrendStat
            label="آخرین مقدار"
            value={trendStats.last}
            suffix={metricMeta.suffix}
            note={
              trendStats.delta === null || trendStats.delta === 0
                ? 'بدون تغییر نسبت به ابتدای بازه'
                : `${trendStats.delta > 0 ? '+' : '−'}${faNum(Math.abs(Math.round(trendStats.delta * 10) / 10))}${metricMeta.suffix} نسبت به ابتدای بازه`
            }
            noteTone={trendStats.deltaGood === null ? '#8a8a8a' : trendStats.deltaGood ? '#61D192' : '#e26d6d'}
          />
        </div>

        <p className="mt-3 text-[11px] leading-5 text-[var(--faint)]">
          {faNum(trendStats.activeDays)} روز دارای فعالیت از {toFa(trendStats.days)} روز این بازه
          {examMarkers.length > 0 ? ` · آزمون‌های این بازه: ${trend.examEvents.map((event) => event.title).join(' · ')}` : ''}
        </p>
      </Card>

      {/* نقشهٔ نقاط ضعف */}
      <Card
        title="نقشهٔ نقاط ضعف"
        icon="puzzle"
        hint="اولویت‌بندی مباحث بر اساس دقت، حجم تست و اهمیت سؤال‌ها"
        className="dashboard-layer-reveal"
      >
        {weakness.all.length === 0 ? (
          <EmptyState icon="puzzle" title="مبحثی برای نمایش نیست" note="با تست زدن بیشتر، نقشهٔ نقاط ضعفت ساخته می‌شود." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {WEAKNESS_BUCKETS.map((bucket) => {
              const items = weakness[bucket.key];
              return (
                <div key={bucket.key} className="rounded-2xl border border-white/6 bg-[var(--surface-soft)] p-3.5">
                  <h3 className="mb-2 flex items-center gap-2 text-[12px] font-bold" style={{ color: bucket.accent }}>
                    <Icon name={bucket.icon} className="h-3.5 w-3.5" />
                    {bucket.title}
                    <span className="mr-auto text-[10.5px] font-normal text-[var(--faint)]">{faNum(items.length)} مبحث</span>
                  </h3>
                  {items.length === 0 ? (
                    <p className="text-[11.5px] text-[var(--faint)]">—</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {items.slice(0, 5).map((topic) => (
                        <li key={topic.key}>
                          <button
                            type="button"
                            onClick={() => onNavigate?.('subject', { subjectId: topic.subjectId })}
                            className="w-full cursor-pointer rounded-xl px-2 py-1 text-right transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[var(--green-vivid)]"
                          >
                            <span className="flex items-baseline justify-between gap-2 text-[12px]">
                              <span className="min-w-0 truncate text-[var(--muted)]">{topic.key}</span>
                              <span className="shrink-0 text-[10.5px] font-semibold" style={{ color: bucket.accent }}>
                                {formatPercent(topic.accuracy)}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-[10px] text-[var(--faint)]">
                              {faNum(topic.attemptCount)} تست · اولویت {faNum(Math.round(topic.priority))}
                            </span>
                          </button>
                        </li>
                      ))}
                      {items.length > 5 && <li className="text-[10.5px] text-[var(--faint)]">و {faNum(items.length - 5)} مبحث دیگر…</li>}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {weakness.biggestDrop && (
          <p className="mt-3 border-t border-white/6 pt-2.5 text-[12px] leading-6 text-[var(--muted)]">
            بیشترین افت عملکرد تو مربوط به مبحث <strong className="text-[var(--gold-ink)]">«{weakness.biggestDrop.key}»</strong> است؛
            دقتش در نیمهٔ اخیر {toFa(Math.abs(weakness.biggestDrop.trend.delta))} واحد {weakness.biggestDrop.trend.delta < 0 ? 'کاهش' : 'تغییر'} کرده است.
          </p>
        )}
      </Card>

      {/* عملکرد درس‌ها + آزمون‌های اخیر — در یک ردیف */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card
          title="عملکرد بر اساس درس"
          icon="grid"
          hint="روی هر درس بزن تا تحلیل مبحث‌به‌مبحثش را ببینی"
          className={`dashboard-layer-reveal ${exams.length > 0 ? '' : 'lg:col-span-2'}`}
        >
          <div className="space-y-3">
            {subjects.map((subject) => (
              <BarRow
                key={subject.subjectId}
                label={subject.name}
                value={subject.accuracy}
                accent={subject.accent}
                right={formatPercent(subject.accuracy)}
                onClick={() => onNavigate?.('subject', { subjectId: subject.subjectId })}
                subLabel={`${faNum(subject.attemptCount)} تست · میانگین زمان ${formatSeconds(subject.averageTime)} · تسلط: ${{ MASTERED: 'تسلط یافته', STRONG: 'قوی', LEARNING: 'در حال یادگیری', WEAK: 'نیازمند تقویت', NEEDS_DATA: 'دادهٔ کافی نیست' }[subject.mastery.status]}`}
              />
            ))}
          </div>
        </Card>

        {exams.length > 0 && (
          <Card
            title="آزمون‌های اخیر"
            icon="bolt"
            hint="کارنامهٔ هر آزمون را در تحلیلش ببین"
            action={
              <button type="button" onClick={() => onNavigate?.('exams')} className="cursor-pointer rounded-xl bg-white/[0.06] px-3 py-1.5 text-[11.5px] text-[var(--muted)] transition-colors hover:bg-white/[0.1]">
                همهٔ آزمون‌ها
              </button>
            }
            className="dashboard-layer-reveal"
          >
            <div className="space-y-2">
              {exams.map((exam) => (
                <button
                  key={exam.examId}
                  type="button"
                  onClick={() => onOpenExam?.(exam.examId)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[var(--surface-soft)] p-3 text-right transition-colors hover:border-white/20 focus-visible:outline-2 focus-visible:outline-[var(--green-vivid)]"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-[12.5px] font-bold">{exam.title}</h3>
                    <p className="mt-0.5 text-[10.5px] text-[var(--faint)]">
                      {formatShortDate(exam.submittedAt)} · {faNum(exam.total)} سؤال
                      {exam.percentile !== null && exam.percentile !== undefined ? ` · صدک ${faNum(exam.percentile)}` : ''}
                    </p>
                  </div>
                  <div className="text-center">
                    <strong className="block text-base font-extrabold" style={{ color: exam.percentage >= 70 ? '#61D192' : exam.percentage >= 50 ? '#e0b45c' : '#e26d6d' }}>
                      {formatPercent(exam.percentage)}
                    </strong>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── یک سنجهٔ خلاصهٔ نمودار روند ── */
function TrendStat({ label, value, suffix = '', accent = '#eaf6ef', note, noteTone }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[var(--surface-soft)] px-3 py-2">
      <span className="text-[10.5px] text-[var(--faint)]">{label}</span>
      <strong className="mt-0.5 block text-[15px] font-extrabold [font-family:'Doran','Vazir',Tahoma,sans-serif]" style={{ color: accent }}>
        {value === null || value === undefined ? '—' : `${faNum(Math.round(value))}${suffix}`}
      </strong>
      {note && (
        <span className="mt-0.5 block text-[10px]" style={{ color: noteTone ?? '#8a8a8a' }}>
          {note}
        </span>
      )}
    </div>
  );
}
