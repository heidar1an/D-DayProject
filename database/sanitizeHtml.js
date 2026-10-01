/*
 * پاک‌ساز HTML — تک منبع حقیقت برای سرور و کلاینت.
 *
 * چرا اینجا؟ چون هم لایهٔ دادهٔ سرور (قبل از ذخیره) و هم پیش‌نمایش پنل (سمت مرورگر)
 * باید از یک قاعدهٔ واحد تبعیت کنند؛ نگه‌داشتن دو نسخه یعنی دو رفتار متفاوت.
 *
 * رویکرد: پیمایش تگ‌به‌تگ با allow-list. هر تگی که در فهرست سفید نیست حذف می‌شود
 * (نه escape) و از هر تگ مجاز فقط attributeهای مجاز عبور می‌کنند. `on*`، `style`،
 * `srcdoc` و پروتکل‌های خطرناک در href/src هرگز عبور نمی‌کنند.
 *
 * این ماژول وابستگی ندارد تا هم در Node و هم در باندل مرورگر قابل import باشد.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'ul', 'ol', 'li',
  'a', 'img', 'figure', 'figcaption',
  'code', 'pre', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'span', 'div', 'sup', 'sub',
]);

const ALLOWED_ATTRS = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
  th: ['colspan', 'rowspan', 'scope'],
  td: ['colspan', 'rowspan'],
  ol: ['start', 'type'],
  '*': ['class', 'dir'],
};

/* تگ‌هایی که کل محتوایشان باید دور ریخته شود، نه فقط خودشان */
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|form|template|noscript|svg|math)\b[\s\S]*?<\/\1\s*>/gi;
const DROP_VOID = /<\/?(script|style|iframe|object|embed|form|template|noscript|svg|math|link|meta|base)\b[^>]*>/gi;
const DROP_COMMENT = /<!--[\s\S]*?-->/g;

const SAFE_URL = /^(https?:|mailto:|tel:|\/|\.\/|\.\.\/|#|data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,)/i;
const ATTR_RE = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;

function cleanUrl(value) {
  const url = String(value ?? '').trim();
  if (!url) return '';
  /* حذف کاراکترهای کنترلی که برای دور زدن فیلتر استفاده می‌شوند */
  const normalized = url.replace(/[\u0000-\u001f\u007f\s]/g, (char) => (char === ' ' ? ' ' : ''));
  return SAFE_URL.test(normalized) ? url : '';
}

function buildAttrs(tag, rawAttrs) {
  const allowed = ALLOWED_ATTRS[tag] ?? [];
  const common = ALLOWED_ATTRS['*'];
  const out = [];
  /* `rel` نوشتهٔ نویسنده جدا نگه داشته می‌شود تا با `rel` امنِ افزوده‌شده قاطی نشود */
  let authorRel = '';

  ATTR_RE.lastIndex = 0;
  let match;
  while ((match = ATTR_RE.exec(rawAttrs)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';

    if (name.startsWith('on') || name === 'style' || name === 'srcdoc') continue;
    if (!allowed.includes(name) && !common.includes(name)) continue;

    /*
     * `rel` هرگز در همین حلقه بیرون داده نمی‌شود. دلیل: اگر نوشتهٔ نویسنده `rel`
     * داشته باشد و بعد `rel` امنِ ما هم اضافه شود، HTML **دو** `rel` می‌گیرد و
     * مرورگر اولی را می‌خواند ⇒ `rel` امن بی‌اثر می‌شد. ضمناً پاک‌سازی
     * idempotent نمی‌ماند (هر بار یک `rel` تازه).
     */
    if (name === 'rel') {
      if (!authorRel) authorRel = String(value).replace(/"/g, '&quot;');
      continue;
    }

    if (name === 'href' || name === 'src') {
      const safe = cleanUrl(value);
      if (!safe) continue;
      out.push(`${name}="${safe.replace(/"/g, '&quot;')}"`);
      continue;
    }

    if (name === 'target') {
      out.push('target="_blank"');
      continue;
    }

    if (name === 'width' || name === 'height' || name === 'colspan' || name === 'rowspan' || name === 'start') {
      const numeric = String(value).replace(/\D/g, '').slice(0, 5);
      if (numeric) out.push(`${name}="${numeric}"`);
      continue;
    }

    out.push(`${name}="${String(value).replace(/"/g, '&quot;')}"`);
  }

  /*
   * لینک با `target` همیشه `rel` امن می‌گیرد (و `rel` نویسنده دور ریخته می‌شود).
   * بدون `target`، `rel` نویسنده دست‌نخورده می‌ماند ⇒ رفتار پیشین حفظ می‌شود.
   */
  if (tag === 'a') {
    if (out.some((attr) => attr.startsWith('target='))) out.push('rel="noopener noreferrer nofollow"');
    else if (authorRel) out.push(`rel="${authorRel}"`);
  }

  return out.length ? ` ${out.join(' ')}` : '';
}

export function sanitizeHtml(input) {
  if (typeof input !== 'string' || !input) return '';

  let html = input
    .replace(DROP_COMMENT, '')
    .replace(DROP_WITH_CONTENT, '')
    .replace(DROP_VOID, '');

  let output = '';
  let lastIndex = 0;
  let match;

  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(html)) !== null) {
    /* متن بین دو تگ: فقط `<` سرگردان خنثی می‌شود (entities دست‌نخورده می‌مانند) */
    output += html.slice(lastIndex, match.index).replace(/</g, '&lt;');
    lastIndex = match.index + match[0].length;

    const [, closing, rawTag, rawAttrs, selfClosing] = match;
    const tag = rawTag.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) continue;

    if (closing === '/') {
      if (tag !== 'br' && tag !== 'hr' && tag !== 'img') output += `</${tag}>`;
      continue;
    }

    if (tag === 'br' || tag === 'hr') {
      output += `<${tag}>`;
      continue;
    }

    output += `<${tag}${buildAttrs(tag, rawAttrs)}${selfClosing ? ' /' : ''}>`;
  }

  output += html.slice(lastIndex).replace(/</g, '&lt;');

  return output.trim();
}

/* متن ساده از HTML — برای excerpt، متادیتا و جست‌وجو */
export function htmlToText(input) {
  return String(input ?? '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/* بریدن امن متن برای خلاصه */
export function buildExcerpt(html, maxLength = 200) {
  const text = htmlToText(html);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}
