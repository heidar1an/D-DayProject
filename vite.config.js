import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import usersApiPlugin from './database/apiPlugin.js';
import contentApiPlugin from './database/adminApiPlugin.js';
import tailwindcss from '@tailwindcss/vite';

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

console.log(
  googleReady
    ? '  ورود با گوگل: فعال'
    : '  ورود با گوگل: غیرفعال — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET را در .env بگذارید',
);

export default defineConfig({
  plugins: [react(), usersApiPlugin(), contentApiPlugin(), tailwindcss()],
  base: './',

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
        '**/public/uploads/**',
      ],
    },
  },
});
