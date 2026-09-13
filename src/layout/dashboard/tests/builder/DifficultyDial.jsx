/*
 * DifficultyDial — انتخاب سطح سختی: چهار سطح + «ترکیبی» با توزیع درصدی قابل تنظیم
 * (اسلایدر). تعداد واقعی هر سطح از Availability بانک می‌آید تا انتخاب‌ها زمینی باشند.
 */
import { DIFFICULTY_LABELS, Icon, toFa } from './builderShared';

const LEVELS = ['easy', 'medium', 'hard', 'very_hard'];

const LEVEL_ACCENTS = { easy: '#77b787', medium: '#e0b45c', hard: '#ef9196', very_hard: '#e26d6d' };

const DISTRIBUTION_PRESETS = [
  { id: 'quick-review', label: 'مرور سریع', distribution: { easy: 40, medium: 50, hard: 10, very_hard: 0 } },
  { id: 'standard', label: 'تمرین استاندارد', distribution: { easy: 20, medium: 55, hard: 25, very_hard: 0 } },
  { id: 'serious', label: 'آزمون جدی', distribution: { easy: 10, medium: 40, hard: 40, very_hard: 10 } },
  { id: 'challenge', label: 'چالش سخت', distribution: { easy: 0, medium: 15, hard: 50, very_hard: 35 } },
];

const normalize = (distribution) => {
  const sum = LEVELS.reduce((acc, level) => acc + (distribution[level] || 0), 0);
  if (!sum) return { easy: 25, medium: 50, hard: 25, very_hard: 0 };
  return Object.fromEntries(LEVELS.map((level) => [level, Math.round(((distribution[level] || 0) / sum) * 100)]));
};

export default function DifficultyDial({ difficulty, onChange, availability }) {
  const isMixed = difficulty.mode === 'mixed';
  const normalized = normalize(difficulty.distribution);

  const setLevel = (level) => onChange({ mode: 'single', level, distribution: difficulty.distribution });
  const setMixed = () => onChange({ mode: 'mixed', level: null, distribution: difficulty.distribution });
  const setDistribution = (distribution) => onChange({ mode: 'mixed', level: null, distribution });

  return (
    <div className="space-y-4">
      {/* انتخاب سطح / ترکیبی */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="سطح سختی آزمون">
        {LEVELS.map((level) => {
          const count = availability?.byDifficulty?.[level];
          const empty = count === 0;
          return (
            <button
              key={level}
              type="button"
              disabled={empty}
              onClick={() => setLevel(level)}
              aria-pressed={!isMixed && difficulty.level === level}
              className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs transition-colors disabled:cursor-default disabled:opacity-35 ${
                !isMixed && difficulty.level === level
                  ? 'font-bold text-white'
                  : 'bg-white/6 text-[#aaa] hover:bg-white/12 hover:text-white'
              }`}
              style={!isMixed && difficulty.level === level ? { background: LEVEL_ACCENTS[level] } : undefined}
            >
              {DIFFICULTY_LABELS[level]}
              {count != null && <span className="text-[10px] opacity-75">({toFa(count)})</span>}
            </button>
          );
        })}
        <button
          type="button"
          onClick={setMixed}
          aria-pressed={isMixed}
          className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs transition-colors ${
            isMixed ? 'bg-[#937fcd] font-bold text-white' : 'bg-white/6 text-[#aaa] hover:bg-white/12 hover:text-white'
          }`}
        >
          <Icon name="layers" className="h-3.5 w-3.5" />
          ترکیبی
        </button>
      </div>

      {/* توزیع ترکیبی */}
      {isMixed && (
        <div className="ex-enter space-y-4 rounded-2xl border border-[#937fcd]/25 bg-[#937fcd]/[0.05] p-4">
          {/* نوار ترکیب نهایی */}
          <div className="ex-dial__track" role="img" aria-label="توزیع سطح سختی">
            {LEVELS.map((level) =>
              normalized[level] > 0 ? (
                <span
                  key={level}
                  className="ex-dial__seg"
                  style={{ width: `${normalized[level]}%`, background: LEVEL_ACCENTS[level] }}
                  title={`${DIFFICULTY_LABELS[level]}: ${toFa(normalized[level])}٪`}
                />
              ) : null,
            )}
          </div>

          {LEVELS.map((level) => (
            <div key={level} className="ex-dial__row">
              <span className="flex items-center gap-1.5 text-[11.5px]" style={{ color: LEVEL_ACCENTS[level] }}>
                <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_ACCENTS[level] }} aria-hidden="true" />
                {DIFFICULTY_LABELS[level]}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={difficulty.distribution[level] ?? 0}
                onChange={(event) =>
                  setDistribution({ ...difficulty.distribution, [level]: Number(event.target.value) })
                }
                className="ex-slider"
                style={{ '--ex-accent': LEVEL_ACCENTS[level] }}
                aria-label={`سهم ${DIFFICULTY_LABELS[level]}`}
              />
              <strong className="text-center text-xs [font-variant-numeric:tabular-nums]" style={{ color: LEVEL_ACCENTS[level] }}>
                {toFa(normalized[level])}٪
              </strong>
            </div>
          ))}

          {/* پریست‌های توزیع */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-white/8 pt-3">
            <span className="text-[11px] text-[#8a8a8a]">الگوهای آماده:</span>
            {DISTRIBUTION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDistribution(preset.distribution)}
                className="cursor-pointer rounded-full bg-white/6 px-3 py-1.5 text-[11px] text-[#bbb] transition-colors hover:bg-white/12 hover:text-white"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
