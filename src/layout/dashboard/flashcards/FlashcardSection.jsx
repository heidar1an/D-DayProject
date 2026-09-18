/*
 * فلش‌کارت تپش — Learning Engine با Spaced Repetition.
 *
 * معماری (مستند کامل: README.md کنار همین پوشه):
 *   FlashcardSection ← پوستهٔ لایه: سربرگ وسط‌چین، برنامهٔ امروز، مجموعه‌ها، کتابخانه، آمار، تنظیمات
 *   ReviewSession    ← فضای مرور متمرکز (Front → پاسخ → دوباره/سخت/خوب/آسان)
 *   DeckView         ← جزئیات مجموعه + جستجو/فیلتر
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
import { Icon, Skeleton, faNum, toFa } from './flashcardShared';
import { useAsyncData } from '../league/useAsyncData';
import './flashcards.css';

const VIEWS = [
  { id: 'overview', label: 'امروز', icon: 'zap', accent: '#e0b45c' },
  { id: 'decks', label: 'مجموعه‌های من', icon: 'layers', accent: '#5b8cc7' },
  { id: 'library', label: 'کتابخانهٔ تپش', icon: 'library', accent: '#61d192' },
  { id: 'stats', label: 'آمار', icon: 'chart', accent: '#937fcd' },
  { id: 'settings', label: 'تنظیمات', icon: 'settings', accent: '#ef9196' },
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
        مجموعه‌های رسمی تپش توسط تیم آموزشی ساخته و به‌روزرسانی می‌شوند؛ هر مجموعه را که اضافه کنی، کارت‌هایش وارد چرخهٔ مرور هوشمند تو می‌شوند.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.decks.map((deck) => (
          <article
            key={deck.id}
            className="flex flex-col rounded-[1.25rem] border border-white/8 bg-[rgb(var(--wash-rgb)/0.03)] p-5 transition-colors hover:border-white/15"
          >
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: deck.cover }} aria-hidden="true" />
              <h3 className="min-w-0 flex-1 truncate text-[15px] [font-family:'Doran','Vazir',Tahoma,sans-serif]">{deck.title}</h3>
              {deck.added && <span className="shrink-0 rounded-full bg-[#77b787]/12 px-2.5 py-1 text-[10px] text-[var(--green-soft-ink)]">اضافه شد</span>}
            </div>
            <p className="mt-1.5 flex-1 text-xs leading-6 text-[var(--faint)]">{deck.description}</p>
            <p className="mt-2 text-[10px] text-[var(--ghost)]">
              {deck.level} · {faNum(deck.cardCount)} کارت · به‌روزرسانی: {toFa(new Date(deck.updatedAt).toLocaleDateString('fa-IR'))}
            </p>
            <button
              type="button"
              onClick={() => toggle(deck)}
              aria-pressed={deck.added}
              className={`mt-4 cursor-pointer rounded-xl px-4 py-2.5 text-xs font-bold transition-colors [font-family:'Doran','Vazir',Tahoma,sans-serif] ${
                deck.added
                  ? 'border border-white/10 bg-white/5 text-[var(--muted)] hover:border-[#ef9196]/40 hover:bg-[#ef9196]/12 hover:text-[var(--red-ink)]'
                  : 'bg-[var(--blue-bright)] text-white hover:brightness-110'
              }`}
            >
              {deck.added ? 'حذف از مجموعه‌های من' : 'افزودن به مجموعه‌های من'}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ── مجموعه‌های من ── */
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
        <p className="text-sm text-[var(--faint)]">{toFa(decks.length)} مجموعه در فهرست تو</p>
        <button
          type="button"
          onClick={onCreateDeck}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--blue-bright)] px-4 py-2.5 text-xs font-bold text-white transition-transform hover:-translate-y-0.5 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
          ساخت مجموعه
        </button>
      </div>

      {decks.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-white/12 bg-white/[0.02] px-6 py-14 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/5 text-[var(--faint)]">
            <Icon name="layers" className="h-6 w-6" />
          </span>
          <strong className="mt-3 block [font-family:'Doran','Vazir',Tahoma,sans-serif]">هنوز مجموعه‌ای نداری</strong>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-[var(--faint)]">
            یک مجموعه بساز یا از کتابخانهٔ رسمی تپش اضافه کن تا مرور هوشمند شروع شود.
          </p>
          <button
            type="button"
            onClick={onCreateDeck}
            className="mt-4 cursor-pointer rounded-xl bg-[var(--blue-bright)] px-5 py-2.5 text-xs font-bold text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]"
          >
            ساخت مجموعه
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {decks.map((deck) => (
            <article
              key={deck.id}
              className="flex flex-col rounded-[1.25rem] border border-white/8 bg-[rgb(var(--wash-rgb)/0.03)] p-5 transition-colors hover:border-white/15"
            >
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: deck.cover }} aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => onOpenDeck(deck.id)}
                  className="min-w-0 flex-1 cursor-pointer truncate text-right text-[15px] [font-family:'Doran','Vazir',Tahoma,sans-serif] transition-colors hover:text-[var(--blue-soft-ink)]"
                >
                  {deck.title}
                </button>
                {deck.due > 0 && (
                  <span className="shrink-0 rounded-full bg-[#e26d6d]/12 px-2.5 py-1 text-[10px] text-[var(--red-ink)]">امروز {faNum(deck.due)} مرور</span>
                )}
              </div>

              <p className="mt-1.5 text-xs text-[var(--ghost)]">
                {faNum(deck.cardCount)} کارت
                {deck.byTapesh ? ' · توسط تپش' : ''}
                {' · '}
                تسلط {toFa(deck.mastery)}٪
              </p>

              <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/8">
                <span className="block h-full rounded-full" style={{ width: `${deck.mastery}%`, background: deck.cover }} />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onStartReview({ mode: 'deck', deckId: deck.id, label: deck.title })}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[var(--blue-bright)] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:brightness-110 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
                >
                  <Icon name="play" className="h-3.5 w-3.5" />
                  مرور
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDeck(deck.id)}
                  className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-[var(--muted)] transition-colors hover:border-white/20 hover:text-white"
                >
                  مشاهده
                </button>
                {!deck.byTapesh && (
                  <button
                    type="button"
                    onClick={() => onEditDeck(deck)}
                    aria-label={`ویرایش مجموعه ${deck.title}`}
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
function TodayView({ overview, onStartReview }) {
  const { today, counts } = overview;
  const hasDue = today.total > 0;

  return (
    <div className="space-y-5">
      {/* هیرو: پاسخ سریع به «امروز چه چیزی مرور کنم؟» — چیدمان وسط‌چین */}
      <section
        aria-label="مرور امروز"
        className="dash-stagger rounded-[2.5rem] bg-gradient-to-l from-[#5b8cc7]/12 to-transparent p-6 md:p-8"
      >
        <div className="flex flex-col items-center text-center">
          <h2 className="text-2xl [font-family:'Doran','Vazir',Tahoma,sans-serif] md:text-3xl">امروز چی رو مرور کنیم؟</h2>

          {hasDue ? (
            <>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                <strong className="fc-num text-2xl text-white">{faNum(today.total)}</strong>
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

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
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
          </div>
          {counts.totalCards > 0 && (
            <p className="mt-2.5 text-[11px] text-[var(--ghost)]">{faNum(counts.totalCards)} کارت در مجموعهٔ تو</p>
          )}
        </div>

        {/* آمار مینیمال — کادرهای اصلی بالایی، وسط‌چین */}
        <div className="mx-auto mt-6 grid w-full max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'برای مرور', value: faNum(counts.dueToday), color: 'var(--red-ink)' },
            { label: 'کارت جدید', value: faNum(counts.newCards), color: 'var(--blue-ink)' },
            { label: 'در حال یادگیری', value: faNum(counts.learning), color: 'var(--gold-ink)' },
            { label: 'تسلط‌یافته', value: faNum(counts.mastered), color: 'var(--green-ink)' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/6 bg-black/25 px-4 py-3.5 text-center">
              <strong className="fc-num block text-xl" style={{ color: stat.color }}>{stat.value}</strong>
              <span className="mt-0.5 block text-[11px] text-[var(--faint)]">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function FlashcardSection({ userData, onBack }) {
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
      notify(deckId ? 'مجموعه به‌روزرسانی شد.' : 'مجموعه ساخته شد؛ حالا کارت اضافه کن.');
    },
    [userData, refresh, notify],
  );

  const handleDeleteDeck = useCallback(
    async (deckId) => {
      await deleteDeck(userData, deckId);
      refresh();
      notify('مجموعه حذف شد.');
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
      {/* نوار بالای لایه — هم‌خانوادهٔ درسنامه جامع */}
      <div className="fc-topbar dash-stagger">
        <button className="fc-topbar__back" type="button" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          بازگشت به داشبورد
        </button>
        <span className="fc-topbar__crumb">داشبورد / فلش‌کارت</span>
        <button
          type="button"
          onClick={() => setCardEditor({ open: true, card: null, deckId: null })}
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm transition-colors hover:border-[#5b8cc7]/50 hover:bg-[#5b8cc7]/12 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
        >
          <Icon name="plus" className="h-4 w-4 text-[var(--blue-soft-ink)]" />
          ساخت کارت
        </button>
      </div>

      {/* سربرگ وسط‌چین — همانند درسنامه جامع علوم پایه */}
      <header className="fc-hero dash-stagger">
        <h1 className="fc-hero__title">
          <span className="fc-hero__title-top">سیستم مرور هوشمند</span>
          <span className="fc-hero__title-accent">فلش‌کارت</span>
        </h1>
        <p className="fc-hero__subtitle">مرور هوشمند با فاصله‌گذاری علمی — دقیقاً وقتی که حافظه نیاز به تکرار دارد.</p>
      </header>

      {/* ناوبری زیربخش‌ها — چیپ‌های هم‌شکل مسیرهای «بانک تست علوم پایه» */}
      <nav className="fc-scroll-x dash-stagger mb-6 overflow-x-auto pb-2" aria-label="بخش‌های فلش‌کارت">
        <div className="mx-auto flex w-max gap-2.5">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => {
                setView(item.id);
                setOpenDeckId(null);
              }}
              className={`flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2.5 text-[13px] transition-colors [font-family:'Doran','Vazir',Tahoma,sans-serif] ${
                view === item.id
                  ? 'border-[#5b8cc7]/60 bg-[#5b8cc7]/15 text-white'
                  : 'border-white/8 bg-[var(--surface)] text-[var(--muted)] hover:border-white/20 hover:bg-[var(--surface-soft)] hover:text-white'
              }`}
            >
              <Icon name={item.icon} className="h-4 w-4 shrink-0" style={{ color: item.accent }} />
              {item.label}
            </button>
          ))}
        </div>
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
              onStartReview={startReview}
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

      {/* مودال مجموعه */}
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
