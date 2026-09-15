import {
  BG_COLORS,
  BODY_SIZES,
  COVERING_COLORS,
  CLOTH_COLORS,
  EYE_COLORS,
  HAIR_COLORS,
  SKIN_TONES,
  defaultAvatarConfig,
  paletteColor,
} from './avatarOptions';

/*
 * رندرکنندهٔ آواتار تپش — تصویرسازی تخت با خط دور (flat line-art).
 *
 * زبان بصری:
 *  • هر شکل یک خط دور تیرهٔ یکدست دارد؛ هیچ گرادیان و سایهٔ نرمی وجود ندارد.
 *  • رنگ‌ها تخت و اشباع‌بالا هستند و پس‌زمینه روشن می‌ماند تا چهره بیرون بزند.
 *  • چهره کم‌جزئیات است: چشم‌های نقطه‌ای، ابروی کوتاه، بینیِ قلابی و لبخند ساده.
 *  • شانه‌ها در لبهٔ پایین کادر بریده می‌شوند و یقه روی گردن می‌افتد.
 *
 * چارچوب: viewBox ۲۶۰×۲۶۰، دایرهٔ پس‌زمینه به شعاع ۱۲۹ حول (۱۳۰،۱۳۰).
 * تناسبات بر پایهٔ قاعدهٔ یک‌پنجم: سر از y=۵۴ تا y=۱۶۲ و عرض ۸۸؛
 * خط چشم‌ها روی نیمهٔ ارتفاع سر (y=۱۰۸) و فاصلهٔ دو مردمک دو برابر عرض یک چشم است.
 * گردن از y=۱۴۶، شانه‌ها از y=۱۸۲ و در لبهٔ پایین کادر بریده می‌شوند.
 *
 * قرارداد داده (نام exportها، شناسهٔ گزینه‌ها و امضای کامپوننت) پایدار است.
 */

/* خط دور — تنها منبع خط در کل آواتار */
const INK = '#1f1d24';
const SW = 2.8;

const EYE_Y = 108;
const EYE_LEFT_X = 111;
const EYE_RIGHT_X = 149;
const BROW_Y = 92;
const EAR_Y = 118;
const SHOULDER_Y = 182;

const INK_STYLE = { stroke: INK, strokeWidth: SW, strokeLinejoin: 'round', strokeLinecap: 'round' };

/* ---------- هندسهٔ صورت ---------- */

const FACE_GEOMETRY = {
  oval: {
    d: 'M130 54C108 54 88 72 88 100C88 126 97 148 113 158C119 161 124 162 130 162C136 162 141 161 147 158C163 148 172 126 172 100C172 72 152 54 130 54Z',
    ear: 42,
  },
  round: {
    d: 'M130 58C105 58 84 79 84 110C84 141 105 164 130 164C155 164 176 141 176 110C176 79 155 58 130 58Z',
    ear: 46,
  },
  long: {
    d: 'M130 50C110 50 94 70 94 99C94 124 100 148 114 159C119 163 124 164 130 164C136 164 141 163 146 159C160 148 166 124 166 99C166 70 150 50 130 50Z',
    ear: 36,
  },
  square: {
    d: 'M130 55C108 55 90 64 88 87C87 104 87 128 91 147C95 161 112 167 130 167C148 167 165 161 169 147C173 128 173 104 172 87C170 64 152 55 130 55Z',
    ear: 42,
  },
};

const BODY_HALF_WIDTH = { slim: 58, medium: 68, large: 80 };

function torsoPath(halfWidth) {
  return `M ${130 - halfWidth} 262 C ${130 - halfWidth} 208 ${130 - halfWidth * 0.42} ${SHOULDER_Y} 130 ${SHOULDER_Y} C ${130 + halfWidth * 0.42} ${SHOULDER_Y} ${130 + halfWidth} 208 ${130 + halfWidth} 262 Z`;
}

function torsoHalfWidth(bodyId) {
  return BODY_SIZES.some((size) => size.id === bodyId) ? BODY_HALF_WIDTH[bodyId] : BODY_HALF_WIDTH.medium;
}

/* گوش: برجستگی کوچکی که بیرون لبهٔ صورت می‌نشیند */
function earPath(cx, side) {
  const o = side;
  return `M ${cx - 4 * o} ${EAR_Y - 11} C ${cx + 8 * o} ${EAR_Y - 12} ${cx + 11 * o} ${EAR_Y - 5} ${cx + 11 * o} ${EAR_Y} C ${cx + 11 * o} ${EAR_Y + 6} ${cx + 8 * o} ${EAR_Y + 12} ${cx - 4 * o} ${EAR_Y + 11} Z`;
}

/* ---------- ابزار رنگ ---------- */

export function shade(hex, amount = -0.15) {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw;
  const num = parseInt(full, 16);
  const from = amount < 0 ? 0 : 255;
  const ratio = Math.abs(amount);
  const mix = (channel) => Math.max(0, Math.min(255, Math.round((from - channel) * ratio + channel)));

  return `#${(
    (1 << 24) +
    (mix((num >> 16) & 255) << 16) +
    (mix((num >> 8) & 255) << 8) +
    mix(num & 255)
  )
    .toString(16)
    .slice(1)}`;
}

/* ---------- مو ---------- */

/* کلاهک پایه: از دو طرف از خود صورت پهن‌تر است تا حجم مو دیده شود */
const CAP =
  'M80 120C78 62 100 32 130 32C160 32 182 62 180 120C176 94 170 76 158 70C146 64 114 64 102 70C90 76 84 94 80 120Z';

/* چتری: خط رویش پایین‌تر و پیشانی کوتاه‌تر */
const CAP_FRINGE =
  'M80 120C78 60 100 32 130 32C160 32 182 60 180 120C176 94 170 76 158 70C144 62 112 66 98 76C88 84 82 100 80 120Z';

/* کشیده به عقب: خط رویش بالا و صاف */
const CAP_SLEEK =
  'M82 120C80 64 102 36 130 36C158 36 180 64 178 120C175 98 168 82 156 78C144 74 116 74 104 78C92 82 85 98 82 120Z';

/* تار روشن مو — یک خط نازک، بدون گرادیان */
function Shine({ d, width = 5, opacity = 0.34 }) {
  return <path d={d} stroke="#ffffff" strokeWidth={width} strokeLinecap="round" fill="none" strokeOpacity={opacity} />;
}

const HAIR_RENDERERS = {
  /* ---------------- زنانه ---------------- */
  'long-wavy': {
    back: (c) => (
      <path
        d="M130 34C88 34 72 68 76 104C78 128 82 152 86 174C89 190 92 204 94 214C113 223 147 223 166 214C168 204 171 190 174 174C178 152 182 128 184 104C188 68 172 34 130 34Z"
        fill={c.hair}
      />
    ),
    front: (c) => (
      <g>
        <path d={CAP} fill={c.hair} />
        <path d="M84 112C80 132 82 154 79 172C89 178 99 173 103 162C97 140 97 122 99 106Z" fill={c.hair} />
        <path d="M176 112C180 132 178 154 181 172C171 178 161 173 157 162C163 140 163 122 161 106Z" fill={c.hair} />
        <Shine d="M104 76C105 62 112 50 122 44" width={6} />
      </g>
    ),
  },
  bob: {
    back: (c) => (
      <path
        d="M130 34C94 34 78 66 80 102C81 122 85 142 90 158C97 171 112 177 130 177C148 177 163 171 170 158C175 142 179 122 180 102C182 66 166 34 130 34Z"
        fill={c.hair}
      />
    ),
    front: (c) => (
      <g>
        <path d={CAP_FRINGE} fill={c.hair} />
        <path d="M84 108C80 126 82 144 84 156C93 161 101 156 103 147C98 130 98 116 100 104Z" fill={c.hair} />
        <path d="M176 108C180 126 178 144 176 156C167 161 159 156 157 147C162 130 162 116 160 104Z" fill={c.hair} />
        <Shine d="M104 74C105 60 112 50 122 45" width={6} />
      </g>
    ),
  },
  ponytail: {
    back: (c) => (
      <g>
        <path
          d="M130 34C94 34 78 66 80 102C81 122 85 140 90 154C97 167 112 173 130 173C148 173 163 167 170 154C175 140 179 122 180 102C182 66 166 34 130 34Z"
          fill={c.hair}
        />
        <path d="M170 74C200 86 212 118 208 156C205 182 196 202 184 214C194 182 192 138 166 98Z" fill={c.hair} />
        <Shine d="M190 98C201 124 199 158 187 186" width={4} opacity={0.28} />
      </g>
    ),
    front: (c) => (
      <g>
        <path d={CAP_SLEEK} fill={c.hair} />
        <Shine d="M104 76C105 64 112 54 122 48" width={6} />
        <path d="M124 42C121 52 121 60 124 70" stroke={c.hairDark} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      </g>
    ),
  },
  bun: {
    back: (c) => (
      <g>
        <circle cx={130} cy={32} r={23} fill={c.hair} />
        <path
          d="M130 34C94 34 78 66 80 102C81 122 85 140 90 154C97 167 112 173 130 173C148 173 163 167 170 154C175 140 179 122 180 102C182 66 166 34 130 34Z"
          fill={c.hair}
        />
        <path d="M116 38C121 48 126 54 130 56C134 54 139 48 144 38" fill={c.hair} />
      </g>
    ),
    front: (c) => (
      <g>
        <path d={CAP_SLEEK} fill={c.hair} />
        <Shine d="M104 76C105 64 112 54 122 48" width={6} />
      </g>
    ),
  },
  braids: {
    back: (c) => (
      <g>
        <path
          d="M130 34C94 34 78 66 80 102C81 122 85 140 90 154C97 167 112 173 130 173C148 173 163 167 170 154C175 140 179 122 180 102C182 66 166 34 130 34Z"
          fill={c.hair}
        />
        {[128, 148, 166, 182].map((y, i) => (
          <g key={y}>
            <circle cx={72 - i * 2.5} cy={y} r={10 - i * 1.2} fill={c.hair} />
            <circle cx={188 + i * 2.5} cy={y} r={10 - i * 1.2} fill={c.hair} />
          </g>
        ))}
      </g>
    ),
    front: (c) => (
      <g>
        <path d={CAP_FRINGE} fill={c.hair} />
        <Shine d="M104 74C105 60 112 50 122 45" width={6} />
      </g>
    ),
  },
  'curly-long': {
    back: (c) => (
      <g>
        <path
          d="M130 34C90 34 74 68 77 106C79 132 78 156 74 178C72 194 70 206 68 216C91 227 169 227 192 216C190 206 188 194 186 178C182 156 181 132 183 106C186 68 170 34 130 34Z"
          fill={c.hair}
        />
        {/* حلقهٔ فرها دور تا دورِ سر: دایره‌های هم‌فاصله تا لبه یکدست موج‌دار شود */}
        {[
          [104, 46, 15],
          [130, 40, 16],
          [156, 46, 15],
          [84, 66, 15],
          [176, 66, 15],
          [78, 94, 15],
          [182, 94, 15],
          [74, 124, 14],
          [186, 124, 14],
          [72, 154, 14],
          [188, 154, 14],
          [72, 184, 13],
          [188, 184, 13],
          [74, 210, 12],
          [186, 210, 12],
        ].map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={c.hair} />
        ))}
      </g>
    ),
    front: (c) => (
      <g>
        <path d={CAP} fill={c.hair} />
        {/* چتریِ فر: قوسِ مرتبی از فرهای کوچک روی پیشانی */}
        {[
          [96, 68, 13],
          [114, 58, 13],
          [132, 55, 14],
          [150, 58, 13],
          [166, 68, 13],
        ].map(([cx, cy, r]) => (
          <circle key={`f${cx}`} cx={cx} cy={cy} r={r} fill={c.hair} />
        ))}
        <Shine d="M104 76C106 62 113 52 123 46" width={6} />
      </g>
    ),
  },

  /* ---------------- مردانه ---------------- */
  short: {
    back: () => null,
    front: (c) => (
      <g>
        <path d={CAP} fill={c.hair} />
        <path d="M88 100C89 116 91 128 94 138" stroke={c.hair} strokeWidth={11} strokeLinecap="round" fill="none" />
        <path d="M172 100C171 116 169 128 166 138" stroke={c.hair} strokeWidth={11} strokeLinecap="round" fill="none" />
        <Shine d="M106 82C107 68 114 56 124 50" width={6} />
      </g>
    ),
  },
  buzz: {
    back: () => null,
    front: (c) => (
      <g>
        <path
          d="M88 106C88 70 107 52 130 52C153 52 172 70 172 106C165 88 154 80 130 80C106 80 95 88 88 106Z"
          fill={c.hair}
        />
        <Shine d="M106 86C108 74 115 66 124 62" width={5} opacity={0.26} />
      </g>
    ),
  },
  sidepart: {
    back: () => null,
    front: (c) => (
      <g>
        <path
          d="M87 106C87 58 106 38 130 38C154 38 173 58 173 106C169 84 160 72 150 69C132 64 111 69 99 80C93 86 89 96 87 106Z"
          fill={c.hair}
        />
        <path d="M150 44C142 52 136 60 132 74" stroke={c.hairDark} strokeWidth={2.8} strokeLinecap="round" fill="none" />
        <Shine d="M114 56C125 48 138 47 149 52" width={6} />
      </g>
    ),
  },
  spiky: {
    back: () => null,
    front: (c) => (
      <g>
        {/* تاجِ کوتاه‌تر تا فوش‌ها بالای آن دیده شوند */}
        <path
          d="M88 106C88 70 106 50 130 50C154 50 172 70 172 106C169 88 161 76 149 72C139 69 121 69 111 72C99 76 91 88 88 106Z"
          fill={c.hair}
        />
        <path
          d="M92 54L99 26L109 52L119 18L129 50L138 16L148 50L158 22L166 52L172 38L172 54C158 62 104 62 92 54Z"
          fill={c.hair}
        />
        <Shine d="M106 84C107 70 114 58 124 52" width={6} />
      </g>
    ),
  },
  curly: {
    back: () => null,
    front: (c) => (
      <g>
        <path d="M89 104C89 68 107 48 130 48C153 48 171 68 171 104C164 88 156 82 130 82C104 82 96 88 89 104Z" fill={c.hair} />
        {[
          [94, 74, 12],
          [110, 59, 12],
          [128, 53, 12],
          [146, 57, 12],
          [162, 72, 12],
          [88, 93, 11],
          [172, 93, 11],
        ].map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={c.hair} />
        ))}
        <Shine d="M108 74C112 64 119 58 128 55" width={5} opacity={0.28} />
      </g>
    ),
  },
  shoulder: {
    back: (c) => (
      <path
        d="M130 34C92 34 76 66 79 102C80 124 84 146 88 166C92 182 95 196 97 206C112 213 148 213 163 206C165 196 168 182 172 166C176 146 180 124 181 102C184 66 168 34 130 34Z"
        fill={c.hair}
      />
    ),
    front: (c) => (
      <g>
        <path d={CAP} fill={c.hair} />
        <path d="M84 110C80 128 82 146 80 160C89 166 98 161 101 151C96 134 96 118 99 104Z" fill={c.hair} />
        <path d="M176 110C180 128 178 146 180 160C171 166 162 161 159 151C164 134 164 118 161 104Z" fill={c.hair} />
        <Shine d="M104 76C105 62 112 50 122 44" width={6} />
      </g>
    ),
  },
};

/* ---------- پوشش سر ---------- */

/* سوراخ صورت کمی کوچک‌تر از خود صورت است تا لبهٔ پارچه دور چهره دیده شود */
const FACE_HOLE =
  'M130 60C109 60 92 78 92 106C92 136 109 160 130 160C151 160 168 136 168 106C168 78 151 60 130 60Z';

const COVERING_SHAPES = {
  headscarf:
    'M130 38C80 38 64 82 68 128C70 158 62 184 52 204C82 224 178 224 208 204C198 184 190 158 192 128C196 82 180 38 130 38Z',
  maghnaeh:
    'M130 34C76 34 60 82 64 130C66 172 56 208 44 244C90 260 170 260 216 244C204 208 194 172 196 130C200 82 184 34 130 34Z',
  /* چادر: کمرِ جمع‌شده تا شبح روی شانه بنشیند و پس‌زمینه از دو طرف دیده شود */
  chador:
    'M130 30C70 30 52 86 56 140C58 172 54 196 46 216C42 228 38 240 36 256C70 264 190 264 224 256C222 240 218 228 214 216C206 196 202 172 204 140C208 86 190 30 130 30Z',
};

/* خط تای پارچه — برای اینکه پوشش‌ها مثل یک لکهٔ تخت دیده نشوند */
const COVERING_FOLDS = {
  headscarf: 'M96 176C112 190 148 190 164 176',
  maghnaeh: 'M92 190C112 206 148 206 168 190',
  chador: 'M74 218C100 234 160 234 186 218',
};

function CoveredHead({ fill, variant }) {
  const shape = COVERING_SHAPES[variant];
  if (!shape) return null;

  const fold = COVERING_FOLDS[variant];

  return (
    <g>
      <path d={`${shape} ${FACE_HOLE}`} fill={fill} fillRule="evenodd" />
      <path d="M92 72C104 58 116 53 130 53C144 53 156 58 168 72" stroke="#ffffff" strokeWidth={2.6} fill="none" strokeOpacity={0.28} />
      {fold && <path d={fold} stroke="#ffffff" strokeWidth={2.4} fill="none" strokeOpacity={0.24} strokeLinecap="round" />}
    </g>
  );
}

/* کلاه لبه‌دار */
function Cap({ fill }) {
  return (
    <g>
      <path d="M89 96C89 58 106 42 130 42C154 42 171 58 171 96C163 82 150 76 130 76C110 76 97 82 89 96Z" fill={fill} />
      <path d="M84 88C97 82 112 79 130 79C148 79 163 82 176 88C178 96 176 102 170 104C150 98 110 98 90 104C84 102 82 96 84 88Z" fill={fill} />
      <path d="M100 70C109 58 120 54 134 55" stroke="#ffffff" strokeWidth={3} fill="none" strokeLinecap="round" strokeOpacity={0.32} />
    </g>
  );
}

/* کلاه بافت */
function Beanie({ fill }) {
  return (
    <g>
      <path d="M88 92C88 54 106 36 130 36C154 36 172 54 172 92C164 80 150 74 130 74C110 74 96 80 88 92Z" fill={fill} />
      <path d="M86 88C98 82 113 79 130 79C147 79 162 82 174 88C175 98 173 106 168 110C148 104 112 104 92 110C87 106 85 98 86 88Z" fill={fill} />
      <path d="M102 74C104 62 110 54 118 50M118 74C119 60 122 52 128 48M136 74C135 60 138 52 144 49M152 76C150 63 148 55 144 49" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" fill="none" strokeOpacity={0.3} />
    </g>
  );
}

/* ---------- اجزای چهره ---------- */

function Eyes({ style, color }) {
  if (style === 'sleepy' || style === 'happy') {
    const dip = style === 'sleepy' ? 7 : -8;
    return (
      <g stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none">
        <path d={`M ${EYE_LEFT_X - 8} ${EYE_Y + 2} Q ${EYE_LEFT_X} ${EYE_Y + 2 + dip} ${EYE_LEFT_X + 8} ${EYE_Y + 2}`} />
        <path d={`M ${EYE_RIGHT_X - 8} ${EYE_Y + 2} Q ${EYE_RIGHT_X} ${EYE_Y + 2 + dip} ${EYE_RIGHT_X + 8} ${EYE_Y + 2}`} />
      </g>
    );
  }

  if (style === 'dot') {
    return (
      <g fill={color} stroke={INK} strokeWidth={1.6}>
        <circle cx={EYE_LEFT_X} cy={EYE_Y} r={4.8} />
        <circle cx={EYE_RIGHT_X} cy={EYE_Y} r={4.8} />
      </g>
    );
  }

  const eye = style === 'round' ? { rx: 7, ry: 7 } : { rx: 7.8, ry: 5.8 };

  return (
    <g stroke={INK} strokeWidth={2.2}>
      <ellipse cx={EYE_LEFT_X} cy={EYE_Y} rx={eye.rx} ry={eye.ry} fill="#ffffff" />
      <ellipse cx={EYE_RIGHT_X} cy={EYE_Y} rx={eye.rx} ry={eye.ry} fill="#ffffff" />
      <circle cx={EYE_LEFT_X} cy={EYE_Y} r={eye.ry * 0.62} fill={color} stroke="none" />
      <circle cx={EYE_RIGHT_X} cy={EYE_Y} r={eye.ry * 0.62} fill={color} stroke="none" />
    </g>
  );
}

function Brows({ style, color }) {
  const shapes = {
    thin: { width: 2.6, lift: 5, span: 8 },
    normal: { width: 3.4, lift: 6, span: 9 },
    thick: { width: 5, lift: 5.5, span: 9.5 },
  };
  const brow = shapes[style] ?? shapes.normal;

  return (
    <g stroke={color} strokeWidth={brow.width} strokeLinecap="round" fill="none">
      <path d={`M ${EYE_LEFT_X - brow.span} ${BROW_Y + 3} Q ${EYE_LEFT_X - 1} ${BROW_Y - brow.lift} ${EYE_LEFT_X + brow.span} ${BROW_Y + 1}`} />
      <path d={`M ${EYE_RIGHT_X - brow.span} ${BROW_Y + 1} Q ${EYE_RIGHT_X + 1} ${BROW_Y - brow.lift} ${EYE_RIGHT_X + brow.span} ${BROW_Y + 3}`} />
    </g>
  );
}

function Nose({ style }) {
  if (style === 'line') {
    return <path d="M133 114C136 124 137 131 130 134" stroke={INK} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
  }

  return <path d="M132 126C135 132 135 137 129 138" stroke={INK} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

function Mouth({ style }) {
  if (style === 'neutral') {
    return <path d="M122 147L138 147" stroke={INK} strokeWidth={2.8} strokeLinecap="round" fill="none" />;
  }

  if (style === 'smile') {
    return <path d="M120 143C124 151 136 151 140 143" stroke={INK} strokeWidth={2.8} strokeLinecap="round" fill="none" />;
  }

  if (style === 'grin') {
    return (
      <g {...INK_STYLE}>
        <path d="M118 141C121 154 139 154 142 141C134 145 126 145 118 141Z" fill="#8c4038" />
        <path d="M122 143.5C127 146 133 146 138 143.5" stroke="#fffdf9" strokeWidth={2.6} fill="none" strokeLinecap="round" />
      </g>
    );
  }

  return (
    <g {...INK_STYLE}>
      <path d="M118 140C121 157 139 157 142 140C134 145 126 145 118 140Z" fill="#7a352d" />
      <path d="M122 143.5C127 146 133 146 138 143.5" stroke="#fffdf9" strokeWidth={2.6} fill="none" strokeLinecap="round" />
    </g>
  );
}

function FacialHair({ style, color }) {
  if (style === 'none') return null;

  const mustache = (
    <path
      d="M112 138C119 130 126 132 130 138C134 132 141 130 148 138C144 149 116 149 112 138Z"
      fill={color}
      {...INK_STYLE}
      strokeWidth={2.4}
    />
  );

  if (style === 'mustache') return mustache;

  const jaw = (
    <path
      d="M89 108C90 136 98 154 110 161C117 165 123 162 130 162C137 162 143 165 150 161C162 154 170 136 171 108C169 132 161 148 151 154C143 158 137 152 130 152C123 152 117 158 109 154C99 148 91 132 89 108Z"
      fill={color}
      {...INK_STYLE}
      strokeWidth={2.4}
    />
  );

  if (style === 'stubble') {
    return (
      <g opacity={0.34}>
        {jaw}
        {mustache}
      </g>
    );
  }

  return (
    <g>
      {jaw}
      {mustache}
    </g>
  );
}

/* ---------- لباس ---------- */

function Clothes({ style, dark, skin }) {
  const details = {
    tshirt: <path d="M113 186C118 198 142 198 147 186C140 192 120 192 113 186Z" fill={dark} />,
    shirt: (
      <g>
        <path d="M130 182L111 190L124 208L130 189Z" fill={dark} />
        <path d="M130 182L149 190L136 208L130 189Z" fill={dark} />
        <path d="M130 189L130 262" fill="none" strokeWidth={2.4} />
        <circle cx="130" cy="214" r="2.8" fill={dark} />
        <circle cx="130" cy="238" r="2.8" fill={dark} />
      </g>
    ),
    scrubs: (
      <g>
        <path d="M113 184L130 210L147 184Z" fill={skin} />
        <path d="M113 184L130 210L147 184" fill="none" />
        <rect x="150" y="226" width="28" height="20" rx="4" fill="none" strokeWidth={2.4} />
      </g>
    ),
    coat: (
      <g>
        <path d="M130 182L109 191L125 248L130 208Z" fill="#ffffff" />
        <path d="M130 182L151 191L135 248L130 208Z" fill="#ffffff" />
        <path d="M130 208L130 262" fill="none" strokeWidth={2.4} />
        <rect x="142" y="232" width="32" height="22" rx="4" fill="none" strokeWidth={2.2} />
      </g>
    ),
    manteau: (
      <g>
        <path d="M130 188C119 188 111 196 106 210M130 188C141 188 149 196 154 210" fill="none" strokeWidth={2.6} strokeLinecap="round" />
        <path d="M130 204L130 262" fill="none" strokeWidth={2.4} />
        <circle cx="130" cy="224" r="3.2" fill={dark} />
        <circle cx="130" cy="246" r="3.2" fill={dark} />
      </g>
    ),
    hoodie: (
      <g>
        <path d="M104 188C110 176 119 172 130 172C141 172 150 176 156 188C147 197 113 197 104 188Z" fill={dark} />
        <path d="M122 191C121 202 121 212 122 222M138 191C139 202 139 212 138 222" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" fill="none" />
        <circle cx="122" cy="225" r="3.2" fill="#ffffff" />
        <circle cx="138" cy="225" r="3.2" fill="#ffffff" />
        <path d="M112 232C120 226 140 226 148 232L146 254L114 254Z" fill="none" strokeWidth={2.4} />
      </g>
    ),
  };

  return details[style] ?? null;
}

/* ---------- اکسسوری ---------- */

function Glasses({ style, earX }) {
  const lens = style === 'sunglasses' ? '#3a3f4a' : '#ffffff';

  if (style === 'glasses-square') {
    return (
      <g stroke={INK} strokeWidth={2.8} fill="#ffffff" fillOpacity={0.3}>
        <rect x="98" y="97" width="28" height="24" rx="6" />
        <rect x="134" y="97" width="28" height="24" rx="6" />
        <path d="M126 106C129 103.5 131 103.5 134 106" fill="none" />
        <path d={`M98 106L${earX[0] + 4} 101M162 106L${earX[1] - 4} 101`} fill="none" />
      </g>
    );
  }

  if (style === 'sunglasses') {
    return (
      <g stroke={INK} strokeWidth={2.8}>
        <path d="M97 98H124C126 98 127 100 127 102V108C127 114 122 118 116 118H106C100 118 96 113 96 107V99C96 98 96 98 97 98Z" fill={lens} />
        <path d="M133 98H160C161 98 162 98 162 99V107C162 113 158 118 152 118H142C136 118 131 114 131 108V102C131 100 132 98 133 98Z" fill={lens} />
        <path d="M127 102C129 100 131 100 133 102" fill="none" />
        <path d={`M96 104L${earX[0] + 4} 100M162 104L${earX[1] - 4} 100`} fill="none" />
      </g>
    );
  }

  return (
    <g stroke={INK} strokeWidth={2.8} fill="#ffffff" fillOpacity={0.3}>
      <circle cx={EYE_LEFT_X} cy={EYE_Y} r="14.5" />
      <circle cx={EYE_RIGHT_X} cy={EYE_Y} r="14.5" />
      <path d="M125.5 106Q130 103 134.5 106" fill="none" />
      <path d={`M${EYE_LEFT_X - 14.5} 106L${earX[0] + 4} 101M${EYE_RIGHT_X + 14.5} 106L${earX[1] - 4} 101`} fill="none" />
    </g>
  );
}

function Earrings({ earX }) {
  return (
    <g fill="#f0b93f" stroke={INK} strokeWidth={2.2}>
      <circle cx={earX[0] - 1} cy={EAR_Y + 17} r="4.6" />
      <circle cx={earX[1] + 1} cy={EAR_Y + 17} r="4.6" />
    </g>
  );
}

/* هندزفری: گوشی داخل گوش + سیم پایین‌رو */
function Earphones({ earX }) {
  return (
    <g stroke={INK} strokeWidth={2.6} fill="#ffffff">
      <circle cx={earX[1] + 1} cy={EAR_Y + 1} r="5" />
      <path d={`M${earX[1] + 1} ${EAR_Y + 6}C${earX[1] + 2} 150 126 168 120 190C116 206 114 224 116 244`} fill="none" strokeLinecap="round" />
      <path d={`M${earX[0] - 1} ${EAR_Y + 6}C${earX[0] - 2} 146 100 158 96 178`} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Stethoscope() {
  return (
    <g stroke={INK} strokeWidth={2.4}>
      <path d="M106 206C101 232 112 252 130 252C148 252 159 232 154 206" stroke="#4a5561" strokeWidth={5.5} strokeLinecap="round" fill="none" />
      <circle cx="130" cy="254" r="8.5" fill="#4a5561" />
      <circle cx="130" cy="254" r="3.4" fill="#cbd6db" strokeWidth={1.8} />
    </g>
  );
}

/* ---------- کامپوننت اصلی ---------- */

export function normalizeAvatarConfig(config) {
  const gender = config?.gender === 'male' ? 'male' : 'female';
  const defaults = defaultAvatarConfig(gender);
  const merged = { ...defaults, ...(config ?? {}) };
  merged.gender = gender;
  merged.accessories = Array.isArray(merged.accessories) ? merged.accessories : [];
  return merged;
}

export default function AvatarSvg({ config, className, title = 'آواتار کاربر' }) {
  const cfg = normalizeAvatarConfig(config);

  // شناسه‌ی یکتا و پایدار برای تعریف‌های SVG (جلوگیری از تداخل بین چند پیش‌نمایش هم‌زمان)
  const uid = `tp-${cfg.gender}-${cfg.face}-${cfg.hair}-${cfg.bg}-${cfg.clothColor}-${cfg.skin}`.replace(
    /[^a-zA-Z0-9-]/g,
    ''
  );

  const skin = paletteColor(SKIN_TONES, cfg.skin, 't3').hex;
  const hairColor = paletteColor(HAIR_COLORS, cfg.hairColor, 'black').hex;
  const eyeColor = paletteColor(EYE_COLORS, cfg.eyeColor, 'brown').hex;
  const clothColor = paletteColor(CLOTH_COLORS, cfg.clothColor, 'white').hex;
  const coveringColor = paletteColor(COVERING_COLORS, cfg.coveringColor, 'cream').hex;
  const bgColor = paletteColor(BG_COLORS, cfg.bg, 'cream').hex;

  const hairColors = { hair: hairColor, hairDark: shade(hairColor, -0.28) };
  const clothDark = shade(clothColor, -0.24);

  const face = FACE_GEOMETRY[cfg.face] ?? FACE_GEOMETRY.oval;
  const halfWidth = torsoHalfWidth(cfg.body);
  const hairRenderer = HAIR_RENDERERS[cfg.hair] ?? HAIR_RENDERERS['long-wavy'];
  const hasCovering = Boolean(cfg.covering) && cfg.covering !== 'none';
  const earX = [130 - face.ear, 130 + face.ear];

  return (
    <svg viewBox="0 0 260 260" className={className} role="img" aria-label={title}>
      <title>{title}</title>

      {/* پس‌زمینه روشن */}
      <circle cx="130" cy="130" r="129" fill={bgColor} />

      {/* همه‌چیز داخل دایره بریده می‌شود تا شانه‌ها از کادر بیرون نزنند */}
      <defs>
        <clipPath id={`${uid}-clip`}>
          <circle cx="130" cy="130" r="129" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${uid}-clip)`} {...INK_STYLE}>
        {/* موی پشت */}
        {!hasCovering && hairRenderer.back(hairColors)}

        {/* گردن */}
        <rect x="114" y="144" width="32" height="52" fill={skin} />

        {/* هودی: کلاه پشت شانه‌ها */}
        {cfg.cloth === 'hoodie' && (
          <path d="M130 170C100 170 84 192 86 214C101 202 159 202 174 214C176 192 160 170 130 170Z" fill={clothDark} />
        )}

        {/* تنه و لباس */}
        <path d={torsoPath(halfWidth)} fill={cfg.cloth === 'coat' ? '#ffffff' : clothColor} />
        <Clothes style={cfg.cloth} dark={clothDark} skin={skin} />

        {/* گوش‌ها */}
        <path d={earPath(earX[0], -1)} fill={skin} />
        <path d={earPath(earX[1], 1)} fill={skin} />

        {/* صورت */}
        <path d={face.d} fill={skin} />
      </g>

      {/* اجزای چهره */}
      <FacialHair style={cfg.facialHair} color={hairColor} />
      <Brows style={cfg.brows} color={shade(hairColor, -0.12)} />
      <Eyes style={cfg.eyes} color={eyeColor} />
      <Nose style={cfg.nose} />
      <Mouth style={cfg.mouth} />

      <g {...INK_STYLE}>
        {/* موی جلو */}
        {!hasCovering && hairRenderer.front(hairColors)}

        {/* پوشش سر */}
        {hasCovering &&
          (cfg.covering === 'cap' ? (
            <Cap fill={coveringColor} />
          ) : cfg.covering === 'beanie' ? (
            <Beanie fill={coveringColor} />
          ) : (
            <CoveredHead fill={coveringColor} variant={cfg.covering} />
          ))}
      </g>

      {/* اکسسوری‌ها */}
      {cfg.accessories.includes('glasses-round') && <Glasses style="glasses-round" earX={earX} />}
      {cfg.accessories.includes('glasses-square') && <Glasses style="glasses-square" earX={earX} />}
      {cfg.accessories.includes('sunglasses') && <Glasses style="sunglasses" earX={earX} />}
      {cfg.accessories.includes('earrings') && <Earrings earX={earX} />}
      {cfg.accessories.includes('earphones') && <Earphones earX={earX} />}
      {cfg.accessories.includes('stethoscope') && <Stethoscope />}
    </svg>
  );
}
