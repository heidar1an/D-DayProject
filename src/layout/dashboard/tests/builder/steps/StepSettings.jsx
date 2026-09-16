/*
 * Step 3 — تنظیم آزمون: تعداد (با دسترس‌پذیری زنده)، سختی + توزیع، وضعیت تست‌ها
 * با سهمیه («حداقل ۱۰ از اشتباهات قبلی»)، زمان (پیشنهادی از آمار واقعی مخزن)،
 * حالت اجرا، نمایش پاسخ، نمرهٔ منفی و فیلترهای پیشرفته در آکاردئون جمع‌وجور.
 */
import { BANK_YEARS, QUESTION_TYPES, SOURCES } from '../../../../../services/testBank/testBankService';
import { durationFromAvg } from '../../../../../services/examBuilder/selectionEngine';
import { MODE_LABELS, MODE_PRESETS } from '../../../../../services/examBuilder/presets';
import DifficultyDial from '../DifficultyDial';
import { Icon, SectionCard, faNum, toFa } from '../builderShared';

const COUNT_CHIPS = [5, 10, 15, 20, 30, 40, 50, 100];
const MINUTE_CHIPS = [10, 15, 20, 30, 45, 60, 90];

function ModeButton({ mode, active, note, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded-2xl border p-3.5 text-right transition-all ${
        active ? 'border-[#61D192]/60 bg-[#61D192]/[0.07]' : 'border-white/8 bg-white/[0.02] hover:border-white/20'
      }`}
    >
      <strong className="block text-[12.5px] [font-family:'Doran','Vazir',Tahoma,sans-serif]">{MODE_LABELS[mode]}</strong>
      <span className="mt-1 block text-[10.5px] leading-5 text-[var(--faint)]">{note}</span>
    </button>
  );
}

export default function StepSettings({ draft, update, availability }) {
  const availableTotal = availability?.total ?? null;
  const suggestedMinutes = availability?.avgTimeSec ? durationFromAvg(draft.questionCount, availability.avgTimeSec) : null;
  const overRequest = availableTotal !== null && draft.questionCount > availableTotal;

  const setMode = (mode) => {
    const preset = MODE_PRESETS[mode];
    update({
      mode,
      durationMode: preset.durationMode,
      negativeMarking: preset.negative,
    });
  };

  const setQuota = (status, min) => {
    const available = availability?.byStatus?.[status] ?? 0;
    const quotas = draft.statuses.quotas.filter((quota) => quota.status !== status);
    if (min > 0) quotas.push({ status, min: Math.min(min, available || min) });
    update({ statuses: { ...draft.statuses, quotas } });
  };

  const quotaOf = (status) => draft.statuses.quotas.find((quota) => quota.status === status)?.min ?? 0;

  return (
    <div className="ex-enter grid gap-4 xl:grid-cols-2">
      {/* تعداد سؤال */}
      <SectionCard icon="grid" accent="#61D192" title="چند تست می‌خواهی؟">
        <div className="flex flex-wrap gap-1.5">
          {COUNT_CHIPS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => update({ questionCount: count })}
              aria-pressed={draft.questionCount === count}
              className={`cursor-pointer rounded-xl px-4 py-2 text-sm transition-colors ${
                draft.questionCount === count ? 'bg-[var(--green-vivid)] font-bold text-[#12271a]' : 'bg-white/6 text-[var(--muted)] hover:bg-white/12'
              }`}
            >
              {toFa(count)}
            </button>
          ))}
          <input
            type="number"
            min={1}
            max={999}
            value={draft.questionCount}
            onChange={(event) => update({ questionCount: Math.max(1, Number(event.target.value) || 1) })}
            aria-label="تعداد دلخواه سؤال"
            className="w-20 rounded-xl border border-white/10 bg-[var(--surface-soft)] px-2 py-2 text-center text-sm text-white focus:border-[#61D192]/50 focus:outline-none"
          />
        </div>

        <p className="mt-3.5 rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-[11.5px] leading-6 text-[var(--faint)]" aria-live="polite">
          {availability === null ? (
            'در حال بررسی مخزن…'
          ) : availableTotal === 0 ? (
            <span className="text-[var(--red-ink)]">با این فیلترها تستی در دسترس نیست؛ دامنه یا فیلترها را بازتر کن.</span>
          ) : (
            <>
              از {faNum(availableTotal)} تستِ در دسترس این دامنه،{' '}
              <strong className="text-[var(--green-ink)]">{faNum(Math.min(draft.questionCount, availableTotal))} تست</strong> برای آزمون تو انتخاب می‌شود.
              {overRequest && (
                <span className="mt-1 block text-[var(--gold-ink)]">
                  درخواستت بیشتر از مخزن است — تعداد را کم کن یا مباحث بیشتری اضافه کن.
                </span>
              )}
            </>
          )}
        </p>
      </SectionCard>

      {/* سطح سختی */}
      <SectionCard icon="chart" accent="#e0b45c" title="سطح سختی" hint="تعداد واقعی هر سطح کنارش نوشته شده؛ ترکیبی با توزیع دلخواه.">
        <DifficultyDial
          difficulty={draft.difficulty}
          onChange={(difficulty) => update({ difficulty })}
          availability={availability}
        />
      </SectionCard>

      {/* وضعیت تست‌ها */}
      <SectionCard icon="refresh" accent="#5b8cc7" title="از چه تست‌هایی ساخته شود؟" hint="سهمیه بده؛ مثلاً «حداقل ۱۰ تست از اشتباهات قبلی من».">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="وضعیت پایه">
          {[
            { id: 'any', label: 'هر تستی' },
            { id: 'unsolved', label: 'فقط حل‌نشده' },
            { id: 'solved', label: 'فقط حل‌شده' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => update({ statuses: { ...draft.statuses, base: option.id } })}
              aria-pressed={draft.statuses.base === option.id}
              className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs transition-colors ${
                draft.statuses.base === option.id ? 'bg-[var(--blue-bright)] font-bold text-white' : 'bg-white/6 text-[var(--muted)] hover:bg-white/12'
              }`}
            >
              {option.label}
              {option.id !== 'any' && availability && (
                <span className="ms-1.5 text-[10px] opacity-75">({toFa(availability.byStatus[option.id] ?? 0)})</span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2.5 border-t border-white/8 pt-4">
          {[
            { status: 'wrong', label: 'حداقل تست از اشتباهات قبلی من', accent: '#e26d6d' },
            { status: 'bookmarked', label: 'حداقل تست از نشان‌شده‌های من', accent: '#ef9196' },
          ].map((quota) => {
            const available = availability?.byStatus?.[quota.status] ?? 0;
            const value = quotaOf(quota.status);
            return (
              <div key={quota.status} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3.5 py-2.5">
                <label htmlFor={`quota-${quota.status}`} className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: quota.accent }} aria-hidden="true" />
                  {quota.label}
                  <span className="text-[10px] text-[var(--faint)]">({toFa(available)} موجود)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuota(quota.status, Math.max(0, value - 5))}
                    aria-label="کاهش سهمیه"
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg bg-white/6 transition-colors hover:bg-white/12"
                  >
                    −
                  </button>
                  <input
                    id={`quota-${quota.status}`}
                    type="number"
                    min={0}
                    max={available}
                    value={value}
                    disabled={!available}
                    onChange={(event) => setQuota(quota.status, Math.max(0, Number(event.target.value) || 0))}
                    className="h-7 w-14 rounded-lg border border-white/10 bg-[var(--surface-soft)] text-center text-xs text-white focus:border-[#61D192]/50 focus:outline-none disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={() => setQuota(quota.status, value + 5)}
                    disabled={!available}
                    aria-label="افزایش سهمیه"
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg bg-white/6 transition-colors hover:bg-white/12 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
          {!draft.statuses.quotas.length && (
            <p className="text-[10.5px] text-[var(--ghost)]">بدون سهمیه — باقیِ ترکیب آزادانه از کل دامنه انتخاب می‌شود.</p>
          )}
        </div>
      </SectionCard>

      {/* زمان */}
      <SectionCard icon="timer" accent="#b99a86" title="زمان آزمون">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'suggested', label: suggestedMinutes ? `پیشنهادی (${toFa(suggestedMinutes)} دقیقه)` : 'زمان پیشنهادی' },
            { id: 'none', label: 'بدون محدودیت' },
            { id: 'custom', label: 'زمان دستی' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => update({ durationMode: option.id })}
              aria-pressed={draft.durationMode === option.id}
              className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs transition-colors ${
                draft.durationMode === option.id ? 'bg-[var(--copper)] font-bold text-white' : 'bg-white/6 text-[var(--muted)] hover:bg-white/12'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {draft.durationMode === 'custom' && (
          <div className="ex-enter mt-3 flex flex-wrap gap-1.5">
            {MINUTE_CHIPS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => update({ durationMinutes: minutes })}
                aria-pressed={draft.durationMinutes === minutes}
                className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs transition-colors ${
                  draft.durationMinutes === minutes ? 'bg-[var(--copper)] font-bold text-white' : 'bg-white/6 text-[var(--muted)] hover:bg-white/12'
                }`}
              >
                {toFa(minutes)} دقیقه
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] leading-5 text-[var(--faint)]">
          {suggestedMinutes
            ? `پیشنهاد سیستم از میانگین زمان واقعی پاسخ‌دهندگان به همین تست‌ها حساب می‌شود.`
            : 'با انتخاب دامنه، زمان پیشنهادی بر اساس آمار واقعی مخزن محاسبه می‌شود.'}
        </p>
      </SectionCard>

      {/* حالت اجرا + نمایش پاسخ */}
      <SectionCard icon="play" accent="#937fcd" title="چطور اجرا شود؟">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {Object.keys(MODE_PRESETS).map((mode) => (
            <ModeButton key={mode} mode={mode} active={draft.mode === mode} note={MODE_PRESETS[mode].note} onClick={() => setMode(mode)} />
          ))}
        </div>

        <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
          {(draft.mode === 'practice' || draft.mode === 'review') && (
            <div>
              <p className="mb-2 text-[11px] text-[var(--faint)]">نمایش پاسخ در حین تمرین</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'full', label: 'پاسخ + توضیح تشریحی' },
                  { id: 'answer-only', label: 'فقط گزینهٔ صحیح' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => update({ feedback: option.id })}
                    aria-pressed={draft.feedback === option.id}
                    className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs transition-colors ${
                      draft.feedback === option.id ? 'bg-[var(--purple-bright)] font-bold text-white' : 'bg-white/6 text-[var(--muted)] hover:bg-white/12'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(draft.mode === 'exam' || draft.mode === 'simulation') && (
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3.5 py-3">
              <span>
                <strong className="block text-[12.5px]">نمرهٔ منفی ۳/۱−</strong>
                <span className="mt-0.5 block text-[10.5px] text-[var(--faint)]">سبک آزمون وزارت بهداشت؛ هر ۴ غلط، یک صحیح کم می‌کند.</span>
              </span>
              <input
                type="checkbox"
                checked={draft.negativeMarking}
                onChange={(event) => update({ negativeMarking: event.target.checked })}
                className="h-5 w-5 cursor-pointer accent-[var(--purple-ink)]"
              />
            </label>
          )}
        </div>
      </SectionCard>

      {/* فیلترهای پیشرفته — آکاردئون */}
      <details className="rounded-[2rem] border border-white/8 bg-[var(--surface)] p-5 xl:col-span-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
          <span className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#77b787]/14 text-[var(--green-ink)]">
              <Icon name="filter" className="h-4.5 w-4.5" />
            </span>
            <span>
              <strong className="text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">فیلترهای پیشرفته</strong>
              <span className="mt-0.5 block text-[11px] text-[var(--faint)]">نوع سؤال، منبع، سال و جستجو — اختیاری</span>
            </span>
          </span>
          <Icon name="chevron" className="h-4 w-4 text-[var(--faint)]" />
        </summary>

        <div className="mt-5 grid gap-5 border-t border-white/8 pt-5 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-[11px] font-bold text-[var(--muted)]">نوع سؤال</legend>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(QUESTION_TYPES).map(([type, meta]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    update({
                      advanced: {
                        ...draft.advanced,
                        types: draft.advanced.types.includes(type)
                          ? draft.advanced.types.filter((item) => item !== type)
                          : [...draft.advanced.types, type],
                      },
                    })
                  }
                  aria-pressed={draft.advanced.types.includes(type)}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                    draft.advanced.types.includes(type)
                      ? 'border-[#77b787]/50 bg-[#77b787]/12 text-[var(--green-ink)]'
                      : 'border-white/10 bg-white/[0.03] text-[var(--muted)] hover:border-white/25'
                  }`}
                >
                  {meta.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[11px] font-bold text-[var(--muted)]">منبع</legend>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SOURCES).map(([source, meta]) => (
                <button
                  key={source}
                  type="button"
                  onClick={() =>
                    update({
                      advanced: {
                        ...draft.advanced,
                        sources: draft.advanced.sources.includes(source)
                          ? draft.advanced.sources.filter((item) => item !== source)
                          : [...draft.advanced.sources, source],
                      },
                    })
                  }
                  aria-pressed={draft.advanced.sources.includes(source)}
                  className="cursor-pointer rounded-full border px-3 py-1.5 text-[11px] transition-colors"
                  style={
                    draft.advanced.sources.includes(source)
                      ? { borderColor: `${meta.accent}66`, background: `${meta.accent}14`, color: meta.accent }
                      : { borderColor: 'rgb(var(--line-rgb) / 0.1)', color: 'var(--muted)' }
                  }
                >
                  {meta.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[11px] font-bold text-[var(--muted)]">بازهٔ سال</legend>
            <div className="flex items-center gap-2">
              {[
                { key: 'yearFrom', label: 'از' },
                { key: 'yearTo', label: 'تا' },
              ].map((bound) => (
                <select
                  key={bound.key}
                  value={draft.advanced[bound.key] ?? ''}
                  onChange={(event) =>
                    update({
                      advanced: { ...draft.advanced, [bound.key]: event.target.value ? Number(event.target.value) : null },
                    })
                  }
                  aria-label={`${bound.label} سال`}
                  className="w-full cursor-pointer rounded-xl border border-white/10 bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-white focus:border-[#61D192]/50 focus:outline-none"
                >
                  <option value="">بدون محدودیت</option>
                  {BANK_YEARS.map((year) => (
                    <option key={year} value={year}>
                      {toFa(year)}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[11px] font-bold text-[var(--muted)]">جستجو در متن سؤال</legend>
            <input
              type="search"
              value={draft.advanced.search ?? ''}
              onChange={(event) => update({ advanced: { ...draft.advanced, search: event.target.value } })}
              placeholder="مثلاً «پتانسیل عمل»"
              className="w-full rounded-xl border border-white/10 bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--ghost)] focus:border-[#61D192]/50 focus:outline-none"
            />
          </fieldset>
        </div>
      </details>
    </div>
  );
}
