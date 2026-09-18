/* لیست مطالعه: ذخیره‌شده‌ها، در حال مطالعه و خوانده‌شده‌ها */

import { useState, useSyncExternalStore } from 'react';

import { getArticlesByIds, categoryAccent } from '../../services/articles/articlesService';
import {
  getCompleted,
  getInProgress,
  getReadingList,
  getUserStateSnapshot,
  subscribe,
} from '../../services/articles/userState';
import { ArticleCard, faPercent, toFa, usePageMeta } from './articlesShared';
import './articles.css';

const TABS = [
  { id: 'saved', label: 'ذخیره‌شده‌ها', hint: 'مقاله‌هایی که برای بعد ذخیره کرده‌ای.' },
  { id: 'progress', label: 'در حال مطالعه', hint: 'از همان‌جایی که رها کردی ادامه بده.' },
  { id: 'done', label: 'خوانده‌شده‌ها', hint: 'مقاله‌هایی که تا آخر خوانده‌ای.' },
];

export default function ReadingListPage() {
  const [tab, setTab] = useState('saved');
  const snapshot = useSyncExternalStore(subscribe, getUserStateSnapshot);
  void snapshot;

  usePageMeta({
    title: 'لیست مطالعه | مقالات تپش',
    description: 'مقاله‌های ذخیره‌شده، در حال مطالعه و خوانده‌شده تو در تپش.',
    path: '/#articles/saved',
  });

  const entries =
    tab === 'saved' ? getReadingList() : tab === 'progress' ? getInProgress() : getCompleted();

  const articles = getArticlesByIds(entries.map((entry) => entry.articleId));
  const activeTab = TABS.find((item) => item.id === tab);

  return (
    <main className="articles-page ap-layer-reveal">
      <div className="ap-shell ap-stagger">
        <section className="ap-hero ap-hero--compact" aria-labelledby="ap-saved-title">
          <a className="ap-saved-back" href="#articles">
            <span aria-hidden="true">→</span>
            بازگشت به مقالات
          </a>
          <h1 id="ap-saved-title">لیست مطالعه</h1>
          <p>آنچه برای خودت نگه داشته‌ای؛ از ادامه مطالعه تا مرور مقاله‌های خوانده‌شده.</p>
        </section>

        <div className="ap-saved-tabs" role="tablist" aria-label="مجموعه‌های لیست مطالعه">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`ap-saved-tab ${tab === item.id ? 'is-active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {articles.length === 0 ? (
          <div className="ap-empty">
            <span className="ap-empty__icon" aria-hidden="true">
              {tab === 'saved' ? '🔖' : tab === 'progress' ? '📖' : '✓'}
            </span>
            <h3>
              {tab === 'saved'
                ? 'هنوز مقاله‌ای ذخیره نکرده‌ای.'
                : tab === 'progress'
                  ? 'مقاله‌ای نیمه‌کاره نداری.'
                  : 'هنوز مقاله‌ای را کامل نخوانده‌ای.'}
            </h3>
            <p>{activeTab?.hint}</p>
            <a href="#articles">رفتن به مقالات</a>
          </div>
        ) : tab === 'progress' ? (
          <div className="ap-progress-list">
            {entries.map((entry) => {
              const article = articles.find((item) => item.id === entry.articleId);
              if (!article) return null;

              return (
                <a className="ap-progress-row" href={`#articles/${article.slug}`} key={entry.articleId}>
                  <span className={`ap-progress-row__thumb ap-cover-art--${categoryAccent(article.category)}`} aria-hidden="true">
                    {article.cover ? <img src={article.cover} alt="" loading="lazy" /> : null}
                  </span>
                  <span className="ap-progress-row__body">
                    <span className={`ap-card__category ap-card__category--${categoryAccent(article.category)}`}>
                      {article.learning?.topic ?? 'مقاله تپش'}
                    </span>
                    <span className="ap-progress-row__title">{article.title}</span>
                    <span className="ap-progress-row__bar" aria-hidden="true">
                      <span style={{ transform: `scaleX(${entry.progress ?? 0})` }} />
                    </span>
                  </span>
                  <span className="ap-progress-row__percent">{faPercent(entry.progress ?? 0)}</span>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="ap-masonry ap-masonry--single">
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
