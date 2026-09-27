# تپش وب — یادداشت بلندمدت

## قواعد کار
- ساختار مینیمال موجود را حفظ کن؛ فایل/لایهٔ تازه فقط با درخواست صریح. **قبل از حذف، فهرست بده و تأیید بگیر.** پاسخ کوتاه و مستقیم.
- `npm install` و `npm run build` ممنوع (بیلد `dist/` را پاک می‌کند). تست UI/مرورگر فقط با درخواست کاربر. README ریشه و همان لایه در همان نوبت به‌روز شود.
- طراحی در `src/styles.css` با پالت موجود (`--brown/--blue/--green/--red/--purple/--gold` و bright/تم روشن). ابهام دوخوانشی ⇒ یک سؤال دوگزینه‌ای.
- تأیید مجاز: esbuild transform/bundle، SSR با `renderToStaticMarkup`، `theme:verify|contrast|tailwind`؛ لایهٔ React با اسکیل `react-layer-headless-verify`.
- دیزاین سیستم یک **کپی** است (اسکیل `tapesh-design-system`)؛ هر تغییر توکن باید در `references/tokens.css` آن هم بیاید.

## معماری
- داده از UI جدا: `src/services/<domain>/` و `src/layout/dashboard/<domain>/`.
- داشبورد hash-driven در `dashboardRoute.jsx`؛ `initialView` ثابت و بیرون کامپوننت، صفحه push و زیرصفحه replace. هدر `DashboardHeader.jsx`، رنگ نشانگر `indicatorColors`.
- مقصد دوره‌ها فقط `COURSE_LAYERS` در `DashboardLayout.jsx`. پنل: سایدبار فقط `SECTIONS` (۱۰ آیتم)؛ زیرنماها با نگاشت صریح `SECTION_SUBVIEWS`+`sectionOf()`؛ مسیر `#admin/<view>`. **هرگز تشخیص پیشوندی** (تلهٔ `media-center`).
- مهاجرت کاتالوگ: `syncX()` در `ensureStore()` با گارد یک‌بار و `writeJson` مستقیم نه `writeCollection`؛ رکوردها `origin:'tapesh'`. کش سرویس عمومی ۱۵ ثانیه.
- OAuth گوگل فقط سروری. اعداد تعرفه فقط در `services/pricing/pricingService.js`. کارت کاتالوگ یک تعریف مشترک در `CoursesSection.jsx`.
- «صفحات» = رجیستری ۱۵ لایهٔ محصول؛ کارت لایه `h3.ad-layercard__name` غیرکلیک‌پذیر + آیکون چشم + «ورود به لایه»؛ `page-editor` از UI در دسترس نیست.
- لایهٔ داخل پنل (سایدبار ثابت): `ROUTABLE_VIEWS` + `SECTION_SUBVIEWS`→`pages` + `VIEW_TITLES` + case در `renderView`. مقصد «ورود به لایه» فقط از `LAYER_VIEWS` در `AdminPages.jsx` (`layerEntryTarget` ⇒ `{view,title}`): `flashcards`→`flashcard-library` (گارد `canSendDeck`؛ ارسال `PUT` با `status:'published'` → `/api/public/flashcards/library`) و `micro-lesson`→`micro-lesson` (→ `/api/public/micro/library`).

## میکرودرسنامه
- کل ساختار در **یک رکورد** `microCourses` ⇒ ذخیره یک `PUT` کامل، انتشار اتمیک با `POST /api/admin/micro/:id/status`. اتصال با `subjectId`.
- **`src/data/micro/registry.js` تک منبع حقیقت است**؛ `contentStore.js` و `microContentService.js` از آن می‌خوانند. **پسوند `.js` در importهایش عمدی است** (در Node هم خوانده می‌شود).
- **داده‌محور — برای درس تازه کد UI ننویس:** فقط `src/data/micro/<subjectId>Course.js` بساز و در `COURSE_REGISTRY` (`microContentService.js`) ثبت کن. **۱۶ درس**؛ `id` درس = `subjectId` = کلید رجیستری. **فیزیولوژی عمداً اولین کلید است** (`firstPublishedCourse()`). قرارداد در `src/data/micro/README.md`.
- **seed = هر ۱۶ درس + همگام‌سازی افزایشی:** `syncMicroCourses()` در `ensureStore()` فقط درس‌های بدون رکورد را `draft` اضافه و `content` صفحه‌های قدیمی را پر می‌کند؛ رکورد موجود را بازنویسی نمی‌کند. یک‌بار در عمر پروسه (`microSynced`) با `writeJson` مستقیم — **`writeCollection` داخل `ensureStore` حلقهٔ بی‌پایان می‌سازد.**
- ایستگاه تست دو منبع: `pinnedQuestionIds` (بانک) + `questions[]` (دستی، اولویت بر بانک). **`test-bank` و `subjects` باید پیش از `/:id` در ROUTES بیایند.**
- **متن صفحه = `page.content`، نه بلوک.** `blocksToHtml.js` بلوک‌های قدیمی را یک‌بار به HTML می‌برد؛ سرور فقط وقتی `content` خالی است مشتق می‌گیرد (ویرایش ادمین بازنویسی نمی‌شود). `blocks[]` آرشیو است، حذف نشد. `INTERACTIVE_BLOCK_TYPES` (`figure`/`flashcards`/`quickQuestion`) به HTML نمی‌روند و زیر `micr-rich` رندر می‌شوند ⇒ بعد از مهاجرت به پایان صفحه می‌روند.
- سه دیاگرام **عمومی داده‌محور** در `microDiagrams.jsx`: `flow`(`data.steps`)/`bars`(`data.items`)/`cycle`(`data.stages`)؛ کلید ناشناخته ⇒ `null`. `pressure-timeline`/`wiggers`/`pv-loop` ثابت و مخصوص قلب.
- **`unit.testBank.subjectId` را با `unit.subjectId` قاطی نکن** (موتور اولی را ترجیح می‌دهد). دو override عمدی: `genetics`→`biochemistry`، `english`→`esl`. `topicPath` باید مو‌به‌مو با بانک یکی باشد وگرنه استخر بی‌صدا صفر می‌شود.
- **پوشش بانک (اندازه‌گیری‌شده):** ۵۹ سؤال، فقط ۷ درس از ۱۶؛ **۹ واحد استخر صفر دارند** ⇒ حالت خالی عمدی است نه باگ UI؛ اول `questionPoolOf` و مسیرهای `testBank` را چک کن.

## درسنامهٔ جامع
- `ContentService.countSections(subjectId)` کادرهای سرتیتر ستون راست را می‌شمارد. تم درس با `--learn-accent`/`--learn-accent-rgb` از `AnatomyLearningLayer`؛ `--blue*` را برای اکسنت بازتعریف نکن.
- مراحل فقط `activate → learn → visualize → practice → test` از `LEARNING_STEPS`؛ حرکت آزاد و بدون تیک/تأیید. `test` از `practice` و `labelQuiz`.
- `AnatomyLearningLayer` عمومی است (`subjectId`, `subjectTitle`, routeهای `overview/unit/reader`). واحد `micro` در سطح خود لایه رندر شود نه داخل wrapper باریک.

## بین‌الملل (`courses/InternationalCoursesLayer`)
- نوار بی‌پایان: فهرست ۴ بار، حرکت یک نسخه/۲۵٪ ترک؛ RTL به راست چسبیده و با `translateX` مثبت حرکت می‌کند. لوگوها واقعی و خالص، بدون پلاک/هاله/drop-shadow. `logo.clearbit.com` قابل اتکا نیست؛ SVG/PNG سفید را کورکلید نکن.
- کارت‌ها ستونی و دو نیمهٔ مساوی با flex؛ تم روشن باید روشن باشد و رنگ توپُر ثابت نداشته باشد (`var(--white)`, `rgb(var(--shadow-rgb) / …)`, `var(--pure)`).

## فلش‌کارت
- **کتابخانهٔ کاربران = ثابت + منتشرشدهٔ پنل.** `flashcardService.js` حالا `/api/public/flashcards/library` را `fetch` می‌کند و دک‌های منتشرشده را **جلوی** دک‌های ثابت `mockData.js` ادغام می‌کند (TTL ۱۵s + `forceLibrary: true`؛ سرور قطع ⇒ سقوط به ثابت‌ها). **تلهٔ کلاسیک: زنجیرهٔ سرور کامل ولی هیچ کد سمت کاربری مصرفش نمی‌کرد** ⇒ «تغییر پنل به کاربر نمی‌رسد» = اول ببین مسیر عمومی *مصرف* می‌شود.
- ویرایشگر: `CARD_TYPES` پنج‌گانه ولی سرور ۴ نوع ⇒ `basic-hint` فقط نمایشی (`cardTypeOf`/`toStoredType`). `validateDeck` سخت‌گیر (جلوی ذخیره) در مقابل `cardQualityHints` هشدار. `PUBLISH_OPTIONS` سه‌گانه + تنها دکمهٔ **«تأیید تغییرات»** در همان فرم.

## ویرایشگر و CSS
- `RichTextEditor.jsx`: پاک‌ساز style و aside/svg/caption را حذف می‌کند؛ فقط class/dir از `*`؛ رنگ با `span.micr-tone--*`، کادر با div. `label` کلیک را می‌دزدد؛ برای field از div و stopPropagation.
- CSS پایین‌تر برنده است؛ انتخاب‌گر ترکیبی بنویس. RTL: `inset-inline-start:0` لبهٔ راست و `translateX(-100%)` حرکت به چپ.
- روی تصویر با `left/top` فیزیکی موقعیت بده نه `inset-inline-start` (تصویر با RTL آینه نمی‌شود). متن Pinar، تیتر Doran، اعداد `toFa`. دکمهٔ تم فقط در `App.jsx`/`DashboardHeader.jsx`/`AdminLayout.jsx`. تپش هوشمند یک نقطهٔ ورود؛ گارد `prefers-reduced-motion` نباید `.nt-card` را `animation:none` کند.

## بررسی و تله
- `npm run theme:check` گام آخر (`verify-render.mjs`) به‌خاطر `node_modules/three` می‌افتد (خطای پیش‌موجود) ⇒ معیار نگذار، exit code مهم است. `node database/adminApi.test.mjs` = ۹۲ سنجه.
- **`adminApi.test.mjs` فایل‌های واقعی `content/*.json` را بازنویسی می‌کند** (`events.json`→`[]`، `activity.json`، مهر زمانی `admins.json`) ⇒ **قبل از اجرا بکاپ بگیر.** `git checkout` کورکورانه نزن: `flashcardDecks.json` ویرایش محتوایی واقعی هم دارد؛ تفاوت را معنایی بسنج.
- `useAsync` وابستگی پایدار و StrictMode guard لازم دارد وگرنه حلقهٔ fetch. کد HTTP به‌تنهایی حقیقت نیست؛ `null` و «—» نشان بده.
- **سنجش لایهٔ داده = هارنس قرارداد، نه رندر.** جزئیات باندل/لودرها در بخش «۶» اسکیل `react-layer-headless-verify`؛ **React باید `external` باشد** وگرنه پروسه با `SIGTERM`/۱۳۹ بی‌خروجی می‌میرد.
- **هارنس دو نیمه:** نیمهٔ سرور (`contentStore`) را **بدون باندل** با نود خالی اجرا کن (`import.meta.url` مسیر `content/` را می‌سازد و باندل می‌شکندش)؛ فقط نیمهٔ React باندل می‌شود. `MicroCompletion.jsx` **default export ندارد**. jsdom روی `import.meta.glob` می‌میرد.
- رندر سرور: `AdminShell` تا `meta` نیاید `renderView()` را صدا نمی‌زند ⇒ نما را مستقیم رندر کن. `IconX` استفاده‌شده و importنشده در `AdminLayout.jsx` = سفیدی کل پنل.
- **`grep` سندباکس `\|` را نمی‌فهمد** ⇒ منفی کاذب؛ از ابزار Grep استفاده کن.
- **دو `Edit` موازی روی یک فایل همدیگر را پاک می‌کنند.** Editها را پشت‌سرهم بزن. علامت: `ReferenceError: X is not defined` برای چیزی که import کرده‌ای.
- **نویسندهٔ هم‌زمان:** قبل از کار روی مخزن `git status` + mtime؛ قبل از `git checkout` روی فایل سروری هش/زمان را چک کن. **رخ داد (۲۳ سپتامبر ۲۰۲۶):** یک session موازی ۱۵ فایل درس میکرو ساخت و `microContentService.js` را عوض کرده بود.
- **هر `readCollection` ~۱۵۰ms است — از حجم داده نیست.** علت: `ensureStore()` آرگومان‌های `ensureFile` را از پیش می‌سازد و `seedAdmins()` داخلش `scryptSync` صدا می‌زند. رفع = تنبل‌کردن seedها؛ فقط با اجازهٔ کاربر.
- **توقعِ کهنه را باگ نپندار.** اول *قرارداد فعلی* را بخوان: `layerEntryTarget` شیء `{view,title}` می‌دهد نه رشته؛ `grep -c "id: 'deck-"` روی `mockData.js` `id` کارت‌ها را هم می‌شمارد (تعداد واقعی: `TAPESH_DECKS.length` = ۱۰).
- کاهش حرکت macOS روشن است ⇒ «محتوا هست، انیمیشن نیست» تنظیم سیستم است. بازیابی فایل پاک‌شدهٔ بدون commit: کش کروم (`sourcesContent`).
