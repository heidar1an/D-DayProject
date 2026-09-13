/* ── Topic View — موضوعات به شکل کارت و دسته‌بندی ──
   جایگزین لیستی گراف برای مرور سریع و موبایل: کارت‌های مفهوم گروه‌شده بر اساس
   درس، با جست‌وجوی محلی و مرتب‌سازی. */

import { useMemo, useState } from 'react';
import { GRAPH, courseAccent, courseLabel, nodeStatus } from '../../../services/knowledge/knowledgeService';
import { COURSES } from '../../../services/knowledge/graphData';
import { NodeGlyph, TypeBadge, ImportanceDots, StatusBadge, EmptyState, faCount } from './knowledgeShared';

const SORTERS = {
  importance: (a, b) => b.importance - a.importance,
  title: (a, b) => a.title.localeCompare(b.title, 'fa'),
  connections: (a, b) => GRAPH.degreeOf(b.id) - GRAPH.degreeOf(a.id),
};

export default function TopicsView({ onOpenNode, onEnterTopic, progressMap }) {
  const [query, setQuery] = useState('');
  const [course, setCourse] = useState(null);
  const [sort, setSort] = useState('importance');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return GRAPH.nodes
      .filter((node) => (!course || node.courses.includes(course)))
      .filter((node) =>
        !needle ||
        node.title.toLowerCase().includes(needle) ||
        node.englishTitle.toLowerCase().includes(needle) ||
        (node.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(needle)))
      .sort(SORTERS[sort]);
  }, [query, course, sort]);

  const grouped = useMemo(() => {
    const byCourse = new Map();
    filtered.forEach((node) => {
      node.courses.forEach((courseId) => {
        if (!byCourse.has(courseId)) byCourse.set(courseId, []);
        byCourse.get(courseId).push(node);
      });
    });
    return [...byCourse.entries()].map(([courseId, list]) => ({
      courseId,
      items: [...new Map(list.map((node) => [node.id, node])).values()],
    }));
  }, [filtered]);

  return (
    <div className="kn-topics">
      <header className="kn-topics__toolbar">
        <input
          type="search"
          className="kn-topics__filter"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="صاف‌کردن فهرست… مثلاً انسولین"
          aria-label="صاف‌کردن فهرست موضوعات"
        />
        <select
          className="kn-topics__sort"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          aria-label="مرتب‌سازی"
        >
          <option value="importance">مهم‌ترین</option>
          <option value="connections">پرارتباط‌ترین</option>
          <option value="title">الفبایی</option>
        </select>
      </header>

      <div className="kn-topics__courses" role="group" aria-label="فیلتر درس">
        <button
          type="button"
          className={`kn-chip kn-chip--action ${course === null ? 'is-active' : ''}`}
          onClick={() => setCourse(null)}
        >
          همه ({faCount(GRAPH.nodes.length)})
        </button>
        {COURSES.filter((item) => (item.id ? GRAPH.nodes.some((node) => node.courses.includes(item.id)) : false)).map(
          (item) => (
            <button
              key={item.id}
              type="button"
              className={`kn-chip kn-chip--action ${course === item.id ? 'is-active' : ''}`}
              style={{ '--accent': item.accent }}
              onClick={() => setCourse(course === item.id ? null : item.id)}
            >
              {item.label}
            </button>
          ),
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="مفهومی پیدا نشد"
          description="عبارت دیگری را امتحان کنید یا فیلتر درس را بردارید."
        />
      ) : (
        grouped.map((group) => (
          <section key={group.courseId} className="kn-topics__group" style={{ '--accent': courseAccent(group.courseId) }}>
            <h2>
              <i aria-hidden="true" />
              {courseLabel(group.courseId)}
              <small>{faCount(group.items.length)} مفهوم</small>
            </h2>
            <div className="kn-topics__grid">
              {group.items.map((node) => {
                const status = nodeStatus(progressMap, node.id);
                return (
                  <article
                    key={node.id}
                    className={`kn-card kn-card--status-${status}`}
                    onClick={() => onOpenNode?.(node.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onOpenNode?.(node.id);
                    }}
                  >
                    <header>
                      <span className="kn-card__glyph" style={{ '--accent': courseAccent(node.courses?.[0]) }}>
                        <NodeGlyph type={node.type} size={15} />
                      </span>
                      <h3>{node.title}</h3>
                    </header>
                    <p dir="auto">{node.description}</p>
                    <footer>
                      <TypeBadge type={node.type} />
                      <ImportanceDots value={node.importance} />
                      <StatusBadge status={status} withLabel={false} />
                    </footer>
                    <button
                      type="button"
                      className="kn-card__enter"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEnterTopic?.(node.id);
                      }}
                    >
                      مطالعهٔ یکپارچه ←
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
