const STORAGE_PREFIX = 'tapesh:review-notebook:v1';
const DAY = 24 * 60 * 60 * 1000;

export const G5_STAGES = [
  { id: 'G1', stage: 1, intervalDays: 1, label: 'مرور اول' },
  { id: 'G2', stage: 2, intervalDays: 2, label: 'مرور دوم' },
  { id: 'G3', stage: 3, intervalDays: 4, label: 'مرور سوم' },
  { id: 'G4', stage: 4, intervalDays: 8, label: 'مرور چهارم' },
  { id: 'G5', stage: 5, intervalDays: 16, label: 'مرور نهایی' },
];

export const REVIEW_ACTIVITY_TYPES = {
  learning: { label: 'یادگیری', color: '#5b8cc7' },
  test: { label: 'آزمون و تست', color: '#77b787' },
  flashcard: { label: 'فلش‌کارت', color: '#937fcd' },
  note: { label: 'یادداشت', color: '#ab8e7c' },
  other: { label: 'سایر', color: '#8b9299' },
};

const storageKey = (userId) => `${STORAGE_PREFIX}:${userId || 'guest'}`;

function startOfDay(value = Date.now()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function read(userId) {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(userId, items) {
  if (typeof window === 'undefined') return items;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('tapesh:review-notebook-updated'));
  } catch {
    /* پر شدن فضای ذخیره‌سازی نباید مسیر یادگیری را متوقف کند. */
  }
  return items;
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeItem(item) {
  const stage = Math.min(5, Math.max(1, Number(item.stage) || 1));
  return {
    activityType: 'learning',
    subject: '',
    description: '',
    status: 'active',
    history: [],
    ...item,
    stage,
  };
}

export const ReviewNotebookService = {
  getAll(userId) {
    return read(userId)
      .map(normalizeItem)
      .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
  },

  add(userId, payload, now = Date.now()) {
    const items = read(userId);
    const sourceId = payload.sourceId || createId();
    const duplicateIndex = items.findIndex(
      (item) => item.sourceType === payload.sourceType && item.sourceId === sourceId,
    );

    if (duplicateIndex >= 0 && items[duplicateIndex].status !== 'mastered') {
      const updated = {
        ...items[duplicateIndex],
        ...payload,
        sourceId,
        updatedAt: new Date(now).toISOString(),
      };
      items[duplicateIndex] = updated;
      write(userId, items);
      return normalizeItem(updated);
    }

    const learnedAt = new Date(now).toISOString();
    const item = normalizeItem({
      id: createId(),
      sourceId,
      sourceType: payload.sourceType || 'manual',
      title: payload.title?.trim() || 'مبحث بدون عنوان',
      subject: payload.subject?.trim() || '',
      description: payload.description?.trim() || '',
      activityType: REVIEW_ACTIVITY_TYPES[payload.activityType] ? payload.activityType : 'other',
      stage: 1,
      status: 'active',
      learnedAt,
      lastReviewedAt: null,
      dueAt: addDays(startOfDay(now), G5_STAGES[0].intervalDays),
      completedReviews: 0,
      history: [{ type: 'learned', at: learnedAt }],
      metadata: payload.metadata || {},
      createdAt: learnedAt,
      updatedAt: learnedAt,
    });

    write(userId, [item, ...items]);
    return item;
  },

  registerLearning(userId, payload, now = Date.now()) {
    return this.add(userId, { ...payload, activityType: 'learning', sourceType: payload.sourceType || 'course-unit' }, now);
  },

  completeReview(userId, itemId, now = Date.now()) {
    const items = read(userId);
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) return null;

    const current = normalizeItem(items[index]);
    if (current.status === 'mastered') return current;

    const reviewedAt = new Date(now).toISOString();
    const history = [
      ...(current.history || []),
      { type: 'reviewed', stage: current.stage, at: reviewedAt },
    ];

    const next = current.stage >= G5_STAGES.length
      ? {
          ...current,
          status: 'mastered',
          completedReviews: G5_STAGES.length,
          lastReviewedAt: reviewedAt,
          completedAt: reviewedAt,
          dueAt: null,
          history,
          updatedAt: reviewedAt,
        }
      : {
          ...current,
          stage: current.stage + 1,
          completedReviews: current.stage,
          lastReviewedAt: reviewedAt,
          dueAt: addDays(startOfDay(now), G5_STAGES[current.stage].intervalDays),
          history,
          updatedAt: reviewedAt,
        };

    items[index] = next;
    write(userId, items);
    return normalizeItem(next);
  },

  restart(userId, itemId, now = Date.now()) {
    const items = read(userId);
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) return null;

    const resetAt = new Date(now).toISOString();
    const next = normalizeItem({
      ...items[index],
      stage: 1,
      status: 'active',
      completedReviews: 0,
      lastReviewedAt: resetAt,
      completedAt: null,
      dueAt: addDays(startOfDay(now), G5_STAGES[0].intervalDays),
      history: [...(items[index].history || []), { type: 'restarted', at: resetAt }],
      updatedAt: resetAt,
    });
    items[index] = next;
    write(userId, items);
    return next;
  },

  remove(userId, itemId) {
    const items = read(userId);
    write(userId, items.filter((item) => item.id !== itemId));
  },

  getTiming(item, now = Date.now()) {
    if (item.status === 'mastered') return { state: 'mastered', days: null };
    const today = startOfDay(now);
    const due = startOfDay(item.dueAt);
    const days = Math.round((due - today) / DAY);
    if (days < 0) return { state: 'overdue', days: Math.abs(days) };
    if (days === 0) return { state: 'today', days: 0 };
    return { state: 'upcoming', days };
  },
};

export default ReviewNotebookService;
