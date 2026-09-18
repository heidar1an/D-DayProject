/*
 * SettingsView — تنظیمات یادگیری فلش‌کارت.
 * محدودیت‌های روزانه، زمان‌های مرور و پیکربندی الگوریتم (Override کاربر روی موتور)،
 * اندازهٔ متن، نمایش منبع، میانبرهای کیبورد و ورود داده از خروجی متنی انکی.
 * هیچ مقداری Hard-Code در UI نیست؛ پیش‌فرض‌ها از موتور می‌آیند.
 *
 * اندازهٔ متن: کل این بخش با یک پایهٔ em رندر می‌شود (style={{ fontSize }}) و
 * همهٔ سایزها بر حسب em هستند تا پلهٔ انتخابی کاربر واقعاً همه‌جا اثر بگذارد.
 */
import { useEffect, useRef, useState } from 'react';
import {
  fetchMyDecks,
  fetchSettings,
  importCards,
  parseAnkiText,
  trackEvent,
  updateSettings,
} from '../../../services/flashcards/flashcardService';
import { ALGORITHM_VERSION } from '../../../services/flashcards/spacedRepetition';
import { useAsyncData } from '../league/useAsyncData';
import { Icon, Skeleton, toFa } from './flashcardShared';

/* سه پلهٔ اندازهٔ متن بخش تنظیمات — «متوسط» خودش بزرگ‌تر از تایپ قدیمی است */
const TEXT_SIZES = [
  { id: 'medium', label: 'متوسط', px: 17 },
  { id: 'large', label: 'بزرگ', px: 19 },
  { id: 'xlarge', label: 'خیلی بزرگ', px: 21 },
];

function toLatinDigits(raw) {
  return String(raw)
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

/* فیلد عددی با استپر سفارشی بالا/پایین — جایگزین فلش‌های بومیِ ناواضون مرورگر.
 * تایپ مستقیم هم کار می‌کند؛ مقدار در هر تغییر clamp و ذخیره می‌شود. */
function NumberField({ id, label, hint, value, min = 1, max = 999, step = 1, onChange }) {
  const [draft, setDraft] = useState(String(value));
  const focusedRef = useRef(false);

  /* مقدار ذخیره‌شده فقط وقتی به ورودی تزریق می‌شود که کاربر در حال تایپ نیست */
  useEffect(() => {
    if (!focusedRef.current) setDraft(String(value));
  }, [value]);

  const clamp = (next) => Math.min(max, Math.max(min, next));
  const commit = (raw) => {
    const parsed = Number(toLatinDigits(raw));
    if (!Number.isFinite(parsed)) return;
    const snapped = step < 1 ? Number((Math.round(parsed / step) * step).toFixed(1)) : Math.round(parsed);
    onChange(clamp(snapped));
  };
  const stepBy = (direction) => commit(Number(value) + direction * step);

  return (
    <div className="rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={id} className="block text-[0.94em] font-medium text-[var(--white)]">{label}</label>
          {hint && <span className="mt-0.5 block text-[0.78em] leading-5 text-[var(--ghost)]">{hint}</span>}
        </div>
        <div className="flex shrink-0 items-stretch overflow-hidden rounded-xl border border-white/10 bg-black/40 focus-within:border-[#5b8cc7]/50">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={draft}
            onFocus={() => { focusedRef.current = true; }}
            onChange={(event) => {
              setDraft(event.target.value);
              commit(event.target.value);
            }}
            onBlur={() => {
              focusedRef.current = false;
              setDraft(String(value));
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                stepBy(1);
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                stepBy(-1);
              }
            }}
            className="w-14 bg-transparent px-2 py-2 text-center text-[0.94em] tabular-nums text-[var(--white)] outline-none"
          />
          <div className="flex flex-col border-s border-white/10">
            <button
              type="button"
              tabIndex={-1}
              aria-label="افزایش"
              onClick={() => stepBy(1)}
              className="grid w-8 flex-1 cursor-pointer place-items-center text-[var(--muted)] transition-colors hover:bg-white/10 hover:text-white"
            >
              <Icon name="chevron" className="h-3.5 w-3.5 -rotate-90" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="کاهش"
              onClick={() => stepBy(-1)}
              className="grid w-8 flex-1 cursor-pointer place-items-center border-t border-white/10 text-[var(--muted)] transition-colors hover:bg-white/10 hover:text-white"
            >
              <Icon name="chevron" className="h-3.5 w-3.5 rotate-90" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleField({ id, label, hint, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3.5">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[0.94em] font-medium text-[var(--white)]">{label}</label>
        {hint && <span className="mt-0.5 block text-[0.78em] leading-5 text-[var(--ghost)]">{hint}</span>}
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

/* ── ورود داده — خروجی متنی انکی (txt / csv / tsv) به یک مجموعه ── */
function ImportSection({ userData, onNotify }) {
  const { data: decksData } = useAsyncData(() => fetchMyDecks(userData), [userData]);
  const [deckId, setDeckId] = useState('');
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const decks = decksData ? [...decksData.userDecks, ...decksData.tapeshDecks] : [];

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; /* انتخاب دوبارهٔ همان فایل هم کار کند */
    setError('');
    setParsed(null);
    if (!file) return;
    if (!/\.(txt|csv|tsv)$/i.test(file.name) && !file.type.startsWith('text/')) {
      setError('فرمت پشتیبانی‌شده txt، csv یا tsv است — از خروجی متنی انکی (File › Export). بستهٔ apkg پشتیبانی نمی‌شود.');
      return;
    }
    try {
      const cards = parseAnkiText(await file.text());
      if (!cards.length) {
        setError('هیچ کارتی در فایل پیدا نشد؛ مطمئن شو خروجی متنی انکی است.');
        return;
      }
      setParsed({ cards, fileName: file.name });
    } catch {
      setError('خواندن فایل نشد؛ دوباره تلاش کن.');
    }
  };

  const handleImport = async () => {
    if (!deckId || !parsed || busy) return;
    setBusy(true);
    try {
      const { imported } = await importCards(userData, deckId, parsed.cards);
      trackEvent('cards_imported', { deckId, count: imported });
      onNotify?.(`${toFa(imported)} کارت وارد مجموعه شد و وارد چرخهٔ مرور شد.`);
      setParsed(null);
      setError('');
    } catch {
      setError('ورود کارت‌ها انجام نشد؛ دوباره تلاش کن.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="داده‌ها" className="space-y-3">
      <h2 className="text-[1.35em] [font-family:'Doran','Vazir',Tahoma,sans-serif]">داده‌ها</h2>
      <div className="space-y-3 rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3.5">
        <div>
          <p className="text-[0.94em] font-medium text-[var(--white)]">ورود کارت از خروجی انکی</p>
          <p className="mt-0.5 text-[0.78em] leading-5 text-[var(--ghost)]">
            در Anki مسیر File › Export و نوع «Text separated by Tab or Semicolon» را انتخاب کن — فرمت‌های txt، csv و tsv؛
            حداکثر ۵۰۰ کارت در هر بار. کارت‌های جای‌خالیِ کلوز هم شناسایی می‌شوند.
          </p>
        </div>

        <div className="grid gap-2.5 md:grid-cols-2">
          <select
            value={deckId}
            onChange={(event) => setDeckId(event.target.value)}
            aria-label="مجموعهٔ مقصد"
            className="w-full cursor-pointer rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[0.88em] outline-none focus:border-[#5b8cc7]/50"
          >
            <option value="" className="bg-[var(--surface)]">مجموعهٔ مقصد…</option>
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id} className="bg-[var(--surface)]">{deck.title}</option>
            ))}
          </select>
          <label
            className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-[0.88em] transition-colors ${
              parsed ? 'border-[#77b787]/50 text-[var(--green-soft-ink)]' : 'border-white/15 text-[var(--muted)] hover:border-white/30 hover:text-white'
            }`}
          >
            <Icon name={parsed ? 'check' : 'archive'} className="h-4 w-4" />
            {parsed ? parsed.fileName : 'انتخاب فایل…'}
            <input type="file" accept=".txt,.csv,.tsv,text/plain,text/csv" onChange={handleFile} className="hidden" />
          </label>
        </div>

        {parsed && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-[#77b787]/10 px-3.5 py-2.5">
            <span className="text-[0.82em] text-[var(--green-soft-ink)]">
              {toFa(parsed.cards.length)} کارت شناسایی شد{deckId ? '' : ' — اول مجموعهٔ مقصد را انتخاب کن.'}
            </span>
            <button
              type="button"
              onClick={handleImport}
              disabled={!deckId || busy}
              className={`cursor-pointer rounded-lg px-4 py-1.5 text-[0.82em] font-bold transition-colors [font-family:'Doran','Vazir',Tahoma,sans-serif] ${
                deckId && !busy ? 'bg-[var(--blue-bright)] text-white hover:brightness-110' : 'cursor-not-allowed bg-white/8 text-[var(--faint)]'
              }`}
            >
              {busy ? 'در حال ورود…' : 'ورود به مجموعه'}
            </button>
          </div>
        )}
        {error && <p className="text-[0.78em] leading-5 text-[var(--red-ink)]" role="alert">{error}</p>}
      </div>
    </section>
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
  const textSizeId = TEXT_SIZES.some((size) => size.id === settings.textSize) ? settings.textSize : 'medium';
  const baseFontSize = TEXT_SIZES.find((size) => size.id === textSizeId).px;

  const save = async (patch, message = 'ذخیره شد.') => {
    const next = await updateSettings(userData, patch);
    setData((prev) => ({ ...prev, settings: next }));
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
    onNotify?.(message);
  };

  return (
    <div className="space-y-6" style={{ fontSize: `${baseFontSize}px` }}>
      {savedFlash && (
        <p className="rounded-2xl bg-[#77b787]/12 px-4 py-3 text-center text-[0.82em] text-[var(--green-soft-ink)]" role="status">
          تنظیمات ذخیره شد.
        </p>
      )}

      {/* محدودیت‌های روزانه */}
      <section aria-label="محدودیت‌های روزانه" className="space-y-3">
        <h2 className="text-[1.35em] [font-family:'Doran','Vazir',Tahoma,sans-serif]">روال روزانه</h2>
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
          <h2 className="text-[1.35em] [font-family:'Doran','Vazir',Tahoma,sans-serif]">الگوریتم فاصله‌گذاری</h2>
          <span className="rounded-full bg-white/5 px-3 py-1 text-[0.72em] text-[var(--ghost)]" dir="ltr">{ALGORITHM_VERSION}</span>
        </header>
        <p className="text-[0.78em] leading-6 text-[var(--ghost)]">
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
            step={0.1}
            onChange={(value) => save({ algorithmConfig: { ...settings.algorithmConfig, hardFactor: value } })}
          />
          <NumberField
            id="set-max-interval"
            label="حداکثر فاصله (روز)"
            value={Math.round(algo.maxIntervalDays)}
            min={30}
            max={730}
            step={10}
            onChange={(value) => save({ algorithmConfig: { ...settings.algorithmConfig, maxIntervalDays: value } })}
          />
        </div>

        <div className="rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3.5">
          <p className="text-[0.94em] font-medium text-[var(--white)]">گام‌های یادگیری</p>
          <p className="mt-1 text-[0.78em] leading-5 text-[var(--ghost)]">
            کارت نو بعد از هر ارزیابی به این گام‌ها می‌رود: {algo.learningStepsMinutes.map((minutes) => toFa(minutes)).join(' → ')} دقیقه
          </p>
        </div>
      </section>

      {/* نمایش و تجربه */}
      <section aria-label="نمایش و تجربه" className="space-y-3">
        <h2 className="text-[1.35em] [font-family:'Doran','Vazir',Tahoma,sans-serif]">تجربهٔ مرور</h2>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3.5">
          <div>
            <p className="text-[0.94em] font-medium text-[var(--white)]">اندازهٔ متن</p>
            <span className="mt-0.5 block text-[0.78em] text-[var(--ghost)]">اندازهٔ متن کل این بخش تنظیمات</span>
          </div>
          <div className="flex shrink-0 rounded-xl bg-black/40 p-1" role="group" aria-label="اندازهٔ متن تنظیمات">
            {TEXT_SIZES.map((size) => (
              <button
                key={size.id}
                type="button"
                aria-pressed={textSizeId === size.id}
                onClick={() => save({ textSize: size.id }, 'اندازهٔ متن ذخیره شد.')}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-[0.82em] transition-colors ${
                  textSizeId === size.id ? 'bg-[var(--blue-bright)] text-white' : 'text-[var(--muted)] hover:text-white'
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
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
          hint="برای کارت‌هایی که فایل صوتی دارند"
          checked={settings.autoPlayAudio}
          onChange={(value) => save({ autoPlayAudio: value })}
        />
      </section>

      {/* داده‌ها — فقط ورود؛ خروجی از این بخش برداشته شد */}
      <ImportSection userData={userData} onNotify={onNotify} />
    </div>
  );
}
