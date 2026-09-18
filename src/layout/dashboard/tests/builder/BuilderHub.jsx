/*
 * BuilderHub — ورود «آزمون‌ساز شخصی». سربرگ هیرو هم‌ساختِ «آزمون‌های هماهنگ» (سبز پروژه)،
 * ردیف چیپ‌های مسیرهای آماده (هم‌شکل بانک تست)، ردیف دوکادرهٔ ۵۰/۵۰ «آزمون سریع +
 * آزمون‌های من» که تا انتهای فضای صفحه کشیده می‌شود. دکمهٔ «ساخت آزمون» بالای لایه،
 * در سربرگ TestBankLayer و هم‌خطِ «بازگشت به تست» نشسته (مثل نوار فلش‌کارت).
 */
import { useState } from 'react';
import { SMART_PRESETS } from '../../../../services/examBuilder/presets';
import { Icon, SectionCard, faNum, toFa } from './builderShared';
import { Skeleton, formatAgo } from '../bank/bankShared';

const QUICK_COUNTS = [10, 15, 20, 30];
const QUICK_TIMES = [
  { id: 'suggested', label: 'پیشنهادی' },
  { id: 15, label: '۱۵ دقیقه' },
  { id: 30, label: '۳۰ دقیقه' },
  { id: 60, label: '۶۰ دقیقه' },
];

/* چیپ پریست هوشمند — هم‌شکل چیپ‌های مسیر «بانک تست علوم پایه»؛
   توضیح هر مسیر در tooltip می‌ماند تا ردیف مثل بانک تست تک‌خطی و سبک بماند. */
function PresetChip({ icon, accent, label, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={description}
      className="group flex shrink-0 cursor-pointer snap-start items-center gap-2 whitespace-nowrap rounded-full border border-white/8 bg-[var(--surface)] px-4 py-2.5 text-[13px] text-[var(--muted)] transition-colors hover:border-white/20 hover:bg-[var(--surface-soft)] hover:text-white"
    >
      <Icon name={icon} className="h-4 w-4 shrink-0" style={{ color: accent }} />
      {label}
    </button>
  );
}

/* کادر «آزمون‌های من» — ردیف دومِ ردیف دوکادره؛ خلاصهٔ آخرین آزمون‌های ساخته‌شده
   با میان‌بر به نمای کامل. کلیک روی هر سطر هم به «آزمون‌های من» می‌رود. */
function MyExamsCard({ savedExams, onOpen }) {
  const loading = savedExams == null;
  const saved = savedExams ?? [];

  return (
    <section
      className="flex flex-col rounded-[2rem] border border-white/8 bg-[var(--surface)] p-5 md:p-6"
      aria-label="آزمون‌های من"
    >
      <header className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#61d192]/14 text-[var(--green-soft-ink)]">
          <Icon name="card" className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">آزمون‌های من</h3>
          <p className="mt-0.5 text-[11px] text-[var(--faint)]">
            {loading ? 'در حال بارگذاری…' : saved.length ? `${toFa(saved.length)} آزمون ساخته‌شده` : 'هنوز آزمونی نساخته‌ای'}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="space-y-2" aria-hidden="true">
          <Skeleton className="h-[4.25rem] rounded-2xl" />
          <Skeleton className="h-[4.25rem] rounded-2xl" />
        </div>
      ) : saved.length ? (
        <>
          <ul className="mb-4 space-y-2">
            {saved.slice(0, 3).map((exam) => {
              const last = exam.lastAttempt;
              return (
                <li key={exam.id}>
                  <button
                    type="button"
                    onClick={onOpen}
                    className="w-full cursor-pointer rounded-2xl border border-white/8 bg-white/[0.02] px-3.5 py-3 text-right transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[13px] font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">
                        {exam.title}
                      </span>
                      {last ? (
                        <strong
                          className="shrink-0 text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]"
                          style={{ color: last.percentage >= 60 ? '#61D192' : '#ef9196' }}
                        >
                          {toFa(last.percentage)}٪
                        </strong>
                      ) : (
                        <span className="shrink-0 rounded-full bg-white/6 px-2 py-0.5 text-[9.5px] text-[var(--faint)]">شروع‌نشده</span>
                      )}
                    </span>
                    <span className="mt-1 block text-[10.5px] text-[var(--faint)]">
                      {faNum(exam.questionCount)} سؤال · {formatAgo(exam.createdAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={onOpen}
            className="mt-auto flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-[var(--muted)] transition-colors hover:border-[#61d192]/40 hover:bg-[#61d192]/12 hover:text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]"
          >
            مشاهده همهٔ آزمون‌ها
          </button>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-8 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-[var(--faint)]">
            <Icon name="card" className="h-5 w-5" />
          </span>
          <p className="mt-2.5 text-xs leading-6 text-[var(--faint)]">
            اولین آزمونت را بساز تا اینجا با روند پیشرفتت نگهش داریم.
          </p>
        </div>
      )}
    </section>
  );
}

export default function BuilderHub({ subjects, onQuickBuild, onPreset, onMyExams, savedExams }) {
  const [subjectIds, setSubjectIds] = useState([]);
  const [count, setCount] = useState(20);
  const [time, setTime] = useState('suggested');

  const toggleSubject = (subjectId) =>
    setSubjectIds((prev) => (prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]));

  const availableSubjects = (subjects ?? []).filter((subject) => subject.questionCount > 0);

  return (
    <div className="ex-enter flex flex-1 flex-col space-y-5">
      {/* سربرگ هیرو — هم‌ساختِ هیرو «آزمون‌های هماهنگ»: چیپ + تیتر سبز ثابت + زیرنویس */}
      <header className="ex-hero dash-stagger">
        <div className="ex-hero__content">
          <span className="ex-chip">
            <i aria-hidden="true" />
            ساخت آزمون دلخواه از بانک تست تپش
          </span>
          <h1 className="ex-hero__title">آزمون‌ساز شخصی</h1>
          <p className="ex-hero__subtitle">
            آزمونی متناسب با چیزی که امروز می‌خواهی تمرین کنی بساز؛ کوتاه یا جامع، به انتخاب خودت.
          </p>
        </div>
      </header>

      {/* پریست‌های هوشمند — یک ردیف چیپ وسط‌چین، هم‌شکل مسیرهای بانک تست */}
      <section aria-label="مسیرهای آماده">
        {/* ردیف وسط‌چین؛ اگر از عرض صفحه بیشتر شد، از ابتدا اسکرول می‌شود */}
        <div className="dash-stagger overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mx-auto flex w-max gap-2.5">
            {SMART_PRESETS.map((preset) => (
              <PresetChip key={preset.id} {...preset} onClick={() => onPreset(preset)} />
            ))}
          </div>
        </div>
      </section>

      {/* ردیف دوکادره ۵۰/۵۰: آزمون سریع (راست) + آزمون‌های من (چپ) — با flex-1 تا انتهای
          فضای خالی صفحه کشیده می‌شوند؛ dash-stagger هم ورود پله‌ای دو کادر را بازی می‌کند */}
      <div className="grid flex-1 items-stretch gap-4 dash-stagger lg:grid-cols-2">
        {/* مسیر سریع */}
        <SectionCard
          icon="bolt"
          accent="#61D192"
          title="آزمون سریع"
          hint="فقط سه انتخاب؛ بقیه را سیستم هوشمندانه پیش‌فرض می‌گذارد."
          className="flex flex-col"
        >
          <div className="flex flex-1 flex-col gap-4">
            <div>
              <p className="mb-2 text-[11px] text-[var(--faint)]">درس (اختیاری — خالی = کل بانک)</p>
              <div className="flex flex-wrap gap-1.5">
                {availableSubjects.map((subject) => (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => toggleSubject(subject.id)}
                    aria-pressed={subjectIds.includes(subject.id)}
                    className="cursor-pointer rounded-full border px-3.5 py-2 text-xs transition-colors"
                    style={
                      subjectIds.includes(subject.id)
                        ? { borderColor: `${subject.accent}80`, background: `${subject.accent}1a`, color: 'var(--white)' }
                        : { borderColor: 'rgb(var(--line-rgb) / 0.1)', background: 'rgb(var(--wash-rgb) / 0.03)', color: 'var(--muted)' }
                    }
                  >
                    {subject.name}
                    <span className="ms-1.5 text-[10px] opacity-70">{toFa(subject.questionCount)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] text-[var(--faint)]">تعداد تست</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_COUNTS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setCount(option)}
                      aria-pressed={count === option}
                      className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs transition-colors ${
                        count === option ? 'bg-[var(--green-vivid)] font-bold text-[#12271a]' : 'bg-white/6 text-[var(--muted)] hover:bg-white/12'
                      }`}
                    >
                      {toFa(option)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] text-[var(--faint)]">زمان</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TIMES.map((option) => (
                    <button
                      key={String(option.id)}
                      type="button"
                      onClick={() => setTime(option.id)}
                      aria-pressed={time === option.id}
                      className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs transition-colors ${
                        time === option.id ? 'bg-[var(--green-vivid)] font-bold text-[#12271a]' : 'bg-white/6 text-[var(--muted)] hover:bg-white/12'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onQuickBuild({ subjectIds, questionCount: count, durationMode: time === 'suggested' ? 'suggested' : 'custom', durationMinutes: time === 'suggested' ? null : time })}
              className="mt-auto flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--green-vivid)] py-3.5 text-sm font-bold text-[#12271a] transition-all hover:-translate-y-0.5 hover:bg-[var(--green-vivid)] sm:w-auto sm:self-start sm:px-10"
            >
              <Icon name="play" className="h-4 w-4" />
              ساخت آزمون
            </button>
          </div>
        </SectionCard>

        {/* لیست آزمون‌های ساخته‌شده */}
        <MyExamsCard savedExams={savedExams} onOpen={onMyExams} />
      </div>
    </div>
  );
}
