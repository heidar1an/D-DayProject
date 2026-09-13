/* صفحه کشف مقالات: جست‌وجوی هوشمند، فیلترها، تخته Editorial، ادامه مطالعه و چیدمان Masonry */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import {
  getArticles,
  getCategories,
  getFeaturedArticle,
  getSearchSuggestions,
  getSideFeaturedArticles,
  getContinueReadingArticles,
  categoryAccent,
  categoryLabel,
} from '../../services/articles/articlesService';
import { getUserStateSnapshot, getSavedCount, subscribe } from '../../services/articles/userState';
import {
  ArticleCard,
  ArticleCover,
  AuthorChip,
  ChevronIcon,
  SearchIcon,
  faCompact,
  faPercent,
  toFa,
  usePageMeta,
} from './articlesShared';
import './articles.css';

const PAGE_SIZE = 9;

const SORT_OPTIONS = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'popular', label: 'محبوب‌ترین' },
  { value: 'mostRead', label: 'بیشترین مطالعه' },
  { value: 'recommended', label: 'پیشنهادی' },
];

const TIME_OPTIONS = [
  { value: 'all', label: 'همه' },
  { value: 'short', label: 'کوتاه' },
  { value: 'long', label: 'مفصل' },
];

const CATEGORIES = getCategories();
const FEATURED = getFeaturedArticle();
const SIDE_FEATURED = getSideFeaturedArticles(2);

/* ── تعداد ستون Masonry بر اساس عرض صفحه ── */
function useColumnCount() {
  const compute = () => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth <= 640) return 1;
    if (window.innerWidth <= 1024) return 2;
    return 3;
  };

  const [count, setCount] = useState(compute);

  useEffect(() => {
    const onResize = () => setCount(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return count;
}

/*
 * توزیع مقاله‌ها بین ستون‌ها با برآورد ارتفاع؛ ترتیب ثابت و پایدار است،
 * پس Load More فقط به کوتاه‌ترین ستون اضافه می‌کند و بقیه جابه‌جا نمی‌شوند.
 */
const COLUMN_WIDTH_ESTIMATE = 380;

function estimateCardHeight(article) {
  const [width, height] = String(article.coverRatio ?? '16/10').split('/').map(Number);
  const coverHeight = (COLUMN_WIDTH_ESTIMATE * height) / (width || 16);
  const textHeight = 132 + Math.ceil(article.excerpt.length / 42) * 24 + (article.title.length > 46 ? 26 : 0);
  return coverHeight + textHeight;
}

function distributeIntoColumns(items, columnCount) {
  const columns = Array.from({ length: columnCount }, () => ({ items: [], height: 0 }));

  items.forEach((article) => {
    const shortest = columns.reduce((min, column) => (column.height < min.height ? column : min), columns[0]);
    shortest.items.push(article);
    shortest.height += estimateCardHeight(article);
  });

  return columns.map((column) => column.items);
}

/* ── تخته Editorial: یک مقاله بزرگ + دو مقاله کوچک ── */
function FeaturedBoard({ hero, sideArticles }) {
  if (!hero) return null;

  return (
    <section className="ap-featured-board" aria-label="مقالات منتخب">
      <a className="ap-feature ap-feature--hero" href={`#articles/${hero.slug}`}>
        <div className={`ap-feature__media ap-cover-art--${categoryAccent(hero.category)}`}>
          <ArticleCover article={hero} eager />
        </div>
        <div className="ap-feature__body">
          <span className="ap-featured__badge">مقاله منتخب</span>
          <span className={`ap-card__category ap-card__category--${categoryAccent(hero.category)}`}>
            {categoryLabel(hero.category)}
          </span>
          <h2>{hero.title}</h2>
          <p>{hero.excerpt}</p>
          <span className="ap-feature__meta">
            <AuthorChip article={hero} />
            <span className="ap-feature__meta-item">{toFa(hero.readingTime)} دقیقه مطالعه</span>
            <span className="ap-feature__meta-item" aria-hidden="true">·</span>
            <span className="ap-feature__meta-item">{faCompact(hero.views)} بازدید</span>
            <span className="ap-card__arrow" aria-hidden="true">←</span>
          </span>
        </div>
      </a>

      {sideArticles.map((article) => (
        <a className="ap-feature ap-feature--side" href={`#articles/${article.slug}`} key={article.slug}>
          <div className={`ap-feature__media ap-cover-art--${categoryAccent(article.category)}`}>
            <ArticleCover article={article} />
          </div>
          <div className="ap-feature__body">
            <span className={`ap-card__category ap-card__category--${categoryAccent(article.category)}`}>
              {categoryLabel(article.category)}
            </span>
            <h3>{article.title}</h3>
            <span className="ap-feature__meta">
              <span className="ap-feature__meta-item">{toFa(article.readingTime)} دقیقه</span>
              <span className="ap-card__arrow" aria-hidden="true">←</span>
            </span>
          </div>
        </a>
      ))}
    </section>
  );
}

/* ── نوار «ادامه مطالعه»: شخصی‌سازی بر اساس تاریخچه محلی کاربر ── */
function ContinueReadingStrip() {
  const list = getContinueReadingArticles(4);

  if (list.length === 0) return null;

  return (
    <section className="ap-continue" aria-label="ادامه مطالعه">
      <h2 className="ap-continue__title">ادامه مطالعه</h2>
      <div className="ap-continue__row">
        {list.map(({ article, entry }) => (
          <a className="ap-continue__item" href={`#articles/${article.slug}`} key={article.id}>
            <span className={`ap-continue__thumb ap-cover-art--${categoryAccent(article.category)}`}>
              <ArticleCover article={article} />
            </span>
            <span className="ap-continue__body">
              <span className="ap-continue__name">{article.title}</span>
              <span className="ap-continue__progress">
                <span className="ap-continue__bar" aria-hidden="true">
                  <span style={{ transform: `scaleX(${entry.progress ?? 0})` }} />
                </span>
                <span>{faPercent(entry.progress ?? 0)}</span>
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ── جست‌وجو با پیشنهاد زنده ── */
function SearchBar({ query, onQueryChange }) {
  const [suggestions, setSuggestions] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    let isActive = true;

    if (query.trim().length < 2) {
      setSuggestions(null);
      setIsOpen(false);
      return undefined;
    }

    getSearchSuggestions(query).then((result) => {
      if (!isActive) return;
      const hasAny = result.articles.length > 0 || result.topics.length > 0;
      setSuggestions(result);
      setIsOpen(hasAny);
      setActiveIndex(-1);
    });

    return () => {
      isActive = false;
    };
  }, [query]);

  /* بستن با کلیک بیرون */
  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  const flatSuggestions = useMemo(() => {
    if (!suggestions) return [];
    return [
      ...suggestions.articles.map((item) => ({ type: 'article', ...item })),
      ...suggestions.topics.map((topic) => ({ type: 'topic', topic })),
    ];
  }, [suggestions]);

  const chooseSuggestion = (item) => {
    setIsOpen(false);
    if (item.type === 'article') {
      window.location.hash = `articles/${item.slug}`;
    } else {
      onQueryChange(item.topic);
    }
  };

  const onKeyDown = (event) => {
    if (!isOpen || flatSuggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % flatSuggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + flatSuggestions.length) % flatSuggestions.length);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      chooseSuggestion(flatSuggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="ap-search-root" ref={rootRef}>
      <form className="ap-search" role="search" onSubmit={(event) => event.preventDefault()}>
        <span className="ap-search__icon" aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="جستجو در مقالات، موضوع‌ها و نویسنده‌ها..."
          aria-label="جستجو در مقالات"
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="ap-search-suggestions"
        />
        {query && (
          <button
            type="button"
            className="ap-search__clear"
            aria-label="پاک‌کردن جستجو"
            onClick={() => onQueryChange('')}
          >
            ×
          </button>
        )}
      </form>

      {isOpen && suggestions && (
        <div className="ap-suggestions" id="ap-search-suggestions" role="listbox" aria-label="پیشنهادهای جستجو">
          {suggestions.articles.length > 0 && (
            <div className="ap-suggestions__group" role="presentation">
              <span className="ap-suggestions__label">مقاله‌ها</span>
              {suggestions.articles.map((item, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  className={`ap-suggestion ${activeIndex === index ? 'is-active' : ''}`}
                  key={item.slug}
                  onClick={() => chooseSuggestion({ type: 'article', ...item })}
                >
                  <span className="ap-suggestion__title">{item.title}</span>
                  <span className="ap-suggestion__hint">{item.category}</span>
                </button>
              ))}
            </div>
          )}

          {suggestions.topics.length > 0 && (
            <div className="ap-suggestions__group" role="presentation">
              <span className="ap-suggestions__label">موضوع‌ها</span>
              <div className="ap-suggestions__topics">
                {suggestions.topics.map((topic, offset) => {
                  const index = suggestions.articles.length + offset;
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={activeIndex === index}
                      className={`ap-suggestion ap-suggestion--topic ${activeIndex === index ? 'is-active' : ''}`}
                      key={topic}
                      onClick={() => chooseSuggestion({ type: 'topic', topic })}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SkeletonMasonry({ columnCount }) {
  const columns = distributeIntoColumns(
    Array.from({ length: 8 }, (_, index) => ({
      id: `sk-${index}`,
      coverRatio: index % 3 === 0 ? '4/3' : index % 3 === 1 ? '3/4' : '16/10',
      title: 'xxxx',
      excerpt: 'x'.repeat(120),
      cover: null,
      coverFit: 'cover',
      slug: index,
    })),
    columnCount,
  );

  return (
    <div className="ap-masonry" aria-hidden="true">
      {columns.map((column, columnIndex) => (
        <div className="ap-masonry__col" key={columnIndex}>
          {column.map((item) => (
            <div className="ap-skeleton-card" key={item.id}>
              <div className="ap-skeleton-card__media" style={{ aspectRatio: item.coverRatio }} />
              <div className="ap-skeleton-card__body">
                <span className="ap-skeleton-line" style={{ width: '32%' }} />
                <span className="ap-skeleton-line" style={{ width: '86%' }} />
                <span className="ap-skeleton-line" style={{ width: '62%' }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onReset, title, description }) {
  return (
    <div className="ap-empty">
      <span className="ap-empty__icon" aria-hidden="true">
        <SearchIcon />
      </span>
      <h3>{title ?? 'مقاله‌ای پیدا نشد.'}</h3>
      <p>{description ?? 'موضوع دیگری را جستجو کنید یا دسته‌بندی دیگری را امتحان کنید.'}</p>
      <button type="button" onClick={onReset}>
        پاک‌کردن جست‌وجو و فیلترها
      </button>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="ap-empty">
      <span className="ap-empty__icon" aria-hidden="true">
        !
      </span>
      <h3>مقاله‌ها بارگذاری نشدند.</h3>
      <p>اتصال اینترنت را بررسی کن و دوباره تلاش کن.</p>
      <button type="button" onClick={onRetry}>
        تلاش دوباره
      </button>
    </div>
  );
}

export default function ArticlesPage({ initialCategory = 'all' }) {
  const [query, setQuery] = useState(() => {
    /* انتقال جست‌وجو از تگ‌های صفحه مقاله */
    const pending = window.sessionStorage.getItem('tapesh:articles:pendingQuery');
    if (pending) {
      window.sessionStorage.removeItem('tapesh:articles:pendingQuery');
      return pending;
    }
    return '';
  });
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [category, setCategory] = useState(initialCategory);
  const [time, setTime] = useState('all');
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [sort, setSort] = useState('newest');
  const [articles, setArticles] = useState(null);
  const [failed, setFailed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  /* اشتراک در تغییرات وضعیت کاربر؛ خود مقدار در رندر با getSavedCount خوانده می‌شود */
  useSyncExternalStore(subscribe, getUserStateSnapshot);
  const savedCount = getSavedCount();
  const columnCount = useColumnCount();

  usePageMeta({
    title: 'مقالات تپش | یادگیری پزشکی ساده‌تر',
    description: 'مقالات آموزشی پزشکی تپش؛ فیزیولوژی، آناتومی، بیوشیمی و مهارت‌های مطالعه را ساده، عمیق و کاربردی یاد بگیر.',
    path: '/#articles',
  });

  /* جست‌وجوی زنده با تاخیر کوتاه برای تایپ روان */
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  /* تغییر دسته‌بندی از URL (لینک مستقیم دسته‌بندی) */
  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    let isActive = true;
    setFailed(false);
    setArticles(null);

    getArticles({ category, query: debouncedQuery, sort, time, recommendedOnly })
      .then((list) => {
        if (isActive) setArticles(list);
      })
      .catch(() => {
        if (isActive) setFailed(true);
      });

    return () => {
      isActive = false;
    };
  }, [category, debouncedQuery, sort, time, recommendedOnly]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [category, debouncedQuery, sort, time, recommendedOnly]);

  const isDefaultView = category === 'all' && !debouncedQuery && sort === 'newest' && time === 'all' && !recommendedOnly;

  const featuredHero = isDefaultView ? FEATURED : null;
  const featuredSide = isDefaultView ? SIDE_FEATURED : null;

  const masonryArticles = useMemo(() => {
    if (!articles) return [];
    const excluded = new Set([
      ...(featuredHero ? [featuredHero.slug] : []),
      ...(featuredSide ?? []).map((article) => article.slug),
    ]);
    return articles.filter((article) => !excluded.has(article.slug)).slice(0, visibleCount);
  }, [articles, featuredHero, featuredSide, visibleCount]);

  const masonryColumns = useMemo(
    () => distributeIntoColumns(masonryArticles, columnCount),
    [masonryArticles, columnCount],
  );

  const hasMore = useMemo(() => {
    if (!articles) return false;
    const excludedCount = (featuredHero ? 1 : 0) + (featuredSide?.length ?? 0);
    return visibleCount < articles.length - excludedCount;
  }, [articles, featuredHero, featuredSide, visibleCount]);

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setSort('newest');
    setTime('all');
    setRecommendedOnly(false);
  };

  return (
    <main className="articles-page ap-layer-reveal">
      <div className="ap-shell ap-stagger">
        <section className="ap-hero" aria-labelledby="ap-hero-title">
          <h1 id="ap-hero-title">مقالات تپش</h1>
          <p>کتابخانه زنده دانش پزشکی؛ پیدا کن، عمیق بخوان و یاد بگیر.</p>
          <SearchBar query={query} onQueryChange={setQuery} />
        </section>

        <div className="ap-toolbar">
          <div className="ap-chips" role="group" aria-label="دسته‌بندی مقالات">
            <button
              type="button"
              className={`ap-chip ${category === 'all' ? 'is-active' : ''}`}
              aria-pressed={category === 'all'}
              onClick={() => setCategory('all')}
            >
              همه
            </button>
            {CATEGORIES.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`ap-chip ${category === item.id ? 'is-active' : ''}`}
                aria-pressed={category === item.id}
                onClick={() => setCategory(item.id)}
              >
                {item.label}
              </button>
            ))}
            <a className={`ap-chip ap-chip--saved${savedCount > 0 ? ' has-items' : ''}`} href="#articles/saved">
              ذخیره‌شده‌ها
              {savedCount > 0 && <span>{toFa(savedCount)}</span>}
            </a>
          </div>
        </div>

        <div className="ap-subfilters">
          <div className="ap-subfilters__pills" role="group" aria-label="فیلترهای بیشتر">
            {TIME_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                className={`ap-pill ${time === option.value ? 'is-active' : ''}`}
                aria-pressed={time === option.value}
                onClick={() => setTime(option.value)}
              >
                {option.label}
              </button>
            ))}
            <span className="ap-subfilters__sep" aria-hidden="true" />
            <button
              type="button"
              className={`ap-pill ap-pill--featured ${recommendedOnly ? 'is-active' : ''}`}
              aria-pressed={recommendedOnly}
              onClick={() => setRecommendedOnly((value) => !value)}
            >
              منتخب تپش
            </button>
          </div>

          <div className="ap-toolbar__end">
            {articles && (
              <span className="ap-count" aria-live="polite">
                {toFa(articles.length)} مقاله
              </span>
            )}
            <label className="ap-sort">
              <span className="sr-only">مرتب‌سازی مقالات</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                {SORT_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="ap-sort__chevron" aria-hidden="true">
                <ChevronIcon />
              </span>
            </label>
          </div>
        </div>

        <ContinueReadingStrip />

        {featuredHero && <FeaturedBoard hero={featuredHero} sideArticles={featuredSide ?? []} />}

        {articles === null ? (
          failed ? (
            <ErrorState onRetry={resetFilters} />
          ) : (
            <SkeletonMasonry columnCount={columnCount} />
          )
        ) : articles.length === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : (
          <>
            {featuredHero && (
              <div className="ap-section-label" aria-hidden="true">
                <span>همه مقاله‌ها</span>
              </div>
            )}

            <div className="ap-masonry">
              {masonryColumns.map((column, columnIndex) => (
                <div className="ap-masonry__col" key={columnIndex}>
              {column.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="ap-more">
                <button type="button" className="ap-more__button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                  مقاله‌های بیشتر
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
