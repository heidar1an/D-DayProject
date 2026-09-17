/* هارنس موقت Mode C — اندازه‌گیری واقعی چیدمان. بعد از کار پاک می‌شود. */
import { writeFileSync } from 'node:fs';

const PORT = 9333;
const URL_BASE = 'http://localhost:5199/';

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('no page target: ' + JSON.stringify(targets).slice(0, 300));

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let id = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};

const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (!res.result) throw new Error('CDP ' + JSON.stringify(res).slice(0, 300));
  if (res.result.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails).slice(0, 400));
  return res.result.result.value;
};

const waitFor = async (expression, timeout = 20000) => {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(expression)) return true;
    } catch (error) {
      last = error.message;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  const href = await evaluate('document.location.href').catch((e) => e.message);
  throw new Error('timeout: ' + expression + ' | href=' + href + ' | last=' + last);
};

const settle = () =>
  evaluate(`(() => {
    const style = document.createElement('style');
    style.textContent = '*{transition:none !important;animation:none !important}';
    document.head.appendChild(style);
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
    return document.querySelectorAll('[data-reveal].is-visible').length;
  })()`);

const goto = async (width, height, hash = '') => {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  await send('Page.navigate', { url: URL_BASE + hash });
  await waitFor('document.readyState === "complete"');
  await waitFor('!!document.querySelector(".site-header")');
  await settle();
  await new Promise((r) => setTimeout(r, 400));
  await settle();
};

/* جوهرِ (ink) یک متن را از متریک‌های واقعی فونت حساب می‌کند:
   خط پایه = بالای جعبه + نیم‌فاصله + ascent، و جوهر = خط پایه ± actualBoundingBox. */
const inkOf = (selector, sample) => evaluate(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  const cs = getComputedStyle(el);
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
  const m = ctx.measureText(${JSON.stringify(sample)});
  const lineHeight = parseFloat(cs.lineHeight);
  const half = (lineHeight - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2;
  const r = el.getBoundingClientRect();
  const baseline = r.top + half + m.fontBoundingBoxAscent;
  return {
    boxTop: Math.round(r.top),
    baseline: Math.round(baseline),
    inkTop: Math.round(baseline - m.actualBoundingBoxAscent),
    inkBottom: Math.round(baseline + m.actualBoundingBoxDescent),
    lineHeight,
    fontSize: cs.fontSize,
    halfLeading: Math.round(half),
  };
})()`);

const measureHome = () => evaluate(`(() => {
  const box = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) };
  };
  const cards = [...document.querySelectorAll('.hero__courses button')].map((el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  return {
    viewport: window.innerWidth,
    heroCourses: box('.hero__courses'),
    benefits: box('.benefits'),
    heroContent: box('.hero__content'),
    cards,
    header: box('.site-header'),
    firstBenefitCard: box('.benefit-card'),
  };
})()`);

const shot = async (name, clip) => {
  const res = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
  });
  writeFileSync(name, Buffer.from(res.result.data, 'base64'));
  return name;
};

const report = {};

for (const width of [1440, 1920]) {
  await goto(width, 1000);
  report['w' + width] = await measureHome();

  const rect = await evaluate(`(() => {
    const b = document.querySelector('.benefits').getBoundingClientRect();
    const q = document.querySelector('.quote').getBoundingClientRect();
    const top = b.bottom + window.scrollY - 300;
    return { x: 0, y: Math.round(top), width: Math.round(window.innerWidth), height: Math.round(q.bottom - b.bottom + 300) };
  })()`);
  report['quoteRect' + width] = rect;
  await shot(`.probe-quote-${width}.png`, rect);
  report['markInk' + width] = await inkOf('.quote__mark--open', '“');
  report['textInk' + width] = await inkOf('.quote blockquote', 'پزشک باید درد بیمار');
}

await goto(390, 844);
report.w390 = await measureHome();

console.log(JSON.stringify(report, null, 1));
ws.close();
