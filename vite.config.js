import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import usersApiPlugin from './database/apiPlugin.js';
import contentApiPlugin from './database/adminApiPlugin.js';
import examApiPlugin from './database/examApiPlugin.js';
import tailwindcss from '@tailwindcss/vite';
import { DEFAULT_SITE_URL } from './database/seo.js';
import { generateSeoFiles } from './database/seoFiles.js';

/*
 * `.env` را دستی داخل `process.env` می‌نویسیم.
 *
 * چرا لازم است: ویت فایل `.env` را می‌خواند، ولی فقط برای مرورگر
 * (`import.meta.env`) و فقط کلیدهای `VITE_*`. متغیرهای سروری مثل
 * `GOOGLE_CLIENT_ID` هرگز به `process.env` نمی‌رسند، پس middleware که در همین
 * پروسه اجرا می‌شود آن‌ها را نمی‌دید و ورود با گوگل همیشه «پیکربندی‌نشده»
 * می‌ماند — حتی با `.env` کاملاً درست. سکوتش هم خطرناک بود: هیچ خطایی نمی‌داد.
 *
 * `process.loadEnvFile` خودِ نود است (بدون وابستگی تازه) و متغیری که در پوسته
 * ست شده باشد را بازنویسی نمی‌کند — پوسته مقدم است.
 */
try {
  process.loadEnvFile(resolve(process.cwd(), '.env'));
} catch {
  /* .env نداریم؛ متغیرها می‌توانند از خود پوسته آمده باشند */
}

const googleReady = Boolean(
  String(process.env.GOOGLE_CLIENT_ID ?? '').trim() &&
    String(process.env.GOOGLE_CLIENT_SECRET ?? '').trim(),
);

/* خروجی‌های SEO را پس از هر build بنویس؛ خود Vite پیش از build dist را پاک می‌کند. */
function seoOutputPlugin() {
  let resolvedConfig;

  return {
    name: 'tapesh-seo-output',
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config;
    },
    closeBundle() {
      const result = generateSeoFiles({
        rootDir: resolvedConfig.root,
        outDir: resolve(resolvedConfig.root, resolvedConfig.build.outDir),
      });

      console.log(`  SEO: robots.txt و sitemap.xml در ${result.outputDir} ساخته شد`);
      if (result.siteUrl === DEFAULT_SITE_URL) {
        console.warn('  SEO: PUBLIC_SITE_URL تنظیم نشده — دامنهٔ پیش‌فرض توسعه استفاده شد.');
      }
    },
  };
}

console.log(
  googleReady
    ? '  ورود با گوگل: فعال'
    : '  ورود با گوگل: غیرفعال — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET را در .env بگذارید',
);

export default defineConfig({
  plugins: [react(), usersApiPlugin(), contentApiPlugin(), examApiPlugin(), tailwindcss(), seoOutputPlugin()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          three: ['three'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },

  /*
   * دادهٔ زمان‌اجرا از ناظر ویت کنار گذاشته می‌شود.
   *
   * سرور در هر درخواست، فایل‌های JSON را بازنویسی می‌کند (لاگ رویداد، ردیاب
   * بازدید، کاربران) و ویت هر نوشتن در ریشهٔ پروژه را «فایل ناشناس» می‌بیند؛
   * چون این فایل‌ها در گراف ماژول نیستند، ویت برای احتیاط کل صفحه را
   * `full-reload` می‌کند. نتیجه‌اش این بود که پنل مدیریت هر چند ثانیه یک‌بار
   * رفرش می‌شد و یک حلقهٔ خودتقویت‌شونده می‌ساخت (رفرش → ردیاب → نوشتن → رفرش).
   *
   * `ignored` به فهرست پیش‌فرض ویت **اضافه** می‌شود، پس کد بک‌اند
   * (`database/*.js`) همچنان زیر نظر می‌ماند و تغییرش سرور را ری‌استارت می‌کند.
   *
   * `publishing.secrets.json` هم همان‌جا نشسته چون توکن ربات‌های انتشار است و
   * با هر ثبت/تغییر توکن بازنویسی می‌شود. `media.secrets.json` همان چیز برای
   * کلیدهای اپ و توکن اکانت‌های مرکز رسانه است.
   */
  server: {
    watch: {
      ignored: [
        '**/database/content/**',
        '**/database/publishing.secrets.json',
        '**/database/media.secrets.json',
        '**/database/users.json',
        '**/database/users.sessions.json',
        '**/public/uploads/**',
      ],
    },
  },
});
