/*
 * اصلاح جانبی: مهاجرت فونت `'Vazir'` را به مقدار دلخواه Tailwind
 * `[font-family:...]` اضافه کرد، ولی در فایل‌هایی که رشته با کوتیشن تک نوشته
 * شده (`'... [font-family:\'Pinar\',Tahoma]'`) کوتیشن‌ها escape نشده بودند و
 * رشتهٔ JS شکسته می‌شد. این اسکریپت داخل هر `[font-family:...]` که کوتیشن
 * escape‌شده دارد، کوتیشن‌های لخت را escape می‌کند.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/heidarian/Documents/my own project/tapeshweb/src';

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(jsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

let changedFiles = 0;
let changedValues = 0;
const report = [];

for (const file of walk(ROOT)) {
  const original = fs.readFileSync(file, 'utf8');

  const next = original.replace(/\[font-family:([^\]]*)\]/g, (full, body) => {
    /* فقط وقتی رشته با کوتیشن تک نوشته شده؛ یعنی داخلش `\'` داریم */
    if (!body.includes("\\'")) return full;

    const fixed = body.replace(/(?<!\\)'/g, "\\'");
    if (fixed === body) return full;

    changedValues += 1;
    report.push(`${path.relative(ROOT, file)}  [font-family:${body}]  →  [font-family:${fixed}]`);
    return `[font-family:${fixed}]`;
  });

  if (next !== original) {
    fs.writeFileSync(file, next);
    changedFiles += 1;
  }
}

console.log(`files changed:  ${changedFiles}`);
console.log(`values changed: ${changedValues}\n`);
for (const line of report) console.log(line);
