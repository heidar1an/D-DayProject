# تپش وب — یادداشت بلندمدت

## قواعد کار
- تغییر حداقلی و هم‌رنگ ساختار موجود؛ بازطراحی/فایل تازه فقط با درخواست صریح. **قبل از حذف کامل، فهرست را بده و تأیید/commit بگیر.**
- `npm install` و `npm run build` ممنوع (build پوشهٔ `dist/assets` را پاک می‌کند). README ریشه + README همان لایه را بخوان و هم‌زمان به‌روز کن.
- تأیید React با اسکیل `react-layer-headless-verify` (بدون مرورگر/بیلد)؛ تست UI فقط با درخواست صریح.
- مرجع: `README.md` ریشه، README هر لایه، `src/layout/admin/README.md`. توکن/رنگ/فونت در `src/styles.css` و اسکیل `tapesh-design-system`؛ هر تغییر توکن باید در `references/tokens.css` آن هم بیاید.

## معماری حساس
- جدایی داده از UI: `src/services/<domain>/` و `src/layout/dashboard/<domain>/`.
- ناوبری داشبورد hash-driven در `dashboardRoute.jsx`؛ `useLayerRoute` باید `initialView` ثابت بیرون کامپوننت داشته باشد؛ نماهای موقت (`live/lab/result/review`) در URL نمی‌آیند.
- OAuth گوگل فقط سروری (`database/googleAuth.js` + `/api/auth/google/*`)؛ secret در مرورگر نیست. تعرفه‌ها مستقل (`#pricing`)؛ اعداد فقط در `services/pricing/pricingService.js`.
- پنج کارت کاتالوگ یک تعریف مشترک: `CatalogCourseCard`/`CATALOG_COURSES`/`CatalogIcon` از `CoursesSection.jsx`؛ مقصد فقط از `COURSE_LAYERS`.
- «صفحات» پنل = رجیستری لایه‌های محصول (`AdminPages.jsx`، `LAYER_GROUPS`/`LAYER_ICONS`)؛ داده `contentStore.js` + `database/content/pages.json`.
- زیرنمای پنل: نگاشت صریح `SECTION_SUBVIEWS` + `sectionOf()`. **زیرنمای تازه را با تشخیص پیشوندی نساز** (تلهٔ `media-center`). `SECTIONS` تنها منبع سایدبار پنل است (`AdminLayout.jsx`).
- یادداشت‌ها: `LayerTopbar` با «بازگشت» + دکمهٔ ساخت؛ موضوع+تگ یک ردیف چیپ؛ تپش هوشمند **یک نقطهٔ ورود**؛ `AIAssist` برنگردد. **گارد `prefers-reduced-motion` نباید `.nt-card` را `animation: none` کند.**
- میکرودرس: فهرست مبحث‌ها یکدست فعال؛ `.micr-topics__soon` = حالت خالی کل درس. حلقهٔ درصد: `strokeDashoffset` هم ویژگی SVG و هم انیمیشن با `fill-mode: both`.

## بررسی‌ها و تله‌ها
- `npm run theme:check` — سه گام اول سالم؛ **گام آخر (`verify-render.mjs`) می‌افتد** (`node_modules/three` بدون `package.json`). `node database/adminApi.test.mjs` (۷۸ سنجه) و `node database/googleAuth.test.mjs`.
- `esbuild --bundle` برای گرفتن خطای ESM (در zsh glob را کوتیشن بگذار، `--outfile` به `/tmp`). هارنس jsdom روی `import.meta.glob` می‌میرد؛ با پلاگین `onLoad` با `{}` جانشین کن.
- **`SECTIONS` آیکون‌ها را از ایمپورت همان فایل می‌گیرد:** `IconX` استفاده‌شده و importنشده = `ReferenceError` سطح ماژول = سفیدی کل پنل.
- `useAsync(loader, deps)`: شیء تازه در هر render حلقهٔ fetch می‌سازد؛ وابستگی پایدار بده. گارد باید `null` را صریح رد کند. افکت در SSR اجرا نمی‌شود و یک‌بار mount گارد `useRef` می‌خواهد.
- هر تیک سبز باید دقیقاً همان ادعا را ثابت کند وگرنه `null` و `—`. سفیدی کل اپ = `root.innerHTML.length === 0`؛ `agent-browser click` همیشه نمی‌نشیند، از `eval` استفاده کن.
- کاهش حرکت macOS روشن است؛ «محتوا هست ولی انیمیشن نیست» تنظیم سیستم است نه باگ. بازیابی فایل پاک‌شده بدون commit: کش کروم (`sourcesContent`) — جزئیات در لاگ ۲۳ سپتامبر.
