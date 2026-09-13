/* ── صفحه اصلی ویکی تپش ──
   تمیز و مینیمال: جست‌وجو در مرکز، پیشنهادهای سریع، درس‌ها (داده‌محور، نه hard-code)،
   پرجست‌وجوها و آخرین به‌روزرسانی‌ها. فلسفه: «کتاب دیجیتال مدرن»، نه داشبورد شلوغ. */

import { useState } from 'react';
import { useAsyncData } from '../league/useAsyncData';
import * as api from '../../../services/wiki/wikiService';
import WikiSearchBar from './WikiSearchBar';
import { GoArrow, Icon, SubjectTag, TypeBadge, toFa } from './wikiShared';

/* اسکلت بارگذاری صفحه اصلی — هم‌اندازه بلوک‌های واقعی تا Layout Shift نداشته باشیم */
function HomeSkeleton() {
  return (
    <div className="wiki-home" aria-hidden="true">
      <div className="wiki-hero">
        <span className="wiki-skeleton wiki-hero__badge-sk" />
        <span className="wiki-skeleton wiki-hero__title-sk" />
        <span className="wiki-skeleton wiki-hero__text-sk" />
        <span className="wiki-skeleton wiki-search-skeleton" />
        <span className="wiki-skeleton wiki-hero__chips-sk" />
      </div>
      <div className="wiki-stats">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="wiki-skeleton wiki-stats__sk" />
        ))}
      </div>
      <span className="wiki-skeleton wiki-section-sk" />
      <div className="wiki-subjects">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <span key={i} className="wiki-skeleton wiki-subjects__sk" />
        ))}
      </div>
    </div>
  );
}

export default function WikiHome({ onSearch, onOpenArticle, onBrowseSubject }) {
  const [query, setQuery] = useState('');
  const { data: home, loading } = useAsyncData(() => api.getHomeData(), []);

  if (loading || !home) return <HomeSkeleton />;

  return (
    <div className="wiki-home">
      <div className="wiki-topbar">
        <span className="wiki-topbar__crumb">ویکی تپش</span>
      </div>

      {/* ── هیرو: جست‌وجو در مرکز ── */}
      <header className="wiki-hero">
        <span className="wiki-hero__badge">
          <Icon name="sparkle" size={15} />
          دانشنامه تخصصی علوم پزشکی
        </span>
        <h1 className="wiki-hero__title">ویکی تپش</h1>
        <p className="wiki-hero__subtitle">
          موتور کشف دانش پزشکی — جست‌وجو کن، بفهم، بین مفاهیم حرکت کن.
          <br />
          از مخفف‌ها و مترادف‌ها تا شبکه ارتباط مفاهیم بالینی و پایه.
        </p>

        <div className="wiki-hero__search">
          <WikiSearchBar
            value={query}
            onChange={setQuery}
            onSubmit={(term) => {
              api.saveRecentSearch(term);
              onSearch(term);
            }}
            onOpenArticle={(slug) => {
              onOpenArticle(slug, { from: 'home' });
            }}
            size="hero"
            autoFocus
          />

          <div className="wiki-hero__chips">
            {home.hotSearches.slice(0, 6).map(({ term, slug }) => (
              <button
                key={term}
                type="button"
                className="wiki-chip wiki-chip--action"
                onClick={() => {
                  if (slug) onOpenArticle(slug, { from: 'home' });
                  else onSearch(term);
                }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── آمار ویکی ── */}
      <div className="wiki-stats" role="list">
        <div className="wiki-stat" role="listitem">
          <strong>{toFa(home.stats.articles)}</strong>
          <span>مقاله و مفهوم</span>
        </div>
        <div className="wiki-stat" role="listitem">
          <strong>{toFa(home.stats.subjects)}</strong>
          <span>درس اصلی</span>
        </div>
        <div className="wiki-stat" role="listitem">
          <strong>{toFa(home.stats.topics)}</strong>
          <span>موضوع تخصصی</span>
        </div>
        <div className="wiki-stat" role="listitem">
          <strong>{toFa(home.stats.relations)}</strong>
          <span>ارتباط دانشی</span>
        </div>
      </div>

      {/* ── درس‌ها: داده‌محور از سرویس ── */}
      <section className="wiki-section" aria-labelledby="wiki-subjects-title">
        <div className="wiki-section__head">
          <h2 id="wiki-subjects-title">درس‌های علوم پزشکی</h2>
          <p>دنبال موضوع مشخصی هستی؟ از درس شروع کن.</p>
        </div>
        <div className="wiki-subjects">
          {home.subjects.map((subject) => (
            <button
              key={subject.id}
              type="button"
              className="wiki-subject-card"
              style={{ '--accent': subject.accent }}
              onClick={() => onBrowseSubject(subject.id)}
            >
              <span className="wiki-subject-card__glyph" aria-hidden="true">
                <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <circle cx="20" cy="20" r="6.5" />
                  <path d="M20 4v6M20 30v6M4 20h6M30 20h6M8.7 8.7l4.2 4.2M27.1 27.1l4.2 4.2M31.3 8.7l-4.2 4.2M12.9 27.1l-4.2 4.2" opacity="0.75" />
                </svg>
              </span>
              <span className="wiki-subject-card__body">
                <strong>{subject.label}</strong>
                <small>{toFa(subject.count)} مقاله</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── پرجست‌وجوها ── */}
      <section className="wiki-section" aria-labelledby="wiki-popular-title">
        <div className="wiki-section__head">
          <h2 id="wiki-popular-title">پرجست‌وجوهای ویکی</h2>
        </div>
        <div className="wiki-popular">
          {home.popular.map((article) => (
            <button
              key={article.slug}
              type="button"
              className="wiki-topic-card"
              style={{ '--accent': api.subjectAccent(article.subject) }}
              onClick={() => onOpenArticle(article.slug, { from: 'home' })}
            >
              <span className="wiki-topic-card__top">
                <TypeBadge type={article.type} subject={article.subject} />
                {article.abbreviations.length > 0 && (
                  <span className="wiki-topic-card__abbr">{article.abbreviations[0]}</span>
                )}
              </span>
              <strong>{article.title}</strong>
              <span className="wiki-topic-card__english">{article.englishTitle}</span>
              <p>{article.summary}</p>
              <span className="wiki-topic-card__foot">
                <SubjectTag subject={article.subject} />
                <GoArrow />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── آخرین به‌روزرسانی‌ها ── */}
      <section className="wiki-section" aria-labelledby="wiki-recent-title">
        <div className="wiki-section__head">
          <h2 id="wiki-recent-title">به‌تازگی به‌روزرسانی شده</h2>
        </div>
        <div className="wiki-recent">
          {home.recent.map((article) => (
            <button
              key={article.slug}
              type="button"
              className="wiki-recent__row"
              onClick={() => onOpenArticle(article.slug, { from: 'home' })}
            >
              <span className="wiki-recent__dot" style={{ '--accent': api.subjectAccent(article.subject) }} aria-hidden="true" />
              <strong>{article.title}</strong>
              <span className="wiki-recent__en">{article.englishTitle}</span>
              <span className="wiki-recent__meta">
                <TypeBadge type={article.type} subject={article.subject} />
                <span className="wiki-recent__time">
                  <Icon name="clock" size={13} />
                  {api.formatRelativeDays(article.lastUpdated)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <p className="wiki-foot">
        ویکی تپش به‌صورت پیوسته با منابع معتبر به‌روزرسانی می‌شود؛ محتوای آموزشی تپش جایگزین مراجع
        رسمی نیست.
      </p>
    </div>
  );
}
