# تپش وب — یادداشت بلندمدت پروژه

## قواعد کار
- تغییرها در ساختار مینیمال موجود، هم‌زبان و هم‌رنگ پروژه؛ بازطراحی یا فایل/لایهٔ اضافه فقط با درخواست صریح. **قبل از حذف کامل، فهرست بده و تأیید/commit بگیر.**
- توضیح نهایی کوتاه و مستقیم. `npm install` و `npm run build` ممنوع (build پوشهٔ `dist/assets` را پاک می‌کند).
- قبل از تغییر، README ریشه و README همان لایه را بخوان و همان‌لحظه به‌روز کن.
- تأیید React با اسکیل `react-layer-headless-verify`، بدون مرورگر و بدون build؛ تست UI فقط با درخواست صریح.
- دیزاین: اسکیل `tapesh-design-system` (کپیِ `src/styles.css`)؛ هر تغییر توکن باید در `references/tokens.css` هم بیاید.

## معماری‌های حساس
- داده از UI جداست: `src/services/<domain>/` و `src/layout/dashboard/<domain>/`.
- ناوبری داشبورد hash-driven و متمرکز در `dashboardRoute.jsx`؛ `useLayerRoute` باید `initialView` ثابت بیرون کامپوننت داشته باشد؛ تغییر صفحه push و تغییر زیرصفحه replace است؛ نماهای موقت (`live/lab/result/review`) در URL نمی‌آیند. جابه‌جایی صفحه هم کلید صفحه و هم `deep` را می‌نویسد. اعلان‌ها فقط از `NotificationsSection`.
- OAuth گوگل فقط سروری (`database/googleAuth.js` و `/api/auth/google/*`)؛ secret در مرورگر نیست؛ حساب ناقص → onboarding و کامل → dashboard؛ پیکربندی ناقص نباید ورود ساختگی بسازد.
- تعرفه‌ها مستقل (`#pricing`)؛ داده و اعداد فقط در `services/pricing/pricingService.js`؛ لنگرها در `PRICING_HASHES`.
- کارت‌های کاتالوگ دوره‌ها یک تعریف مشترک: `CatalogCourseCard`/`CATALOG_COURSES`/`CatalogIcon` از `CoursesSection.jsx`، مقصد فقط از `COURSE_LAYERS`.
- پنل: `SECTIONS` در `AdminLayout.jsx` تنها منبع سایدبار (۱۰ آیتم)؛ زیرنماها با نگاشت صریح `SECTION_SUBVIEWS` + `sectionOf()` — **هرگز با تشخیص پیشوندی** (تلهٔ `media-center`).
- «صفحات» = رجیستری ۱۵ لایهٔ محصول؛ کارت لایه: `h3.ad-layercard__name` غیرکلیک‌پذیر + آیکون چشم + «ورود به لایه»؛ هاور هم‌رنگ آیکون گروه. `page-editor` از UI در دسترس نیست.
- لایه‌های داخل پنل (سایدبار ثابت می‌ماند): `ROUTABLE_VIEWS` + `SECTION_SUBVIEWS`→`pages` + `VIEW_TITLES` + case در `renderView`. مقصد «ورود به لایه» فقط از `LAYER_VIEWS` در `AdminPages.jsx` (`layerEntryTarget` شیء `{view,title}` می‌دهد نه رشته): `flashcards`→`flashcard-library` (گارد `canSendDeck`، ارسال = `PUT` با `status:'published'` → `/api/public/flashcards/library`) و `micro-lesson`→`micro-lesson` (→ `/api/public/micro/library`).
- میکرودرسنامه: کل ساختار در **یک رکورد** `microCourses` (مبحث→واحد→صفحه→متن/بلوک→ایستگاه) ⇒ ذخیره یک `PUT` کامل و انتشار اتمیک با `POST /api/admin/micro/:id/status`. ایستگاه تست دو منبع دارد: `pinnedQuestionIds` (بانک) + `questions[]` (دستی، بر فیلتر بانک اولویت دارد). **دو مسیر زیرِ `/api/admin/micro` باید پیش از `/:id` در جدول ROUTES بیایند: `test-bank` و `subjects`.**
- **`src/data/micro/registry.js` تک منبع حقیقت است** (`MICRO_COURSE_REGISTRY`/`MICRO_COURSE_SOURCES`/`MICRO_SUBJECT_OPTIONS`)؛ سرور (`contentStore.js`) و `microContentService.js` از آن می‌خوانند. **پسوند `.js` در importهایش عمدی است** (همین فایل در Node هم خوانده می‌شود).
- **seed میکرو = هر ۱۶ درس، سپس همگام‌سازی افزایشی.** `syncMicroCourses()` در `ensureStore()` درس‌های بدون رکورد را `draft` اضافه می‌کند و هیچ رکورد موجودی را بازنویسی نمی‌کند؛ یک‌بار در عمر پروسه (`microSynced`) و با `writeJson` مستقیم — **`writeCollection` از داخل `ensureStore` حلقهٔ بی‌پایان می‌سازد.**
- **متن صفحه = `page.content` (متن غنی)، نه بلوک.** ویرایشگر `RichTextEditor`؛ مبدل خالص `src/data/micro/blocksToHtml.js` بلوک‌های قدیمی را یک‌بار به HTML تبدیل می‌کند؛ سرور فقط وقتی `content` خالی است مشتق می‌گیرد. `blocks[]` آرشیو است و حذف نشد. سه نوع `figure`/`flashcards`/`quickQuestion` (`INTERACTIVE_BLOCK_TYPES`) به HTML تبدیل نمی‌شوند و خواننده آن‌ها را زیر `micr-rich` رندر می‌کند ⇒ بعد از مهاجرت به پایان صفحه می‌روند. خوانندهٔ داشبورد هنوز از رجیستری محلی می‌خواند (سوییچ به `/api/public/micro/library` نشده)، ولی رجیستری ۱۶/۱۶ است.
- **کتابخانهٔ فلش‌کارت کاربران = ثابت + منتشرشدهٔ پنل.** `flashcardService.js` حالا `/api/public/flashcards/library` را `fetch` می‌کند و `tapeshDecks()`/`tapeshCards()` دک‌های منتشرشده را **جلوی** دک‌های `mockData.js` ادغام می‌کنند (TTL ۱۵ ثانیه + `forceLibrary: true`؛ سرور قطع ⇒ سقوط به دک‌های ثابت). **تلهٔ کلاسیک پروژه: زنجیرهٔ سرور کامل بود ولی هیچ کد سمت کاربری مصرفش نمی‌کرد** ⇒ وقتی «تغییر پنل به کاربر نمی‌رسد»، اول بگرد ببین مسیر عمومی *مصرف* می‌شود یا نه.
- ویرایشگر فلش‌کارت پنل: چیپ‌های پنج‌گانهٔ `CARD_TYPES` ولی سرور ۴ نوع ⇒ `basic-hint` **فقط نمایش** است (`cardTypeOf`/`toStoredType`؛ سرنخ در `hint` می‌ماند). `validateDeck` سخت‌گیر (جلوی ذخیره را می‌گیرد) در مقابل `cardQualityHints` فقط هشدار. وضعیت انتشار سه‌گانه (`PUBLISH_OPTIONS`) + تنها دکمهٔ **«تأیید تغییرات»** در همان فرم.
- **میکرودرسنامه کاملاً داده‌محور است — برای درس تازه هیچ کد UI ننویس.** فقط `src/data/micro/<subjectId>Course.js` را بساز و در `COURSE_REGISTRY` (`microContentService.js`) ثبت کن. حالا **۱۶ درس** (۷۶ مبحث/۱۷ واحد/۹۰ صفحه/۵۷۸ بلوک). `id` درس = `subjectId` = کلید رجیستری. **فیزیولوژی عمداً اولین کلید است** (`firstPublishedCourse()` اولین عضو را برمی‌گرداند). قرارداد در `src/data/micro/README.md`.
- سه دیاگرام **عمومی داده‌محور** در `microDiagrams.jsx`: `flow` (`data.steps`)، `bars` (`data.items`)، `cycle` (`data.stages`)؛ کلید ناشناخته ⇒ `null`. سه دیاگرام دیگر (`pressure-timeline`/`wiggers`/`pv-loop`) ثابت و مخصوص فیزیولوژی قلب‌اند.
- **`unit.testBank.subjectId` را با `unit.subjectId` قاطی نکن** (موتور اولی را ترجیح می‌دهد). دو override عمدی: `genetics`→`biochemistry` و `english`→`esl`. `topicPath` باید مو‌به‌مو با مسیر بانک یکی باشد، وگرنه استخر بی‌صدا صفر می‌شود.
- **شکاف پوشش بانک تست (اندازه‌گیری‌شده):** ۵۹ سؤال و فقط ۷ درس از ۱۶ (physiology ۱۶ · biochemistry ۵ · anatomy ۴ · genetics ۲ · histology ۲ · microbiology ۲ · immunology ۱ · pathology ۱). **۹ واحد استخر صفر دارند** ⇒ حالت خالی، عمدی نه باگ UI؛ اول `questionPoolOf` و مسیرهای `testBank` را چک کن.
- لایهٔ یادداشت‌ها (۱۸ سپتامبر): نوار بالای لایه (`LayerTopbar` در `NotesSection.jsx`) با «بازگشت به داشبورد» + دکمهٔ ساخت، هم‌چیدمان نوار فلش‌کارت؛ **مسیر متنی («داشبورد / یادداشت‌ها») حذف شده** و فاصلهٔ انتهای ردیف را `margin-inline-start: auto` خودِ دکمهٔ ساخت می‌گیرد؛ دکمهٔ ساخت در هیرو نیست. اعداد آماری کنار بخش خودشان‌اند: شمارندهٔ «همهٔ یادداشت‌ها» = تعداد همان بخش، «گلچین‌شده‌ها» = همان بخش، «موضوع» کنار ردیف فیلتر موضوع، «این هفته» کنار نوار جست‌وجو. موضوع و تگ یک ردیف چیپ‌اند (`TopicChips`) با ظاهر `PathChip` بانک تست: یک ردیف افقی وسط‌چین با اسکرول پنهان، ترتیب «همه» ← «N موضوع» ← چیپ درس‌ها ← چیپ تگ‌ها، گروه‌بندی تگ فقط با رنگ آیکون؛ نوار تاشوی «دسته‌بندی تگ‌ها» وجود ندارد. `onBack` از `DashboardLayout` می‌آید.
- یادداشت‌ها — تپش هوشمند **یک نقطهٔ ورود** دارد: در ویرایشگر یک کادر خلاصه بالای فرم (یک آیکون wand + چهار چیپ کنش روی کل پیش‌نویس با `rewriteDraft`)، و در نمای یادداشت یک دکمه + پنل. آیکون کنار هر فیلد (بدنه/آیتم/پرسش‌وپاسخ/سلول جدول) و کامپوننت `AIAssist` برداشته شده‌اند؛ دوباره اضافه نکن.
- انیمیشن ورود کارت‌ها با جابه‌جایی موضوع/تگ در یادداشت‌ها: `renderGrid` کلیدش `subjectFilter|tagFilter` و کلاس `dash-stagger` ⇒ گِرید از نو mount می‌شود و انیمیشن پله‌ای دوباره اجرا می‌شود؛ جست‌وجو و مرتب‌سازی عمداً در کلید نیستند. **تله:** گارد `prefers-reduced-motion` نباید `.nt-card` را در `animation: none !important` بگذارد — قانون انیمیشن `dash-stagger > *` را هم خفه می‌کند.
- الگوی چیپ فیلتر: `.nt-chip` مقادیر محاسبه‌شدهٔ `PathChip` (`BankHome.jsx`) را دارد — ارتفاع ۴۲، `padding: 10px 16px`، `font-size: 13px`، `gap: 8px`، حاشیهٔ ۸٪، `--surface`.
- روی تصویر با `left/top` فیزیکی موقعیت بده نه `inset-inline-start` (تصویر با RTL آینه نمی‌شود). دکمهٔ تم فقط در `App.jsx`/`DashboardHeader.jsx`/`AdminLayout.jsx`.

## دیزاین سیستم
- hex سخت‌کد نکن. توکن‌های تم در `src/styles.css`؛ `--white` متن اصلی و `--pure` سفید واقعی است. رنگ‌های تیرهٔ wash/scrim/shadow جدا هستند.
- هر اکسنت دو نسخه دارد: پرکننده (`--brown-bright`) و متن (`--brown-ink`). `--brown-bright` روی زمینهٔ روشن فقط ۲٫۷۹:۱ کنتراست می‌داد (زیر آستانهٔ ۳:۱ پروژه) پس `--brown-ink` اضافه شد؛ جفتش در `scripts/theme-contrast.mjs`. برای متن رنگی همیشه `-ink` بگیر، نه `-bright`.
- `--deep` سیاه خالص نیست (`#121212`، یک پله زیر `--background` = `#181818`) و `--scrim-rgb` = `18 18 18`؛ سیاهِ ماندگار فقط `--shadow-rgb`. پل Tailwind (`--color-black: var(--deep)`، `--color-white`) باید در `:root` پایه هم باشد نه فقط تم روشن — وگرنه `bg-black/N` در تم تیره به `#000` برمی‌گردد.
- `text-anchor` در SVG از `direction` پیروی می‌کند: در RTL گره‌های راست `end` و چپ `start`، وگرنه برچسب روی شکل خودش می‌افتد.
- توکن محلی لایه‌ها باید به توکن جهانی ارجاع دهد تا هر دو تم را بگیرد؛ `bg-[#hex]` تم‌پذیر نیست.
- فونت: متن Pinar، تیتر Doran، fallback اول Vazir سپس Tahoma؛ اعداد با `toFa`.
- selectorهای مشترک را به والد مقید کن؛ `.brand` فقط با `.site-header > .brand`.
- در ریل آیکونی: آیکون `flex-shrink: 0`، `gap: 0`، برچسب `min-width: 0`.
- `transition-delay` فقط روی opacity/transform، نه border/color.

## بررسی‌های مجاز
- `npm run theme:check` بررسی جامع تم و رندر بدون build است؛ ولی گام آخرش (`verify-render.mjs`) به‌خاطر `node_modules/three` می‌افتد (خطای پیش‌موجود). `node database/adminApi.test.mjs` = ۹۲ سنجه.
- **`adminApi.test.mjs` فایل‌های `content/*.json` واقعی را بازنویسی می‌کند** (`contentStore.js` مستقیم می‌نویسد): `events.json` (تلمتری) به `[]` پاک می‌شود و `activity.json` (لاگ audit) و `updatedAt/lastLoginAt` در `admins.json` عوض می‌شوند ⇒ **قبل از اجرا بکاپ بگیر.** ولی `git checkout` کورکورانه نزن: `flashcardDecks.json` ویرایش محتوایی واقعی هم دارد؛ تفاوت را معنایی بسنج.
- تست‌های داده: `node database/adminApi.test.mjs` و `node database/googleAuth.test.mjs`.
- بعد از افزودن ماژول، با `esbuild --bundle` خطای ESM را بررسی کن؛ دو اعلان هم‌نام در سطح ماژول کل اپ را سفید می‌کند (`--external` برای react، glob را کوتیشن بگذار، `--outfile` به `/tmp`).
- در `scripts/verify-render.mjs` داخل `String.raw` بکتیک خام نگذار؛ `node --check` برای خطای syntax.
- `grep -r` سندباکس روی دایرکتوری بی‌صدا خالی برمی‌گرداند و `\|` را نمی‌فهمد ⇒ منفی کاذب؛ از ابزار Grep استفاده کن.
- هارنس jsdom روی `import.meta.glob` (در `setting/avatar/avatarOptions.js`) با `TypeError: import_meta.glob is not a function` می‌میرد و `--define` تابع قبول نمی‌کند ⇒ با JS API پلاگین `onLoad` بگذار که `import.meta.glob(...)` را با `{}` جانشین کند.
- رندر سرور: `AdminShell` تا `meta` نیاید `renderView()` را صدا نمی‌زند ⇒ نما را مستقیم رندر کن.
- **سنجش لایهٔ داده = هارنس قرارداد، نه رندر.** برای میکرودرسنامه هارنس خالص در `/tmp/*.src.mjs` بنویس (یکتایی `id`، پیوستگی `order`، زیرمجموعه بودن conceptهای صفحه، ارجاع `afterPage`/`scopePages`، فیلدهای الزامی هر block، تطابق طول `table.head` با ردیف‌ها، عضویت مسیرها در بانک) و با esbuild باندل کن. جزئیات در بخش «۶.۷» اسکیل `react-layer-headless-verify`.
- **هارنس دو نیمه:** نیمهٔ سرور (`contentStore`) را **بدون باندل** با نود خالی اجرا کن — `import.meta.url` مسیر `content/` را می‌سازد و باندل می‌شکندش. فقط نیمهٔ React باندل می‌شود.

## تله‌های تأییدشده
- قبل از اصلاح «هیچ کاری نمی‌کند»، handler را بخوان؛ تابع تعریف‌نشده در onClick اجرای بقیه را متوقف می‌کند.
- زیرنماها را با `SECTION_SUBVIEWS` و `sectionOf()` تشخیص بده، نه پیشوند رشته.
- در `useAsync(loader, deps)` شیء تازه در هر render حلقهٔ fetch می‌سازد؛ وابستگی پایدار بده.
- کد HTTP به‌تنهایی حقیقت نیست؛ مقدار تنظیماتی را حدس نزن. هر تیک سبز باید دقیقاً چیزی را ثابت کند که ادعا می‌کند؛ اگر API نمی‌تواند، `null` و نمایش `—`.
- افکت‌ها در SSR اجرا نمی‌شوند؛ محتوای پشت افکت باید export داخلی/قابل تست داشته باشد.
- افکت یک‌بار mount زیر StrictMode به `useRef` guard نیاز دارد.
- گارد مقدار `null` را صریحاً رد کند؛ `if (x.field && ...)` برای فیلد null عبور می‌دهد.
- **دو Edit روی یک فایل در یک پیام می‌تواند یکی را بی‌صدا بیندازد** (read-modify-write موازی). ۱۸ سپتامبر همین امضای `NotesSection({ userData })` را به `onBack` تغییر نداد در حالی که JSX از `onBack` استفاده می‌کرد ⇒ `ReferenceError` و چون ErrorBoundary نیست کل اپ سفید شد. بعد از ویرایش‌های هم‌فایل با grep تأیید کن. علامتش: `ReferenceError: X is not defined` برای چیزی که «قطعاً import کرده‌ای».
- **`agent-browser errors` پیام خالی می‌دهد و React خطای کامپوننت را فقط به‌صورت warning در کنسول می‌گذارد.** برای متن واقعی: `agent-browser open --init-script <file>` با اسکریپتی که `window.onerror` و `console.error` را در `window.__ntErrors` جمع می‌کند، بعد `eval "window.__ntErrors"`. «سفیدی کل اپ» = `document.getElementById('root').innerHTML.length === 0` بدون overlay ویت.
- `agent-browser click "<css selector>"` همیشه نمی‌نشیند؛ برای تأیید handler از `eval "document.querySelector(...).click()"` استفاده کن.
- `npm run verify-render` لایهٔ یادداشت را پوشش نمی‌دهد؛ برای آن مسیر مرورگر واقعی لازم است.
- `IconX` استفاده‌شده و importنشده در `AdminLayout.jsx` = سفیدی کل پنل.
- `MicroCompletion.jsx` **default export ندارد** (فقط named: `MicroCompletion`/`FinalAssessment`/`AssessmentResult`) — فرض `export default` باندل را با `No matching export … for import "default"` می‌اندازد.
- **نویسندهٔ هم‌زمان:** session دیگری ممکن است وسط کار همان فایل را بنویسد. **واقعاً رخ داد (۲۳ سپتامبر ۲۰۲۶):** یک session موازی ۱۵ فایل درسِ میکرو ساخت و `microContentService.js` را پیش از شروع من عوض کرده بود. قبل از هر کار روی این مخزن `git status` + mtime بگیر — خلاصهٔ گفتگو ممکن است کهنه باشد.
- **هر `readCollection` حدود ۱۵۰ms است — از دادهٔ زیاد نیست (اندازه‌گیری‌شده: با ۱ درس ۱۵۱ms، با ۱۶ درس ۱۵۰ms).** علت: `ensureStore()` آرگومان‌های `ensureFile` را از پیش می‌سازد و `seedAdmins()` داخلش `scryptSync` صدا می‌زند. رفع = تنبل‌کردن seedها؛ لمس زیرساخت مشترک، فقط با اجازهٔ کاربر.
- **توقعِ کهنه را باگ نپندار.** وقتی سنجه‌ای سرخ می‌شود اول *قرارداد فعلی* تابع/داده را بخوان: `layerEntryTarget` شیء `{view,title}` می‌دهد نه رشته، و شمارش `grep -c "id: 'deck-"` روی `mockData.js` `id` کارت‌ها را هم می‌شمارد (تعداد واقعی دک: `TAPESH_DECKS.length` = ۱۰).
- کاهش حرکت macOS روی این دستگاه روشن است (`defaults read com.apple.universalaccess reduceMotion` = 1) و Chrome `prefers-reduced-motion: reduce` گزارش می‌کند؛ «محتوا هست ولی انیمیشن نیست» معمولاً تنظیم سیستم است، نه باگ. بازیابی فایل پاک‌شدهٔ بدون commit: کش کروم (`sourcesContent`).

## محیط و ابزار
- macOS 26.0 (25A354). نصب CommandLineTools ناقص است: در `/Library/Developer/CommandLineTools/SDKs/` سیم‌لینک‌ها شکسته‌اند و مقصدشان وجود ندارد، پس `xcrun`/`strings`/`otool`/`/usr/bin/git` روی stderr پیام `unable to locate a suitable SDK` می‌دهند. این پیام کشنده نیست (کار عادی انجام می‌شود) ولی در پنل Source Control به‌عنوان خطا دیده می‌شود. اصلاح ریشه‌ای: `sudo rm -rf /Library/Developer/CommandLineTools && sudo xcode-select --install`.
- `git` در این ماشین باید Homebrew باشد: `~/.local/bin/git` → `/opt/homebrew/bin/git` (۲٫۵۵). helper کیچین خودِ Homebrew (`git-credential-osxkeychain`) با `failed to get: 100001` خراب است؛ در `~/.gitconfig` لیست helper با یک `helper =` خالی ریست شده و به helper سالم خودِ git اپل (`/Library/Developer/CommandLineTools/usr/libexec/git-core/git-credential-osxkeychain`) اشاره می‌کند. این سیم‌لینک و override را برندار.
- در سندباکس Bash نمی‌توان در `~/.gitconfig` نوشت و `security add-internet-password` هم «Operation not permitted» می‌دهد؛ برای فایل‌های خانه از ابزار Edit استفاده کن.
- `activity.json` سقف ۵۰۰ (`ACTIVITY_LIMIT` در `contentStore.js`) و `events.json` سقف ۲۰٬۰۰۰ + فیلتر ۱۸۰ روز (`EVENTS_LIMIT` در `analyticsStore.js`) دارند؛ هر دو «جدیدترین اول».
- مخزن یک بار (۲۴ سپتامبر ۲۰۲۶) واگرا شد (۲ جلو / ۳ عقب) و `pull.rebase=false` به‌صورت محلی تنظیم شد تا `git pull` بدون خطای «divergent branches» کار کند.

## مسیرهای مرجع
- `README.md` ریشه: معماری، مسیرهای hash، تم، تایپوگرافی، بررسی‌ها و قواعد انیمیشن.
- `src/layout/admin/README.md` و README هر لایهٔ داشبورد: قرارداد همان لایه.
- `src/layout/pricing/README.md`: مدل و تعاملات تعرفه‌ها.
- `src/layout/products/README.md`: ریتم صفحهٔ محصولات، برگه‌ها، کادرهای چرخان، پیش‌نمایش‌ها و سنجه‌ها.
