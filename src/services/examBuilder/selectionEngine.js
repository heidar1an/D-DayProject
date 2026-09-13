/*
 * موتور انتخاب سؤال «آزمون‌ساز شخصی» — منطق خالص و بدون I/O.
 *
 * نقش این موتور: گرفتن مخزن سؤال (با وضعیت کاربر) + پیکربندی آزمون و خروجی دادنِ
 * «برنامهٔ آزمون» — یعنی سؤال‌های انتخاب‌شده به‌همراه تفکیک واقعی (درس/سختی/وضعیت)
 * و فهرست هشدارهای ساخت‌یافته. هیچ عددی ساختگی نیست؛ هر تفکیک از خود انتخاب
 * محاسبه می‌شود و اگر قیدی دقیقاً قابل رعایت نباشد، هشدار صادر می‌شود (بدون Silent Failure).
 *
 * ورودی مخزن: رکوردهای searchQuestions بانک تست → { question, userStat, bookmarked, inReview }
 * فیلترهای پیشرفته (سال/منبع/نوع/جستجو) قبل از رسیدن به موتور در سرویس اعمال شده‌اند؛
 * موتور خودش فقط دامنهٔ درس/مبحث، وضعیت، سهمیه‌ها و توزیع سختی را حل می‌کند.
 *
 * Randomization: انتخاب بدون جای‌گذاری (عدم تکرار تضمین‌شده) با RNG قابل Seed
 * (mulberry32) — بستر Seed-based generation آینده. ترتیب نهایی سؤال‌ها شافل می‌شود.
 */

/* ────────────────────────── RNG و نمونه‌گیری ────────────────────────── */

export function mulberry32(seed) {
  let a = seed ?? Math.floor(Math.random() * 2 ** 31);
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(list, rng) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/* نمونه‌گیری وزن‌دار بدون جای‌گذاری — پایهٔ انتخاب تصادفی و وزن‌دهی به ضعف کاربر */
function weightedSample(items, count, weightFn, rng) {
  const rest = [...items];
  const picks = [];
  const take = Math.min(count, rest.length);
  for (let step = 0; step < take; step += 1) {
    const weights = rest.map(weightFn);
    const sum = weights.reduce((total, weight) => total + weight, 0);
    let roll = rng() * sum;
    let index = rest.length - 1;
    for (let i = 0; i < rest.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    picks.push(rest[index]);
    rest.splice(index, 1);
  }
  return picks;
}

/* ────────────────────────── کمک‌تابع‌های تخصیص ────────────────────────── */

/* تخصیص عدد صحیح با روش بزرگ‌ترین باقیمانده — weights آبجکت کلیددار است و
   جمع خروجی همیشه برابر total */
function largestRemainder(weights, total, keys) {
  const out = {};
  keys.forEach((key) => {
    out[key] = 0;
  });
  if (total <= 0) return out;

  const sum = keys.reduce((acc, key) => acc + (weights[key] || 0), 0);
  if (sum <= 0) {
    return largestRemainder(
      Object.fromEntries(keys.map((key) => [key, 1])),
      total,
      keys,
    );
  }

  const raw = keys.map((key) => ((weights[key] || 0) * total) / sum);
  const floors = raw.map((value) => Math.floor(value));
  let rest = total - floors.reduce((acc, value) => acc + value, 0);
  const order = keys
    .map((key, index) => [index, raw[index] - floors[index]])
    .sort((a, b) => b[1] - a[1]);
  for (let i = 0; rest > 0 && i < order.length; i += 1, rest -= 1) {
    floors[order[i][0]] += 1;
  }
  keys.forEach((key, index) => {
    out[key] = floors[index];
  });
  return out;
}

/* وضعیت اصلی سؤال برای تفکیک — از عملکرد واقعی کاربر مشتق می‌شود */
export function statusOf(item) {
  if (!item.userStat) return 'unsolved';
  if (item.userStat.wrong > 0) return 'wrong';
  return 'solved';
}

function matchesStatus(item, status) {
  switch (status) {
    case 'unsolved':
      return !item.userStat;
    case 'solved':
      return Boolean(item.userStat);
    case 'wrong':
      return Boolean(item.userStat && item.userStat.wrong > 0);
    case 'correct':
      return Boolean(item.userStat && item.userStat.correct > 0 && item.userStat.wrong === 0);
    case 'bookmarked':
      return Boolean(item.bookmarked);
    case 'review':
      return Boolean(item.inReview);
    default:
      return true;
  }
}

/* وزن انتخاب سؤال — مباحث ضعیف کاربر شانس بیشتری می‌گیرند (وزن‌دهی داده‌محور) */
function questionWeight(item, weakTopicSet) {
  if (!weakTopicSet || weakTopicSet.size === 0) return 1;
  const topic = item.question.topicPath[0];
  const subtopic = item.question.topicPath[1];
  return weakTopicSet.has(topic) || (subtopic && weakTopicSet.has(subtopic)) ? 2.6 : 1;
}

/* ────────────────────────── پر کردن سلول سختی یک درس ────────────────────────── */

/*
 * توزیع `remaining` سؤال یک درس روی سطوح سختی طبق distribution؛ سلول کم‌ظرفیت
 * کسری‌اش به سایر سطوح منتقل می‌شود (cascade) و مقدار جابه‌جایی برگردانده می‌شود.
 */
function fillSubjectByDifficulty(candidates, remaining, distribution, weightFn, rng) {
  if (remaining <= 0 || candidates.length === 0) return { picks: [], moved: 0 };

  const cells = {};
  for (const item of candidates) {
    (cells[item.question.difficulty] ??= []).push(item);
  }

  const levels = Object.keys(distribution).filter((level) => distribution[level] > 0);
  const targets = levels.length
    ? largestRemainder(
        Object.fromEntries(levels.map((level) => [level, distribution[level]])),
        remaining,
        levels,
      )
    : { any: remaining };

  const adjusted = {};
  let assigned = 0;
  for (const [level, want] of Object.entries(targets)) {
    const available = level === 'any' ? 0 : (cells[level]?.length ?? 0);
    adjusted[level] = Math.min(want, available);
    assigned += adjusted[level];
  }

  /* cascade کسری به سطوح دارای ظرفیت — بزرگ‌ترین ظرفیت آزاد اول */
  let moved = 0;
  let deficit = remaining - assigned;
  while (deficit > 0) {
    const spares = Object.keys(cells)
      .filter((level) => (adjusted[level] ?? 0) < cells[level].length)
      .sort(
        (a, b) => cells[b].length - (adjusted[b] ?? 0) - (cells[a].length - (adjusted[a] ?? 0)),
      );
    if (!spares.length) break;
    adjusted[spares[0]] = (adjusted[spares[0]] ?? 0) + 1;
    deficit -= 1;
    moved += 1;
  }

  const picks = [];
  for (const [level, take] of Object.entries(adjusted)) {
    if (take > 0 && cells[level]) {
      picks.push(...weightedSample(cells[level], take, weightFn, rng));
    }
  }

  /* اگر حتی با cascade هم تکمیل نشد (درس تمام‌شده)، باقی را از هر سلول آزاد بردار */
  if (picks.length < remaining) {
    const pickedIds = new Set(picks.map((item) => item.question.id));
    const leftovers = candidates.filter((item) => !pickedIds.has(item.question.id));
    picks.push(...weightedSample(leftovers, remaining - picks.length, weightFn, rng));
  }

  return { picks, moved };
}

/* ────────────────────────── تفکیک واقعی انتخاب ────────────────────────── */

export function breakdownOf(items) {
  const bySubject = {};
  const byDifficulty = { easy: 0, medium: 0, hard: 0, very_hard: 0 };
  const byStatus = { unsolved: 0, solved: 0, wrong: 0, correct: 0, bookmarked: 0, review: 0 };

  for (const item of items) {
    bySubject[item.question.subject] = (bySubject[item.question.subject] ?? 0) + 1;
    byDifficulty[item.question.difficulty] = (byDifficulty[item.question.difficulty] ?? 0) + 1;
    byStatus[statusOf(item)] += 1;
    if (item.bookmarked) byStatus.bookmarked += 1;
    if (item.inReview) byStatus.review += 1;
  }
  return { bySubject, byDifficulty, byStatus };
}

/* ────────────────────────── زمان پیشنهادی ────────────────────────── */

/*
 * زمان پیشنهادی از میانگین زمان واقعی پاسخ‌دهندگان به سؤال‌های همین مخزن محاسبه
 * می‌شود (× ۱٫۳ فرصت تنفس) و به مضرب ۵ دقیقه گرد می‌شود.
 */
export function durationFromAvg(count, avgSec) {
  if (!count) return null;
  const minutes = Math.round((count * (avgSec || 75) * 1.3) / 60 / 5) * 5;
  return Math.max(5, minutes);
}

export function suggestDuration(count, pool) {
  if (!count) return null;
  const times = pool.map((item) => item.question.stats?.avgTimeSec).filter(Boolean);
  const avgSec = times.length
    ? times.reduce((sum, value) => sum + value, 0) / times.length
    : 75; // پیش‌فرض محتاطانه وقتی آماری در دسترس نیست
  return durationFromAvg(count, avgSec);
}

/* ────────────────────────── برنامه‌ریز اصلی آزمون ────────────────────────── */

export const EMPTY_PLAN = {
  questionIds: [],
  items: [],
  target: 0,
  poolSize: 0,
  warnings: [],
  breakdown: breakdownOf([]),
  subjectPlan: [],
  suggestedDuration: null,
};

export function planExam(pool, config = {}) {
  const {
    subjectIds = [],
    topicPaths = [],
    questionCount = 10,
    difficulty = { mode: 'mixed', level: null, distribution: { easy: 25, medium: 50, hard: 25, very_hard: 0 } },
    statuses = { base: 'any', quotas: [] },
    weakTopics = [],
    weaknessFocus = false,
    seed = null,
  } = config;

  const rng = mulberry32(seed);
  const warnings = [];
  const weakTopicSet = new Set(weakTopics ?? []);

  /* ۱) دامنهٔ درس/مبحث */
  const scoped = pool.filter((item) => {
    if (subjectIds.length && !subjectIds.includes(item.question.subject)) return false;
    if (topicPaths.length && !topicPaths.some((topic) => item.question.topicPath.includes(topic))) return false;
    return true;
  });

  if (!scoped.length) {
    return {
      ...EMPTY_PLAN,
      poolSize: 0,
      warnings: [{ code: 'no-match' }],
    };
  }

  /* ۲) وضعیت پایه (فقط حل‌نشده / فقط حل‌شده) */
  let scope = scoped;
  if (statuses.base === 'unsolved' || statuses.base === 'solved') {
    scope = scope.filter((item) => matchesStatus(item, statuses.base));
    if (!scope.length) {
      return {
        ...EMPTY_PLAN,
        poolSize: scoped.length,
        warnings: [{ code: 'status-empty', status: statuses.base }],
      };
    }
  }

  /* ۳) سقف تعداد — شفاف، نه سکوت */
  const target = Math.min(questionCount, scope.length);
  if (scope.length < questionCount) {
    warnings.push({ code: 'pool-smaller', requested: questionCount, available: scope.length });
  }

  /* ۴) سهم هر درس — ضعف‌محور: درس ضعیف‌تر سهم بیشتری می‌گیرد */
  const subjectIdsInScope = [...new Set(scope.map((item) => item.question.subject))];
  const subjectAvailability = {};
  for (const item of scope) {
    subjectAvailability[item.question.subject] = (subjectAvailability[item.question.subject] ?? 0) + 1;
  }
  const subjectWeights = Object.fromEntries(
    subjectIdsInScope.map((id) => {
      const base = subjectAvailability[id];
      if (!weaknessFocus || !weakTopicSet.size) return [id, base];
      /* وزن = سهم مباحث ضعیف در همان درس (حداقل ۲۰٪ وزن پایه حفظ می‌شود) */
      const weakShare =
        scope.filter(
          (item) => item.question.subject === id && questionWeight(item, weakTopicSet) > 1,
        ).length / base;
      return [id, base * (0.2 + 0.8 * (weakShare || 0))];
    }),
  );
  const subjectTargets = largestRemainder(subjectWeights, target, subjectIdsInScope);

  const selected = [];
  const selectedIds = new Set();
  const takeItem = (item) => {
    selected.push(item);
    selectedIds.add(item.question.id);
  };

  /* ۵) فاز سهمیه‌ها — «حداقل N از ...» (مهم‌ترین قید اول رعایت می‌شود) */
  const quotaPicksPerSubject = {};
  for (const quota of statuses.quotas ?? []) {
    if (!quota?.status || !quota.min) continue;
    const candidates = scope.filter((item) => !selectedIds.has(item.question.id) && matchesStatus(item, quota.status));
    if (candidates.length < quota.min) {
      warnings.push({
        code: 'quota-clamped',
        status: quota.status,
        requested: quota.min,
        available: candidates.length,
      });
    }
    if (!candidates.length) continue;

    /* ترجیح نرم به درس‌هایی که سهم بیشتری دارند تا تخصیص درسی به‌هم نریزد */
    const take = Math.min(quota.min, candidates.length);
    const prefer = (item) =>
      (subjectTargets[item.question.subject] ?? 0) > 0 ? 2.2 : 0.6;
    const picks = weightedSample(candidates, take, prefer, rng);
    picks.forEach(takeItem);
    for (const item of picks) {
      quotaPicksPerSubject[item.question.subject] = (quotaPicksPerSubject[item.question.subject] ?? 0) + 1;
    }
  }

  /* ۶) فاز پر کردن — در هر درس: باقی سهمش طبق توزیع سختی */
  let totalMoved = 0;
  const subjectPlan = [];
  for (const subjectId of subjectIdsInScope) {
    const requested = subjectTargets[subjectId] ?? 0;
    const fulfilled = quotaPicksPerSubject[subjectId] ?? 0;
    const remaining = Math.max(0, requested - fulfilled);
    const candidates = scope.filter(
      (item) => item.question.subject === subjectId && !selectedIds.has(item.question.id),
    );

    const distribution =
      difficulty.mode === 'single'
        ? { [difficulty.level ?? 'medium']: 100 }
        : difficulty.distribution;

    const { picks, moved } = fillSubjectByDifficulty(candidates, remaining, distribution ?? null, (item) => questionWeight(item, weakTopicSet), rng);
    totalMoved += moved;
    picks.forEach(takeItem);

    subjectPlan.push({
      subjectId,
      requested,
      actual: fulfilled + picks.length,
    });
  }

  /* ۷) top-up جهانی — اگر سهمیه‌ها سهم درسی را جابه‌جا کرده‌اند، جای خالی پر می‌شود */
  const weightFn = (item) => questionWeight(item, weakTopicSet);
  while (selected.length < target) {
    const leftovers = scope.filter((item) => !selectedIds.has(item.question.id));
    if (!leftovers.length) break;
    weightedSample(leftovers, 1, weightFn, rng).forEach(takeItem);
  }

  if (totalMoved > 0) {
    warnings.push({ code: 'difficulty-adjusted', moved: totalMoved });
  }

  /* ۸) هشدار درس کم‌مخزن — فقط وقتی واقعاً کسری خورده باشد */
  for (const entry of subjectPlan) {
    if (entry.actual < entry.requested) {
      warnings.push({
        code: 'subject-short',
        subjectId: entry.subjectId,
        requested: entry.requested,
        available: entry.actual,
      });
    }
  }

  /* ۹) ترتیب نهایی تصادفی + تفکیک واقعی */
  const items = shuffleInPlace([...selected], rng);
  return {
    questionIds: items.map((item) => item.question.id),
    items,
    target: items.length,
    poolSize: scoped.length,
    warnings,
    breakdown: breakdownOf(items),
    subjectPlan,
    suggestedDuration: suggestDuration(items.length, scope),
  };
}

/* ────────────────────────── مباحث مرتبط (قلاب شبکهٔ دانش) ────────────────────────── */

/*
 * یافتن مباحث مرتبط «از دل دادهٔ واقعی» — نه لیست هاردکد:
 *   ۱) ساختار واقعی درخت مبحث: والد/فرزند/هم‌شاخه
 *   ۲) هم‌نام بودن مبحث در درس دیگر (مثل «تعادل اسید-باز» در فیزیولوژی و بیوشیمی)
 *   ۳) هم‌تگ بودن سؤال‌های دو مبحث در بانک (هم‌پوشانی محتوایی واقعی)
 * قرارداد آینده: همین امضا به Knowledge Graph واقعی وصل می‌شود و امتیازدهی از گراف می‌آید.
 */
export function findRelatedTopics(topicName, topicTree, questions) {
  const scores = new Map(); // topic → { topic, subjectId, score, reasons: Set }

  const bump = (topic, subjectId, reason, score) => {
    if (!topic || topic === topicName) return;
    const entry = scores.get(topic) ?? { topic, subjectId, score: 0, reasons: new Set() };
    entry.score += score;
    entry.reasons.add(reason);
    scores.set(topic, entry);
  };

  for (const [subjectId, branches] of Object.entries(topicTree ?? {})) {
    for (const branch of branches) {
      if (branch.name === topicName) {
        /* فرزندان */
        for (const child of branch.children ?? []) bump(child, subjectId, 'زیرمبحث همان مبحث', 3);
        /* هم‌شاخه‌ها */
        for (const sibling of branches) {
          if (sibling.name !== topicName) bump(sibling.name, subjectId, 'مبحث هم‌درس', 1.5);
        }
      } else {
        /* این مبحث فرزندِ شاخهٔ موردنظر است؟ */
        if ((branch.children ?? []).includes(topicName)) {
          bump(branch.name, subjectId, 'مبحث والد', 3);
          for (const sibling of branch.children ?? []) {
            if (sibling !== topicName) bump(sibling, subjectId, 'زیرمبحث هم‌شاخه', 2);
          }
        }
        /* هم‌نام بین درس‌ها */
        if (branch.name === topicName) bump(branch.name, subjectId, 'هم‌نام در درس دیگر', 2.5);
        if ((branch.children ?? []).includes(topicName)) {
          /* خود شاخه در درس دیگر — بالا هندل شد */
        }
      }
    }
  }

  /* هم‌پوشانی تگ‌ها در بانک سؤال */
  const tagsOfTopic = new Set();
  for (const question of questions) {
    if (question.topicPath.includes(topicName)) {
      question.tags.forEach((tag) => tagsOfTopic.add(tag));
    }
  }
  if (tagsOfTopic.size) {
    for (const question of questions) {
      const topic = question.topicPath[0];
      const subtopic = question.topicPath[1];
      if (topic === topicName || subtopic === topicName) continue;
      const shared = question.tags.filter((tag) => tagsOfTopic.has(tag)).length;
      if (shared > 0) {
        bump(topic, question.subject, 'هم‌پوشانی محتوایی در بانک تست', shared * 1.2);
        if (subtopic) bump(subtopic, question.subject, 'هم‌پوشانی محتوایی در بانک تست', shared * 1.2);
      }
    }
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ topic, subjectId, score, reasons }) => ({ topic, subjectId, score, reason: [...reasons][0] }));
}
