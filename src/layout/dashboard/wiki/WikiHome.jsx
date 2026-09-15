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

    </div>
  );
}
