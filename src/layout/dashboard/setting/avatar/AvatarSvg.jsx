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
 * رندرکننده SVG آواتار تپش — سبک فلت هماهنگ با تم سایت.
 * همه اجزا روی شبکه ۲۶۰×۲۶۰ حول مرکز صورت (۱۳۰، ۱۰۶) چیده می‌شوند.
 */

const FACE_CENTER_X = 130;
const EYE_Y = 104;
const EYE_LEFT_X = 112;
const EYE_RIGHT_X = 148;

/* هندسه هر شکل صورت: مسیر صورت + محل گوش‌ها */
const FACE_GEOMETRY = {
  oval: { face: <ellipse cx={130} cy={106} rx={45} ry={50} />, ears: [83, 177] },
  round: { face: <ellipse cx={130} cy={107} rx={49} ry={47} />, ears: [79, 181] },
  long: { face: <ellipse cx={130} cy={104} rx={42} ry={53} />, ears: [86, 174] },
  square: { face: <rect x={84} y={57} width={92} height={99} rx={30} />, ears: [84, 176] },
};

const BODY_HALF_WIDTH = { slim: 58, medium: 74, large: 92 };

function torsoPath(halfWidth) {
  return `M ${130 - halfWidth} 262 C ${130 - halfWidth} 198 ${130 - halfWidth * 0.62} 168 130 168 C ${
    130 + halfWidth * 0.62
  } 168 ${130 + halfWidth} 198 ${130 + halfWidth} 262 Z`;
}

/* روشن/تیره کردن رنگ برای سایه‌ها */
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

function torsoHalfWidth(bodyId) {
  return BODY_SIZES.find((size) => size.id === bodyId)
    ? BODY_HALF_WIDTH[bodyId]
    : BODY_HALF_WIDTH.medium;
}

/* ---------- مو ---------- */

const CAP_BASE = 'M 84 98 C 84 48 176 48 176 98 C 172 78 158 71 130 71 C 102 71 88 78 84 98 Z';
const CAP_FRINGE =
  'M 84 98 C 84 48 176 48 176 98 C 174 86 168 80 158 77 C 145 73 115 73 102 77 C 92 80 86 86 84 98 Z';
const CAP_SMOOTH =
  'M 84 98 C 84 48 176 48 176 98 C 176 82 156 74 130 74 C 104 74 84 82 84 98 Z';

function Scallop({ cx, cy, r, fill }) {
  return <circle cx={cx} cy={cy} r={r} fill={fill} />;
}

const HAIR_RENDERERS = {
  'long-wavy': {
    back: (c) => (
      <path
        d="M 130 42 C 76 42 64 90 68 136 C 71 170 60 196 48 214 C 88 234 172 234 212 214 C 200 196 189 170 192 136 C 196 90 184 42 130 42 Z"
        fill={c.hair}
      />
    ),
    front: (c) => (
      <g fill={c.hair}>
        <path d={CAP_BASE} />
        <path d="M 84 92 C 78 124 80 148 72 172 C 88 180 102 176 108 168 C 100 142 98 114 102 92 Z" />
        <path d="M 176 92 C 182 124 180 148 188 172 C 172 180 158 176 152 168 C 160 142 162 114 158 92 Z" />
      </g>
    ),
  },
  bob: {
    back: (c) => (
      <path
        d="M 130 44 C 86 44 74 78 76 118 C 77 140 80 154 86 162 C 102 170 158 170 174 162 C 180 154 183 140 184 118 C 186 78 174 44 130 44 Z"
        fill={c.hair}
      />
    ),
    front: (c) => (
      <g fill={c.hair}>
        <path d={CAP_FRINGE} />
        <path d="M 84 92 C 80 112 80 128 84 140 C 92 146 100 144 104 138 C 98 122 96 106 98 92 Z" />
        <path d="M 176 92 C 180 112 180 128 176 140 C 168 146 160 144 156 138 C 162 122 164 106 162 92 Z" />
      </g>
    ),
  },
  ponytail: {
    back: (c) => (
      <g fill={c.hair}>
        <path d="M 130 44 C 84 44 74 80 76 116 C 78 136 86 148 96 152 C 112 158 148 158 164 152 C 174 148 182 136 184 116 C 186 80 176 44 130 44 Z" />
        <path d="M 178 70 C 204 78 214 116 206 158 C 202 182 194 198 184 206 C 192 176 190 138 176 104 Z" />
      </g>
    ),
    front: (c) => (
      <g>
        <path d={CAP_SMOOTH} fill={c.hair} />
        <path d="M 130 50 C 130 58 130 65 130 72" stroke={c.hairDark} strokeWidth={2} fill="none" />
      </g>
    ),
  },
  bun: {
    back: (c) => (
      <g fill={c.hair}>
        <circle cx={130} cy={38} r={17} />
        <circle cx={130} cy={38} r={8} fill={c.hairDark} />
        <path d={CAP_SMOOTH} />
      </g>
    ),
    front: (c) => (
      <g>
        <path d={CAP_SMOOTH} fill={c.hair} />
        <path d="M 112 54 C 118 62 122 66 124 72" stroke={c.hairDark} strokeWidth={2} fill="none" />
        <path d="M 148 54 C 142 62 138 66 136 72" stroke={c.hairDark} strokeWidth={2} fill="none" />
      </g>
    ),
  },
  braids: {
    back: (c) => (
      <g fill={c.hair}>
        <path d="M 130 44 C 84 44 74 80 76 116 C 78 136 86 148 96 152 C 112 158 148 158 164 152 C 174 148 182 136 184 116 C 186 80 176 44 130 44 Z" />
        <circle cx={76} cy={118} r={9.5} />
        <circle cx={72} cy={142} r={8.5} />
        <circle cx={69} cy={164} r={7.5} />
        <circle cx={67} cy={181} r={4.5} />
        <circle cx={184} cy={118} r={9.5} />
        <circle cx={188} cy={142} r={8.5} />
        <circle cx={191} cy={164} r={7.5} />
        <circle cx={193} cy={181} r={4.5} />
      </g>
    ),
    front: (c) => <path d={CAP_BASE} fill={c.hair} />,
  },
  'curly-long': {
    back: (c) => (
      <g fill={c.hair}>
        <path d="M 130 42 C 76 42 64 90 68 136 C 71 170 60 196 48 214 C 88 234 172 234 212 214 C 200 196 189 170 192 136 C 196 90 184 42 130 42 Z" />
        <Scallop cx={96} cy={50} r={12} fill={c.hair} />
        <Scallop cx={130} cy={40} r={12} fill={c.hair} />
        <Scallop cx={164} cy={50} r={12} fill={c.hair} />
        <Scallop cx={78} cy={96} r={12} fill={c.hair} />
        <Scallop cx={68} cy={140} r={12} fill={c.hair} />
        <Scallop cx={60} cy={184} r={12} fill={c.hair} />
        <Scallop cx={182} cy={96} r={12} fill={c.hair} />
        <Scallop cx={192} cy={140} r={12} fill={c.hair} />
        <Scallop cx={200} cy={184} r={12} fill={c.hair} />
      </g>
    ),
    front: (c) => (
      <g fill={c.hair}>
        <path d={CAP_SMOOTH} />
        <circle cx={95} cy={76} r={9} />
        <circle cx={113} cy={70} r={9} />
        <circle cx={130} cy={67} r={9} />
        <circle cx={147} cy={70} r={9} />
        <circle cx={165} cy={76} r={9} />
      </g>
    ),
  },
  short: {
    back: () => null,
    front: (c) => (
      <g fill={c.hair}>
        <path d={CAP_FRINGE} />
        <rect x={86} y={94} width={7} height={16} rx={3} />
        <rect x={167} y={94} width={7} height={16} rx={3} />
      </g>
    ),
  },
  buzz: {
    back: () => null,
    front: (c) => (
      <g fill={c.hair}>
        <path d="M 86 94 C 86 54 174 54 174 94 C 170 82 156 77 130 77 C 104 77 90 82 86 94 Z" />
        <rect x={87} y={94} width={6} height={11} rx={3} />
        <rect x={167} y={94} width={6} height={11} rx={3} />
      </g>
    ),
  },
  sidepart: {
    back: () => null,
    front: (c) => (
      <g>
        <path
          d="M 84 98 C 84 48 176 48 176 98 C 174 80 170 74 160 72 C 140 68 112 70 96 82 C 90 86 86 92 84 98 Z"
          fill={c.hair}
        />
        <path d="M 148 58 C 140 64 134 70 130 76" stroke={c.hairDark} strokeWidth={2.5} fill="none" />
      </g>
    ),
  },
  spiky: {
    back: () => null,
    front: (c) => (
      <g fill={c.hair}>
        <path
          d="M 94 66 L 104 42 L 112 58 L 124 34 L 134 56 L 146 38 L 154 58 L 164 46 L 170 66 C 156 52 106 52 94 66 Z"
        />
        <path d={CAP_SMOOTH} />
        <rect x={86} y={94} width={6} height={13} rx={3} />
        <rect x={168} y={94} width={6} height={13} rx={3} />
      </g>
    ),
  },
  curly: {
    back: () => null,
    front: (c) => (
      <g fill={c.hair}>
        <path d={CAP_SMOOTH} />
        <circle cx={92} cy={72} r={10.5} />
        <circle cx={111} cy={60} r={10.5} />
        <circle cx={130} cy={55} r={10.5} />
        <circle cx={149} cy={60} r={10.5} />
        <circle cx={168} cy={72} r={10.5} />
        <circle cx={82} cy={90} r={9} />
        <circle cx={178} cy={90} r={9} />
      </g>
    ),
  },
  shoulder: {
    back: (c) => (
      <path
        d="M 130 44 C 82 44 70 86 72 128 C 74 158 66 184 56 200 C 92 218 168 218 204 200 C 194 184 186 158 188 128 C 190 86 178 44 130 44 Z"
        fill={c.hair}
      />
    ),
    front: (c) => (
      <g fill={c.hair}>
        <path d={CAP_BASE} />
        <path d="M 84 94 C 80 118 82 138 78 156 C 90 162 100 158 104 150 C 98 130 97 110 100 94 Z" />
        <path d="M 176 94 C 180 118 178 138 182 156 C 170 162 160 158 156 150 C 162 130 163 110 160 94 Z" />
      </g>
    ),
  },
};

/* ---------- پوشش سر ---------- */

function CoveredHead({ fill, dark, variant }) {
  /* سوراخ صورت عمداً از همه شکل‌های صورت کوچک‌تر است تا لبه پارچه دور صورت دیده شود */
  const faceHole = 'M 92 108 A 38 46 0 1 0 168 108 A 38 46 0 1 0 92 108 Z';
  const shapes = {
    headscarf: {
      d: 'M 130 38 C 76 38 62 84 65 128 C 67 162 56 188 44 206 C 84 228 176 228 216 206 C 204 188 193 162 195 128 C 198 84 184 38 130 38 Z',
    },
    maghnaeh: {
      d: 'M 130 36 C 74 36 60 84 63 128 C 66 178 54 212 42 240 C 88 260 172 260 218 240 C 206 212 194 178 197 128 C 200 84 186 36 130 36 Z',
    },
    chador: {
      d: 'M 130 34 C 68 34 50 90 53 142 C 56 194 38 232 20 262 C 78 262 182 262 240 262 C 222 232 204 194 207 142 C 210 90 192 34 130 34 Z',
    },
  };

  const shape = shapes[variant];
  if (!shape) return null;

  return (
    <g>
      <path d={`${shape.d} ${faceHole}`} fill={fill} fillRule="evenodd" />
      <path
        d="M 96 60 C 88 84 88 110 92 134"
        stroke={dark}
        strokeWidth={3}
        fill="none"
        opacity={0.55}
        strokeLinecap="round"
      />
      <path
        d="M 164 60 C 172 84 172 110 168 134"
        stroke={dark}
        strokeWidth={3}
        fill="none"
        opacity={0.55}
        strokeLinecap="round"
      />
    </g>
  );
}

function Cap({ fill, dark }) {
  return (
    <g>
      <path d="M 86 90 C 86 46 174 46 174 90 C 168 82 152 78 130 78 C 108 78 92 82 86 90 Z" fill={fill} />
      <rect x={83} y={84} width={94} height={12} rx={6} fill={dark} />
    </g>
  );
}

/* ---------- اجزای صورت ---------- */

function Eyes({ style, color }) {
  const iris = { left: EYE_LEFT_X, right: EYE_RIGHT_X };

  if (style === 'sleepy' || style === 'happy') {
    const curve = style === 'sleepy' ? 6 : -7;
    return (
      <g stroke="#33291f" strokeWidth={3.5} strokeLinecap="round" fill="none">
        <path d={`M ${EYE_LEFT_X - 9} 106 Q ${EYE_LEFT_X} ${106 + curve} ${EYE_LEFT_X + 9} 106`} />
        <path d={`M ${EYE_RIGHT_X - 9} 106 Q ${EYE_RIGHT_X} ${106 + curve} ${EYE_RIGHT_X + 9} 106`} />
      </g>
    );
  }

  const shape =
    style === 'round'
      ? { rx: 7.5, ry: 7.5 }
      : { rx: 8.5, ry: 5.8 };

  return (
    <g>
      {['left', 'right'].map((side) => {
        const cx = iris[side];
        return (
          <g key={side}>
            <ellipse cx={cx} cy={EYE_Y} rx={shape.rx} ry={shape.ry} fill="#fdfbf8" />
            <circle cx={cx} cy={EYE_Y} r={4} fill={color} />
            <circle cx={cx} cy={EYE_Y} r={1.9} fill="#241d18" />
            <circle cx={cx + 1.6} cy={EYE_Y - 1.8} r={1.2} fill="#ffffff" />
          </g>
        );
      })}
    </g>
  );
}

function Brows({ style, color }) {
  const paths = {
    thin: { width: 3, d: (cx) => `M ${cx - 9} 88 Q ${cx} 83.5 ${cx + 9} 87` },
    normal: { width: 4.5, d: (cx) => `M ${cx - 9.5} 89 Q ${cx} 82 ${cx + 9.5} 87` },
    thick: { width: 6.5, d: (cx) => `M ${cx - 10} 90 Q ${cx} 83 ${cx + 10} 87.5` },
  };
  const brow = paths[style] ?? paths.normal;

  return (
    <g stroke={color} strokeWidth={brow.width} strokeLinecap="round" fill="none">
      <path d={brow.d(EYE_LEFT_X)} />
      <path d={brow.d(EYE_RIGHT_X)} />
    </g>
  );
}

function Nose({ style, color }) {
  if (style === 'line') {
    return (
      <path
        d="M 130.5 103 Q 136 112 129 118"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
        fill="none"
      />
    );
  }

  return (
    <path
      d="M 132.5 116 Q 129.5 121.5 124.5 119.5"
      stroke={color}
      strokeWidth={3.5}
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Mouth({ style }) {
  if (style === 'neutral') {
    return <path d="M 121 137 L 139 137" stroke="#9c5648" strokeWidth={4} strokeLinecap="round" fill="none" />;
  }

  if (style === 'smile') {
    return (
      <path d="M 119 135 Q 130 145 141 135" stroke="#9c5648" strokeWidth={4} strokeLinecap="round" fill="none" />
    );
  }

  if (style === 'grin') {
    return (
      <g>
        <path d="M 117 133 C 121 149 139 149 143 133 Z" fill="#6e332c" />
        <path d="M 120.5 134.5 C 126.5 138.5 133.5 138.5 139.5 134.5 C 133.5 132 126.5 132 120.5 134.5 Z" fill="#fdfbf8" />
      </g>
    );
  }

  return (
    <g>
      <path d="M 118 133 C 122 151 138 151 142 133 Z" fill="#5f2b25" />
      <path d="M 121.5 134.5 C 127 137.5 133 137.5 138.5 134.5 Z" fill="#fdfbf8" />
      <ellipse cx={130} cy={144} rx={5.5} ry={3.2} fill="#c96a5f" />
    </g>
  );
}

function FacialHair({ style, color }) {
  if (style === 'none') return null;

  const mustache = (
    <path d="M 115 128 C 122 121 127 126 130 129 C 133 126 138 121 145 128 C 141 137 119 137 115 128 Z" fill={color} />
  );

  if (style === 'mustache') return mustache;

  const jaw = (
    <path d="M 88 100 C 88 148 106 166 130 166 C 154 166 172 148 172 100 C 172 136 162 152 150 156 C 142 158 138 152 130 152 C 122 152 118 158 110 156 C 98 152 88 136 88 100 Z" />
  );

  if (style === 'stubble') {
    return (
      <g opacity={0.3}>
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

function Clothes({ style, color, dark, skin }) {
  const details = {
    tshirt: (
      <path d="M 118 168 C 122 180 138 180 142 168 C 138 174 122 174 118 168 Z" fill={dark} />
    ),
    shirt: (
      <g>
        <path d="M 130 166 L 112 171 L 124 184 Z" fill={dark} />
        <path d="M 130 166 L 148 171 L 136 184 Z" fill={dark} />
        <rect x={127.5} y={170} width={5} height={84} fill={shade(color, -0.08)} />
        <circle cx={130} cy={188} r={2.6} fill={shade(color, -0.3)} />
        <circle cx={130} cy={206} r={2.6} fill={shade(color, -0.3)} />
        <circle cx={130} cy={224} r={2.6} fill={shade(color, -0.3)} />
      </g>
    ),
    scrubs: (
      <g>
        <path d="M 117 168 L 130 188 L 143 168 Z" fill={skin} />
        <path d="M 117 168 L 130 188 L 143 168" stroke={dark} strokeWidth={3.5} fill="none" />
        <rect x={150} y={198} width={24} height={17} rx={3} fill="none" stroke={dark} strokeWidth={3} />
        <path d="M 160 199 L 160 211" stroke="#b99a86" strokeWidth={3} strokeLinecap="round" />
      </g>
    ),
    coat: (
      <g>
        <path d="M 121 168 L 139 168 L 130 184 Z" fill={color} />
        <path d="M 130 166 L 109 173 L 124 212 L 130 186 Z" fill="#ded7cc" />
        <path d="M 130 166 L 151 173 L 136 212 L 130 186 Z" fill="#ded7cc" />
        <rect x={142} y={208} width={30} height={20} rx={4} fill="none" stroke="#d8d1c6" strokeWidth={3} />
        <circle cx={99} cy={202} r={6} fill="#b99a86" />
      </g>
    ),
    manteau: (
      <g>
        <path d="M 130 170 C 118 170 108 178 104 190" stroke={dark} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        <path d="M 130 170 C 142 170 152 178 156 190" stroke={dark} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        <circle cx={130} cy={200} r={3} fill={dark} />
        <circle cx={130} cy={220} r={3} fill={dark} />
      </g>
    ),
    hoodie: null,
  };

  return details[style] ?? null;
}

/* ---------- اکسسوری ---------- */

function Glasses({ style, earX }) {
  const [leftEar, rightEar] = earX;
  const stroke = '#3a352f';

  if (style === 'glasses-square') {
    return (
      <g stroke={stroke} strokeWidth={3.2} fill="#ffffff" fillOpacity={0.08}>
        <rect x={97.5} y={93} width={29} height={21} rx={6} />
        <rect x={133.5} y={93} width={29} height={21} rx={6} />
        <path d="M 126.5 102 C 129 99 131 99 133.5 102" fill="none" />
        <path d={`M 97.5 102 L ${leftEar + 3} 98`} fill="none" />
        <path d={`M 162.5 102 L ${rightEar - 3} 98`} fill="none" />
      </g>
    );
  }

  return (
    <g stroke={stroke} strokeWidth={3.2} fill="#ffffff" fillOpacity={0.08}>
      <circle cx={EYE_LEFT_X} cy={EYE_Y} r={13.5} />
      <circle cx={EYE_RIGHT_X} cy={EYE_Y} r={13.5} />
      <path d="M 125.5 103 Q 130 100 134.5 103" fill="none" />
      <path d={`M ${EYE_LEFT_X - 13.5} 102 L ${leftEar + 3} 98`} fill="none" />
      <path d={`M ${EYE_RIGHT_X + 13.5} 102 L ${rightEar - 3} 98`} fill="none" />
    </g>
  );
}

function Stethoscope() {
  return (
    <g>
      <path
        d="M 103 176 C 98 202 110 220 130 220 C 150 220 162 202 157 176"
        stroke="#47525c"
        strokeWidth={5.5}
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={130} cy={224} r={8} fill="#47525c" />
      <circle cx={130} cy={224} r={3} fill="#b99a86" />
    </g>
  );
}

function Earrings({ earX }) {
  const [leftEar, rightEar] = earX;
  return (
    <g>
      <circle cx={leftEar + 1} cy={124} r={3.4} fill="#d9b36c" />
      <circle cx={rightEar - 1} cy={124} r={3.4} fill="#d9b36c" />
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

  const skin = paletteColor(SKIN_TONES, cfg.skin, 't2').hex;
  const skinShadow = shade(skin, -0.14);
  const hairColor = paletteColor(HAIR_COLORS, cfg.hairColor, 'black').hex;
  const eyeColor = paletteColor(EYE_COLORS, cfg.eyeColor, 'brown').hex;
  const clothColor = paletteColor(CLOTH_COLORS, cfg.clothColor, 'cream').hex;
  const coveringColor = paletteColor(COVERING_COLORS, cfg.coveringColor, 'beige').hex;
  const bgColor = paletteColor(BG_COLORS, cfg.bg, 'beige').hex;

  const hairColors = { hair: hairColor, hairDark: shade(hairColor, -0.22) };
  const browColor = shade(hairColor, -0.1);

  const faceGeometry = FACE_GEOMETRY[cfg.face] ?? FACE_GEOMETRY.oval;
  const halfWidth = torsoHalfWidth(cfg.body);
  const torso = torsoPath(halfWidth);
  const clothDark = shade(clothColor, -0.18);

  const hairRenderer = HAIR_RENDERERS[cfg.hair] ?? HAIR_RENDERERS['long-wavy'];
  const hasCovering = cfg.covering && cfg.covering !== 'none';
  const isCap = cfg.covering === 'cap';

  const coatFill = cfg.cloth === 'coat' ? '#f2efe9' : clothColor;
  const hoodBehind = cfg.cloth === 'hoodie' ? shade(clothColor, -0.12) : null;

  return (
    <svg viewBox="0 0 260 260" className={className} role="img" aria-label={title}>
      {/* پس‌زمینه */}
      <circle cx={130} cy={130} r={129} fill={bgColor} />

      {/* گردن */}
      <rect x={116} y={146} width={28} height={34} rx={9} fill={skinShadow} />

      {/* هودی: کلاه پشت تنه */}
      {hoodBehind && (
        <path
          d="M 130 150 C 94 150 80 172 84 194 C 96 184 164 184 176 194 C 180 172 166 150 130 150 Z"
          fill={hoodBehind}
        />
      )}

      {/* تنه و لباس */}
      <path d={torso} fill={coatFill} />
      <Clothes style={cfg.cloth} color={clothColor} dark={clothDark} skin={skin} />
      {cfg.cloth === 'hoodie' && (
        <g>
          <path d="M 121 184 C 120 194 119 202 120 210" stroke="#f5f1ea" strokeWidth={3} strokeLinecap="round" fill="none" />
          <path d="M 139 184 C 140 194 141 202 140 210" stroke="#f5f1ea" strokeWidth={3} strokeLinecap="round" fill="none" />
          <circle cx={120} cy={213} r={3.5} fill="#f5f1ea" />
          <circle cx={140} cy={213} r={3.5} fill="#f5f1ea" />
          <rect x={112} y={214} width={36} height={22} rx={6} fill="none" stroke={clothDark} strokeWidth={3} />
        </g>
      )}

      {/* موی پشت (زیر پوشش سر مخفی می‌شود) */}
      {!hasCovering && hairRenderer.back(hairColors)}

      {/* گوش‌ها */}
      <g fill={skin}>
        <ellipse cx={faceGeometry.ears[0]} cy={110} rx={8} ry={12} />
        <ellipse cx={faceGeometry.ears[1]} cy={110} rx={8} ry={12} />
      </g>

      {/* صورت */}
      <g fill={skin}>{faceGeometry.face}</g>

      {/* ریش و سبیل (زیر پوشش سر فقط برای کلاه منطقی است اما چادر صورت را باز می‌گذارد) */}
      <FacialHair style={cfg.facialHair} color={hairColor} />

      {/* ابرو، چشم، بینی، دهان */}
      <Brows style={cfg.brows} color={browColor} />
      <Eyes style={cfg.eyes} color={eyeColor} />
      <Nose style={cfg.nose} color={skinShadow} />
      <Mouth style={cfg.mouth} />

      {/* موی جلو */}
      {!hasCovering && hairRenderer.front(hairColors)}

      {/* پوشش سر */}
      {hasCovering &&
        (isCap ? (
          <Cap fill={coveringColor} dark={shade(coveringColor, -0.2)} />
        ) : (
          <CoveredHead fill={coveringColor} dark={shade(coveringColor, -0.2)} variant={cfg.covering} />
        ))}

      {/* اکسسوری‌ها */}
      {cfg.accessories.includes('glasses-round') && (
        <Glasses style="glasses-round" earX={faceGeometry.ears} />
      )}
      {cfg.accessories.includes('glasses-square') && (
        <Glasses style="glasses-square" earX={faceGeometry.ears} />
      )}
      {cfg.accessories.includes('earrings') && <Earrings earX={faceGeometry.ears} />}
      {cfg.accessories.includes('stethoscope') && <Stethoscope />}
    </svg>
  );
}
