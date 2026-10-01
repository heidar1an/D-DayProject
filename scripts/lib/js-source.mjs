/*
 * ابزار مشترک خواندنِ منبعِ JavaScript بدون اجرای آن — پایهٔ ابزارهای ممیزی.
 *
 * چرا ماژول جدا: `scripts/api-input-audit.mjs` و `scripts/api-contract.mjs` هر دو
 * به «استخراج آرایهٔ ROUTES از سورس» نیاز دارند. نگه‌داشتن دو نسخه از همان
 * پارسر، همان کلاس باگی را می‌سازد که یک بار ممیزی را غلط کرد
 * (گرفتن آکولادِ الگوی تخریب پارامتر به‌جای بدنهٔ تابع).
 *
 * ⚠️ این ماژول **ایستا** است: کد را می‌خواند، اجرا نمی‌کند.
 */

/** از اندیس `[` شروع، تا `]` متناظر — با ردیابی عمق، نادیده‌گرفتن رشته و کامنت. */
export function matchBracket(text, start) {
  let depth = 0;
  let index = start;
  let quote = null;

  while (index < text.length) {
    const char = text[index];
    if (quote) {
      if (char === '\\') { index += 2; continue; }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; index += 1; continue; }
    if (char === '/' && text[index + 1] === '/') {
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (char === '/' && text[index + 1] === '*') {
      index += 2;
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) index += 1;
      index += 2;
      continue;
    }
    if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) return index;
    }
    index += 1;
  }
  return -1;
}

/**
 * آکولادِ **بدنهٔ** تابع را پیدا می‌کند — نه آکولادِ الگوی تخریب پارامتر.
 *
 * ⚠️ باگِ کشف‌شده: `text.indexOf('{', hit.index)` برای تابعی مثل
 * `export function replyInboxItem(id, { text } = {}) {` آکولاد پارامتر را
 * «بدنه» می‌گرفت و هر تابع پارامتر-تخریبی کاذب «بدون اعتبارسنجی» گزارش می‌شد.
 */
export function bodyBraceIndex(text, from) {
  let depth = 0;
  let quote = null;
  for (let i = from; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === '\\') { i += 1; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i += 1; continue; }
    if (char === '/' && text[i + 1] === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1; i += 1; continue; }
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === '{' && depth === 0) return i;
    else if (char === ';' && depth === 0) return -1;
  }
  return -1;
}

/** بدنهٔ یک تابع نام‌دار را از متن بیرون می‌کشد (با ردیابی آکولاد). */
export function functionBody(text, name) {
  const patterns = [
    new RegExp(`(?:^|\\n)\\s*export\\s+(?:async\\s+)?function ${name}\\s*\\(`),
    new RegExp(`(?:^|\\n)\\s*(?:async\\s+)?function ${name}\\s*\\(`),
    new RegExp(`(?:^|\\n)\\s*export\\s+const ${name}\\s*=\\s*(?:async\\s*)?\\(?`),
    new RegExp(`(?:^|\\n)\\s*const ${name}\\s*=\\s*(?:async\\s*)?\\(?`),
  ];
  for (const pattern of patterns) {
    const hit = pattern.exec(text);
    if (!hit) continue;
    const braceStart = bodyBraceIndex(text, hit.index);
    if (braceStart === -1) continue;
    let depth = 0;
    let index = braceStart;
    let quote = null;
    while (index < text.length) {
      const char = text[index];
      if (quote) {
        if (char === '\\') { index += 2; continue; }
        if (char === quote) quote = null;
        index += 1;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') { quote = char; index += 1; continue; }
      if (char === '/' && text[index + 1] === '/') { while (index < text.length && text[index] !== '\n') index += 1; continue; }
      if (char === '/' && text[index + 1] === '*') { index += 2; while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) index += 1; index += 2; continue; }
      if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) return text.slice(braceStart, index + 1);
      }
      index += 1;
    }
  }
  return '';
}

/** نگاشت نام تابع import‌شده → ماژول (فقط مسیرهای نسبی). */
export function importMap(source) {
  const map = new Map();
  for (const block of source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*'([^']+)'/g)) {
    const modulePath = block[2];
    if (!modulePath.startsWith('./') && !modulePath.startsWith('../')) continue;
    for (const raw of block[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (name) map.set(name, modulePath);
    }
  }
  return map;
}

/**
 * استخراج آرایهٔ روت‌ها از الگوی `const NAME = [ [..], [..] ]`.
 *
 * هر عضو یک آرایه است؛ `matchBracket` عمق را دنبال می‌کند پس `[` داخل رشته
 * (مثل `['GET', '/a/[x]']`) آرایه را نمی‌شکند.
 *
 * @param {string} source متن فایل
 * @param {string} constName نام ثابت (مثلاً `ROUTES`)
 * @returns {{method: string, pattern: string, permission: string|null, rest: string}[]}
 */
export function extractRouteTable(source, constName) {
  const declaration = source.indexOf(`const ${constName} = [`);
  if (declaration === -1) return [];
  const bodyStart = source.indexOf('[', declaration);
  const bodyEnd = matchBracket(source, bodyStart);
  if (bodyEnd === -1) return [];

  const body = source.slice(bodyStart + 1, bodyEnd);
  const routes = [];
  let cursor = 0;

  while (cursor < body.length) {
    const open = body.indexOf('\n  [', cursor);
    if (open === -1) break;
    const entryStart = open + 3;
    const entryEnd = matchBracket(body, entryStart);
    if (entryEnd === -1) break;

    const entry = body.slice(entryStart + 1, entryEnd);
    const method = entry.match(/^\s*'([A-Z]+)'/)?.[1] ?? '?';
    const patternHit = /,\s*'([^']+)'/.exec(entry);
    const pattern = patternHit?.[1] ?? '?';

    const afterPattern = patternHit ? entry.slice(patternHit.index + patternHit[0].length) : '';
    const permissionHit = /^\s*,\s*(null|'[^']*'|true|false)/.exec(afterPattern);
    const rawPermission = permissionHit?.[1] ?? '?';
    const permission = rawPermission === 'null' ? null
      : rawPermission === 'true' ? true
        : rawPermission === 'false' ? false
          : rawPermission.replace(/'/g, '');

    const arrow = entry.indexOf('=>');
    routes.push({ method, pattern, permission, rest: arrow === -1 ? entry : entry.slice(arrow) });
    cursor = entryEnd + 1;
  }

  return routes;
}

/**
 * استخراج الگوهای یک آرایهٔ **دوتایی** — `[pattern, handler]` بدون متد.
 *
 * چرا جدا از `extractRouteTable`: در `PUBLIC_ROUTES` عضو اول یک **مسیر** است،
 * نه متد. اگر با پارسر چهارتایی خوانده شود، اولین رشتهٔ داخل بدنهٔ هندلر
 * (مثل `'صفحه پیدا نشد'`) به‌جای مسیر برداشته می‌شود.
 */
export function extractPatternList(source, constName) {
  const declaration = source.indexOf(`const ${constName} = [`);
  if (declaration === -1) return [];
  const bodyStart = source.indexOf('[', declaration);
  const bodyEnd = matchBracket(source, bodyStart);
  if (bodyEnd === -1) return [];

  const body = source.slice(bodyStart + 1, bodyEnd);
  const patterns = [];
  let cursor = 0;

  while (cursor < body.length) {
    const open = body.indexOf('\n  [', cursor);
    if (open === -1) break;
    const entryStart = open + 3;
    const entryEnd = matchBracket(body, entryStart);
    if (entryEnd === -1) break;

    const entry = body.slice(entryStart + 1, entryEnd);
    const first = /^\s*'([^']+)'/.exec(entry);
    if (first) patterns.push(first[1]);
    cursor = entryEnd + 1;
  }

  return patterns;
}

/**
 * استخراج روت‌های «مقایسهٔ مستقیم مسیر» — الگوی `path === '/x'` و
 * `pathname === '/y'` که در `usersApi.js` و `googleAuth.js` به‌کار رفته است.
 */
export function extractComparedPaths(source, variableNames = ['path', 'pathname']) {
  const found = new Set();
  for (const variable of variableNames) {
    const re = new RegExp(`${variable}\\s*===\\s*'([^']+)'`, 'g');
    for (const hit of source.matchAll(re)) found.add(hit[1]);
  }
  return [...found];
}
