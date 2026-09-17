import { writeFileSync } from 'node:fs';

const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = targets.find((item) => item.type === 'page');
if (!page) throw new Error('No page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => { ws.onopen = resolve; });
let nextId = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  const resolve = pending.get(message.id);
  if (resolve) { pending.delete(message.id); resolve(message); }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++nextId;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (!response.result || response.result.exceptionDetails) throw new Error(JSON.stringify(response));
  return response.result.result.value;
};
const waitFor = async (expression, timeout = 10000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await evaluate(expression)) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${expression}`);
};
const assert = (condition, message) => {
  if (!condition) throw new Error(`ASSERT: ${message}`);
  console.log(`PASS ${message}`);
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:5173/#about' });
await waitFor('!!document.querySelector(".ab-page")');
await evaluate("document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); true");

const desktop = await evaluate(`(() => {
  const rect = (selector) => { const node = document.querySelector(selector); if (!node) return null; const r = node.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), display: getComputedStyle(node).display }; };
  return {
    sections: [...document.querySelectorAll('.ab-page > section')].map((node) => node.className),
    future: Boolean(document.querySelector('.ab-future')),
    why: rect('.ab-why-flow'),
    sourceCards: document.querySelectorAll('.ab-why-flow__source-card').length,
    heroRingAnimations: [...document.querySelectorAll('.ab-pulse__ring')].map((node) => getComputedStyle(node).animationName),
    voice: rect('.ab-learners__voice'),
    principleAnimations: [...document.querySelectorAll('.ab-principle')].map((node) => {
      node.classList.add('is-in');
      return getComputedStyle(node.querySelector('.ab-principle__text')).animationName;
    }),
  };
})()`);
console.log(JSON.stringify(desktop, null, 2));
assert(desktop.sections.length === 11, 'About page has eleven DOM sections after deleting the future section');
assert(desktop.future === false, 'Deleted future section is absent from DOM');
assert(desktop.sourceCards === 3, 'Why-Tapesh visual has three relevant inputs');
assert(desktop.heroRingAnimations.every((name) => name === 'ab-pulse-ring-drift'), 'Hero rings have slow motion');
assert(desktop.principleAnimations.filter(Boolean).length === 6, 'All six principles have distinct entrance animation rules');
assert(desktop.voice?.w > 400 && desktop.voice?.h > 200, 'Learner voice is a stable desktop card');

const cycleSamples = await evaluate(`(async () => {
  const root = document.querySelector('.ab-cycle');
  const travel = root.getBoundingClientRect().height - innerHeight;
  const top = root.getBoundingClientRect().top + scrollY;
  const samples = [];
  for (const fraction of [0, 0.2, 0.5, 0.8, 1]) {
    scrollTo(0, top + travel * fraction);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = root.getBoundingClientRect();
    samples.push({ fraction, p: Number(getComputedStyle(root).getPropertyValue('--ab-p')), label: document.querySelector('.ab-cycle__panel-label')?.textContent, pointer: getComputedStyle(document.querySelector('.ab-cycle__pointer')).transform, expected: Math.min(1, Math.max(0, -rect.top / travel)) });
  }
  return samples;
})()`);
console.log(JSON.stringify(cycleSamples, null, 2));
assert(Math.abs(cycleSamples[1].p - 0.2) < 0.03, 'Cycle progress follows scroll at 20%');
assert(Math.abs(cycleSamples[3].p - 0.8) < 0.03, 'Cycle progress follows scroll at 80%');
assert(cycleSamples[0].label !== cycleSamples[4].label, 'Cycle reaches the final phase instead of getting stuck');
assert(cycleSamples.every((sample) => sample.pointer && sample.pointer !== 'none'), 'Cycle pointer is transformed at every sampled position');

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:5173/#about?mobile=1' });
await waitFor('!!document.querySelector(".ab-page")');
await evaluate("document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); true");
const mobile = await evaluate(`(() => {
  const voice = document.querySelector('.ab-learners__voice');
  const flow = document.querySelector('.ab-why-flow');
  return {
    voiceDisplay: getComputedStyle(voice).display,
    itemVoiceDisplay: getComputedStyle(document.querySelector('.ab-learners__item-voice')).display,
    flow: (() => { const r = flow.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })(),
  };
})()`);
console.log(JSON.stringify(mobile, null, 2));
assert(mobile.voiceDisplay === 'none', 'Mobile learner view avoids the desktop sticky voice panel');
assert(mobile.itemVoiceDisplay === 'block', 'Mobile learner rows include their own voice text');
assert(mobile.flow.w > 250 && mobile.flow.h > 250, 'Why-Tap visual remains usable on mobile');

const shots = [
  ['why', '.ab-why'],
  ['philosophy', '.ab-philosophy'],
  ['cycle', '.ab-cycle'],
  ['learners', '.ab-learners'],
];
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:5173/#about?shots=1' });
await waitFor('!!document.querySelector(".ab-page")');
for (const [name, selector] of shots) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'start' })`);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`.about-final-${name}.png`, Buffer.from(shot.result.data, 'base64'));
}
ws.close();
