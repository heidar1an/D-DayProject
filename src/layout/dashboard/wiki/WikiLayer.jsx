/* ── لایه «ویکی تپش» — موتور کشف دانش پزشکی ──
   سه نما با یک ماشین حالت ساده:
     home     → مرکز جست‌وجو، درس‌ها، پرجست‌وجوها
     results  → نتایج با نتیجه اصلی، فیلتر و مرتب‌سازی (حالت مرور موضوعی هم همین‌جاست)
     article  → مقاله کامل با فهرست مطالب و شبکه دانش
   جست‌وجوی تایپ‌شده و فیلترها بین رفت‌وبرگشت‌ها حفظ می‌شوند؛ مقاله‌به‌مقاله هم
   پشته بازگشت دارد. Escape همان «back» هر نما را اجرا می‌کند. */

import { useCallback, useEffect, useState } from 'react';
import { useAsyncData } from '../league/useAsyncData';
import * as api from '../../../services/wiki/wikiService';
import WikiHome from './WikiHome';
import WikiResults from './WikiResults';
import WikiArticle from './WikiArticle';
import { scrollWikiTop } from './wikiShared';
import './wiki.css';

export default function WikiLayer({ onBack }) {
  const [mode, setMode] = useState('home');

  /* وضعیت نتایج — بین بازدید مقاله‌ها حفظ می‌شود تا Back دقیقاً به همان نتایج برگردد */
  const [committedQuery, setCommittedQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState('relevance');

  /* پشته مقاله‌ها برای ناوبری بین مفاهیم مرتبط */
  const [articleStack, setArticleStack] = useState([]);
  const [articleSlug, setArticleSlug] = useState(null);
  const [cameFromResults, setCameFromResults] = useState(false);

  /* بارگذاری نتایج — فقط وقتی جست‌وجوی کامیت‌شده/فیلترها عوض شود */
  const { data: resultsData, loading: resultsLoading } = useAsyncData(
    () => (committedQuery ? api.searchWiki(committedQuery, { filters, sort }) : api.browseWiki({ filters, sort })),
    [committedQuery, JSON.stringify(filters), sort],
  );

  const goHome = useCallback(() => {
    setMode('home');
    setArticleStack([]);
    setArticleSlug(null);
  }, []);

  const openResults = useCallback((term, nextFilters) => {
    setCommittedQuery(term);
    setDraftQuery(term);
    if (nextFilters) setFilters(nextFilters);
    setMode('results');
    scrollWikiTop();
  }, []);

  const handleSearch = useCallback(
    (term) => {
      if (!term) {
        goHome();
        return;
      }
      setFilters({});
      setSort('relevance');
      api.saveRecentSearch(term);
      openResults(term, {});
    },
    [openResults, goHome],
  );

  const handleBrowseSubject = useCallback(
    (subjectId) => {
      setFilters({ subject: subjectId });
      setSort('popular');
      openResults('', { subject: subjectId });
    },
    [openResults],
  );

  const handleOpenArticle = useCallback(
    (slug, { from } = {}) => {
      if (from === 'article' && articleSlug) {
        /* مقاله فعلی روی پشته می‌رود تا «بازگشت به مقاله قبل» به آن برگردد */
        setArticleStack((stack) => [...stack, articleSlug].slice(-12));
      } else {
        setArticleStack([]);
        setCameFromResults(from === 'results');
      }
      setArticleSlug(slug);
      setMode('article');
    },
    [articleSlug],
  );

  const goBackFromArticle = useCallback(() => {
    if (articleStack.length > 0) {
      const stack = [...articleStack];
      const previous = stack.pop();
      setArticleStack(stack);
      setArticleSlug(previous);
      return;
    }
    if (cameFromResults || committedQuery) {
      setMode('results');
      return;
    }
    goHome();
  }, [articleStack, cameFromResults, committedQuery, goHome]);

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
            onFiltersChange={(next) => {
              setFilters(next);
            }}
            onSortChange={setSort}
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
