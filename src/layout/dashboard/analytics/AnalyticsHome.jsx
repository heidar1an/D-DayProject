/*
 * AnalyticsHome — صفحهٔ اصلی «تحلیل عملکرد».
 * سلسله‌مراتب سه‌سطحی تجربه:
 *   LEVEL 1 (سریع): KPIها + امتیاز عملکرد + مقایسهٔ تمرین/آزمون
 *   LEVEL 2 (تحلیلی): روند، نقشهٔ ضعف، عملکرد درس‌ها، آزمون‌های اخیر
 *   LEVEL 3 (تشخیصی): تشخیص یادگیری + بینش‌ها + پیشنهاد بعدی تپش
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
  ColumnChart,
  InsightCard,
  RecommendationCard,
  MasteryBadge,
  TrendArrow,
  DeltaPill,
  formatPercent,
  formatSeconds,
  formatShortDate,
  formatSigned,
  faNum,
  toFa,
} from './analyticsShared';

const TREND_METRICS = [
  { key: 'accuracy', label: 'دقت', accent: '#61D192', unit: '٪' },
  { key: 'performanceScore', label: 'امتیاز عملکرد', accent: '#937fcd', unit: '' },
  { key: 'count', label: 'حجم روزانه', accent: '#5b8cc7', unit: '' },
  { key: 'averageTime', label: 'زمان پاسخ', accent: '#e0b45c', unit: ' ثانیه' },
];

const WEAKNESS_BUCKETS = [
  { key: 'critical', title: 'نیازمند توجه فوری', accent: '#e26d6d', icon: 'alert' },
  { key: 'review', title: 'نیازمند مرور', accent: '#e0b45c', icon: 'refresh' },
  { key: 'ok', title: 'وضعیت مناسب', accent: '#61D192', icon: 'check' },
];

/* ── KPI یک‌تایی ── */
function KpiTile({ label, value, sub, delta, goodDirection, deltaSuffix, accent = '#eaf6ef' }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#2a2a2d] px-4 py-3.5">
      <span className="text-[11px] text-[#8a8a8a]">{label}</span>
      <strong className="mt-0.5 block text-xl font-extrabold [font-family:'Doran',Tahoma,sans-serif]" style={{ color: accent }}>
        {value}
      </strong>
      {delta !== undefined ? (
        <div className="mt-1">
          <DeltaPill delta={delta} goodDirection={goodDirection} suffix={deltaSuffix} />
        </div>
      ) : (
        sub && <span className="mt-0.5 block text-[11px] text-[#777]">{sub}</span>
      )}
    </div>
  );
}

export default function AnalyticsHome({ data, onNavigate, onRunRecommendation, onOpenExam }) {
  const [trendMetric, setTrendMetric] = useState('accuracy');
  if (!data) return null;

  const { kpis, comparison, performance, consistency, practiceVsExam, trend, subjects, weakness, errors, time, confidence, diagnosis, insights, recommendations, dataStatus, exams } = data;
  const metricMeta = TREND_METRICS.find((metric) => metric.key === trendMetric);

  const trendPoints = trend.series.map((point, index) => ({
    value: trendMetric === 'count' ? point.count : point[trendMetric],
    label: point.label,
    key: point.key,
    index,
  }));
  /* برچسب تاریخ برای سری — از سرویس کلید دارد؛ نمایش ماهانه کافی است */
  const labeledPoints = trend.series.map((point, index) => ({ ...trendPoints[index], label: point.dateLabel ?? point.label }));
  const examMarkers = trend.examEvents
    .map((event) => {
      const dayIndex = trend.series.findIndex((point) => point.key === event.dayKey);
      return dayIndex >= 0 ? { id: event.id, dayIndex } : null;
    })
    .filter(Boolean);

  const answerSegments = [
    { key: 'correct', value: kpis.correct, accent: '#61D192' },
    { key: 'wrong', value: kpis.wrong, accent: '#e26d6d' },
    { key: 'unanswered', value: kpis.unanswered, accent: '#6b6b6b' },
  ];

  const emptyTrendNote = 'در این بازه دادهٔ روزانه‌ای برای رسم روند نیست';

  return (
    <div className="space-y-6">
      {/* ── هشدار حجم داده (Empty State هوشمند) ── */}
      {dataStatus.level !== 'ok' && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-[#e0b45c]/10 px-4 py-3 text-[12.5px] text-[#e0b45c]" role="status">
          <Icon name="info" className="h-4 w-4 shrink-0" />
          {dataStatus.hint}
        </div>
      )}

      {/* ══════════ LEVEL 1 — وضعیت من چطور است؟ ══════════ */}

      {/* KPIها */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <KpiTile label="تعداد تست" value={faNum(kpis.totalAttempts)} delta={comparison.metrics.find((m) => m.key === 'attemptCount')?.delta} goodDirection="up" />
        <KpiTile label="دقت پاسخ‌گویی" value={formatPercent(kpis.accuracy)} accent="#61D192" delta={comparison.metrics.find((m) => m.key === 'accuracy')?.delta} goodDirection="up" deltaSuffix="٪" />
        <KpiTile label="میانگین زمان" value={formatSeconds(kpis.averageTime)} delta={comparison.metrics.find((m) => m.key === 'averageTime')?.delta} goodDirection="down" deltaSuffix=" ثانیه" />
        <KpiTile label="آزمون تکمیل‌شده" value={faNum(kpis.completedExams)} />
        <KpiTile label="بی‌پاسخ" value={faNum(kpis.unanswered)} delta={comparison.metrics.find((m) => m.key === 'unanswered')?.delta} goodDirection="down" />
      </div>

      {/* امتیاز عملکرد + توزیع درست/غلط/نزده */}
      <Card
        title="امتیاز عملکرد"
        icon="target"
        hint={performance.note}
        className="dashboard-layer-reveal"
      >
        <div className="grid gap-6 lg:grid-cols-[auto_1fr_auto]">
          <div className="flex items-center justify-center gap-6">
            <RingScore score={performance.score} label="از ۱۰۰" accent={performance.score >= 70 ? '#61D192' : performance.score >= 55 ? '#e0b45c' : '#e26d6d'} />
          </div>
          <div className="space-y-2 self-center">
            {Object.entries(performance.parts)
              .filter(([, part]) => part.weight > 0)
              .map(([key, part]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[11.5px] text-[#999]">
                    {{ accuracy: 'دقت', consistency: 'ثبات', speed: 'سرعت', difficulty: 'دشواری', recency: 'روند' }[key] ?? key}
                  </span>
                  <div className="an-bar flex-1">
                    <span className="an-bar__fill" style={{ width: `${Math.min(100, part.score)}%`, background: '#937fcd' }} />
                  </div>
                  <span className="w-20 shrink-0 text-left text-[11px] text-[#777]">
                    {faNum(Math.round(part.score))} <span className="text-[10px]">· وزن {toFa(Math.round(part.weight * 100))}٪</span>
                  </span>
                </div>
              ))}
          </div>
          <div className="flex flex-col items-center gap-2 self-center rounded-2xl bg-white/[0.03] px-5 py-4">
            <DonutChart
              segments={answerSegments}
              centerLabel={formatPercent(kpis.accuracy)}
              centerSub="درست / غلط / نزده"
              ariaLabel={`توزیع پاسخ‌ها: ${faNum(kpis.correct)} درست، ${faNum(kpis.wrong)} غلط، ${faNum(kpis.unanswered)} بی‌پاسخ`}
              size={128}
              stroke={16}
            />
            <div className="flex gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-[#61D192]"><span className="h-2 w-2 rounded-full bg-[#61D192]" />درست {faNum(kpis.correct)}</span>
              <span className="flex items-center gap-1 text-[#e26d6d]"><span className="h-2 w-2 rounded-full bg-[#e26d6d]" />غلط {faNum(kpis.wrong)}</span>
              <span className="flex items-center gap-1 text-[#8a8a8a]"><span className="h-2 w-2 rounded-full bg-[#6b6b6b]" />نزده {faNum(kpis.unanswered)}</span>
            </div>
          </div>
        </div>
        {consistency.score !== null && (
          <p className="mt-4 border-t border-white/6 pt-3 text-[12px] text-[#999]">
            ثبات عملکرد بین {faNum(consistency.sessions)} سشن: <strong style={{ color: consistency.cv < 0.22 ? '#61D192' : '#e0b45c' }}>{consistency.label}</strong>
            {' · '}آزمون‌های تو از نظر میزان نوسان دقت تحلیل شده‌اند.
          </p>
        )}
      </Card>

      {/* تمرین در برابر آزمون */}
      <Card
        title="تمرین در برابر آزمون"
        icon="layers"
        hint="آیا عملکردت در شرایط واقعی آزمون هم حفظ می‌شود؟"
        className="dashboard-layer-reveal"
      >
        {practiceVsExam.sufficient ? (
          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                { key: 'practice', title: 'تمرینی', accent: '#61D192', icon: 'book' },
                { key: 'exam', title: 'آزمونی', accent: '#937fcd', icon: 'bolt' },
              ]
            ).map((side) => {
              const stats = practiceVsExam[side.key];
              return (
                <div key={side.key} className="rounded-2xl border border-white/8 bg-[#2a2a2d] p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold" style={{ color: side.accent }}>
                    <Icon name={side.icon} className="h-4 w-4" />
                    {side.title}
                  </h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                    <span className="text-[#8a8a8a]">دقت</span><strong>{formatPercent(stats.accuracy)}</strong>
                    <span className="text-[#8a8a8a]">میانگین زمان</span><strong>{formatSeconds(stats.averageTime)}</strong>
                    <span className="text-[#8a8a8a]">تعداد تست</span><strong>{faNum(stats.answered)}</strong>
                    <span className="text-[#8a8a8a]">سطح دشواری حل‌شده</span><strong>{stats.difficulty ? toFa(stats.difficulty.toFixed(2)) : '—'}</strong>
                    {side.key === 'exam' ? (
                      <>
                        <span className="text-[#8a8a8a]">بی‌پاسخ (فشار زمان)</span><strong>{faNum(stats.unanswered)} سؤال</strong>
                      </>
                    ) : (
                      <>
                        <span className="text-[#8a8a8a]">پاسخ‌های مطمئن</span><strong>{stats.confidence === null ? '—' : `${faNum(stats.confidence)}٪`}</strong>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="md:col-span-2">
              {practiceVsExam.accuracyDrop !== null && Math.abs(practiceVsExam.accuracyDrop) >= 5 ? (
                <p className="text-[12.5px] leading-6 text-[#c9c9c9]">
                  {practiceVsExam.accuracyDrop > 0 ? (
                    <>
                      دقت تو در تمرین‌ها <strong className="text-[#61D192]">{faNum(Math.round(practiceVsExam.practice.accuracy))}٪</strong> است اما در آزمون‌ها به{' '}
                      <strong className="text-[#e26d6d]">{faNum(Math.round(practiceVsExam.exam.accuracy))}٪</strong> کاهش پیدا می‌کند؛ تمرین در شرایط شبیه‌سازی‌شدهٔ آزمون (تایمر و بدون وقفه) این فاصله را می‌بندد.
                    </>
                  ) : (
                    <>
                      دقت آزمونی تو ({faNum(Math.round(practiceVsExam.exam.accuracy))}٪) حتی از تمرینی‌ات ({faNum(Math.round(practiceVsExam.practice.accuracy))}٪) بالاتر است؛ نشانهٔ آمادگی آزمونی خوب.
                    </>
                  )}
                </p>
              ) : (
                <p className="text-[12.5px] leading-6 text-[#9a9a9a]">دقت تو در تمرین و آزمون تقریباً یکسان است — عملکردت در شرایط فشار حفظ می‌شود.</p>
              )}
            </div>
          </div>
        ) : (
          <EmptyState icon="layers" title="دادهٔ کافی برای مقایسه نیست" note="برای مقایسهٔ معنادار، هم تمرین کافی و هم حداقل یک آزمون کامل لازم است." />
        )}
      </Card>

      {/* ══════════ LEVEL 2 — مشکل کجاست؟ ══════════ */}

      {/* روند عملکرد */}
      <Card
        title="روند عملکرد در طول زمان"
        icon="chart"
        hint="نقاط زرد، روزهای آزمون‌اند. فاصله‌های خالی، دوره‌های بدون فعالیت‌اند."
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
          ariaLabel={`نمودار ${metricMeta.label} در طول ${toFa(trend.series.length)} روز`}
          yMax={trendMetric === 'averageTime' ? Math.max(90, Math.ceil(Math.max(...labeledPoints.map((p) => p.value ?? 0)) / 30) * 30) : 100}
          markerEvents={examMarkers}
          emptyNote={emptyTrendNote}
        />
        {examMarkers.length > 0 && (
          <p className="mt-2 text-[11px] text-[#777]">
            آزمون‌های این بازه: {trend.examEvents.map((event) => event.title).join(' · ')}
          </p>
        )}
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
          <div className="grid gap-5 lg:grid-cols-3">
            {WEAKNESS_BUCKETS.map((bucket) => {
              const items = weakness[bucket.key];
              return (
                <div key={bucket.key} className="rounded-2xl border border-white/6 bg-[#2a2a2d] p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-[12.5px] font-bold" style={{ color: bucket.accent }}>
                    <Icon name={bucket.icon} className="h-4 w-4" />
                    {bucket.title}
                    <span className="mr-auto text-[11px] font-normal text-[#777]">{faNum(items.length)} مبحث</span>
                  </h3>
                  {items.length === 0 ? (
                    <p className="text-[11.5px] text-[#777]">—</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.slice(0, 5).map((topic) => (
                        <li key={topic.key}>
                          <button
                            type="button"
                            onClick={() => onNavigate?.('subject', { subjectId: topic.subjectId })}
                            className="w-full cursor-pointer rounded-xl px-2 py-1.5 text-right transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[#61D192]"
                          >
                            <span className="flex items-baseline justify-between gap-2 text-[12.5px]">
                              <span className="min-w-0 truncate text-[#ddd]">{topic.key}</span>
                              <span className="shrink-0 text-[11px] font-semibold" style={{ color: bucket.accent }}>
                                {formatPercent(topic.accuracy)}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-[10.5px] text-[#777]">
                              {faNum(topic.attemptCount)} تست · اولویت {faNum(Math.round(topic.priority))}
                            </span>
                          </button>
                        </li>
                      ))}
                      {items.length > 5 && <li className="text-[11px] text-[#777]">و {faNum(items.length - 5)} مبحث دیگر…</li>}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {weakness.biggestDrop && (
          <p className="mt-4 border-t border-white/6 pt-3 text-[12.5px] leading-6 text-[#c9c9c9]">
            بیشترین افت عملکرد تو مربوط به مبحث <strong className="text-[#e0b45c]">«{weakness.biggestDrop.key}»</strong> است؛
            دقتش در نیمهٔ اخیر {toFa(Math.abs(weakness.biggestDrop.trend.delta))} واحد {weakness.biggestDrop.trend.delta < 0 ? 'کاهش' : 'تغییر'} کرده است.
          </p>
        )}
      </Card>

      {/* عملکرد درس‌ها */}
      <Card
        title="عملکرد بر اساس درس"
        icon="grid"
        hint="روی هر درس بزن تا تحلیل مبحث‌به‌مبحثش را ببینی"
        className="dashboard-layer-reveal"
      >
        <div className="space-y-3.5">
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

      {/* آزمون‌های اخیر */}
      {exams.length > 0 && (
        <Card
          title="آزمون‌های اخیر"
          icon="bolt"
          hint="کارنامهٔ هر آزمون را در تحلیلش ببین"
          action={
            <button type="button" onClick={() => onNavigate?.('exams')} className="cursor-pointer rounded-xl bg-white/[0.06] px-3 py-1.5 text-[11.5px] text-[#ccc] transition-colors hover:bg-white/[0.1]">
              همهٔ آزمون‌ها
            </button>
          }
          className="dashboard-layer-reveal"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {exams.map((exam) => (
              <button
                key={exam.examId}
                type="button"
                onClick={() => onOpenExam?.(exam.examId)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[#2a2a2d] p-3.5 text-right transition-colors hover:border-white/20 focus-visible:outline-2 focus-visible:outline-[#61D192]"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-bold">{exam.title}</h3>
                  <p className="mt-0.5 text-[11px] text-[#777]">
                    {formatShortDate(exam.submittedAt)} · {faNum(exam.total)} سؤال
                    {exam.percentile !== null && exam.percentile !== undefined ? ` · صدک ${faNum(exam.percentile)}` : ''}
                  </p>
                </div>
                <div className="text-center">
                  <strong className="block text-lg font-extrabold" style={{ color: exam.percentage >= 70 ? '#61D192' : exam.percentage >= 50 ? '#e0b45c' : '#e26d6d' }}>
                    {formatPercent(exam.percentage)}
                  </strong>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* میان‌بُرهای تحلیل رفتاری */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { key: 'errors', title: 'تحلیل نوع خطا', icon: 'alert', note: `${faNum(errors.totalWrong)} پاسخ غلط دسته‌بندی شده` },
          { key: 'time', title: 'تحلیل زمان', icon: 'clock', note: `میانهٔ پاسخ ${formatSeconds(time.medianTime)}` },
          { key: 'confidence', title: 'اطمینان در برابر دقت', icon: 'spark', note: confidence.sufficient ? `پوشش داده: ${faNum(confidence.coverage)}٪` : 'دادهٔ اطمینان محدود است' },
          { key: 'difficulty', title: 'عملکرد و دشواری', icon: 'target', note: 'دقت در هر سطح سختی' },
        ].map((shortcut) => (
          <button
            key={shortcut.key}
            type="button"
            onClick={() => onNavigate?.(shortcut.key)}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/8 bg-[#242426] p-4 text-right transition-colors hover:bg-[#2a2a2d] focus-visible:outline-2 focus-visible:outline-[#61D192]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-[#61D192]">
              <Icon name={shortcut.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <strong className="block text-[13px]">{shortcut.title}</strong>
              <span className="block truncate text-[11px] text-[#777]">{shortcut.note}</span>
            </span>
          </button>
        ))}
      </div>

      {/* ══════════ LEVEL 3 — چرا؟ و چه کار کنم؟ ══════════ */}

      {/* تشخیص وضعیت یادگیری */}
      <Card
        title="تشخیص وضعیت یادگیری"
        icon="target"
        hint="خلاصهٔ داده‌محور نقاط قوت، ضعف و اولویت‌های مرور تو"
        className="dashboard-layer-reveal"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            { key: 'strongAreas', title: 'نقاط قوت اصلی', accent: '#61D192', icon: 'check', empty: 'هنوز مبحثی به مرحلهٔ «قوی» نرسیده است' },
            { key: 'weakAreas', title: 'اولویت برای تقویت', accent: '#e26d6d', icon: 'alert', empty: 'مبحث ضعیف مشخصی ثبت نشده' },
            { key: 'atRiskAreas', title: 'در معرض افت', accent: '#e0b45c', icon: 'trendDown', empty: 'افت مبحثی فعالی دیده نمی‌شود' },
            { key: 'needsReview', title: 'نیازمند مرور', accent: '#937fcd', icon: 'refresh', empty: 'مبحثی در مرحلهٔ مرور نیست' },
            { key: 'improvingAreas', title: 'در حال رشد', accent: '#5b8cc7', icon: 'trendUp', empty: 'روند صعودی مبحثی ثبت نشده' },
          ].map((group) => {
            const items = diagnosis[group.key];
            return (
              <div key={group.key} className="rounded-2xl border border-white/6 bg-[#2a2a2d] p-4">
                <h3 className="mb-2.5 flex items-center gap-2 text-[12.5px] font-bold" style={{ color: group.accent }}>
                  <Icon name={group.icon} className="h-4 w-4" />
                  {group.title}
                </h3>
                {items.length === 0 ? (
                  <p className="text-[11.5px] text-[#777]">{group.empty}</p>
                ) : (
                  <ol className="space-y-1.5">
                    {items.map((topic, index) => (
                      <li key={topic.key} className="flex items-baseline gap-2 text-[12.5px]">
                        <span className="text-[11px] font-bold text-[#777]">{toFa(index + 1)}.</span>
                        <button type="button" onClick={() => onNavigate?.('subject', { subjectId: topic.subjectId })} className="min-w-0 flex-1 cursor-pointer truncate text-right text-[#ddd] transition-colors hover:text-white">
                          {topic.key}
                        </button>
                        <span className="shrink-0 text-[11px] text-[#999]">{formatPercent(topic.accuracy)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
          {diagnosis.overallTrend && (
            <div className="rounded-2xl border border-white/6 bg-[#2a2a2d] p-4">
              <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-bold text-[#eaf6ef]">
                <Icon name={diagnosis.overallTrend === 'up' ? 'trendUp' : diagnosis.overallTrend === 'down' ? 'trendDown' : 'trendUp'} className="h-4 w-4" style={{ color: diagnosis.overallTrend === 'down' ? '#e26d6d' : '#61D192' }} />
                روند کلی تو
              </h3>
              <p className="text-[12px] leading-6 text-[#9a9a9a]">
                {diagnosis.overallTrend === 'up' ? 'عملکرد اخیر تو نسبت به قبل صعودی است؛ همین مسیر را ادامه بده.' : diagnosis.overallTrend === 'down' ? 'عملکرد اخیر تو کمی پایین‌تر از قبل است؛ طبیعی است — با مرور هدفمند برمی‌گردد.' : 'عملکرد تو در طول زمان پایدار بوده است.'}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* بینش‌ها */}
      <Card
        title="بینش‌های داده‌محور"
        icon="spark"
        hint="هر بینش با شواهدش؛ نه حدس"
        className="dashboard-layer-reveal"
      >
        {insights.length === 0 ? (
          <EmptyState icon="spark" title="بینش جدیدی نیست" note="با تست‌زدن بیشتر، الگوهای عملکردت اینجا ظاهر می‌شوند." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} onAction={() => insight.relatedTopic && onNavigate?.('subject', { subjectId: insight.relatedTopic?.split(' › ')[0] })} />
            ))}
          </div>
        )}
      </Card>

      {/* پیشنهاد بعدی تپش */}
      <Card
        title="پیشنهاد بعدی تپش"
        icon="bolt"
        hint="اقدام‌های مشخص، به‌ترتیب اولویت — از تحلیل تو تولید شده‌اند"
        className="dashboard-layer-reveal"
      >
        {recommendations.length === 0 ? (
          <EmptyState icon="bolt" title="پیشنهاد فعالی نیست" note="وقتی دادهٔ بیشتری ثبت شود، قدم بعدی‌ات را همین‌جا می‌بینی." />
        ) : (
          <div className="space-y-2.5">
            {recommendations.map((recommendation) => (
              <RecommendationCard key={recommendation.id} recommendation={recommendation} onRun={() => onRunRecommendation?.(recommendation)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
