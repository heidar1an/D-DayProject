/* ── پنل جزئیات نود ──
   بدون خارج‌کردن کاربر از گراف: شناسنامهٔ مفهوم، وضعیت مطالعه، پیش‌نیازها،
   وابسته‌ها، موضوعات مرتبط، محتوای تپش و ورود به صفحهٔ موضوع.
   در دسکتاپ کارت شناور کنار گراف؛ در موبایل Bottom Sheet. */

import { useMemo } from 'react';
import {
  getNodeDetail,
  contentCounts,
  getTopicContent,
  setNodeProgress,
  statusLabel,
  STATUS_META,
} from '../../../services/knowledge/knowledgeService';
import { relationLabel } from '../../../services/knowledge/graphData';
import { NodeGlyph, CourseChip, TypeBadge, ImportanceDots, StatusBadge, STATUS_OPTIONS, faCount, KnButton } from './knowledgeShared';
import { EnterIcon, CloseIcon, ExpandIcon } from './knowledgeIcons';

const faDigits = (value) => String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

export default function NodeDetailPanel({
  nodeId,
  userId,
  progressMap,
  onProgressChange,
  onOpenNode,
  onEnterTopic,
  onExpand,
  onClose,
}) {
  const detail = useMemo(() => (nodeId ? getNodeDetail(nodeId) : null), [nodeId]);
  const node = detail?.node;

  /* شمارش محتوای پویا (سینک و ارزان از لایهٔ دادهٔ سایر بخش‌ها) */
  const content = useMemo(() => (node ? contentCounts(getTopicContent(node.id)) : null), [node]);
  const contentLinks = useMemo(() => (node ? getTopicContent(node.id) : null), [node]);

  if (!nodeId || !node) return null;

  const status = progressMap[node.id]?.status ?? 'unstarted';
  const progress = progressMap[node.id]?.progress ?? 0;

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

  const outgoing = detail.neighbors.filter(({ relation }) => relation.direction === 'out');
  const incoming = detail.neighbors.filter(({ relation }) => relation.direction === 'in');

  return (
    <aside className="kn-panel" aria-label={`جزئیات ${node.title}`}>
      <header className="kn-panel__head">
        <span className="kn-panel__glyph" style={{ '--accent': detail.courses[0]?.accent ?? '#8a8a8a' }}>
          <NodeGlyph type={node.type} size={20} />
        </span>
        <div className="kn-panel__title">
          <h3>{node.title}</h3>
          <span dir="ltr">{node.englishTitle}</span>
        </div>
        <button type="button" className="kn-panel__close" aria-label="بستن پنل" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      <div className="kn-panel__body">
        <div className="kn-panel__badges">
          <TypeBadge type={node.type} />
          {detail.courses.map((course) => (
            <CourseChip key={course.id} courseId={course.id} />
          ))}
        </div>

        <p className="kn-panel__desc">{node.description}</p>

        <div className="kn-panel__metarow">
          <ImportanceDots value={node.importance} />
          <span className="kn-panel__difficulty">{node.difficulty}</span>
          <StatusBadge status={status} />
        </div>

        {/* وضعیت مطالعه کاربر */}
        <section className="kn-panel__section" aria-label="وضعیت مطالعه من">
          <h4>وضعیت مطالعه من</h4>
          <div className="kn-status-picker">
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
          {status !== 'unstarted' ? (
            <div className="kn-progress" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
              <span style={{ width: `${progress}%` }} />
              <em>{faDigits(progress)}٪</em>
            </div>
          ) : null}
        </section>

        {/* پیش‌نیازها */}
        {detail.prerequisites.length > 0 ? (
          <section className="kn-panel__section" aria-label="پیش‌نیازها">
            <h4>برای فهم این مفهوم، اول این‌ها را بخوان</h4>
            <div className="kn-panel__nodes">
              {detail.prerequisites.map((prereq) => (
                <button key={prereq.id} type="button" className="kn-node-link" onClick={() => onOpenNode?.(prereq.id)}>
                  <NodeGlyph type={prereq.type} size={12} />
                  {prereq.title}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* وابسته‌ها */}
        {detail.dependents.length > 0 ? (
          <section className="kn-panel__section" aria-label="مفاهیمی که روی این مفهوم سوارند">
            <h4>این مفهوم پایهٔ فهم این‌هاست</h4>
            <div className="kn-panel__nodes">
              {detail.dependents.map((dependent) => (
                <button key={dependent.id} type="button" className="kn-node-link" onClick={() => onOpenNode?.(dependent.id)}>
                  <NodeGlyph type={dependent.type} size={12} />
                  {dependent.title}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* ارتباطات مهم */}
        <section className="kn-panel__section" aria-label="ارتباطات">
          <h4>ارتباطات در شبکه</h4>
          {detail.neighbors.length === 0 ? (
            <p className="kn-panel__hint">این مفهوم فعلاً رابطه‌ای در شبکه ندارد.</p>
          ) : (
            <ul className="kn-relations">
              {outgoing.slice(0, 5).map(({ node: target, relation }) => (
                <li key={`out-${target.id}`}>
                  <button type="button" onClick={() => onOpenNode?.(target.id)}>
                    <span className="kn-relations__type">{relationLabel(relation.type)} →</span>
                    <strong>{target.title}</strong>
                  </button>
                </li>
              ))}
              {incoming.slice(0, 5).map(({ node: source, relation }) => (
                <li key={`in-${source.id}`}>
                  <button type="button" onClick={() => onOpenNode?.(source.id)}>
                    <span className="kn-relations__type">← {relationLabel(relation.type)}</span>
                    <strong>{source.title}</strong>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* محتوای تپش — شمارش پویا */}
        <section className="kn-panel__section" aria-label="محتوای مرتبط در تپش">
          <h4>محتوای مرتبط در تپش</h4>
          {content && content.lessons + content.tests + content.flashcards + content.articles === 0 ? (
            <p className="kn-panel__hint">
              برای این مفهوم هنوز محتوایی در بخش‌های دیگر تپش منتشر نشده؛ با گسترش ویکی و بانک تست، این‌جا خودکار پر می‌شود.
            </p>
          ) : (
            <div className="kn-content-chips">
              {content?.lessons > 0 ? <span className="kn-chip kn-chip--plain">{faCount(content.lessons)} ویکی</span> : null}
              {content?.tests > 0 ? <span className="kn-chip kn-chip--plain">{faCount(content.tests)} تست</span> : null}
              {content?.flashcards > 0 ? <span className="kn-chip kn-chip--plain">{faCount(content.flashcards)} فلش‌کارت</span> : null}
              {content?.articles > 0 ? <span className="kn-chip kn-chip--plain">{faCount(content.articles)} مقاله</span> : null}
              {contentLinks?.wiki.slice(0, 2).map((wikiItem) => (
                <span key={wikiItem.slug} className="kn-chip kn-chip--plain kn-chip--soft">{wikiItem.title}</span>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="kn-panel__footer">
        <KnButton variant="kn-button--accent" icon={<ExpandIcon />} onClick={() => onExpand?.(node.id)}>
          نمایش شاخه‌ها
        </KnButton>
        <KnButton variant="kn-button--primary" icon={<EnterIcon />} onClick={() => onEnterTopic?.(node.id)}>
          ورود به موضوع
        </KnButton>
      </footer>
    </aside>
  );
}
