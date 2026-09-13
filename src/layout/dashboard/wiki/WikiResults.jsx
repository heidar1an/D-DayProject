/* ── صفحه نتایج جست‌وجوی ویکی تپش ──
   ساختار از تجربه جست‌وجوهای مدرن: نوار جست‌وجو، شمارش نتایج + مرتب‌سازی + فیلترها،
   سپس نتیجه اصلی متمایز (Primary Knowledge Result) و بعد نتایج مرتبط با اسنیپت.
   فلسفه: Search → Understanding → Exploration، نه فهرست لینک. */

import { useState } from 'react';
import * as api from '../../../services/wiki/wikiService';
import { WIKI_ENTITIES } from '../../../services/wiki/mockData';
import WikiSearchBar from './WikiSearchBar';
import {
  Chip,
  DifficultyBadge,
  GoArrow,
  HighlightedText,
  Icon,
  SubjectTag,
  TypeBadge,
  toFa,
} from './wikiShared';

/* برچسب انسانی برای سطح تطابق — از provenance موتور، نه نمایش امتیاز خام */
const MATCH_LABELS = {
  title: 'تطابق دقیق عنوان',
  abbreviation: 'تطابق مخفف',
  alias: 'تطابق مترادف',
  english: 'تطابق عنوان انگلیسی',
  keyword: 'تطابق کلیدواژه',
  subject: 'مرتبط با درس',
  topic: 'مرتبط با موضوع',
  summary: 'تطابق تعریف',
  body: 'یافت‌شده در متن',
};

const matchLabelFor = (entry) => {
  const source = entry.provenance ?? [];
  const first = source.find(([kind]) => MATCH_LABELS[kind]);
  return first ? MATCH_LABELS[first[0]] : null;
};

const SORT_OPTIONS = [
  { id: 'relevance', label: 'مرتب‌ترین' },
  { id: 'popular', label: 'پرجست‌وجوترین' },
  { id: 'recent', label: 'جدیدترین' },
  { id: 'title', label: 'الفبایی' },
];

const TYPE_OPTIONS = Object.entries(api.TYPE_META).map(([id, meta]) => ({ id, label: meta.label }));

const DIFFICULTY_OPTIONS = [
  { id: 'پایه', label: 'سطح پایه' },
  { id: 'متوسط', label: 'سطح متوسط' },
  { id: 'پیشرفته', label: 'سطح پیشرفته' },
];

/* ── کارت نتیجه اصلی ── */
function PrimaryResult({ entry, onOpen }) {
  const { entity } = entry.doc;
  const accent = api.subjectAccent(entity.subject);

  return (
    <article className="wiki-primary" style={{ '--accent': accent }}>
      <div className="wiki-primary__top">
        <span className="wiki-primary__flag">
          <Icon name="sparkle" size={14} />
          نتیجه اصلی
        </span>
        <TypeBadge type={entity.type} subject={entity.subject} />
        {matchLabelFor(entry) && <span className="wiki-primary__match">{matchLabelFor(entry)}</span>}
      </div>

      <button type="button" className="wiki-primary__head" onClick={() => onOpen(entity.slug)}>
        <h3>
          {entity.title}
          {entity.abbreviations.length > 0 && (
            <span className="wiki-primary__abbr">({entity.abbreviations.join(' · ')})</span>
          )}
        </h3>
        <span className="wiki-primary__english">{entity.englishTitle}</span>
      </button>

      {entity.aliases.length > 0 && (
        <p className="wiki-primary__aliases">
          سایر نام‌ها: {entity.aliases.slice(0, 3).join(' ، ')}
        </p>
      )}

      <p className="wiki-primary__summary">
        <HighlightedText text={entry.snippet?.text ?? entity.summary} match={entry.snippet?.match} />
      </p>

      {entity.keyFacts.length > 0 && (
        <ul className="wiki-primary__facts">
          {entity.keyFacts.slice(0, 3).map((fact) => (
            <li key={fact}>
              <Icon name="check" size={14} />
              {fact}
            </li>
          ))}
        </ul>
      )}

      <div className="wiki-primary__foot">
        <div className="wiki-primary__tags">
          <SubjectTag subject={entity.subject} />
          <Chip plain>{entity.topic}</Chip>
          <DifficultyBadge difficulty={entity.difficulty} />
        </div>
        <button type="button" className="wiki-primary__cta" onClick={() => onOpen(entity.slug)}>
          مطالعه کامل
          <GoArrow />
        </button>
      </div>
    </article>
  );
}

/* ── ردیف نتیجه مرتبط ── */
function ResultRow({ entry, onOpen }) {
  const { entity } = entry.doc;

  return (
    <button type="button" className="wiki-result" onClick={() => onOpen(entity.slug)}>
      <span className="wiki-result__top">
        <TypeBadge type={entity.type} subject={entity.subject} />
        <span className="wiki-result__english">{entity.englishTitle}</span>
      </span>
      <strong className="wiki-result__title">{entity.title}</strong>
      <p className="wiki-result__snippet">
        <HighlightedText text={entry.snippet?.text ?? entity.summary} match={entry.snippet?.match} />
      </p>
      <span className="wiki-result__meta">
        <SubjectTag subject={entity.subject} />
        <span>{entity.topic}</span>
        <i aria-hidden="true" />
        <span>{api.formatRelativeDays(entity.lastUpdated)}</span>
      </span>
      <GoArrow className="wiki-result__go" />
    </button>
  );
}

/* ── حالت خالی: پیشنهاد مسیر ادامه، نه صفحه خالی ── */
function EmptyState({ query, didYouMean, onSearch, onBrowseSubject }) {
  const fallbacks = [...WIKI_ENTITIES].sort((a, b) => b.popularity - a.popularity).slice(0, 5);
  const subjects = api.SUBJECT_META.slice(0, 6);

  return (
    <div className="wiki-empty">
      <span className="wiki-empty__icon" aria-hidden="true">
        <Icon name="search" size={30} />
      </span>
      <h3>چیزی برای «{query}» پیدا نشد</h3>
      <p>اما این مسیرها کمکت می‌کند:</p>

      {didYouMean && (
        <button type="button" className="wiki-empty__dym" onClick={() => onSearch(didYouMean)}>
          آیا منظورتان <strong>{didYouMean}</strong> بود؟
        </button>
      )}

      <div className="wiki-empty__chips">
        {fallbacks.map((article) => (
          <Chip key={article.slug} className="wiki-chip--action">
            <button type="button" onClick={() => onSearch(article.title)}>
              {article.title}
            </button>
          </Chip>
        ))}
      </div>

      <div className="wiki-empty__subjects">
        {subjects.map((subject) => (
          <button
            key={subject.id}
            type="button"
            className="wiki-chip wiki-chip--action"
            style={{ '--accent': subject.accent }}
            onClick={() => onBrowseSubject(subject.id)}
          >
            {subject.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="wiki-results" aria-hidden="true">
      <span className="wiki-skeleton wiki-results__bar-sk" />
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="wiki-skeleton wiki-results__row-sk" />
      ))}
    </div>
  );
}

/* ── نمای کامل نتایج ── */
export default function WikiResults({
  query,
  filters,
  sort,
  data,
  loading,
  onQueryChange,
  onSearch,
  onOpenArticle,
  onFiltersChange,
  onSortChange,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { primary, results, total, didYouMean, relatedSearches, facets } = data ?? {};
  const accent = primary ? api.subjectAccent(primary.doc.entity.subject) : '#5b8cc7';

  const hasActiveFilters = Boolean(filters.subject || filters.type || filters.difficulty);
  const subjectFacets = facets?.bySubject ?? {};

  const setFilter = (key, value) => {
    onFiltersChange({ ...filters, [key]: filters[key] === value ? undefined : value });
  };

  return (
    <div className="wiki-results">
      <div className="wiki-topbar">
        <button type="button" className="wiki-topbar__back" onClick={() => onSearch(null)}>
          <Icon name="back" size={17} />
          بازگشت به ویکی
        </button>
        <span className="wiki-topbar__crumb">ویکی تپش / نتایج جست‌وجو</span>
      </div>

      <div className="wiki-results__bar">
        <WikiSearchBar
          value={query}
          onChange={onQueryChange}
          onSubmit={(term) => {
            api.saveRecentSearch(term);
            onSearch(term);
          }}
          onOpenArticle={(slug) => onOpenArticle(slug, { from: 'results' })}
          size="compact"
        />
      </div>

      {/* ── شمارش، مرتب‌سازی و فیلترها ── */}
      <div className="wiki-toolbar">
        <p className="wiki-toolbar__count" role="status">
          {loading ? (
            'در حال جست‌وجو…'
          ) : total > 0 ? (
            <>
              <strong>{toFa(total)}</strong> نتیجه برای «{query || 'مرور موضوعی'}»
            </>
          ) : (
            'نتیجه‌ای یافت نشد'
          )}
        </p>

        <div className="wiki-toolbar__tools">
          <button
            type="button"
            className={`wiki-toolbar__filter-toggle ${hasActiveFilters ? 'is-on' : ''}`}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Icon name="filter" size={16} />
            فیلترها
            {hasActiveFilters && <i className="wiki-toolbar__dot" aria-hidden="true" />}
          </button>

          <label className="wiki-toolbar__select">
            <span>مرتب‌سازی:</span>
            <select value={sort} onChange={(event) => onSortChange(event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filtersOpen && (
        <div className="wiki-filters dashboard-layer-reveal">
          <div className="wiki-filters__group">
            <span className="wiki-filters__label">درس</span>
            <div className="wiki-filters__chips">
              {api.SUBJECT_META.filter((subject) => !facets || subjectFacets[subject.id]).map((subject) => (
                <button
                  key={subject.id}
                  type="button"
                  className={`wiki-chip wiki-chip--action ${filters.subject === subject.id ? 'is-active' : ''}`}
                  style={{ '--accent': subject.accent }}
                  onClick={() => setFilter('subject', subject.id)}
                >
                  {subject.label}
                  {subjectFacets[subject.id] ? ` (${toFa(subjectFacets[subject.id])})` : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="wiki-filters__row">
            <div className="wiki-filters__group">
              <span className="wiki-filters__label">نوع محتوا</span>
              <div className="wiki-filters__chips">
                {TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`wiki-chip wiki-chip--action ${filters.type === option.id ? 'is-active' : ''}`}
                    onClick={() => setFilter('type', option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="wiki-filters__group">
              <span className="wiki-filters__label">سطح</span>
              <div className="wiki-filters__chips">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`wiki-chip wiki-chip--action ${filters.difficulty === option.id ? 'is-active' : ''}`}
                    onClick={() => setFilter('difficulty', option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="wiki-filters__clear"
              onClick={() => onFiltersChange({})}
            >
              <Icon name="close" size={13} />
              پاک کردن همه فیلترها
            </button>
          )}
        </div>
      )}

      {/* ── بدنه نتایج ── */}
      {loading ? (
        <ResultsSkeleton />
      ) : total === 0 ? (
        hasActiveFilters && WIKI_ENTITIES.length > 0 ? (
          <div className="wiki-empty">
            <h3>با این فیلترها نتیجه‌ای نیست</h3>
            <p>فیلترها را کمتر کنید یا حذفشان کنید.</p>
            <button type="button" className="wiki-empty__dym" onClick={() => onFiltersChange({})}>
              حذف همه فیلترها
            </button>
          </div>
        ) : (
          <EmptyState
            query={query}
            didYouMean={didYouMean}
            onSearch={onSearch}
            onBrowseSubject={(subject) => onFiltersChange({ subject })}
          />
        )
      ) : (
        <>
          {primary && (
            <PrimaryResult entry={primary} onOpen={(slug) => onOpenArticle(slug, { from: 'results' })} />
          )}

          {results.length > 0 && (
            <div className="wiki-results__list">
              <h4 className="wiki-results__list-title">
                {primary ? 'موضوعات مرتبط دیگر' : 'نتایج'}
              </h4>
              {results.map((entry) => (
                <ResultRow
                  key={entry.doc.entity.slug}
                  entry={entry}
                  onOpen={(slug) => onOpenArticle(slug, { from: 'results' })}
                />
              ))}
            </div>
          )}

          {relatedSearches.length > 0 && (
            <div className="wiki-related-searches">
              <h4>جست‌وجوهای مرتبط</h4>
              <div className="wiki-related-searches__chips">
                {relatedSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="wiki-chip wiki-chip--action"
                    style={{ '--accent': accent }}
                    onClick={() => onSearch(term)}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
