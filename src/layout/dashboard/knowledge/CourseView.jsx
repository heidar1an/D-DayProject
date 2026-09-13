/* ── Course View — هر درس با چه موضوعاتی شبکه را می‌سازد ──
   تأکید روی مفاهیم بین‌درسی (پل‌ها): همان چیزی که شبکهٔ دانش را از
   «لیست فصل هر درس» متمایز می‌کند. */

import { GRAPH, getGraphStats, courseAccent, courseLabel } from '../../../services/knowledge/knowledgeService';
import { CourseChip, NodeGlyph, ImportanceDots, EmptyState, faCount } from './knowledgeShared';

export default function CourseView({ onOpenNode, onEnterTopic }) {
  const stats = getGraphStats(GRAPH);
  const bridges = GRAPH.nodes.filter((node) => (node.courses ?? []).length > 1);

  if (stats.byCourse && Object.keys(stats.byCourse).length === 0) {
    return <EmptyState title="هنوز درسی در شبکه ثبت نشده" />;
  }

  return (
    <div className="kn-courses">
      <div className="kn-courses__intro">
        <h2>شبکه از چشم درس‌ها</h2>
        <p>
          هر درس بخشی از شبکه را روشن می‌کند؛ اما مفاهیم بین‌درسی همان پل‌هایی هستند که
          دیابت را به بیوشیمی و فیزیولوژی و فارماکولوژی وصل می‌کنند.
        </p>
      </div>

      <div className="kn-courses__grid">
        {Object.entries(stats.byCourse)
          .sort((a, b) => b[1] - a[1])
          .map(([courseId, count]) => {
            const topics = GRAPH.nodes.filter((node) => node.courses.includes(courseId));
            const shared = topics.filter((node) => node.courses.length > 1);
            return (
              <section key={courseId} className="kn-course" style={{ '--accent': courseAccent(courseId) }}>
                <header className="kn-course__head">
                  <h3>{courseLabel(courseId)}</h3>
                  <span className="kn-course__count">{faCount(count)} مفهوم</span>
                </header>

                <div className="kn-course__list">
                  {topics
                    .sort((a, b) => b.importance - a.importance)
                    .slice(0, 8)
                    .map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        className="kn-course__item"
                        onClick={() => onOpenNode?.(node.id)}
                      >
                        <NodeGlyph type={node.type} size={12} />
                        <span>{node.title}</span>
                        {node.courses.length > 1 ? <em title={`همچنین در ${node.courses.slice(1).map((c) => courseLabel(c)).join('، ')}`}>پل</em> : null}
                      </button>
                    ))}
                  {topics.length > 8 ? (
                    <p className="kn-course__more">و {faCount(topics.length - 8)} مفهوم دیگر…</p>
                  ) : null}
                </div>

                {shared.length > 0 ? (
                  <footer className="kn-course__shared">
                    <span>مفاهیم مشترک با درس‌های دیگر: {faCount(shared.length)}</span>
                    <div>
                      {shared.slice(0, 3).map((node) => (
                        <CourseChip key={node.id} courseId={node.courses.find((c) => c !== courseId)} compact />
                      ))}
                    </div>
                  </footer>
                ) : null}
              </section>
            );
          })}
      </div>

      {bridges.length > 0 ? (
        <section className="kn-courses__bridges" aria-label="مفاهیم بین‌درسی">
          <h3>پل‌های بین‌درسی شبکه</h3>
          <div className="kn-courses__bridge-list">
            {bridges
              .sort((a, b) => b.courses.length - a.courses.length)
              .map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className="kn-bridge"
                  onClick={() => onOpenNode?.(node.id)}
                >
                  <NodeGlyph type={node.type} size={13} />
                  <strong>{node.title}</strong>
                  <span className="kn-bridge__courses">
                    {node.courses.map((courseId) => (
                      <CourseChip key={courseId} courseId={courseId} compact />
                    ))}
                  </span>
                  <ImportanceDots value={node.importance} />
                </button>
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
