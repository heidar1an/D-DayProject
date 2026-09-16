import { useMemo, useRef, useState } from 'react';

import { getAboutEcosystem } from '../../services/about/aboutService';
import { AboutArrow, ringLayout, useInView, useScene } from './aboutShared';

/*
 * ── «تپش یک سایت نیست» — یک سیستم ──
 *
 * دو بخشِ پشتِ سرِ هم:
 *   ۱. جملهٔ اول کنار می‌رود و جملهٔ دوم جایش را می‌گیرد (صحنهٔ چسبان).
 *   ۲. بعد «سیستم» دیده می‌شود: ده گره روی دو حلقه، با خطوطی که هر گره را هم
 *      به مرکز وصل می‌کنند و هم به همسایه‌اش. ایستادن روی یک گره، بقیه را کم‌نور
 *      می‌کند و کلیک آن را میخکوب می‌نشیند تا بعدش بتوانی روی لینکش کلیک کنی.
 *
 * مقصدِ هر گره یک لایهٔ واقعیِ داشبورد است (از داده می‌آید)؛ همان handler ای
 * که در صفحهٔ محصولات استفاده می‌شود اینجا هم صدا زده می‌شود.
 */

const GROUPS = [4, 6];
const RADII = [24, 40];

export default function TapeshEcosystem({ onOpenProduct }) {
  const data = getAboutEcosystem();

  const statementRef = useRef(null);
  useScene(statementRef, { mode: 'sticky' });

  const fieldRef = useRef(null);
  const inView = useInView(fieldRef, { threshold: 0.2 });
  const [hoverId, setHoverId] = useState(null);
  const [pinnedId, setPinnedId] = useState(null);

  const activeId = hoverId ?? pinnedId;
  const nodes = useMemo(() => ringLayout(data.nodes, GROUPS, RADII), [data.nodes]);
  const active = nodes.find((node) => node.id === activeId) ?? null;

  const wires = useMemo(() => {
    const lines = [];

    /* پره‌ها: هر گره به مرکز */
    nodes.forEach((node, index) => {
      lines.push({
        id: `spoke-${node.id}`,
        x1: 50,
        y1: 50,
        x2: node.x,
        y2: node.y,
        a: node.id,
        b: null,
        index,
      });
    });

    /* وترها: گره‌های هر حلقه به همسایه‌شان */
    GROUPS.forEach((_, ring) => {
      const ringNodes = nodes.filter((node) => node.ring === ring);

      ringNodes.forEach((node, index) => {
        const next = ringNodes[(index + 1) % ringNodes.length];
        if (!next || next.id === node.id) return;

        lines.push({
          id: `chord-${node.id}-${next.id}`,
          x1: node.x,
          y1: node.y,
          x2: next.x,
          y2: next.y,
          a: node.id,
          b: next.id,
          index: nodes.length + index,
          chord: true,
        });
      });
    });

    /* پل‌ها: حلقهٔ درونی به حلقهٔ بیرونی — همان «سیستم بودن» */
    const inner = nodes.filter((node) => node.ring === 0);
    const outer = nodes.filter((node) => node.ring === 1);

    inner.forEach((node, index) => {
      const bridge = outer[index % outer.length];
      if (!bridge) return;

      lines.push({
        id: `bridge-${node.id}-${bridge.id}`,
        x1: node.x,
        y1: node.y,
        x2: bridge.x,
        y2: bridge.y,
        a: node.id,
        b: bridge.id,
        index: nodes.length + GROUPS[0] + index,
        bridge: true,
      });
    });

    return lines;
  }, [nodes]);

  return (
    <>
      <section className="ab-statement" ref={statementRef} aria-label="تپش یک سایت نیست">
        <div className="ab-statement__stage">
          <p className="ab-statement__line ab-statement__line--first">{data.firstLine}</p>
          <p className="ab-statement__line ab-statement__line--second">{data.secondLine}</p>
        </div>
      </section>

      <section className="ab-system section-shell" aria-labelledby="ab-system-title">
        <h2 className="ab-system__title" id="ab-system-title">
          {data.secondLine}
        </h2>

        <div
          className={`ab-system__field ${inView ? 'is-in' : ''} ${active ? 'has-active' : ''}`}
          ref={fieldRef}
        >
          <svg className="ab-system__wires" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            {/*
              خطوط با `path` و `pathLength="1"` کشیده می‌شوند (پشتیبانیِ قطعیِ
              مرورگرها روی `<path>`). پلِ بین دو حلقه عمداً خط‌چینِ ریز است تا
              «اتصالِ دورتر» از «همسایگی» جدا دیده شود.
            */}
            {wires.map((wire) => (
              <path
                d={`M ${wire.x1.toFixed(2)} ${wire.y1.toFixed(2)} L ${wire.x2.toFixed(2)} ${wire.y2.toFixed(2)}`}
                key={wire.id}
                pathLength="1"
                className={`ab-system__wire ${wire.chord ? 'is-chord' : ''} ${
                  wire.bridge ? 'is-bridge' : ''
                } ${activeId && (activeId === wire.a || activeId === wire.b) ? 'is-active' : ''}`}
                style={{ '--ab-i': wire.index }}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <span className="ab-system__core" aria-hidden="true">
            تپش
          </span>

          {nodes.map((node, index) => (
            <button
              className={`ab-system__node ab-accent-${node.accent} ${
                activeId === node.id ? 'is-active' : ''
              } ${pinnedId === node.id ? 'is-pinned' : ''}`}
              key={node.id}
              style={{ left: `${node.x}%`, top: `${node.y}%`, '--ab-i': index }}
              type="button"
              aria-pressed={activeId === node.id}
              onMouseEnter={() => setHoverId(node.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(node.id)}
              onBlur={() => setHoverId(null)}
              onClick={() => setPinnedId(pinnedId === node.id ? null : node.id)}
            >
              <span className="ab-system__dot" aria-hidden="true" />
              <span className="ab-system__label">{node.label}</span>
            </button>
          ))}
        </div>

        <div className="ab-system__detail" aria-live="polite">
          {active ? (
            <>
              <h3 className="ab-system__detail-title">{active.label}</h3>
              <p className="ab-system__detail-text">{active.hint}</p>
              <a
                className="ab-system__detail-link"
                href={active.href}
                onClick={(event) => onOpenProduct?.(event, active.href)}
              >
                <span>رفتن به این بخش</span>
                <AboutArrow />
              </a>
            </>
          ) : (
            <p className="ab-system__detail-text ab-system__detail-text--empty">{data.hint}</p>
          )}
        </div>
      </section>
    </>
  );
}
