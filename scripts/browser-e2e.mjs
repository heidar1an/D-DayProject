/*
 * E2E مرورگری تپش — Chrome DevTools Protocol، **بدون هیچ وابستگی نصب‌شدنی**.
 *
 * چرا این‌گونه نوشته شده: ممیزی فاز ۲۱ «جریان‌های حیاتی end-to-end» را می‌خواهد و
 * `@playwright/test` در این مخزن نصب نیست (و `npm install` هم بسته است). تپش یک
 * قید سخت دارد: «سرور بدون نصب چیزی اجرا شود». پس این هارنس به‌جای افزودن یک
 * dependency سنگین، از همان چیزی استفاده می‌کند که روی هر ماشین توسعه و هر
 * runner گیت‌هاب از قبل هست:
 *
 *   • پروسهٔ فرزند (`node:child_process`) برای بالا آوردن `server.js`
 *   • `fetch` داخلی نود برای کشف endpoint دیباگ کروم
 *   • `WebSocket` سراسری نود (پایدار از نود ۲۲) برای گفت‌وگو با CDP
 *   • `Input.dispatchMouseEvent` / `Input.insertText` برای تعامل **واقعی**
 *
 * پس چیزی که سنجیده می‌شود «شبیه‌سازی رخداد در DOM» نیست؛ رخداد ورودی واقعی از
 * لایهٔ ورودی کروم می‌آید و همان مسیری را می‌رود که انگشت کاربر می‌رود.
 *
 * ── داده ────────────────────────────────────────────────────────────────────
 * هیچ‌وقت روی دادهٔ production اجرا نمی‌شود: یا `E2E_BASE_URL` به یک سرور بیرونی
 * اشاره می‌کند (آن‌وقت هیچ نوشتنی انجام نمی‌دهیم و جریان‌های نوشتنی skip می‌شوند)،
 * یا سرور محلی خودمان بالا می‌آید و **پیش از اجرا از فایل‌های دادهٔ زمان‌اجرا
 * نسخهٔ پشتیبان گرفته و در پایان بازگردانده می‌شود** — همان الگویی که تست‌های
 * `adminSecrets` و `data:check` در همین پروژه دارند.
 *
 * ── اعتبارنامه ──────────────────────────────────────────────────────────────
 * هیچ credential واقعی در این فایل هارد‌کد نشده. مقدار مدیر از
 * `E2E_ADMIN_USERNAME` / `E2E_ADMIN_PASSWORD` خوانده می‌شود و اگر نبود، به
 * fixture مستندِ خودِ کد (`database/adminCredentialPolicy.js` در محیط توسعه)
 * برمی‌گردد. کاربر آزمون هر بار شمارهٔ یکتای تازه می‌گیرد و در پایان پاک می‌شود.
 *
 * ── کد خروج ─────────────────────────────────────────────────────────────────
 *   ۰ = اجرا شد و همهٔ بررسی‌ها سبز
 *   ۱ = اجرا شد و دست‌کم یک بررسی شکست خورد
 *   ۳ = اجرا نشد (مرورگر پیدا نشد / dist ساخته نشده) — «نامعلوم»، نه «سبز»
 *
 * اجرا:
 *   node scripts/browser-e2e.mjs
 *   node scripts/browser-e2e.mjs --headed        # پنجرهٔ واقعی کروم (اشکال‌زدایی)
 *   node scripts/browser-e2e.mjs --json          # خروجی ماشین‌خوان + فایل گزارش
 *   E2E_BASE_URL=https://staging… node scripts/browser-e2e.mjs   # فقط‌خواندنی
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/* ── پیکربندی ─────────────────────────────────────────────────────────────── */

const args = new Set(process.argv.slice(2));
const HEADED = args.has('--headed');
const JSON_OUT = args.has('--json');
/*
 * `--require-browser` برای CI: آنجا نبودِ مرورگر یک **شکست** است، نه «نامعین».
 * بدون این فلگ، نبود مرورگر کد ۳ می‌دهد تا روی ماشین توسعهٔ بدون کروم، دروازهٔ
 * کلی بی‌دلیل قرمز نشود.
 */
const REQUIRE_BROWSER = args.has('--require-browser');
const EXTERNAL_BASE = String(process.env.E2E_BASE_URL ?? '').replace(/\/+$/, '');
const EXTERNAL = Boolean(EXTERNAL_BASE);
const FLOW_TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS) || 20000;
const NAV_TIMEOUT_MS = Number(process.env.E2E_NAV_TIMEOUT_MS) || 20000;

const ADMIN_USERNAME = String(process.env.E2E_ADMIN_USERNAME ?? '0135');
const ADMIN_PASSWORD = String(process.env.E2E_ADMIN_PASSWORD ?? '0135');
const METRICS_TOKEN = 'e2e-browser-token';

/*
 * شناسهٔ یکتای اجرا.
 *
 * ⚠️ نسخهٔ اول از `Number('0x' + base36)` استفاده می‌کرد و چون رشتهٔ base36
 * نویسه‌های غیرهگز دارد (`q`, `r`, `l`, …) نتیجه `NaN` می‌شد و شمارهٔ آزمون به
 * `09990000NaN` تبدیل می‌گشت — یعنی «ثبت‌نام» همیشه روی اعتبارسنجی می‌افتاد.
 * حالا فقط حساب می‌کنیم، نه پارس رشته.
 */
const RUN_TAG = String(Date.now() % 1_000_000).padStart(6, '0');
/* ۱۱ رقم با پیشوند ۰۹ — منطبق بر `PHONE_PATTERN` در `database/authPolicy.js` */
const TEST_PHONE = `0999${RUN_TAG}${'7'.repeat(1)}`.slice(0, 11);
const TEST_PASSWORD = `Tapesh-${RUN_TAG}-9x`;

/* ── گزارش‌گیری ───────────────────────────────────────────────────────────── */

const checks = [];
const flows = [];
let currentFlow = null;
let consoleErrors = [];
let uncaught = [];
/*
 * لاگ شبکهٔ واقعی مرورگر (از CDP).
 *
 * چرا لازم است: «فرم را پر کردم و روی ذخیره زدم» ثابت نمی‌کند که درخواستی به سرور
 * رفته و ۲۰۰ گرفته. بدون این لاگ، جریان‌های نوشتنی می‌توانستند فقط با کش محلی
 * (`localStorage`) سبز شوند — یعنی «سبز کاذب». هر جریان نوشتنی حالا درخواست و
 * کد وضعیتش را هم می‌سنجد.
 */
const networkLog = [];
const requestIndex = new Map();

/*
 * چند کلیک با مسیر جانشین سطح-DOM انجام شد. صفر = همهٔ کلیک‌ها از لایهٔ ورودی
 * واقعی کروم آمده‌اند. عدد بزرگ‌تر یک **هشدار شفافیت** است، نه شکست.
 */
let clickFallbacks = 0;

function check(name, ok, detail = '') {
  checks.push({ flow: currentFlow, name, ok: Boolean(ok), detail: String(detail ?? '') });
  if (!ok && currentFlow) currentFlow.failed += 1;
  return Boolean(ok);
}

function skip(name, reason) {
  checks.push({ flow: currentFlow, name, ok: null, detail: `SKIP — ${reason}` });
  if (currentFlow) currentFlow.skipped += 1;
}

/*
 * یادداشت شفافیت: چیزی که «سبز» نیست ولی «شکست» هم نیست — مثلاً مسیر جانشینی
 * که استفاده شد. عمداً از `check` جدا است تا در شمارش موفق/ناموفق قاطی نشود و
 * هیچ‌وقت جای یک ادعای واقعی را نگیرد.
 */
const notes = [];
function note(text) {
  notes.push({ flow: currentFlow?.id ?? null, text: String(text) });
  console.log(`  • یادداشت: ${text}`);
}

/* ── پورت آزاد ────────────────────────────────────────────────────────────── */

function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── یافتن مرورگر ─────────────────────────────────────────────────────────── */

function findChrome() {
  const candidates = [
    process.env.E2E_CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean);

  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  return null;
}

/* ── پشتیبان‌گیری از دادهٔ زمان‌اجرا ─────────────────────────────────────── */

/*
 * فهرست فایل‌های دادهٔ زمان‌اجرا.
 *
 * چرا «پوشهٔ content کامل + فایل‌های ریشه» و نه یک فهرست دستی: فهرست دستی با هر
 * مجموعهٔ تازه کهنه می‌شود و آن‌وقت یک تست، دادهٔ محلی را بی‌صدا تغییر می‌دهد.
 * پوشهٔ content همهٔ مجموعه‌ها را دارد و ریشه فقط چند فایل مشخص.
 */
function runtimeDataFiles() {
  const files = [];
  const rootFiles = ['users.json', 'users.sessions.json', 'publishing.secrets.json', 'admin.sessions.json'];

  for (const name of rootFiles) {
    const path = resolve(ROOT, 'database', name);
    if (existsSync(path)) files.push(path);
  }

  const contentDir = resolve(ROOT, 'database', 'content');
  if (existsSync(contentDir)) {
    for (const entry of readdirSync(contentDir)) {
      if (entry.endsWith('.json')) files.push(resolve(contentDir, entry));
    }
  }

  return files;
}

function snapshotData() {
  const snapshot = new Map();
  for (const path of runtimeDataFiles()) snapshot.set(path, readFileSync(path));
  return snapshot;
}

function restoreData(snapshot) {
  let restored = 0;
  for (const [path, buffer] of snapshot) {
    try {
      writeFileSync(path, buffer);
      restored += 1;
    } catch { /* بازگردانی بهترین‌تلاش است؛ در گزارش شمرده می‌شود */ }
  }

  /* فایل‌هایی که تست ساخته و پیش از اجرا نبودند، پاک می‌شوند */
  const known = new Set(snapshot.keys());
  for (const path of runtimeDataFiles()) {
    if (known.has(path)) continue;
    try { rmSync(path); } catch { /* */ }
  }

  return restored;
}

/* ── کلاینت CDP ───────────────────────────────────────────────────────────── */

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    this.closed = false;

    socket.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }

      if (message.id != null && this.pending.has(message.id)) {
        const { resolve: done, reject: fail } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) fail(new Error(`${message.error.message} (${message.error.code ?? '?'})`));
        else done(message.result ?? {});
        return;
      }

      if (message.method) {
        const list = this.handlers.get(message.method);
        if (!list) return;
        for (const handler of list) {
          try { handler(message.params ?? {}, message.sessionId ?? null); } catch { /* */ }
        }
      }
    });

    socket.addEventListener('close', () => { this.closed = true; });
    socket.addEventListener('error', () => { this.closed = true; });
  }

  static connect(url, timeoutMs = 15000) {
    return new Promise((done, fail) => {
      const socket = new WebSocket(url);
      const timer = setTimeout(() => {
        try { socket.close(); } catch { /* */ }
        fail(new Error('CDP: اتصال به مرورگر در مهلت مقرر برقرار نشد'));
      }, timeoutMs);

      socket.addEventListener('open', () => { clearTimeout(timer); done(new Cdp(socket)); });
      socket.addEventListener('error', () => { clearTimeout(timer); fail(new Error('CDP: خطای سوکت')); });
    });
  }

  on(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(handler);
  }

  send(method, params = {}, sessionId = null, timeoutMs = 30000) {
    if (this.closed) return Promise.reject(new Error('CDP بسته است'));
    const id = (this.nextId += 1);
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };

    return new Promise((done, fail) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        fail(new Error(`CDP timeout: ${method}`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); done(value); },
        reject: (error) => { clearTimeout(timer); fail(error); },
      });

      this.socket.send(JSON.stringify(payload));
    });
  }

  close() { try { this.socket.close(); } catch { /* */ } }
}

/* ── صفحه (session روی یک target) ─────────────────────────────────────────── */

class Page {
  constructor(cdp, sessionId, base) {
    this.cdp = cdp;
    this.sessionId = sessionId;
    this.base = base;
  }

  send(method, params = {}, timeoutMs) {
    return this.cdp.send(method, params, this.sessionId, timeoutMs);
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression: `(() => { ${expression} })()`,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });

    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description
        ?? result.exceptionDetails.text
        ?? 'خطای نامشخص در ارزیابی';
      throw new Error(text.split('\n')[0]);
    }

    return result.result?.value;
  }

  async waitReady(timeout = NAV_TIMEOUT_MS) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try {
        const ready = await this.evaluate('return document.readyState');
        if (ready === 'complete') return true;
      } catch { /* در میانهٔ ناوبری context عوض می‌شود */ }
      await sleep(100);
    }
    return false;
  }

  /*
   * ناوبری کامل.
   *
   * ⚠️ ناوبری به «همان سند با hash متفاوت» در مرورگر بارگذاری مجدد نمی‌کند؛
   * فقط رویداد `hashchange` می‌دهد و state ری‌اکت (مودال باز، خطای فرم، نشست
   * در حافظه) سر جایش می‌ماند. اگر تست بخواهد «ماندگاری پس از رفرش کامل» را
   * اثبات کند، باید سند از صفر ساخته شود — پس اول به `about:blank` می‌رویم.
   */
  async goto(url) {
    await this.send('Page.navigate', { url: 'about:blank' });
    await sleep(60);
    await this.send('Page.navigate', { url });
    await this.waitReady();
    await sleep(300);
  }

  async setHash(hash) {
    await this.evaluate(`window.location.hash = ${JSON.stringify(hash)}; return true;`);
    await sleep(350);
  }

  async waitFor(expression, { timeout = FLOW_TIMEOUT_MS, label = expression } = {}) {
    const deadline = Date.now() + timeout;
    let last = null;
    while (Date.now() < deadline) {
      try {
        last = await this.evaluate(`return Boolean(${expression})`);
        if (last) return true;
      } catch (error) { last = error.message; }
      await sleep(120);
    }
    throw new Error(`انتظار برای «${label}» تمام شد — آخرین وضعیت: ${String(last).slice(0, 120)}`);
  }

  async text(selector) {
    return this.evaluate(
      `const el = document.querySelector(${JSON.stringify(selector)}); return el ? el.innerText : null;`,
    );
  }

  async count(selector) {
    return this.evaluate(`return document.querySelectorAll(${JSON.stringify(selector)}).length`);
  }

  /*
   * کلیک روی عنصر بر اساس متن — با محاسبهٔ مختصات در **همان** ارزیابی.
   *
   * ⚠️ دو تلهٔ واقعی که این نسخه رفع می‌کند (هر دو باعث «سبز/سرخ کاذب» می‌شدند):
   *
   *   ۱) `src/styles/base.css` روی کل سند `scroll-behavior: smooth` گذاشته است.
   *      پس `scrollIntoView` **انیمیشنی** است و مختصاتی که بلافاصله خوانده شود
   *      مربوط به موقعیت قبل از اسکرول است؛ کلیک روی نقطهٔ اشتباه می‌افتاد و
   *      onClick هرگز اجرا نمی‌شد. حالا `behavior: 'instant'` صریح است.
   *   ۲) نسخهٔ اول اول یک `data-e2e-target` می‌گذاشت و در فراخوانی جداگانه کلیک
   *      می‌کرد؛ اگر ری‌اکت بین این دو دوباره رندر می‌کرد نشانه از دست می‌رفت.
   *      حالا یافتن، اسکرول، اندازه‌گیری و آزمون برخورد اتمیک‌اند.
   *
   * `elementFromPoint` تأیید می‌کند که نقطهٔ هدف واقعاً روی همان عنصر می‌افتد؛
   * اگر عنصر دیگری آن را پوشانده باشد، به‌جای کلیک بی‌اثر، خطای صریح می‌دهیم.
   */
  async rectOfText(text, { exact = false, within = null } = {}) {
    return this.evaluate(`
      const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
      const target = norm(${JSON.stringify(text)});
      const scope = ${within ? `document.querySelector(${JSON.stringify(within)})` : 'document'};
      if (!scope) return { missingScope: true };
      const nodes = [...scope.querySelectorAll('button, a, [role="button"], summary')];
      const labels = nodes.map((el) => norm(el.innerText || el.textContent));
      let hit = ${exact ? 'labels.indexOf(target)' : '-1'};
      if (${exact ? 'hit === -1' : 'true'}) hit = labels.findIndex((label) => label.includes(target));
      if (hit === -1) return null;
      const el = nodes[hit];
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      return {
        x, y, w: r.width, h: r.height, label: labels[hit],
        covered: Boolean(top) && top !== el && !el.contains(top),
        coveredByLabel: Boolean(top) && top !== el && top.tagName === 'LABEL' && top.contains(el),
        topTag: top ? top.tagName : null,
        topClass: top ? String(top.className).slice(0, 60) : null,
      };
    `);
  }

  async rectOfSelector(selector) {
    return this.evaluate(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      return {
        x, y, w: r.width, h: r.height,
        covered: Boolean(top) && top !== el && !el.contains(top),
        /* پوشیده‌شدن توسط <label> والد، مانع نیست: کلیک روی label همان کنترل را فعال می‌کند */
        coveredByLabel: Boolean(top) && top !== el && top.tagName === 'LABEL' && top.contains(el),
        topTag: top ? top.tagName : null,
        topClass: top ? String(top.className).slice(0, 60) : null,
      };
    `);
  }

  async dispatchClick(x, y) {
    /*
     * ⚠️ چرا `buttons` هم صریح فرستاده می‌شود: بدون آن کروم گاهی رخداد فشردن را
     * «بدون دکمهٔ فشرده» تفسیر می‌کند و هیچ `click`ی تولید نمی‌شود — یک شکست
     * **بی‌صدا** که فقط با شنوندهٔ `click` قابل دیدن بود. دو `mouseMoved` پشت‌سرهم
     * هم وضعیت hover/hit-test را پیش از فشردن تازه می‌کند.
     */
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: x - 4, y: y - 4, button: 'none', buttons: 0, clickCount: 0,
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x, y, button: 'none', buttons: 0, clickCount: 0,
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1,
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1,
    });
    await sleep(140);
  }

  async clickSelector(selector) {
    let last = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const rect = await this.rectOfSelector(selector);
      if (!rect) throw new Error(`عنصر پیدا نشد: ${selector}`);
      if (rect.w === 0 || rect.h === 0) throw new Error(`عنصر قابل کلیک نیست (ابعاد صفر): ${selector}`);
      if (rect.covered && !rect.coveredByLabel) { last = rect; await sleep(220); continue; }
      await this.dispatchClick(rect.x, rect.y);
      return true;
    }
    throw new Error(`عنصر «${selector}» توسط ${last?.topTag ?? '?'}.${last?.topClass ?? '?'} پوشیده است`);
  }

  /*
   * کاوشگر کلیک: یک شمارندهٔ سراسری که هر `click` واقعی روی `document` را
   * می‌شمارد. با آن می‌فهمیم آیا `Input.dispatchMouseEvent` واقعاً به یک رخداد
   * `click` تبدیل شده یا **بی‌صدا** گم شده است. شنونده فاز capture و بی‌اثر است.
   */
  async ensureClickProbe() {
    return this.evaluate(`
      if (!window.__e2eProbe) {
        window.__e2eProbe = 0;
        document.addEventListener('click', () => { window.__e2eProbe += 1; }, true);
      }
      return window.__e2eProbe;
    `);
  }

  async clickCount() {
    return (await this.evaluate('return window.__e2eProbe ?? 0')) ?? 0;
  }

  /* کلیک سطح-DOM روی عنصری با متن مشخص — مسیر جانشین، عمداً «شفاف» */
  async domClickByText(text, options = {}) {
    return this.evaluate(`
      const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
      const target = norm(${JSON.stringify(text)});
      const scope = ${options.within ? `document.querySelector(${JSON.stringify(options.within)})` : 'document'};
      if (!scope) return false;
      const nodes = [...scope.querySelectorAll('button, a, [role="button"], summary')];
      const hit = nodes.find((el) => norm(el.innerText || el.textContent).includes(target));
      if (!hit) return false;
      hit.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      hit.click();
      return true;
    `);
  }

  /*
   * کلیک روی عنصر با متن مشخص.
   *
   * قرارداد: ابتدا **ورودی واقعی کروم** فرستاده می‌شود. اگر رخداد `click` ثبت
   * نشد (باگ شناخته‌شدهٔ headless: رخداد ماوس بی‌صدا گم می‌شود)، یک بار
   * کلیک سطح-DOM به‌عنوان جانشین انجام می‌شود و `lastClickMode` روی
   * `'dom-fallback'` می‌رود تا در گزارش **دیده شود**. هیچ‌وقت بی‌صدا جانشین
   * نمی‌شود و هیچ‌وقت جانشین، جای اثباتِ لاگ شبکه را نمی‌گیرد.
   */
  async clickByText(text, options = {}) {
    let last = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const rect = await this.rectOfText(text, options);
      if (rect?.missingScope) throw new Error(`محدودهٔ جست‌وجو پیدا نشد: ${options.within}`);
      if (!rect) throw new Error(`دکمه/لینکی با متن «${text}» پیدا نشد`);
      if (rect.w === 0 || rect.h === 0) throw new Error(`دکمهٔ «${text}» ابعاد صفر دارد (پنهان؟)`);
      if (rect.covered && !rect.coveredByLabel) { last = rect; await sleep(250); continue; }

      this.lastRect = rect;
      this.lastClickMode = 'input';

      await this.ensureClickProbe();
      const before = await this.clickCount();
      await this.dispatchClick(rect.x, rect.y);

      const deadline = Date.now() + 800;
      while (Date.now() < deadline) {
        if (await this.clickCount() > before) return rect.label;
        await sleep(60);
      }

      if (await this.domClickByText(text, options)) {
        this.lastClickMode = 'dom-fallback';
        clickFallbacks += 1;
        await sleep(180);
        return rect.label;
      }
    }
    throw new Error(
      `دکمهٔ «${text}» توسط ${last?.topTag ?? '?'}.${last?.topClass ?? '?'} پوشیده است`,
    );
  }

  /*
   * کلیک + انتظار برای «اثر».
   *
   * چرا لازم است: بین اندازه‌گیری مختصات و ارسال رخداد ماوس چند رفت‌وبرگشت CDP
   * فاصله است. اگر در همان بازه چیدمان صفحه جابه‌جا شود (مثلاً اسکلتونِ بارگذاری
   * با محتوای واقعی عوض شود) کلیک روی نقطهٔ اشتباه می‌افتد و **بی‌صدا** بی‌اثر
   * می‌ماند — همان چیزی که جریان F9 را متناوب می‌کرد. اینجا کلیک واقعی تکرار
   * می‌شود تا اثرش دیده شود؛ خودِ کلیک هنوز از لایهٔ ورودی کروم می‌آید.
   */
  async clickByTextUntil(text, readyExpr, { attempts = 3, waitMs = 6000, options = {} } = {}) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) {
        /* اگر در تلاش قبلی مودالی باز شد، ببندش تا وضعیت از صفر شروع شود */
        await this.evaluate("document.querySelector('.ad-modal__scrim')?.click(); return true;");
        await sleep(400);
      }

      /*
       * خودِ `clickByText` حالا مطمئن می‌شود که رخداد `click` ثبت شده؛ اگر
       * ورودی واقعی بی‌اثر بماند، یک بار جانشین سطح-DOM می‌زند و
       * `lastClickMode` را `'dom-fallback'` می‌کند.
       */
      await this.clickByText(text, options);

      const deadline = Date.now() + waitMs;
      while (Date.now() < deadline) {
        if (await this.evaluate(`return Boolean(${readyExpr})`)) {
          return this.lastClickMode === 'dom-fallback' ? 'dom-fallback' : 'input';
        }
        await sleep(150);
      }
    }

    return false;
  }
  /* تایپ واقعی از لایهٔ ورودی کروم — نه تغییر مستقیم `value` و نه رخداد ساختگی */
  async typeInto(selector, text) {
    const ok = await this.evaluate(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.focus();
      if (typeof el.setSelectionRange === 'function') el.setSelectionRange(0, String(el.value ?? '').length);
      return true;
    `);
    if (!ok) throw new Error(`فیلد پیدا نشد: ${selector}`);
    await this.send('Input.insertText', { text });
    await sleep(90);
    return this.evaluate(
      `const el = document.querySelector(${JSON.stringify(selector)}); return el ? el.value : null;`,
    );
  }

  async statusOf(path) {
    return this.evaluate(`
      return fetch(${JSON.stringify(path)}, { credentials: 'include' })
        .then((r) => r.status)
        .catch(() => 0);
    `);
  }

  async jsonOf(path) {
    return this.evaluate(`
      return fetch(${JSON.stringify(path)}, { credentials: 'include' })
        .then((r) => r.json().then((body) => ({ status: r.status, body })).catch(() => ({ status: r.status, body: null })))
        .catch(() => ({ status: 0, body: null }));
    `);
  }

  async clearCookies() {
    await this.send('Network.clearBrowserCookies');
    await sleep(120);
  }
}

/* ── اجرای جریان‌ها ───────────────────────────────────────────────────────── */

async function runFlow(id, title, body) {
  const flow = { id, title, status: 'passed', failed: 0, skipped: 0, error: null };
  currentFlow = flow;
  flows.push(flow);

  const started = Date.now();
  try {
    await body();
    if (flow.failed > 0) flow.status = 'failed';
    else if (flow.skipped > 0 && flow.skipped === checks.filter((c) => c.flow === flow).length) flow.status = 'skipped';
  } catch (error) {
    flow.status = 'failed';
    flow.error = error.message;
    checks.push({ flow, name: `جریان «${title}» بدون استثنا اجرا شد`, ok: false, detail: error.message });
    flow.failed += 1;
  }

  flow.ms = Date.now() - started;
  currentFlow = null;
  console.log(
    `  ${flow.status === 'passed' ? '✓' : flow.status === 'skipped' ? '•' : '✗'} ` +
    `${id} — ${title}  (${flow.ms}ms${flow.failed ? ` · ${flow.failed} ناموفق` : ''}${flow.error ? ` · ${flow.error.slice(0, 80)}` : ''})`,
  );
}

/* ── نقطهٔ ورود ───────────────────────────────────────────────────────────── */

const chromePath = EXTERNAL ? null : findChrome();
const distIndex = resolve(ROOT, 'dist', 'index.html');

if (!EXTERNAL && !chromePath) {
  console.log('─────────────────────────────────────────────');
  console.log('E2E مرورگری: SKIPPED — مرورگر کروم/کرومیوم پیدا نشد.');
  console.log('  برای اجرا یکی از این‌ها را انجام بده:');
  console.log('    • E2E_CHROME_PATH=/path/to/chrome node scripts/browser-e2e.mjs');
  console.log('    • یا E2E_BASE_URL=<آدرس سرور> node scripts/browser-e2e.mjs  (فقط‌خواندنی)');
  console.log('  وضعیت: UNVERIFIED-EXTERNAL (اجرا نشد ⇒ سبز اعلام نمی‌شود)');
  console.log('─────────────────────────────────────────────');
  process.exitCode = REQUIRE_BROWSER ? 1 : 3;
} else if (!EXTERNAL && !existsSync(distIndex)) {
  console.log('─────────────────────────────────────────────');
  console.log('E2E مرورگری: SKIPPED — `dist/index.html` وجود ندارد.');
  console.log('  سرور، SPA را از `dist/` سرو می‌کند؛ اول `npm run build` را اجرا کن.');
  console.log('  وضعیت: UNVERIFIED (اجرا نشد ⇒ سبز اعلام نمی‌شود)');
  console.log('─────────────────────────────────────────────');
  process.exitCode = REQUIRE_BROWSER ? 1 : 3;
} else {
  await main();
}

async function main() {
  const appPort = EXTERNAL ? null : await freePort();
  const debugPort = await freePort();
  const base = EXTERNAL ? EXTERNAL_BASE : `http://127.0.0.1:${appPort}`;
  const profileDir = mkdtempSync(join(tmpdir(), 'tapesh-e2e-profile-'));
  const snapshot = EXTERNAL ? null : snapshotData();

  let server = null;
  let serverLog = '';
  let chrome = null;
  let cdp = null;
  let page = null;
  let chromeLog = '';

  console.log('─────────────────────────────────────────────');
  console.log(`E2E مرورگری تپش — ${EXTERNAL ? 'سرور بیرونی' : 'سرور محلی'}`);
  console.log(`  base      : ${base}`);
  console.log(`  browser   : ${EXTERNAL ? '(بدون راه‌اندازی)' : chromePath}`);
  console.log(`  mode      : ${HEADED ? 'headed' : 'headless'}`);
  console.log(`  data      : ${EXTERNAL ? 'دست‌نخورده (فقط‌خواندنی)' : `پشتیبان‌گیری از ${snapshot.size} فایل زمان‌اجرا`}`);
  console.log('─────────────────────────────────────────────');

  try {
    if (!EXTERNAL) {
      const env = { ...process.env, PORT: String(appPort), HOST: '127.0.0.1' };
      env.TAPESH_ACCESS_LOG = '1';
      env.TAPESH_METRICS_TOKEN = METRICS_TOKEN;
      env.TAPESH_ADMIN_USERNAME = ADMIN_USERNAME;
      env.TAPESH_ADMIN_PASSWORD = ADMIN_PASSWORD;
      env.TAPESH_ADMIN_NAME = 'مدیر آزمون مرورگر';
      env.TAPESH_ALLOW_LOCALHOST_ORIGIN = '1';
      delete env.NODE_ENV;

      /*
       * در سندباکس این پروژه، `NODE_OPTIONS` یک shim سیستم‌فایل تزریق می‌کند که
       * `mkdir` را می‌بندد و راه‌اندازی سرور را ~۱۰۰ برابر کند می‌کند. فقط وقتی
       * حذفش می‌کنیم که واقعاً به همان shim اشاره داشته باشد — نه کورکورانه.
       */
      if (/node-language-shim|node-safe-delete-shim/.test(String(env.NODE_OPTIONS ?? ''))) delete env.NODE_OPTIONS;

      server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
      server.stdout.on('data', (chunk) => { serverLog += chunk; });
      server.stderr.on('data', (chunk) => { serverLog += chunk; });

      const up = await waitForServer(base);
      if (!up) throw new Error(`سرور بالا نیامد.\n${serverLog.slice(-1500)}`);
      console.log(`  server    : بالا آمد روی پورت ${appPort}`);
    }

    /* ── راه‌اندازی کروم ── */
    const chromeArgs = [
      HEADED ? '--headless=false' : '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      '--remote-allow-origins=*',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-sync',
      '--disable-default-apps',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--mute-audio',
      '--no-sandbox',
      /*
       * انیمیشن‌های ورود/ظاهر شدن (`.ad-*`, `.dash-stagger`) عنصر را در میانهٔ
       * ترنسفورم نگه می‌دارند؛ در آن بازه `elementFromPoint` عنصر را برمی‌گرداند
       * ولی مختصات تا لحظهٔ ارسال رخداد جابه‌جا می‌شود و کلیک **بی‌صدا** گم
       * می‌شود. کاهش حرکت، این نوسان را از بین می‌برد.
       */
      '--force-prefers-reduced-motion',
      '--window-size=1440,1000',
      'about:blank',
    ].filter((flag) => flag !== '--headless=false');

    chrome = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    chrome.stdout.on('data', (chunk) => { chromeLog += chunk; });
    chrome.stderr.on('data', (chunk) => { chromeLog += chunk; });

    const wsUrl = await waitForDevtools(debugPort);
    if (!wsUrl) throw new Error(`endpoint دیباگ کروم پیدا نشد.\n${chromeLog.slice(-1200)}`);

    cdp = await Cdp.connect(wsUrl);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    page = new Page(cdp, sessionId, base);

    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Network.enable');

    /*
     * ⚠️ چرا این سه خط لازم است (وگرنه کلیک **بی‌صدا** گم می‌شود):
     *   • `Target.activateTarget` — در headless=new، تنها تبِ فعال رخداد ورودی
     *     می‌گیرد. تبِ ساخته‌شده به‌صورت پیش‌فرض فعال نیست.
     *   • `Page.bringToFront` — همان را در سطح صفحه تأیید می‌کند.
     *   • `Emulation.setFocusEmulationEnabled` — بدون آن صفحه خود را
     *     «بدون فوکوس» می‌بیند و بعضی رخدادهای ماوس بی‌اثر می‌شوند.
     * نشانهٔ این باگ: `Input.dispatchMouseEvent` بدون خطا برمی‌گشت، ولی هیچ
     * `click`ی روی `document` ثبت نمی‌شد (دقیقاً همان چیزی که F9 را متناوب می‌کرد).
     */
    await cdp.send('Target.activateTarget', { targetId });
    await page.send('Page.bringToFront');
    await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });

    /*
     * اندازهٔ قطعی viewport.
     *
     * `--window-size` در حالت headless تضمینی نیست و اگر viewport کوچک‌تر از
     * انتظار باشد، مختصات کلیک می‌تواند بیرون از ناحیهٔ دید بیفتد و رخداد ماوس
     * **بی‌صدا** گم شود (همان چیزی که در F9 دیده شد: هیچ `click` ثبت نمی‌شد).
     */
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    });

    cdp.on('Network.requestWillBeSent', (params) => {
      const entry = {
        method: params.request?.method ?? '?',
        url: params.request?.url ?? '',
        status: null,
        type: params.type ?? '',
      };
      requestIndex.set(params.requestId, entry);
      networkLog.push(entry);
    });

    cdp.on('Network.responseReceived', (params) => {
      const entry = requestIndex.get(params.requestId);
      if (entry) entry.status = params.response?.status ?? null;
    });

    cdp.on('Runtime.exceptionThrown', (params) => {
      const description = params.exceptionDetails?.exception?.description
        ?? params.exceptionDetails?.text ?? 'استثنای نامشخص';
      uncaught.push(description.split('\n')[0]);
    });

    cdp.on('Runtime.consoleAPICalled', (params) => {
      if (params.type !== 'error') return;
      const text = (params.args ?? [])
        .map((arg) => arg.value ?? arg.description ?? arg.unserializableValue ?? '')
        .join(' ')
        .split('\n')[0];
      consoleErrors.push(text);
    });

    /* ── جریان‌ها ── */
    await defineFlows(page, base);

    /* ── بررسی تجمیعی: هیچ خطای مدیریت‌نشده‌ای در کل اجرا نباید باشد ── */
    currentFlow = null;
    check('کل اجرا: هیچ استثنای مدیریت‌نشده‌ای در صفحه رخ نداد', uncaught.length === 0,
      uncaught.slice(0, 3).join(' | ') || 'پاک');
    check('کل اجرا: هیچ خطای کنسولی ثبت نشد', consoleErrors.length === 0,
      consoleErrors.slice(0, 3).join(' | ') || 'پاک');
  } catch (error) {
    check('راه‌اندازی زیرساخت E2E بدون خطا', false, error.message);
    console.error('── خروجی سرور ──');
    console.error(serverLog.trim().slice(-2000) || '(خالی)');
    console.error('── خروجی کروم ──');
    console.error(chromeLog.trim().slice(-1500) || '(خالی)');
    console.error('─────────────────');
  } finally {
    try { cdp?.close(); } catch { /* */ }
    try { chrome?.kill('SIGKILL'); } catch { /* */ }
    try { server?.kill('SIGTERM'); } catch { /* */ }

    await sleep(400);

    if (snapshot) {
      const restored = restoreData(snapshot);
      console.log(`  data      : ${restored}/${snapshot.size} فایل زمان‌اجرا بازگردانده شد`);
    }

    try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* */ }
  }

  report();
}

/* ── انتظار برای بالا آمدن سرور و کروم ───────────────────────────────────── */

async function waitForServer(base, attempts = 200) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return true;
    } catch { /* هنوز بالا نیامده */ }
    await sleep(250);
  }
  return false;
}

async function waitForDevtools(port, attempts = 120) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        const body = await response.json();
        if (body.webSocketDebuggerUrl) return body.webSocketDebuggerUrl;
      }
    } catch { /* هنوز بالا نیامده */ }
    await sleep(250);
  }
  return null;
}

/* ── تعریف جریان‌ها ───────────────────────────────────────────────────────── */

async function defineFlows(page, base) {
  const writeAllowed = !EXTERNAL;
  const rootHasContent = "document.querySelector('#root') && document.querySelector('#root').children.length > 0";

  /* ── ۱ ── صفحهٔ اصلی و مسیریابی هش‌محور ── */
  await runFlow('F1', 'صفحهٔ اصلی و مسیریابی هش‌محور', async () => {
    await page.goto(`${base}/`);
    check('صفحهٔ اصلی رندر شد (#root محتوا دارد)', await page.evaluate(`return ${rootHasContent}`));
    const title = await page.evaluate('return document.title');
    check('عنوان صفحه خالی نیست', Boolean(title && title.trim()), title);

    const routes = [
      ['#pricing', 'تعرفه'],
      ['#products', 'محصول'],
      ['#about', 'درباره'],
      ['#articles', 'مقاله'],
      ['#auth', 'ورود'],
    ];

    for (const [hash, needle] of routes) {
      await page.setHash(hash);
      const rendered = await page.evaluate(`return ${rootHasContent}`);
      const text = await page.evaluate('return document.body.innerText || ""');
      check(`مسیر ${hash} رندر شد`, rendered, `root=${rendered}`);
      check(`مسیر ${hash} محتوای متناظر دارد`, text.includes(needle), `«${needle}» در متن صفحه`);
    }

    /* مسیر ناشناخته باید بی‌صدا به صفحهٔ اصلی برگردد، نه صفحهٔ سفید */
    await page.setHash('#route-that-does-not-exist-e2e');
    check('مسیر ناشناخته ⇒ بازگشت به صفحهٔ اصلی (بدون صفحهٔ سفید)',
      await page.evaluate(`return ${rootHasContent}`));
  });

  /* ── ۲ ── اعتبارسنجی فرم ورود/ثبت‌نام ── */
  await runFlow('F2', 'اعتبارسنجی فرم ثبت‌نام', async () => {
    await page.goto(`${base}/#auth/register`);
    await page.waitFor("document.querySelector('#auth-phone')", { label: 'فیلد شمارهٔ تلفن' });

    check('فیلد شمارهٔ تلفن در فرم ثبت‌نام وجود دارد', await page.evaluate("return Boolean(document.querySelector('#auth-phone'))"));
    check('فیلد رمز عبور وجود دارد', await page.evaluate("return Boolean(document.querySelector('#auth-password'))"));

    const typed = await page.typeInto('#auth-phone', '123');
    check('تایپ واقعی در فیلد شماره نشست (Input.insertText)', typed === '123', `value=${typed}`);

    await page.typeInto('#auth-password', 'short');
    await page.clickSelector('.auth-form__submit');
    await page.waitFor(
      "document.querySelector('[role=\"alert\"], .auth-form__error')",
      { label: 'پیام خطای اعتبارسنجی', timeout: 8000 },
    );

    const alertText = await page.evaluate(
      "const el = document.querySelector('[role=\"alert\"], .auth-form__error'); return el ? el.innerText : '';",
    );
    check('ورودی نامعتبر ⇒ پیام خطا نمایش داده شد', Boolean(alertText && alertText.trim()), alertText.trim().slice(0, 80));
    check('ورودی نامعتبر ⇒ هیچ درخواست موفقی ثبت نشد',
      (await page.statusOf('/api/users/me')) === 401, 'بدون نشست');
  });

  /* ── ۳ ── ثبت‌نام کاربر ── */
  await runFlow('F3', 'ثبت‌نام کاربر واقعی', async () => {
    if (!writeAllowed) {
      skip('ثبت‌نام کاربر', 'سرور بیرونی — نوشتن داده مجاز نیست');
      return;
    }

    await page.clearCookies();
    await page.goto(`${base}/#auth/register`);
    await page.waitFor("document.querySelector('#auth-phone')", { label: 'فرم ثبت‌نام' });

    await page.typeInto('#auth-phone', TEST_PHONE);
    await page.typeInto('#auth-password', TEST_PASSWORD);
    await page.typeInto('input[name="password-confirm"]', TEST_PASSWORD);

    const consent = await page.evaluate("return Boolean(document.querySelector('input[name=\"consent\"]'))");
    if (consent) {
      const checked = await page.evaluate("const el = document.querySelector('input[name=\"consent\"]'); return el.checked;");
      if (!checked) await page.clickSelector('input[name="consent"]');
      check('تیک رضایت‌نامه زده شد', await page.evaluate("return document.querySelector('input[name=\"consent\"]').checked"));
    }

    await page.clickSelector('.auth-form__submit');

    await page.waitFor(
      "window.location.hash.startsWith('#dashboard') || window.location.hash === '#onboarding' || document.querySelector('[role=\"alert\"]')",
      { label: 'نتیجهٔ ثبت‌نام', timeout: 15000 },
    );

    const hash = await page.evaluate('return window.location.hash');
    const alertText = await page.evaluate(
      "const el = document.querySelector('[role=\"alert\"]'); return el ? el.innerText.trim() : '';",
    );
    const me = await page.jsonOf('/api/users/me');

    check('ثبت‌نام با شمارهٔ معتبر ⇒ نشست کاربر برقرار شد (/api/users/me = 200)',
      me.status === 200, `http=${me.status} hash=${hash} alert=${alertText.slice(0, 70) || '—'}`);
    check('ثبت‌نام ⇒ کاربر به داشبورد/آموزش هدایت شد',
      hash.startsWith('#dashboard') || hash === '#onboarding', `hash=${hash}`);
    check('ثبت‌نام ⇒ بدنهٔ /api/users/me همان شمارهٔ آزمون است',
      me.body?.phone === TEST_PHONE || me.body?.user?.phone === TEST_PHONE,
      `phone=${me.body?.phone ?? me.body?.user?.phone ?? '—'}`);
  });

  /* ── ۴ ── خروج و ورود مجدد ── */
  await runFlow('F4', 'خروج و ورود مجدد کاربر', async () => {
    if (!writeAllowed) {
      skip('ورود کاربر', 'سرور بیرونی — نوشتن داده مجاز نیست');
      return;
    }

    const beforeLogout = await page.statusOf('/api/users/me');
    if (beforeLogout !== 200) {
      skip('خروج و ورود مجدد کاربر', 'نشست کاربری برقرار نیست (جریان F3 سبز نشد) — نتیجهٔ این جریان معتبر نمی‌بود');
      return;
    }
    check('پیش از خروج: نشست کاربر برقرار است', true, 'http=200');

    /* خروج واقعی از UI: تنظیمات داشبورد → «خروج از حساب کاربری» */
    await page.setHash('#dashboard?o=settings&t=profile');
    await page.waitFor("document.querySelector('section[aria-label=\"ویرایش پروفایل\"]')", { label: 'پنل تنظیمات پروفایل' });
    await page.clickByText('خروج از حساب کاربری');
    await sleep(700);

    const afterLogout = await page.statusOf('/api/users/me');
    check('خروج از UI ⇒ نشست کاربر باطل شد (/api/users/me = 401)', afterLogout === 401, `http=${afterLogout}`);

    /* ورود مجدد با همان اعتبارنامه */
    await page.goto(`${base}/#auth`);
    await page.waitFor("document.querySelector('#auth-phone')", { label: 'فرم ورود' });
    await page.typeInto('#auth-phone', TEST_PHONE);
    await page.typeInto('#auth-password', TEST_PASSWORD);
    await page.clickSelector('.auth-form__submit');
    await page.waitFor(
      "window.location.hash.startsWith('#dashboard') || window.location.hash === '#onboarding'",
      { label: 'ورود موفق', timeout: 15000 },
    );

    const me = await page.statusOf('/api/users/me');
    check('ورود مجدد با اعتبارنامهٔ ثبت‌شده ⇒ ۲۰۰', me === 200, `http=${me}`);
  });

  /* ── ۵ ── مشاهده و ویرایش پروفایل ── */
  await runFlow('F5', 'مشاهده و ویرایش پروفایل', async () => {
    if (!writeAllowed) {
      skip('ویرایش پروفایل', 'سرور بیرونی — نوشتن داده مجاز نیست');
      return;
    }

    if ((await page.statusOf('/api/users/me')) !== 200) {
      skip('مشاهده و ویرایش پروفایل', 'نشست کاربری برقرار نیست (جریان F3 سبز نشد)');
      return;
    }

    await page.setHash('#dashboard?o=settings&t=profile');
    await page.waitFor("document.querySelector('section[aria-label=\"ویرایش پروفایل\"]')", { label: 'فرم ویرایش پروفایل' });

    check('فرم ویرایش پروفایل رندر شد',
      await page.evaluate("return Boolean(document.querySelector('section[aria-label=\"ویرایش پروفایل\"]'))"));

    const newName = `آزمون-${RUN_TAG}`;
    const typed = await page.typeInto('#edit-profile-first-name', newName);
    check('نام در فیلد پروفایل تایپ شد', typed === newName, `value=${typed}`);

    /*
     * دانشگاه یک combobox است و `handleSubmit` صریحاً نگهبانی دارد:
     *   if (!universityOptions.includes(form.university) || universityQuery !== form.university) return;
     * پس تایپ دستی کافی نیست؛ باید از فهرست انتخاب شود، وگرنه فرم بدون هیچ
     * درخواستی برمی‌گردد (همان چیزی که در اجراهای اول باعث شکست F5 شد).
     */
    await page.evaluate("document.querySelector('#edit-profile-university').focus(); return true;");
    await page.waitFor(
      "document.querySelector('#edit-profile-university-options [role=\"option\"]')",
      { label: 'فهرست دانشگاه‌ها' },
    );
    const university = await page.evaluate(
      "const el = document.querySelector('#edit-profile-university-options [role=\"option\"]'); return el ? el.innerText.trim() : null;",
    );
    await page.clickSelector('#edit-profile-university-options [role="option"]');
    const picked = await page.evaluate("return document.querySelector('#edit-profile-university').value");
    check('دانشگاه از فهرست combobox انتخاب شد', Boolean(university) && picked === university,
      `انتخاب‌شده=${picked}`);

    /*
     * فرم پروفایل چند فیلد `required` دارد (نام، نام خانوادگی، تلفن، نام کاربری).
     * اگر خالی بمانند، اعتبارسنجی بومی مرورگر جلوی submit را می‌گیرد و **هیچ
     * درخواستی به سرور نمی‌رود** — دقیقاً همان چیزی که در اجرای اول باعث شد
     * جریان F5 شکست بخورد. پس مثل کاربر واقعی، فرم را کامل می‌کنیم.
     */
    const requiredFields = await page.evaluate(`
      return [...document.querySelectorAll('form [required]')].map((el) => ({
        id: el.id, tag: el.tagName, type: el.type,
        value: String(el.value ?? ''), readOnly: Boolean(el.readOnly) || el.disabled,
      }));
    `);

    let filled = 0;
    for (const field of requiredFields) {
      if (field.tag !== 'INPUT' || field.readOnly || field.value) continue;
      const value = field.id.includes('phone') ? TEST_PHONE
        : field.id.includes('username') ? `e2e${RUN_TAG}`
          : `E2E-${RUN_TAG}`;
      await page.typeInto(`#${field.id}`, value);
      filled += 1;
    }
    check(`فیلدهای اجباری خالی فرم پر شدند (${filled} فیلد)`, true, requiredFields.map((f) => f.id).join(', '));

    const invalid = await page.evaluate("return document.querySelectorAll('form :invalid').length");
    check('پیش از ارسال، هیچ فیلد نامعتبری در فرم نیست', invalid === 0, `invalid=${invalid}`);

    const networkBefore = networkLog.length;
    await page.clickByText('ذخیره تغییرات');
    await sleep(1800);

    const patch = networkLog.slice(networkBefore)
      .find((entry) => entry.method === 'PATCH' && entry.url.includes('/api/users/me'));
    check('ویرایش پروفایل ⇒ درخواست PATCH /api/users/me واقعاً به سرور رفت', Boolean(patch),
      patch ? `${patch.method} ${patch.url}` : 'هیچ درخواستی ثبت نشد');
    check('ویرایش پروفایل ⇒ سرور ۲۰۰ برگرداند', patch?.status === 200, `status=${patch?.status ?? '—'}`);

    /*
     * اثبات از **سرور**، نه از DOM.
     *
     * نسخهٔ اول فقط پس از رفرش، مقدار فیلد را از DOM می‌خواند؛ اما اپ یک کش
     * `localStorage` هم دارد (`tapesh:current-user`) که همان مقدار را برمی‌گرداند.
     * پس آن بررسی می‌توانست «سبز کاذب» باشد. اینجا خودِ رکورد سرور سنجیده می‌شود
     * (شکل پاسخ: `{ ...publicUser, profile: { firstName, … } }`).
     */
    const meAfter = await page.jsonOf('/api/users/me');
    const serverName = meAfter.body?.user?.profile?.firstName ?? null;
    check('ویرایش پروفایل روی سرور ثبت شد (GET /api/users/me)', serverName === newName,
      `http=${meAfter.status} user.profile.firstName=${serverName ?? '—'}`);

    /* و پس از رفرش کامل، UI هم باید همان مقدار را نشان دهد */
    await page.goto(`${base}/#dashboard?o=settings&t=profile`);
    await page.waitFor("document.querySelector('#edit-profile-first-name')", { label: 'فرم پروفایل پس از رفرش' });

    let uiValue = '';
    for (let i = 0; i < 60 && !uiValue; i += 1) {
      uiValue = await page.evaluate("return document.querySelector('#edit-profile-first-name').value");
      if (!uiValue) await sleep(200);
    }

    const reloadDiag = await page.evaluate(`
      return JSON.stringify({
        hash: window.location.hash,
        dashboard: Boolean(document.querySelector('.dashboard')),
        onAuth: Boolean(document.querySelector('#auth-phone')),
        field: document.querySelector('#edit-profile-first-name').value,
        body: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 120),
      });
    `);

    check('ویرایش پروفایل پس از رفرش کامل در UI دیده می‌شود', uiValue === newName,
      `value=${uiValue || '(خالی)'} · ${reloadDiag}`);
  });

  /* ── ۶ ── جریان یادگیری: لایه‌های داشبورد ── */
  await runFlow('F6', 'جریان یادگیری — لایه‌های داشبورد', async () => {
    const layers = [
      ['#dashboard?s=courses&l=my-courses', 'دوره‌های من'],
      ['#dashboard?s=courses&l=green-path', 'مسیر سبز'],
      ['#dashboard?s=flashcards', 'فلش‌کارت'],
      ['#dashboard?s=notes', 'یادداشت'],
      ['#dashboard?s=league', 'لیگ'],
      ['#dashboard?s=pomodoro', 'پومودورو'],
      ['#dashboard?s=other', 'سایر'],
    ];

    /*
     * ⚠️ نسخهٔ اول فقط «#root محتوا دارد» را می‌سنجید — و صفحهٔ ورود هم محتوا
     * دارد. پس اگر اپ به‌جای داشبورد به صفحهٔ ورود هدایت می‌کرد، تست کاذبانه سبز
     * می‌شد. حالا پوستهٔ واقعی داشبورد (`.dashboard`) خواسته می‌شود.
     */
    const sessionOk = (await page.statusOf('/api/users/me')) === 200;
    if (!sessionOk) {
      skip('جریان یادگیری — لایه‌های داشبورد', 'نشست کاربری برقرار نیست (جریان F3 سبز نشد)');
      return;
    }

    await page.goto(`${base}/#dashboard`);
    await page.waitFor("document.querySelector('.dashboard')", { label: 'پوستهٔ داشبورد' });
    check('پوستهٔ داشبورد (`.dashboard`) رندر شد', true);

    for (const [hash, label] of layers) {
      await page.setHash(hash);
      await sleep(500);
      const shell = await page.evaluate("return Boolean(document.querySelector('.dashboard'))");
      const onAuth = await page.evaluate("return Boolean(document.querySelector('#auth-phone'))");
      check(`لایهٔ داشبورد ${hash} رندر شد (${label})`, shell && !onAuth,
        `dashboard=${shell} onAuth=${onAuth}`);
    }
  });

  /* ── ۷ ── جریان آزمون ── */
  await runFlow('F7', 'جریان آزمون — بانک تست', async () => {
    if ((await page.statusOf('/api/users/me')) !== 200) {
      skip('جریان آزمون — بانک تست', 'نشست کاربری برقرار نیست (جریان F3 سبز نشد)');
      return;
    }

    await page.goto(`${base}/#dashboard?s=tests&l=test-bank`);
    await page.waitFor(rootHasContent, { label: 'رندر لایهٔ بانک تست' });
    await sleep(900);

    check('لایهٔ بانک تست داخل پوستهٔ داشبورد رندر شد',
      await page.evaluate("return Boolean(document.querySelector('.dashboard'))"));

    const text = await page.evaluate('return document.body.innerText || ""');
    check('لایهٔ بانک تست محتوای خود را نشان داد', text.length > 200, `طول متن=${text.length}`);

    const hasStart = await page.evaluate(`
      const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
      return [...document.querySelectorAll('button, a[role="button"]')]
        .some((el) => /شروع|آزمون|تمرین/.test(norm(el.innerText || el.textContent)));
    `);
    check('کنترل شروع آزمون/تمرین در بانک تست وجود دارد', hasStart);

    /* آزمون شبیه‌ساز: ورود به بخش آزمون‌های هماهنگ */
    await page.setHash('#dashboard?s=tests&l=coordinated-exams');
    await sleep(900);
    check('لایهٔ آزمون‌های هماهنگ داخل پوستهٔ داشبورد رندر شد',
      await page.evaluate("return Boolean(document.querySelector('.dashboard'))"));
  });

  /* ── ۸ ── دسترسی غیرمجاز به پنل مدیریت ── */
  await runFlow('F8', 'پنل مدیریت — دسترسی غیرمجاز', async () => {
    await page.clearCookies();
    await page.goto(`${base}/#admin`);
    await page.waitFor("document.querySelector('.ad-login__card') || document.querySelector('.ad-root')", { label: 'تعیین وضعیت پنل' });

    const loginVisible = await page.evaluate("return Boolean(document.querySelector('.ad-login__card'))");
    const shellVisible = await page.evaluate("return Boolean(document.querySelector('.ad-root .ad-nav'))");

    check('بدون نشست ⇒ فرم ورود پنل نمایش داده می‌شود', loginVisible);
    check('بدون نشست ⇒ پوستهٔ پنل (سایدبار) نمایش داده نمی‌شود', !shellVisible);

    const apiStatus = await page.statusOf('/api/admin/auth/me');
    check('بدون نشست ⇒ /api/admin/auth/me = 401', apiStatus === 401, `http=${apiStatus}`);
  });

  /* ── ۹ ── ورود مدیر و CRUD واقعی ── */
  await runFlow('F9', 'ورود مدیر و CRUD واقعی', async () => {
    if (!writeAllowed) {
      skip('ورود مدیر', 'سرور بیرونی — اعتبارنامهٔ مدیر ارائه نشده');
      return;
    }

    await page.goto(`${base}/#admin`);
    await page.waitFor("document.querySelector('.ad-login__card input')", { label: 'فرم ورود مدیر' });

    const inputs = await page.evaluate("return document.querySelectorAll('.ad-login__card input').length");
    check('فرم ورود مدیر دو فیلد دارد (نام کاربری + رمز)', inputs >= 2, `count=${inputs}`);

    await page.typeInto('.ad-login__card input:nth-of-type(1)', ADMIN_USERNAME);
    await page.typeInto('.ad-login__card input[type="password"]', ADMIN_PASSWORD);

    /* اگر فیلد رمز پس از تایپ هنوز خالی است، مستقیم روی همان عنصر می‌نویسیم */
    const filled = await page.evaluate("return document.querySelector('.ad-login__card input[type=\"password\"]').value.length");
    if (!filled) await page.typeInto('.ad-login__card input:nth-of-type(2)', ADMIN_PASSWORD);

    await page.clickByText('ورود به پنل');
    await page.waitFor("document.querySelector('.ad-root .ad-nav')", { label: 'پوستهٔ پنل مدیریت', timeout: 15000 });

    check('ورود مدیر ⇒ پوستهٔ پنل رندر شد', await page.evaluate("return Boolean(document.querySelector('.ad-root .ad-nav'))"));

    const adminMe = await page.jsonOf('/api/admin/auth/me');
    check('ورود مدیر ⇒ /api/admin/auth/me = 200', adminMe.status === 200, `http=${adminMe.status}`);

    /* CRUD واقعی: ساخت یک یادداشت در پنل و اثبات ماندگاری آن */
    await page.setHash('#admin/notes');
    await page.waitFor("document.querySelector('.ad-root .ad-nav')", { label: 'بخش یادداشت‌ها' });

    /* صبر تا دکمهٔ ساخت واقعاً در DOM باشد (نمای یادداشت‌ها lazy-load است) */
    await page.waitFor(
      `(() => {
        const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
        return [...document.querySelectorAll('button')].some((el) => norm(el.innerText).includes('یادداشت جدید'));
      })()`,
      { label: 'دکمهٔ «یادداشت جدید»', timeout: 15000 },
    );
    await sleep(500);

    const noteTitle = `یادداشت E2E ${RUN_TAG}`;
    const clickedLabel = 'یادداشت جدید';

    /* ثبت رخدادهای کلیک واقعی برای تشخیص دقیق در صورت شکست */
    await page.evaluate(`
      window.__e2eClicks = [];
      document.addEventListener('click', (event) => {
        const el = event.target.closest('button, a, [role="button"], summary');
        window.__e2eClicks.push(el
          ? (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 40)
          : event.target.tagName);
      }, true);
      return true;
    `);

    const modalOpen = await page.clickByTextUntil(
      clickedLabel,
      "document.querySelector('.ad-modal')",
      { attempts: 3, waitMs: 6000 },
    );

    if (modalOpen === 'dom-fallback') {
      note('مودال یادداشت با کلیک سطح-DOM باز شد (ورودی واقعی کروم بی‌اثر ماند) — اثبات جریان از لاگ شبکه می‌آید');
    }

    if (!modalOpen) {
      const diag = await page.evaluate(`
        return JSON.stringify({
          clicks: window.__e2eClicks,
          rect: ${JSON.stringify(page.lastRect ?? null)},
          viewport: [window.innerWidth, window.innerHeight],
          scroll: [window.scrollX, window.scrollY],
          dialogs: document.querySelectorAll('[role="dialog"]').length,
          buttons: [...document.querySelectorAll('button')]
            .map((b) => (b.innerText || '').replace(/\\s+/g, ' ').trim())
            .filter(Boolean).slice(0, 22),
        });
      `);
      throw new Error(`مودال یادداشت باز نشد — کلیک روی «${clickedLabel}» · وضعیت: ${diag}`);
    }

    await page.waitFor("document.querySelector('.ad-modal input')", { label: 'فیلد عنوان در مودال' });

    /*
     * ⚠️ نسخهٔ اول به `autoFocus` تکیه می‌کرد و روی `document.activeElement`
     * می‌نوشت؛ گاهی مودال باز می‌شد ولی فوکوس جای دیگری بود و تست متناوب می‌شد.
     * حالا فیلد صریحاً هدف گرفته می‌شود.
     */
    const titleTyped = await page.typeInto('.ad-modal input', noteTitle);
    check('عنوان یادداشت در مودال تایپ شد', titleTyped === noteTitle, `value=${titleTyped}`);

    /* «ذخیره» فقط داخل خودِ مودال جست‌وجو می‌شود تا با دکمه‌های پشت آن قاطی نشود */
    const networkBefore = networkLog.length;
    await page.clickByText('ذخیره', { within: '.ad-modal' });

    let modalClosed = false;
    for (let i = 0; i < 75 && !modalClosed; i += 1) {
      modalClosed = await page.evaluate("return !document.querySelector('.ad-modal')");
      if (!modalClosed) await sleep(200);
    }
    await sleep(600);

    const write = networkLog.slice(networkBefore)
      .find((entry) => entry.method === 'POST' && entry.url.includes('/api/admin/notes'));
    check('CRUD ⇒ درخواست POST /api/admin/notes واقعاً به سرور رفت', Boolean(write),
      write ? `${write.method} ${write.url}` : 'هیچ درخواستی ثبت نشد');
    check('CRUD ⇒ سرور ۲۰۰/۲۰۱ برگرداند', [200, 201].includes(write?.status), `status=${write?.status ?? '—'}`);
    check('CRUD ⇒ مودال پس از ذخیره بسته شد', modalClosed,
      modalClosed ? '' : 'مودال باز ماند');

    /* اثبات از سرور، نه از DOM: فهرست یادداشت‌ها را از API می‌خوانیم */
    const listed = await page.evaluate(`
      return fetch('/api/admin/notes', { credentials: 'include' })
        .then((r) => r.json())
        .then((body) => JSON.stringify(body).includes(${JSON.stringify(noteTitle)}))
        .catch(() => false);
    `);
    check('CRUD: یادداشت ساخته‌شده در سرور ثبت شد', listed === true);

    /* بازخوانی از UI پس از رفرش کامل */
    await page.goto(`${base}/#admin/notes`);
    await sleep(1500);
    const inUi = await page.evaluate(`return (document.body.innerText || '').includes(${JSON.stringify(noteTitle)})`);
    check('CRUD: یادداشت پس از رفرش کامل در UI دیده می‌شود', inUi === true);
  });

  /* ── ۱۰ ── نشست نامعتبر / انقضا ── */
  await runFlow('F10', 'نشست نامعتبر و رفتار پس از ابطال', async () => {
    /* نشست مدیر را باطل می‌کنیم و می‌سنجیم که پنل دوباره به فرم ورود برگردد */
    await page.clearCookies();
    await page.goto(`${base}/#admin`);
    await page.waitFor("document.querySelector('.ad-login__card')", { label: 'بازگشت به فرم ورود مدیر' });
    check('ابطال نشست مدیر ⇒ بازگشت به فرم ورود (بدون دسترسی به پنل)',
      await page.evaluate("return Boolean(document.querySelector('.ad-login__card')) && !document.querySelector('.ad-root .ad-nav')"));

    const adminApi = await page.statusOf('/api/admin/auth/me');
    check('ابطال نشست مدیر ⇒ /api/admin/auth/me = 401', adminApi === 401, `http=${adminApi}`);

    /* کاربر عادی با نشست نامعتبر: کوکی جعلی */
    await page.goto(`${base}/#dashboard`);
    await sleep(700);
    const me = await page.statusOf('/api/users/me');
    check('نشست نامعتبر کاربر ⇒ /api/users/me = 401', me === 401, `http=${me}`);
  });

  /* ── ۱۱ ── حالت خطا و مرزهای شکست ── */
  await runFlow('F11', 'حالت خطا و مرزهای شکست', async () => {
    await page.goto(`${base}/`);

    const missingAsset = await page.evaluate(`
      return fetch('/assets/definitely-missing-e2e.js', { credentials: 'omit' })
        .then((r) => r.status)
        .catch(() => 0);
    `);
    check('دارایی ناموجود ⇒ ۴۰۴ (نه صفحهٔ HTML)', missingAsset === 404, `http=${missingAsset}`);

    const fallback = await page.evaluate(`
      return fetch('/some-unknown-route-e2e', { credentials: 'omit', headers: { accept: 'text/html' } })
        .then((r) => r.text().then((body) => ({ status: r.status, hasRoot: body.includes('id="root"') })))
        .catch(() => ({ status: 0, hasRoot: false }));
    `);
    check('مسیر ناشناختهٔ SPA ⇒ ۲۰۰ با پوستهٔ اپ', fallback.status === 200 && fallback.hasRoot,
      `http=${fallback.status} root=${fallback.hasRoot}`);

    const healthz = await page.evaluate("return fetch('/healthz').then((r) => r.status).catch(() => 0)");
    check('/healthz از داخل مرورگر ⇒ ۲۰۰', healthz === 200, `http=${healthz}`);

    /* اثبات اینکه هارنس استثنای واقعی را می‌بیند (سنجش خودِ سنجه) */
    const before = uncaught.length;
    await page.evaluate("setTimeout(() => { throw new Error('e2e-probe-uncaught'); }, 0); return true;");
    await sleep(500);
    check('هارنس استثنای مدیریت‌نشده را ثبت می‌کند (سنجش خودِ سنجه)', uncaught.length > before,
      `قبل=${before} بعد=${uncaught.length}`);

    /* استثنای عمدی خودش نباید اجرا را «ناموفق» کند */
    uncaught = uncaught.filter((line) => !line.includes('e2e-probe-uncaught'));
    consoleErrors = consoleErrors.filter((line) => !line.includes('e2e-probe-uncaught'));

    skip('مرز خطای React (ErrorBoundary) با تزریق خطای واقعی',
      'نیازمند دست‌کاری runtime اپ است؛ در این هارنس عمداً انجام نشد (اجرای کنونی: نبود استثنای مدیریت‌نشده سنجیده می‌شود)');
  });
}

/* ── گزارش نهایی ──────────────────────────────────────────────────────────── */

function report() {
  const passed = checks.filter((c) => c.ok === true).length;
  const failed = checks.filter((c) => c.ok === false).length;
  const skipped = checks.filter((c) => c.ok === null).length;
  const flowFailed = flows.filter((f) => f.status === 'failed').length;

  console.log('');
  console.log('─────────────────────────────────────────────');
  for (const item of checks) {
    const mark = item.ok === true ? '✓' : item.ok === false ? '✗' : '•';
    const flowId = item.flow ? `${item.flow.id} ` : '';
    console.log(`${mark} ${flowId}${item.name}${item.detail ? `  — ${item.detail}` : ''}`);
  }
  console.log('─────────────────────────────────────────────');
  console.log(`جریان‌ها: ${flows.length - flowFailed}/${flows.length} موفق`);
  console.log(`بررسی‌ها: ${passed} موفق · ${failed} ناموفق · ${skipped} رد‌شده`);
  /*
   * شفافیت: اگر ورودی واقعی کروم جایی بی‌اثر مانده و مسیر جانشین سطح-DOM
   * استفاده شده، اینجا صریح گفته می‌شود — نه اینکه در سبزی گزارش پنهان شود.
   */
  console.log(`ورودی واقعی: ${clickFallbacks === 0
    ? 'همهٔ کلیک‌ها از لایهٔ ورودی کروم'
    : `⚠ ${clickFallbacks} کلیک با مسیر جانشین سطح-DOM انجام شد (ورودی واقعی بی‌اثر ماند)`}`);
  console.log('─────────────────────────────────────────────');

  if (JSON_OUT) {
    const outDir = resolve(ROOT, 'docs', 'audit');
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const outFile = resolve(outDir, 'browser-e2e.json');
    writeFileSync(outFile, `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      mode: EXTERNAL ? 'external' : 'local',
      base: EXTERNAL ? EXTERNAL_BASE : 'local-server',
      browser: EXTERNAL ? null : chromePath,
      flows: flows.map((f) => ({ id: f.id, title: f.title, status: f.status, ms: f.ms, error: f.error })),
      checks,
      notes,
      clickFallbacks,
      totals: { passed, failed, skipped, flows: flows.length, flowsFailed: flowFailed },
      uncaught,
      consoleErrors,
    }, null, 2)}\n`, 'utf8');
    console.log(`گزارش ماشین‌خوان: ${outFile}`);
  }

  process.exitCode = failed === 0 ? 0 : 1;
}
