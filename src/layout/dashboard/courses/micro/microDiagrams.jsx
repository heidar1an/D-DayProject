/*
 * دیاگرام‌های SVG میکرودرسنامه — نسخهٔ آموزشیِ ساده‌شده.
 * هر دیاگرام فقط با کلید (name) از block نوع figure صدا زده می‌شود تا محتوا
 * data-driven بماند؛ افزودن دیاگرام جدید یعنی افزودن یک کلید به همین فایل.
 * رنگ‌ها از توکن‌های تم می‌خوانند تا با تعویض تم روشن/تیره هم‌گام بمانند.
 *
 * دو خانوادهٔ دیاگرام:
 *   • اختصاصی  — pressure-timeline / wiggers / pv-loop (شکل ثابت، مخصوص فیزیولوژی قلب)
 *   • عمومی     — flow / bars / cycle (شکل را از `block.data` می‌گیرند؛ هر درس می‌تواند
 *                 بدون کد تازه شکل خودش را داشته باشد — قرارداد داده بالای هر کامپوننت)
 */

const AXIS = 'rgb(var(--line-rgb) / 0.25)';
const LABEL = 'var(--faint)';
/* متن داخل شکل باید با تم روشن/تیره همراه شود؛ پس از توکن می‌خواند نه رنگ ثابت */
const NODE_TEXT = 'var(--muted)';
const NODE_FILL = 'rgb(var(--wash-rgb) / 0.06)';

function Frame({ children, title, height = 320 }) {
  return (
    <svg viewBox={`0 0 640 ${height}`} role="img" aria-label={title} className="micr-figure__svg">
      {children}
    </svg>
  );
}

/* نمودار فشار بطن چپ / آئورت / دهلیز چپ در یک چرخهٔ ۰٫۸ ثانیه‌ای */
function PressureTimeline() {
  return (
    <Frame title="نمودار فشارها در چرخهٔ قلبی">
      {/* محورها */}
      <line x1="56" y1="24" x2="56" y2="272" stroke={AXIS} strokeWidth="1.5" />
      <line x1="56" y1="272" x2="616" y2="272" stroke={AXIS} strokeWidth="1.5" />
      {/* جداکنندهٔ سیستول/دیاستول */}
      <rect x="56" y="24" width="170" height="248" fill="rgb(var(--wash-rgb) / 0.04)" />
      <text x="141" y="42" fill={LABEL} fontSize="12" textAnchor="middle">سیستول ۰٫۳s</text>
      <text x="430" y="42" fill={LABEL} fontSize="12" textAnchor="middle">دیاستول ۰٫۵s</text>
      <line x1="226" y1="24" x2="226" y2="272" stroke={AXIS} strokeDasharray="4 4" />

      {/* فشار بطن چپ — صعود تند، اوج، سقوط، فلات */}
      <path
        d="M56 236 C 90 236 100 232 116 200 C 136 158 152 108 180 96 C 200 88 214 92 226 108 C 250 140 258 196 268 226 C 280 252 300 258 330 260 L 616 260"
        fill="none" stroke="var(--brown-bright)" strokeWidth="3" strokeLinecap="round"
      />
      {/* فشار آئورت — دنبال بطن با ناتچ */}
      <path
        d="M56 150 C 90 148 104 150 118 160 C 140 116 158 100 182 104 C 202 108 212 128 232 148 C 244 160 252 162 262 156 C 270 152 274 158 286 172 C 306 196 360 214 420 220 C 480 226 560 228 616 230"
        fill="none" stroke="var(--red)" strokeWidth="2.6" strokeLinecap="round"
      />
      {/* فشار دهلیز چپ — موج‌های کم‌دامنه */}
      <path
        d="M56 226 C 70 218 78 218 92 226 C 104 232 112 236 126 232 C 140 228 148 220 162 220 C 178 220 186 228 200 230 C 230 234 260 240 300 246 C 360 252 480 256 616 258"
        fill="none" stroke="var(--purple-bright)" strokeWidth="2.2" strokeDasharray="6 4" strokeLinecap="round"
      />

      {/* نقاط دریچه‌ای */}
      <circle cx="116" cy="200" r="5" fill="var(--gold)" />
      <circle cx="182" cy="102" r="5" fill="var(--green-bright)" />
      <circle cx="262" cy="158" r="5" fill="var(--red)" />
      <circle cx="286" cy="176" r="5" fill="var(--blue-bright)" />

      {/* برچسب‌ها */}
      <text x="66" y="196" fill="var(--gold-ink)" fontSize="12">بسته‌شدن میترال (S1)</text>
      <text x="120" y="88" fill="var(--green-ink)" fontSize="12">باز‌شدن آئورت</text>
      <text x="228" y="142" fill="var(--red-ink)" fontSize="12">بسته‌شدن آئورت (S2)</text>
      <text x="250" y="212" fill="var(--blue-soft-ink)" fontSize="12">باز‌شدن میترال</text>

      {/* راهنما */}
      <g transform="translate(386, 60)">
        <line x1="0" y1="0" x2="24" y2="0" stroke="var(--brown-bright)" strokeWidth="3" />
        <text x="30" y="4" fill={LABEL} fontSize="12">بطن چپ</text>
        <line x1="0" y1="20" x2="24" y2="20" stroke="var(--red)" strokeWidth="3" />
        <text x="30" y="24" fill={LABEL} fontSize="12">آئورت</text>
        <line x1="0" y1="40" x2="24" y2="40" stroke="var(--purple-bright)" strokeWidth="3" strokeDasharray="6 4" />
        <text x="30" y="44" fill={LABEL} fontSize="12">دهلیز چپ</text>
      </g>
    </Frame>
  );
}

/* دیاگرام وینگرز ساده‌شده: فشارها + حجم + ECG */
function WiggersDiagram() {
  return (
    <Frame title="دیاگرام وینگرز ساده‌شده">
      <line x1="56" y1="24" x2="56" y2="272" stroke={AXIS} strokeWidth="1.5" />
      <line x1="56" y1="272" x2="616" y2="272" stroke={AXIS} strokeWidth="1.5" />
      <rect x="56" y="24" width="170" height="248" fill="rgb(var(--wash-rgb) / 0.04)" />
      <text x="141" y="42" fill={LABEL} fontSize="12">سیستول</text>
      <text x="430" y="42" fill={LABEL} fontSize="12">دیاستول</text>
      <line x1="226" y1="24" x2="226" y2="272" stroke={AXIS} strokeDasharray="4 4" />

      {/* حجم بطنی — فلات بالا در دیاستول، شیب پایین در سیستول */}
      <path
        d="M56 180 C 100 172 150 168 210 168 C 240 168 260 170 276 182 C 300 200 330 210 360 210 L 616 210"
        fill="none" stroke="var(--green-bright)" strokeWidth="2.4" strokeLinecap="round" opacity="0.8"
      />
      {/* فشار بطنی */}
      <path
        d="M56 236 C 100 234 110 228 124 196 C 144 150 158 106 184 98 C 204 92 216 98 228 112 C 252 142 260 198 270 226 C 282 252 302 258 332 260 L 616 260"
        fill="none" stroke="var(--brown-bright)" strokeWidth="3" strokeLinecap="round"
      />
      {/* آئورت */}
      <path
        d="M56 152 C 96 150 110 152 124 162 C 144 118 162 102 186 106 C 206 110 216 130 236 150 C 248 162 256 164 266 158 C 274 154 278 160 290 174 C 310 198 366 216 426 222 C 486 228 560 230 616 232"
        fill="none" stroke="var(--red)" strokeWidth="2.2" strokeLinecap="round" opacity="0.85"
      />

      {/* ECG — P، QRS، T */}
      <g transform="translate(0, -118)" stroke="var(--purple-soft-ink)" strokeWidth="1.8" fill="none">
        <path d="M96 300 C 102 292 112 292 118 300" />
        <path d="M132 306 L138 306 L142 258 L146 310 L150 306 L160 306" />
        <path d="M172 296 C 184 288 200 288 212 298" />
        <path d="M330 306 L336 306 L340 260 L344 312 L348 306 L358 306" transform="translate(210, 0)" opacity="0.5" />
      </g>

      {/* صداها */}
      <circle cx="124" cy="196" r="5" fill="var(--gold)" />
      <text x="96" y="220" fill="var(--gold-ink)" fontSize="12">S1</text>
      <circle cx="266" cy="158" r="5" fill="var(--red)" />
      <text x="258" y="140" fill="var(--red-ink)" fontSize="12">S2</text>
      <circle cx="330" cy="258" r="5" fill="var(--green-bright)" />
      <text x="322" y="244" fill="var(--green-ink)" fontSize="12">S3</text>

      {/* راهنما */}
      <g transform="translate(386, 60)">
        <line x1="0" y1="0" x2="24" y2="0" stroke="var(--brown-bright)" strokeWidth="3" />
        <text x="30" y="4" fill={LABEL} fontSize="12">فشار بطن</text>
        <line x1="0" y1="20" x2="24" y2="20" stroke="var(--red)" strokeWidth="2.4" />
        <text x="30" y="24" fill={LABEL} fontSize="12">فشار آئورت</text>
        <line x1="0" y1="40" x2="24" y2="40" stroke="var(--green-bright)" strokeWidth="2.4" />
        <text x="30" y="44" fill={LABEL} fontSize="12">حجم بطن</text>
        <line x1="0" y1="60" x2="24" y2="60" stroke="var(--purple-soft-ink)" strokeWidth="2" />
        <text x="30" y="64" fill={LABEL} fontSize="12">ECG</text>
      </g>
    </Frame>
  );
}

/* حلقهٔ فشار-حجم بطن چپ با چهار ضلع برچسب‌دار */
function PvLoop() {
  return (
    <Frame title="حلقهٔ فشار-حجم بطن چپ">
      <line x1="70" y1="24" x2="70" y2="272" stroke={AXIS} strokeWidth="1.5" />
      <line x1="70" y1="272" x2="616" y2="272" stroke={AXIS} strokeWidth="1.5" />
      <text x="344" y="296" fill={LABEL} fontSize="12" textAnchor="middle">حجم بطن ←</text>
      <text x="40" y="150" fill={LABEL} fontSize="12" textAnchor="middle" transform="rotate(-90 40 150)">فشار ←</text>

      {/* حلقه: پرشدگی → ایزومتریک → تخلیه → ریلاکس */}
      <path
        d="M150 250 C 220 252 320 250 380 244 C 430 238 460 220 470 190 C 478 160 470 120 440 96 C 400 66 320 62 260 84 C 230 96 210 116 196 140 C 184 162 172 220 150 250 Z"
        fill="rgb(var(--wash-rgb) / 0.05)" stroke="var(--brown-bright)" strokeWidth="3" strokeLinejoin="round"
      />

      {/* نقاط و برچسب فازها */}
      <circle cx="470" cy="190" r="5" fill="var(--red)" />
      <text x="484" y="188" fill={LABEL} fontSize="12">ESV</text>
      <circle cx="150" cy="250" r="5" fill="var(--green-bright)" />
      <text x="108" y="248" fill={LABEL} fontSize="12">EDV</text>

      <text x="250" y="258" fill="var(--green-ink)" fontSize="12">پرشدگی دیاستولی</text>
      <text x="474" y="130" fill="var(--gold-ink)" fontSize="12">انقباض ایزومتریک</text>
      <text x="300" y="52" fill="var(--red-ink)" fontSize="12">تخلیهٔ سریع و آهسته</text>
      <text x="120" y="180" fill="var(--blue-soft-ink)" fontSize="12">ریلاکس ایزومتریک</text>

      <text x="380" y="170" fill="var(--faint)" fontSize="12">مساحت = Stroke Work</text>
      <text x="238" y="286" fill="var(--faint)" fontSize="12">عرض حلقه = SV</text>
    </Frame>
  );
}

/* ══════════════ دیاگرام‌های داده‌محورِ عمومی ══════════════
   این سه کلید (flow / bars / cycle) به‌جای شکل ثابت، از `block.data` تغذیه می‌شوند تا
   هر درسِ میکرودرسنامه بدون کد تازه، شکل اختصاصی خودش را داشته باشد — همان قاعده‌ای
   که موتور را data-driven نگه می‌دارد. قرارداد داده:

     figure: { type:'figure', diagram:'flow',  data:{ steps:[{label, note}] } }
     figure: { type:'figure', diagram:'bars',  data:{ unit, items:[{label, value}] } }
     figure: { type:'figure', diagram:'cycle', data:{ center, stages:[{label}] } }

   رنگ‌ها همه از توکن‌های تم می‌آیند تا با تعویض تم روشن/تیره هم‌گام بمانند. */

/* شکستن برچسب به چند خط — متن فارسی داخل شکل باید بدون CSS چندخطی شود */
function wrapLabel(text, maxChars = 16, maxLines = 2) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines.slice(0, maxLines);
}

function LabelLines({ x, y, lines, fill = NODE_TEXT, size = 11.5, step = 14 }) {
  return (
    <text x={x} y={y} fill={fill} fontSize={size} textAnchor="middle">
      {lines.map((line, index) => (
        <tspan key={line + index} x={x} dy={index === 0 ? 0 : step}>{line}</tspan>
      ))}
    </text>
  );
}

/* زنجیرهٔ مرحله‌ها (مسیرها، آبشارها، فرآیندها) — چیدمان راست‌به‌چپ، سطرهای سه‌تایی */
function FlowDiagram({ data }) {
  const steps = (data?.steps ?? []).filter((step) => step?.label);
  if (!steps.length) return null;

  const PER_ROW = 3;
  const PAD = 26;
  const GAP = 30;
  const ROW_H = 84;
  const ROW_GAP = 44;
  const rows = [];
  for (let index = 0; index < steps.length; index += PER_ROW) {
    rows.push(steps.slice(index, index + PER_ROW));
  }
  const height = PAD + rows.length * ROW_H + (rows.length - 1) * ROW_GAP + PAD;
  const colors = ['var(--brown-bright)', 'var(--gold)', 'var(--green-bright)', 'var(--purple-bright)', 'var(--red)'];
  /* عرض جعبه بر اساس سطر کامل حساب می‌شود تا سطر ناقص (مثلاً ۳+۱) جعبهٔ غول نداشته باشد */
  const boxW = (640 - PAD * 2 - GAP * (PER_ROW - 1)) / PER_ROW;
  const rowStartX = (count) => 640 - PAD - boxW - (count - 1) * (boxW + GAP);

  return (
    <Frame title={data?.title ?? 'زنجیرهٔ مرحله‌ها'} height={height}>
      {rows.map((row, rowIndex) => {
        const y = PAD + rowIndex * (ROW_H + ROW_GAP);
        const count = row.length;
        const startX = rowStartX(count);
        const nextRow = rows[rowIndex + 1];
        return (
          <g key={`row-${rowIndex}`}>
            {row.map((step, index) => {
              /* چیدمان راست‌به‌چپ: مرحلهٔ اول سمت راست */
              const x = startX - index * (boxW + GAP);
              const stepNumber = rowIndex * PER_ROW + index + 1;
              return (
                <g key={step.label + index}>
                  <rect x={x} y={y} width={boxW} height={ROW_H} rx="12" fill={NODE_FILL} stroke={AXIS} />
                  <rect x={x} y={y} width={boxW} height="3" rx="1.5" fill={colors[stepNumber % colors.length]} />
                  <circle cx={x + boxW - 15} cy={y + 19} r="10" fill="none" stroke={colors[stepNumber % colors.length]} />
                  <text x={x + boxW - 15} y={y + 23} fill={NODE_TEXT} fontSize="10.5" textAnchor="middle">{stepNumber}</text>
                  <LabelLines x={x + boxW / 2} y={y + 42} lines={wrapLabel(step.label, 18, 2)} />
                  {step.note && (
                    <LabelLines x={x + boxW / 2} y={y + 68} lines={wrapLabel(step.note, 24, 1)} fill={LABEL} size={10} />
                  )}
                  {index < count - 1 && (
                    <g stroke={LABEL} strokeWidth="1.8" fill="none">
                      <line x1={x - 6} y1={y + ROW_H / 2} x2={x - GAP + 6} y2={y + ROW_H / 2} />
                      <path d={`M${x - GAP + 10} ${y + ROW_H / 2} l-6 -4 v8 z`} fill={LABEL} stroke="none" />
                    </g>
                  )}
                </g>
              );
            })}
            {nextRow && (
              /* شکست سطر: از آخرین جعبهٔ سطر (چپ‌ترین) به اولین جعبهٔ سطر بعد (راست‌ترین) */
              <path
                d={`M${startX + boxW / 2} ${y + ROW_H} v${ROW_GAP / 2} H${rowStartX(nextRow.length) + boxW / 2} v${ROW_GAP / 2}`}
                fill="none"
                stroke={LABEL}
                strokeWidth="1.6"
                strokeDasharray="5 5"
              />
            )}
          </g>
        );
      })}
    </Frame>
  );
}

/* مقایسهٔ کمّی چند مقدار — نوارها نسبت به بیشترین مقدار نرمال می‌شوند */
function BarsDiagram({ data }) {
  const items = (data?.items ?? []).filter((item) => item?.label);
  if (!items.length) return null;

  const max = Math.max(1, ...items.map((item) => Math.abs(Number(item.value) || 0)));
  const baseY = 258;
  const topY = 42;
  const usable = 640 - 90 * 2;
  const slot = usable / items.length;
  const barW = Math.min(74, slot * 0.52);
  const colors = ['var(--brown-bright)', 'var(--gold)', 'var(--green-bright)', 'var(--purple-bright)', 'var(--red)'];

  return (
    <Frame title={data?.title ?? 'مقایسهٔ مقادیر'}>
      <line x1="70" y1={baseY} x2="600" y2={baseY} stroke={AXIS} strokeWidth="1.5" />
      {data?.unit && <text x="70" y="26" fill={LABEL} fontSize="11.5">{data.unit}</text>}
      {items.map((item, index) => {
        const value = Math.abs(Number(item.value) || 0);
        const barH = Math.max(4, (value / max) * (baseY - topY));
        const x = 640 - (90 + slot * (index + 1) - (slot - barW) / 2) - barW;
        return (
          <g key={item.label + index}>
            <rect x={x} y={baseY - barH} width={barW} height={barH} rx="6" fill={colors[index % colors.length]} opacity="0.85" />
            <text x={x + barW / 2} y={baseY - barH - 8} fill={NODE_TEXT} fontSize="11.5" textAnchor="middle">{item.value}</text>
            <LabelLines x={x + barW / 2} y={baseY + 18} lines={wrapLabel(item.label, 14, 2)} fill={LABEL} size={11} />
          </g>
        );
      })}
    </Frame>
  );
}

/* چرخهٔ بستهٔ مرحله‌ها (چرخهٔ قلبی، چرخهٔ اوره، چرخهٔ تنفس و…) — حداکثر ۶ گره */
function CycleDiagram({ data }) {
  const stages = (data?.stages ?? []).filter((stage) => stage?.label).slice(0, 6);
  if (stages.length < 2) return null;

  const cx = 320;
  const cy = 160;
  const R = 96;
  const nodeW = 132;
  const nodeH = 42;
  const colors = ['var(--brown-bright)', 'var(--gold)', 'var(--green-bright)', 'var(--purple-bright)', 'var(--red)', 'var(--blue-bright)'];
  const pointAt = (angleDeg) => ({
    x: cx + R * Math.cos((angleDeg * Math.PI) / 180),
    y: cy + R * Math.sin((angleDeg * Math.PI) / 180),
  });
  const step = 360 / stages.length;

  return (
    <Frame title={data?.title ?? 'چرخهٔ مرحله‌ها'}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={AXIS} strokeWidth="1.6" strokeDasharray="6 6" />

      {/* سرِ فلش‌ها روی نیم‌فاصلهٔ هر دو گره، در جهت حرکت */}
      {stages.map((stage, index) => {
        const mid = -90 + step * (index + 0.5);
        const point = pointAt(mid);
        return (
          <g key={`arrow-${stage.label}-${index}`} transform={`translate(${point.x} ${point.y}) rotate(${mid + 90})`}>
            <path d="M-5 -5 L6 0 L-5 5 z" fill={colors[index % colors.length]} />
          </g>
        );
      })}

      {stages.map((stage, index) => {
        const point = pointAt(-90 + step * index);
        return (
          <g key={`node-${stage.label}-${index}`}>
            <rect
              x={point.x - nodeW / 2}
              y={point.y - nodeH / 2}
              width={nodeW}
              height={nodeH}
              rx="12"
              fill="rgb(var(--wash-rgb) / 0.08)"
              stroke={colors[index % colors.length]}
              strokeWidth="1.6"
            />
            <LabelLines x={point.x} y={point.y - 1} lines={wrapLabel(stage.label, 17, 2)} />
          </g>
        );
      })}

      {data?.center && (
        <LabelLines x={cx} y={cy} lines={wrapLabel(data.center, 14, 2)} fill={LABEL} size={11.5} />
      )}
    </Frame>
  );
}

const FIGURES = {
  'pressure-timeline': PressureTimeline,
  wiggers: WiggersDiagram,
  'pv-loop': PvLoop,
  flow: FlowDiagram,
  bars: BarsDiagram,
  cycle: CycleDiagram,
};

export default function MicroFigure({ diagram, title, caption, data }) {
  const Diagram = FIGURES[diagram];
  if (!Diagram) return null;
  return (
    <figure className="micr-figure">
      <figcaption className="micr-figure__title">{title}</figcaption>
      <Diagram data={data} />
      <figcaption className="micr-figure__caption">{caption}</figcaption>
    </figure>
  );
}
