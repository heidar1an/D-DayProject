# تپش وب — یادداشت بلندمدت

## قواعد
- مینیمال؛ فایل تازه فقط با درخواست صریح؛ **قبل از حذف، فهرست + تأیید**. پاسخ کوتاه، فارسی.
- `npm install`/`build` ممنوع. تست UI فقط با درخواست کاربر. README لایه در همان نوبت.
- تأیید مجاز: esbuild، SSR، `theme:verify`، اسکیل `react-layer-headless-verify`. دیزاین‌سیستم **کپی** است (اسکیل `tapesh-design-system`)؛ تغییر توکن ⇒ `references/tokens.css` هم.

## معماری
- داده از UI جدا: `services/<domain>/` + `layout/dashboard/<domain>/`؛ کش عمومی ۱۵s. داشبورد hash-driven؛ مقصد دوره‌ها فقط `COURSE_LAYERS`.
- پنل: زیرنما با `SECTION_SUBVIEWS`+`sectionOf()`؛ **هرگز تشخیص پیشوندی** (تلهٔ `media-center`). لایهٔ داخل پنل = `ROUTABLE_VIEWS`+`VIEW_TITLES`+case در `renderView`؛ «ورود به لایه» فقط از `LAYER_VIEWS` در `AdminPages.jsx`.
- `IconX` importنشده در `AdminLayout.jsx` = سفیدی پنل. مهاجرت کاتالوگ: `syncX()` در `ensureStore()` گارد یک‌بار + `writeJson` مستقیم (نه `writeCollection` = حلقهٔ بی‌پایان)؛ `origin` را از body نخوان.

## میکرودرسنامه
- ساختار در **یک رکورد** `microCourses` ⇒ `PUT` کامل، انتشار `POST /api/admin/micro/:id/status`.
- **`src/data/micro/registry.js` تک منبع حقیقت** (پسوند `.js` عمدی — Node هم می‌خواند). درس تازه = فقط `<subjectId>Course.js` + ثبت در `COURSE_REGISTRY`. ۱۶ درس؛ فیزیولوژی اولین کلید.
- متن صفحه = `page.content` نه بلوک. تست: **`test-bank` و `subjects` پیش از `/:id`**؛ `unit.testBank.subjectId` ≠ `unit.subjectId` (override: `genetics`→`biochemistry`)؛ `topicPath` مو‌به‌مو؛ ۹ واحد استخر صفر — عمدی.

## سایر لایه‌ها
- جامع: `--learn-accent*` (نه `--blue*`). بین‌الملل: `intlCatalog.js`+`intlAssets.js`؛ فایل آپلودی از `uploadsFile.js` سرو می‌شود (ویت ۷ فهرست `public/` را کش می‌کند ⇒ ۲۰۰+HTML، ویدیو بی‌خطا سیاه). فلش‌کارت: کتابخانه = ثابت + منتشرشدهٔ پنل؛ «تغییر پنل به کاربر نمی‌رسد» = اول مسیر عمومی *مصرف* را ببین.
- **پخش‌کنندهٔ بین‌الملل:** در RTL اولین عنصر DOM راست‌ترین است ⇒ چیدمان دیده‌شده = ترتیب کد. نوار: صدا، نور، سرعت (راست) → خط زمان → پخش، زمان، زیرنویس، تمام‌صفحه (چپ). **یک `panel` واحد** برای کادرهای شناور ⇒ باز کردن هر کدام قبلی را می‌بندد؛ بستن با کلیک بیرون = `pointerdown` روی `document` با چشم‌پوشی از داخل `.intl-course-player__popover`/`__subtitle` (وگرنه کشیدن نوار، کادر را می‌بندد یا کلیک دوباره عمل می‌کند). کلیک روی ویدیو = `onSurfaceClick` (اول کادر را می‌بندد، بعد پخش/توقف). صدا/نور = `PlayerSlider` عمودی (`writing-mode: vertical-lr`، درصد بالای نوار، بدون `+ / −`)؛ وسط‌چینی کادر با `left:50%` + **`translateX(-50%)`**. انیمیشن آیکون با **WAAPI** نه CSS (گارد `prefers-reduced-motion` هر `animation`/`transition` را `0.01ms !important` می‌کند). **آیکون زیرنویس همیشه هست** — فقط فهرست منو از `lesson.subtitles` می‌آید. بنر روی ویدیو نکِش (محل رندر زیرنویس بومی را می‌پوشاند). **جای زیرنویس را CSS نمی‌تواند عوض کند** ⇒ `VTTCue`: `snapToLines=false` + `line=74` (درصد از بالای قاب) + `position=50`/`size=88`/`align=center`؛ ظاهر با `::cue` (فونت **Pinar** از `styles.css` سراسری). **دو شاخهٔ پخش‌کننده (ویدیو / قاب تصویری) باید هم‌زمان به‌روز شوند.**

## ویرایشگر متن (RichTextEditor.jsx)
- رنگ با `span.micr-tone--*` (کلاس نه style)؛ کادر با div. `label` کلیک را می‌دزدد ⇒ field با div + stopPropagation.
- **حالت ماژیک رنگ:** کلیک روی رنگ = «رنگ جاری»؛ هر گزینش تازه (`onMouseUp`/`onKeyUp`) همان رنگ را می‌گیرد یا با «حذف رنگ» هایلایت را برمی‌دارد. کلیک دوباره روی همان رنگ = خاموش (`tone===null` پیش‌فرض). **هرگز به گزینشِ کهنه برنگرد** (`savedRangeRef` حذف شد) — وگرنه «حذف رنگ» رنگِ بخشِ قدیمی را برمی‌داشت. گزینش چندسلولی جدول کنار گذاشته می‌شود.
- **رنگ هرگز وسط واژه نمی‌شکند:** هر `span` یک قطعهٔ شکل‌گیری جداست ⇒ بریدن وسط واژه اتصال حروف فارسی را می‌شکند. `expandToWordEdges` پیش از `extractContents` بازه را تا مرز واژه بیرون می‌کشد (نیم‌فاصله = واژه، نه مرز)؛ دامنه = درونی‌ترین بلوکِ مشترک (گزینش چندبلوکی دست‌نخورده). همین منطق در خواننده: `snapToWordEdges` در `selectionToBlockRange`+`buildSegments`+`markHtml`.
- **واگرد = پشتهٔ خودش** (`historyRef`: snapshot از innerHTML، ادغام تایپ ۸۰۰ms، Ctrl/Cmd+Z/Y، sync بیرونی ⇒ reset) — پشتهٔ بومی با بازنویسی DOM ری‌اکت ناسازگار بود.
- **فهرست DOMی** (`toggleList`) — execCommand بی‌صدا شکست می‌خورد. **جدول** = گرید ۲بعدی (`tableGrid`/`applyTableOp`/`writeGrid`)؛ span از هندسه و **سلول‌های یتی باید از DOM حذف شوند** (وگرنه حذف ستون محتوا را جابه‌جا می‌کند).
- **حذف رنگ** ⇒ بعد از extract باید از پوسته‌های `micr-tone--*` پیرامون نقطهٔ درج بیرون کشید (split سر/دم).
- `micr-callout__tag` در ویرایشگر `display:none` (نشت باندل سراسری microReader.css)؛ هر variant رنگ خودش را در admin.css دارد.

## خوانندهٔ مراجع (reader/)
- هایلایت/نوت روی بلوک HTML غنی با `markHtml` در `ContentBlocks.jsx` (از آخر به اول، بدون تغییر متن ⇒ offsetها معتبر). `addHighlight` روشن/خاموش است (همان بازه+رنگ = حذف، هم‌پوشانی = جایگزینی). بازه‌ها **کانونی‌اند** (`snapToWordEdges`) ⇒ هایلایت‌های کهنهٔ وسط‌واژه هم درست رندر می‌شوند و «انتخاب دوباره = حذف» دقیق می‌ماند.
- نشانهٔ فهرست صریح: `list-style` در `.rdr-html` و `.ad-rte__area`؛ `display:flex` روی ul در `.micr-rich` قاتل نشانه است.

## ماژول برنامه‌ریزی و مدیریت (پنل، `pl-`)
- **صفر دادهٔ ساختگی.** `services/planning/mockData.js` حذف شد. واحدها و پروژه‌ها **از `productsService.getProducts()`** ساخته می‌شوند (ردهٔ محصول `eyebrow` = واحد، خود محصول = پروژه؛ ۸ واحد، ۹ پروژه) و کاربران از `GET /api/admin/users`. تسک/رویداد/تراکنش/SOP/آمار پیش‌فرض ساخته نمی‌شود. تنها دادهٔ ثابت = تعطیلات رسمی تقویم کشور.
- ذخیره‌سازی پیشوند `tapesh.planning.v3.` — **بالا بردن نسخه = دور ریختن دادهٔ کهنهٔ نشسته در مرورگر** (بدون مهاجرت). هر بار منبع ساختار عوض شد، نسخه را بالا ببر.
- `setViewer` از `adminToUser(admin)` — **همگام**، از نقش+مجوزهای واقعی؛ `unitId` کاربر از فضای‌نام مجوزهایش با `NAMESPACE_PRODUCT` استنتاج می‌شود (نگاشت چسب، نه داده). مدیر کل `unitId: ''` می‌گیرد.
- **شمارندهٔ اعلان:** اعلان «عقب‌افتاده» **خودکار** ساخته می‌شود و ذخیره نمی‌شود ⇒ `markRead`/`markAllRead` باید شناسه را در `PLANNING_KEYS.dismissed` ثبت کنند، وگرنه نشان قرمز تا ابد می‌ماند. هر «اعلان خودکار» = پیشوند `auto-`.
- **مالی:** حالت پرداخت **فقط** `bank`/`direct` (`PAYMENT_MODES`؛ درگاه آنلاین وصل نیست — `PAYMENT_STATUS` در `services/pricing`). `finance.create/update/remove` + `validateTransaction` (عنوان/مبلغ>۰/نوع/پرداخت/تاریخ). `summary` یک `payments` هم می‌دهد.
- `settings.clear()` = پاک‌کردن **محتوا** (ساختار و تنظیمات می‌ماند)؛ `settings.reset()` = بازگشت کامل.
- سنجهٔ رگرسیون: `npm run planning:test` → `scripts/planning-service-test.mjs` (۳۴ سنجه، فقط سرویس، بدون React). انتظارها را از خودِ منبع بساز، نه عدد ثابت.

## بررسی و تله
- `theme:check` به‌خاطر `node_modules/three` می‌افتد ⇒ exit code مهم است. `adminApi.test.mjs` = ۹۲ سنجه ولی **`content/*.json` را بازنویسی می‌کند ⇒ اول بکاپ.**
- هارنس: نیمهٔ سرور **بدون باندل**؛ React باید `external` (وگرنه SIGTERM/۱۳۹). `grep` سندباکس `\|` نمی‌فهمد ⇒ ابزار Grep. **دو Edit موازی روی یک فایل = پاک‌شدن**.
- هارنس رندر React: esbuild با `--jsx=automatic` (وگرنه `React is not defined`) و **باندل داخل پروژه** (ESM در `/tmp` ماژول‌های پروژه را پیدا نمی‌کند)؛ برای رسیدن به نماهای داخلی، پلاگین esbuild ماژول‌های `intlCoursesService`/`dashboardRoute` را با نسخهٔ آزمون عوض می‌کند، بعد `renderToStaticMarkup` با DOM حداقلی.
- **هارنس فقط‌سرویس:** `import` ایستا hoist می‌شود ⇒ شیم `window.localStorage` را اول بگذار و باندل سرویس را با **`await import()`** بردار، وگرنه `bootstrapOnce()` حافظهٔ خالی می‌بیند. دارایی‌ها با لودر `empty` (نه `external` — در Node می‌شکند). `String.raw` + `${` = `Bad substitution`؛ فایل هارنس را با Write بنویس نه heredoc.
- `useAsync` وابستگی پایدار + StrictMode guard. `events.json`/`activity.json` زمان‌اجرایند — دست نزن. توقع کهنه ≠ باگ: `layerEntryTarget` شیء `{view,title}` می‌دهد؛ عمق import دارایی از محل فایل.
