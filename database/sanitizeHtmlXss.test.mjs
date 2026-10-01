/*
 * رگرسیون XSS برای پاک‌ساز HTML — `database/sanitizeHtml.js`.
 *
 * چرا وجود دارد: ممیزی فاز ۲۲.۵ خواستار تست sanitizer با payloadهای خصمانه بود و
 * «۶ نقطهٔ dangerouslySetInnerHTML» به‌عنوان ریسک باز ثبت شده بود. تا پیش از این
 * فایل، تست XSS فقط در `testBankSecurity.test.mjs` و به‌صورت متمرکز وجود داشت.
 *
 * این فایل دو چیز را می‌سنجد:
 *   ۱) **رفتار پاک‌ساز** روی یک پیکرهٔ خصمانه (bypassهای شناخته‌شدهٔ XSS).
 *   ۲) **ساختار مصرف‌کننده‌ها** — هر `dangerouslySetInnerHTML` در فایل‌های jsx زیر `src/`
 *      باید از خروجی `sanitizeHtml` تغذیه شود. استثناها صریح فهرست شده‌اند؛
 *      افزودن sink تازهٔ بی‌پاک‌ساز ⇒ شکست. (این تست sinkها را نمی‌سازد، فقط
 *      رگرسیون ساختاری می‌گیرد.)
 *
 * اجرا: `node --test database/sanitizeHtmlXss.test.mjs`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sanitizeHtml, htmlToText, buildExcerpt } from './sanitizeHtml.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC = join(ROOT, 'src');

/*
 * ناورداییِ سنجیده‌شده: خروجی پاک‌ساز = **متن** (که همهٔ `<`هایش به `&lt;` تبدیل
 * شده) + **فقط** تگ‌های خوش‌ساختِ فهرست سفید. پس اگر هیچ `<` سرگردانی نماند،
 * هر `onerror=`/`style=`/`javascript:` باقی‌مانده صرفاً متن بی‌اثر است.
 *
 * چرا این‌طور سنجیده می‌شود و نه با یک regex ساده روی کل خروجی: باگ واقعیِ کشف‌شده
 * دقیقاً همین بود که یک regex ساده «نشت» را از «متن escapeشده» تفکیک نمی‌کرد.
 */
const ALLOWED_OUT = new Set([
  'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'ul', 'ol', 'li',
  'a', 'img', 'figure', 'figcaption',
  'code', 'pre', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'span', 'div', 'sup', 'sub',
]);

const OUT_TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
const DANGEROUS_ATTR = /\bon[a-z]+\s*=|\bstyle\s*=|\bsrcdoc\s*=|\bformaction\s*=|\bjavascript\s*:|\bvbscript\s*:|data\s*:\s*text\/html/i;

function auditOutput(out) {
  const problems = [];
  let text = '';
  let last = 0;
  let match;

  OUT_TAG_RE.lastIndex = 0;
  while ((match = OUT_TAG_RE.exec(out)) !== null) {
    text += out.slice(last, match.index);
    last = match.index + match[0].length;

    const tag = match[2].toLowerCase();
    if (!ALLOWED_OUT.has(tag)) problems.push(`تگ غیرمجاز <${tag}> در: ${match[0]}`);
    if (DANGEROUS_ATTR.test(match[3] ?? '')) problems.push(`صفت خطرناک در <${tag}>: ${match[0]}`);
  }
  text += out.slice(last);

  if (text.includes('<')) problems.push(`\`<\` escape‌نشده در متن: ${text.slice(0, 140)}`);
  if (/<\s*(script|style|iframe|object|embed|svg|math|form|template|noscript)/i.test(out)) {
    problems.push(`تگ ممنوعه در خروجی: ${out.slice(0, 140)}`);
  }
  return problems;
}

/* پیکرهٔ خصمانه — هر ردیف یک تکنیک bypass شناخته‌شده */
const PAYLOADS = [
  ['تگ script ساده', '<script>alert(1)</script>'],
  ['script با صفت', '<script src="//evil.tld/x.js"></script>'],
  ['script خودبسته', '<script/>'],
  ['script با فاصله', '<script >alert(1)</script >'],
  ['script تودرتو', '<scr<script>ipt>alert(1)</script>'],
  ['script با شکست case', '<ScRiPt>alert(1)</sCrIpT>'],
  ['script بدون تگ بستن', '<script>alert(1)'],
  ['img onerror', '<img src=x onerror=alert(1)>'],
  ['img onerror با نقل‌قول', '<img src="x" onerror="alert(1)">'],
  ['img OnLoAd مختلط', '<IMG SRC=x OnLoAd=alert(1)>'],
  ['svg onload', '<svg onload=alert(1)>'],
  ['svg/onload خودبسته', '<svg/onload=alert(1)>'],
  ['iframe javascript', '<iframe src="javascript:alert(1)"></iframe>'],
  ['iframe srcdoc', '<iframe srcdoc="<script>alert(1)</script>"></iframe>'],
  ['object data', '<object data="javascript:alert(1)"></object>'],
  ['embed src', '<embed src="javascript:alert(1)">'],
  ['a javascript با تب', '<a href="java\tscript:alert(1)">x</a>'],
  ['a javascript با فاصلهٔ ابتدایی', '<a href="   javascript:alert(1)">x</a>'],
  ['a javascript با نویسهٔ کنترلی', '<a href="java\u0000script:alert(1)">x</a>'],
  ['a entity-encoded javascript', '<a href="&#106;avascript:alert(1)">x</a>'],
  ['a vbscript', '<a href="vbscript:msgbox(1)">x</a>'],
  ['img data:text/html', '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">'],
  ['div style با url javascript', '<div style="background:url(javascript:alert(1))">x</div>'],
  ['div onclick', '<div onclick="alert(1)">x</div>'],
  ['math + mglyph mXSS', '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>'],
  ['noscript mXSS', '<noscript><p title="</noscript><img src=x onerror=alert(1)>">'],
  ['کامنت با شرط', '<!--<script>alert(1)</script>-->'],
  ['کامنت مشروط IE', '<!--[if IE]><script>alert(1)</script><![endif]-->'],
  ['template', '<template><script>alert(1)</script></template>'],
  ['form action', '<form action="javascript:alert(1)"><input name=x></form>'],
  ['صفت بدون نقل‌قول با تزریق', '<div class=a"onmouseover=alert(1)>x</div>'],
  /* ── دور زدنِ کشف‌شده در همین تست (نقل‌قول بازِ بدون بستن) ──
     `TAG_RE` تگی که نقل‌قول بسته‌نشده دارد را نمی‌گیرد، پس تگ «متن» می‌شد و
     `<` آن escape نمی‌شد ⇒ خروجی **بایت‌به‌بایت** ورودی و `onerror` زنده. */
  ['img با نقل‌قول بازِ بدون بستن', '<img src=x onerror=alert(1) title="unclosed>'],
  ['img با نقل‌قول تکی بازِ بدون بستن', "<img src=x onerror=alert(1) title='unclosed>"],
  ['div با نقل‌قول بازِ بدون بستن', '<div onmouseover=alert(1) title="unclosed>x</div>'],
  ['a با نقل‌قول بازِ بدون بستن', '<a href="https://ok.tld" onclick=alert(1) title="unclosed>x</a>'],
  ['تگ با `=` در مقدار بی‌نقل‌قول', '<img src=x onerror=alert(1) data-a=b>'],
  ['`<` سرگردان قبل از حرف', 'a<b'],
  ['`<` سرگردان قبل از اسلش', 'a</b'],
  ['تگ ناشناس با هندلر', '<foo bar=1 onmouseover=alert(1)>x</foo>'],
  ['a target با rel ناامن', '<a href="https://ok.tld" target="_blank">x</a>'],
  ['متن خالص (کنترل منفی)', '<p>متن <strong>سالم</strong></p>'],
  ['a با آدرس مجاز', '<a href="https://ok.tld/p">x</a>'],
  ['img با آدرس مجاز', '<img src="/uploads/a.png" alt="تصویر">'],
];

test('پیکرهٔ خصمانه: هیچ الگوی خطرناکی از پاک‌ساز عبور نمی‌کند', () => {
  const leaks = [];
  for (const [name, payload] of PAYLOADS) {
    for (const problem of auditOutput(sanitizeHtml(payload))) {
      leaks.push(`${name} ⇒ ${problem}`);
    }
  }
  assert.deepEqual(leaks, [], `نشت از پاک‌ساز:\n${leaks.join('\n')}`);
});

test('هیچ payload خصمانه‌ای بایت‌به‌بایت از پاک‌ساز رد نمی‌شود', () => {
  const passedThrough = [];
  for (const [name, payload] of PAYLOADS) {
    const out = sanitizeHtml(payload);
    /* پیکرهٔ سالم (کنترل منفی / «مجاز») باید دست‌نخورده بماند؛ بقیه نه */
    const isControl = name.includes('کنترل منفی') || name.includes('مجاز');
    if (isControl) {
      if (out !== payload) passedThrough.push(`کنترل منفی تغییر کرد: ${name}`);
    } else if (out === payload) {
      passedThrough.push(`بدون تغییر از پاک‌ساز گذشت: ${name}`);
    }
  }
  assert.deepEqual(passedThrough, [], passedThrough.join('\n'));
});

test('پاک‌ساز idempotent است (اجرای دوباره خروجی را عوض نمی‌کند)', () => {
  const unstable = [];
  for (const [name, payload] of PAYLOADS) {
    const once = sanitizeHtml(payload);
    const twice = sanitizeHtml(once);
    if (once !== twice) unstable.push(`${name}:\n  ۱) ${once}\n  ۲) ${twice}`);
  }
  assert.deepEqual(unstable, [], `پاک‌سازی ناپایدار:\n${unstable.join('\n')}`);
});

test('ورودی غیررشته و خالی ⇒ رشتهٔ خالی', () => {
  for (const input of [null, undefined, 0, false, {}, [], '', NaN]) {
    assert.equal(sanitizeHtml(input), '', `ورودی ${String(input)}`);
  }
});

test('تگ مجاز می‌ماند و تگ غیرمجاز حذف می‌شود (نه escape)', () => {
  assert.match(sanitizeHtml('<p>سلام</p>'), /<p>سلام<\/p>/);
  assert.equal(sanitizeHtml('<blink>سلام</blink>'), 'سلام');
  assert.equal(sanitizeHtml('<h1>ت</h1><h2>ت</h2>'), '<h1>ت</h1><h2>ت</h2>');
});

test('فقط attributeهای فهرست سفید عبور می‌کنند', () => {
  const out = sanitizeHtml('<p id="x" data-y="z" class="ok" dir="rtl">t</p>');
  assert.match(out, /class="ok"/);
  assert.match(out, /dir="rtl"/);
  assert.doesNotMatch(out, /id=/);
  assert.doesNotMatch(out, /data-y=/);
});

test('آدرس‌های مجاز حفظ و آدرس‌های خطرناک حذف می‌شوند', () => {
  for (const safe of ['https://a.tld/x', 'http://a.tld/x', '/rel/path', '#anchor', 'mailto:a@b.tld', 'tel:+989120000000']) {
    assert.match(sanitizeHtml(`<a href="${safe}">x</a>`), /href=/, `باید حفظ شود: ${safe}`);
  }
  for (const unsafe of ['javascript:alert(1)', 'vbscript:x', 'data:text/html,<b>x</b>', '  javascript:alert(1)']) {
    assert.doesNotMatch(sanitizeHtml(`<a href="${unsafe}">x</a>`), /href=/, `باید حذف شود: ${unsafe}`);
  }
});

test('target بازنویسی و rel امن افزوده می‌شود', () => {
  const out = sanitizeHtml('<a href="https://ok.tld" target="_self">x</a>');
  assert.match(out, /target="_blank"/);
  assert.match(out, /rel="noopener noreferrer nofollow"/);
});

test('attribute عددی به رقم محدود می‌شود', () => {
  const out = sanitizeHtml('<td colspan="9a9"><img src="/a.png" width="12px" height="9999999"></td>');
  assert.match(out, /colspan="99"/);
  assert.match(out, /width="12"/);
  assert.match(out, /height="99999"/);
});

test('نویسهٔ `<` سرگردان در متن خنثی می‌شود ولی entityها دست‌نخورده می‌مانند', () => {
  assert.equal(sanitizeHtml('a < b'), 'a &lt; b');
  assert.equal(sanitizeHtml('a &amp; b'), 'a &amp; b');
  assert.equal(sanitizeHtml('&lt;script&gt;'), '&lt;script&gt;');
});

test('htmlToText محتوای script/style را دور می‌ریزد و تگ‌ها را پاک می‌کند', () => {
  const text = htmlToText('<p>س</p><script>alert(1)</script><style>a{}</style><b>ت</b>');
  assert.doesNotMatch(text, /alert|a\{\}|<|>/);
  assert.match(text, /س/);
  assert.match(text, /ت/);
});

test('buildExcerpt می‌برد و به HTML برنمی‌گردد', () => {
  const long = `<p>${'ا'.repeat(300)}</p>`;
  const out = buildExcerpt(long, 50);
  assert.equal(out.length, 51); /* ۵۰ نویسه + … */
  assert.doesNotMatch(out, /<p>/);
});

/* ─────────────── رگرسیون ساختاری روی نقاط رندر ─────────────── */

/*
 * استثناهای مستندشده: نقاطی که `dangerouslySetInnerHTML` می‌گیرند ولی در
 * **زمان رندر** دوباره پاک نمی‌شوند و به پاک‌سازیِ **مسیر نوشتن** (سرور) تکیه دارند.
 *
 * **اکنون خالی است.** تا پیش از این، `ContentBlocks.jsx` تنها استثنا بود
 * (`markHtml` مقدار را دست‌نخورده برمی‌گرداند)؛ حالا `block.html` پیش از
 * `markHtml` از `sanitizeHtml` می‌گذرد ⇒ هر ۵ sink رندر پاک‌سازی زمان‌رندر دارند.
 *
 * هر نقطهٔ تازه که به این فهرست اضافه شود ⇒ شکست تست ⇒ تصمیم صریح لازم است.
 */
const RENDER_TIME_SANITIZE_EXCEPTIONS = new Set([]);

function jsxFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) jsxFiles(full, out);
    else if (entry.name.endsWith('.jsx')) out.push(full);
  }
  return out;
}

test('هر sink رندر از خروجی sanitizeHtml تغذیه می‌شود (استثناها صریح‌اند)', () => {
  const unsanitized = [];
  let sinks = 0;

  for (const file of jsxFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    if (!source.includes('dangerouslySetInnerHTML')) continue;
    sinks += 1;

    const relative = file.slice(ROOT.length + 1).split('\\').join('/');
    const usesSanitizer =
      /sanitizeHtml\s*\(/.test(source) || /sanitizeHtml/.test(source.split('import')[0] ?? '');

    if (!usesSanitizer && !RENDER_TIME_SANITIZE_EXCEPTIONS.has(relative)) {
      unsanitized.push(relative);
    }
  }

  assert.ok(sinks >= 5, `انتظار ≥۵ sink رندر، دیده شد: ${sinks}`);
  assert.deepEqual(
    unsanitized,
    [],
    `نقاط رندر بدون پاک‌سازیِ زمان‌رندر و بدون استثنای مستند:\n${unsanitized.join('\n')}`,
  );
});

test('پل کلاینت همان ماژول سرور را بازصدور می‌کند (تک‌نسخه بودن پاک‌ساز)', () => {
  const bridge = readFileSync(join(SRC, 'services/admin/sanitizeHtml.js'), 'utf8');
  assert.match(bridge, /from '\.\.\/\.\.\/\.\.\/database\/sanitizeHtml\.js'/);
  assert.match(bridge, /export \{[\s\S]*sanitizeHtml[\s\S]*\}/);
});
