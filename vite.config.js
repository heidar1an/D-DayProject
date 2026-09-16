import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import usersApiPlugin from './database/apiPlugin.js';
import contentApiPlugin from './database/adminApiPlugin.js';
import tailwindcss from '@tailwindcss/vite';

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
