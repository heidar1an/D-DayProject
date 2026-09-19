/*
 * ExamResult — کارنامه و تحلیل عملکرد.
 * سه حالت: ready (کارنامهٔ کامل) / processing (نتایج در حال پردازش) / not_participated.
 * مقایسهٔ جامعهٔ آماری جذاب ولی غیر-Leaderboard است؛ رتبه، تراز و آمار کلیدی.
 */
import { useEffect, useState } from 'react';
import { HeartReward } from '../../league/leagueShared';
import { computeExamStatus } from '../../../../services/coordinatedExams/coordinatedExamService';
import { Icon, TypeBadge, faNum, formatFullDate, formatTime, toFa } from './coordinatedShared';

const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/* حلقهٔ درصد — فقط یک transition ساده؛ Performance مهم‌تر از نمایش است */
function ScoreRing({ percentage, accent }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setProgress(percentage));
    return () => cancelAnimationFrame(frame);
  }, [percentage]);

  return (
    <svg viewBox="0 0 128 128" className="exm-ring h-36 w-36" role="img" aria-label={`${toFa(percentage)} درصد`}>
      <circle cx="64" cy="64" r={RING_RADIUS} fill="none" stroke="rgb(var(--wash-rgb) / 0.08)" strokeWidth="10" />
      <circle
        cx="64"
        cy="64"
        r={RING_RADIUS}
        fill="none"
        stroke={accent}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress / 100)}
        transform="rotate(-90 64 64)"
      />
      <text x="64" y="60" textAnchor="middle" fill="var(--white)" fontSize="26" fontWeight="700" fontFamily="Pinar, 'Vazir', Tahoma, sans-serif">
        {toFa(percentage)}
      </text>
      <text x="64" y="80" textAnchor="middle" fill="var(--faint)" fontSize="11" fontFamily="Pinar, 'Vazir', Tahoma, sans-serif">
        درصد
      </text>
    </svg>
  );
}

function StatChip({ label, value, accent = '#ddd' }) {
  return (
    <div className="flex-1 rounded-2xl bg-white/[0.03] p-3.5 text-center">
      <strong className="block text-lg [font-family:'Pinar','Vazir',Tahoma,sans-serif]" style={{ color: accent }}>
        {value}
      </strong>
      <span className="mt-0.5 block text-[11px] text-[var(--faint)]">{label}</span>
    </div>
  );
}

const subjectAccent = (percent) => (percent >= 70 ? '#61D192' : percent >= 40 ? '#e0b45c' : '#e26d6d');

function SubjectBars({ subjects }) {
  return (
    <div className="space-y-4">
      {subjects.map((subject) => (
        <div key={subject.subject}>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-[var(--muted)]">{subject.subject}</span>
            <span className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--faint)]">
                {faNum(subject.correct)} صحیح از {faNum(subject.total)}
              </span>
              <strong style={{ color: subjectAccent(subject.percent) }}>{toFa(subject.percent)}٪</strong>
            </span>
          </div>
          <div className="exm-bar">
            <div
              className="exm-bar__fill"
              style={{ width: `${subject.percent}%`, background: subjectAccent(subject.percent) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExamResult({ variant, exam, result, reward, releaseAt, ranking, onReview, onBack }) {
  const header = (
    <header className="dash-stagger flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--surface-soft)] px-3.5 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-strong)] hover:text-white"
      >
        <Icon name="back" className="h-3.5 w-3.5" />
        بازگشت به آزمون‌ها
      </button>
      {exam && (
        <span className="mr-auto flex flex-wrap items-center gap-2 text-xs text-[var(--faint)]">
          {formatFullDate(exam.startTime)}
          <TypeBadge type={exam.type} />
        </span>
      )}
    </header>
  );

  /* ── نتایج در حال پردازش ── */
  if (variant === 'processing') {
    return (
      <div className="dash-stagger space-y-6">
        {header}
        <div className="flex flex-col items-center gap-3 rounded-[2.2rem] border border-white/[0.07] bg-[var(--surface)] p-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[#937fcd]/12 text-[var(--purple-ink)]">
            <Icon name="clock" className="h-7 w-7" />
          </span>
          <h1 className="text-lg text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">نتایج شما در حال پردازش است</h1>
          <p className="max-w-md text-sm leading-7 text-[var(--faint)]">
            کارنامه و رتبهٔ شما بعد از تطبیق با شرکت‌کنندگان سراسری اعلام می‌شود
            {releaseAt ? ` — حدوداً ${formatFullDate(releaseAt)} ساعت ${formatTime(releaseAt)}` : ''}.
          </p>
        </div>
      </div>
    );
  }

  /* ── شرکت نکرده / فقط آمار جامعه ── */
  if (variant === 'not_participated') {
    return (
      <div className="dash-stagger space-y-6">
        {header}
        <div className="space-y-6 rounded-[2.2rem] border border-white/[0.07] bg-[var(--surface)] p-6 md:p-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white/[0.05] text-[var(--faint)]">
              <Icon name="info" className="h-7 w-7" />
            </span>
            <h1 className="text-lg text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              در این آزمون شرکت نکرده‌ای
            </h1>
            <p className="max-w-md text-sm leading-7 text-[var(--faint)]">
              برای دیدن کارنامهٔ شخصی باید در آزمون شرکت کنی؛ آمار کلی آزمون‌دهندگان پایین قابل مشاهده است.
            </p>
          </div>

          {ranking && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatChip label="شرکت‌کننده" value={faNum(ranking.participantsCount)} />
              <StatChip label="میانگین درصد" value={`${toFa(ranking.averagePercent)}٪`} />
              <StatChip label="میانهٔ نمرات" value={`${toFa(ranking.medianPercent)}٪`} />
              <StatChip label="بالاترین نمره" value={`${toFa(ranking.topPercent)}٪`} accent="#937fcd" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!result) return null;

  const strong = result.subjects?.[0];
  const weak = [...(result.subjects ?? [])].sort((a, b) => a.percent - b.percent)[0];
  /* رتبه تا پایان کامل زمان آزمون (همان روز) نمایش داده نمی‌شود */
  const examStillLive = exam ? computeExamStatus(exam) === 'LIVE' : false;
  /* میانگین شرکت‌کنندگان موقتاً از کارنامهٔ آزمون‌های جامع/سراسری/آزمایشی حذف شده است */
  const isComprehensive = ['comprehensive', 'national', 'mock'].includes(exam?.type);

  return (
    <div className="dash-stagger space-y-6">
      {header}

      {/* ── خلاصهٔ نمره ── */}
      <section className="relative overflow-hidden rounded-[2.2rem] border border-white/[0.07] bg-[var(--surface)] p-6 md:p-8">
        <div className="absolute -left-24 -top-28 h-64 w-64 rounded-full bg-[#937fcd]/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <ScoreRing percentage={result.percentage} accent="#937fcd" />
            <div className="space-y-2.5">
              <h1 className="text-lg leading-snug text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">{result.examTitle}</h1>
              <p className="text-xs text-[var(--faint)]">
                کارنامهٔ {formatFullDate(result.submittedAt)}
                {result.reason === 'timeout' && ' • ثبت خودکار با پایان زمان'}
              </p>
              {reward && (
                <p className="flex items-center gap-1.5 text-xs text-[var(--red-ink)]">
                  <HeartReward amount={reward.hearts} size="sm" />
                  بابت شرکت در آزمون گرفتی
                </p>
              )}
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-3 md:max-w-md md:grid-cols-4">
            <StatChip label="صحیح" value={faNum(result.correct)} accent="#61D192" />
            <StatChip label="غلط" value={faNum(result.wrong)} accent="#e26d6d" />
            <StatChip label="نزده" value={faNum(result.unanswered)} accent="#e0b45c" />
            <StatChip label="زمان" value={`${toFa(Math.round(result.timeSpent / 60))} دقیقه`} />
          </div>
        </div>
      </section>

      {/* ── رتبه و مقایسهٔ جامعهٔ آماری ── */}
      <section aria-label="مقایسه با شرکت‌کنندگان" className="rounded-[2rem] border border-white/[0.07] bg-[var(--surface)] p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-base text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          <Icon name="medal" className="h-5 w-5 text-[var(--gold-ink)]" />
          جایگاه تو بین شرکت‌کنندگان
        </h2>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {!examStillLive && (
            <StatChip label="رتبهٔ من" value={`${faNum(result.rank)} از ${faNum(result.participantsCount)}`} accent="#937fcd" />
          )}
          {result.teraz !== null && <StatChip label="تراز" value={faNum(result.teraz)} />}
          {!isComprehensive && <StatChip label="میانگین آزمون" value={`${toFa(result.community.averagePercent)}٪`} />}
          <StatChip label="میانهٔ نمرات" value={`${toFa(result.community.medianPercent)}٪`} />
          <StatChip label="بالاترین نمره" value={`${toFa(result.community.topPercent)}٪`} accent="#937fcd" />
        </div>

        {examStillLive && (
          <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-[var(--gold-ink)]">
            <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
            رتبهٔ شما بعد از پایان کامل زمان آزمون و تطبیق با همهٔ شرکت‌کنندگان اعلام می‌شود.
          </p>
        )}
      </section>

      {/* ── تحلیل عملکرد بر اساس درس ── */}
      <section aria-label="تحلیل عملکرد" className="rounded-[2rem] border border-white/[0.07] bg-[var(--surface)] p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-base text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          <Icon name="chart" className="h-5 w-5 text-[var(--green-ink)]" />
          عملکرد به تفکیک درس
        </h2>

        <div className="mt-5">
          <SubjectBars subjects={result.subjects} />
        </div>

        {strong && weak && strong !== weak && (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="flex items-start gap-2.5 rounded-2xl bg-[#61D192]/8 p-4 text-xs leading-6 text-[var(--green-ink)]">
              <Icon name="spark" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--green-ink)]" />
              <span>
                <strong className="text-[var(--green-ink)]">نقطهٔ قوت:</strong> {strong.subject} با {toFa(strong.percent)}٪ — این درس را حفظ کن.
              </span>
            </div>
            <div className="flex items-start gap-2.5 rounded-2xl bg-[#e26d6d]/8 p-4 text-xs leading-6 text-[var(--red-soft-ink)]">
              <Icon name="warn" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--red-ink)]" />
              <span>
                <strong className="text-[var(--red-ink)]">نیازمند مرور:</strong> {weak.subject} با {toFa(weak.percent)}٪ — از مرور سؤال‌ها شروع کن.
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── اقدام بعدی: مرور سؤال به سؤال ── */}
      <section className="flex flex-col items-center gap-4 rounded-[2rem] border border-dashed border-white/12 bg-white/[0.02] p-6 text-center">
        <p className="max-w-md text-sm leading-7 text-[var(--faint)]">
          آزمون پایان یادگیری نیست؛ از پاسخ‌هایت درس بساز — مرور سؤال به سؤال با توضیح کامل و افزودن نکته‌ها به فلش‌کارت.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onReview}
            className="flex cursor-pointer items-center gap-2 rounded-2xl bg-[var(--purple-bright)] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--purple-bright)]"
          >
            <Icon name="card" className="h-4 w-4" />
            مرور سؤال به سؤال
          </button>
          <button
            type="button"
            onClick={onBack}
            className="cursor-pointer rounded-2xl bg-white/[0.06] px-6 py-3 text-sm text-[var(--muted)] transition-colors hover:bg-white/[0.1] hover:text-white"
          >
            بازگشت به آزمون‌ها
          </button>
        </div>
      </section>
    </div>
  );
}
