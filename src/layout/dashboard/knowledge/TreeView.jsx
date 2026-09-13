/* ── Tree View — نمای سلسله‌مراتبی ──
   برای کسانی که با گراف راحت نیستند: از یک مفهوم ریشه شروع و شاخه‌ها را
   بر اساس روابط واقعی باز/بسته می‌کند. هر شاخه با برچسب رابطه و وضعیت مطالعه. */

import { useMemo, useState } from 'react';
import { GRAPH, courseAccent } from '../../../services/knowledge/knowledgeService';
import { relationLabel } from '../../../services/knowledge/graphData';
import { NodeGlyph, TypeBadge, CourseChip, KnBackButton } from './knowledgeShared';

export default function TreeView({ rootNodeId, onOpenNode, onSelect }) {
  const [history, setHistory] = useState([]);
  const rootId = rootNodeId ?? history[history.length - 1] ?? 'diabetes';
  const root = GRAPH.nodeById.get(rootId);

  const branches = useMemo(() => (root ? GRAPH.neighborsOf(root.id) : []), [root]);

  if (!root) return null;

  const pushRoot = (nodeId) => {
    setHistory((stack) => [...stack, nodeId].slice(-8));
  };
  const popRoot = () => setHistory((stack) => stack.slice(0, -1));

  return (
    <div className="kn-tree">
      <header className="kn-tree__head">
        <KnBackButton onClick={onSelect ? () => onSelect(rootId) : undefined}>نمایش در گراف</KnBackButton>
        <nav className="kn-tree__crumb" aria-label="مسیر درخت">
          {history.map((nodeId, index) => (
            <button
              key={`${nodeId}-${index}`}
              type="button"
              onClick={() => setHistory((stack) => stack.slice(0, index))}
            >
              {GRAPH.nodeById.get(nodeId)?.title}
            </button>
          ))}
          <strong className={history.length ? 'kn-tree__crumb-current' : 'kn-tree__crumb-root'}>
            {root.title}
          </strong>
        </nav>
      </header>

      <div className="kn-tree__root kn-tree__root--hero">
        <span className="kn-tree__glyph" style={{ '--accent': courseAccent(root.courses?.[0]) }}>
          <NodeGlyph type={root.type} size={18} />
        </span>
        <div>
          <h2>{root.title}</h2>
          <p>{root.description}</p>
        </div>
        <button
          type="button"
          className="kn-tree__open"
          onClick={() => onOpenNode?.(root.id)}
        >
          صفحهٔ موضوع
        </button>
      </div>

      <ul className="kn-tree__list">
        {branches.map(({ node: child, edge, direction }) => (
          <TreeBranch
            key={`${child.id}-${edge.type}-${direction}`}
            child={child}
            edge={edge}
            direction={direction}
            progressMap={{}}
            onOpen={pushRoot}
            onOpenNode={onOpenNode}
          />
        ))}
      </ul>

      {branches.length === 0 ? (
        <p className="kn-panel__hint">این مفهوم شاخه‌ای در شبکه ندارد؛ از گراف مفهوم دیگری را انتخاب کنید.</p>
      ) : null}
    </div>
  );
}

function TreeBranch({ child, edge, direction, onOpen, onOpenNode }) {
  const [expanded, setExpanded] = useState(false);
  const grandchildren = expanded ? GRAPH.neighborsOf(child.id).slice(0, 6) : [];
  const accent = courseAccent(child.courses?.[0]);

  return (
    <li className="kn-tree__item">
      <div className="kn-tree__row" style={{ '--accent': accent }}>
        <button
          type="button"
          className="kn-tree__toggle"
          aria-expanded={expanded}
          aria-label={expanded ? 'بستن شاخه' : 'باز کردن شاخه'}
          onClick={() => setExpanded((value) => !value)}
          disabled={GRAPH.degreeOf(child.id) <= 1}
        >
          {expanded ? '−' : '+'}
        </button>

        <button type="button" className="kn-tree__label" onClick={() => onOpenNode?.(child.id)}>
          <span className="kn-tree__relation">
            {direction === 'out' ? `${relationLabel(edge.type)} →` : `← ${relationLabel(edge.type)}`}
          </span>
          <NodeGlyph type={child.type} size={13} />
          <strong>{child.title}</strong>
          <TypeBadge type={child.type} />
          {(child.courses ?? []).slice(0, 2).map((courseId) => (
            <CourseChip key={courseId} courseId={courseId} compact />
          ))}
        </button>

        <button type="button" className="kn-tree__open" onClick={() => onOpen?.(child.id)}>
          زیرشاخه‌ها
        </button>
      </div>

      {expanded && grandchildren.length > 0 ? (
        <ul className="kn-tree__list kn-tree__list--nested">
          {grandchildren.map(({ node: grandchild, edge: grandEdge, direction: grandDirection }) => (
            <li key={`${grandchild.id}-${grandEdge.type}-${grandDirection}`} className="kn-tree__row kn-tree__row--leaf">
              <button type="button" className="kn-tree__label" onClick={() => onOpenNode?.(grandchild.id)}>
                <span className="kn-tree__relation">
                  {grandDirection === 'out'
                    ? `${relationLabel(grandEdge.type)} →`
                    : `← ${relationLabel(grandEdge.type)}`}
                </span>
                <NodeGlyph type={grandchild.type} size={12} />
                <strong>{grandchild.title}</strong>
              </button>
              <button type="button" className="kn-tree__open" onClick={() => onOpen?.(grandchild.id)}>
                باز کردن
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
