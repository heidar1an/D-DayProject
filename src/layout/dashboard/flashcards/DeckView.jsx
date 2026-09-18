/*
 * DeckView — جزئیات یک مجموعه: آمار، مرور، ساخت کارت، و مدیریت کارت‌ها
 * با جستجو و فیلتر (حالت، گلچین، تگ).
 * پاسخ کارت‌ها در لیست عمداً پنهان است؛ فقط با کلیک «نمایش» باز می‌شود (اصل Card Preview).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  fetchDeck,
  setCardArchived,
  setCardBookmarked,
  setCardSuspended,
  trackEvent,
} from '../../../services/flashcards/flashcardService';
import { Icon, MasteryRing, Skeleton, StateChip, faNum, toFa } from './flashcardShared';

const STATE_FILTERS = [
  { id: 'all', label: 'همه' },
  { id: 'new', label: 'جدید' },
  { id: 'learning', label: 'در حال یادگیری' },
  { id: 'review', label: 'در حال مرور' },
  { id: 'mastered', label: 'تسلط‌یافته' },
  { id: 'bookmarked', label: 'گلچین' },
  { id: 'suspended', label: 'معلق' },
];

function formatDue(dueAt) {
  if (!dueAt) return 'شروع نشده';
  const diff = dueAt - Date.now();
  if (diff <= 0) return 'همین حالا';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${toFa(minutes)} دقیقه بعد`;
  if (minutes < 60 * 24) return `${toFa(Math.round(minutes / 60))} ساعت بعد`;
  return `${toFa(Math.round(minutes / (60 * 24)))} روز بعد`;
}

function CardRow({ card, deckCover, onEdit, onBookmark, onSuspend, onArchive }) {
  const [revealed, setRevealed] = useState(false);
  const state = card.userState;

  return (
    <li className="rounded-2xl border border-white/6 bg-[var(--surface-soft)] p-4 transition-colors hover:border-white/12">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: deckCover }} aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <p className="text-sm leading-7 text-[var(--white)]">{card.front}</p>

          {revealed && (
            <div className="mt-2 rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-xs leading-6 text-[var(--muted)]">
              {/* پاسخ فقط با عمد باز می‌شود؛ در حالت پیش‌فرض مخفی است */}
              {card.type === 'cloze' ? card.front.replace(/\{\{c\d+::(.*?)\}\}/g, '«$1»') : card.back}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-[var(--faint)]">
            <StateChip state={state.state} />
            {card.media?.audioUrl && (
              <span className="inline-flex items-center gap-1 text-[var(--blue-soft-ink)]" title="این کارت صدا دارد">
                <Icon name="volume" className="h-3 w-3" />
                صدا دار
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" className="h-3 w-3" />
              {state.suspended ? 'معلق' : formatDue(state.dueAt)}
            </span>
            {card.tags?.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[var(--ghost)]">#{tag}</span>
            ))}
            <button
              type="button"
              onClick={() => setRevealed((prev) => !prev)}
              className="inline-flex cursor-pointer items-center gap-1 text-[var(--blue-ink)] transition-colors hover:text-[var(--blue-soft-ink)]"
            >
              <Icon name="eye" className="h-3 w-3" />
              {revealed ? 'پنهان' : 'نمایش پاسخ'}
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onBookmark}
            aria-pressed={state.bookmarked}
            aria-label="گلچین"
            className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-white/5 ${
              state.bookmarked ? 'text-[var(--gold-ink)]' : 'text-[var(--ghost)] hover:text-[var(--gold-ink)]'
            }`}
          >
            <Icon name={state.bookmarked ? 'star-filled' : 'star'} className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onSuspend}
            aria-pressed={state.suspended}
            aria-label={state.suspended ? 'فعال‌سازی مجدد' : 'سوسپند'}
            title={state.suspended ? 'فعال‌سازی مجدد کارت' : 'فعلاً این کارت را مرور نکن'}
            className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-white/5 ${
              state.suspended ? 'text-[var(--red-ink)]' : 'text-[var(--ghost)] hover:text-white'
            }`}
          >
            <Icon name="pause" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onArchive}
            aria-label="آرشیو یا حذف کارت"
            title="آرشیو کارت"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[var(--ghost)] transition-colors hover:bg-white/5 hover:text-[var(--red-ink)]"
          >
            <Icon name="trash" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label="ویرایش کارت"
            title="ویرایش"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[var(--ghost)] transition-colors hover:bg-white/5 hover:text-white"
          >
            <Icon name="edit" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

export default function DeckView({ userData, deckId, onBack, onStartReview, onEditCard, onCreateCard, reloadKey = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchDeck(userData, deckId)
      .then((payload) => {
        if (alive) {
          setData(payload);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError('مجموعه پیدا نشد.');
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [userData, deckId, reloadKey]);

  const allTags = useMemo(() => {
    if (!data) return [];
    const tags = new Set();
    data.cards.forEach((card) => (card.tags ?? []).forEach((tag) => tags.add(tag)));
    return [...tags].slice(0, 12);
  }, [data]);

  const visibleCards = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.cards.filter((card) => {
      const state = card.userState;
      if (q && ![card.front, card.back ?? '', card.hint ?? '', (card.tags ?? []).join(' ')].join(' ').toLowerCase().includes(q)) return false;
      if (stateFilter === 'bookmarked' && !state.bookmarked) return false;
      if (stateFilter === 'suspended' && !state.suspended) return false;
      if (stateFilter === 'mastered' && state.state !== 'mastered' && (state.masteryScore ?? 0) < 85) return false;
      if (['new', 'learning', 'review'].includes(stateFilter) && state.state !== stateFilter) return false;
      if (stateFilter === 'all' && state.suspended) return false; // معلق‌ها فقط با فیلتر خودشان
      if (tagFilter && !(card.tags ?? []).includes(tagFilter)) return false;
      return true;
    });
  }, [data, query, stateFilter, tagFilter]);

  const mutateLocal = (cardId, updater) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: prev.cards.map((card) => (card.id === cardId ? { ...card, userState: updater(card.userState) } : card)),
      };
    });
  };

  const handleBookmark = (card) => {
    const next = !card.userState.bookmarked;
    mutateLocal(card.id, (state) => ({ ...state, bookmarked: next }));
    setCardBookmarked(userData, card.id, next);
  };

  const handleSuspend = (card) => {
    const next = !card.userState.suspended;
    mutateLocal(card.id, (state) => ({ ...state, suspended: next }));
    setCardSuspended(userData, card.id, next);
    trackEvent(next ? 'card_suspend' : 'card_unsuspend', { cardId: card.id });
  };

  const handleArchive = async (card) => {
    mutateLocal(card.id, (state) => ({ ...state, state: 'archived' }));
    setCardArchived(userData, card.id, true);
    trackEvent('card_archive', { cardId: card.id });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-52 rounded-2xl" />
        <Skeleton className="h-36 rounded-[2.5rem]" />
        <Skeleton className="h-72 rounded-[2.5rem]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-[2.5rem] bg-[var(--surface-soft)] p-10 text-center">
        <p className="text-sm text-[var(--muted)]">{error ?? 'مجموعه پیدا نشد.'}</p>
        <button type="button" onClick={onBack} className="mt-4 cursor-pointer rounded-xl bg-white/8 px-5 py-2 text-sm transition-colors hover:bg-white/15">
          بازگشت
        </button>
      </div>
    );
  }

  const { deck, cards } = data;

  return (
    <div className="space-y-5">
      {/* سربرگ مجموعه */}
      <header className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--faint)] transition-colors hover:text-white"
            >
              <Icon name="back" className="h-3.5 w-3.5" />
              همهٔ مجموعه‌ها
            </button>
            <h1 className="flex items-center gap-2.5 text-2xl [font-family:'Doran','Vazir',Tahoma,sans-serif] md:text-3xl">
              <span className="h-3.5 w-3.5 rounded-full" style={{ background: deck.cover }} aria-hidden="true" />
              {deck.title}
            </h1>
            {deck.description && <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--faint)]">{deck.description}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white/5 px-3 py-1.5 text-[var(--muted)]">{faNum(deck.cardCount)} کارت</span>
              <span className="rounded-full bg-[#5b8cc7]/12 px-3 py-1.5 text-[var(--blue-soft-ink)]">{faNum(deck.new)} جدید</span>
              <span className="rounded-full bg-[#e0b45c]/12 px-3 py-1.5 text-[var(--gold-ink)]">{faNum(deck.learning)} در حال یادگیری</span>
              <span className="rounded-full bg-[#e26d6d]/12 px-3 py-1.5 text-[var(--red-ink)]">{faNum(deck.due)} برای مرور</span>
              {deck.byTapesh && <span className="rounded-full bg-[#77b787]/12 px-3 py-1.5 text-[var(--green-soft-ink)]">توسط تپش</span>}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <MasteryRing value={deck.mastery} size={72} color={deck.cover} />
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onStartReview({ mode: 'deck', deckId: deck.id, label: deck.title })}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--blue-bright)] px-6 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
              >
                <Icon name="play" className="h-4 w-4" />
                مرور این مجموعه
              </button>
              <button
                type="button"
                onClick={() => onCreateCard(deck.id)}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white/8 px-6 py-2.5 text-xs text-white transition-colors hover:bg-white/15"
              >
                <Icon name="plus" className="h-3.5 w-3.5" />
                ساخت کارت
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* جستجو و فیلتر */}
      <div className="space-y-3">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ghost)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجو در کارت‌های این مجموعه…"
            aria-label="جستجو در کارت‌ها"
            className="w-full rounded-2xl border border-white/8 bg-[var(--surface-soft)] py-3.5 pl-4 pr-11 text-sm outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/40"
          />
        </div>

        <div className="fc-scroll-x flex items-center gap-1.5 overflow-x-auto rounded-full bg-black/50 p-1.5">
          {STATE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={stateFilter === filter.id}
              onClick={() => setStateFilter(filter.id)}
              className={`shrink-0 cursor-pointer rounded-full px-4 py-2 text-xs transition-colors [font-family:'Doran','Vazir',Tahoma,sans-serif] ${
                stateFilter === filter.id ? 'bg-[var(--blue-bright)] text-white' : 'text-[var(--muted)] hover:bg-white/5 hover:text-white'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {allTags.length > 0 && (
          <div className="fc-scroll-x flex items-center gap-1.5 overflow-x-auto pb-1">
            <Icon name="tag" className="h-3.5 w-3.5 shrink-0 text-[var(--ghost)]" />
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={tagFilter === tag}
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-[11px] transition-colors ${
                  tagFilter === tag ? 'bg-[#937fcd]/25 text-[var(--purple-soft-ink)]' : 'bg-white/5 text-[var(--faint)] hover:text-white'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* لیست کارت‌ها */}
      <section aria-label="کارت‌های مجموعه">
        <p className="mb-3 text-xs text-[var(--ghost)]">{toFa(visibleCards.length)} کارت</p>
        {visibleCards.length ? (
          <ul className="space-y-2.5">
            {visibleCards.map((card) => (
              <CardRow
                key={card.id}
                card={card}
                deckCover={deck.cover}
                onEdit={() => onEditCard(card)}
                onBookmark={() => handleBookmark(card)}
                onSuspend={() => handleSuspend(card)}
                onArchive={() => handleArchive(card)}
              />
            ))}
          </ul>
        ) : (
          <div className="rounded-[2rem] border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center">
            <p className="text-sm text-[var(--faint)]">کارتی با این شرایط پیدا نشد.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setStateFilter('all');
                setTagFilter(null);
              }}
              className="mt-3 cursor-pointer rounded-xl bg-white/8 px-4 py-2 text-xs transition-colors hover:bg-white/15"
            >
              پاک کردن فیلترها
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
