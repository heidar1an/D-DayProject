/*
 * فلش‌کارت تپش — Learning Engine با Spaced Repetition.
 *
 * معماری (مستند کامل: README.md کنار همین پوشه):
 *   FlashcardSection ← پوستهٔ لایه: هیرو، برنامهٔ امروز، دک‌ها، ضعیف‌ها، پیشنهادها، کتابخانه، آمار، تنظیمات
 *   ReviewSession    ← فضای مرور متمرکز (Front → پاسخ → دوباره/سخت/خوب/آسان)
 *   DeckView         ← جزئیات دِک + جستجو/فیلتر
 *   CardEditor/DeckModal ← ساخت و ویرایش
 *   سرویس: src/services/flashcards (قرارداد API واقعی، فعلاً Mock + localStorage)
 */
import { useCallback, useState } from 'react';
import {
  addLibraryDeck,
  createCard,
  createDeck,
  deleteDeck,
  fetchLibrary,
  fetchMyDecks,
  fetchOverview,
  removeLibraryDeck,
  setCardArchived,
  setCardBookmarked,
  setCardSuspended,
  trackEvent,
  updateCard,
  updateDeck,
} from '../../../services/flashcards/flashcardService';
import CardEditor from './CardEditor';
import DeckModal from './DeckModal';
import DeckView from './DeckView';
import ReviewSession from './ReviewSession';
import SettingsView from './SettingsView';
import StatsView from './StatsView';
import { Icon, MasteryRing, Skeleton, StateChip, faNum, toFa } from './flashcardShared';
import { useAsyncData } from '../league/useAsyncData';
import './flashcards.css';

const VIEWS = [
  { id: 'overview', label: 'امروز', icon: 'zap' },
  { id: 'decks', label: 'دِک‌های من', icon: 'layers' },
  { id: 'library', label: 'کتابخانهٔ تپش', icon: 'library' },
  { id: 'stats', label: 'آمار', icon: 'chart' },
  { id: 'settings', label: 'تنظیمات', icon: 'settings' },
];

function ErrorState({ onRetry }) {
  return (
    <div className="rounded-[2.5rem] bg-[var(--surface-soft)] p-10 text-center">
      <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#ff6969]/12 text-[var(--red-ink)]">
        <Icon name="warn" className="h-7 w-7" />
      </span>
      <strong className="block text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">فلش‌کارت‌ها همین لحظه در دسترس نیستند</strong>
      <p className="mt-2 text-sm text-[var(--faint)]">اتصالت را چک کن و دوباره تلاش کن.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 cursor-pointer rounded-xl bg-[var(--blue-bright)] px-6 py-2.5 text-sm text-white transition-transform hover:-translate-y-0.5 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
      >
        تلاش دوباره
      </button>
    </div>
  );
}

function SkeletonHome() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-52 rounded-[2.5rem]" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-[2.5rem]" />
        <Skeleton className="h-40 rounded-[2.5rem]" />
      </div>
    </div>
  );
}

/* ── کتابخانهٔ رسمی تپش ── */
function LibraryView({ userData, onChanged }) {
  const { data, loading, error, retry } = useAsyncData(() => fetchLibrary(userData), [userData]);

  const toggle = async (deck) => {
    if (deck.added) {
      await removeLibraryDeck(userData, deck.id);
      trackEvent('library_deck_removed', { deckId: deck.id });
    } else {
      await addLibraryDeck(userData, deck.id);
      trackEvent('library_deck_added', { deckId: deck.id });
    }
    onChanged();
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-48 rounded-[2rem]" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState onRetry={retry} />;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-7 text-[var(--faint)]">
        دک‌های رسمی تپش توسط تیم آموزشی ساخته و به‌روزرسانی می‌شوند؛ هر دِک را که اضافه کنی، کارت‌هایش وارد چرخهٔ مرور هوشمند تو می‌شوند.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.decks.map((deck) => (
          <article
            key={deck.id}
            className="flex flex-col rounded-[2rem] border border-white/6 bg-[var(--surface-soft)] p-5 transition-colors hover:border-white/12"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: `${deck.cover}1f`, color: deck.cover }}>
                <Icon name="cards" className="h-5 w-5" />
              </span>
              {deck.added && <span className="rounded-full bg-[#77b787]/12 px-2.5 py-1 text-[10px] text-[var(--green-soft-ink)]">اضافه شد</span>}
            </div>
            <h3 className="mt-3 text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]">{deck.title}</h3>
            <p className="mt-1.5 flex-1 text-xs leading-6 text-[var(--faint)]">{deck.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--ghost)]">
              <span className="rounded-full bg-white/5 px-2.5 py-1">{deck.level}</span>
              <span className="rounded-full bg-white/5 px-2.5 py-1">{faNum(deck.cardCount)} کارت</span>
              <span className="rounded-full bg-white/5 px-2.5 py-1">به‌روزرسانی: {toFa(new Date(deck.updatedAt).toLocaleDateString('fa-IR'))}</span>
            </div>
            <button
              type="button"
              onClick={() => toggle(deck)}
              aria-pressed={deck.added}
              className={`mt-4 cursor-pointer rounded-xl px-4 py-2.5 text-xs font-bold transition-colors [font-family:'Doran','Vazir',Tahoma,sans-serif] ${
                deck.added ? 'bg-white/8 text-[var(--muted)] hover:bg-[#ef9196]/15 hover:text-[var(--red-ink)]' : 'bg-[var(--blue-bright)] text-white hover:-translate-y-0.5 transition-transform'
              }`}
            >
              {deck.added ? 'حذف از دِک‌های من' : 'افزودن به دِک‌های من'}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ── دِک‌های من ── */
function MyDecksView({ userData, overview, onOpenDeck, onCreateDeck, onEditDeck, onDeleteDeck, onStartReview, onCreateCard }) {
  const { data, loading, error, retry } = useAsyncData(() => fetchMyDecks(userData), [userData]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-48 rounded-[2rem]" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState onRetry={retry} />;

  const decks = [...data.userDecks, ...data.tapeshDecks];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--faint)]">{toFa(decks.length)} دِک در مجموعهٔ تو</p>
        <button
          type="button"
          onClick={onCreateDeck}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--blue-bright)] px-4 py-2.5 text-xs font-bold text-white transition-transform hover:-translate-y-0.5 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
          ساخت دِک
        </button>
      </div>

      {decks.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-white/12 bg-white/[0.02] px-6 py-14 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/5 text-[var(--faint)]">
            <Icon name="layers" className="h-6 w-6" />
          </span>
          <strong className="mt-3 block [font-family:'Doran','Vazir',Tahoma,sans-serif]">هنوز دِکی نداری</strong>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-[var(--faint)]">
            یک دِک بساز یا از کتابخانهٔ رسمی تپش اضافه کن تا مرور هوشمند شروع شود.
          </p>
          <button
            type="button"
            onClick={onCreateDeck}
            className="mt-4 cursor-pointer rounded-xl bg-[var(--blue-bright)] px-5 py-2.5 text-xs font-bold text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]"
          >
            ساخت دِک
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {decks.map((deck) => (
            <article key={deck.id} className="flex flex-col rounded-[2rem] border border-white/6 bg-[var(--surface-soft)] p-5 transition-colors hover:border-white/12">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: `${deck.cover}1f`, color: deck.cover }}>
                  <Icon name="cards" className="h-5 w-5" />
                </span>
                <MasteryRing value={deck.mastery} size={52} color={deck.cover} />
              </div>

              <button type="button" onClick={() => onOpenDeck(deck.id)} className="mt-3 cursor-pointer text-right">
                <h3 className="text-base [font-family:'Doran','Vazir',Tahoma,sans-serif] transition-colors hover:text-[var(--blue-soft-ink)]">{deck.title}</h3>
              </button>
              <p className="mt-1 flex-1 text-xs text-[var(--ghost)]">
                {faNum(deck.cardCount)} کارت
                {deck.byTapesh ? ' · توسط تپش' : ''}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
                {deck.due > 0 && <span className="rounded-full bg-[#e26d6d]/12 px-2.5 py-1 text-[var(--red-ink)]">امروز {faNum(deck.due)} مرور</span>}
                {deck.new > 0 && <span className="rounded-full bg-[#5b8cc7]/12 px-2.5 py-1 text-[var(--blue-soft-ink)]">{faNum(deck.new)} جدید</span>}
                {deck.learning > 0 && <span className="rounded-full bg-[#e0b45c]/12 px-2.5 py-1 text-[var(--gold-ink)]">{faNum(deck.learning)} یادگیری</span>}
                {deck.mastered > 0 && <span className="rounded-full bg-[#77b787]/12 px-2.5 py-1 text-[var(--green-soft-ink)]">{faNum(deck.mastered)} مسلط</span>}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onStartReview({ mode: 'deck', deckId: deck.id, label: deck.title })}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[var(--blue-bright)] px-4 py-2.5 text-xs font-bold text-white transition-transform hover:-translate-y-0.5 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
                >
                  <Icon name="play" className="h-3.5 w-3.5" />
                  مرور
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDeck(deck.id)}
                  className="cursor-pointer rounded-xl bg-white/8 px-4 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-white/15 hover:text-white"
                >
                  مشاهده
                </button>
                {!deck.byTapesh && (
                  <button
                    type="button"
                    onClick={() => onEditDeck(deck)}
                    aria-label={`ویرایش دِک ${deck.title}`}
                    className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-[var(--ghost)] transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <Icon name="edit" className="h-4 w-4" />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── نمای «امروز» ── */
function TodayView({ overview, onOpenDeck, onStartReview, onCreateDeck, onAcceptSuggestion, onOpenStats }) {
  const { today, counts, streak, performance, weakTopics, decks, suggestions } = overview;
  const hasDue = today.total > 0;

  return (
    <div className="space-y-5">
      {/* هیرو: پاسخ سریع به «امروز چه چیزی مرور کنم؟» */}
      <section
        aria-label="مرور امروز"
        className="dash-stagger rounded-[2.5rem] bg-gradient-to-l from-[#5b8cc7]/12 to-transparent p-6 md:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <h2 className="text-2xl [font-family:'Doran','Vazir',Tahoma,sans-serif] md:text-3xl">امروز چی رو مرور کنیم؟</h2>

            {hasDue ? (
              <>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  <strong className="text-2xl text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">{faNum(today.total)}</strong>
                  {' '}کارت برای امروز —{' '}
                  <span className="text-[var(--blue-soft-ink)]">{faNum(today.new)} جدید</span>،{' '}
                  <span className="text-[var(--gold-ink)]">{faNum(today.plan.review)} مرور</span>
                  {today.plan.weak > 0 && <> و <span className="text-[var(--red-ink)]">{faNum(today.plan.weak)} کارت ضعیف</span></>}
                </p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--faint)]">
                  <Icon name="clock" className="h-3.5 w-3.5" />
                  زمان تخمینی: ~{toFa(today.estimatedMinutes)} دقیقه
                </p>
              </>
            ) : (
              <p className="mt-3 max-w-md text-sm leading-7 text-[var(--muted)]">
                برای امروز مروری نداری. می‌توانی کارت‌های جدید را شروع کنی یا یک مرور آزاد بزنی.
              </p>
            )}
          </div>

          <div className="flex flex-col items-stretch gap-2.5">
            {hasDue ? (
              <button
                type="button"
                onClick={() => onStartReview({ mode: 'today', label: 'برنامهٔ امروز' })}
                className="flex cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-[var(--blue-bright)] px-10 py-4 text-base font-bold text-white shadow-[0_16px_36px_-14px_rgba(91,140,199,0.7)] transition-transform hover:-translate-y-0.5 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
              >
                <Icon name="play" className="h-5 w-5" />
                شروع مرور
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onStartReview({ mode: 'deck', deckId: null, label: 'کارت‌های جدید' })}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--blue-bright)] px-8 py-3.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
                >
                  <Icon name="zap" className="h-4 w-4" />
                  شروع کارت‌های جدید
                </button>
                <button
                  type="button"
                  onClick={() => onStartReview({ mode: 'cram', label: 'مرور آزاد' })}
                  className="cursor-pointer rounded-2xl bg-white/8 px-8 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-white/15 hover:text-white"
                >
                  مرور آزاد
                </button>
              </>
            )}
            {counts.totalCards > 0 && (
              <p className="text-center text-[11px] text-[var(--ghost)]">{faNum(counts.totalCards)} کارت در مجموعهٔ تو</p>
            )}
          </div>
        </div>

        {/* آمار مینیمال */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'برای مرور', value: faNum(counts.dueToday), color: 'var(--red-ink)' },
            { label: 'کارت جدید', value: faNum(counts.newCards), color: 'var(--blue-ink)' },
            { label: 'در حال یادگیری', value: faNum(counts.learning), color: 'var(--gold-ink)' },
            { label: 'تسلط‌یافته', value: faNum(counts.mastered), color: 'var(--green-ink)' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/6 bg-black/25 px-4 py-3.5 text-center">
              <strong className="block text-xl [font-family:'Doran','Vazir',Tahoma,sans-serif]" style={{ color: stat.color }}>{stat.value}</strong>
              <span className="mt-0.5 block text-[11px] text-[var(--faint)]">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* پیشرفت + استریک */}
        <section aria-label="پیشرفت کلی" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-7">
          <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">پیشرفت تو</h2>
          <div className="mt-5 flex flex-wrap items-center gap-6">
            <MasteryRing value={counts.mastery} size={104} stroke={8} color="var(--blue-ink)" label="تسلط" />
            <div className="flex-1 space-y-3 text-sm">
              <p className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-[var(--muted)]">
                  <Icon name="flame" className="h-4 w-4 text-[var(--red-ink)]" />
                  استریک مطالعه
                </span>
                <strong>{toFa(streak)} روز</strong>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-[var(--muted)]">دقت پاسخ‌ها</span>
                <strong>{toFa(performance.accuracy)}٪</strong>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-[var(--muted)]">ماندگاری حافظه</span>
                <strong>{toFa(performance.retention)}٪</strong>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-[var(--muted)]">گلچین‌شده‌ها</span>
                <strong>{faNum(counts.bookmarked)}</strong>
              </p>
              <button
                type="button"
                onClick={onOpenStats}
                className="cursor-pointer text-xs text-[var(--blue-ink)] transition-colors hover:text-[var(--blue-soft-ink)]"
              >
                آمار کامل ←
              </button>
            </div>
          </div>
        </section>

        {/* مباحث ضعیف */}
        <section aria-label="مباحث ضعیف" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-7">
          <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">مباحث ضعیف‌تر</h2>
          {weakTopics.length ? (
            <ul className="mt-4 space-y-3">
              {weakTopics.slice(0, 3).map((topic) => {
                const weak = topic.mastery < 45;
                return (
                  <li key={topic.topicId} className="flex items-center gap-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${weak ? 'bg-[var(--rose)]' : 'bg-[var(--gold)]'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm">{topic.topicId}</span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/8">
                      <span className="block h-full rounded-full" style={{ width: `${topic.mastery}%`, background: weak ? '#ef9196' : '#e0b45c' }} />
                    </div>
                    <strong className="w-10 shrink-0 text-left text-xs" style={{ color: weak ? '#ef9196' : '#e0b45c' }}>{toFa(topic.mastery)}٪</strong>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-7 text-[var(--faint)]">بعد از چند جلسه مرور، اینجا مباحثی که نیاز به تکرار دارند را نشانت می‌دهیم.</p>
          )}
          {weakTopics.length > 0 && (
            <button
              type="button"
              onClick={() => onStartReview({ mode: 'weak', label: 'مباحث ضعیف' })}
              className="mt-5 cursor-pointer rounded-xl bg-[#ef9196]/12 px-5 py-2.5 text-xs text-[var(--red-ink)] transition-colors hover:bg-[#ef9196]/20"
            >
              مرور مباحث ضعیف
            </button>
          )}
        </section>
      </div>

      {/* پیشنهادهای هوشمند */}
      {suggestions.length > 0 && (
        <section aria-label="پیشنهادهای هوشمند" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-7">
          <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">پیشنهاد تپش</h2>
          <p className="mt-1 text-xs text-[var(--ghost)]">بر اساس رفتار مرور و اشتباهات تو</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="flex flex-col rounded-2xl border border-white/6 bg-[var(--surface-soft)] p-4">
                <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${suggestion.accent}1a`, color: suggestion.accent }}>
                  <Icon name={suggestion.icon} className="h-4.5 w-4.5" />
                </span>
                <p className="mt-3 text-sm leading-6">{suggestion.title}</p>
                <p className="mt-1 flex-1 text-[11px] leading-5 text-[var(--faint)]">{suggestion.note}</p>
                <button
                  type="button"
                  onClick={() => onAcceptSuggestion(suggestion)}
                  className="mt-3 cursor-pointer self-start rounded-lg px-3 py-1.5 text-xs transition-colors"
                  style={{ background: `${suggestion.accent}14`, color: suggestion.accent }}
                >
                  {suggestion.actionLabel}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* دک‌ها — پیش‌نمایش سریع */}
      <section aria-label="دک‌های من" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-7">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">دک‌های تو</h2>
          <button type="button" onClick={onOpenDeck} className="cursor-pointer text-xs text-[var(--purple-ink)] transition-colors hover:text-[var(--purple-soft-ink)]">
            همهٔ دک‌ها
          </button>
        </header>

        {decks.length ? (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {decks.slice(0, 6).map((deck) => (
              <li key={deck.id}>
                <button
                  type="button"
                  onClick={() => onOpenDeck(deck.id)}
                  className="w-full cursor-pointer rounded-2xl border border-white/6 bg-[var(--surface-soft)] p-4 text-right transition-colors hover:border-white/15"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: deck.cover }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm">{deck.title}</span>
                    {deck.due > 0 && <span className="shrink-0 text-[11px] text-[var(--red-ink)]">{faNum(deck.due)}</span>}
                  </div>
                  <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/8">
                    <span className="block h-full rounded-full" style={{ width: `${deck.mastery}%`, background: deck.cover }} />
                  </div>
                  <p className="mt-1.5 text-[10px] text-[var(--ghost)]">
                    {faNum(deck.cardCount)} کارت · تسلط {toFa(deck.mastery)}٪
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/12 px-5 py-8 text-center">
            <p className="text-sm text-[var(--faint)]">هنوز دکی نداری؛ اولین دکت را بساز.</p>
            <button
              type="button"
              onClick={onCreateDeck}
              className="mt-3 cursor-pointer rounded-xl bg-[var(--blue-bright)] px-5 py-2.5 text-xs font-bold text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]"
            >
              ساخت دِک
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function FlashcardSection({ userData }) {
  const [view, setView] = useState('overview');
  const [openDeckId, setOpenDeckId] = useState(null);
  const [reviewConfig, setReviewConfig] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [deckModal, setDeckModal] = useState({ open: false, deck: null });
  const [cardEditor, setCardEditor] = useState({ open: false, card: null, deckId: null });
  const [toast, setToast] = useState(null);

  const { data: overview, loading, error, retry } = useAsyncData(() => fetchOverview(userData), [userData, reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const startReview = useCallback(
    (config) => {
      trackEvent('review_start_intent', config);
      setReviewConfig(config);
      window.scrollTo({ top: 0, behavior: 'instant' });
    },
    [],
  );

  const exitReview = useCallback(() => {
    setReviewConfig(null);
    refresh();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [refresh]);

  const openDeck = useCallback((deckId) => {
    setOpenDeckId(deckId);
    setView('decks');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleSaveDeck = useCallback(
    async (deckId, draft) => {
      if (deckId) await updateDeck(userData, deckId, draft);
      else await createDeck(userData, draft);
      trackEvent(deckId ? 'deck_updated' : 'deck_created', { deckId });
      refresh();
      notify(deckId ? 'دِک به‌روزرسانی شد.' : 'دِک ساخته شد؛ حالا کارت اضافه کن.');
    },
    [userData, refresh, notify],
  );

  const handleDeleteDeck = useCallback(
    async (deckId) => {
      await deleteDeck(userData, deckId);
      refresh();
      notify('دِک حذف شد.');
    },
    [userData, refresh, notify],
  );

  /* ذخیرهٔ کارت — از Editor و از داخل مرور */
  const handleSaveCard = useCallback(
    async (cardId, draft) => {
      if (cardId) {
        await updateCard(userData, cardId, draft);
        trackEvent('card_updated', { cardId });
        notify('کارت به‌روزرسانی شد.');
      } else {
        await createCard(userData, draft.deckId, draft);
        trackEvent('card_created', { deckId: draft.deckId });
        notify('کارت اضافه شد و وارد چرخهٔ مرور شد.');
      }
      refresh();
    },
    [userData, refresh, notify],
  );

  /* پیشنهادهای هوشمند — مسیر «اشتباه → فلش‌کارت» و «تبدیل سؤال» */
  const handleSuggestion = useCallback(
    (suggestion) => {
      trackEvent('suggestion_accepted', { id: suggestion.id, kind: suggestion.kind });
      if (suggestion.kind === 'mistakes' || suggestion.kind === 'topic') {
        setCardEditor({ open: true, card: null, deckId: null });
      } else {
        startReview({ mode: 'weak', label: 'کارت‌های ضعیف' });
      }
    },
    [startReview],
  );

  /* ── در حال مرور: فقط یادگیری ── */
  if (reviewConfig) {
    return (
      <section dir="rtl" aria-label="مرور فلش‌کارت" className="mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar','Vazir',Tahoma,sans-serif]">
        <ReviewSession
          userData={userData}
          config={reviewConfig}
          onExit={exitReview}
          onEditCard={(card) => setCardEditor({ open: true, card, deckId: card.deckId })}
        />
        <CardEditor
          open={cardEditor.open}
          onClose={() => setCardEditor({ open: false, card: null, deckId: null })}
          onSave={handleSaveCard}
          card={cardEditor.card}
          deckOptions={overview?.decks ?? []}
        />
      </section>
    );
  }

  return (
    <section dir="rtl" aria-label="فلش‌کارت تپش" className="mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar','Vazir',Tahoma,sans-serif]">
      {/* سربرگ لایه */}
      <header className="dash-stagger mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl text-[var(--blue-ink)] [font-family:'Doran','Vazir',Tahoma,sans-serif] md:text-4xl">فلش‌کارت</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">مرور هوشمند با فاصله‌گذاری علمی — دقیقاً وقتی که حافظه نیاز به تکرار دارد.</p>
        </div>
        <button
          type="button"
          onClick={() => setCardEditor({ open: true, card: null, deckId: null })}
          className="flex cursor-pointer items-center gap-2 rounded-2xl bg-[var(--surface-soft)] px-5 py-3 text-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--surface-soft)] [font-family:'Doran','Vazir',Tahoma,sans-serif]"
        >
          <Icon name="plus" className="h-4 w-4 text-[var(--blue-soft-ink)]" />
          ساخت کارت
        </button>
      </header>

      {/* ناوبری زیربخش‌ها */}
      <nav className="dash-stagger mb-6 flex gap-1.5 overflow-x-auto rounded-full bg-black/50 p-1.5" aria-label="بخش‌های فلش‌کارت">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => {
              setView(item.id);
              setOpenDeckId(null);
            }}
            className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm transition-colors [font-family:'Doran','Vazir',Tahoma,sans-serif] ${
              view === item.id ? 'bg-[var(--blue-bright)] text-white' : 'text-[var(--muted)] hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon name={item.icon} className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>

      {loading && !overview ? (
        <SkeletonHome />
      ) : error ? (
        <ErrorState onRetry={retry} />
      ) : (
        <div key={`${view}-${openDeckId ?? 'root'}`} className="dash-stagger">
          {openDeckId ? (
            <DeckView
              userData={userData}
              deckId={openDeckId}
              reloadKey={reloadKey}
              onBack={() => setOpenDeckId(null)}
              onStartReview={startReview}
              onEditCard={(card) => setCardEditor({ open: true, card, deckId: card.deckId })}
              onCreateCard={(deckId) => setCardEditor({ open: true, card: null, deckId })}
            />
          ) : view === 'overview' && overview ? (
            <TodayView
              overview={overview}
              onOpenDeck={openDeck}
              onStartReview={startReview}
              onCreateDeck={() => setDeckModal({ open: true, deck: null })}
              onAcceptSuggestion={handleSuggestion}
              onOpenStats={() => setView('stats')}
            />
          ) : view === 'decks' ? (
            <MyDecksView
              userData={userData}
              overview={overview}
              onOpenDeck={openDeck}
              onCreateDeck={() => setDeckModal({ open: true, deck: null })}
              onEditDeck={(deck) => setDeckModal({ open: true, deck })}
              onDeleteDeck={handleDeleteDeck}
              onStartReview={startReview}
              onCreateCard={(deckId) => setCardEditor({ open: true, card: null, deckId })}
            />
          ) : view === 'library' ? (
            <LibraryView userData={userData} onChanged={refresh} />
          ) : view === 'stats' ? (
            <StatsView
              userData={userData}
              reloadKey={reloadKey}
              onReviewWeak={() => startReview({ mode: 'weak', label: 'مباحث ضعیف' })}
            />
          ) : (
            <SettingsView userData={userData} onNotify={notify} reloadKey={reloadKey} />
          )}
        </div>
      )}

      {/* مودال دِک */}
      <DeckModal
        open={deckModal.open}
        deck={deckModal.deck}
        onClose={() => setDeckModal({ open: false, deck: null })}
        onSave={handleSaveDeck}
      />

      {/* ویرایشگر کارت */}
      <CardEditor
        open={cardEditor.open}
        card={cardEditor.card}
        defaultDeckId={cardEditor.deckId}
        deckOptions={overview?.decks ?? []}
        onClose={() => setCardEditor({ open: false, card: null, deckId: null })}
        onSave={handleSaveCard}
      />

      {/* توست */}
      {toast && (
        <div className="fc-toast pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center" aria-live="polite">
          <div className="fc-card-face flex items-center gap-2.5 rounded-full border border-[#5b8cc7]/40 bg-[#1b2530]/95 px-5 py-3 text-sm shadow-[0_18px_40px_-14px_rgb(var(--shadow-rgb) / 0.9)] backdrop-blur">
            <Icon name="check" className="h-4 w-4 text-[var(--green-soft-ink)]" />
            {toast}
          </div>
        </div>
      )}
    </section>
  );
}
