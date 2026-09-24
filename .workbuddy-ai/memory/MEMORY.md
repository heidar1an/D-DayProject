# تپش وب — یادداشت بلندمدت پروژه

## قواعد کار
- تغییرها باید در ساختار مینیمال موجود، هم‌زبان و هم‌رنگ پروژه انجام شوند؛ بازطراحی یا فایل/لایهٔ اضافه ممنوع مگر با درخواست صریح.
- توضیح نهایی کوتاه و مستقیم باشد. `npm install` و `npm run build` ممنوع؛ build پوشهٔ `dist/assets` را پاک می‌کند.
- قبل از تغییر، README ریشه و README همان لایه را بخوان؛ طبق قرارداد پروژه هر تغییر مرتبط، مستندات همان بخش را هم‌زمان به‌روزرسانی کن.
- برای تأیید React از `react-layer-headless-verify` و بررسی‌های بدون مرورگر/بدون build استفاده کن.

## معماری‌های حساس
- داده از UI جداست: `src/services/<domain>/` و `src/layout/dashboard/<domain>/`.
- ناوبری داشبورد hash-driven و متمرکز در `dashboardRoute.jsx` است. `useLayerRoute` باید `initialView` ثابت بیرون کامپوننت داشته باشد؛ تغییر صفحه push و تغییر زیرصفحه replace است؛ نماهای موقت (`live/lab/result/review`) در URL نمی‌آیند.
- جابه‌جایی صفحه باید هم کلید صفحه و هم `deep` را بنویسد. اعلان‌ها فقط از `NotificationsSection` استفاده کنند.
- OAuth گوگل فقط از مسیرهای سروری `database/googleAuth.js` و `/api/auth/google/*` انجام می‌شود؛ secret در مرورگر نیست؛ حساب ناقص به onboarding و کامل به dashboard می‌رود؛ پیکربندی ناقص نباید ورود ساختگی بسازد.
- صفحهٔ تعرفه‌ها مستقل است (`#pricing`)؛ داده و اعداد فقط در `services/pricing/pricingService.js`؛ لنگرهای داخلی در `PRICING_HASHES` ثبت شوند.
- پنج کارت کاتالوگ دوره‌ها باید یک تعریف مشترک داشته باشند: `CatalogCourseCard`/`CATALOG_COURSES`/`CatalogIcon` از `CoursesSection.jsx` و مقصد فقط از `COURSE_LAYERS` ساخته شود.
- لایهٔ یادداشت‌ها قرارداد تازه‌ای دارد (۱۸ سپتامبر): نوار بالای لایه (`LayerTopbar` در `NotesSection.jsx`) با «بازگشت به داشبورد» + دکمهٔ ساخت، هم‌چیدمان نوار فلش‌کارت؛ **مسیر متنی («داشبورد / یادداشت‌ها») حذف شده** و فاصلهٔ انتهای ردیف را `margin-inline-start: auto` خودِ دکمهٔ ساخت می‌گیرد؛ دکمهٔ ساخت در هیرو نیست. اعداد آماری کنار بخش خودشان‌اند، نه در یک ردیف جدا: شمارندهٔ سرتیتر «همهٔ یادداشت‌ها» = تعداد همان بخش، «گلچین‌شده‌ها» = همان بخش، «موضوع» کنار ردیف فیلتر موضوع، «این هفته» کنار نوار جست‌وجو. موضوع و تگ یک ردیف چیپ‌اند (`TopicChips`) با ظاهر `PathChip` بانک تست: یک ردیف افقی وسط‌چین با اسکرول پنهان، ترتیب «همه» ← «N موضوع» ← چیپ درس‌ها ← چیپ تگ‌ها، گروه‌بندی تگ فقط با رنگ آیکون؛ نوار تاشوی «دسته‌بندی تگ‌ها» وجود ندارد. `onBack` از `DashboardLayout` می‌آید.
- یادداشت‌ها — تپش هوشمند **یک نقطهٔ ورود** دارد: در ویرایشگر یک کادر خلاصه بالای فرم (یک آیکون wand + چهار چیپ کنش روی کل پیش‌نویس با `rewriteDraft`)، و در نمای یادداشت یک دکمه + پنل. آیکون کنار هر فیلد (بدنه/آیتم/پرسش‌وپاسخ/سلول جدول) و کامپوننت `AIAssist` برداشته شده‌اند؛ دوباره اضافه نکن مگر با درخواست صریح.
- انیمیشن ورود کارت‌ها با جابه‌جایی موضوع/تگ در یادداشت‌ها: `renderGrid` کلیدش `subjectFilter|tagFilter` است و کلاس `dash-stagger` دارد ⇒ گِرید از نو mount می‌شود و انیمیشن پله‌ای دوباره اجرا می‌شود. جست‌وجو و مرتب‌سازی عمداً در کلید نیستند. **تله:** گارد `prefers-reduced-motion` نباید `.nt-card` را در فهرست `animation: none !important` بگذارد — همان قانون انیمیشن `dash-stagger > *` را هم خفه می‌کند و چون کاهش حرکت روی این دستگاه روشن است، کاربر «هیچ انیمیشنی» می‌بیند.
- الگوی تکرارشوندهٔ چیپ فیلتر در این پروژه: `.nt-chip` مقادیر محاسبه‌شدهٔ `PathChip` (`BankHome.jsx`) را دارد — ارتفاع ۴۲، `padding: 10px 16px`، `font-size: 13px`، `gap: 8px`، حاشیهٔ ۸٪، `--surface`. برای چیپ فیلتر جدید، همین مقادیر را تکرار کن تا دو لایه هم‌شکل بمانند.

## دیزاین سیستم
- hex سخت‌کد نکن. توکن‌های تم در `src/styles.css` هستند؛ `--white` متن اصلی و `--pure` سفید واقعی است. رنگ‌های تیرهٔ wash/scrim/shadow از هم جدا هستند.
- هر اکسنت دو نسخه دارد: پرکننده (`--brown-bright`) و متن (`--brown-ink` که در تم روشن تیره می‌شود). `--brown-ink` تازه اضافه شد چون قهوه‌ای تنها اکسِنتی بود که نسخهٔ متن نداشت و `--brown-bright` روی زمینهٔ روشن فقط ۲٫۷۹:۱ کنتراست می‌داد (زیر آستانهٔ ۳:۱ خود پروژه). جفتش در `scripts/theme-contrast.mjs` ثبت شد. برای متن رنگی همیشه `-ink` بگیر، نه `-bright`.
- `--deep` سیاهِ خالص نیست (`#121212`، یک پله زیر `--background` = `#181818`) و `--scrim-rgb` هم `18 18 18` است؛ سیاهِ ماندگار فقط `--shadow-rgb`. پلِ Tailwind (`--color-black: var(--deep)` و `--color-white`) باید در `:root` پایه هم باشد، نه فقط بلوک تم روشن — وگرنه `bg-black/N` در تم تیره به پیش‌فرضِ `#000` Tailwind برمی‌گردد.
- `text-anchor` در SVG از `direction` پیروی می‌کند: در RTL برای گره‌های سمت راست `end` و سمت چپ `start` بده، وگرنه برچسب روی شکل خودش می‌افتد.
- توکن محلی لایه‌ها باید به توکن جهانی ارجاع دهد تا هر دو تم را بگیرد. `bg-[#hex]` تم‌پذیر نیست.
- فونت: متن Pinar، تیتر Doran، fallback اول Vazir سپس Tahoma؛ اعداد با `toFa`.
- selectorهای مشترک را به والد مقید کن؛ `.brand` فقط با `.site-header > .brand` تغییر کند.
- در ریل آیکونی: آیکون `flex-shrink: 0`، `gap: 0`، برچسب `min-width: 0`.
- `transition-delay` فقط روی opacity/transform باشد، نه border/color.

## بررسی‌های مجاز
- `npm run theme:check` بررسی جامع تم و رندر بدون build است.
- تست‌های داده: `node database/adminApi.test.mjs` و `node database/googleAuth.test.mjs`.
- بعد از افزودن ماژول، با `esbuild --bundle` یا هارنس مناسب خطای ESM را بررسی کن؛ دو اعلان هم‌نام در سطح ماژول کل اپ را سفید می‌کند.
- در `scripts/verify-render.mjs` داخل `String.raw` بکتیک خام نگذار؛ `node --check` برای تشخیص خطای syntax.
- `grep -r` در این سندباکس روی دایرکتوری بی‌صدا خالی برمی‌گرداند؛ برای جست‌وجو در کد از ابزار Grep استفاده کن.
- هارنس jsdom وقتی به `import.meta.glob` (ویژهٔ Vite، در `setting/avatar/avatarOptions.js`) می‌رسد با `TypeError: import_meta.glob is not a function` می‌میرد؛ `--define` هم تابع قبول نمی‌کند. با JS API یک پلاگین `onLoad` بگذار که `import.meta.glob(...)` را با `{}` جانشین کند.

## تله‌های تأییدشده
- قبل از اصلاح «هیچ کاری نمی‌کند»، handler را بخوان؛ تابع تعریف‌نشده در onClick اجرای بقیه را متوقف می‌کند.
- زیرنماها را با `SECTION_SUBVIEWS` و `sectionOf()` تشخیص بده، نه پیشوند رشته.
- در `useAsync(loader, deps)` شیء تازه در هر render حلقهٔ fetch می‌سازد؛ وابستگی پایدار بده.
- کد HTTP به‌تنهایی حقیقت نیست؛ مقدار تنظیماتی را حدس نزن. هر تیک سبز باید دقیقاً چیزی را ثابت کند که ادعا می‌کند؛ اگر API نمی‌تواند، `null` و نمایش `—`.
- افکت‌ها در SSR اجرا نمی‌شوند؛ محتوای پشت افکت باید export داخلی/قابل تست داشته باشد.
- افکت یک‌بار mount زیر StrictMode به `useRef` guard نیاز دارد.
- گارد مقدار `null` را صریحاً رد کند؛ `if (x.field && ...)` برای فیلد null عبور می‌دهد.
- **دو Edit روی یک فایل در یک پیام می‌تواند یکی را بی‌صدا بیندازد** (read-modify-write موازی). ۱۸ سپتامبر همین باعث شد امضای `NotesSection({ userData })` به `onBack` تغییر نکند در حالی که JSX از `onBack` استفاده می‌کرد ⇒ `ReferenceError` و چون ErrorBoundary نیست، کل اپ سفید شد. بعد از ویرایش‌های هم‌فایل، با grep تأیید کن که همه اعمال شده‌اند.
- **`agent-browser errors` پیام خالی می‌دهد و React خطای کامپوننت را فقط به‌صورت warning در کنسول می‌گذارد.** برای گرفتن متن واقعی خطا: `agent-browser open --init-script <file>` با اسکریپتی که `window.onerror` و `console.error` را در `window.__ntErrors` جمع می‌کند، بعد `eval "window.__ntErrors"`. تشخیص «سفیدی کل اپ» = `document.getElementById('root').innerHTML.length === 0` بدون overlay ویت.
- `agent-browser click "<css selector>"` همیشه نمی‌نشیند؛ برای تأیید handler از `eval "document.querySelector(...).click()"` استفاده کن.
- `npm run verify-render` لایهٔ یادداشت را پوشش نمی‌دهد؛ برای آن باید مسیر مرورگر واقعی رفت.
- کاهش حرکت macOS روی این دستگاه روشن است (`defaults read com.apple.universalaccess reduceMotion` برابر 1) و Chrome `prefers-reduced-motion: reduce` گزارش می‌کند؛ «محتوا هست ولی انیمیشن نیست» معمولاً تنظیم سیستم است، نه باگ. تغییرش فقط از System Settings انجام می‌شود.

## محیط و ابزار
- macOS 26.0 (25A354). نصب CommandLineTools ناقص است: در `/Library/Developer/CommandLineTools/SDKs/` سیم‌لینک‌ها شکسته‌اند و مقصدشان وجود ندارد، پس `xcrun`/`strings`/`otool`/`/usr/bin/git` روی stderr پیام `unable to locate a suitable SDK` می‌دهند. این پیام کشنده نیست (کار عادی انجام می‌شود) ولی در پنل Source Control به‌عنوان خطا دیده می‌شود. اصلاح ریشه‌ای: `sudo rm -rf /Library/Developer/CommandLineTools && sudo xcode-select --install`.
- `git` در این ماشین باید Homebrew باشد: `~/.local/bin/git` → `/opt/homebrew/bin/git` (۲٫۵۵). helper کیچین خودِ Homebrew (`git-credential-osxkeychain`) با `failed to get: 100001` خراب است؛ در `~/.gitconfig` لیست helper با یک `helper =` خالی ریست شده و به helper سالم خودِ git اپل (`/Library/Developer/CommandLineTools/usr/libexec/git-core/git-credential-osxkeychain`) اشاره می‌کند. این سیم‌لینک و override را برندار.
- در سندباکس Bash نمی‌توان در `~/.gitconfig` نوشت و `security add-internet-password` هم «Operation not permitted» می‌دهد؛ برای فایل‌های خانه از ابزار Edit استفاده کن.

## مسیرهای مرجع
- `README.md` ریشه: معماری، مسیرهای hash، تم، تایپوگرافی، بررسی‌ها و قواعد انیمیشن.
- `src/layout/admin/README.md` و README هر لایهٔ داشبورد: قرارداد همان لایه.
- `src/layout/pricing/README.md`: مدل و تعاملات تعرفه‌ها.
- `src/layout/products/README.md`: ریتم صفحهٔ محصولات، برگه‌ها، کادرهای چرخان، پیش‌نمایش‌ها و سنجه‌ها.
