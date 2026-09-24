/*
 * لایهٔ مبحث‌های یک درس — بین کارت درس و خوانندهٔ میکرودرسنامه.
 * کلیک روی درس (مثل فیزیولوژی) این فهرست را باز می‌کند؛ کلیک روی هر مبحث، خوانندهٔ
 * صفحه‌به‌صفحه را باز می‌کند. همهٔ مبحث‌ها فعال‌اند و حالت «به‌زودی» وجود ندارد؛
 * مبحث‌هایی که هنوز واحد یادگیری ندارند، پیام «آماده نشده» را داخل خودِ خواننده می‌بینند.
 */

import { useMemo } from 'react';
import { toFa } from '../learning/learningUtils';
import { MicroProgressService } from '../../../../services/micro/microProgressService';

/* درصد پیشرفت واقعی یک مبحث — نسبت صفحه‌های completed هر واحد (به وزن تعداد صفحه) */
function topicProgress(course, topic, userId) {
  const units = topic.units ?? [];
  if (!units.length) return 0;
  const state = MicroProgressService.load(course, userId);
  let totalPages = 0;
  let completedPages = 0;
  for (const unit of units) {
    totalPages += unit.pages.length;
    const unitState = state.units?.[unit.id];
    if (!unitState) continue;
    completedPages += unit.pages.filter((page) => unitState.pages?.[page.id]?.status === 'completed').length;
  }
  return totalPages ? Math.round((completedPages / totalPages) * 100) : 0;
}

export default function MicroTopics({ course, subjectTitle, onBack, onOpenTopic, userId = 'local-user' }) {
  /* عنوان درس برای درس‌های بدون میکرودرسنامهٔ منتشرشده از خود SUBJECTS می‌آید */
  const title = course?.title ?? subjectTitle ?? 'این درس';
  const accent = course?.accent ?? '#937fcd';
  /* همهٔ مبحث‌های درس فعال و قابل ورودند — حالت «به‌زودی» به درخواست کاربر برداشته شد.
     مبحث‌هایی که هنوز صفحه ندارند، خودِ خواننده پیام روشن نشان می‌دهد. */
  const topics = course?.topics ?? [];

  /* مبحث منتشرشده: تعداد صفحه‌ها و ایستگاه‌ها برای نمایش روی کارت */
  const topicStats = (topic) => {
    const unit = topic.units?.[0];
    if (!unit) return null;
    return { pages: unit.pages.length, checkpoints: unit.checkpoints?.length ?? 0 };
  };

  /* درصد پیشرفت هر مبحث — دوباره خوانده می‌شود هر بار این لایه سوار می‌شود */
  const topicProgressMap = useMemo(() => {
    const map = new Map();
    if (!course) return map;
    for (const topic of course.topics ?? []) {
      map.set(topic.id, topicProgress(course, topic, userId));
    }
    return map;
  }, [course, userId]);

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
        </div>

        <header className="micr-topics__head dash-stagger" style={{ '--accent': accent }}>
          <h1>مبحث‌های {title}</h1>
          <p>
            {course?.description
              ?? 'میکرودرسنامهٔ این درس در حال ساخت است؛ مبحث‌ها صفحه‌به‌صفحه با تست‌های میان راه منتشر می‌شوند.'}
          </p>
        </header>

        {topics.length === 0 ? (
          <div className="micr-topics__soon dash-stagger">
            <strong>هنوز مبحثی برای این درس منتشر نشده</strong>
            <p>میکرودرسنامهٔ این درس به‌زودی با اولین مبحثش در دسترس قرار می‌گیرد.</p>
          </div>
        ) : (
          <div className="micr-topics__grid dash-stagger">
            {topics.map((topic) => {
              const stats = topicStats(topic);
              const progress = topicProgressMap.get(topic.id) ?? 0;
              const circumference = 2 * Math.PI * 15.5;
              const offset = circumference * (1 - progress / 100);
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
                      <circle
                        className="micr-topic__ring-fill"
                        cx="18" cy="18" r="15.5"
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={offset}
                      />
                    </svg>
                    <i>{toFa(progress)}٪</i>
                  </span>
                  <span className="micr-topic__body">
                    <strong>{topic.title}</strong>
                    <span>{topic.description}</span>
                  </span>
                  {stats && (
                    <span className="micr-topic__meta">
                      {toFa(stats.pages)} صفحه · {toFa(stats.checkpoints)} ایستگاه
                    </span>
                  )}
                  <span className="micr-topic__go" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m6-6-6 6 6 6" /></svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
