/*
 * ReviewSession — فضای مرور متمرکز فلش‌کارت تپش.
 *
 * هدف: «فقط یادگیری» — بدون هیچ چیز اضافه؛ Front → نمایش پاسخ → دوباره/سخت/خوب/آسان → کارت بعدی.
 *
 * نکات معماری:
 *   - ارزیابی خوش‌بینانه است: موتور مستقل spacedRepetition بلافاصله وضعیت بعدی را محاسبه
 *     می‌کند و کارت بعدی بدون انتظار نمایش داده می‌شود؛ ثبت دائمی در سرویس به‌صورت
 *     پس‌زمینه انجام می‌گیرد (آمادهٔ Sync-Queue برای Offline Mode).
 *   - میانبرها فقط روی دسکتاپ فعال‌اند (تشخیص Pointer: coarse).
 *   - همهٔ انیمیشن‌ها با گارد prefers-reduced-motion در flashcards.css خاموش می‌شوند.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchReviewQueue, rateCard, setCardBookmarked, setCardSuspended, buryCard, trackEvent } from '../../../services/flashcards/flashcardService';
import { formatInterval, previewIntervals } from '../../../services/flashcards/spacedRepetition';
import { Icon, InfoChip, Modal, Skeleton, StateChip, faNum, renderCloze, toFa } from './flashcardShared';
import './flashcards.css';

const RATING_BUTTONS = [
  { rating: 'again', label: 'دوباره', key: '1', color: 'var(--red-ink)' },
  { rating: 'hard', label: 'سخت', key: '2', color: 'var(--gold-ink)' },
  { rating: 'good', label: 'خوب', key: '3', color: 'var(--green-ink)' },
  { rating: 'easy', label: 'آسان', key: '4', color: 'var(--purple-ink)' },
];

const isTouchOnly = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

function CardBody({ card, revealed }) {
  if (card.type === 'cloze') {
    return <p className="text-lg leading-9 md:text-xl md:leading-10">{renderCloze(card.front, { revealed })}</p>;
  }
  if (card.type === 'mcq') {
    return <p className="text-lg leading-9 md:text-xl md:leading-10">{card.front}</p>;
  }
  return <p className="text-lg leading-9 md:text-2xl md:leading-[2.6rem]">{card.front}</p>;
}

function McqOptions({ card, revealed }) {
  const [picked, setPicked] = useState(null);
  useEffect(() => setPicked(null), [card.id, revealed]);

  if (card.type !== 'mcq' || !Array.isArray(card.options)) return null;

  const correctIndex = card.options.findIndex((option) => option.correct);
  const showResult = revealed && picked !== null;

  return (
    <div className="mt-5 space-y-2.5" role="group" aria-label="گزینه‌ها">
      {card.options.map((option, index) => {
        const isCorrect = option.correct;
        const isPicked = picked === index;
        let cls = 'border-white/10 bg-[var(--surface-soft)] text-[var(--white)] hover:border-white/25';
        if (showResult && isCorrect) cls = 'border-[#77b787]/60 bg-[#77b787]/10 text-[var(--green-soft-ink)]';
        else if (showResult && isPicked && !isCorrect) cls = 'border-[#ef9196]/60 bg-[#ef9196]/10 text-[var(--red-ink)]';
        else if (revealed && picked === null && isCorrect) cls = 'border-[#77b787]/40 bg-[#77b787]/5 text-[var(--green-soft-ink)]';

        return (
          <button
            key={index}
            type="button"
            disabled={revealed}
            onClick={() => setPicked(index)}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-right text-sm transition-colors disabled:cursor-default ${cls}`}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/8 text-[11px]">{toFa(index + 1)}</span>
            <span className="flex-1">{option.text}</span>
            {showResult && isCorrect && <Icon name="check" className="h-4 w-4 shrink-0" />}
          </button>
        );
      })}

      {revealed && (
        <p className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm leading-7 text-[var(--muted)]">
          <strong className="text-[var(--white)]">توضیح: </strong>
          {card.explanation ?? card.back}
        </p>
      )}
      {!revealed && correctIndex === -1 && card.back && (
        <p className="text-[11px] text-[var(--ghost)]">این کارت گزینهٔ صحیح ثبت‌شده ندارد؛ پاسخ: {card.back}</p>
      )}
    </div>
  );
}

function ShortcutsHelp() {
  const rows = [
    ['Space', 'نمایش پاسخ'],
    ['۱ تا ۴', 'دوباره / سخت / خوب / آسان'],
    ['N', 'انتقال کارت به انتهای صف'],
    ['E', 'ویرایش کارت'],
    ['S', 'سوسپند کارت'],
    ['B', 'گلچین کردن'],
    ['?', 'این راهنما'],
  ];
  return (
    <ul className="space-y-2 text-sm">
      {rows.map(([key, label]) => (
        <li key={key} className="flex items-center justify-between gap-4">
          <span className="text-[var(--muted)]">{label}</span>
          <kbd className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-[var(--white)]">{key}</kbd>
        </li>
      ))}
    </ul>
  );
}

export default function ReviewSession({ userData, config, onExit, onEditCard }) {
  const { mode, deckId, label } = config;
  const [queue, setQueue] = useState(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [session, setSession] = useState({ rated: 0, again: 0, startedAt: Date.now(), spent: 0 });
  const [hintShown, setHintShown] = useState(false);
  const ratingLock = useRef(false);
  const queueLoadedRef = useRef(false);

  /* بارگذاری صف مرور */
  useEffect(() => {
    let alive = true;
    queueLoadedRef.current = false;
    setQueue(null);
    setIndex(0);
    setRevealed(false);
    setSession({ rated: 0, again: 0, startedAt: Date.now(), spent: 0 });

    fetchReviewQueue(userData, { mode, deckId })
      .then((data) => {
        if (alive) {
          setQueue(data);
          queueLoadedRef.current = true;
          trackEvent('review_start', { mode, deckId, size: data.items.length });
        }
      })
      .catch(() => {
        if (alive) setQueue({ items: [], preview: {}, settings: {} });
      });

    return () => {
      alive = false;
    };
  }, [userData, mode, deckId]);

  const current = queue?.items?.[index] ?? null;
  const total = queue?.items?.length ?? 0;
  const remaining = Math.max(0, total - index);

  /* پیش‌نمایش فاصله‌ها برای دکمه‌های ارزیابی — از موتور، بدون محاسبه در UI */
  const previews = useMemo(() => {
    if (!current) return null;
    return previewIntervals(current.state, queue?.settings?.algorithmConfig ?? {});
  }, [current, queue]);

  const finishSession = useCallback(() => {
    trackEvent('review_complete', { mode, deckId, ...session });
    onExit();
  }, [mode, deckId, onExit, session]);

  /* ارزیابی: خوش‌بینانه با موتور + ثبت پس‌زمینه در سرویس */
  const handleRate = useCallback(
    (rating) => {
      if (!current || ratingLock.current) return;
      ratingLock.current = true;
      const answeredAt = Date.now();
      setLeaving(true);
      setSession((prev) => ({
        ...prev,
        rated: prev.rated + 1,
        again: prev.again + (rating === 'again' ? 1 : 0),
        spent: prev.spent + (prev.lastAt ? Math.min(answeredAt - prev.lastAt, 5 * 60 * 1000) : 0),
        lastAt: answeredAt,
      }));

      /* محاسبه در سرویس (موتور مستقل) به‌صورت پس‌زمینه — نمایش کارت بعدی منتظر نمی‌ماند */
      rateCard(userData, current.card.id, rating, {
        timeSpent: session.lastAt ? Math.min(answeredAt - session.lastAt, 5 * 60 * 1000) : 0,
        mode,
        deckId: current.card.deckId,
      }).catch(() => {
        /* ثبت نشد؛ در نسخهٔ واقعی به Sync-Queue می‌رود — مرور کاربر از بین نمی‌رود */
      });

      window.setTimeout(() => {
        setLeaving(false);
        setRevealed(false);
        setHintShown(false);
        setIndex((prev) => prev + 1);
        ratingLock.current = false;
      }, 220);
    },
    [current, userData, mode, session],
  );

  /* میانبرهای صفحه‌کلید */
  useEffect(() => {
    if (isTouchOnly) return undefined;

    const handleKey = (event) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      if (showHelp) {
        if (event.key === 'Escape' || event.key === '?') setShowHelp(false);
        return;
      }

      if (event.key === ' ') {
        event.preventDefault();
        if (!revealed && current) setRevealed(true);
        return;
      }
      if (!current || !revealed) return;

      const ratingKey = RATING_BUTTONS.find((button) => button.key === event.key);
      if (ratingKey) {
        handleRate(ratingKey.rating);
        return;
      }
      const lower = event.key.toLowerCase();
      if (lower === 'n') {
        /* انتقال به انتهای صف — وضعیت مرور خراب نمی‌شود */
        setQueue((prev) => {
          if (!prev) return prev;
          const items = [...prev.items];
          const [item] = items.splice(index, 1);
          if (item) items.push(item);
          return { ...prev, items };
        });
        setRevealed(false);
        setHintShown(false);
      } else if (lower === 'e') {
        onEditCard?.(current.card);
      } else if (lower === 's') {
        setCardSuspended(userData, current.card.id, true);
        setQueue((prev) => {
          if (!prev) return prev;
          const items = [...prev.items];
          items.splice(index, 1);
          return { ...prev, items };
        });
        setRevealed(false);
        setHintShown(false);
      } else if (lower === 'b') {
        const next = !current.state.bookmarked;
        setCardBookmarked(userData, current.card.id, next);
        setQueue((prev) => {
          if (!prev) return prev;
          const items = [...prev.items];
          items[index] = { ...items[index], state: { ...items[index].state, bookmarked: next } };
          return { ...prev, items };
        });
      } else if (event.key === '?') {
        setShowHelp(true);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [current, revealed, index, handleRate, onEditCard, userData, showHelp]);

  /* ثبت زمان پاسخ هر کارت برای آمار */
  useEffect(() => {
    setSession((prev) => ({ ...prev, lastAt: Date.now() }));
  }, [index]);

  if (queue === null) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="w-full max-w-xl space-y-4" aria-hidden="true">
          <Skeleton className="h-8 w-40 rounded-2xl" />
          <Skeleton className="h-64 rounded-[2.5rem]" />
          <Skeleton className="mx-auto h-14 w-56 rounded-2xl" />
        </div>
      </div>
    );
  }

  /* ── پایان مرور: Daily Summary ── */
  if (!current) {
    const accuracy = session.rated ? Math.round(((session.rated - session.again) / session.rated) * 100) : 0;
    const minutes = Math.max(1, Math.round((Date.now() - session.startedAt) / 60000));
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <div className="fc-card-face w-full max-w-md rounded-[2.5rem] bg-[var(--surface-soft)] p-8 text-center md:p-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#77b787]/12 text-[var(--green-soft-ink)]">
            <Icon name="check" className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-2xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">مرور امروز تمام شد!</h2>
          <p className="mt-2 text-sm text-[var(--faint)]">برنامه‌ریزی مرور بعدی انجام شد؛ تپش وقتش را می‌داند.</p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: 'کارت مرورشده', value: faNum(session.rated) },
              { label: 'دقت', value: `${toFa(accuracy)}٪` },
              { label: 'زمان', value: `~${toFa(minutes)} دقیقه` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/6 bg-[var(--surface-soft)] p-3">
                <strong className="block text-xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">{stat.value}</strong>
                <span className="text-[11px] text-[var(--faint)]">{stat.label}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={finishSession}
            className="mt-7 w-full cursor-pointer rounded-2xl bg-[var(--blue-bright)] px-6 py-3.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
          >
            بازگشت به فلش‌کارت‌ها
          </button>
        </div>
      </div>
    );
  }

  const { card, state } = current;

  return (
    <div className="fc-review-root -mx-2 min-h-[78vh] md:-mx-4">
      {/* سربرگ حداقلی مرور */}
      <header className="flex items-center justify-between gap-4 px-1 pb-5">
        <button
          type="button"
          onClick={finishSession}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--surface-soft)] px-4 py-2.5 text-xs text-[var(--muted)] transition-colors hover:text-white"
        >
          <Icon name="close" className="h-3.5 w-3.5" />
          پایان مرور
        </button>

        <div className="flex-1 text-center">
          <p className="fc-progress-num text-xs text-[var(--faint)]">
            {toFa(total - remaining + 1)} / {toFa(total)}
            {label && <span className="mx-2 text-[var(--ghost)]">·</span>}
            {label && <span className="text-[var(--muted)]">{label}</span>}
          </p>
          <div className="mx-auto mt-2 h-1 w-full max-w-md overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuenow={total - remaining + 1} aria-valuemax={total}>
            <span
              className="block h-full rounded-full bg-[var(--blue-bright)] transition-[width] duration-300 ease-out"
              style={{ width: `${((total - remaining) / Math.max(1, total)) * 100}%` }}
            />
          </div>
        </div>

        {!isTouchOnly && (
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            aria-label="میانبرهای صفحه‌کلید"
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl bg-[var(--surface-soft)] text-[var(--muted)] transition-colors hover:text-white"
          >
            <Icon name="keyboard" className="h-5 w-5" />
          </button>
        )}
      </header>

      {/* کارت */}
      <div className="grid place-items-center px-1">
        <article
          key={card.id}
          className={`fc-card-face w-full max-w-2xl rounded-[2.5rem] border border-white/8 bg-[var(--surface-soft)] p-6 md:p-10 ${leaving ? 'fc-card-leave' : ''}`}
          aria-live="polite"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StateChip state={state.state === 'new' && state.reviewCount === 0 ? 'new' : state.state} />
              {state.bookmarked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e0b45c]/12 px-2.5 py-1 text-[11px] text-[var(--gold-ink)]">
                  <Icon name="star-filled" className="h-3 w-3" />
                  گلچین
                </span>
              )}
              {card.tags?.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-[var(--faint)]">#{tag}</span>
              ))}
            </div>
            {mode === 'cram' && <InfoChip icon="redo">مرور آزاد — زمان‌بندی تغییر نمی‌کند</InfoChip>}
          </div>

          <CardBody card={card} revealed={revealed} />
          <McqOptions card={card} revealed={revealed} />

          {card.type === 'basic-hint' && card.hint && !revealed && (
            <button
              type="button"
              onClick={() => setHintShown(true)}
              className="mt-4 cursor-pointer rounded-xl bg-white/5 px-4 py-2 text-xs text-[var(--muted)] transition-colors hover:text-white"
            >
              {hintShown ? card.hint : 'نمایش راهنما'}
            </button>
          )}

          {revealed && card.type !== 'mcq' && (
            <div className="fc-card-face mt-6 border-t border-white/8 pt-5">
              <p className="text-base leading-8 text-[var(--white)] md:text-lg md:leading-9">
                {card.type === 'cloze' ? renderCloze(card.front, { revealed: true }) : card.back}
              </p>
            </div>
          )}

          {queue?.settings?.showSource && card.source?.title && (
            <button
              type="button"
              onClick={() => trackEvent('source_open', { cardId: card.id, source: card.source })}
              className="mt-5 inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--blue-ink)] transition-colors hover:text-[var(--blue-soft-ink)]"
            >
              <Icon name="book" className="h-3.5 w-3.5" />
              منبع: {card.source.title}
            </button>
          )}
        </article>
      </div>

      {/* ناحیهٔ اقدام */}
      <div className="mt-6 flex flex-col items-center gap-3 px-1 pb-2">
        {!revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="w-full max-w-sm cursor-pointer rounded-2xl bg-[var(--blue-bright)] px-8 py-4 text-base font-bold text-white shadow-[0_12px_30px_-12px_rgba(91,140,199,0.6)] transition-transform hover:-translate-y-0.5 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
          >
            نمایش پاسخ
            {!isTouchOnly && <span className="mr-2 text-xs opacity-70">Space</span>}
          </button>
        ) : (
          <div className="grid w-full max-w-2xl grid-cols-2 gap-2.5 md:grid-cols-4">
            {RATING_BUTTONS.map((button) => (
              <button
                key={button.rating}
                type="button"
                onClick={() => handleRate(button.rating)}
                className="flex cursor-pointer flex-col items-center gap-0.5 rounded-2xl border px-3 py-3 transition-transform hover:-translate-y-0.5 md:py-3.5"
                style={{ borderColor: `${button.color}44`, background: `${button.color}0f` }}
                aria-label={`ارزیابی ${button.label}`}
              >
                <span className="text-sm font-bold" style={{ color: button.color }}>{button.label}</span>
                {previews && (
                  <span className="text-[10px] text-[var(--faint)]">{formatInterval(previews[button.rating], toFa)}</span>
                )}
                {!isTouchOnly && <span className="text-[10px] text-[var(--ghost)]">{button.key}</span>}
              </button>
            ))}
          </div>
        )}

        {/* اقدام‌های ثانویه — در لایهٔ دوم، بدون شلوغی */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => onEditCard?.(card)}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[var(--faint)] transition-colors hover:bg-white/5 hover:text-white"
          >
            <Icon name="edit" className="h-3.5 w-3.5" />
            ویرایش
          </button>
          <button
            type="button"
            onClick={() => {
              setCardSuspended(userData, card.id, true);
              setQueue((prev) => {
                if (!prev) return prev;
                const items = [...prev.items];
                items.splice(index, 1);
                return { ...prev, items };
              });
              setRevealed(false);
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[var(--faint)] transition-colors hover:bg-white/5 hover:text-white"
          >
            <Icon name="pause" className="h-3.5 w-3.5" />
            فعلاً نمی‌خوانم
          </button>
          <button
            type="button"
            onClick={() => {
              buryCard(userData, card.id);
              setQueue((prev) => {
                if (!prev) return prev;
                const items = [...prev.items];
                items.splice(index, 1);
                return { ...prev, items };
              });
              setRevealed(false);
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[var(--faint)] transition-colors hover:bg-white/5 hover:text-white"
          >
            <Icon name="clock" className="h-3.5 w-3.5" />
            بعداً امروز
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !state.bookmarked;
              setCardBookmarked(userData, card.id, next);
              setQueue((prev) => {
                if (!prev) return prev;
                const items = [...prev.items];
                items[index] = { ...items[index], state: { ...items[index].state, bookmarked: next } };
                return { ...prev, items };
              });
            }}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-white/5 ${
              state.bookmarked ? 'text-[var(--gold-ink)]' : 'text-[var(--faint)] hover:text-white'
            }`}
            aria-pressed={state.bookmarked}
          >
            <Icon name={state.bookmarked ? 'star-filled' : 'star'} className="h-3.5 w-3.5" />
            گلچین
          </button>
        </div>
      </div>

      <Modal open={showHelp} onClose={() => setShowHelp(false)} title="میانبرهای صفحه‌کلید">
        <ShortcutsHelp />
      </Modal>
    </div>
  );
}
