/*
 * پروب سبک — فقط حالت‌هایی که هنوز دیده نشده: تم روشن + موبایل ۳۹۰ + نوار هیرو ۱۹۲۰.
 * انتظارها «نرم»اند: اگر تایم‌اوت شد، به‌جای پرتاب خطا وضعیت را گزارش می‌کند.
 */
import { writeFileSync } from 'node:fs';

const PORT = 9333;
const BASE = 'http://localhost:5199/';
const say = (label, value) => console.log(label + ' :: ' + JSON.stringify(value));

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => { ws.onopen = resolve; });

let id = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) =>
  new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (!res.result || res.result.exceptionDetails) return null;
  return res.result.result.value;
};

const softWait = async (expression, timeout = 12000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(expression).catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
};

const settle = () => evaluate(`(() => {
  const style = document.createElement('style');
  style.textContent = '*{transition:none !important;animation:none !important}';
  document.head.appendChild(style);
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
  return true;
})()`);

const shot = async (file, selector, extra = 20) => {
  try {
    const clip = selector ? await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      const w = window.innerWidth;
      if (!el || !w) return null;
      const r = el.getBoundingClientRect();
      return { x: 0, y: Math.max(0, r.top + window.scrollY - ${extra}), width: w,
               height: Math.round(r.height + ${extra * 2}) };
    })()`) : null;
    const params = { format: 'png', captureBeyondViewport: true };
    if (clip && clip.width > 0 && clip.height > 0) params.clip = { ...clip, scale: 1 };
    const res = await send('Page.captureScreenshot', params);
    if (!res.result) return 'SHOT-FAILED ' + file;
    writeFileSync(file, Buffer.from(res.result.data, 'base64'));
    return file;
  } catch (error) {
    return 'SHOT-ERROR ' + file + ' ' + error.message.slice(0, 80);
  }
};

await send('Page.enable');
await send('Runtime.enable');

const gotoFresh = async (hash, width, height) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
  await evaluate(`document.documentElement.setAttribute('data-probe-stale','1')`).catch(() => {});
  await send('Page.navigate', { url: BASE + hash });
  const ok = await softWait(`document.readyState === 'complete'
    && !document.documentElement.hasAttribute('data-probe-stale')
    && !!document.querySelector('.grp-page')`, 15000);
  await settle();
  return ok;
};

/* ── ۱. دسکتاپ روشن ── */
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: BASE + '#group' });
say('firstLoad', await softWait(`!!document.querySelector('.grp-page')`, 15000));
await settle();

/* یک گروه بساز تا کارت دیده شود */
say('create', await evaluate(`(async () => {
  const btn = [...document.querySelectorAll('.grp-submit')].find((b) => b.textContent.indexOf('ساخت گروه') >= 0);
  if (!btn) return { error: 'no submit' };
  btn.click();
  await new Promise((r) => setTimeout(r, 150));
  const card = document.querySelector('.grp-card');
  return card ? {
    code: card.querySelector('.grp-card__code-value').textContent.trim(),
    seatsCount: card.querySelector('.grp-card__seats-count').textContent.trim(),
    summaryRows: [...card.querySelectorAll('.grp-card__summary-row')].map((r) => r.textContent.trim()),
  } : { error: 'no card' };
})()`));

/* تم روشن */
say('toLight', await evaluate(`(async () => {
  localStorage.setItem('tapesh:theme', 'light');
  document.documentElement.removeAttribute('data-theme');
  location.reload();
  return true;
})()`));
await softWait(`document.documentElement.getAttribute('data-theme') === 'light' && !!document.querySelector('.grp-card')`, 20000);
await settle();
say('lightTheme', await evaluate(`document.documentElement.getAttribute('data-theme')`));
say('lightCard', await evaluate(`(() => {
  const card = document.querySelector('.grp-card');
  if (!card) return null;
  const code = card.querySelector('.grp-card__code-value');
  return {
    bodyBg: getComputedStyle(document.body).backgroundColor,
    cardBg: getComputedStyle(card).backgroundColor,
    codeBg: getComputedStyle(code.parentElement).backgroundColor,
    codeColor: getComputedStyle(code).color,
    accent: getComputedStyle(document.querySelector('.grp-page')).getPropertyValue('--grp-accent').trim(),
    hintRow: [...card.querySelectorAll('.grp-card__summary-row')].map((r) => r.textContent.trim()),
  };
})()`));
say('shotLightCard', await shot('.probe3-light-1440-card.png', '.grp-card', 24));
say('shotLightTiers', await shot('.probe3-light-1440-tiers.png', '.grp-tiers', 24));

/* ── ۲. موبایل ۳۹۰ (تیره) ── */
await evaluate(`localStorage.setItem('tapesh:theme','dark')`);
say('mobileLoad', await gotoFresh('#group', 390, 844));
say('mobile', await evaluate(`(() => {
  const r = (s) => { const el = document.querySelector(s); if (!el) return null;
    const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
  const grid = document.querySelector('.grp-tiers__grid');
  return {
    shell: r('.grp-hero'), tier: r('.grp-tier'), tabs: r('.grp-tablist'), card: r('.grp-card'),
    cols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`));
say('shotMobileCard', await shot('.probe3-dark-390-card.png', '.grp-card', 20));
say('shotMobileTiers', await shot('.probe3-dark-390-tiers.png', '.grp-tiers', 20));

/* موبایل روشن */
await evaluate(`localStorage.setItem('tapesh:theme','light')`);
say('mobileLightLoad', await softWait(`(() => { location.reload(); return false; })() || true`, 500));
await softWait(`document.documentElement.getAttribute('data-theme') === 'light' && !!document.querySelector('.grp-card')`, 20000);
await settle();
say('shotMobileLightCard', await shot('.probe3-light-390-card.png', '.grp-card', 20));

/* ── ۳. نوار هیرو ۱۹۲۰ + کلیک بنر ── */
await evaluate(`localStorage.setItem('tapesh:theme','dark')`);
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1000, deviceScaleFactor: 1, mobile: false });
await evaluate(`document.documentElement.setAttribute('data-probe-stale','1')`).catch(() => {});
await send('Page.navigate', { url: BASE });
say('homeLoad', await softWait(`document.readyState === 'complete'
  && !document.documentElement.hasAttribute('data-probe-stale')
  && !!document.querySelector('.hero__courses')`, 15000));
await settle();
say('hero1920', await evaluate(`(() => {
  const r = (s) => { const el = document.querySelector(s); if (!el) return null;
    const b = el.getBoundingClientRect(); return { w: Math.round(b.width), x: Math.round(b.x), h: Math.round(b.height) }; };
  const cards = [...document.querySelectorAll('.hero__courses [aria-label]')];
  return {
    strip: r('.hero__courses'), sectionShell: r('.promo-grid'), firstCard: r('.hero__courses [aria-label]'),
    cardCount: cards.length,
    cardMinHeight: cards[0] ? getComputedStyle(cards[0]).minHeight : null,
    bannerHref: (document.querySelector('.friends-banner .button--orange') || {}).getAttribute
      ? document.querySelector('.friends-banner .button--orange').getAttribute('href') : null,
  };
})()`));
say('shotHeroStrip', await shot('.probe3-hero-1920.png', '.hero', 0));
say('bannerClick', await evaluate(`(async () => {
  const btn = document.querySelector('.friends-banner .button--orange');
  if (!btn) return { error: 'no banner button' };
  btn.click();
  await new Promise((r) => setTimeout(r, 600));
  return { hash: location.hash, grpPage: !!document.querySelector('.grp-page'), code: !!document.querySelector('.grp-card') };
})()`));
await settle();
say('shotFromBanner', await shot('.probe3-from-banner-1920.png', '.grp-hero', 10));

console.log('PROBE-DONE');
ws.close();
