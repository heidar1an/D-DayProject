/*
 * پل فلشکارت بین فرانت و v1 (فاز ۹).
 *
 * قرارداد v1:
 *   GET    /flashcards/decks              → { decks, meta }
 *   POST   /flashcards/decks              → { deck }                 (Idempotency-Key)
 *   GET    /flashcards/decks/{id}         → { deck }
 *   PUT    /flashcards/decks/{id}         → { deck }                 (version اختیاری ⇒ 409)
 *   DELETE /flashcards/decks/{id}         → 204
 *   POST   /flashcards/decks/{id}/clone   → { deck }                 (Idempotency-Key)
 *   GET    /flashcards/decks/{id}/cards   → { deck, cards, meta }
 *   GET    /flashcards/cards              → { cards, meta }
 *   POST   /flashcards/decks/{id}/cards   → { card } | { cards, meta.created } (Idempotency-Key)
 *   PUT    /flashcards/cards/{id}         → { card }
 *   DELETE /flashcards/cards/{id}         → { outcome: deleted|archived }
 *   POST   /flashcards/cards/{id}/suspend → { state }
 *   POST   /flashcards/cards/{id}/bury    → { state }
 *   POST   /flashcards/cards/{id}/bookmark→ { state }
 *   GET    /flashcards/review/queue       → { queue, meta.count }
 *   POST   /flashcards/review/{cardId}    → { review }               (Idempotency-Key؛ تکرار ⇒ همان نتیجه، تناقض ⇒ 409)
 *   GET    /flashcards/progress           → { progress }
 *
 * مرز اعتماد (فاز ۹): کلاینت فقط `rating` می‌فرستد. هر فیلدی مثل
 * `due_at`/`ease`/`interval_days`/`algorithm_version` در بدنهٔ مرور
 * **ساخته نمی‌شود و فرستاده نمی‌شود** — حالت مرور فقط از سرور می‌آید.
 *
 * رتبه‌ها و حالت‌ها واژگان سرورند: again/hard/good/easy.
 */

import { V1_REASON, newRequestKey, v1Request } from '../api/v1';

export const RATINGS = ['again', 'hard', 'good', 'easy'];
export const QUEUE_MODES = ['today', 'deck', 'weak', 'cram'];

/* ── نگاشت snake_case → camelCase (آینهٔ Resources سرور) ── */

function toDeck(row) {
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    visibility: row.visibility,
    isOfficial: Boolean(row.is_official),
    isOwned: Boolean(row.is_owned),
    cardsCount: Number(row.cards_count ?? 0),
    version: Number(row.version ?? 1),
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function toCard(row) {
  if (!row) return null;

  return {
    id: row.id,
    deckId: row.deck_id,
    front: row.front,
    back: row.back,
    position: Number(row.position ?? 0),
    status: row.status,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/* وضعیت مرور — از سرور می‌آید، هرگز کلاینت آن را نمی‌سازد. */
function toState(row) {
  if (!row) return null;

  return {
    cardId: row.card_id,
    state: row.state,
    algorithmVersion: row.algorithm_version,
    dueAt: row.due_at ?? null,
    intervalDays: Number(row.interval_days ?? 0),
    intervalMinutes: Number(row.interval_minutes ?? 0),
    ease: row.ease == null ? null : Number(row.ease),
    reviewCount: Number(row.review_count ?? 0),
    lapseCount: Number(row.lapse_count ?? 0),
    correctCount: Number(row.correct_count ?? 0),
    incorrectCount: Number(row.incorrect_count ?? 0),
    difficulty: row.difficulty == null ? null : Number(row.difficulty),
    stability: row.stability == null ? null : Number(row.stability),
    masteryScore: row.mastery_score == null ? null : Number(row.mastery_score),
    suspended: Boolean(row.suspended),
    buriedUntil: row.buried_until ?? null,
    bookmarked: Boolean(row.bookmarked),
    lastReviewedAt: row.last_reviewed_at ?? null,
    version: Number(row.version ?? 0),
  };
}

function toReview(row) {
  if (!row) return null;

  return {
    id: row.id,
    stateId: row.state_id,
    rating: row.rating,
    previousState: row.previous_state,
    newState: row.new_state,
    previousDueAt: row.previous_due_at ?? null,
    nextDueAt: row.next_due_at ?? null,
    previousIntervalMinutes: Number(row.previous_interval_minutes ?? 0),
    nextIntervalMinutes: Number(row.next_interval_minutes ?? 0),
    previousEase: row.previous_ease == null ? null : Number(row.previous_ease),
    nextEase: row.next_ease == null ? null : Number(row.next_ease),
    algorithmVersion: row.algorithm_version,
    reviewedAt: row.reviewed_at ?? null,
  };
}

function toQueueItem(item) {
  return {
    card: toCard(item?.card),
    deck: item?.deck ? { id: item.deck.id, title: item.deck.title } : null,
    state: toState(item?.state),
    /* پیش‌نمایش نتیجهٔ هر رتبه — محاسبهٔ سرور، بدون اثر جانبی. */
    preview: item?.preview ?? null,
  };
}

function toReviewResult(row) {
  if (!row) return null;

  return {
    cardId: row.card_id,
    deckId: row.deck_id,
    state: toState(row.state),
    review: toReview(row.review),
    preview: row.preview ?? null,
  };
}

/* ── کوئری ── */

function qs(params) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }

  const encoded = search.toString();

  return encoded ? `?${encoded}` : '';
}

function toMeta(meta) {
  if (!meta) return null;

  return {
    page: Number(meta.page ?? 1),
    perPage: Number(meta.perPage ?? 0),
    total: Number(meta.total ?? 0),
    lastPage: Number(meta.lastPage ?? 1),
  };
}

/* ── دک‌ها ── */

export async function fetchDecks({ owner, q, page, perPage } = {}) {
  const result = await v1Request(`/flashcards/decks${qs({ owner, q, page, perPage })}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, decks: (result.data?.decks ?? []).map(toDeck), meta: toMeta(result.meta) };
}

export async function fetchDeck(deckId) {
  const result = await v1Request(`/flashcards/decks/${encodeURIComponent(deckId)}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, deck: toDeck(result.data?.deck) };
}

export async function createDeck({ title, description = null, requestKey } = {}) {
  const result = await v1Request('/flashcards/decks', {
    method: 'POST',
    body: { title, description },
    idempotencyKey: requestKey ?? newRequestKey('deck'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, deck: toDeck(result.data?.deck) };
}

/*
 * `version` اختیاری است ولی اگر فرستاده شود و کسی دیگر دک را عوض کرده باشد ⇒
 * 409 و کلاینت باید refetch کند (optimistic lock سمت سرور).
 */
export async function updateDeck(deckId, { title, description, version, requestKey } = {}) {
  const result = await v1Request(`/flashcards/decks/${encodeURIComponent(deckId)}`, {
    method: 'PUT',
    body: { title, description, version },
    idempotencyKey: requestKey ?? newRequestKey('deck'),
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null, conflict: result.status === 409 };
  }

  return { ok: true, deck: toDeck(result.data?.deck) };
}

export async function deleteDeck(deckId) {
  const result = await v1Request(`/flashcards/decks/${encodeURIComponent(deckId)}`, { method: 'DELETE' });

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true };
}

/* کلون دک رسمی ⇒ دک شخصی؛ تاریخچهٔ مرور کپی نمی‌شود. */
export async function cloneDeck(deckId, { requestKey } = {}) {
  const result = await v1Request(`/flashcards/decks/${encodeURIComponent(deckId)}/clone`, {
    method: 'POST',
    idempotencyKey: requestKey ?? newRequestKey('deck'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, deck: toDeck(result.data?.deck) };
}

/* ── کارت‌ها ── */

export async function fetchDeckCards(deckId, { page, perPage } = {}) {
  const result = await v1Request(`/flashcards/decks/${encodeURIComponent(deckId)}/cards${qs({ page, perPage })}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return {
    ok: true,
    deck: result.data?.deck ?? null,
    cards: (result.data?.cards ?? []).map(toCard),
    meta: toMeta(result.meta),
  };
}

export async function fetchCards({ deckId, q, status, state, bookmarked, page, perPage } = {}) {
  const result = await v1Request(`/flashcards/cards${qs({ deckId, q, status, state, bookmarked, page, perPage })}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, cards: (result.data?.cards ?? []).map(toCard), meta: toMeta(result.meta) };
}

/*
 * ساخت کارت — تکی `{ front, back }` یا دسته‌ای `{ cards: [...] }`.
 * خروجی تکی: `{ card }`، دسته‌ای: `{ cards }`.
 */
export async function createCards(deckId, payload, { requestKey } = {}) {
  const result = await v1Request(`/flashcards/decks/${encodeURIComponent(deckId)}/cards`, {
    method: 'POST',
    body: payload,
    idempotencyKey: requestKey ?? newRequestKey('card'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  if (result.data?.card) return { ok: true, card: toCard(result.data.card), cards: null };
  if (result.data?.cards) return { ok: true, card: null, cards: result.data.cards.map(toCard) };

  return { ok: true, card: null, cards: [] };
}

export async function updateCard(cardId, { front, back, requestKey } = {}) {
  const result = await v1Request(`/flashcards/cards/${encodeURIComponent(cardId)}`, {
    method: 'PUT',
    body: { front, back },
    idempotencyKey: requestKey ?? newRequestKey('card'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, card: toCard(result.data?.card) };
}

/* حذف کارت با تاریخچهٔ مرور آرشیو می‌شود (`archived`) نه حذف فیزیکی. */
export async function deleteCard(cardId) {
  const result = await v1Request(`/flashcards/cards/${encodeURIComponent(cardId)}`, { method: 'DELETE' });

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, outcome: result.data?.outcome ?? 'deleted' };
}

export async function setCardSuspended(cardId, suspended, { requestKey } = {}) {
  const result = await v1Request(`/flashcards/cards/${encodeURIComponent(cardId)}/suspend`, {
    method: 'POST',
    body: { suspended: Boolean(suspended) },
    idempotencyKey: requestKey ?? newRequestKey('card'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, state: toState(result.data?.state) };
}

export async function buryCard(cardId, { days, requestKey } = {}) {
  const result = await v1Request(`/flashcards/cards/${encodeURIComponent(cardId)}/bury`, {
    method: 'POST',
    body: days ? { days } : {},
    idempotencyKey: requestKey ?? newRequestKey('card'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, state: toState(result.data?.state) };
}

export async function setCardBookmarked(cardId, bookmarked, { requestKey } = {}) {
  const result = await v1Request(`/flashcards/cards/${encodeURIComponent(cardId)}/bookmark`, {
    method: 'POST',
    body: { bookmarked: Boolean(bookmarked) },
    idempotencyKey: requestKey ?? newRequestKey('card'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, state: toState(result.data?.state) };
}

/* ── مرور ── */

export async function fetchReviewQueue({ mode, deckId, limit } = {}) {
  const result = await v1Request(`/flashcards/review/queue${qs({ mode, deckId, limit })}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return {
    ok: true,
    queue: (result.data?.queue ?? []).map(toQueueItem),
    count: Number(result.meta?.count ?? 0),
  };
}

/*
 * ثبت مرور. کلاینت فقط `rating` می‌فرستد؛ `requestKey` برای idempotency اجباری
 * است (تکرار همان کلید ⇒ همان نتیجهٔ قبلی، همان کلید با بدنهٔ دیگر ⇒ 409).
 */
export async function rateCard(cardId, { rating, requestKey } = {}) {
  const result = await v1Request(`/flashcards/review/${encodeURIComponent(cardId)}`, {
    method: 'POST',
    body: { rating },
    idempotencyKey: requestKey ?? newRequestKey('review'),
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null, conflict: result.status === 409 };
  }

  return { ok: true, review: toReviewResult(result.data?.review) };
}

/* پیشرفت مشتق‌شده از وضعیت + تاریخچه — هیچ وضعیت اضافه‌ای وجود ندارد. */
export async function fetchFlashcardProgress() {
  const result = await v1Request('/flashcards/progress');

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  const progress = result.data?.progress ?? {};

  return {
    ok: true,
    progress: {
      total: Number(progress.total ?? 0),
      new: Number(progress.new ?? 0),
      learning: Number(progress.learning ?? 0),
      due: Number(progress.due ?? 0),
      reviewedToday: Number(progress.reviewed_today ?? 0),
      mastered: Number(progress.mastered ?? 0),
      suspended: Number(progress.suspended ?? 0),
    },
  };
}

export { V1_REASON };
