/* ── لایه «ویکی تپش» — موتور کشف دانش پزشکی ──
   سه نما با یک ماشین حالت ساده:
     home     → مرکز جست‌وجو، درس‌ها، پرجست‌وجوها
     results  → نتایج با نتیجه اصلی، فیلتر و مرتب‌سازی (حالت مرور موضوعی هم همین‌جاست)
     article  → مقاله کامل با فهرست مطالب و شبکه دانش
   جست‌وجوی تایپ‌شده و فیلترها بین رفت‌وبرگشت‌ها حفظ می‌شوند؛ مقاله‌به‌مقاله هم
   پشته بازگشت دارد. Escape همان «back» هر نما را اجرا می‌کند. */

import { useCallback, useEffect, useState } from 'react';
import { useAsyncData } from '../league/useAsyncData';
import { LAYER_IDS, useLayerRoute } from '../dashboardRoute';
import * as api from '../../../services/wiki/wikiService';
import WikiHome from './WikiHome';
import WikiResults from './WikiResults';
import WikiArticle from './WikiArticle';
import { scrollWikiTop } from './wikiShared';
import './wiki.css';

/* نمای آغازین لایه؛ جست‌وجو، فیلتر و پشتهٔ مقاله‌ها هم روی مسیر داشبورد می‌نشینند
   تا Back و رفرش دقیقاً به همان نتایج/مقاله برگردند. */
const WIKI_HOME_VIEW = {
  mode: 'home',
  query: '',
  filters: {},
  sort: 'relevance',
  slug: null,
  stack: [],
  fromResults: false,
};

/* هر مقاله یک ورودی تاریخچه است تا Back/Forward بین مقالات هم کار کند */
const wikiScreenOf = (current) => (current?.mode === 'article' ? `article:${current.slug}` : current?.mode);

export default function WikiLayer({ onBack }) {
  const [view, setView, patchView] = useLayerRoute(LAYER_IDS.wiki, WIKI_HOME_VIEW, {
    screenOf: wikiScreenOf,
  });
  const {
    mode,
    query: committedQuery,
    filters,
    sort,
    slug: articleSlug,
    stack: articleStack,
    fromResults: cameFromResults,
  } = view;

  /* متن داخل کادر جست‌وجو محلی می‌ماند و با هر تغییر «جست‌وجوی کامیت‌شده» هم‌گام می‌شود
     (مثلاً وقتی با Back از مقاله به نتایج برمی‌گردیم). */
  const [draftQuery, setDraftQuery] = useState(committedQuery);

  useEffect(() => {
    setDraftQuery(committedQuery);
  }, [committedQuery]);

  /* بارگذاری نتایج — فقط وقتی جست‌وجوی کامیت‌شده/فیلترها عوض شود */
  const { data: resultsData, loading: resultsLoading } = useAsyncData(
    () => (committedQuery ? api.searchWiki(committedQuery, { filters, sort }) : api.browseWiki({ filters, sort })),
    [committedQuery, JSON.stringify(filters), sort],
  );

  const goHome = useCallback(() => {
    setView((current) => ({ ...current, mode: 'home', stack: [], slug: null }));
  }, [setView]);

  const openResults = useCallback(
    (term, nextFilters) => {
      setView((current) => ({
        ...current,
        mode: 'results',
        query: term,
        filters: nextFilters ?? current.filters,
      }));
      scrollWikiTop();
    },
    [setView],
  );

  const handleSearch = useCallback(
    (term) => {
      if (!term) {
        goHome();
        return;
      }
      api.saveRecentSearch(term);
      setView((current) => ({
        ...current,
        mode: 'results',
        query: term,
        filters: {},
        sort: 'relevance',
      }));
      scrollWikiTop();
    },
    [goHome, setView],
  );

  const handleBrowseSubject = useCallback(
    (subjectId) => {
      openResults('', { subject: subjectId });
      patchView({ sort: 'popular' });
    },
    [openResults, patchView],
  );

  const handleOpenArticle = useCallback(
    (slug, { from } = {}) => {
      setView((current) => {
        if (from === 'article' && current.slug) {
          /* مقاله فعلی روی پشته می‌رود تا «بازگشت به مقاله قبل» به آن برگردد */
          return { ...current, mode: 'article', slug, stack: [...current.stack, current.slug].slice(-12) };
        }
        return { ...current, mode: 'article', slug, stack: [], fromResults: from === 'results' };
      });
    },
    [setView],
  );

  const goBackFromArticle = useCallback(() => {
    setView((current) => {
      if (current.stack.length > 0) {
        const stack = [...current.stack];
        const previous = stack.pop();
        return { ...current, stack, slug: previous };
      }
      if (current.fromResults || current.query) {
        return { ...current, mode: 'results', slug: null };
      }
      return { ...current, mode: 'home', stack: [], slug: null };
    });
  }, [setView]);

  /* Escape = back در هر نما (کلیک بیرون و بستن پیشنهادها را سرچ‌بار خودش مدیریت می‌کند) */
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (mode === 'article') goBackFromArticle();
      else if (mode === 'results') goHome();
      else onBack?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, goBackFromArticle, onBack, goHome]);

  const articleBackLabel =
    articleStack.length > 0
      ? 'بازگشت به مقاله قبل'
      : cameFromResults || committedQuery
        ? 'بازگشت به نتایج'
        : 'بازگشت به ویکی';

  return (
    <section className="wiki-layer" dir="rtl" aria-label="ویکی تپش — دانشنامه تخصصی علوم پزشکی">
      <div className="wiki-layer__inner">
        {mode === 'home' && (
          <WikiHome
            onSearch={handleSearch}
            onOpenArticle={handleOpenArticle}
            onBrowseSubject={handleBrowseSubject}
          />
        )}

        {mode === 'results' && (
          <WikiResults
            query={draftQuery}
            filters={filters}
            sort={sort}
            data={resultsData}
            loading={resultsLoading}
            onQueryChange={setDraftQuery}
            onSearch={handleSearch}
            onOpenArticle={handleOpenArticle}
            onFiltersChange={(next) => patchView({ filters: next })}
            onSortChange={(next) => patchView({ sort: next })}
          />
        )}

        {mode === 'article' && articleSlug && (
          <WikiArticle
            key={articleSlug}
            slug={articleSlug}
            originLabel={articleBackLabel}
            onBack={goBackFromArticle}
            onOpenArticle={handleOpenArticle}
          />
        )}
      </div>
    </section>
  );
}
