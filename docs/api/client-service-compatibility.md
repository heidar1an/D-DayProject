# سازگاری Client ↔ API — ممیزی بند ۲۳ (فاز ۷)

> ابزار: `node scripts/client-contract-audit.mjs` · دادهٔ خام: `docs/api/client-contract-audit.json`
>
> ⚠️ ممیزی **ایستا** است. «تماس واقعی» یعنی الگوی `fetch('…/api/…')` در سورس دیده شد — نه اینکه در اجرا اثبات شده باشد. اثبات اجرایی فقط برای مسیرهای smoke‌شده وجود دارد (بخش ۱۲ گزارش فاز ۷).

## ۱. خلاصه

| سنجه | مقدار |
|---|---|
| فایل‌های اسکن‌شده در `src/` | **۴۲۵** |
| مسیر سرور (موجودی فاز ۷) | **۲۲۹** |
| مسیر با **تماس شبکهٔ واقعی** | **۱۵** — همه پیاده‌شده ✅ |
| تماس واقعی به مسیر **ناموجود** | **۰** ✅ |
| مسیر **فقط توصیف‌شده** (کامنت/README) | **۱۴۶** |
| … که در سرور **وجود ندارد** | **۱۲۲** ⚠ `DOCUMENTED BUT NOT IMPLEMENTED` |

**نتیجهٔ کلیدی:** هیچ تماس شکسته‌ای وجود ندارد — یعنی هیچ‌جا کلاینت به مسیری `fetch` نمی‌زند که سرور ندارد. اما **۱۲۲ مسیر** در متن سرویس‌ها توصیف شده‌اند که سرور پیاده‌شان نکرده است. این‌ها قرارداد **مستندشدهٔ بدون پیاده‌سازی**اند و طبق بند ۲۳ باید ثبت شوند، نه اینکه بدون scope کامل شوند.

## ۲. مسیرهای با تماس واقعی (۱۵/۱۵ پیاده‌شده)

| مسیر | مصرف‌کننده |
|---|---|
| `GET /api/public/articles` | `services/articles/articlesService.js` |
| `GET /api/public/comprehensive/library` | `services/learning/contentService.js` |
| `GET /api/public/flashcards/library` | `services/flashcards/flashcardService.js` |
| `GET /api/public/intl-courses/library` | `services/international/intlCoursesService.js` |
| `GET /api/public/micro/library` | `services/micro/microContentService.js` |
| `GET /api/public/references/library` | `services/referencesApi.js` |
| `GET /api/public/test-bank/questions` | `services/testBank/testBankService.js` |
| `GET /api/public/test-bank/revision` | `services/testBank/testBankService.js` |
| `POST /api/public/feedback` | `services/feedback/userFeedback.js` |
| `GET /api/public/feedback/replies` | `services/feedback/userFeedback.js` |
| `POST /api/public/feedback/replies/read` | `services/feedback/userFeedback.js` |
| `GET /api/users/hearts` | `services/hearts/heartStatsService.js` |
| `POST /api/users/logout` | `src/App.jsx` |
| `POST /api/users/test-bank/answers` | `services/testBank/testBankService.js` |
| `POST /api/users/test-bank/grade` | `services/testBank/testBankService.js` |

**نکتهٔ معماری:** ۹ مسیر از ۱۵ مسیر، «کتابخانهٔ عمومی محتوا» است — یعنی سرویس‌های کلاینت عمداً **اول** نسخهٔ منتشرشدهٔ پنل را می‌خوانند و فقط در نبود آن به کاتالوگ ثابت/`mockData` برمی‌گردند. این الگو در `flashcardService.js:58`، `microContentService.js:27` و `contentService.js` صریحاً مستند شده است.

## ۳. `DOCUMENTED BUT NOT IMPLEMENTED` — ۱۲۲ مسیر

| دامنه | تعداد | پیشوند |
|---|---|---|
| flashcards | ۲۰ | `/api/flashcards/*` |
| international | ۱۸ | `/api/intl/*` |
| testBank | ۱۶ | `/api/bank/*` · `/api/sessions/*` |
| greenPath | ۱۱ | `/api/green-path/*` |
| analytics | ۱۰ | `/api/analytics/*` |
| articles | ۹ | `/api/articles/*` · `/api/me/*` |
| league | ۹ | `/api/league/*` |
| group | ۶ | `/api/group/*` |
| notes | ۵ | `/api/notes/*` |
| examBuilder | ۵ | `/api/exam-builder/*` |
| pricing | ۴ | `/api/pricing/*` |
| ai | ۲ | `/api/ai/*` |
| about | ۱ | `/api/public/about` |
| hearts | ۱ | `/api/hearts/series` |
| admin | ۱ | `/api/admin` (نمونهٔ شکل، نه مسیر واقعی) |
| سایر | ۴ | `userStorage.js` · `NotificationsSection.jsx` · … |

نمونه‌های شاخص:

- **لیگ و نوتیفیکیشن:** `src/layout/dashboard/NotificationsSection.jsx:5-6` صریحاً `GET /api/league/friends/notifications` و `GET /api/league/notifications` را به‌عنوان منبع دادهٔ اعلان‌ها نام می‌برد — هیچ‌کدام در سرور وجود ندارند.
- **گرین‌پث:** `greenPathRepository.js` یک `request` عمومی می‌سازد و ۱۱ مسیر `/api/green-path/*` را توصیف می‌کند؛ هیچ‌کدام پیاده نشده‌اند.
- **فلش‌کارت:** `flashcardService.js` در سرصفحه ۲۰ endpoint را فهرست می‌کند (`/api/flashcards/decks`، `/review/:cardId/rate`، `/shares/redeem` …). سرور فقط `/api/public/flashcards/library` را دارد.
- **آزمون‌های بین‌الملل:** `internationalService.js` ۱۸ مسیر `/api/intl/*` (attempt، submit، collections، teach-me) توصیف می‌کند که وجود ندارند.

## ۴. تفسیر و تصمیم

1. **این‌ها تخلف نیستند، قرارداد توصیفی‌اند.** کلاینت در نبود سرور، منطق را محلی اجرا می‌کند (شاهد: بازگشت به `mockData`/`COURSE_REGISTRY`). پس «پیاده‌سازی نکردن» فعلاً **رفتار مورد انتظار** است.
2. **ولی خطر واقعی دارند:** خوانندهٔ سرویس فکر می‌کند این داده server-backed و server-validated است. طبق بند ۲۳، منطق صرفاً client-side را **نباید** با دادهٔ تأییدشدهٔ سرور اشتباه گرفت.
3. **هیچ‌کدام کامل نشد** — خارج از scope اعلام‌شدهٔ فاز ۷ و بدون مصرف‌کننده‌های قطعی. به‌عنوان `OUT OF SCOPE` / `BLOCKED` ثبت می‌شوند.
4. **اقدام کم‌ریسک پیشنهادی (اجرا نشد):** افزودن نشانهٔ صریح `NOT IMPLEMENTED SERVER-SIDE` به سرصفحهٔ هر سرویس، تا مرز client-only/server-backed در کد روشن باشد.

## ۵. بازتولید

```bash
node scripts/client-contract-audit.mjs            # گزارش + JSON
node scripts/client-contract-audit.mjs --json     # خروجی ماشین‌خوان
node scripts/client-contract-audit.mjs --selftest # خودآزمون نرمال‌سازی مسیر
```

خروج با کد غیرصفر فقط وقتی رخ می‌دهد که **تماس واقعی** به مسیر ناموجود باشد (حالت فعلی: صفر).
