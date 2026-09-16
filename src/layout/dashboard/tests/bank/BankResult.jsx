/*
 * BankResult — کارنامهٔ سشن (تمرین/آزمون). حلقهٔ درصد، تفکیک درس/مبحث، قوی‌ترین و
 * ضعیف‌ترین، و پیشنهاد قدم بعدی (فعلاً قاعده‌محور؛ در آینده از موتور پیشنهاد تغذیه می‌شود).
 */
import { Icon, faNum, formatAgo, toFa } from './bankShared';

/* حلقهٔ درصد — هم‌زبان کارنامهٔ آزمون‌های هماهنگ */
function ScoreRing({ percentage, label, accent = '#61D192' }) {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(percentage, 0), 100) / 100);

  return (
    <div className="relative grid place-items-center" role="img" aria-label={`${label}: ${toFa(percentage)} درصد`}>
      <svg className="tb-ring -rotate-90" width="152" height="152" viewBox="0 0 152 152">
        <circle cx="76" cy="76" r={radius} fill="none" stroke="rgb(var(--wash-rgb) / 0.07)" strokeWidth="10" />
        <circle
          cx="76"
          cy="76"
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute flex flex-col items-center">
        <strong className="text-3xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">{toFa(percentage)}٪</strong>
        <span className="mt-0.5 text-[10.5px] text-[var(--faint)]">{label}</span>
      </span>
    </div>
  );
}

function StatCell({ label, value, accent }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-3 text-center">
      <strong className="block text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]" style={accent ? { color: accent } : undefined}>
        {value}
      </strong>
      <span className="mt-0.5 block text-[10.5px] text-[var(--faint)]">{label}</span>
    </div>
  );
}

function SubjectBars({ subjects }) {
  return (
    <ul className="space-y-3">
      {subjects.map((entry) => (
        <li key={entry.subjectId}>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--muted)]">{entry.subjectName}</span>
            <span className="text-[var(--faint)]">
              {toFa(entry.correct)} از {toFa(entry.total)}
              {entry.unanswered > 0 && <span className="text-[var(--faint)]"> · {toFa(entry.unanswered)} نزده</span>}
            </span>
          </div>
          <span className="tb-bar block">
            <span
              className="tb-bar__fill block"
              style={{
                width: `${Math.max(entry.percent, 2)}%`,
                background:
                  entry.percent >= 70 ? '#61D192' : entry.percent >= 40 ? '#e0b45c' : '#e26d6d',
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

const fmtSeconds = (seconds) => {
  if (!seconds && seconds !== 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${toFa(minutes)}′ ${toFa(rest)}″` : `${toFa(rest)}″`;
};

export default function BankResult({ session, onReview, onBack, onNavigate, onRetake, onBuildNext }) {
  const result = session.result;
  const isExam = session.mode === 'exam';
  const hasWrong = (result?.wrongIds?.length ?? 0) > 0;
  const weakTopicCount = (result?.topics ?? [])
    .slice()
    .sort((a, b) => a.percent - b.percent)
    .filter((entry) => entry.percent < 60)
    .slice(0, 3).length;

  if (!result) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <Icon name="alert" className="mx-auto h-10 w-10 text-[var(--gold-ink)]" />
          <p className="mt-3 text-sm text-[var(--faint)]">کارنامهٔ این سشن در دسترس نیست.</p>
          <button type="button" onClick={onBack} className="mt-4 cursor-pointer rounded-xl bg-white/8 px-5 py-2 text-sm">
            بازگشت
          </button>
        </div>
      </div>
    );
  }

  /* پیشنهاد قدم بعد — قاعده‌محور از همین کارنامه */
  const suggestions = [];
  if (onBuildNext) {
    suggestions.push({
      icon: 'target',
      accent: '#61D192',
      title: 'آزمون بعدی را بر اساس عملکردم بساز',
      note: weakTopicCount
        ? `${faNum(weakTopicCount)} مبحث ضعیف این کارنامه شناسایی شد؛ آزمون‌ساز شخصی با همان‌ها پیش‌تنظیم می‌شود.`
        : 'آزمون‌ساز شخصی با نگاه به همین کارنامه پیش‌تنظیم می‌شود.',
      onClick: () => onBuildNext(session),
    });
  }
  if (result.weakest && result.weakest.percent < 70) {
    suggestions.push({
      icon: 'layers',
      accent: '#937fcd',
      title: `تمرین مبحثی از ${result.weakest.subjectName}`,
      note: `ضعیف‌ترین درس تو با ${toFa(result.weakest.percent)}٪ صحیح؛ از همان‌جا شروع کن.`,
      onClick: () => onNavigate('topics', { subjectId: result.weakest.subjectId }),
    });
  }
  if (hasWrong) {
    suggestions.push({
      icon: 'refresh',
      accent: '#e26d6d',
      title: 'مرور غلط‌های این سشن',
      note: `${faNum(result.wrongIds.length)} سؤال غلط یا بی‌پاسخ؛ تحلیل هرکدام را ببین.`,
      onClick: () => onReview(session),
    });
  }
  suggestions.push({
    icon: 'dice',
    accent: '#5b8cc7',
    title: 'آزمون تصادفی جدید',
    note: 'سنجش دوباره با ترکیبی متفاوت از کل بانک.',
    onClick: () => onNavigate('builder', { preset: 'random' }),
  });

  const ringAccent = result.percentage >= 70 ? '#61D192' : result.percentage >= 40 ? '#e0b45c' : '#e26d6d';

  return (
    <div className="space-y-5">
      {/* ── کارت امتیاز ── */}
      <section className="dash-stagger rounded-[2.5rem] border border-white/8 bg-[var(--surface)] p-6 md:p-8">
        <div className="flex flex-col items-center gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="order-2 flex-1 md:order-1">
            <h2 className="text-xl font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">{session.title}</h2>
            <p className="mt-1 text-xs text-[var(--faint)]">
              {isExam ? 'آزمون زمان‌دار' : 'تمرین'} · {faNum(result.total)} سؤال · {formatAgo(result.submittedAt)}
              {result.reason === 'timeout' && <span className="text-[var(--gold-ink)]"> · پایان به‌دلیل اتمام زمان</span>}
              {session.negativeMarking ? ' · با نمرهٔ منفی ۳/۱−' : ''}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              <StatCell label="صحیح" value={faNum(result.correct)} accent="#61D192" />
              <StatCell label="غلط" value={faNum(result.wrong)} accent="#ef9196" />
              <StatCell label="بی‌پاسخ" value={faNum(result.unanswered)} accent="#9a9a9a" />
              <StatCell label="زمان مصرفی" value={fmtSeconds(result.timeSpent)} accent="#e0b45c" />
              <StatCell
                label="امتیاز"
                value={faNum(result.score)}
                accent={session.negativeMarking ? '#c9bdf0' : undefined}
              />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <ScoreRing percentage={result.percentage} label={isExam ? 'درصد نهایی' : 'دقت'} accent={ringAccent} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── تفکیک درس ── */}
        <section className="rounded-[2rem] border border-white/8 bg-[var(--surface)] p-5 md:p-6" aria-label="تفکیک درس‌ها">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            <Icon name="chart" className="h-4 w-4 text-[var(--green-ink)]" />
            تفکیک درس‌ها
          </h3>
          <SubjectBars subjects={result.subjects} />

          {(result.strongest || result.weakest) && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-white/8 pt-4">
              {result.strongest && (
                <span className="flex items-center gap-1.5 rounded-full bg-[#61D192]/12 px-3.5 py-2 text-xs text-[var(--green-soft-ink)]">
                  <Icon name="check" className="h-3.5 w-3.5" />
                  قوی‌ترین: {result.strongest.subjectName} ({toFa(result.strongest.percent)}٪)
                </span>
              )}
              {result.weakest && (
                <span className="flex items-center gap-1.5 rounded-full bg-[#e26d6d]/12 px-3.5 py-2 text-xs text-[var(--red-ink)]">
                  <Icon name="x" className="h-3.5 w-3.5" />
                  ضعیف‌ترین: {result.weakest.subjectName} ({toFa(result.weakest.percent)}٪)
                </span>
              )}
            </div>
          )}
        </section>

        {/* ── تفکیک مبحث‌ها ── */}
        <section className="rounded-[2rem] border border-white/8 bg-[var(--surface)] p-5 md:p-6" aria-label="تفکیک مبحث‌ها">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            <Icon name="layers" className="h-4 w-4 text-[var(--purple-ink)]" />
            مباحث این سشن
          </h3>
          {result.topics.length === 0 ? (
            <p className="text-xs text-[var(--faint)]">مبحثی ثبت نشده است.</p>
          ) : (
            <ul className="space-y-3">
              {result.topics.slice(0, 6).map((entry) => (
                <li key={`${entry.subjectId}-${entry.topic}-${entry.subtopic ?? ''}`}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-[var(--muted)]">
                      {entry.topic}
                      {entry.subtopic ? ` › ${entry.subtopic}` : ''}
                    </span>
                    <span className={entry.percent >= 50 ? 'text-[var(--green-soft-ink)]' : 'text-[var(--red-ink)]'}>
                      {toFa(entry.percent)}٪
                    </span>
                  </div>
                  <span className="tb-bar block">
                    <span
                      className="tb-bar__fill block"
                      style={{ width: `${Math.max(entry.percent, 2)}%`, background: entry.percent >= 50 ? '#937fcd' : '#e26d6d' }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[11px] text-[var(--faint)]">
            میانگین زمان هر سؤال: {fmtSeconds(result.avgTimeSec)}
          </p>
        </section>
      </div>

      {/* ── بعدش چه تست‌هایی بزنم؟ ── */}
      <section aria-label="بعدش چه تست‌هایی بزنم؟">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          <Icon name="spark" className="h-4 w-4 text-[var(--green-ink)]" />
          بعدش چه تست‌هایی بزنم؟
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {suggestions.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={item.onClick}
              className="group flex cursor-pointer items-start gap-3 rounded-[1.5rem] border border-white/8 bg-[var(--surface)] p-4 text-right transition-all hover:-translate-y-0.5 hover:border-white/16"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
                style={{ background: `${item.accent}14`, color: item.accent }}
              >
                <Icon name={item.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <strong className="block text-[13px] [font-family:'Doran','Vazir',Tahoma,sans-serif]">{item.title}</strong>
                <span className="mt-1 block text-[11.5px] leading-5 text-[var(--faint)]">{item.note}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── اکشن‌ها ── */}
      <div className="flex flex-wrap justify-center gap-2 pb-4">
        <button
          type="button"
          onClick={() => onReview(session)}
          className="flex cursor-pointer items-center gap-2 rounded-2xl bg-[var(--purple-bright)] px-6 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5"
        >
          <Icon name="eye" className="h-4 w-4" />
          مرور سؤال به سؤال
        </button>
        {onRetake && (
          <button
            type="button"
            onClick={() => onRetake(session)}
            className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-6 py-3 text-sm transition-colors hover:bg-white/12"
          >
            <Icon name="refresh" className="h-4 w-4" />
            سشن جدید با همین ترکیب
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer rounded-2xl bg-white/6 px-6 py-3 text-sm transition-colors hover:bg-white/12"
        >
          بازگشت
        </button>
      </div>
    </div>
  );
}
