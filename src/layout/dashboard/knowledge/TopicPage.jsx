/* ── صفحهٔ اختصاصی هر Topic ──
   مطالعهٔ «یکپارچه» یک موضوع: تعریف، چرا مهم است، بخش‌بندی بر اساس درس
   (از همسایه‌های گراف ساخته می‌شود)، ارتباطات مهم، مسیر پیشنهادی مطالعه،
   محتوای تپش و موضوعات مرتبط. در همین لایه باز می‌شود، نه صفحهٔ جدا. */

import { useMemo } from 'react';
import {
  getNodeDetail,
  getTopicContent,
  contentCounts,
  getLearningPath,
  setNodeProgress,
  courseAccent,
  courseLabel,
  statusLabel,
} from '../../../services/knowledge/knowledgeService';
import { relationLabel } from '../../../services/knowledge/graphData';
import {
  NodeGlyph,
  CourseChip,
  TypeBadge,
  ImportanceDots,
  StatusBadge,
  STATUS_OPTIONS,
  KnBackButton,
  faCount,
} from './knowledgeShared';

const faDigits = (value) => String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

export default function TopicPage({ nodeId, userId, progressMap, onProgressChange, onOpenNode, onBack, onSelect }) {
  const detail = useMemo(() => getNodeDetail(nodeId), [nodeId]);
  const node = detail?.node;

  const learningPath = useMemo(() => (node ? getLearningPath(node.id) : null), [node]);
  const content = useMemo(() => (node ? contentCounts(getTopicContent(node.id)) : null), [node]);
  const contentDetail = useMemo(() => (node ? getTopicContent(node.id) : null), [node]);

  if (!node) {
    return (
      <div className="kn-topic">
        <KnBackButton onClick={onBack}>بازگشت به شبکهٔ دانش</KnBackButton>
        <div className="kn-empty">
          <span className="kn-empty__icon" aria-hidden="true">◦</span>
          <h3>این موضوع در شبکه پیدا نشد</h3>
          <p>ممکن است مفهوم جابه‌جا یا حذف شده باشد؛ از جست‌وجوی بالای صفحه استفاده کنید.</p>
        </div>
      </div>
    );
  }

  const status = progressMap[node.id]?.status ?? 'unstarted';
  const progress = progressMap[node.id]?.progress ?? 0;

  /* بخش‌بندی درسی از همسایه‌های گراف: هر درسِ دارای همسایه یک بخش است */
  const courseSections = useMemo(() => {
    const byCourse = new Map();
    detail.neighbors.forEach(({ node: neighbor }) => {
      (neighbor.courses ?? []).forEach((courseId) => {
        if ((node.courses ?? []).includes(courseId) && (neighbor.courses ?? []).length > 1) {
          /* همسایه‌های بین‌درسی در همهٔ درس‌های خودشان آمده‌اند؛ فقط یک‌بار در درس اصلی‌شان */
          if (neighbor.courses[0] !== courseId) return;
        }
        if (!byCourse.has(courseId)) byCourse.set(courseId, []);
        byCourse.get(courseId).push(neighbor);
      });
    });
    /* همسایه‌ای که درس مشترکی با نود ندارد → در درس اصلی خودش می‌نشیند */
    detail.neighbors.forEach(({ node: neighbor }) => {
      const hasCourseSection = (neighbor.courses ?? []).some((courseId) => byCourse.has(courseId));
      if (!hasCourseSection) {
        const courseId = neighbor.courses?.[0];
        if (courseId && !byCourse.has(courseId)) byCourse.set(courseId, []);
        if (courseId) {
          const list = byCourse.get(courseId);
          if (!list.some((item) => item.id === neighbor.id)) list.push(neighbor);
        }
      }
    });
    return [...byCourse.entries()]
      .filter(([, list]) => list.length > 0)
      .map(([courseId, list]) => ({
        courseId,
        accent: courseAccent(courseId),
        items: [...new Map(list.map((item) => [item.id, item])).values()],
      }));
  }, [detail, node]);

  const handleStatus = (nextStatus) => {
    const patch =
      nextStatus === 'unstarted'
        ? { status: nextStatus, progress: 0 }
        : {
            status: nextStatus,
            progress:
              nextStatus === 'studying' ? Math.max(progress, 35)
              : nextStatus === 'studied' ? Math.max(progress, 70)
              : nextStatus === 'mastered' ? 100
              : progress,
          };
    setNodeProgress(userId, node.id, patch);
    onProgressChange?.();
  };

  const relations = detail.neighbors
    .filter(({ relation }) => relation.direction === 'out')
    .map(({ node: target, relation }) => ({ other: target, label: relationLabel(relation.type), direction: 'out' }))
    .concat(
      detail.neighbors
        .filter(({ relation }) => relation.direction === 'in')
        .map(({ node: source, relation }) => ({ other: source, label: relationLabel(relation.type), direction: 'in' })),
    );

  return (
    <article className="kn-topic" aria-label={`صفحهٔ موضوع ${node.title}`}>
      <header className="kn-topic__topbar">
        <KnBackButton onClick={onBack}>بازگشت به شبکهٔ دانش</KnBackButton>
        <nav className="kn-topic__crumb" aria-label="مسیر صفحه">
          <span>شبکهٔ دانش</span>
          <i aria-hidden="true">/</i>
          <strong>{node.title}</strong>
        </nav>
      </header>

      <header className="kn-topic__hero">
        <div className="kn-topic__hero-text">
          <div className="kn-topic__badges">
            <TypeBadge type={node.type} />
            {(node.courses ?? []).map((courseId) => (
              <CourseChip key={courseId} courseId={courseId} />
            ))}
          </div>
          <h1>{node.title}</h1>
          <p className="kn-topic__english" dir="ltr">{node.englishTitle}</p>
          <p className="kn-topic__desc">{node.description}</p>

          <div className="kn-topic__meta">
            <ImportanceDots value={node.importance} />
            <span className="kn-topic__difficulty">{node.difficulty}</span>
            <StatusBadge status={status} />
          </div>

          <div className="kn-status-picker kn-status-picker--inline">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`kn-status-picker__item ${status === option.id ? 'is-active' : ''}`}
                style={{ '--accent': option.accent }}
                aria-pressed={status === option.id}
                onClick={() => handleStatus(option.id)}
              >
                <i aria-hidden="true" />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <aside className="kn-topic__side">
          {contentDetail?.wiki.slice(0, 3).map((wikiItem) => (
            <span key={wikiItem.slug} className="kn-chip kn-chip--plain kn-chip--soft">{wikiItem.title}</span>
          ))}
          <dl className="kn-topic__stats">
            <div>
              <dt>ارتباطات مستقیم</dt>
              <dd>{faDigits(detail.neighbors.length)}</dd>
            </div>
            <div>
              <dt>پیش‌نیاز</dt>
              <dd>{faDigits(detail.prerequisites.length)}</dd>
            </div>
            <div>
              <dt>پایهٔ فهم</dt>
              <dd>{faDigits(detail.dependents.length)} مفهوم</dd>
            </div>
          </dl>
          <button
            type="button"
            className="kn-topic__goto-graph"
            onClick={() => onSelect?.(node.id)}
          >
            دیدن این مفهوم در گراف
          </button>
        </aside>
      </header>

      {node.whyImportant ? (
        <div className="kn-callout kn-callout--why">
          <h2>چرا این موضوع مهم است؟</h2>
          <p>{node.whyImportant}</p>
        </div>
      ) : null}

      {/* بخش‌بندی درسی — همان «در آناتومی / در فیزیولوژی / …» */}
      {courseSections.map((section) => (
        <section
          key={section.courseId}
          className="kn-topic__section"
          style={{ '--accent': section.accent }}
          aria-label={`در ${courseLabel(section.courseId)}`}
        >
          <h2>
            <i aria-hidden="true" />
            در {courseLabel(section.courseId)}
          </h2>
          <div className="kn-topic__cards">
            {section.items.map((item) => (
              <button key={item.id} type="button" className="kn-topic-card" onClick={() => onOpenNode?.(item.id)}>
                <span className="kn-topic-card__glyph" style={{ '--accent': courseAccent(item.courses?.[0]) }}>
                  <NodeGlyph type={item.type} size={16} />
                </span>
                <span className="kn-topic-card__text">
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {/* مسیر پیشنهادی مطالعه */}
      {learningPath && learningPath.steps.length > 1 ? (
        <section className="kn-topic__section kn-topic__section--path" aria-label="مسیر پیشنهادی مطالعه">
          <h2><i aria-hidden="true" />مسیر پیشنهادی مطالعه</h2>
          <p className="kn-topic__path-note">
            ترتیب زیر بر اساس وابستگی مفاهیم به هم ساخته شده، نه فهرست فصل‌های کتاب:
          </p>
          <ol className="kn-lpath">
            {learningPath.steps.map((step) => (
              <li key={step.node.id} className={step.isTarget ? 'is-target' : ''}>
                <button type="button" onClick={() => onOpenNode?.(step.node.id)}>
                  <span className="kn-lpath__num">{faDigits(step.order)}</span>
                  <span className="kn-lpath__title">
                    <strong>{step.node.title}</strong>
                    {step.feedsInto.length > 0 ? (
                      <small>پایهٔ فهم: {step.feedsInto.map((feed) => feed.title).join('، ')}</small>
                    ) : (
                      <small>{statusLabel(progressMap[step.node.id]?.status ?? 'unstarted')}</small>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* ارتباطات مهم */}
      {relations.length > 0 ? (
        <section className="kn-topic__section" aria-label="ارتباطات مهم">
          <h2><i aria-hidden="true" />ارتباطات مهم</h2>
          <ul className="kn-relations kn-relations--page">
            {relations.map(({ other, label, direction }) => (
              <li key={`${direction}-${other.id}`}>
                <button type="button" onClick={() => onOpenNode?.(other.id)}>
                  <span className="kn-relations__type">
                    {direction === 'out' ? `${label} ←` : `→ ${label}`}
                  </span>
                  <strong>{other.title}</strong>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* منابع و محتوای تپش */}
      <section className="kn-topic__section" aria-label="منابع و محتوای تپش">
        <h2><i aria-hidden="true" />منابع و محتوای تپش</h2>
        {content && content.lessons + content.tests + content.flashcards + content.articles === 0 ? (
          <p className="kn-panel__hint">
            هنوز محتوای مستقیمی برای این مفهوم منتشر نشده؛ با رشد ویکی، بانک تست و فلش‌کارت‌ها، این بخش خودکار به‌روز می‌شود.
          </p>
        ) : (
          <div className="kn-topic__content-grid">
            <div className="kn-content-card" style={{ '--accent': '#77b787' }}>
              <strong>{faDigits(content?.lessons ?? 0)}</strong>
              <span>ویکی‌نوشتهٔ مرتبط</span>
              {contentDetail?.wiki.slice(0, 3).map((wikiItem) => (
                <em key={wikiItem.slug}>{wikiItem.title}</em>
              ))}
            </div>
            <div className="kn-content-card" style={{ '--accent': '#5b8cc7' }}>
              <strong>{faDigits(content?.tests ?? 0)}</strong>
              <span>تست مرتبط در بانک</span>
            </div>
            <div className="kn-content-card" style={{ '--accent': '#ab8e7c' }}>
              <strong>{faDigits(content?.flashcards ?? 0)}</strong>
              <span>فلش‌کارت مرتبط</span>
            </div>
            <div className="kn-content-card" style={{ '--accent': '#937fcd' }}>
              <strong>{faDigits(content?.articles ?? 0)}</strong>
              <span>مقالهٔ مرتبط</span>
              {contentDetail?.articles.slice(0, 3).map((article) => (
                <em key={article.slug}>{article.title}</em>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* موضوعات مرتبط — از روابط واقعی، نه شباهت اسمی */}
      {detail.related.length > 0 ? (
        <section className="kn-topic__section" aria-label="موضوعات مرتبط">
          <h2><i aria-hidden="true" />موضوعات مرتبط</h2>
          <div className="kn-panel__nodes">
            {detail.related.map((relatedId) => {
              const related = getNodeDetail(relatedId).node;
              return (
                <button key={related.id} type="button" className="kn-node-link" onClick={() => onOpenNode?.(related.id)}>
                  <NodeGlyph type={related.type} size={12} />
                  {related.title}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </article>
  );
}
