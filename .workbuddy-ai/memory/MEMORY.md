# تپش وب — یادداشت بلندمدت

## قواعد کار
- ساختار مینیمال موجود را حفظ کن؛ فایل/لایهٔ تازه فقط با درخواست صریح. پاسخ کوتاه و مستقیم؛ حین کار متن توضیحی ننویس.
- `npm install` و `npm run build` ممنوع؛ بیلد `dist/` را پاک می‌کند. تست UI/مرورگر فقط با درخواست کاربر.
- پیش از تغییر، README ریشه و README همان لایه را بخوان و در همان نوبت به‌روز کن.
- طراحی در `src/styles.css` و پالت موجود (`--brown/--blue/--green/--red/--purple/--gold` و bright/تم روشن). ابهام دوخوانشی ⇒ یک سؤال دوگزینه‌ای.
- تأیید مجاز: esbuild transform/bundle، SSR با `renderToStaticMarkup` و `theme:verify|contrast|tailwind`; برای لایهٔ React از `react-layer-headless-verify` استفاده کن.

## معماری
- داده از UI جدا: `src/services/<domain>/` و `src/layout/dashboard/<domain>/`.
- داشبورد hash-driven در `dashboardRoute.jsx`؛ `initialView` بیرون کامپوننت، صفحه push و زیرصفحه replace. هدر از `DashboardHeader.jsx` و رنگ نشانگر از `indicatorColors`.
- نگاشت مقصد دوره‌ها فقط `COURSE_LAYERS` در `DashboardLayout.jsx` است. پنل: سایدبار فقط `SECTIONS`؛ زیرنماها با `SECTION_SUBVIEWS` و `sectionOf()`؛ مسیر `#admin/<view>`.
- مهاجرت کاتالوگ به رکورد پنل: `syncX()` در `ensureStore()` با گارد یک‌بار و `writeJson` مستقیم، نه `writeCollection`; رکوردها `origin:'tapesh'` داشته باشند. کش سرویس عمومی ۱۵ ثانیه است.
- میکرو: یک رکورد `microCourses`، PUT و انتشار اتمیک، رجیستری `src/data/micro/registry.js`; اتصال با `subjectId` است.

## درسنامهٔ جامع
- `ContentService.countSections(subjectId)` تعداد کادرهای سرتیتر ستون راست را می‌شمارد؛ درصد کنار نوار است. تم درس با `--learn-accent` و `--learn-accent-rgb` از `AnatomyLearningLayer` می‌آید؛ `--blue*` را برای اکسنت بازتعریف نکن.
- مراحل فقط `activate → learn → visualize → practice → test` از `LEARNING_STEPS`؛ حرکت آزاد و بدون تیک/تأیید. `test` از `practice` و `labelQuiz` ساخته می‌شود.
- `AnatomyLearningLayer` عمومی است (`subjectId`, `subjectTitle`, routeهای `overview/unit/reader`). واحد `micro` باید در سطح خود لایه رندر شود، نه داخل wrapper باریک. پیش‌فرض overview اولین بخش منتشرشده است.

## بین‌الملل (`courses/InternationalCoursesLayer`)
- نوار بی‌پایان: فهرست ۴ بار، حرکت یک نسخه/۲۵٪ ترک؛ RTL به راست چسبیده و با `translateX` مثبت حرکت می‌کند. لوگوها واقعی و خالص‌اند، بدون پلاک/هاله/drop-shadow.
- کارت‌ها ستونی و دو نیمهٔ مساوی با flex هستند؛ تم روشن باید روشن باشد و رنگ توپُر ثابت نداشته باشد (`var(--white)`, `rgb(var(--shadow-rgb) / …)`, `var(--pure)`).
- لوگوی ناشر از منابع پایدار تهیه شود؛ برای SVG/PNG سفید را کورکلید نکن. `logo.clearbit.com` قابل اتکا نیست.

## ویرایشگر و CSS
- `RichTextEditor.jsx`: پاک‌ساز style و aside/svg/caption را حذف می‌کند؛ فقط class/dir از `*`; رنگ با `span.micr-tone--*` و کادر با div. `label` کلیک را می‌دزدد؛ برای field از div و stopPropagation استفاده کن.
- CSS پایین‌تر برنده است؛ انتخاب‌گر ترکیبی بنویس. RTL: `inset-inline-start:0` لبهٔ راست و `translateX(-100%)` حرکت به چپ است.

## تله‌ها و بررسی
- `useAsync` وابستگی پایدار و StrictMode guard لازم دارد. کد HTTP به‌تنهایی حقیقت نیست؛ `null` و «—» نشان بده.
- هارنس esbuild: entry در `/tmp`، `NODE_PATH=<project>/node_modules`، React را external نکن، assets را dataurl بده. `verify-render` و تست admin را معیار نگذار؛ exit code مهم است.
- قبل از ویرایش `git status` و mtime را بررسی کن. هر تغییر substantive را در لاگ روزانهٔ `.workbuddy-ai/memory/YYYY-MM-DD.md` ثبت کن؛ ترجیحات پایدار را فقط اینجا نگه دار.
