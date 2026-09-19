# گزارش امنیتی ماژول «آزمون‌های هماهنگ تپش» — تحلیل قبل از پیاده‌سازی

> طبق PHASE 43 سند الزامات امنیتی؛ این گزارش **قبل از هر تغییر کد** تولید شده است.
> تاریخ: ۱۴۰۵/۰۶/۲۹ — مخزن: `D-DayProject` (شاخه main)

---

## A. معماری فعلی (Current Architecture)

### پشته فناوری

| لایه | فناوری |
|---|---|
| فرانت‌اند | Vite 7 + React 19، SPA تک‌صفحه‌ای (`src/`) |
| سرور | Node.js خام بدون فریم‌ورک (`server.js`) — سرو استاتیک + دو API سوارشده |
| APIها | `database/adminApi.js` (پنل مدیریت)، `database/googleAuth.js` (ورود گوگل)، `database/apiPlugin.js` (ثبت‌نام/ورود شماره‌موبایل) |
| پایگاه داده | فایل JSON در `database/content/*.json` + `database/users.json` + `localStorage` مرورگر |
| احراز هویت ادمین | کوکی `tapesh_admin_session` (HttpOnly، SameSite=Strict) + CSRF هدر + scrypt برای رمز |
| احراز هویت کاربر سایت | **هیچ سشن سروری ندارد** — پس از ورود گوگل/شماره، شیء کاربر در `localStorage` (`tapesh:current-user`) نگه داشته می‌شود |
| ماژول آزمون هماهنگ | **کاملاً سمت کلاینت (Mock)** — `src/services/coordinatedExams/` |

### واقعیت بحرانی: آزمون در سرور وجود ندارد

سرویس فعلی (`coordinatedExamService.js:1-26`) خودش صریحاً «Mock» است و قرارداد API آینده‌اش را مستند کرده است. تمام منطق در مرورگر اجرا می‌شود:

- **کلید پاسخ داخل Bundle مرورگر است** — `src/services/coordinatedExams/mockData.js` شامل `correctAnswer` و `explanation` برای همهٔ ۲۰+ سؤال است و چون `greenPathRepository.js:18` از همین فایل `EXAMS` را import می‌کند، کل ماژول (از جمله `QUESTIONS` با کلید پاسخ) در خروجی Build قرار می‌گیرد.
- **Attempt و پاسخ‌ها در localStorage است** — کلید `tapesh:coordinated:v1:<userId>`؛ هر کاربری با DevTools می‌تواند پاسخ‌ها را ویرایش کند، Attempt اضافه کند یا نتیجهٔ ساختگی بنویسد.
- **زمان از ساعت کلاینت است** — `getServerTime()` عملاً `Date.now()` است (`coordinatedExamService.js:45-47`)؛ تغییر ساعت سیستم = زمان نامحدود.
- **تصحیح سمت کلاینت است** — `gradeAttempt` (`coordinatedExamService.js:261-296`) در مرورگر اجرا می‌شود.
- **کارنامه/رتبه ساختگی است** — `communityScores` با RNG دمویی نمرات دیگران را می‌سازد.
- **هیچ Audit، Rate Limit، Idempotency یا کنترل مالکیتی در کار نیست** — چون اصلاً سروری در جریان نیست.

**پاسخ سؤال پایانی سند** («اگر Client کاملاً غیرقابل اعتماد باشد، آیا Server می‌تواند قوانین آزمون را enforce کند؟») برای وضعیت فعلی: **خیر — چون Server اصلاً در بازی نیست.**

### نکات مثبت موجود

- قرارداد API آینده از قبل در سربرگ سرویس مستند شده و شکل Entityها سرورپسند طراحی شده است.
- `sanitizeQuestion` اصل «کلید پاسخ به UI محیط آزمون نده» را رعایت می‌کند (هرچند در Bundle لو می‌رود).
- تایمر UI مطلق است (`endsAt - now`) نه شمارندهٔ نسبی — با معماری سرورمحور سازگار است.
- لایه ادمین CMS (`adminApi.js`) الگوی سالمی دارد: سشن CSPRNG، CSRF با مقایسهٔ constant-time، Permission سمت سرور، scrypt — قابل الگوبرداری برای API آزمون.

---

## B. مرزهای اعتماد (Security Boundaries)

```
┌─ UNTRUSTED ────────────────────────────────────────────────┐
│ Browser: React SPA، localStorage، ساعت سیستم، DevTools،    │
│ Request دستکاری‌شده، Replay، Script خارجی                  │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTPS فقط
┌─ TRUST BOUNDARY ۱ (ورودی)▼─────────────────────────────────┐
│ Public API (server.js) — نقطهٔ واحد ورود؛ اعتبارسنجی بدنه،  │
│ سقف حجم، Rate Limit، no-store                              │
├─ TRUST BOUNDARY ۲ (هویت)──────────────────────────────────┤
│ Session Layer: کوکی HttpOnly ↔ سشن فایل‌محور سرور          │
├─ TRUST BOUNDARY ۳ (مجوز)──────────────────────────────────┤
│ Authorization: مالکیت Attempt/Result، خط‌مشی ثبت‌نام، Role  │
├─ SEMI-TRUSTED ─────────────────────────────────────────────┤
│ Exam Service (State Machine زمانی) → Attempt Engine        │
│ (Idempotency + Expiry) → Question Delivery (sanitize)      │
├─ TRUSTED ──────────────────────────────────────────────────┤
│ Scoring Engine (فقط سرور) → Result Service → Audit Chain   │
│ → JSON Store (atomic write + mutex درون-پروسسی)            │
└────────────────────────────────────────────────────────────┘
```

- **Untrusted:** هر داده‌ای که از مرورگر می‌آید، شامل هویت ادعایی (`userData` در localStorage).
- **Semi-Trusted:** داده‌های seed دمو (زمان‌ها نسبی‌اند)، توزیع جامعهٔ آماری تا وقتی دادهٔ واقعی کم است.
- **Trusted:** فایل‌های سرور، ساعت سرور، کلیدهای پاسخ (هرگز از مرز ۳ به بیرون نمی‌روند).

---

## C. فهرست دارایی‌ها (Asset Inventory)

| # | دارایی | محل فعلی | کی می‌خواند/می‌نویسد | اثر افشا | اثر دستکاری |
|---|---|---|---|---|---|
| ۱ | User Identity | `users.json` + localStorage | سرور/کاربر خودش | PII | جعل هویت |
| ۲ | Session | فعلاً ندارد برای کاربر سایت | — | تصاحبAttempt | دور زدن مجوز |
| ۳ | Exam (تعریف/زمان‌بندی) | Bundle کلاینت | همه | کم | **قانون‌گذاری مجدد آزمون** |
| ۴ | Exam Version/Snapshot | ندارد | — | — | سؤالِ وسط آزمون عوض می‌شود |
| ۵ | Question Content | Bundle | همه | لو رفتن سؤال قبل از آزمون | — |
| ۶ | **Answer Key** | **Bundle (mockData.js)** | **همه** | **فاجعه — تقلب تضمینی** | — |
| ۷ | Attempt | localStorage کاربر | کاربر (کنترل کامل!) | کم | **نمرهٔ دلخواه** |
| ۸ | Attempt State | localStorage | کاربر | — | دور زدن پایان زمان |
| ۹ | User Answer | localStorage | کاربر | — | ویرایش پس از ثبت |
| ۱۰ | Score/Result | محاسبهٔ کلاینت | کاربر | — | نمرهٔ ساختگی |
| ۱۱ | Ranking | RNG کلاینت | همه | کم | — |
| ۱۲ | Admin Config | `admins.json` (در گیت!) | ادمین | hash ادمین در ریپو | — |
| ۱۳ | Audit Log | **ندارد** | — | — | انکارپذیری کامل |
| ۱۴ | Access Token | ندارد برای کاربر سایت | — | — | — |
| ۱۵ | Secrets | `.env` (ایگنور شده ✓)، `users.json` (در گیت ✗) | — | هش رمزها | — |

---

## D. مدل تهدید (Threat Model) — گزیدهٔ پرریسک‌ها

قالب: Asset → Attack Vector → Precondition → Impact → Risk → کنترل پیشگیرانه/کاشف.

| # | تهدید | سناریو حملهٔ مشخص در کد فعلی | Risk | کنترل اصلاحی |
|---|---|---|---|---|
| T1 | **Answer Key Leakage** | باز کردن DevTools → Sources → `mockData.js` → همهٔ پاسخ‌های درست | **Critical** | کلید پاسخ فقط در سرور؛ تحویل سؤال sanitizeشده فقط با Attempt فعال |
| T2 | **Score Manipulation** | ویرایش `tapesh:coordinated:v1:*` در localStorage یا فراخوانی مستقیم `gradeAttempt` از کنسول | **Critical** | تصحیح فقط سرور؛ خروجی کاربر هرگز ورودی نمره نیست |
| T3 | **Time Manipulation** | `Date.now()` جلو زده شود یا سیستم‌ساعت عوض شود → تایمر می‌ایستد/ادامه می‌یابد | **Critical** | زمان مرجع = ساعت سرور؛ سقف پذیرش پاسخ/submit سمت سرور |
| T4 | **Attempt State Forgery** | `status:'in_progress'`→دستی، Attempt تکراری، حذف submittedAt | **Critical** | Attempt فقط سرور ساخته/تغییر می‌کند؛ localStorage از حلقه حذف می‌شود |
| T5 | **Multi-Tab/Multi-Device Divergence** | دو تب = دو کپی localStorage که همدیگر را override می‌کنند (`mutateState` read-modify-write بدون قفل) | High | State فقط سرور؛ ثبت پاسخ idempotent و merge سمت سرور |
| T6 | **Replay Attack** | تکرار submit/answer در نسخهٔ شبکه (وقتی fetch شود) | High | Idempotency: submit دومی همان نتیجهٔ اول را برمی‌گرداند؛ unique بودن transition |
| T7 | **Question Enumeration** | `fetchExamQuestions(slug)` بدون Attempt قابل فراخوانی است | High | سؤال فقط با Attempt معتبرِ در جریان و پس از ثبت Delivery تحویل می‌شود |
| T8 | **Unauthorized Access / No Auth** | هیچ احراز هویتی در جریان آزمون نیست؛ هر کس با هر localStorageای «هر کاربری» است | **Critical** | سشن سروری کوکی‌محور برای Attempt/Registration/Result |
| T9 | **Result Manipulation / کارنامهٔ دیگران** | بعد از اتصال API: تغییر ID → IDOR | High | Ownership check روی Attempt/Result؛ ID غیرترتیبی (`randomBytes`) |
| T10 | **Race: Answer+Expiry / Double Submit** | دو درخواست همزمان، submit دوباره | High | Mutex درون-پروسسی + گذار وضعیت اتمیک + idempotency |
| T11 | **Rate Abuse / Enumeration** | اسپم endpointها (بعد از اتصال API) | Medium | Rate limit per-user/per-IP روی مسیرهای حساس |
| T12 | **Audit Tampering** | نپذیرفتن مسئولیت پس از تخلف؛ انکار رویداد | Medium | Audit append-only با hash chain (tamper-evident) |
| T13 | **Telemetry برای تقلب** | تب‌سوییچ، خروج از تمام‌صفحه | Low (Integrity نه Security) | ثبت Signal به‌عنوان شواهد، نه محکومیت قطعی (PHASE 4/31) |

تهدیدهای صریحاً **خارج از محدودهٔ کنترل نرم‌افزاری**: دوربین موبایل، شخص دوم کنار کاربر، جست‌وجوی اینترنتی با دستگاه دیگر — با لایهٔ Detection/Deterrence/Evidence مدیریت می‌شود، نه تضمین مطلق (خواست صریح سند).

---

## E. آسیب‌پذیری‌های فعلی (با قالب استاندارد)

### V1 — کلید پاسخ در Bundle مرورگر
- **Severity:** Critical | **جزء:** `mockData.js` (Bundle) | **ریشه:** Mock سمت کلاینت
- **سناریو:** دانشجو قبل/حین آزمون پاسخ‌ها را می‌بیند.
- **Fix:** انتقال بانک سؤال به سرور (`database/examSeed.mjs`)؛ حذف `QUESTIONS` از ماژول‌های کلاینت؛ تحویل sanitize.
- **Validation:** تست «در خروجی Build رشتهٔ correctAnswer وجود ندارد» + تست API.

### V2 — هیچ احراز هویت/سشنی برای کاربر سایت
- **Severity:** Critical | **جزء:** `usersStore.js`/`apiPlugin.js`/ماژول آزمون
- **سناریو:** هویت فقط ادعای localStorage است؛ `/api/users/lookup` بدون احراز PII می‌دهد؛ `/api/users/register` روی شمارهٔ موجود **بازنویسی/تصاحب حساب** می‌کند (`usersStore.js:82`).
- **Fix (در محدودهٔ آزمون):** سشن سروری کوکی‌محور فایل‌پشتیبان؛ Attempt/Registration/Result فقط با سشن. (تصاحب حساب از مسیر register و hash بدون salt — V8 — مستند می‌شود و اصلاح کاملش کار جداگانهٔ احراز هویت است.)
- **Residual:** امنیت حساب به قوت رمزهای کاربران سایت باقی می‌ماند تا V8 اصلاح شود.

### V3 — زمان مرجع = ساعت کلاینت
- **Severity:** Critical | **جزء:** `getServerTime()` | **Fix:** `/api/server-time` + offset + اعمال سرور روی پذیرش پاسخ/submit.

### V4 — تصحیح و نتیجه سمت کلاینت
- **Severity:** Critical | **جزء:** `gradeAttempt`/`buildResult` | **Fix:** Scoring Engine سرور؛ خروجی کلاینت نادیده گرفته می‌شود.

### V5 — Attempt قابل جعل (localStorage)
- **Severity:** Critical | **Fix:** Attempt Engine سرور با ID غیرترتیبی (`randomBytes(16)`) و ownership.

### V6 — Data store بدون atomicity/lock (پیش‌بینی Race)
- **Severity:** Medium (وقتی سرور بیاید) | **جزء:** الگوی `contentStore.js:176-189` (read-modify-write بی‌قفل؛ کرش وسط نوشتن = فایل خراب با fallback بی‌صدا)
- **Fix:** در examStore جدید: نوشتن اتمیک (tmp+rename) + صف serialize برای تغییر وضعیت.

### V7 — بدون Audit و Rate Limit
- **Severity:** Medium | **Fix:** Audit chain + rate limit درون-پروسسی.

### V8 (خارج از ماژول، مستند برای رفع آتی)
- رمز کاربر سایت: SHA-256 بدون salt (`usersStore.js:9-11`) — ارتقا به scrypt با rehash در ورود.
- `database/users.json` و `admins.json` **tracked در گیت** (PII + هش) — باید untrack شوند.
- ادمین پیش‌فرض `0135/0135` + `mustChangePassword` که سرور enforce نمی‌کند.
- `/api/users/lookup` بدون احراز؛ register-overwrite (تصاحب حساب).
- SVG آپلودی same-origin (Stored XSS)، نبود CSP/HSTS/X-Frame-Options.
- Rate limit ورود ادمین فقط username-keyed (قفل‌سازی هدف‌دار ممکن).

---

## F. رده‌بندی ریسک

| رده | موارد |
|---|---|
| Critical (بلافاصله) | V1 کلید پاسخ، V2 هویت، V3 زمان، V4 نمره، V5 Attempt |
| High | V6 Race/atomicity، T7 Enumeration، T10 Idempotency |
| Medium | V7 Audit/Rate limit، T11، T12، V8 (بخش گیت/PII) |
| Low / Integrity | Telemetry رفتار مشکوک (T13)، دترمنیسم دمو |

---

## G. معماری امنیتی پیشنهادی

اصل حاکم (خواست سند): **«Frontend نمایش است؛ Backend مرجع حقیقت است.»**

```
Client (React)
  │  فقط نمایش + درخواست؛ هیچ State امنیتی محلی نیست
  ▼
Exam API (database/examApi.js — الگوی adminApi.js)
  │  سشن کوکی HttpOnly → هویت سروری
  │  Rate Limit → Input Validation → Ownership
  ▼
Attempt Engine (examStore.js)
  │  State Machine: NOT_STARTED→IN_PROGRESS→SUBMITTED/EXPIRED/INVALIDATED
  │  Mutex + Atomic write، Idempotency، Expiry سمت سرور
  ▼
Question Delivery — فقط sanitize، فقط با Attempt فعال، ثبت Delivery
  ▼
Scoring Engine (فقط سرور، دترمنیستیک، قابل Recalculate)
  ▼
Result Service (Ownership + سیاست انتشار resultReleaseAt)
  ▼
Audit Chain (append-only، hash متصل به قبلی)
  ▼
JSON Store (exams / examQuestions / examAttempts / examAudit / examReports)
```

تصمیم‌های کلیدی:
1. **حذف کامل State آزمون از localStorage** — تنها حافظهٔ کلاینت، ذخیرهٔ موقت ارسال‌های در صف هنگام قطعی اینترنت است (PHASE 30) که پس از اتصال با idempotency پذیرفته/رد می‌شود.
2. **سشن کاربر سایت جدید**: کوکی `tapesh_user_session` (HttpOnly, SameSite=Strict, Secure در production) + فایل‌پشتیبان (پایدار در ری‌استارت وسط آزمون). صدور در login/register/handoff موجود — بدون شکستن قرارداد فعلی. مهمان فقط خواندنی است؛ آزمونک روزانه با سشن ناشناس خودکار مجاز است (خط‌مشی صریح).
3. **Version Snapshot**: Attempt در لحظهٔ ساخت، `examVersion` و `questionIds` را فریز می‌کند (PHASE 6).
4. **AttemptQuestion نهاد جاسازی‌شده**: `attempt.answers[qid] = {selected, answeredAt, changes}` + `attempt.deliveredAt[qid]` — نهاد مستقل سبک به‌جای رکورد جدا برای ۱۰۰ سؤال.
5. **Time Model**: مرجع = ساعت سرور؛ `endsAt` = `exam.endTime` (exam_end) یا `startedAt+duration` (per_attempt)؛ مرز پذیرش = لحظهٔ رسیدن به سرور؛ Grace قابل‌پیکربندی (پیش‌فرض ۰؛ سندگرایی). Race پایان/ثبت: هر دسترسی اول Expiry Sweep می‌کند؛ گذار وضعیت اتمیک است.
6. **Rate Limit** درون-پروسسی (سازگار با تک‌پروسسه فعلی؛ برای مقیاس افقی مستند شد که Redis لازم است — اضافه نمی‌شود چون Stack فعلی آن را نمی‌خواهد، PHASE 34).
7. **امنیت ≠ تئاتر**: هیچ قابلیت «غیرفعال‌سازی راست‌کلیک» و نظیر آن اضافه نمی‌شود؛ JS obfuscation هدف امنیتی ندارد.

---

## H. تغییرات مدل داده

| فایل جدید (سرور) | محتوا |
|---|---|
| `database/content/exams.json` | تعریف آزمون‌ها + `currentVersion` + قوانین + `seedSource` برای re-anchor دمو |
| `database/content/examQuestions.json` | سؤال‌ها **با** `correctAnswer/explanation` — فقط سرور؛ هر سؤال `examId`+`version` |
| `database/content/examAttempts.json` | Attemptها + answers/deliveredAt/result جاسازی‌شده |
| `database/content/examAudit.json` | Audit chain |
| `database/content/examReports.json` | گزارش ایراد سؤال (append-only) |
| `database/users.sessions.json` | سشن‌های کاربر سایت (token→userId، expiry، ip، ua) |

Attempt:
```json
{
  "id": "att-<128bit random>",
  "userId": "...", "examId": "...", "examVersion": 1,
  "startedAt": 1758270000000, "endsAt": 1758277200000,
  "submittedAt": null, "status": "in_progress|submitted",
  "reason": "user|timeout|auto|grace",
  "questionIds": ["q-..."],            // فریزشده هنگام ساخت
  "answers": { "q-...": { "selected": 2, "answeredAt": ..., "changes": 1 } },
  "deliveredAt": { "q-...": 1758270010000 },
  "result": { ... }                     // پس از submit، غیرقابل تغییر
}
```

---

## I. تغییرات API (نهایی)

| Method/Route | احراز | توضیح |
|---|---|---|
| `GET /api/server-time` | عمومی | ساعت رسمی + برای sync تایمر |
| `GET /api/exams` | عمومی (خواندنی) | فهرست + userState هر کاربر |
| `GET /api/exams/:slug` | عمومی | جزئیات + userState |
| `POST/DELETE /api/exams/:slug/registration` | سشن | ثبت/لغو با خط‌مشی زمانی سرور |
| `POST /api/exams/:slug/attempts` | سشن | شروع؛ `endsAt` سرور؛ ID غیرترتیبی |
| `GET /api/attempts/active` | سشن | Resume |
| `GET /api/attempts/:id` | سشن + مالک | Resume بعد از Refresh |
| `GET /api/attempts/:id/questions` | سشن + مالک + in_progress | **تنها راه دریافت سؤال**؛ sanitize؛ ثبت Delivery |
| `PUT /api/attempts/:id/answers` | سشن + مالک + in_progress | Delta پاسخ؛ idempotent؛ null = حذف |
| `PUT /api/attempts/:id/progress` | سشن + مالک | currentIndex/subjectTab/marked (غیرامنیتی) |
| `POST /api/attempts/:id/submit` | سشن + مالک | Idempotent؛ تصحیح سرور؛ grace قابل پیکربندی |
| `GET /api/exams/:slug/result` | سشن | فقط کارنامهٔ خود |
| `GET /api/exams/:slug/questions/review` | سشن + submit شده | کلید پاسخ فقط اینجا و بعد از سیاست انتشار |
| `GET /api/exams/:slug/ranking` | عمومی | فقط تجمیعی؛ بدون PII |
| `POST /api/questions/:id/report` | سشن | append-only |

دریافت‌های پاسخ: پاکت `{success, data}` مطابق adminApi؛ فیلدهای اضافی بدنه (score، correctAnswer، status و…) **نادیده گرفته می‌شوند** (mass-assignment-proof).

---

## J/K/L/M. مدل Attempt، تحویل سؤال، زمان، Audit

- **Attempt (J):** Stateها فقط سروری؛ هر Request با Attempt → بررسی مالکیت + وضعیت + پنجرهٔ زمانی + تعلق سؤال. گذارهای مجاز: `IN_PROGRESS→SUBMITTED` (user/timeout)، `IN_PROGRESS→EXPIRED` (سوئیپ)، `*→INVALIDATED` (ادمین/پادزهری آتی). گذار اتمیک در mutex؛ submit دوم = همان پاسخ اول (idempotent).
- **Question Delivery (K):** سؤال هیچ‌گاه بدون Attempt تحویل نمی‌شود؛ `deliveredAt` ثبت می‌شود؛ پاسخِ سؤالِ تحویل‌نشده پذیرفته نمی‌شود؛ هر پاسخ باید به `questionIds` همان Attempt تعلق داشته باشد (ضد Cross-Exam/Cross-Attempt).
- **Time (L):** نمایش تایمر با offset از `/api/server-time`؛ اعتبار فقط ساعت سرور؛ پاسخِ رسیده در `(endsAt, endsAt+grace]` فقط در submit نهایی پذیرفته و `reason:'grace'` می‌گیرد؛ بعدش رد. Consistency چند-نودی خارج از محدودهٔ فعلی (تک‌پروسسه) — مستند.
- **Audit (M):** `{seq, ts, actorId, action, examId, attemptId, detail, prevHash, hash}` با `hash=sha256(prevHash+canonical)`؛ اکشن‌ها: EXAM_REGISTERED، ATTEMPT_CREATED، QUESTION_DELIVERED، ANSWER_RECORDED، EXAM_SUBMITTED، EXAM_EXPIRED، QUESTION_REPORTED، SUSPICIOUS_REQUEST، RATE_LIMITED. Append-only؛ هیچ مسیر حذف/ویرایش وجود ندارد.

---

## N. طرح تست امنیتی (Security Test Plan)

`database/examApi.test.mjs` (هم‌سبک `adminApi.test.mjs`، بدون فریم‌ورک) — سناریوها:

1. دسترسی بدون سشن → ۴۰۱ برای شروع/پاسخ/submit/کارنامه
2. ثبت‌نام/شروع قبل از بازه → رد
3. دریافت سؤال بدون Attempt → رد؛ با Attempt → بدون `correctAnswer`/`explanation`
4. پاسخ به سؤال خارج از Attempt → رد (Cross-Exam)
5. پاسخ سؤال تحویل‌نشده → رد
6. پاسخ پس از endsAt → رد + سوئیپ به EXPIRED/SUBMITTED(timeout)
7. submit دوباره → همان نتیجه (بدون نمرهٔ دوم) — Idempotency
8. پاسخ همزمان یک سؤال → آخرین حالت دترمنیستیک؛ پاسخ null → حذف
9. IDOR: کاربر B به Attempt کاربر A → ۴۰۴/۴۰۳
10. Mass assignment: ارسال score/correctAnswer/status در بدنه → نادیده
11. Attempt ID غیرترتیبی (entropy)
12. Rate limit شروع/submit → ۴۲۹
13. زنجیرهٔ Audit معتبر (hash chain)
14. نمرهٔ محاسبه‌شدهٔ سرور با محاسبهٔ مستقل مطابق (Recalculate determinism)
15. Review بدون submit → رد؛ بعد از submit → با کلید پاسخ
16. Snapshot نسخه: تغییر سؤال بعد از شروع Attempt، Attempt را تغییر نمی‌دهد

معیار پذیرش نهایی (Definition of Done سند) در انتهای گزارش پیاده‌سازی لحاظ شده است.

---

## ترتیب پیاده‌سازی (Implementation Protocol — STEP 1..15 سند)

1. examStore + seed سرور → 2. سشن کاربر سایت → 3. examApi + rate limit + audit → 4. سیم‌کشی server.js/vite → 5. سرویس کلاینت روی API (همان امضاها) → 6. حذف کلید پاسخ از Bundle → 7. تست امنیتی → 8. گزارش After (Files Changed/Controls/Remaining Risks).

---

# گزارش پس از پیاده‌سازی (After-Implementation Report)

## A. Files Changed / Added

**جدید (سرور):**
- `database/examStore.js` — موتور آزمون: State Machine زمانی، Attempt Engine، Scoring سرور، Version Snapshot، سوئیپ انقضا، Audit hash chain، نوشتن اتمیک (tmp+rename)
- `database/examApi.js` — ۱۶ مسیر API با Rate Limit، الزام هدر `x-tapesh-exam` برای متدهای تغییردهنده، پاکت خطای دو-لایه (code + reason)
- `database/examApiPlugin.js` — سوارکردن API آزمون روی سرور توسعه/پیش‌نمایش ویت
- `database/examSeed.mjs` — بانک سؤال و تعریف آزمون‌ها (فقط سرور؛ شامل کلید پاسخ)
- `database/userSessions.js` — سشن کاربر سایت: کوکی HttpOnly + فایل `users.sessions.json` (پایدار در ری‌استارت)
- `database/usersApi.js` — هندلر مشترک `/api/users` (قبلاً فقط در توسعه بود؛ **در پروداکشن کار نمی‌کرد**)
- `database/examApi.test.mjs` — ۲۷ سنجهٔ امنیتی
- `src/services/coordinatedExams/examCatalog.js` — متادیتای نمایشی بدون سؤال (مصرف greenPath)
- `docs/security/coordinated-exams-security-report.md` — همین سند

**جدید (کلاینت):** سرویس `coordinatedExamService.js` بازنویسی شد روی API واقعی با **همان امضای قبلی** — UI بدون تغییر منطقی.

**حذف‌شده:** `src/services/coordinatedExams/mockData.js` (حامل کلید پاسخ در Bundle) — تنها مصرف‌کنندهٔ مجاز (greenPath) به `examCatalog.js` منتقل شد.

**ویرایش‌شده:** `server.js`، `vite.config.js`، `database/apiPlugin.js`، `database/googleAuth.js` (سشن روی handoff)، `src/layout/dashboard/tests/coordinated/CoordinatedExamsLayer.jsx` (تحویل سؤال فقط از Attempt)، `src/services/greenPath/greenPathRepository.js`، `.gitignore`.

## B. Database Changes
فایل‌های JSON جدید (gitignore شده): `database/content/exams.json`، `examQuestions.json` (کلید پاسخ)، `examAttempts.json`، `examAudit.json` (hash chain)، `examReports.json`، `database/users.sessions.json`. جدول‌های قدیمی دست‌نخورده‌اند.

## C. API Changes
طبق بخش I گزارش قبل از پیاده‌سازی — ۱۶ مسیر `/api/exams/*`، `/api/attempts/*`، `/api/questions/:id/report`، `/api/exams/server-time`. مسیرهای `/api/users` حالا در پروداکشن هم سوارند (رفع یک شکست عملکردی قدیمی).

## D. Security Controls Implemented
1. کلید پاسخ و سؤال‌ها فقط سرور — تحویل sanitize فقط با Attempt فعال (تست ۹/۲۱)
2. هویت سروری: کوکی HttpOnly/SameSite=Strict/فایل‌پشتیبان؛ سشن ناشناس فقط برای آزمونک (تست ۱۹)
3. زمان مرجع سرور؛ پاسخ تا endsAt، submit تا grace؛ سوئیپ timeout (تست ۲۲/۲۳)
4. تصحیح صرفاً سرور، دترمنیستیک و قابل بازمحاسبه (تست ۲۰)
5. Idempotency: submit دوباره = همان نتیجه؛ پاسخ delta با merge اتمیک (تست ۱۷/۲۴)
6. مالکیت روی همهٔ منابع — ضد IDOR (تست ۱۴)؛ ID غیرترتیبی ۱۲۸بیتی (تست ۷)
7. Mass-assignment-proof: فیلدهای امنیتی کلاینت نادیده (تست ۱۳)
8. Rate limit پنجره‌ثابت روی همهٔ مسیرها (تست ۲۵)؛ سقف حجم بدنه؛ no-store
9. Audit append-only با hash chain (تست ۲۷) + گزارش سؤال append-only
10. CSRF دومرحله‌ای: SameSite=Strict + هدر سفارشی (تست ۵)
11. `users.json` و پشتمان از گیت خارج شد؛ فایل‌های دادهٔ آزمون از ابتدا gitignore

## E/F. Tests Added / Passed
- `examApi.test.mjs`: **۲۷/۲۷ موفق**
- `adminApi.test.mjs`: **۷۸/۷۸ موفق** (بدون رگرسیون)
- `googleAuth.test.mjs`: **۳۴/۳۴ موفق** (بدون رگرسیون)
- تست دود HTTP روی `server.js` پروداکشن: ثبت‌نام → سشن → Attempt (۱۰۰ سؤال) → پاسخ → mass-assignment امن → submit نمره‌دهی سرور ✓
- Build پروداکشن: هیچ رشته/کلیدی از بانک سؤال هماهنگ در `dist/` نیست (grep تأیید کرد)

## G. Remaining Risks (پذیرفته‌شده و مستند)
1. **حساب کاربران سایت:** رمز با SHA-256 بدون salt و `/api/users/register` حساب موجود را بازنویسی می‌کند (تصاحب حساب) — اصلاحش کار جامع احراز هویت است و از محدودهٔ این تسک خارج بود؛ تا آن زمان امنیت Attemptها به قوت سشن است، نه رمزها.
2. **دادهٔ JSON تک-پروسسه:** مقیاس چند-نودی به DB واقعی + rate limit توزیع‌شده نیاز دارد (PHASE 34؛ در محدودهٔ فعلی عمداً ساده ماند).
3. **توزیع دموی جامعهٔ آماری:** تا کمتر از ۱۰ شرکت‌کنندهٔ واقعی، با توزیع ساختگی seed ترکیب می‌شود (فیلد `community.synthetic` صادقانه پر می‌شود).
4. `/api/users/lookup` بدون احراز PII می‌دهد (قبل از این هم بود؛ مستند در V8).
5. `admins.json` همچنان tracked است (username + scrypt hash ادمین).

## H. Known Limitations
- Telemetry ضدتقلب (Visibility/Fullscreen — PHASE 31) در این فاز پیاده نشد؛ جای معماری‌اش (Audit chain) آماده است.
- پنل ادمین برای مدیریت آزمون/نسخه/سؤال هنوز خط API ندارد؛ نسخه‌گذاری در store پشتیبانی می‌شود (`currentVersion`).
- Offline کامل (PHASE 30): بافر ارسال درون-حافظه است؛ بستن تب هنگام قطعی، آخرین deltaهای ارسال‌نشده را از دست می‌دهد (سرور آخرین وضعیت تأییدشده را نگه می‌دارد).

## I. Deployment Requirements
- بدون وابستگی جدید؛ `npm run build && npm run start` مثل قبل.
- در پروداکشن: کوکی‌ها Secure می‌شوند (`NODE_ENV=production`)؛ HTTPS/HSTS در لایهٔ Reverse Proxy توصیه می‌شود.
- فایل‌های `database/content/exam*.json` و `users.sessions.json` نباید به‌صورت عمومی سرو شوند (در dist نیستند؛ سرو استاتیک فقط dist/uploads است).
