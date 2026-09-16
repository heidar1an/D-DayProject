/*
 * SettingsView — تنظیمات یادگیری فلش‌کارت.
 * محدودیت‌های روزانه، زمان‌های مرور و پیکربندی الگوریتم (Override کاربر روی موتور)،
 * نمایش منبع، میانبرهای کیبورد و خروجی JSON.
 * هیچ مقداری Hard-Code در UI نیست؛ پیش‌فرض‌ها از موتور می‌آیند.
 */
import { useEffect, useState } from 'react';
import { fetchSettings, updateSettings, trackEvent } from '../../../services/flashcards/flashcardService';
import { ALGORITHM_VERSION } from '../../../services/flashcards/spacedRepetition';
import { Icon, Skeleton, toFa } from './flashcardShared';

function NumberField({ id, label, hint, value, min = 1, max = 999, onChange }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <label htmlFor={id} className="block text-sm">{label}</label>
          {hint && <span className="mt-0.5 block text-[11px] text-[var(--ghost)]">{hint}</span>}
        </div>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))}
          className="w-20 shrink-0 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-center text-sm tabular-nums outline-none focus:border-[#5b8cc7]/50"
        />
      </div>
    </div>
  );
}

function ToggleField({ id, label, hint, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3.5">
      <div>
        <label htmlFor={id} className="block text-sm">{label}</label>
        {hint && <span className="mt-0.5 block text-[11px] text-[var(--ghost)]">{hint}</span>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${checked ? 'bg-[var(--green-bright)]' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-[right] duration-200 ${checked ? 'right-0.5' : 'right-[1.375rem]'}`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

export default function SettingsView({ userData, onNotify, reloadKey = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchSettings(userData)
      .then((payload) => {
        if (alive) {
          setData(payload);
          setLoading(false);
        }
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userData, reloadKey]);

  if (loading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-40 rounded-[2rem]" />
      </div>
    );
  }

  const { settings, algorithmDefaults } = data;
  const algo = { ...algorithmDefaults, ...settings.algorithmConfig };

  const save = async (patch, message = 'ذخیره شد.') => {
    const next = await updateSettings(userData, patch);
    setData((prev) => ({ ...prev, settings: next }));
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
    onNotify?.(message);
  };

  const handleExport = () => {
    trackEvent('settings_export');
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), settings, algorithmVersion: ALGORITHM_VERSION }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'tapesh-flashcards.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {savedFlash && (
        <p className="rounded-2xl bg-[#77b787]/12 px-4 py-3 text-center text-xs text-[var(--green-soft-ink)]" role="status">
          تنظیمات ذخیره شد.
        </p>
      )}

      {/* محدودیت‌های روزانه */}
      <section aria-label="محدودیت‌های روزانه" className="space-y-3">
        <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">روال روزانه</h2>
        <NumberField
          id="set-new-per-day"
          label="کارت جدید روزانه"
          hint="چند کارت نو در هر روز وارد مرور شود"
          value={settings.newCardsPerDay}
          min={5}
          max={200}
          onChange={(value) => save({ newCardsPerDay: value })}
        />
        <NumberField
          id="set-max-reviews"
          label="حداکثر مرور روزانه"
          hint="سقف مرورها برای جلوگیری از خستگی"
          value={settings.maxReviewsPerDay}
          min={20}
          max={500}
          onChange={(value) => save({ maxReviewsPerDay: value })}
        />
      </section>

      {/* الگوریتم */}
      <section aria-label="الگوریتم مرور" className="space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">الگوریتم فاصله‌گذاری</h2>
          <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] text-[var(--ghost)]" dir="ltr">{ALGORITHM_VERSION}</span>
        </header>
        <p className="text-[11px] leading-5 text-[var(--ghost)]">
          این مقادیر مستقیماً موتور محاسبهٔ مرور را تنظیم می‌کنند و ممکن است در آینده با الگوریتم‌های بهتر (مثل FSRS) جایگزین شوند.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <NumberField
            id="set-graduating"
            label="مرور اول پس از یادگیری (روز)"
            value={Math.round(algo.graduatingIntervalDays)}
            min={1}
            max={30}
            onChange={(value) => save({ algorithmConfig: { ...settings.algorithmConfig, graduatingIntervalDays: value } })}
          />
          <NumberField
            id="set-easy"
            label="مرور اول برای «آسان» (روز)"
            value={Math.round(algo.easyIntervalDays)}
            min={2}
            max={60}
            onChange={(value) => save({ algorithmConfig: { ...settings.algorithmConfig, easyIntervalDays: value } })}
          />
          <NumberField
            id="set-hard"
            label="ضریب «سخت»"
            hint="فاصله قبلی در این ضریب ضرب می‌شود (۱ تا ۲)"
            value={Math.round(algo.hardFactor * 10) / 10}
            min={1}
            max={2}
            onChange={(value) => save({ algorithmConfig: { ...settings.algorithmConfig, hardFactor: value } })}
          />
          <NumberField
            id="set-max-interval"
            label="حداکثر فاصله (روز)"
            value={Math.round(algo.maxIntervalDays)}
            min={30}
            max={730}
            onChange={(value) => save({ algorithmConfig: { ...settings.algorithmConfig, maxIntervalDays: value } })}
          />
        </div>

        <div className="rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3.5">
          <p className="text-sm">گام‌های یادگیری</p>
          <p className="mt-1 text-[11px] text-[var(--ghost)]">
            کارت نو بعد از هر ارزیابی به این گام‌ها می‌رود: {algo.learningStepsMinutes.map((minutes) => toFa(minutes)).join(' → ')} دقیقه
          </p>
        </div>
      </section>

      {/* نمایش و تجربه */}
      <section aria-label="نمایش و تجربه" className="space-y-3">
        <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">تجربهٔ مرور</h2>
        <ToggleField
          id="set-show-source"
          label="نمایش منبع کارت"
          hint="منبع درسنامه/سؤال زیر کارت دیده شود"
          checked={settings.showSource}
          onChange={(value) => save({ showSource: value })}
        />
        <ToggleField
          id="set-shortcuts"
          label="میانبرهای صفحه‌کلید"
          hint="در مرور با ۱ تا ۴ ارزیابی کن"
          checked={settings.keyboardShortcuts}
          onChange={(value) => save({ keyboardShortcuts: value })}
        />
        <ToggleField
          id="set-audio"
          label="پخش خودکار صدا"
          hint="برای کارت‌های صدا دار (به‌زودی)"
          checked={settings.autoPlayAudio}
          onChange={(value) => save({ autoPlayAudio: value })}
        />
      </section>

      {/* داده */}
      <section aria-label="داده‌ها" className="space-y-3">
        <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">داده‌ها</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3.5">
          <div>
            <p className="text-sm">خروجی تنظیمات</p>
            <p className="mt-0.5 text-[11px] text-[var(--ghost)]">قالب JSON — ورودی Anki-compatible در نقشهٔ راه است</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-white/8 px-4 py-2 text-xs transition-colors hover:bg-white/15"
          >
            <Icon name="archive" className="h-3.5 w-3.5" />
            دانلود JSON
          </button>
        </div>
      </section>
    </div>
  );
}
