/*
 * پروب Mode C (نسخهٔ دوم) — مقاوم: هر اسکرین‌شات در try/catch و گزارش مرحله‌به‌مرحله.
 * فایل موقت است.
 */
import { writeFileSync } from 'node:fs';

const PORT = 9333;
const BASE = 'http://localhost:5199/';
const say = (label, value) => console.log(label + ' :: ' + JSON.stringify(value));

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('no page target');

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
  if (!res.result) throw new Error('CDP ' + JSON.stringify(res).slice(0, 300));
  if (res.result.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails).slice(0, 400));
  return res.result.result.value;
};

const waitFor = async (expression, timeout = 20000) => {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    try { if (await evaluate(expression)) return true; } catch (error) { last = error.message; }
    await new Promise((r) => setTimeout(r, 150));
  }
  const href = await evaluate('document.location.href').catch((e) => e.message);
  throw new Error('timeout: ' + expression + ' | href=' + href + ' | last=' + last);
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
    if (!res.result) throw new Error(JSON.stringify(res).slice(0, 160));
    writeFileSync(file, Buffer.from(res.result.data, 'base64'));
    return file;
  } catch (error) {
    return 'FAILED ' + file + ' — ' + error.message.slice(0, 120);
  }
};

const setViewport = (width, height) => send('Emulation.setDeviceMetricsOverride', {
  width, height, deviceScaleFactor: 1, mobile: width < 700,
});

/*
 * تله: بلافاصله بعد از navigate/reload، سندِ قبلی هنوز زنده است و هر
 * waitFor روی آن سبز می‌شود؛ بعد سند تازه می‌آید و سنجه‌ها روی صفحهٔ خالی اجرا
 * می‌شوند. راه‌حل: قبل از رفتن یک نشانه روی سند قدیمی می‌گذاریم و منتظر سندی
 * می‌مانیم که آن نشانه را ندارد.
 */
const STALE = 'data-probe-stale';

const navigate = async (url, marker) => {
  await evaluate(`document.documentElement.setAttribute(${JSON.stringify(STALE)}, '1')`).catch(() => {});
  await send('Page.navigate', { url });
  await waitFor(`document.readyState === 'complete'
    && !document.documentElement.hasAttribute(${JSON.stringify(STALE)})
    && !!document.querySelector(${JSON.stringify(marker)})`);
  await settle();
};

const reload = async (marker) => {
  await evaluate(`document.documentElement.setAttribute(${JSON.stringify(STALE)}, '1')`);
  await send('Page.reload');
  await waitFor(`document.readyState === 'complete'
    && !document.documentElement.hasAttribute(${JSON.stringify(STALE)})
    && !!document.querySelector(${JSON.stringify(marker)})`);
  await settle();
};

const setTheme = async (name) => {
  await evaluate(`localStorage.setItem('tapesh:theme', ${JSON.stringify(name)})`);
  await reload('.grp-page');
  return evaluate(`document.documentElement.getAttribute('data-theme') || 'dark'`);
};

await send('Page.enable');
await send('Runtime.enable');

/* ═══ ۱. دسکتاپ ۱۴۴۰، تیره، وضعیت تازه ═══ */
await setViewport(1440, 900);
await navigate(BASE + '#group', '.grp-page');
await evaluate(`Object.keys(localStorage).filter((k) => k.indexOf('tapesh:group') === 0).forEach((k) => localStorage.removeItem(k))`);
await reload('.grp-page');

say('marker', await evaluate(`!!document.querySelector('.grp-page')`));
say('theme', await evaluate(`document.documentElement.getAttribute('data-theme') || 'dark'`));

say('tiers', await evaluate(`[...document.querySelectorAll('.grp-tier')].map((el) => ({
  label: el.querySelector('.grp-tier__seats').textContent.trim(),
  discount: el.querySelector('.grp-tier__discount').textContent.trim(),
  price: el.querySelector('.grp-tier__price-value').textContent.trim(),
  checked: el.getAttribute('aria-checked'),
  best: el.classList.contains('is-best'),
  x: Math.round(el.getBoundingClientRect().x),
  w: Math.round(el.getBoundingClientRect().width),
}))`));

say('layout', await evaluate(`(() => {
  const r = (s) => { const el = document.querySelector(s); if (!el) return null;
    const b = el.getBoundingClientRect(); return { w: Math.round(b.width), x: Math.round(b.x) }; };
  const grid = document.querySelector('.grp-tiers__grid');
  return {
    heroShell: r('.grp-hero'), tiersShell: r('.grp-tiers'), actionsShell: r('.grp-actions'),
    stepsShell: r('.grp-steps'), faqShell: r('.grp-faq'), finalShell: r('.grp-final'),
    cols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
    tabs: document.querySelectorAll('.grp-tab').length,
    steps: document.querySelectorAll('.grp-step').length,
    faq: document.querySelectorAll('.grp-faq__item').length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    docHeight: document.documentElement.scrollHeight,
  };
})()`));

say('shotHero', await shot('.probe2-dark-1440-hero.png', '.grp-hero', 10));
say('shotTiers', await shot('.probe2-dark-1440-tiers.png', '.grp-tiers', 24));

/* ═══ ۲. انتخاب ظرفیت ۳ نفره با کلیک واقعی، بعد ساخت گروه ═══ */
say('select3', await evaluate(`(async () => {
  const el = [...document.querySelectorAll('.grp-tier')].find((t) => t.textContent.indexOf('۳ نفر') >= 0);
  el.click();
  await new Promise((r) => setTimeout(r, 150));
  return {
    checkedNow: [...document.querySelectorAll('.grp-tier')].filter((t) => t.getAttribute('aria-checked') === 'true')
      .map((t) => t.querySelector('.grp-tier__seats').textContent.trim()),
    summaryCap: (document.querySelector('.grp-summary__rows') || {}).textContent || null,
  };
})()`));

say('create', await evaluate(`(async () => {
  const btn = [...document.querySelectorAll('.grp-submit')].find((b) => b.textContent.indexOf('ساخت گروه و گرفتن کد') >= 0);
  btn.click();
  await new Promise((r) => setTimeout(r, 150));
  const card = document.querySelector('.grp-card');
  if (!card) return { error: 'no card' };
  return {
    code: card.querySelector('.grp-card__code-value').textContent.trim(),
    codeDirection: getComputedStyle(card.querySelector('.grp-card__code-value')).direction,
    statusChip: card.querySelector('.grp-card__seats-head').textContent.trim(),
    seatsCount: card.querySelector('.grp-card__seats-count').textContent.trim(),
    seatsFill: getComputedStyle(card.querySelector('.grp-card__seats-fill')).width,
    seatsTrack: getComputedStyle(card.querySelector('.grp-card__seats-bar')).width,
    members: [...document.querySelectorAll('.grp-member')].map((m) => ({
      name: m.querySelector('.grp-member__name').textContent.trim(),
      meta: m.querySelector('.grp-member__meta').textContent.trim(),
    })),
    invite: card.querySelector('.grp-card__link').textContent.trim(),
    tabsGone: document.querySelectorAll('.grp-tab').length === 0,
    summaryRows: [...card.querySelectorAll('.grp-card__summary-row')].map((row) => row.textContent.trim()),
  };
})()`));

say('shotCard', await shot('.probe2-dark-1440-card.png', '.grp-card', 24));

/* ═══ ۳. کپی لینک دعوت ═══ */
say('copyLink', await evaluate(`(async () => {
  const buttons = [...document.querySelectorAll('.grp-copy')];
  const btn = buttons.find((b) => b.textContent.indexOf('لینک') >= 0) || buttons[buttons.length - 1];
  if (!btn) return { error: 'no copy button', found: buttons.length };
  const before = btn.textContent.trim();
  btn.click();
  await new Promise((r) => setTimeout(r, 250));
  return {
    buttons: buttons.map((b) => b.textContent.trim()),
    before,
    after: btn.textContent.trim(),
    copied: btn.classList.contains('is-copied'),
    failed: btn.classList.contains('is-failed'),
  };
})()`));

/* ═══ ۴. تب «پیوستن» — فقط در حالت تب‌دار معنا دارد ═══ */
say('joinTab', await evaluate(`(async () => {
  const tab = document.querySelector('#grp-tab-join');
  if (!tab) return { skipped: 'card state (گروه ساخته شده)' };
  tab.click();
  await new Promise((r) => setTimeout(r, 120));
  return { selected: tab.getAttribute('aria-selected') };
})()`));

/* ═══ ۵. تم روشن ═══ */
say('lightTheme', await setTheme('light'));
say('shotLightCard', await shot('.probe2-light-1440-card.png', '.grp-card', 24));
say('lightTokens', await evaluate(`(() => {
  const cs = getComputedStyle(document.querySelector('.grp-page'));
  const btn = document.querySelector('.grp-copy');
  return {
    accent: cs.getPropertyValue('--grp-accent').trim(),
    panel: cs.getPropertyValue('--grp-panel').trim(),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    cardBg: getComputedStyle(document.querySelector('.grp-card')).backgroundColor,
    copyBg: getComputedStyle(btn).backgroundColor,
  };
})()`));

/* ═══ ۶. موبایل ۳۹۰ ═══ */
await setTheme('dark');
await setViewport(390, 844);
await navigate(BASE + '#group', '.grp-page');
say('mobile', await evaluate(`(() => {
  const r = (s) => { const el = document.querySelector(s); if (!el) return null;
    const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
  const grid = document.querySelector('.grp-tiers__grid');
  return {
    shell: r('.grp-hero'), tier: r('.grp-tier'), tabs: r('.grp-tablist'),
    cols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`));
say('shotMobileHero', await shot('.probe2-dark-390-hero.png', '.grp-hero', 10));
say('shotMobileTiers', await shot('.probe2-dark-390-tiers.png', '.grp-tiers', 20));
say('shotMobileCard', await shot('.probe2-dark-390-card.png', '.grp-card', 20));

say('mobileLight', await setTheme('light'));
say('shotMobileLight', await shot('.probe2-light-390-card.png', '.grp-card', 20));

/* ═══ ۷. نوار هیرو در ۱۹۲۰ + کلیک بنر «با رفقا درس بخون» ═══ */
await setTheme('dark');
await setViewport(1920, 1000);
await navigate(BASE, '.hero__courses');
say('hero1920', await evaluate(`(() => {
  const r = (s) => { const el = document.querySelector(s); if (!el) return null;
    const b = el.getBoundingClientRect(); return { w: Math.round(b.width), x: Math.round(b.x), h: Math.round(b.height) }; };
  const card = document.querySelector('.hero__courses [aria-label]');
  return {
    strip: r('.hero__courses'), card: r('.hero__courses [aria-label]'), sectionShell: r('.promo-grid'),
    cardMinHeight: card ? getComputedStyle(card).minHeight : null,
    bannerHref: (document.querySelector('.friends-banner .button--orange') || {}).getAttribute
      ? document.querySelector('.friends-banner .button--orange').getAttribute('href') : null,
  };
})()`));
say('shotHeroStrip', await shot('.probe2-hero-1920.png', '.hero', 0));

say('bannerClick', await evaluate(`(async () => {
  const btn = document.querySelector('.friends-banner .button--orange');
  btn.click();
  await new Promise((r) => setTimeout(r, 500));
  return { hash: location.hash, grpPage: !!document.querySelector('.grp-page') };
})()`));
await settle();
say('shotFromBanner', await shot('.probe2-from-banner-1920.png', '.grp-hero', 10));

console.log('PROBE-DONE');
ws.close();
