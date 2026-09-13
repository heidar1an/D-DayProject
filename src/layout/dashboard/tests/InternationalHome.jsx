/*
 * صفحهٔ اصلی «آزمون‌های بین‌الملل».
 * ترتیب روایت: Hero مینیمال ← داشبورد پیشرفت ← ادامهٔ مطالعه / مرور فاصله‌دار ←
 * اشتباهات من ← مرورگر آزمون‌ها ← نوار دستاوردها (کم‌رنگ و انگیزشی).
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

/* ── Hero مینیمال با مدارهای انتزاعی ── */
function Hero({ onStart }) {
  return (
    <section className="intl-hero relative overflow-hidden rounded-[2.5rem] border border-white/8 bg-gradient-to-l from-[#282828] via-[#282828] to-[#2e2a3a] px-6 py-10 md:px-10 md:py-12" aria-labelledby="intl-hero-title">
      <div className="intl-hero-orbits" aria-hidden="true">
        <span />
        <span />
        <span />
        <i />
        <i />
      </div>

      <div className="relative max-w-xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#937fcd]/12 px-3 py-1.5 text-xs text-[#c9bdf0]">
          <Icon name="globe" className="h-3.5 w-3.5" />
          با استانداردهای جهانی پزشکی تمرین کن
        </span>
        <h1 id="intl-hero-title" className="mt-4 text-3xl leading-snug [font-family:'Doran',Tahoma,sans-serif] md:text-4xl">
          آزمون‌های بین‌الملل
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-7 text-[#a8a8a8] md:text-[15px]">
          سؤال‌های استاندارد جهانی را حل کن، تحلیل بگیر، اشتباه‌هات را بفهم و از دل همین سؤال‌ها برای خودت آزمون بساز.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onStart}
            className="cursor-pointer rounded-2xl bg-[#937fcd] px-6 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5 [font-family:'Doran',Tahoma,sans-serif]"
          >
            شروع حل سؤال
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-2 text-[11px] text-[#8a8a8a]">
            <Icon name="spark" className="h-3.5 w-3.5" />
            سؤال‌های فعلی نمونهٔ آموزشی تپش هستند
          </span>
        </div>
      </div>
    </section>
  );
}

/* ── داشبورد پیشرفت: پاسخ سریع به «کجایم؟» ── */
function ProgressDashboard({ stats, examProgress }) {
  const cells = [
    { icon: 'target', label: 'سؤال حل‌شده', value: faNum(stats.solvedQuestions) },
    { icon: 'chart', label: 'دقت پاسخ', value: `${toFa(stats.accuracy)}٪` },
    { icon: 'heart', label: 'گلچین‌شده', value: faNum(stats.bookmarked) },
    { icon: 'refresh', label: 'آمادهٔ مرور', value: faNum(stats.dueReview) },
    { icon: 'layers', label: 'مجموعهٔ شخصی', value: faNum(stats.collections) },
  ];

  return (
    <section className="rounded-[2.5rem] bg-[#282828] p-5 md:p-7" aria-label="پیشرفت بین‌المللی تو">
      <h2 className="flex items-center gap-2 text-lg [font-family:'Doran',Tahoma,sans-serif]">
        <Icon name="up" className="h-5 w-5 text-[#937fcd]" />
        پیشرفت بین‌المللی تو
      </h2>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {cells.map((cell) => (
          <div key={cell.label} className="rounded-2xl border border-white/6 bg-[#2a2a2a] p-3.5 text-center">
            <span className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-xl bg-[#937fcd]/12 text-[#c9bdf0]">
              <Icon name={cell.icon} className="h-4.5 w-4.5" />
            </span>
            <strong className="block text-xl leading-7 [font-family:'Doran',Tahoma,sans-serif]">{cell.value}</strong>
            <span className="text-[11px] text-[#8a8a8a]">{cell.label}</span>
          </div>
        ))}
      </div>

      {/* ویژوال مینیمال پیشرفت به تفکیک آزمون */}
      <div className="mt-5 space-y-3 border-t border-white/6 pt-4">
        {examProgress.map((row) => (
          <div key={row.examId} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-[#aaa]" style={{ color: row.accent }}>
              {row.shortName}
            </span>
            <ProgressBar value={row.percent} max={100} color={row.accent} height={5} className="min-w-0 flex-1" />
            <span className="shrink-0 text-[11px] tabular-nums text-[#777]">
              {toFa(row.solved)}/{toFa(row.total)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

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
          <h3 className="flex items-center gap-2 text-sm [font-family:'Doran',Tahoma,sans-serif]">
            <Icon name="play" className="h-4 w-4 text-[#c9bdf0]" />
            ادامهٔ مطالعه
          </h3>
          <strong className="mt-3 block text-base [font-family:'Doran',Tahoma,sans-serif]">{inProgress.title}</strong>
          <p className="mt-1 text-xs text-[#8a8a8a]">
            سؤال {toFa(inProgress.answeredCount + 1)} از {toFa(inProgress.totalQuestions)} · {toFa(inProgress.percent)}٪ کامل شده
          </p>
          <ProgressBar value={inProgress.percent} max={100} height={5} className="mt-3" />
          <button
            type="button"
            onClick={() => onResume(inProgress.id)}
            className="mt-4 cursor-pointer rounded-xl bg-[#937fcd] px-4 py-2.5 text-xs font-bold transition-transform hover:-translate-y-0.5"
          >
            ادامه آزمون
          </button>
        </section>
      )}

      {/* مرور فاصله‌دار */}
      {stats.dueReview > 0 && (
        <section className="rounded-[2rem] border border-[#e0b45c]/30 bg-gradient-to-l from-[#e0b45c]/[0.08] to-transparent p-5" aria-label="مرور فاصله‌دار">
          <h3 className="flex items-center gap-2 text-sm [font-family:'Doran',Tahoma,sans-serif]">
            <Icon name="clock" className="h-4 w-4 text-[#e0b45c]" />
            وقت مرور این سؤالات رسیده
          </h3>
          <strong className="mt-3 block text-2xl [font-family:'Doran',Tahoma,sans-serif]">
            {faNum(stats.dueReview)} <span className="text-sm font-normal text-[#8a8a8a]">سؤال</span>
          </strong>
          <p className="mt-1 text-xs leading-5 text-[#8a8a8a]">سؤال‌هایی که زمان دوباره دیدنشون شده؛ مرور به‌موقع یعنی ماندگاری بیشتر.</p>
          <button
            type="button"
            onClick={() => onStartReview(stats.dueQuestionIds)}
            className="mt-4 cursor-pointer rounded-xl bg-[#e0b45c]/15 px-4 py-2.5 text-xs font-bold text-[#e0b45c] transition-transform hover:-translate-y-0.5"
          >
            شروع مرور
          </button>
        </section>
      )}

      {/* اشتباهات من */}
      {stats.mistakesCount > 0 && (
        <section className="rounded-[2rem] border border-[#e26d6d]/30 bg-gradient-to-l from-[#e26d6d]/[0.08] to-transparent p-5" aria-label="اشتباهات من">
          <h3 className="flex items-center gap-2 text-sm [font-family:'Doran',Tahoma,sans-serif]">
            <Icon name="flame" className="h-4 w-4 text-[#ef9196]" />
            اشتباهات من
          </h3>
          <strong className="mt-3 block text-2xl [font-family:'Doran',Tahoma,sans-serif]">
            {faNum(stats.mistakesCount)} <span className="text-sm font-normal text-[#8a8a8a]">سؤال غلط</span>
          </strong>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stats.weakTopics.slice(0, 3).map((topic) => (
              <span key={topic.subjectId} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-[#bbb]">
                {topic.subject?.nameFa} · {toFa(topic.count)} اشتباه
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onOpenMistakes}
            className="mt-4 cursor-pointer rounded-xl bg-[#e26d6d]/15 px-4 py-2.5 text-xs font-bold text-[#ef9196] transition-transform hover:-translate-y-0.5"
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
          <h2 id="intl-explorer-title" className="text-lg [font-family:'Doran',Tahoma,sans-serif]">
            آزمون‌ها را بشناس و انتخاب کن
          </h2>
          <p className="mt-1 text-xs text-[#8a8a8a]">هر آزمون محیط حل، تحلیل و بانک سؤال خودش را دارد.</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {exams.map((exam) => (
          <button
            key={exam.id}
            type="button"
            onClick={() => onOpenExam(exam.id)}
            className="group flex cursor-pointer flex-col rounded-[2rem] border border-white/8 bg-[#282828] p-5 text-right transition-all duration-300 hover:-translate-y-1.5 hover:border-white/20 hover:bg-[#2d2d2d]"
            aria-label={`مشاهدهٔ آزمون ${exam.shortName} — ${exam.nameFa}`}
          >
            <div className="flex items-start justify-between">
              <span
                className="grid h-12 w-12 place-items-center rounded-2xl"
                style={{ background: `${exam.accent}14`, boxShadow: `inset 0 0 0 1px ${exam.accent}33` }}
              >
                <ExamGlyph glyph={exam.glyph} accent={exam.accent} className="h-6 w-6" />
              </span>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-[#8a8a8a]">{exam.level}</span>
            </div>

            <strong className="mt-4 block text-lg [font-family:'Doran',Tahoma,sans-serif]" style={{ color: exam.accent }}>
              {exam.shortName}
            </strong>
            <span className="mt-0.5 block text-[11px] leading-5 text-[#8a8a8a]" dir="ltr">
              {exam.name}
            </span>
            <span className="mt-1.5 block text-[13px] text-[#d9d9d9]">{exam.nameFa}</span>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {exam.topics?.slice(0, 3).map((topic) => (
                <span key={topic} className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-[#9a9a9a]">
                  {topic}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3.5">
              <span className="flex items-center gap-1.5 text-xs text-[#8a8a8a]">
                <Icon name="book" className="h-3.5 w-3.5" />
                {faNum(exam.questionCount)} سؤال موجود
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[#c9bdf0] transition-transform duration-300 group-hover:-translate-x-1">
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

/* ── نوار دستاوردها — کوچک، انگیزشی، اشغالگر اصلی UI نیست ── */
function AchievementsStrip({ achievements }) {
  return (
    <section aria-label="دستاوردها" className="rounded-[2rem] border border-white/6 bg-[#282828]/60 p-5">
      <h2 className="flex items-center gap-2 text-sm [font-family:'Doran',Tahoma,sans-serif]">
        <Icon name="trophy" className="h-4 w-4 text-[#e0b45c]" />
        دستاوردها
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {achievements.map((item) => {
          const percent = Math.min(100, Math.round((item.value / item.goal) * 100));
          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-3.5 ${
                item.unlocked ? 'border-[#e0b45c]/35 bg-[#e0b45c]/[0.06]' : 'border-white/6 bg-[#2a2a2a]'
              }`}
              title={item.description}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                    item.unlocked ? 'bg-[#e0b45c]/20 text-[#e0b45c]' : 'bg-white/5 text-[#777]'
                  }`}
                >
                  <Icon name={item.unlocked ? 'star' : item.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <strong className="block truncate text-xs [font-family:'Doran',Tahoma,sans-serif]">{item.title}</strong>
                  <span className="text-[10px] text-[#777]">
                    {item.unlocked ? 'کسب شد' : `${toFa(item.value)} از ${toFa(item.goal)}`}
                  </span>
                </div>
              </div>
              {!item.unlocked && <ProgressBar value={percent} max={100} color="#937fcd" height={4} className="mt-2.5" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ══════════════════════════ Home ══════════════════════════ */
export default function InternationalHome({ overview, exams, loading, onOpenExam, onStartFirstExam, onResume, onStartReview, onOpenMistakes }) {
  if (loading) {
    return (
      <div className="space-y-5" aria-hidden="true">
        <Skeleton className="h-64 rounded-[2.5rem]" />
        <Skeleton className="h-48 rounded-[2.5rem]" />
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
      <Hero onStart={onStartFirstExam} />

      {overview && <ProgressDashboard stats={overview.stats} examProgress={overview.examProgress} />}

      {overview && <ActionCards overview={overview} onResume={onResume} onStartReview={onStartReview} onOpenMistakes={onOpenMistakes} />}

      <ExamExplorer exams={exams} onOpenExam={onOpenExam} />

      {overview && <AchievementsStrip achievements={overview.achievements} />}
    </div>
  );
}
