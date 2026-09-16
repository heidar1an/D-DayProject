import { useMemo, useRef, useState } from 'react';

import { getAboutWhy } from '../../services/about/aboutService';
import { ringLayout, useInView, usePointerParallax } from './aboutShared';

/*
 * ── «پس تپش برای چه ساخته شد؟» — شبکهٔ دانش ──
 *
 * یک تصویرِ ثابت نیست. سه چیز آن را زنده نگه می‌دارد:
 *   ۱. هنگام ورود به دید، خطوط یکی‌یکی کشیده می‌شوند (`pathLength` + تأخیرِ
 *      پله‌ای) — یعنی «شبکه» واقعاً در حال شکل‌گرفتن دیده می‌شود.
 *   ۲. اشاره‌گرِ موس کلِ میدان را چند پیکسل جابه‌جا می‌کند (عمق، نه بازی).
 *   ۳. ایستادن یا لمسِ هر مفهوم، خطِ آن را روشن و یک خط درباره‌اش نشان می‌دهد.
 *
 * در موبایل میدانِ SVG کنار می‌رود و همان داده به صورت ردیفی از چیپ‌ها دیده
 * می‌شود — چون گره‌های ۳۰ پیکسلی با انگشت قابل استفاده نیستند.
 */

const GROUPS = [5, 6];
const RADII = [25, 40];

export default function KnowledgeNetwork() {
  const data = getAboutWhy();
  const fieldRef = useRef(null);
  const [activeId, setActiveId] = useState(null);

  const inView = useInView(fieldRef, { threshold: 0.25 });
  usePointerParallax(fieldRef);

  const nodes = useMemo(() => ringLayout(data.nodes, GROUPS, RADII), [data.nodes]);

  /* خطوط: هر گره به مرکز وصل است و گره‌های هر حلقه به هم */
  const spokes = useMemo(
    () => nodes.map((node) => ({ id: `spoke-${node.id}`, x: node.x, y: node.y, nodeId: node.id })),
    [nodes],
  );

  const chords = useMemo(() => {
    const pairs = [];

    GROUPS.forEach((_, ring) => {
      const ringNodes = nodes.filter((node) => node.ring === ring);

      ringNodes.forEach((node, index) => {
        const next = ringNodes[(index + 1) % ringNodes.length];
        if (!next || next === node) return;

        pairs.push({
          id: `chord-${node.id}-${next.id}`,
          x1: node.x,
          y1: node.y,
          x2: next.x,
          y2: next.y,
          nodeId: node.id,
          pairId: next.id,
        });
      });
    });

    return pairs;
  }, [nodes]);

  const active = nodes.find((node) => node.id === activeId) ?? null;

  return (
    <section className="ab-why section-shell" id="ab-why" aria-labelledby="ab-why-title">
      <div className="ab-why__copy">
        <p className="ab-eyebrow">{data.eyebrow}</p>
        <h2 className="ab-title" id="ab-why-title">
          {data.title}
        </h2>
        <p className="ab-lead">{data.lead}</p>
      </div>

      <div
        className={`ab-net ${inView ? 'is-in' : ''} ${active ? 'has-active' : ''}`}
        ref={fieldRef}
      >
        <svg className="ab-net__wires" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          {/*
            چرا `path` و نه `line`: انیمیشنِ کشیده‌شدن با `pathLength="1"` است و
            پشتیبانیِ مرورگرها از `pathLength` روی `<path>` قطعی است — روی
            `<line>` نه. شکلِ خط همان است.
          */}
          {spokes.map((spoke, index) => (
            <path
              d={`M 50 50 L ${spoke.x.toFixed(2)} ${spoke.y.toFixed(2)}`}
              key={spoke.id}
              pathLength="1"
              className={`ab-net__wire ${
                activeId && activeId === spoke.nodeId ? 'is-active' : ''
              }`}
              style={{ '--ab-i': index }}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {chords.map((chord, index) => (
            <path
              d={`M ${chord.x1.toFixed(2)} ${chord.y1.toFixed(2)} L ${chord.x2.toFixed(2)} ${chord.y2.toFixed(2)}`}
              key={chord.id}
              pathLength="1"
              className={`ab-net__wire ab-net__wire--chord ${
                activeId && (activeId === chord.nodeId || activeId === chord.pairId)
                  ? 'is-active'
                  : ''
              }`}
              style={{ '--ab-i': spokes.length + index }}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        <p className="ab-net__center">{data.center}</p>

        {nodes.map((node, index) => (
          <button
            className={`ab-net__node ${activeId === node.id ? 'is-active' : ''}`}
            key={node.id}
            style={{ left: `${node.x}%`, top: `${node.y}%`, '--ab-i': index }}
            type="button"
            aria-pressed={activeId === node.id}
            onMouseEnter={() => setActiveId(node.id)}
            onMouseLeave={() => setActiveId(null)}
            onFocus={() => setActiveId(node.id)}
            onBlur={() => setActiveId(null)}
          >
            <span className="ab-net__dot" aria-hidden="true" />
            <span className="ab-net__label">{node.label}</span>
          </button>
        ))}
      </div>

      <p className="ab-net__caption" aria-live="polite">
        {active ? `${active.label} — ${active.hint}` : data.caption}
      </p>

      {/* همان داده، برای صفحه‌های کوچک — چیپ به‌جای گره */}
      <ul className="ab-net__chips">
        {data.nodes.map((node) => (
          <li key={`chip-${node.id}`}>
            <button
              className={`ab-chip ${activeId === node.id ? 'is-active' : ''}`}
              type="button"
              aria-pressed={activeId === node.id}
              onClick={() => setActiveId(activeId === node.id ? null : node.id)}
            >
              {node.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
