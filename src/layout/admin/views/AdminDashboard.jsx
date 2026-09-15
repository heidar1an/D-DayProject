/*
 * داشبورد پنل — آمار واقعی از سرور (نه داده نمایشی).
 * همهٔ اعداد از `/api/admin/stats` می‌آیند و پس از هر تغییر محتوا تازه می‌شوند.
 */

import { getStats } from '../../../services/admin/adminService';
import {
  Button, Card, ErrorState, LoadingBlock, StatusBadge, faDateTime, faNumber, relativeTime, toFa, useAsync,
} from '../adminShared';
import {
  IconArticle, IconBanner, IconMedia, IconPage, IconRefresh, IconUser,
} from '../adminIcons';

const CARDS = [
  { key: 'articles', label: 'مقالات', icon: IconArticle, tone: 'purple', hint: (totals) => `${toFa(totals.published)} منتشرشده · ${toFa(totals.drafts)} پیش‌نویس` },
  { key: 'pages', label: 'صفحات', icon: IconPage, tone: 'blue', hint: () => 'صفحات عمومی سایت' },
  { key: 'admins', label: 'کاربران پنل', icon: IconUser, tone: 'green', hint: () => 'مدیران و نویسندگان' },
  { key: 'media', label: 'فایل‌های رسانه', icon: IconMedia, tone: 'copper', hint: () => 'تصاویر و اسناد' },
  { key: 'banners', label: 'بنرها', icon: IconBanner, tone: 'gold', hint: () => 'بنرهای فعال صفحه اصلی' },
];

export default function AdminDashboard({ navigate }) {
  const { data, loading, error, reload } = useAsync(() => getStats(), []);

  if (loading && !data) return <LoadingBlock label="در حال خواندن آمار…" rows={5} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const { totals, activitySeries, recentActivity, topArticles } = data;
  const maxCount = Math.max(1, ...activitySeries.map((day) => day.count));

  return (
    <div className="ad-stack">
      <div className="ad-statgrid">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <article className={`ad-stat ad-stat--${card.tone}`} key={card.key}>
              <span className="ad-stat__icon"><Icon width={20} height={20} /></span>
              <div>
                <span className="ad-stat__value">{faNumber(totals[card.key])}</span>
                <span className="ad-stat__label">{card.label}</span>
                <small className="ad-stat__hint">{card.hint(totals)}</small>
              </div>
            </article>
          );
        })}
      </div>

      <div className="ad-split">
        <Card
          title="فعالیت ۱۴ روز اخیر"
          description="تعداد رویدادهای ثبت‌شدهٔ مدیریتی"
          actions={<Button variant="ghost" size="sm" onClick={reload}><IconRefresh width={15} height={15} />تازه‌سازی</Button>}
        >
          <div className="ad-chart" role="img" aria-label="نمودار فعالیت دو هفتهٔ اخیر">
            {activitySeries.map((day) => (
              <div className="ad-chart__col" key={day.date} title={`${day.date}: ${day.count} رویداد`}>
                <span
                  className="ad-chart__bar"
                  style={{ height: `${Math.max(4, (day.count / maxCount) * 100)}%` }}
                />
                <span className="ad-chart__tick">{toFa(day.date.slice(8))}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="پربازدیدترین مقالات" description="بر اساس شمارندهٔ بازدید">
          {topArticles.length === 0 ? (
            <p className="ad-muted">هنوز مقاله‌ای ثبت نشده است.</p>
          ) : (
            <ul className="ad-ranklist">
              {topArticles.map((article, index) => (
                <li key={article.id}>
                  <span className="ad-ranklist__rank">{toFa(index + 1)}</span>
                  <button type="button" className="ad-ranklist__title" onClick={() => navigate('article-editor', { id: article.id })}>
                    {article.title}
                  </button>
                  <span className="ad-ranklist__meta">{faNumber(article.views)} بازدید</span>
                  <StatusBadge status={article.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="آخرین رویدادها"
        description="هر تغییر مهم مدیریتی اینجا ثبت می‌شود"
        actions={<Button variant="ghost" size="sm" onClick={() => navigate('logs')}>مشاهدهٔ همه</Button>}
      >
        {recentActivity.length === 0 ? (
          <p className="ad-muted">هنوز رویدادی ثبت نشده است.</p>
        ) : (
          <ul className="ad-feed">
            {recentActivity.map((entry) => (
              <li key={entry.id}>
                <span className="ad-feed__dot" aria-hidden="true" />
                <div className="ad-feed__body">
                  <p>
                    <strong>{entry.userName}</strong>
                    {' — '}
                    {entry.entityLabel || entry.entityType}
                  </p>
                  <small>{faDateTime(entry.createdAt)} · {relativeTime(entry.createdAt)}</small>
                </div>
                <code className="ad-feed__action">{entry.action}</code>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
