/*
 * لایهٔ مبحث‌های یک درس — بین کارت درس و خوانندهٔ میکرودرسنامه.
 * کلیک روی درس (مثل فیزیولوژی) این فهرست را باز می‌کند؛ کلیک روی مبحث منتشرشده
 * (مثل قلب و گردش خون) خوانندهٔ صفحه‌به‌صفحه را باز می‌کند. مبحث‌های در راه با
 * حالت «به‌زودی» نمایش داده می‌شوند.
 */

import { toFa } from '../learning/learningUtils';

export default function MicroTopics({ course, subjectTitle, onBack, onOpenTopic }) {
  /* عنوان درس برای درس‌های بدون میکرودرسنامهٔ منتشرشده از خود SUBJECTS می‌آید */
  const title = course?.title ?? subjectTitle ?? 'این درس';
  const accent = course?.accent ?? '#937fcd';
  const published = course?.topics?.filter((topic) => topic.published) ?? [];
  const upcoming = course?.topics?.filter((topic) => !topic.published) ?? [];

  /* مبحث منتشرشده: تعداد صفحه‌ها و checkpointها برای نمایش روی کارت */
  const topicStats = (topic) => {
    const unit = topic.units?.[0];
    if (!unit) return null;
    return { pages: unit.pages.length, checkpoints: unit.checkpoints?.length ?? 0 };
  };

  return (
    <section className="micr-topics" dir="rtl" aria-label={`مبحث‌های ${title}`}>
      <div className="micr-topics__inner">
        <div className="micr-topbar">
          <button className="micr-topbar__back" type="button" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
            بازگشت به میکرو درس‌ها
          </button>
          <span className="micr-topbar__crumb">میکرو درسنامه / {title}</span>
        </div>

        <header className="micr-topics__head dash-stagger" style={{ '--accent': accent }}>
          <h1>مبحث‌های {title}</h1>
          <p>
            {course?.description
              ?? 'میکرودرسنامهٔ این درس در حال ساخت است؛ مبحث‌ها صفحه‌به‌صفحه با تست‌های میان راه منتشر می‌شوند.'}
          </p>
        </header>

        {published.length === 0 && upcoming.length === 0 ? (
          <div className="micr-topics__soon dash-stagger">
            <strong>هنوز مبحثی برای این درس منتشر نشده</strong>
            <p>میکرودرسنامهٔ این درس به‌زودی با اولین مبحثش در دسترس قرار می‌گیرد.</p>
          </div>
        ) : (
          <div className="micr-topics__grid dash-stagger">
            {published.map((topic) => {
              const stats = topicStats(topic);
              return (
                <button
                  key={topic.id}
                  type="button"
                  className="micr-topic is-published"
                  style={{ '--accent': topic.accent ?? accent }}
                  onClick={() => onOpenTopic(topic)}
                >
                  <span className="micr-topic__ring" aria-hidden="true">
                    <svg viewBox="0 0 36 36">
                      <circle className="micr-topic__ring-track" cx="18" cy="18" r="15.5" />
                      <circle className="micr-topic__ring-fill" cx="18" cy="18" r="15.5" />
                    </svg>
                    <i>شروع</i>
                  </span>
                  <span className="micr-topic__body">
                    <strong>{topic.title}</strong>
                    <span>{topic.description}</span>
                  </span>
                  {stats && (
                    <span className="micr-topic__meta">
                      {toFa(stats.pages)} صفحه · {toFa(stats.checkpoints)} checkpoint
                    </span>
                  )}
                  <span className="micr-topic__go" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m6-6-6 6 6 6" /></svg>
                  </span>
                </button>
              );
            })}

            {upcoming.map((topic) => (
              <div key={topic.id} className="micr-topic is-soon" style={{ '--accent': topic.accent ?? accent }}>
                <span className="micr-topic__body">
                  <strong>{topic.title}</strong>
                  <span>{topic.description}</span>
                </span>
                <span className="micr-topic__soon">به‌زودی</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
