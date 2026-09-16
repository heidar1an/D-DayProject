import { getEcosystemNodes } from '../../../services/products/productsService';

/*
 * ── نمودار پایانی: اکوسیستم تپش ──
 *
 * همهٔ محصولات دور یک گرهٔ مرکزی (تپش) می‌نشینند تا آخرین چیزی که کاربر می‌بیند
 * «یک سیستم» باشد، نه فهرستی از ابزارها.
 *
 * مختصات از تعداد گره‌ها حساب می‌شود و جهتِ متن (`text-anchor`) از علامتِ کسینوس،
 * پس محصولِ تازه خودکار جا می‌گیرد و برچسب‌ها بیرون نمی‌زنند.
 */

const CENTER_X = 280;
const CENTER_Y = 180;
const RADIUS_NODE = 118;
const RADIUS_LABEL = 148;

export default function EcosystemVisual() {
  const nodes = getEcosystemNodes();

  const points = nodes.map((node, index) => {
    const angle = ((-90 + (index * 360) / nodes.length) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return {
      ...node,
      nodeX: CENTER_X + RADIUS_NODE * cos,
      nodeY: CENTER_Y + RADIUS_NODE * sin,
      labelX: CENTER_X + RADIUS_LABEL * cos,
      labelY: CENTER_Y + RADIUS_LABEL * sin,
      anchor: cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle',
    };
  });

  return (
    <div className="ps-eco">
      <svg
        className="ps-eco__svg"
        viewBox="0 0 560 360"
        role="img"
        aria-label="نمودار اکوسیستم تپش: همهٔ محصولات به یک هستهٔ مشترک وصل‌اند"
      >
        <g className="ps-eco__links">
          {points.map((point) => (
            <line
              key={point.id}
              x1={CENTER_X}
              y1={CENTER_Y}
              x2={point.nodeX}
              y2={point.nodeY}
            />
          ))}
        </g>

        <g className={`ps-eco__node ps-eco__node--${points[0]?.accent ?? 'purple'}`}>
          <circle className="ps-eco__hub" cx={CENTER_X} cy={CENTER_Y} r="42" />
          <text
            className="ps-eco__hub-label"
            x={CENTER_X}
            y={CENTER_Y}
            textAnchor="middle"
            dominantBaseline="central"
          >
            تپش
          </text>
        </g>

        {points.map((point) => (
          <g className={`ps-eco__node ps-eco__node--${point.accent}`} key={point.id}>
            <circle className="ps-eco__dot" cx={point.nodeX} cy={point.nodeY} r="6" />
            <text
              className="ps-eco__label"
              x={point.labelX}
              y={point.labelY}
              textAnchor={point.anchor}
              dominantBaseline="central"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
