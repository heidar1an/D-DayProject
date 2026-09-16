import { useState } from 'react';

import { getKnowledgeGraphPreview } from '../../../services/products/productsService';
import { toFa } from '../productsShared';

/*
 * ── پیش‌نمایش شبکهٔ دانش ──
 *
 * گره‌ها المان‌های HTML روی یک SVGِ خط‌کش هستند، نه `<circle>`های SVG. دلیل:
 * باید با کیبورد فوکوس‌پذیر باشند و متن‌شان با فونت و اندازهٔ سایت تراز شود.
 * SVG فقط خطوط را می‌کشد — با `preserveAspectRatio="none"` تا مختصات همان
 * درصدِ چیدمان باشد و با `vector-effect` تا ضخامت خط با کش‌آمدن تغییر نکند.
 *
 * مختصات از تعداد گره‌ها حساب می‌شود؛ گرهٔ تازه اضافه کنی، جایش خودکار پیدا می‌شود.
 */

const RADIUS_X = 26;
const RADIUS_Y = 33;

export default function KnowledgeGraphPreview() {
  const data = getKnowledgeGraphPreview();
  const [activeId, setActiveId] = useState(data.nodes[0].id);

  const active = data.nodes.find((node) => node.id === activeId) ?? data.nodes[0];

  const points = data.nodes.map((node, index) => {
    const angle = ((-90 + (index * 360) / data.nodes.length) * Math.PI) / 180;

    return {
      ...node,
      x: 50 + RADIUS_X * Math.cos(angle),
      y: 50 + RADIUS_Y * Math.sin(angle),
    };
  });

  return (
    <div className="ps-graph">
      <div className="ps-graph__canvas">
        <svg
          className="ps-graph__lines"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          focusable="false"
          aria-hidden="true"
        >
          {points.map((point) => (
            <line
              className={`ps-graph__line ${point.id === activeId ? 'is-active' : ''}`}
              key={point.id}
              x1="50"
              y1="50"
              x2={point.x}
              y2={point.y}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        <span className="ps-graph__hub">{data.center.label}</span>

        {points.map((point) => (
          <button
            type="button"
            className={`ps-graph__node ${point.id === activeId ? 'is-active' : ''}`}
            key={point.id}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            onMouseEnter={() => setActiveId(point.id)}
            onFocus={() => setActiveId(point.id)}
            onClick={() => setActiveId(point.id)}
            aria-label={`${point.label} — ${point.detail}`}
          >
            <span className="ps-graph__dot" aria-hidden="true" />
            <span className="ps-graph__label">{point.label}</span>
          </button>
        ))}
      </div>

      <div className="ps-graph__detail">
        <p className="ps-graph__detail-title">{active.label}</p>
        <p className="ps-graph__detail-text">{active.detail}</p>
        <ul className="ps-graph__detail-meta">
          <li>
            <span>درس</span>
            <b>{toFa(active.courses)}</b>
          </li>
          <li>
            <span>مقاله</span>
            <b>{toFa(active.articles)}</b>
          </li>
          <li>
            <span>تست</span>
            <b>{toFa(active.questions)}</b>
          </li>
        </ul>
      </div>
    </div>
  );
}
