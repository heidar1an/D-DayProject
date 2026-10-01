/*
 * auth-render-check — دودِ رندرِ صفحهٔ ورود/ثبت‌نام بدون مرورگر.
 *
 * چرا جدا از `verify-render.mjs`: آن هارنس کلِ درخت را می‌رنجد و در این محیط
 * (سندباکس) پیش از پایان SIGTERM می‌گیرد. این‌جا فقط یک کامپوننت باندل و رندر
 * می‌شود: هم سبک است، هم خطای `ReferenceError` در لایهٔ بازطراحی‌شده را همان‌جا
 * می‌گیرد. CSS اجرا نمی‌شود، پس چیدمان سنجیده نمی‌شود.
 *
 * اجرا: node scripts/auth-render-check.mjs
 */
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, 'node_modules/.cache/tapesh-auth-check');
mkdirSync(CACHE, { recursive: true });

const entry = path.join(CACHE, 'entry.jsx');
writeFileSync(
  entry,
  `import { renderToStaticMarkup } from 'react-dom/server';
import { AuthPage } from ${JSON.stringify(path.join(ROOT, 'src/App.jsx'))};

const noop = () => {};
const modes = ['register', 'login'];
const out = {};

for (const initialMode of modes) {
  try {
    out[initialMode] = renderToStaticMarkup(
      <AuthPage onBack={noop} onLoginSuccess={noop} onRegisterSuccess={noop} initialMode={initialMode} />,
    );
  } catch (error) {
    out[initialMode] = 'RENDER_ERROR: ' + (error && error.stack ? error.stack : String(error));
  }
}

export default out;
`,
);

const outfile = path.join(CACHE, 'bundle.mjs');
await build({
  entryPoints: [entry],
  bundle: true,
  jsx: 'automatic',
  format: 'esm',
  platform: 'node',
  outfile,
  external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime'],
  /*
   * `node_modules/three` در این محیط package.json درستی ندارد، پس esbuild
   * نمی‌تواند حلش کند. فقط دو ماژول موتور آناتومی آن را import می‌کنند و این
   * بررسی هیچ‌وقت صحنهٔ سه‌بعدی را رندر نمی‌کند — همان استابِ `verify-render`.
   */
  plugins: [
    {
      /*
       * `import.meta.glob` فقط در Vite وجود دارد، پس باندلِ خالیِ esbuild روی
       * کاتالوگ آواتار می‌افتد. همان استابِ `verify-render`: شناسه‌ها و آدرس‌های
       * ساختگی، چون این بررسی تعدادِ چهره‌ها را می‌سنجد نه فایل واقعی را.
       */
      name: 'stub-avatar-catalog',
      setup(api) {
        api.onLoad({ filter: /setting[\\/]avatar[\\/]avatarOptions\.js$/ }, () => ({
          contents: `
            export const AVATAR_IDS = ['01', '02', '03'];
            export const AVATAR_IMAGES = AVATAR_IDS.map((id) => ({ id, src: '/avatar/' + id + '.webp' }));
            export const DEFAULT_AVATAR = '01';
            export function isValidAvatar(id) { return AVATAR_IDS.includes(id); }
            export function avatarSrc(value) { return value ? '/avatar/' + value + '.webp' : null; }
            export function fallbackAvatarSrc() { return '/avatar/01.webp'; }
          `,
          loader: 'js',
        }));
      },
    },
    {
      name: 'stub-three-engine',
      setup(api) {
        api.onLoad(
          { filter: /anatomy3d[\\/]engine[\\/](AnatomyEngine|anatomyMaterials)\.js$/ },
          () => ({
            contents: `
              export class AnatomyEngine {
                constructor() {}
                mount() {}
                dispose() {}
                reset() {}
              }
              export function buildCategoryMaterials() {
                return { default: {}, hover: {}, selected: {} };
              }
            `,
            loader: 'js',
          }),
        );
      },
    },
  ],
  loader: {
    '.png': 'dataurl',
    '.webp': 'dataurl',
    '.svg': 'dataurl',
    '.jpg': 'dataurl',
    '.jpeg': 'dataurl',
    '.glb': 'dataurl',
    '.css': 'empty',
  },
  logLevel: 'error',
});

/*
 * شیمِ حداقلیِ مرورگر — چند سرویس در سطح ماژول به `window`/`localStorage` دست
 * می‌زنند و بدون این‌ها import می‌ترکد. عمداً کوچک است: هرچه لازم نشود، ساخته
 * نمی‌شود تا نقصِ واقعی پنهان نماند.
 */
const noop = () => {};
globalThis.window = globalThis;
globalThis.location = { hash: '', href: 'http://localhost/', search: '', pathname: '/' };
globalThis.matchMedia = () => ({
  matches: false,
  addEventListener: noop,
  removeEventListener: noop,
  addListener: noop,
  removeListener: noop,
});
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.localStorage = {
  getItem: () => null,
  setItem: noop,
  removeItem: noop,
  clear: noop,
};
globalThis.document = {
  documentElement: { dataset: {}, style: {}, classList: { add: noop, remove: noop, toggle: noop } },
  head: { appendChild: noop },
  body: { appendChild: noop, classList: { add: noop, remove: noop } },
  addEventListener: noop,
  removeEventListener: noop,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ style: {}, dataset: {}, setAttribute: noop, appendChild: noop }),
};

const { default: out } = await import(pathToFileURL(outfile).href);

let failed = 0;
const check = (label, ok, extra = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);
};

for (const mode of ['register', 'login']) {
  const html = out[mode];
  if (html.startsWith('RENDER_ERROR')) {
    check(`رندر حالت ${mode}`, false, html.split('\n').slice(0, 6).join(' | '));
    continue;
  }

  check(`رندر حالت ${mode} بدون خطا`, true);
  check(`${mode}: کارتِ تصویرگرافیک`, html.includes('auth-visual__card'));
  check(`${mode}: تصویرِ جلد`, /auth-visual__image[^>]*src="data:image\/webp/.test(html));
  check(`${mode}: پشتهٔ آواتار`, (html.match(/auth-visual__avatars"[\s\S]*?<\/span>/) || [''])[0].split('<img').length - 1 === 4);
  check(`${mode}: چهار مزیت`, (html.match(/auth-visual__feature /g) || []).length === 4);
  check(`${mode}: دکمهٔ گوگل`, html.includes('auth-form__google'));
  check(`${mode}: فیلد تلفن`, html.includes('id="auth-phone"'));
  check(`${mode}: فیلد رمز`, html.includes('id="auth-password"'));
  check(`${mode}: سوئیچ حالت`, html.includes('auth-form__switch'));
  check(`${mode}: دکمهٔ ارسال`, html.includes('auth-form__submit'));
  check(`${mode}: نشانِ تیکِ اعتبار`, (html.match(/auth-field__check/g) || []).length >= 2);
  check(`${mode}: منحنی‌های تزئینی`, html.includes('auth-page__curves'));
  check(`${mode}: هالهٔ پس‌زمینه`, html.includes('auth-page__aura'));
  check(`${mode}: تیکِ اعتبار در آغاز پنهان است`, !html.includes('auth-field is-valid'));

  if (mode === 'register') {
    check('ثبت‌نام: فیلد تکرار رمز', html.includes('id="auth-password-confirm"'));
    check('ثبت‌نام: چک‌باکس قوانین', html.includes('name="consent"'));
    check('ثبت‌نام: عنوان ثبت‌نام', html.includes('ثبت نام در'));
  } else {
    check('ورود: فیلد تکرار رمز نیست', !html.includes('id="auth-password-confirm"'));
    check('ورود: چک‌باکس قوانین نیست', !html.includes('name="consent"'));
    check('ورود: دکمهٔ فراموشی رمز', html.includes('auth-form__forgot'));
    check('ورود: عبارت تایپ‌شونده', html.includes('auth-animated-phrase'));
  }
}

rmSync(CACHE, { recursive: true, force: true });
console.log(failed === 0 ? '\nهمهٔ سنجه‌ها سبز' : `\n${failed} سنجه سرخ`);
process.exit(failed === 0 ? 0 : 1);
