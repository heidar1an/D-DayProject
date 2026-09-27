# تپش وب — یادداشت بلندمدت

## قواعد
- تغییر حداقلی و هم‌رنگ ساختار موجود؛ فایل تازه فقط با درخواست صریح. **قبل از حذف، فهرست بده و تأیید بگیر.**
- `npm install` و `npm run build` ممنوع (build `dist/assets` را پاک می‌کند). README ریشه و README همان لایه هم‌زمان.
- تأیید React با اسکیل `react-layer-headless-verify`؛ تست UI فقط با درخواست صریح.
- دیزاین: اسکیل `tapesh-design-system` (کپیِ `src/styles.css`)؛ هر تغییر توکن باید در `references/tokens.css` هم بیاید.

## معماری
- داده از UI جدا: `src/services/<domain>/` و `src/layout/dashboard/<domain>/`.
- داشبورد hash-driven در `dashboardRoute.jsx`؛ `useLayerRoute` باید `initialView` ثابت بیرون کامپوننت داشته باشد؛ نماهای موقت در URL نمی‌آیند.
- OAuth گوگل فقط سروری. اعداد تعرفه فقط در `services/pricing/pricingService.js`. کارت‌های کاتالوگ یک تعریف مشترک در `CoursesSection.jsx`.
- پنل: `SECTIONS` در `AdminLayout.jsx` تنها منبع سایدبار (۱۰ آیتم)؛ زیرنماها با نگاشت صریح `SECTION_SUBVIEWS` + `sectionOf()` — **هرگز با تشخیص پیشوندی** (تلهٔ `media-center`).
- «صفحات» = رجیستری ۱۵ لایهٔ محصول؛ کارت لایه: `h3.ad-layercard__name` غیرکلیک‌پذیر + آیکون چشم + «ورود به لایه»؛ هاور هم‌رنگ آیکون گروه. `page-editor` از UI در دسترس نیست.
- لایهٔ داخل پنل (سایدبار ثابت): `ROUTABLE_VIEWS` + `SECTION_SUBVIEWS`→`pages` + `VIEW_TITLES` + case در `renderView`. مقصد «ورود به لایه» فقط از `LAYER_VIEWS` در `AdminPages.jsx` (`layerEntryTarget` شیء `{view,title}`): `flashcards`→`flashcard-library` (گارد `canSendDeck`، ارسال = `PUT` با `status:'published'` → `/api/public/flashcards/library`) و `micro-lesson`→`micro-lesson` (→ `/api/public/micro/library`).
- **میکرو داده‌محور است — برای درس تازه کد UI ننویس:** فقط `src/data/micro/<subjectId>Course.js` بساز و در `COURSE_REGISTRY` (`microContentService.js`) ثبت کن. `id` درس = `subjectId` = کلید رجیستری. **فیزیولوژی عمداً اولین کلید است** (`firstPublishedCourse()` اولین عضو را می‌دهد). قرارداد در `src/data/micro/README.md`.
- **`src/data/micro/registry.js` تک منبع حقیقت است** (`MICRO_COURSE_REGISTRY`/`MICRO_COURSE_SOURCES`/`MICRO_SUBJECT_OPTIONS`)؛ هم سرور (`contentStore.js`) هم `microContentService.js` از آن می‌خوانند. **پسوند `.js` در importهایش عمدی است** (در Node هم خوانده می‌شود).
- **seed میکرو = هر ۱۶ درس، سپس همگام‌سازی افزایشی.** `syncMicroCourses()` در `ensureStore()` فقط درس‌های بدون رکورد را `draft` اضافه و `content` صفحه‌های پیش از مهاجرت را پر می‌کند؛ رکورد موجود را بازنویسی نمی‌کند. یک‌بار در عمر پروسه (`microSynced`) با `writeJson` مستقیم — **`writeCollection` داخل `ensureStore` حلقهٔ بی‌پایان می‌سازد.**
- میکرو: کل ساختار در **یک رکورد** `microCourses` (مبحث→واحد→صفحه→متن/بلوک→ایستگاه) ⇒ ذخیره یک `PUT` کامل، انتشار اتمیک با `POST /api/admin/micro/:id/status`. ایستگاه تست دو منبع: `pinnedQuestionIds` (بانک) + `questions[]` (دستی، اولویت بر بانک). **`test-bank` و `subjects` باید پیش از `/:id` در ROUTES بیایند.**
- **متن صفحه = `page.content` (متن غنی)، نه بلوک.** ویرایشگر `RichTextEditor`؛ مبدل خالص `blocksToHtml.js` بلوک‌های قدیمی را یک‌بار به HTML می‌برد؛ سرور فقط وقتی `content` خالی است مشتق می‌گیرد (ویرایش ادمین بازنویسی نمی‌شود). `blocks[]` آرشیو است، حذف نشد. `INTERACTIVE_BLOCK_TYPES` (`figure`/`flashcards`/`quickQuestion`) به HTML نمی‌روند و زیر `micr-rich` رندر می‌شوند ⇒ بعد از مهاجرت به پایان صفحه می‌روند.
- سه دیاگرام **عمومی داده‌محور** در `microDiagrams.jsx`: `flow`(`data.steps`)/`bars`(`data.items`)/`cycle`(`data.stages`)؛ کلید ناشناخته ⇒ `null`. سه دیاگرام `pressure-timeline`/`wiggers`/`pv-loop` ثابت و مخصوص قلب.
- **`unit.testBank.subjectId` را با `unit.subjectId` قاطی نکن** (موتور اولی را ترجیح می‌دهد). دو override عمدی: `genetics`→`biochemistry`، `english`→`esl`. `topicPath` باید مو‌به‌مو با بانک یکی باشد وگرنه استخر بی‌صدا صفر می‌شود.
- **شکاف پوشش بانک تست (اندازه‌گیری‌شده):** ۵۹ سؤال، فقط ۷ درس از ۱۶ (physiology ۱۶ · biochemistry ۵ · anatomy ۴ · genetics ۲ · histology ۲ · microbiology ۲ · immunology ۱ · pathology ۱). **۹ واحد استخر صفر دارند** ⇒ حالت خالی عمدی است نه باگ UI؛ اول `questionPoolOf` و مسیرهای `testBank` را چک کن.
- **کتابخانهٔ فلش‌کارت کاربران = ثابت + منتشرشدهٔ پنل.** `flashcardService.js` حالا `/api/public/flashcards/library` را `fetch` می‌کند و `tapeshDecks()`/`tapeshCards()` دک‌های منتشرشده را **جلوی** دک‌های ثابت `mockData.js` ادغام می‌کنند (TTL ۱۵ ثانیه + `forceLibrary: true`؛ سرور قطع ⇒ سقوط به ثابت‌ها). **تلهٔ کلاسیک پروژه: زنجیرهٔ سرور کامل ولی هیچ کد سمت کاربری مصرفش نمی‌کند** ⇒ «تغییر پنل به کاربر نمی‌رسد» = اول ببین مسیر عمومی *مصرف* می‌شود.
- ویرایشگر فلش‌کارت: `CARD_TYPES` پنج‌گانه ولی سرور ۴ نوع ⇒ `basic-hint` فقط نمایشی (`cardTypeOf`/`toStoredType`؛ سرنخ در `hint`). `validateDeck` سخت‌گیر (جلوی ذخیره) در مقابل `cardQualityHints` هشدار. `PUBLISH_OPTIONS` سه‌گانه + تنها دکمهٔ **«تأیید تغییرات»** در همان فرم.
- یادداشت‌ها: تپش هوشمند یک نقطهٔ ورود؛ گارد `prefers-reduced-motion` نباید `.nt-card` را `animation:none` کند.
- روی تصویر با `left/top` فیزیکی موقعیت بده نه `inset-inline-start` (تصویر با RTL آینه نمی‌شود). متن Pinar، تیتر Doran، اعداد `toFa`. دکمهٔ تم فقط در `App.jsx`/`DashboardHeader.jsx`/`AdminLayout.jsx`.

## بررسی و تله
- `npm run theme:check` گام آخر (`verify-render.mjs`) به‌خاطر `node_modules/three` می‌افتد (خطای پیش‌موجود). `node database/adminApi.test.mjs` = ۹۲ سنجه.
- **`adminApi.test.mjs` فایل‌های واقعی `content/*.json` را بازنویسی می‌کند:** `events.json`→`[]`، `activity.json` و `updatedAt/lastLoginAt` عوض می‌شوند ⇒ **قبل از اجرا بکاپ بگیر.** ولی `git checkout` کورکورانه نزن: `flashcardDecks.json` ویرایش محتوایی واقعی هم دارد. تفاوت را معنایی بسنج.
- **`grep` سندباکس `\|` را نمی‌فهمد** ⇒ منفی کاذب؛ از ابزار Grep استفاده کن.
- esbuild: `--external` برای react، glob را کوتیشن بگذار، `--outfile` به `/tmp`. هارنس jsdom روی `import.meta.glob` می‌میرد (پلاگین `onLoad` با `{}`). `MicroCompletion.jsx` **default export ندارد** (فقط named: `MicroCompletion`/`FinalAssessment`/`AssessmentResult`).
- رندر سرور: `AdminShell` تا `meta` نیاید `renderView()` را صدا نمی‌زند ⇒ نما را مستقیم رندر کن. `IconX` استفاده‌شده و importنشده در `AdminLayout.jsx` = سفیدی کل پنل.
- `useAsync(loader,deps)`: وابستگی پایدار بده وگرنه حلقهٔ fetch. هر تیک سبز باید دقیقاً همان ادعا را ثابت کند.
- **سنجش لایهٔ داده = هارنس قرارداد، نه رندر.** هارنس خالص در `/tmp/*.src.mjs` (یکتایی `id`، پیوستگی `order`، زیرمجموعه بودن conceptهای صفحه، ارجاع `afterPage`/`scopePages`، فیلدهای الزامی block، تطابق `table.head` با ردیف‌ها، عضویت مسیرها در بانک) و با esbuild باندل کن. جزئیات در بخش «۶.۷» اسکیل `react-layer-headless-verify`.
- **هارنس دو نیمه:** نیمهٔ سرور (`contentStore`) را **بدون باندل** با نود خالی اجرا کن (`import.meta.url` مسیر `content/` را می‌سازد و باندل می‌شکندش). فقط نیمهٔ React باندل می‌شود.
- **نویسندهٔ هم‌زمان:** session دیگری ممکن است وسط کار همان فایل را بنویسد. **واقعاً رخ داد (۲۳ سپتامبر ۲۰۲۶).** قبل از هر کار روی مخزن `git status` + mtime بگیر؛ قبل از `git checkout` روی فایل سروری هش/زمان را چک کن.
- **هر `readCollection` ~۱۵۰ms است — از حجم داده نیست (اندازه‌گیری‌شده: ۱ درس ۱۵۱ms، ۱۶ درس ۱۵۰ms).** علت: `ensureStore()` آرگومان‌های `ensureFile` را از پیش می‌سازد و `seedAdmins()` داخلش `scryptSync` صدا می‌زند. رفع = تنبل‌کردن seedها؛ فقط با اجازهٔ کاربر.
- **دو `Edit` موازی روی یک فایل همدیگر را پاک می‌کنند** (هرکدام از اسنپ‌شات قبلی می‌نویسد). Editها را پشت‌سرهم بزن. علامت: `ReferenceError: X is not defined` برای چیزی که import کرده‌ای.
- **توقعِ کهنه را باگ نپندار.** اول *قرارداد فعلی* را بخوان: `layerEntryTarget` شیء `{view,title}` می‌دهد نه رشته؛ `grep -c "id: 'deck-"` روی `mockData.js` `id` کارت‌ها را هم می‌شمارد (تعداد واقعی دک: `TAPESH_DECKS.length` = ۱۰).
- کاهش حرکت macOS روشن است ⇒ «محتوا هست، انیمیشن نیست» تنظیم سیستم است. بازیابی فایل پاک‌شدهٔ بدون commit: کش کروم (`sourcesContent`).
