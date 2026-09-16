import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/heidarian/Documents/my own project/tapeshweb/src';

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(css|jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const NEUTRAL_MAX_SAT = 14;

function parseRgb(r, g, b) {
  return [Number(r), Number(g), Number(b)];
}
function lightness(r, g, b) {
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}
function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return 0;
  const d = max - min;
  return l > 127 ? (d / (510 - max - min)) * 100 : (d / (max + min)) * 100;
}
function hue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

const RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g;

const buckets = new Map();
const files = walk(ROOT);

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = RE.exec(text))) {
    const [full, r, g, b, a] = m;
    const [R, G, B] = parseRgb(r, g, b);
    const sat = saturation(R, G, B);
    const L = lightness(R, G, B);
    const key =
      sat <= NEUTRAL_MAX_SAT
        ? `neutral L=${Math.round(L)} a=${a ?? '1'}`
        : `hue=${Math.round(hue(R, G, B) / 10) * 10} rgb(${R},${G},${B}) a=${a ?? '1'}`;
    if (!buckets.has(key)) buckets.set(key, { count: 0, sample: full, files: new Set() });
    const entry = buckets.get(key);
    entry.count += 1;
    entry.files.add(path.relative(ROOT, file));
  }
}

const sorted = [...buckets.entries()].sort((a, b) => b[1].count - a[1].count);
console.log(`distinct rgba signatures: ${sorted.length}\n`);
for (const [key, entry] of sorted) {
  console.log(`${String(entry.count).padStart(3)}  ${key.padEnd(34)} ${entry.sample}`);
}
