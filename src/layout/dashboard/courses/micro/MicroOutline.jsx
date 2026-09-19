/*
 * فهرست صفحات میکرودرسنامه — ستون ساختار مبحث.
 * نمایش وضعیت هر صفحه (خوانده‌شده/نشان‌دار/دارای تست)، رخداد checkpointها در جریان
 * و پرش به صفحهٔ مشخص. در موبایل به drawer تبدیل می‌شود (مدیریت نمایش با خواننده).
 */

import { toFa } from '../learning/learningUtils';

function PageStateIcon({ status, bookmark }) {
  if (status === 'completed') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    );
  }
  if (bookmark) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 3h12v18l-6-4.5L6 21z" />
      </svg>
    );
  }
  return <i aria-hidden="true" />;
}

export default function MicroOutline({
  course,
  topic,
  unit,
  flow,
  currentIndex,
  pageStates,
  checkpointStates,
  onSelect,
  activeKind,
}) {
  return (
    <nav className="micr-outline" aria-label="فهرست صفحات میکرودرسنامه">
      <div className="micr-outline__course">
        <strong>{topic?.title ?? course.title}</strong>
        <span>{course.title}</span>
      </div>

      <ol className="micr-outline__list">
        {flow.map((item, index) => {
          if (item.kind === 'checkpoint') {
            const state = checkpointStates[item.checkpoint.id];
            const done = state?.completed;
            /* برچسب «تست» دقیقاً روی رخداد checkpoint می‌نشیند — همان‌جایی که تست هست */
            return (
              <li key={item.checkpoint.id} className="micr-outline__cp">
                <button
                  type="button"
                  className={`${index === currentIndex && activeKind === 'checkpoint' ? 'is-active' : ''}`}
                  onClick={() => onSelect(index)}
                >
                  <span className="micr-outline__cpdot" aria-hidden="true">{done ? '✓' : '·'}</span>
                  <span>Checkpoint — بعد از صفحهٔ {toFa(unit.pages.find((page) => page.id === item.checkpoint.afterPage)?.order ?? '')}</span>
                  <span className="micr-outline__test">تست</span>
                </button>
              </li>
            );
          }

          const page = item.page;
          const pageState = pageStates[page.id];
          return (
            <li key={page.id}>
              <button
                type="button"
                className={`micr-outline__item${index === currentIndex && activeKind === 'page' ? ' is-active' : ''}${pageState?.status === 'completed' ? ' is-done' : ''}`}
                onClick={() => onSelect(index)}
              >
                <span className="micr-outline__state" aria-hidden="true">
                  <PageStateIcon status={pageState?.status} bookmark={pageState?.bookmark} />
                </span>
                <span className="micr-outline__body">
                  <small>{toFa(page.order)}</small>
                  <span>{page.title}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="micr-outline__foot">
        <span>{toFa(unit.pages.length)} صفحه · {toFa(unit.checkpoints.length)} checkpoint</span>
      </div>
    </nav>
  );
}
