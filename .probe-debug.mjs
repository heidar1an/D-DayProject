/* پروب عیب‌یابی — چرا .grp-page در مرورگر پیدا نمی‌شود؟ فایل موقت. */
const PORT = 9333;
const BASE = 'http://localhost:5199/';

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => { ws.onopen = resolve; });

let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(String(msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text).slice(0, 300));
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push('console.error: ' + (msg.params.args || []).map((a) => a.value ?? a.description).join(' ').slice(0, 200));
  }
  if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) =>
  new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (!res.result) return { __cdpError: JSON.stringify(res).slice(0, 200) };
  if (res.result.exceptionDetails) return { __jsError: JSON.stringify(res.result.exceptionDetails).slice(0, 300) };
  return res.result.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

console.log('before:', JSON.stringify(await evaluate(`({ href: location.href, ready: document.readyState })`)));

await send('Page.navigate', { url: BASE + '#group' });

for (const wait of [1000, 2000, 4000, 8000]) {
  await new Promise((r) => setTimeout(r, wait === 1000 ? 1000 : 1000));
  console.log('t+', JSON.stringify(await evaluate(`({
    href: location.href,
    ready: document.readyState,
    stale: document.documentElement.hasAttribute('data-probe-stale'),
    grp: !!document.querySelector('.grp-page'),
    rootChildren: (document.getElementById('root') || {}).childElementCount ?? null,
    bodyLen: document.body ? document.body.innerHTML.length : -1,
    all: document.querySelectorAll('*').length,
    title: document.title,
  })`)));
}

console.log('errors:', JSON.stringify(errors.slice(0, 6), null, 1));
ws.close();
