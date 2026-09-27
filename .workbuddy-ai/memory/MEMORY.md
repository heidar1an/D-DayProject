# تپش وب — یادداشت بلندمدت

## قواعد کار
- ساختار مینیمال موجود را حفظ کن؛ فایل/لایهٔ تازه فقط با درخواست صریح. پاسخ کوتاه و مستقیم؛ حین کار متن توضیحی ننویس. **قبل از حذف، فهرست بده و تأیید بگیر.**
- `npm install` و `npm run build` ممنوع؛ بیلد `dist/` را پاک می‌کند. تست UI/مرورگر فقط با درخواست کاربر.
- پیش از تغییر، README ریشه و README همان لایه را بخوان و در همان نوبت به‌روز کن.
- طراحی در `src/styles.css` و پالت موجود (`--brown/--blue/--green/--red/--purple/--gold` و bright/تم روشن). ابهام دوخوانشی ⇒ یک سؤال دوگزینه‌ای.
- تأیید مجاز: esbuild transform/bundle، SSR با `renderToStaticMarkup` و `theme:verify|contrast|tailwind`؛ برای لایهٔ React اسکیل `react-layer-headless-verify`.
- دیزاین سیستم یک **کپی** است: اسکیل `tapesh-design-system`؛ هر تغییر توکن باید در `references/tokens.css` آن هم بیاید.

## معماری
- داده از UI جدا: `src/services/<domain>/` و `src/layout/dashboard/<domain>/`.
- داشبورد hash-driven در `dashboardRoute.jsx`؛ `initialView` باید ثابت و بیرون کامپوننت باشد، صفحه push و زیرصفحه replace. هدر از `DashboardHeader.jsx` و رنگ نشانگر از `indicatorColors`.
- نگاشت مقصد دوره‌ها فقط `COURSE_LAYERS` در `DashboardLayout.jsx`. پنل: سایدبار فقط `SECTIONS` (۱۰ آیتم)؛ زیرنماها با نگاشت صریح `SECTION_SUBVIEWS` و `sectionOf()`؛ مسیر `#admin/<view>`. **هرگز با تشخیص پیشوندی** (تلهٔ `media-center`).
- مهاجرت کاتالوگ به رکورد پنل: `syncX()` در `ensureStore()` با گارد یک‌بار و `writeJson` مستقیم، نه `writeCollection`؛ رکوردها `origin:'tapesh'` داشته باشند. کش سرویس عمومی ۱۵ ثانیه است.
- OAuth گوگل فقط سروری. اعداد تعرفه فقط در `services/pricing/pricingService.js`. کارت‌های کاتالوگ یک تعریف مشترک در `CoursesSection.jsx`.
- «صفحات» = رجیستری ۱۵ لایهٔ محصول؛ کارت لایه: `h3.ad-layercard__name` غیرکلیک‌پذیر + آیکون چشم + «ورود به لایه»؛ هاور هم‌رنگ آیکون گروه. `page-editor` از UI در دسترس نیست.
- لایهٔ داخل پنل (سایدبار ثابت می‌ماند): `ROUTABLE_VIEWS` + `SECTION_SUBVIEWS`→`pages` + `VIEW_TITLES` + case در `renderView`. مقصد «ورود به لایه» فقط از `LAYER_VIEWS` در `AdminPages.jsx` می‌آید (`layerEntryTarget` شیء `{view,title}` برمی‌گرداند): `flashcards`→`flashcard-library` (گارد `canSendDeck`؛ ارسال = `PUT` با `status:'published'` → `/api/public/flashcards/library`) و `micro-lesson`→`micro-lesson` (→ `/api/public/micro/library`).

## میکرودرسنامه
- کل ساختار در **یک رکورد** `microCourses` (مبحث→واحد→صفحه→متن/بلوک→ایستگاه) ⇒ ذخیره یک `PUT` کامل، انتشار اتمیک با `POST /api/admin/micro/:id/status`. اتصال با `subjectId`.
- **`src/data/micro/registry.js` تک منبع حقیقت است** (`MICRO_COURSE_REGISTRY`/`MICRO_COURSE_SOURCES`/`MICRO_SUBJECT_OPTIONS`)؛ هم سرور (`contentStore.js`) و هم `microContentService.js` از آن می‌خوانند. **پسوند `.js` در importهایش عمدی است** — همین فایل در Node هم خوانده می‌شود.
- **داده‌محور است — برای درس تازه هیچ کد UI ننویس:** فقط `src/data/micro/<subjectId>Course.js` بساز و در `COURSE_REGISTRY` (`microContentService.js`) ثبت کن. حالا **۱۶ درس** ثبت است. `id` درس = `subjectId` = کلید رجیستری. **فیزیولوژی عمداً اولین کلید است** (`firstPublishedCourse()` اولین عضو را برمی‌گرداند). قرارداد کامل در `src/data/micro/README.md`.
- **seed = هر ۱۶ درس، سپس همگام‌سازی افزایشی.** `syncMicroCourses()` در `ensureStore()` فقط درس‌های رجیستریِ بدون رکورد را `draft` اضافه می‌کند و `content` صفحه‌های پیش از مهاجرت را پر می‌کند؛ هیچ رکورد موجودی را بازنویسی نمی‌کند. یک‌بار در عمر پروسه (`microSynced`) و با `writeJson` مستقیم — **`writeCollection` از داخل `ensureStore` حلقهٔ بی‌پایان می‌سازد.**
- ایستگاه تست دو منبع دارد: `pinnedQuestionIds` (بانک) + `questions[]` (دستی، بر فیلتر بانک اولویت دارد). **دو مسیر زیرِ `/api/admin/micro` باید پیش از `/:id` در جدول ROUTES بیایند: `test-bank` و `subjects`.**
- **متن صفحه = `page.content` (متن غنی)، نه بلوک.** ویرایشگر `RichTextEditor`؛ مبدل خالص `blocksToHtml.js` بلوک‌های قدیمی را یک‌بار به HTML تبدیل می‌کند؛ سرور فقط وقتی `content` خالی است مشتق می‌گیرد (پس ویرایش ادمین هرگز بازنویسی نمی‌شود). `blocks[]` **حذف نشد** — آرشیو است. `INTERACTIVE_BLOCK_TYPES` (`figure`/`flashcards`/`quickQuestion`) به HTML تبدیل نمی‌شوند و زیر `micr-rich` رندر می‌شوند ⇒ پیامد: بعد از مهاجرت به پایان صفحه می‌روند.
- سه دیاگرام **عمومی داده‌محور** در `microDiagrams.jsx`: `flow` (`data.steps`)/`bars` (`data.items`)/`cycle` (`data.stages`)؛ کلید ناشناخته ⇒ `null`. سه دیاگرام `pressure-timeline`/`wiggers`/`pv-loop` ثابت و مخصوص فیزیولوژی قلب‌اند.
- **`unit.testBank.subjectId` را با `unit.subjectId` قاطی نکن:** موتور اولی را ترجیح می‌دهد. دو override عمدی: `genetics`→`biochemistry` و `english`→`esl`. `topicPath` باید مو‌به‌مو با مسیر بانک یکی باشد، وگرنه استخر بی‌صدا صفر می‌شود.
- **شکاف پوشش بانک تست (اندازه‌گیری‌شده):** ۵۹ سؤال دارد و فقط ۷ درس از ۱۶ را پوشش می‌دهد (physiology ۱۶ · biochemistry ۵ · anatomy ۴ · genetics ۲ · histology ۲ · microbiology ۲ · immunology ۱ · pathology ۱). **۹ واحد استخر صفر دارند** ⇒ ایستگاه/آزمون حالت خالی می‌گیرد. این عمدی است نه باگ UI — اول `questionPoolOf` و مسیرهای `testBank` را چک کن.

## درسنامهٔ جامع
- `ContentService.countSections(subjectId)` تعداد کادرهای سرتیتر ستون راست را می‌شمارد؛ درصد کنار نوار است. تم درس با `--learn-accent` و `--learn-accent-rgb` از `AnatomyLearningLayer` می‌آید؛ `--blue*` را برای اکسنت بازتعریف نکن.
- مراحل فقط `activate → learn → visualize → practice → test` از `LEARNING_STEPS`؛ حرکت آزاد و بدون تیک/تأیید. `test` از `practice` و `labelQuiz` ساخته می‌شود.
- `AnatomyLearningLayer` عمومی است (`subjectId`, `subjectTitle`, routeهای `overview/unit/reader`). واحد `micro` باید در سطح خود لایه رندر شود، نه داخل wrapper باریک. پیش‌فرض overview اولین بخش منتشرشده است.

## بین‌الملل (`courses/InternationalCoursesLayer`)
- نوار بی‌پایان: فهرست ۴ بار، حرکت یک نسخه/۲۵٪ ترک؛ RTL به راست چسبیده و با `translateX` مثبت حرکت می‌کند. لوگوها واقعی و خالص‌اند، بدون پلاک/هاله/drop-shadow.
- کارت‌ها ستونی و دو نیمهٔ مساوی با flex هستند؛ تم روشن باید روشن باشد و رنگ توپُر ثابت نداشته باشد (`var(--white)`, `rgb(var(--shadow-rgb) / …)`, `var(--pure)`).
- لوگوی ناشر از منابع پایدار تهیه شود؛ برای SVG/PNG سفید را کورکلید نکن. `logo.clearbit.com` قابل اتکا نیست.

## فلش‌کارت
- **کتابخانهٔ کاربران = ثابت + منتشرشدهٔ پنل.** `flashcardService.js` حالا `/api/public/flashcards/library` را `fetch` می‌کند و `tapeshDecks()`/`tapeshCards()` دک‌های منتشرشده را **جلوی** دک‌های ثابت `mockData.js` ادغام می‌کنند (TTL ۱۵ ثانیه + `forceLibrary: true` روی `fetchLibrary`/`fetchDeck`/`fetchMyDecks`/`fetchOverview`؛ سرور قطع ⇒ سقوط به دک‌های ثابت). **تلهٔ کلاسیک این پروژه: زنجیرهٔ سرور کامل بود ولی هیچ کد سمت کاربری مصرفش نمی‌کرد** ⇒ وقتی «تغییر پنل به کاربر نمی‌رسد»، اول بگرد ببین مسیر عمومی *مصرف* می‌شود یا نه.
- ویرایشگر: چیپ‌های پنج‌گانه `CARD_TYPES` ولی سرور ۴ نوع ⇒ `basic-hint` **فقط نمایش** است (`cardTypeOf`/`toStoredType`؛ سرنخ در `hint` می‌ماند). `validateDeck` سخت‌گیر (جلوی ذخیره را می‌گیرد) در مقابل `cardQualityHints` فقط هشدار. `PUBLISH_OPTIONS` سه‌گانه (انتشار/پیش‌نویس/بایگانی) + تنها دکمهٔ **«تأیید تغییرات»** در همان فرم.

## ویرایشگر و CSS
- `RichTextEditor.jsx`: پاک‌ساز style و aside/svg/caption را حذف می‌کند؛ فقط class/dir از `*`؛ رنگ با `span.micr-tone--*` و کادر با div. `label` کلیک را می‌دزدد؛ برای field از div و stopPropagation استفاده کن.
- CSS پایین‌تر برنده است؛ انتخاب‌گر ترکیبی بنویس. RTL: `inset-inline-start:0` لبهٔ راست و `translateX(-100%)` حرکت به چپ است.
- روی تصویر با `left/top` فیزیکی موقعیت بده نه `inset-inline-start` (تصویر با RTL آینه نمی‌شود). متن Pinar، تیتر Doran، اعداد `toFa`. دکمهٔ تم فقط در `App.jsx`/`DashboardHeader.jsx`/`AdminLayout.jsx`.
- یادداشت‌ها: تپش هوشمند یک نقطهٔ ورود؛ گارد `prefers-reduced-motion` نباید `.nt-card` را `animation:none` کند.

## بررسی و تله
- `npm run theme:check` گام آخرش (`verify-render.mjs`) به‌خاطر `node_modules/three` می‌افتد (خطای پیش‌موجود) ⇒ معیار نگذار، exit code مهم است. `node database/adminApi.test.mjs` = ۹۲ سنجه.
- **`adminApi.test.mjs` فایل‌های واقعی `content/*.json` را بازنویسی می‌کند** (از `contentStore.js` مستقیم می‌نویسد): `events.json` (تلمتری) به `[]` پاک می‌شود و `activity.json` (لاگ audit) و `updatedAt/lastLoginAt` در `admins.json` عوض می‌شوند. ⇒ **قبل از اجرا بکاپ بگیر.** ولی `git checkout` کورکورانه نزن: `flashcardDecks.json` ویرایش محتوایی واقعی هم دارد. تفاوت را معنایی بسنج، بعد تصمیم بگیر.
- `useAsync` وابستگی پایدار و StrictMode guard لازم دارد وگرنه حلقهٔ fetch. کد HTTP به‌تنهایی حقیقت نیست؛ `null` و «—» نشان بده.
- **سنجش لایهٔ داده = هارنس قرارداد، نه رندر.** جزئیات باندل و لودرها در بخش «۶» اسکیل `react-layer-headless-verify`؛ **React باید `external` باشد** (`external: ['react','react-dom','react-dom/server','react/jsx-runtime']`) وگرنه پروسه با `SIGTERM`/۱۳۹ بی‌هیچ خروجی می‌میرد.
- **هارنس دو نیمه:** نیمهٔ سرور (`contentStore`) را **بدون باندل** با نود خالی اجرا کن — `import.meta.url` مسیر `content/` را می‌سازد و باندل می‌شکندش. فقط نیمهٔ React باندل می‌شود. `MicroCompletion.jsx` **default export ندارد** (فقط named). هارنس jsdom روی `import.meta.glob` می‌میرد.
- رندر سرور: `AdminShell` تا `meta` نیاید `renderView()` را صدا نمی‌زند ⇒ نما را مستقیم رندر کن. `IconX` استفاده‌شده و importنشده در `AdminLayout.jsx` = سفیدی کل پنل.
- **`grep` سندباکس `\|` را نمی‌فهمد** ⇒ منفی کاذب؛ از ابزار Grep استفاده کن.
- **دو `Edit` موازی روی یک فایل همدیگر را پاک می‌کنند** (هرکدام از اسنپ‌شات قبلی می‌نویسد). Editها را پشت‌سرهم بزن. علامتش: `ReferenceError: X is not defined` برای چیزی که «قطعاً import کرده‌ای».
- **نویسندهٔ هم‌زمان:** قبل از هر کار روی این مخزن `git status` + mtime بگیر و ببین دیسک کجا ایستاده؛ قبل از `git checkout` روی فایل سروری هش/زمان را چک کن. **واقعاً رخ داد (۲۳ سپتامبر ۲۰۲۶):** یک session موازی ۱۵ فایل درسِ میکرو ساخت و `microContentService.js` را عوض کرده بود.
- **هر `readCollection` ~۱۵۰ms است — از حجم داده نیست (اندازه‌گیری‌شده: ۱ درس ۱۵۱ms، ۱۶ درس ۱۵۰ms).** علت: `ensureStore()` آرگومان‌های `ensureFile` را از پیش می‌سازد و `seedAdmins()` داخلش `scryptSync` صدا می‌زند. رفع = تنبل‌کردن seedها؛ لمس زیرساخت مشترک است، فقط با اجازهٔ کاربر.
- **توقعِ کهنه را باگ نپندار.** وقتی سنجه‌ای سرخ می‌شود، اول *قرارداد فعلی* تابع/داده را بخوان: `layerEntryTarget` شیء `{view,title}` می‌دهد نه رشته؛ `grep -c "id: 'deck-"` روی `mockData.js` `id` کارت‌ها را هم می‌شمارد (تعداد واقعی دک: `TAPESH_DECKS.length` = ۱۰).
- کاهش حرکت macOS روشن است ⇒ «محتوا هست، انیمیشن نیست» تنظیم سیستم است. بازیابی فایل پاک‌شدهٔ بدون commit: کش کروم (`sourcesContent`).
