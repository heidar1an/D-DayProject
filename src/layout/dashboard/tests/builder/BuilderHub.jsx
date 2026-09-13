/*
 * BuilderHub — ورود «آزمون‌ساز شخصی». دو مسیر به یک موتور مشترک وصل‌اند:
 *   Quick Build  → درس + تعداد + زمان؛ بقیهٔ تنظیمات هوشمندانه پیش‌فرض می‌شود
 *   Advanced     → ویزارد کامل ۵ مرحله‌ای
 * به‌علاوه پریست‌های هوشمند (هرکدام Configuration واقعی دارند) و میان‌بر «آزمون‌های من».
 */
import { useState } from 'react';
import { SMART_PRESETS } from '../../../../services/examBuilder/presets';
import { Icon, SectionCard, faNum, toFa } from './builderShared';

const QUICK_COUNTS = [10, 15, 20, 30];
const QUICK_TIMES = [
  { id: 'suggested', label: 'پیشنهادی' },
  { id: 15, label: '۱۵ دقیقه' },
  { id: 30, label: '۳۰ دقیقه' },
  { id: 60, label: '۶۰ دقیقه' },
];

export default function BuilderHub({ subjects, onQuickBuild, onPreset, onAdvanced, onMyExams, savedExamCount }) {
  const [subjectIds, setSubjectIds] = useState([]);
  const [count, setCount] = useState(20);
  const [time, setTime] = useState('suggested');

  const toggleSubject = (subjectId) =>
    setSubjectIds((prev) => (prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]));

  const availableSubjects = (subjects ?? []).filter((subject) => subject.questionCount > 0);

  return (
    <div className="ex-enter space-y-5">
      {/* سربرگ */}
      <section className="rounded-[2.5rem] border border-white/8 bg-[#242426] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#61D192] [font-family:'Doran',Tahoma,sans-serif] md:text-3xl">
              آزمون‌ساز شخصی
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-[#aaa]">
              آزمونی متناسب با چیزی که امروز می‌خواهی تمرین کنی بساز؛ از بانک تست تپش، دقیقاً به اندازهٔ نیازت.
            </p>
          </div>
          <button
            type="button"
            onClick={onMyExams}
            className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-2.5 text-xs text-[#ccc] transition-colors hover:bg-white/12 hover:text-white"
          >
            <Icon name="card" className="h-4 w-4 text-[#937fcd]" />
            آزمون‌های من
            {savedExamCount > 0 && (
              <span className="rounded-full bg-[#937fcd]/20 px-2 py-0.5 text-[10px] text-[#cfc4f2]">{toFa(savedExamCount)}</span>
            )}
          </button>
        </div>
      </section>

      {/* مسیر سریع */}
      <SectionCard
        icon="bolt"
        accent="#61D192"
        title="آزمون سریع"
        hint="فقط سه انتخاب؛ بقیه را سیستم هوشمندانه پیش‌فرض می‌گذارد."
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[11px] text-[#8a8a8a]">درس (اختیاری — خالی = کل بانک)</p>
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
                      ? { borderColor: `${subject.accent}80`, background: `${subject.accent}1a`, color: '#fff' }
                      : { borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#aaa' }
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
              <p className="mb-2 text-[11px] text-[#8a8a8a]">تعداد تست</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_COUNTS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCount(option)}
                    aria-pressed={count === option}
                    className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs transition-colors ${
                      count === option ? 'bg-[#61D192] font-bold text-[#12271a]' : 'bg-white/6 text-[#bbb] hover:bg-white/12'
                    }`}
                  >
                    {toFa(option)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] text-[#8a8a8a]">زمان</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TIMES.map((option) => (
                  <button
                    key={String(option.id)}
                    type="button"
                    onClick={() => setTime(option.id)}
                    aria-pressed={time === option.id}
                    className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs transition-colors ${
                      time === option.id ? 'bg-[#61D192] font-bold text-[#12271a]' : 'bg-white/6 text-[#bbb] hover:bg-white/12'
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
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#61D192] py-3.5 text-sm font-bold text-[#12271a] transition-all hover:-translate-y-0.5 hover:bg-[#7ee0ac] sm:w-auto sm:px-10"
          >
            <Icon name="play" className="h-4 w-4" />
            ساخت آزمون
          </button>
        </div>
      </SectionCard>

      {/* پریست‌های هوشمند */}
      <section aria-label="پریست‌های هوشمند">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold [font-family:'Doran',Tahoma,sans-serif]">
          <Icon name="spark" className="h-4 w-4 text-[#937fcd]" />
          یا یکی از این مسیرهای آماده را برو
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SMART_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPreset(preset)}
              className="group flex cursor-pointer items-start gap-3 rounded-[1.5rem] border border-white/8 bg-[#242426] p-4 text-right transition-all hover:-translate-y-0.5 hover:border-white/16"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: `${preset.accent}14`, color: preset.accent }}>
                <Icon name={preset.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <strong className="block text-[13px] [font-family:'Doran',Tahoma,sans-serif]">{preset.label}</strong>
                <span className="mt-1 block text-[11.5px] leading-5 text-[#9a9a9a]">{preset.description}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* مسیر پیشرفته */}
      <button
        type="button"
        onClick={onAdvanced}
        className="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-[2rem] border border-[#937fcd]/30 bg-[#937fcd]/[0.06] p-5 text-right transition-all hover:-translate-y-0.5 hover:border-[#937fcd]/50 md:p-6"
      >
        <span className="flex items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#937fcd]/15 text-[#937fcd]">
            <Icon name="layers" className="h-5.5 w-5.5" />
          </span>
          <span>
            <strong className="block text-[14.5px] [font-family:'Doran',Tahoma,sans-serif]">سازندهٔ پیشرفته — کنترل کامل</strong>
            <span className="mt-1 block text-[12px] leading-6 text-[#9a9a9a]">
              انتخاب درس به درس و مبحث به مبحث، توزیع سطح سختی، سهمیهٔ اشتباهات قبلی، فیلترهای پیشرفته و Blueprint دقیق قبل از ساخت
              — {faNum(5)} مرحله، همه‌چیز زیر دست تو.
            </span>
          </span>
        </span>
        <Icon name="chevron" className="h-5 w-5 shrink-0 -rotate-90 text-[#937fcd] transition-transform group-hover:-translate-x-1" />
      </button>
    </div>
  );
}
