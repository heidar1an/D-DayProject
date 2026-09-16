/*
 * آزمون‌ساز شخصی (Custom Exam Builder).
 * کاربر از ترکیب چند منبع (مجموعه‌ها، گلچین‌ها، اشتباهات، آزمون‌های خاص) آزمون می‌سازد.
 * تعداد مخزن سؤال زنده محاسبه می‌شود تا همیشه واقعی باشد، نه عدد تزئینی.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  fetchBookmarkedQuestions,
  fetchCollections,
  fetchMistakes,
  fetchQuestionPool,
} from '../../../services/international/internationalService';
import { ExamGlyph, Icon, Skeleton, toFa } from './intlShared';

const DURATION_OPTIONS = [
  { value: null, label: 'بدون محدودیت' },
  { value: 10, label: '۱۰ دقیقه' },
  { value: 20, label: '۲۰ دقیقه' },
  { value: 30, label: '۳۰ دقیقه' },
  { value: 60, label: '۱ ساعت' },
];

const DIFFICULTY_OPTIONS = [
  { id: 'easy', label: 'آسان' },
  { id: 'medium', label: 'متوسط' },
  { id: 'hard', label: 'سخت' },
  { id: 'very_hard', label: 'بسیار سخت' },
];

/* چیپ چندانتخابی */
function Chip({ active, onClick, children, accent = '#937fcd' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs transition-all ${
        active ? 'text-white' : 'border-white/10 bg-white/[0.03] text-[var(--muted)] hover:border-white/25 hover:text-white'
      }`}
      style={active ? { borderColor: `${accent}80`, background: `${accent}1f` } : undefined}
    >
      {active && <Icon name="check" className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export default function ExamBuilderView({ userData, exams, onStart, presetCollectionId }) {
  const userId = userData?.id;
  const [collections, setCollections] = useState(null);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);

  const [collectionIds, setCollectionIds] = useState(presetCollectionId ? [presetCollectionId] : []);
  const [useBookmarks, setUseBookmarks] = useState(false);
  const [useMistakes, setUseMistakes] = useState(false);
  const [examIds, setExamIds] = useState([]);
  const [difficulties, setDifficulties] = useState([]);
  const [count, setCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(null);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [poolSize, setPoolSize] = useState(0);

  /* منابع کاربر برای چیپ‌ها */
  useEffect(() => {
    let alive = true;
    fetchCollections(userId).then((items) => alive && setCollections(items));
    fetchBookmarkedQuestions(userId).then((items) => alive && setBookmarkCount(items.length));
    fetchMistakes(userId).then((data) => alive && setMistakeCount(data.items.length));
    return () => {
      alive = false;
    };
  }, [userId]);

  const sources = useMemo(
    () => ({ collectionIds, useBookmarks, useMistakes, examIds }),
    [collectionIds, useBookmarks, useMistakes, examIds],
  );

  const hasAnySource =
    collectionIds.length > 0 || useBookmarks || useMistakes || examIds.length > 0;

  /* مخزن زندهٔ سؤال */
  useEffect(() => {
    if (!hasAnySource) return;
    let alive = true;
    fetchQuestionPool(userId, sources, { difficulties }).then((pool) => {
      if (alive) setPoolSize(pool.length);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, collectionIds, useBookmarks, useMistakes, examIds, difficulties]);

  const effectiveCount = Math.min(count, poolSize);

  const toggleIn = (setter) => (value) =>
    setter((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));

  const start = () => {
    if (!hasAnySource || poolSize === 0) return;
    onStart({
      title: 'آزمون شخصی من',
      sources,
      difficulties,
      questionCount: effectiveCount,
      durationMinutes,
      shuffleQuestions,
    });
  };

  if (!collections) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-40 rounded-[2.5rem]" />
        <Skeleton className="h-52 rounded-[2.5rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <header>
        <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">آزمون‌ساز شخصی</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--faint)]">
          فقط با سؤال‌هایی که خودت انتخاب کردی آزمون بساز؛ ترکیب چند منبع هم می‌شود.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
        {/* ستون تنظیمات */}
        <div className="space-y-4">
          {/* منابع */}
          <section className="rounded-[2rem] border border-white/8 bg-[var(--surface-soft)] p-5" aria-label="منابع سؤال">
            <h3 className="flex items-center gap-2 text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              <Icon name="layers" className="h-4 w-4 text-[var(--purple-ink)]" />
              از کجا سؤال بردارم؟
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-[11px] text-[var(--faint)]">مجموعه‌های من</p>
                {collections.length === 0 ? (
                  <p className="text-xs text-[var(--ghost)]">هنوز مجموعه‌ای نساخته‌ای — از بخش «مجموعه‌های من» بساز.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {collections.map((collection) => (
                      <Chip
                        key={collection.id}
                        active={collectionIds.includes(collection.id)}
                        onClick={() => toggleIn(setCollectionIds)(collection.id)}
                      >
                        {collection.name}
                        <span className="text-[10px] opacity-70">({toFa(collection.questionIds.length)})</span>
                      </Chip>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-[11px] text-[var(--faint)]">منابع سریع</p>
                <div className="flex flex-wrap gap-2">
                  <Chip active={useBookmarks} onClick={() => setUseBookmarks((prev) => !prev)} accent="#e26d6d">
                    <Icon name="heart" className="h-3.5 w-3.5" /> گلچین‌های من ({toFa(bookmarkCount)})
                  </Chip>
                  <Chip active={useMistakes} onClick={() => setUseMistakes((prev) => !prev)} accent="#ef9196">
                    <Icon name="flame" className="h-3.5 w-3.5" /> اشتباهات من ({toFa(mistakeCount)})
                  </Chip>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] text-[var(--faint)]">کل بانک یک آزمون</p>
                <div className="flex flex-wrap gap-2">
                  {exams.map((exam) => (
                    <Chip key={exam.id} active={examIds.includes(exam.id)} onClick={() => toggleIn(setExamIds)(exam.id)} accent={exam.accent}>
                      <ExamGlyph glyph={exam.glyph} accent={exam.accent} className="h-3.5 w-3.5" />
                      {exam.shortName}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] text-[var(--faint)]">سطح سختی (اختیاری)</p>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <Chip key={option.id} active={difficulties.includes(option.id)} onClick={() => toggleIn(setDifficulties)(option.id)} accent="#e0b45c">
                      {option.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* تنظیمات آزمون */}
          <section className="rounded-[2rem] border border-white/8 bg-[var(--surface-soft)] p-5" aria-label="تنظیمات آزمون">
            <h3 className="flex items-center gap-2 text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              <Icon name="target" className="h-4 w-4 text-[var(--purple-ink)]" />
              تنظیمات آزمون
            </h3>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {/* تعداد سؤال */}
              <div>
                <p className="mb-2 text-[11px] text-[var(--faint)]">تعداد سؤال</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCount((prev) => Math.max(1, prev - 5))}
                    aria-label="۵ سؤال کمتر"
                    className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-white/6 transition-colors hover:bg-white/12"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, poolSize)}
                    value={count}
                    onChange={(event) => setCount(Math.max(1, Number(event.target.value) || 1))}
                    className="h-9 w-20 rounded-xl border border-white/8 bg-[var(--surface-soft)] text-center text-sm text-white focus:border-[#937fcd]/60 focus:outline-none"
                    aria-label="تعداد سؤال"
                  />
                  <button
                    type="button"
                    onClick={() => setCount((prev) => Math.min(Math.max(1, poolSize), prev + 5))}
                    aria-label="۵ سؤال بیشتر"
                    className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-white/6 transition-colors hover:bg-white/12"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* زمان */}
              <div>
                <p className="mb-2 text-[11px] text-[var(--faint)]">زمان آزمون</p>
                <div className="flex flex-wrap gap-1.5">
                  {DURATION_OPTIONS.map((option) => (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() => setDurationMinutes(option.value)}
                      aria-pressed={durationMinutes === option.value}
                      className={`cursor-pointer rounded-xl px-3 py-1.5 text-[11px] transition-colors ${
                        durationMinutes === option.value ? 'bg-[var(--purple-bright)] text-white' : 'bg-white/6 text-[var(--muted)] hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ترتیب */}
              <div className="sm:col-span-2">
                <p className="mb-2 text-[11px] text-[var(--faint)]">ترتیب سؤال‌ها</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShuffleQuestions(true)}
                    aria-pressed={shuffleQuestions}
                    className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs transition-colors ${
                      shuffleQuestions ? 'bg-[var(--purple-bright)] text-white' : 'bg-white/6 text-[var(--muted)] hover:text-white'
                    }`}
                  >
                    تصادفی
                  </button>
                  <button
                    type="button"
                    onClick={() => setShuffleQuestions(false)}
                    aria-pressed={!shuffleQuestions}
                    className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs transition-colors ${
                      !shuffleQuestions ? 'bg-[var(--purple-bright)] text-white' : 'bg-white/6 text-[var(--muted)] hover:text-white'
                    }`}
                  >
                    بر اساس ترتیب ذخیره‌شدن
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* خلاصهٔ کنار: چسبان در دسکتاپ */}
        <aside>
          <div className="sticky top-6 rounded-[2rem] border border-white/8 bg-[var(--surface-soft)] p-5">
            <h3 className="text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">آزمون تو</h3>
            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-[var(--faint)]">مخزن سؤال</dt>
                <dd className="font-bold">{toFa(poolSize)} سؤال</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--faint)]">انتخاب‌شده</dt>
                <dd className="font-bold">{toFa(effectiveCount)} سؤال</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--faint)]">زمان</dt>
                <dd className="font-bold">{DURATION_OPTIONS.find((option) => option.value === durationMinutes)?.label ?? '—'}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={start}
              disabled={!hasAnySource || poolSize === 0}
              className="mt-5 w-full cursor-pointer rounded-2xl bg-[var(--purple-bright)] py-3 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-default disabled:translate-y-0 disabled:bg-white/8 disabled:text-[var(--faint)] [font-family:'Doran','Vazir',Tahoma,sans-serif]"
            >
              شروع آزمون
            </button>

            <p className="mt-3 text-[11px] leading-5 text-[var(--faint)]">
              {!hasAnySource
                ? 'حداقل یک منبع انتخاب کن.'
                : poolSize === 0
                  ? 'با این ترکیب سؤالی پیدا نشد؛ منبع دیگری اضافه کن.'
                  : 'مخزن با هر تغییری بلافاصله به‌روز می‌شود.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
