/* ── موتور جست‌وجوی ویکی تپش (Tapesh Knowledge Search) ──
   مدل مفهومی رتبه‌بندی (بالاتر = مرتبط‌تر):
     Exact Title Match > Abbreviation/Alias Exact > Title Contains > Alias/EN Match
     > Keyword Match > Topic/Subject Relevance > Summary/Body Hit
     > Related-to-a-strong-match > Popularity
   همه امتیازها در PROVENANCE هر نتیجه ثبت می‌شوند تا هم برای دیباگ و هم برای
   انتقال آینده weightها به بک‌اند شفاف باشد. UI فقط به score نهایی نگاه می‌کند.

   نکته معماری: هر تابعی که به داده نیاز دارد، آن را به‌صورت پارامتر می‌گیرد؛
   این فایل هیچ stateی ندارد و در نسخه بک‌اند، همین قرارداد به یک endpoint تبدیل می‌شود. */

import { WIKI_ENTITIES, SUBJECTS, HOT_SEARCHES } from './mockData';

/* ─────────────────────────── نرمال‌سازی ───────────────────────────
   فارسی و لاتین به یک نمایه مشترک: ی/ك عربی → فارسی، آ/أ/إ → ا، حذف اعراب و نیم‌فاصله،
   ارقام فارسی/عربی → لاتین، حذف نویسه‌های غیرحرفی. */
const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;
const NON_WORD = /[^a-z0-9\u0600-\u06FF ]+/g;

export const normalize = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ(?=[اوهی])/g, 'ی')
    .replace(DIACRITICS, '')
    .replace(/\u200c/g, ' ')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(NON_WORD, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (text) => (normalize(text) ? normalize(text).split(' ') : []);

/* فاصله لونشتاین با پیچیدگی خطی دو رشته — برای حدس اصلاح عبارت */
const editDistance = (a, b) => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
};

/* ─────────────────────────── وزن‌های رتبه‌بندی ───────────────────────────
   در نسخه بک‌اند همین ساختار از تنظیمات سرور می‌آید؛ UI هیچ عددی از خودش ندارد. */
export const RANKING_WEIGHTS = {
  titleExact: 1000,
  titleStartsWith: 860,
  titleIncludes: 720,
  abbreviationExact: 960,
  aliasExact: 900,
  englishExact: 930,
  englishIncludes: 700,
  aliasIncludes: 480,
  keywordToken: 70,
  keywordCap: 280,
  titleToken: 110,
  titleTokenCap: 330,
  aliasToken: 80,
  aliasTokenCap: 240,
  subjectToken: 60,
  topicToken: 75,
  summaryPhrase: 170,
  bodyPhrase: 110,
  bodyToken: 18,
  bodyTokenCap: 90,
  relatedBoost: 0.22,
  relatedBoostCap: 170,
  popularityFactor: 1.15,
  minScore: 36,
  primaryThreshold: 700,
  primaryDominance: 1.45,
};

/* ─────────────────────────── نمایه جست‌وجو ───────────────────────────
   یک بار برای کل مجموعه ساخته می‌شود؛ افزودن موجودیت جدید فقط یعنی بازسازی این نمایه. */
const blockText = (block) => {
  switch (block.type) {
    case 'table':
      return [block.caption, ...block.headers, ...block.rows.flat()].filter(Boolean).join(' ');
    case 'callout':
      return [block.title, block.text].filter(Boolean).join(' ');
    case 'list':
      return block.items.join(' ');
    case 'formula':
      return [block.expr, block.note].filter(Boolean).join(' ');
    case 'quote':
      return [block.text, block.cite].filter(Boolean).join(' ');
    default:
      return block.text ?? '';
  }
};

const ENTITY_TEXT = (entity) => {
  const body = entity.sections
    .flatMap((section) => section.blocks.map(blockText))
    .join(' ');
  return `${entity.summary} ${body}`;
};

const buildIndex = (entities) =>
  entities.map((entity) => ({
    entity,
    /* نسخه نرمال‌شده فقط برای تطبیق؛ نمایش پیشنهادها با متن اصلی انجام می‌شود */
    raw: {
      title: entity.title,
      englishTitle: entity.englishTitle,
      aliases: entity.aliases,
      abbreviations: entity.abbreviations,
      keywords: entity.keywords,
      topic: entity.topic,
      subject: SUBJECTS.find((sub) => sub.id === entity.subject)?.label ?? entity.subject,
    },
    title: normalize(entity.title),
    english: normalize(entity.englishTitle),
    aliases: entity.aliases.map(normalize).filter(Boolean),
    abbreviations: entity.abbreviations.map((a) => normalize(a)).filter(Boolean),
    keywords: entity.keywords.map(normalize).filter(Boolean),
    subject: normalize(SUBJECTS.find((s) => s.id === entity.subject)?.label ?? entity.subject),
    topic: normalize(entity.topic),
    summary: normalize(entity.summary),
    body: normalize(ENTITY_TEXT(entity)),
  }));

const INDEX = buildIndex(WIKI_ENTITIES);

/* مجموعه واژه‌های شناخته‌شده برای «آیا منظورتان … بود؟» */
const KNOWN_TERMS = (() => {
  const terms = new Set();
  INDEX.forEach((doc) => {
    tokenize(doc.title).forEach((t) => t.length >= 3 && terms.add(t));
    doc.aliases.forEach((alias) => tokenize(alias).forEach((t) => t.length >= 3 && terms.add(t)));
    doc.abbreviations.forEach((abbr) => terms.add(abbr));
    doc.keywords.forEach((keyword) => tokenize(keyword).forEach((t) => t.length >= 4 && terms.add(t)));
  });
  return [...terms];
})();

/* نمایش خوانا برای اصلاح عبارت: واژه غلط → کامل‌ترین عبارت اصلی که همان واژه را دارد */
const TOKEN_PHRASES = (() => {
  const map = new Map();
  const addPhrase = (phrase) => {
    tokenize(phrase).forEach((token) => {
      if (token.length < 3) return;
      const current = map.get(token);
      if (!current || phrase.length < current.length) map.set(token, phrase);
    });
  };
  WIKI_ENTITIES.forEach((entity) => {
    addPhrase(entity.title);
    entity.aliases.forEach(addPhrase);
    entity.abbreviations.forEach(addPhrase);
    entity.keywords.forEach(addPhrase);
  });
  return map;
})();

/* ─────────────────────────── امتیازدهی یک موجودیت ─────────────────────────── */

const scoreField = (field, phrase, tokens, { exact, startsWith, includes, token, cap = Infinity }) => {
  let score = 0;
  if (!field) return 0;

  if (phrase) {
    if (field === phrase) score += exact;
    else if (field.startsWith(phrase)) score += startsWith;
    else if (field.includes(phrase)) score += includes;
  }

  if (score === 0 && token) {
    let hits = 0;
    tokens.forEach((t) => {
      if (field === t || field.includes(t)) hits += 1;
    });
    score += Math.min(hits * token, cap);
  }

  return score;
};

const scoreEntity = (doc, query) => {
  const phrase = normalize(query);
  const tokens = tokenize(query);
  if (!phrase) return null;
  const W = RANKING_WEIGHTS;

  const provenance = [];

  /* عنوان فارسی و انگلیسی */
  const titleScore = scoreField(doc.title, phrase, tokens, {
    exact: W.titleExact, startsWith: W.titleStartsWith, includes: W.titleIncludes,
    token: W.titleToken, cap: W.titleTokenCap,
  });
  if (titleScore) provenance.push(['title', titleScore]);

  const englishScore = scoreField(doc.english, phrase, tokens, {
    exact: W.englishExact, startsWith: W.englishExact - 40, includes: W.englishIncludes,
    token: W.titleToken, cap: W.titleTokenCap,
  });
  if (englishScore) provenance.push(['english', englishScore]);

  /* مخفف‌ها — تطابق دقیق فقط */
  let abbrScore = 0;
  doc.abbreviations.forEach((abbr) => {
    if (abbr === phrase) abbrScore = Math.max(abbrScore, W.abbreviationExact);
    else if (tokens.some((t) => t === abbr)) abbrScore = Math.max(abbrScore, W.abbreviationExact - 60);
  });
  if (abbrScore) provenance.push(['abbreviation', abbrScore]);

  /* مترادف‌ها */
  let aliasScore = 0;
  doc.aliases.forEach((alias) => {
    aliasScore = Math.max(
      aliasScore,
      scoreField(alias, phrase, tokens, {
        exact: W.aliasExact, startsWith: W.aliasExact - 60, includes: W.aliasIncludes,
        token: W.aliasToken, cap: W.aliasTokenCap,
      }),
    );
  });
  if (aliasScore) provenance.push(['alias', aliasScore]);

  /* کلیدواژه‌ها، درس و موضوع */
  let keywordScore = 0;
  doc.keywords.forEach((keyword) => {
    keywordScore = Math.max(
      keywordScore,
      scoreField(keyword, phrase, tokens, { exact: W.keywordToken * 3, startsWith: W.keywordToken * 2, includes: W.keywordToken }),
    );
  });
  keywordScore = Math.min(keywordScore, W.keywordCap);
  if (keywordScore) provenance.push(['keyword', keywordScore]);

  const subjectScore = scoreField(doc.subject, phrase, tokens, { includes: W.subjectToken, token: W.subjectToken, cap: W.subjectToken * 2 });
  if (subjectScore) provenance.push(['subject', subjectScore]);

  const topicScore = scoreField(doc.topic, phrase, tokens, { includes: W.topicToken, token: W.topicToken, cap: W.topicToken * 2 });
  if (topicScore) provenance.push(['topic', topicScore]);

  /* خلاصه و متن بدنه */
  const summaryScore = doc.summary.includes(phrase) ? W.summaryPhrase : 0;
  if (summaryScore) provenance.push(['summary', summaryScore]);

  let bodyTokenHits = 0;
  tokens.forEach((t) => { if (doc.body.includes(t)) bodyTokenHits += 1; });
  let bodyScore = doc.body.includes(phrase) ? W.bodyPhrase : 0;
  bodyScore += Math.min(bodyTokenHits * W.bodyToken, W.bodyTokenCap);
  if (bodyScore) provenance.push(['body', bodyScore]);

  const direct = provenance.reduce((sum, [, value]) => sum + value, 0);
  const popularity = Math.round(doc.entity.popularity * W.popularityFactor);

  return { doc, provenance, direct, popularity };
};

/* تقویت مرتبط‌ها: نتیجه‌ای که به یک تطابق قوی وصل است، خودش هم بالا می‌آید.
   این همان «Topic Relevance» گراف دانش است و در بک‌اند با PageRank-like هم قابل جایگزینی. */
const withRelatedBoost = (scoredDocs) => {
  const strong = new Map();
  scoredDocs.forEach(({ doc, direct }) => {
    if (direct >= RANKING_WEIGHTS.primaryThreshold) strong.set(doc.entity.slug, direct);
  });
  if (strong.size === 0) return scoredDocs;

  const boostBySlug = new Map();
  WIKI_ENTITIES.forEach((entity) => {
    let best = 0;
    entity.related.forEach(({ slug }) => {
      const strength = strong.get(slug);
      if (strength) best = Math.max(best, strength * RANKING_WEIGHTS.relatedBoost);
    });
    if (best) boostBySlug.set(entity.slug, Math.min(best, RANKING_WEIGHTS.relatedBoostCap));
  });

  return scoredDocs.map((entry) => ({
    ...entry,
    /* تطابق‌های قطعی (عنوان دقیق/مخفف) با تقویت رابطه جابه‌جا نمی‌شوند */
    related:
      entry.direct < RANKING_WEIGHTS.primaryThreshold
        ? boostBySlug.get(entry.doc.entity.slug) ?? 0
        : 0,
  }));
};

/* ─────────────────────────── API جست‌وجو ─────────────────────────── */

const SORTERS = {
  relevance: (a, b) => b.score - a.score || b.scoredPopularity - a.scoredPopularity,
  popular: (a, b) => b.doc.entity.popularity - a.doc.entity.popularity || b.score - a.score,
  recent: (a, b) => b.doc.entity.lastUpdated.localeCompare(a.doc.entity.lastUpdated),
  title: (a, b) => a.doc.entity.title.localeCompare(b.doc.entity.title, 'fa'),
};

/* جست‌وجوی اصلی — خروجی کامل صفحه نتایج */
export function searchWiki(
  query,
  { filters = {}, sort = 'relevance', limit = 30 } = {},
) {
  const phrase = normalize(query);
  if (!phrase) {
    return { query, total: 0, primary: null, results: [], didYouMean: null, relatedSearches: [] };
  }

  let scored = INDEX.map((doc) => scoreEntity(doc, query)).filter(Boolean);
  scored = withRelatedBoost(scored)
    .map(({ doc, provenance, direct, popularity, related = 0 }) => ({
      doc,
      provenance,
      /* محبوبیت فقط نتایج واقعاً مرتبط را بالا می‌برد؛ نتایج صفر را نمی‌سازد */
      score: direct + related + (direct > 0 || related > 0 ? popularity : 0),
      directScore: direct,
      scoredPopularity: direct > 0 || related > 0 ? popularity : 0,
    }))
    .filter(({ score, directScore, related }) =>
      score >= RANKING_WEIGHTS.minScore && (directScore > 0 || related > 0));

  scored.sort(SORTERS.relevance);

  /* فیلترها — subject/type/difficulty */
  const passesFilters = (entity) =>
    (!filters.subject || entity.subject === filters.subject) &&
    (!filters.type || entity.type === filters.type) &&
    (!filters.difficulty || entity.difficulty === filters.difficulty);

  const all = scored.filter(({ doc }) => passesFilters(doc.entity));
  const total = all.length;
  const sorted = all.slice(1).sort(SORTERS[sort] ?? SORTERS.relevance);

  /* نتیجه اصلی: بالاترین امتیاز اگر به‌قدر کافی قوی و جلوتر از رقیب باشد */
  let primary = null;
  if (all.length > 0) {
    const [best, ...rest] = all;
    const decisive =
      best.directScore >= RANKING_WEIGHTS.primaryThreshold ||
      (rest.length === 0 && best.score >= RANKING_WEIGHTS.primaryThreshold / 2) ||
      (rest.length > 0 && best.score >= RANKING_WEIGHTS.primaryThreshold &&
        best.score >= rest[0].score * RANKING_WEIGHTS.primaryDominance);
    if (decisive) {
      primary = best;
    } else {
      all.sort(SORTERS[sort] ?? SORTERS.relevance);
    }
  }

  const results = primary ? sorted : all.slice(0, limit);

  /* اصلاح عبارت وقتی نتیجه معناداری نیست */
  let didYouMean = null;
  /* وقتی نتیجه اصلی قطعی نداریم و بهترین تطبیق هم ضعیف است، اصلاح عبارت را پیشنهاد بده */
  const isWeak =
    primary === null &&
    (results.length === 0 || (results[0]?.directScore ?? 0) < 150);
  if (isWeak) didYouMean = suggestCorrection(query);

  return {
    query,
    total,
    primary,
    results,
    didYouMean,
    relatedSearches: buildRelatedSearches(query, primary),
    facets: buildFacets(all),
  };
}

/* پیشنهاد «آیا منظورتان … بود؟» — نزدیک‌ترین واژه شناخته‌شده */
export function suggestCorrection(query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return null;

  let bestTerm = null;
  let bestDistance = Infinity;
  tokens.forEach((token) => {
    if (token.length < 3) return;
    const allowed = token.length >= 6 ? 2 : 1;
    KNOWN_TERMS.forEach((term) => {
      const distance = editDistance(token, term);
      if (distance > 0 && distance <= allowed && distance < bestDistance) {
        bestDistance = distance;
        bestTerm = term;
      }
    });
  });

  return bestTerm ? TOKEN_PHRASES.get(bestTerm) ?? bestTerm : null;
}

/* جست‌وجوهای مرتبط برای پای صفحه نتایج — از کلیدواژه‌ها و روابط نتیجه اصلی */
function buildRelatedSearches(query, primaryDoc) {
  const base = [];
  if (primaryDoc) {
    const { entity } = primaryDoc.doc;
    entity.keywords.slice(0, 4).forEach((keyword) => base.push(keyword));
    entity.related.slice(0, 3).forEach(({ slug }) => {
      const target = WIKI_ENTITIES.find((e) => e.slug === slug);
      if (target) base.push(target.title);
    });
  }
  const normalizedQuery = normalize(query);
  return [...new Set(base.filter((term) => normalize(term) !== normalizedQuery))].slice(0, 6);
}

/* شمارنده فیلترها از میان نتایج فعلی */
function buildFacets(scoredDocs) {
  const bySubject = {};
  const byType = {};
  const byDifficulty = {};
  scoredDocs.forEach(({ doc }) => {
    bySubject[doc.entity.subject] = (bySubject[doc.entity.subject] ?? 0) + 1;
    byType[doc.entity.type] = (byType[doc.entity.type] ?? 0) + 1;
    byDifficulty[doc.entity.difficulty] = (byDifficulty[doc.entity.difficulty] ?? 0) + 1;
  });
  return { bySubject, byType, byDifficulty };
}


/* ─────────────────────────── اسنیپت نتایج ───────────────────────────
   برش متن اصلی (غیر نرمال‌شده) حول عبارت یافته‌شده برای نمایش گوگل‌مانند.
   به‌جای نگاشت ایندکس نرمال، regex متلطفی ساخته می‌شود که واریانت‌های حروف
   (آ/ا، ی/ي، ک/ك، نیم‌فاصله) را روی خودِ متن اصلی پوشش می‌دهد. */

const escapeRegex = (ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const CHAR_CLASSES = {
  'ا': '[اأإآ]',
  'ی': '[یيى]',
  'ک': '[كکک]',
  'و': '[وؤ]',
  'ه': '[هة]',
};

const looseRegex = (query) => {
  const parts = tokenize(query)
    .filter((token) => token.length >= 2)
    .map((token) =>
      token
        .split('')
        .map((ch) => CHAR_CLASSES[ch] ?? (ch === ' ' ? '[\\s\\u200c]+' : escapeRegex(ch)))
        .join(''),
    );
  if (parts.length === 0) return null;
  return new RegExp(parts.join('[\\s\\u200c]*'), 'i');
};

const SNIPPET_CONTEXT = 82;

const cutSnippet = (text, start, end) => {
  const from = Math.max(0, start - SNIPPET_CONTEXT);
  const to = Math.min(text.length, end + SNIPPET_CONTEXT);
  const cut = text.slice(from, to).replace(/\s+/g, ' ').trim();
  return {
    text: `${from > 0 ? '…' : ''}${cut}${to < text.length ? '…' : ''}`,
    match: text.slice(start, end),
  };
};

/* اولین تطابق را در خلاصه و سپس بدنه مقاله پیدا می‌کند */
export function buildSnippet(entity, query) {
  const regex = looseRegex(query);
  const blocks = entity.sections
    .flatMap((section) => section.blocks.map(blockText))
    .filter(Boolean);

  for (const text of [entity.summary, ...blocks]) {
    if (!regex) break;
    const match = regex.exec(text);
    if (match) return cutSnippet(text, match.index, match.index + match[0].length);
  }

  /* تطابق مستقیم نبود — خلاصه به‌عنوان پیش‌نمایش پیش‌فرض */
  return { text: entity.summary, match: null };
}

/* ─────────────────────────── پیشنهادهای زنده (Autocomplete) ─────────────────────────── */

/* هر پیشنهاد: { kind, label, hint?, slug? } — kind: entity|abbr|keyword|subject|topic|history */
export function suggestWiki(query, { limit = 8, exclude = [] } = {}) {
  const phrase = normalize(query);
  if (!phrase) return [];
  const skip = new Set(exclude.map(normalize));

  const candidates = [];

  INDEX.forEach((doc) => {
    const { entity } = doc;

    const push = (label, kind, hint, priority) => {
      const normalizedLabel = normalize(label);
      if (skip.has(normalizedLabel)) return;
      let score = 0;
      if (normalizedLabel === phrase) score = priority;
      else if (normalizedLabel.startsWith(phrase)) score = priority - 100;
      else if (normalizedLabel.includes(phrase)) score = priority - 220;
      if (score > 0) candidates.push({ kind, label, hint, slug: entity.slug, score });
    };

    push(doc.raw.title, 'entity', doc.raw.englishTitle, 500);
    push(doc.raw.englishTitle, 'entity', doc.raw.title, 430);
    doc.raw.abbreviations.forEach((abbr) => push(abbr, 'abbr', doc.raw.title, 470));
    doc.raw.aliases.forEach((alias) => push(alias, 'entity', doc.raw.title, 380));
    doc.raw.keywords.forEach((keyword) => push(keyword, 'keyword', doc.raw.title, 300));
    push(doc.raw.topic, 'topic', doc.raw.title, 260);
    push(doc.raw.subject, 'subject', null, 240);
  });

  const deduped = [];
  const seen = new Set();
  candidates
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'fa'))
    .forEach((candidate) => {
      const key = `${normalize(candidate.label)}|${candidate.kind}`;
      if (seen.has(key)) {
        /* همان عبارت با kind دیگر — اولویت با نمونه بالاتر (زودتر آمده) */
        return;
      }
      seen.add(key);
      deduped.push(candidate);
    });

  /* هیچ پیشنهاد مستقیمی نبود؟ حروف‌گردی (fuzzy) روی همه برچسب‌ها */
  if (deduped.length === 0) {
    const fuzzy = [];
    const seenFuzzy = new Set();
    INDEX.forEach((doc) => {
      const pushFuzzy = (label, hint) => {
        const normalizedLabel = normalize(label);
        if (!normalizedLabel || seenFuzzy.has(normalizedLabel)) return;
        /* واژه‌به‌واژه مقایسه می‌شود تا «پتنسیل» بتواند «پتانسیل عمل» را پیدا کند */
        const queryTokens = tokenize(phrase);
        const labelTokens = tokenize(normalizedLabel);
        let bestDistance = Infinity;
        queryTokens.forEach((queryToken) => {
          const allowed = queryToken.length >= 6 ? 2 : 1;
          labelTokens.forEach((labelToken) => {
            const distance = editDistance(queryToken, labelToken);
            if (distance > 0 && distance <= allowed) bestDistance = Math.min(bestDistance, distance);
          });
        });
        if (bestDistance !== Infinity) {
          seenFuzzy.add(normalizedLabel);
          fuzzy.push({ kind: 'spell', label, hint, slug: doc.entity.slug, score: -bestDistance });
        }
      };
      pushFuzzy(doc.raw.title, doc.raw.englishTitle);
      doc.raw.aliases.forEach((alias) => pushFuzzy(alias, doc.raw.title));
      doc.raw.abbreviations.forEach((abbr) => pushFuzzy(abbr, doc.raw.title));
    });
    fuzzy.sort((a, b) => b.score - a.score);
    return fuzzy.slice(0, limit);
  }

  return deduped.slice(0, limit);
}

/* جست‌وجوهای سریع صفحه اصلی — همان هات‌سرچ‌ها با موجودیت هدف‌شان */
export const getHotSearches = () =>
  HOT_SEARCHES.map((term) => {
    const { primary } = searchWiki(term);
    return {
      term,
      slug: primary?.doc.entity.slug ?? null,
    };
  });
