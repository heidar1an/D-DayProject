/*
 * دیاگرام‌های SVG میکرودرسنامه — نسخهٔ آموزشیِ ساده‌شده.
 * هر دیاگرام فقط با کلید (name) از block نوع figure صدا زده می‌شود تا محتوا
 * data-driven بماند؛ افزودن دیاگرام جدید یعنی افزودن یک کلید به همین فایل.
 * رنگ‌ها از توکن‌های تم می‌خوانند تا با تعویض تم روشن/تیره هم‌گام بمانند.
 */

const AXIS = 'rgb(var(--line-rgb) / 0.25)';
const LABEL = 'var(--faint)';

function Frame({ children, title }) {
  return (
    <svg viewBox="0 0 640 320" role="img" aria-label={title} className="micr-figure__svg">
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

const FIGURES = {
  'pressure-timeline': PressureTimeline,
  wiggers: WiggersDiagram,
  'pv-loop': PvLoop,
};

export default function MicroFigure({ diagram, title, caption }) {
  const Diagram = FIGURES[diagram];
  if (!Diagram) return null;
  return (
    <figure className="micr-figure">
      <figcaption className="micr-figure__title">{title}</figcaption>
      <Diagram />
      <figcaption className="micr-figure__caption">{caption}</figcaption>
    </figure>
  );
}
