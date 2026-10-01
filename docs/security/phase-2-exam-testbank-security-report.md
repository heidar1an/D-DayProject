# PHASE 2 — گزارش امنیت آزمون، بانک تست، پاسخ، امتیاز و پاداش

> دامنهٔ اعتماد: `Client → Question Delivery → Answer Submission → Server Validation → Grading → Score/Result → Reward`
> تاریخ اجرا: ۱۴۰۵/۰۷/۰۷ (۲۹ سپتامبر ۲۰۲۶) — مخزن `tapeshweb`
> اصل حاکم: **Client فقط «گفتنِ انتخاب» را دارد؛ حقیقت نتیجه فقط سرور است.**

---

## A. Verified Initial State

Audit قبلی (`docs/audit/MASTER-AUDIT-2026-09-29.md`) به‌عنوان فرض قطعی گرفته **نشد**؛ هر مورد با فراخوانی واقعی کد دوباره سنجیده شد. نتایج:

| # | یافته | وضعیت | شواهد اندازه‌گیری‌شده |
|---|---|---|---|
| ۱ | **نشت انبوه کلید پاسخ از endpoint عمومی** | 🔴 **تأییدشده (Critical)** | `GET /api/public/test-bank/questions` بدون هیچ احراز هویتی **۵۹ سؤال** را با `correctAnswer` + `explanation` + `stats.optionPercents` + `conceptIds` + `status` + `createdBy/updatedBy` برگرداند. ریشه: یک سریالایزر (`publicTestBankQuestion`) که کل رکورد را spread می‌کرد و **هم** پنل ادمین و **هم** مسیر عمومی را تغذیه می‌کرد (`contentStore.js`). |
| ۲ | **کلید پاسخ داخل Bundle پروداکشن** | 🔴 **تأییدشده (Critical)** | `src/services/testBank/mockData.js` (۱۶۴ KB) هر ۵۹ سؤال را با `correctAnswer`/`explanation`/`optionPercents` داشت و `contentStore.js` **همان ماژول** را به‌عنوان seed سرور import می‌کرد. باندل esbuild رشتهٔ `correctAnswer` و متن تحلیل‌های بانک را داشت. |
| ۳ | **مسیر عمومی دوم برای همان کلید** | 🟠 **تأییدشده (High)** | `GET /api/public/comprehensive/library` → `comprehensiveBankQuestion` برای هر واحد تا ۳۰ سؤال بانک را با فیلد `answer` (id گزینهٔ درست) و `explanation` بیرون می‌داد. |
| ۴ | **تصحیح سمت کلاینت** | 🟠 **تأییدشده (Medium/High)** | `testBankService.submitSession` مقدار `correct/wrong/score/percentage/wrongIds` را در مرورگر از `question.correctAnswer` می‌ساخت؛ `BankSession.handleSubmitAnswer` درستی را محلی تعیین می‌کرد. |
| ۵ | **کلید رویداد پاداش از ورودی کلاینت** | 🟠 **تأییدشده (Medium)** | `recordTestBankAnswers` مقدار `attemptKey = questionId:answeredAt` را از **کلاینت** می‌ساخت؛ تنها نگهبان، پنجرهٔ ۲۴ ساعته بود. با Replay و `answeredAt` جعلی، مسیر کلید تازه باز می‌شد. |
| ۶ | **نبود Rate Limit روی ثبت پاسخ** | 🟡 **تأییدشده (Low/Medium)** | `/api/users/test-bank/answers` فقط `assertSameOrigin` + بررسی JSON داشت؛ هیچ سقفی روی نرخ درخواست نبود. |
| ۷ | **اعتبارسنجی شل گزینه** | 🟡 **تأییدشده (Low)** | `Number(entry.selected)` آرایه و رشتهٔ تهی را هم می‌پذیرفت: `selected: [0]` و `selected: ''` هر دو به `0` تبدیل و **معتبر** تلقی می‌شدند. |
| ۸ | سؤال عمومی فقط با Attempt فعال تحویل شود | ⚪ **NOT FOUND / خارج از طراحی** | بانک تست «تمرین» است و در معماری فعلی Attempt سمت سرور ندارد (سشن‌ها محلی‌اند). این یک **واقعیت طراحی** است، نه نقصِ این فاز؛ در بخش K مستند شده. |

### آنچه سالم بود و دست‌نخورده ماند (تأیید مجدد)

| مرز | وضعیت | تأیید |
|---|---|---|
| آزمون‌های هماهنگ (زمان، مالکیت، sanitize، idempotency، audit) | ✅ **IMPLEMENTED** | `database/examApi.test.mjs` → **۲۷/۲۷** |
| احراز هویت کاربران سایت (سشن، scrypt، rate limit، ضدتصاحب) | ✅ **IMPLEMENTED** | `database/usersAuth.test.mjs` → **۷۸/۷۸** |
| پنل ادمین (RBAC، CSRF، audit) | ✅ **IMPLEMENTED** | `database/adminApi.test.mjs` → **۹۲/۹۲** |
| `GET /api/users/hearts` | ✅ هویت از سشن، نه از بدنه | سنجهٔ ۲۸/۳۳ مجموعه‌تست جدید |
| رتبه‌بندی (Ranking) مرتبط با بانک تست | ⚪ **NOT FOUND** | `src/services/league/*` هیچ ارجاعی به بانک تست ندارد؛ رتبه‌بندی آزمون هماهنگ سرورساز است |
| `POST /api/users/test-bank/answers` وابستگی به `isCorrect` کلاینت | ✅ از ابتدا نبود (سرور مقایسه می‌کرد) | بازبینی کد + سنجهٔ ۱۴/۱۵ |

---

## B. Changes Made

| File | Change | Reason | Security impact |
|---|---|---|---|
| `database/contentStore.js` | سه سریالایزر صریح: `publicTestBankQuestion` (**فهرست سفید**)، `testBankQuestionForAdmin` (کامل، ادمین)، `testBankQuestionInternal` (کامل، فقط تصحیح). `PUBLIC_TEST_BANK_FIELDS` + `publicTestBankStats` | یک تابع هم پنل و هم مسیر عمومی را تغذیه می‌کرد ⇒ نشت کلید | **بستن نشت انبوه.** افزودن فیلد تازه به رکورد، خودکار عمومی نمی‌شود (allowlist، نه blocklist) |
| `database/contentStore.js` | `recordTestBankAnswers` بازنویسی: اعتبارسنجی سخت (`typeof selected === 'number'`)، کلید پاداش از **ساعت سرور** (`questionId:<شمارهٔ روز>`)، بازگشایی کنترل‌شدهٔ هر سؤال، `Map` جای `find` در حلقه | کلید پاداش از کلاینت می‌آمد؛ آرایه/رشته در اعتبارسنجی رد می‌شد | **Replay بی‌اثر**؛ mass-assignment-proof؛ O(n·m) → O(n) |
| `database/contentStore.js` | `gradeTestBankAttempt()` جدید — تصحیح deterministic با کلید سرور و همان شکل `result` | نمره در کلاینت ساخته می‌شد | **نمره Server-authoritative** |
| `database/contentStore.js` | `comprehensiveBankQuestion` فیلد `answer`/`explanation` را دیگر نمی‌سازد؛ `publishedComprehensiveCourses` از بانک **درونی** تغذیه می‌شود | همان کلید از در دیگر بیرون می‌رفت | **بستن مسیر عمومی دوم** |
| `database/usersApi.js` | `POST /api/users/test-bank/grade` جدید؛ Rate Limit روی `answers` و `grade` | نبود Rate Limit؛ نبود مسیر تصحیح سروری | سقف نرخ + تصحیح سرورمحور؛ بازگشایی کلید از مسیر `answers` (پس از پاسخ) |
| `database/userRateLimit.js` | دو سیاست `testBankAnswer` و `testBankGrade`؛ `sweep` روی همهٔ سیاست‌ها (به‌جای دو مورد hard-code) | §۲۶ و §۳۶ (بدون منطق امنیتی تکراری) | Rate Limit با الگوی واحد پروژه، نه پیاده‌سازی موازی |
| `database/testBankSeed.mjs` | **جدید** — بانک کامل ۵۹ سؤالی با کلید، فقط سرور | جدا کردن دادهٔ حساس از ماژولی که در Bundle می‌رود | seed و تصحیح سرور ممکن ماند؛ کلید از مرز کلاینت بیرون رفت |
| `src/services/testBank/mockData.js` | `QUESTIONS` بدون `correctAnswer`/`explanation`/`optionPercents`/`difficultyIndex` (۱۶۴KB → ۷۱KB) | کلید پاسخ در JS به کاربر می‌رسید | **Bundle پاک از Answer Key**؛ فرادادهٔ UI (stem/options/stats/topicPath) دست‌نخورده |
| `src/services/testBank/testBankService.js` | `applyReveal` (نشاندن کلید سرور روی شیء سؤال)، `reportAnswers` با `results`، `recordBankAnswer` بازگشتی `{awarded, reveal}`، `checkBankAnswer`، `gradeBankAttempt`، `submitSession` سرورساز، `fetchReviewSession` با بازگشایی، `fetchQuestionAttemptStats` بر پایهٔ حکم سرور | حذف کلید از کلاینت ⇒ تصحیح باید از سرور بیاید | **حذف تصحیح کلاینت**؛ نبود شبکه = نبود نمره (نه نمرهٔ ساختگی) |
| `src/layout/dashboard/tests/bank/BankSession.jsx` | `revealed` به `answer.graded === true` گره خورد؛ `handleSubmitAnswer` async با `grading`؛ نمایش `submitError`؛ `finish` با try/catch و پیام خطا | بدون کلید محلی، بازگشایی باید منتظر سرور بماند | UI دیگر پیش از حکم سرور «درست/غلط» نشان نمی‌دهد؛ شکست تصحیح، شکست صریح است نه سکوت |
| `src/services/micro/microTestEngine.js` | `evaluateAnswer` async + `checkBankAnswer` | چک‌پوینت‌های میکرو هم از همان بانک تغذیه می‌شوند | درستی چک‌پوینت‌ها هم سرورمحور شد |
| `src/layout/dashboard/courses/micro/MicroCheckpoint.jsx` | `handleAnswer` async + گارد `gradingRef` | همان دلیل | جلوگیری از دوبار ثبت هنگام رفت‌وبرگشت تصحیح |
| `src/layout/dashboard/courses/micro/MicroCourseReader.jsx` | `handleAssessmentAnswer` async | همان دلیل | آزمون جمع‌بندی میکرو سرورمحور |
| `src/layout/dashboard/courses/learning/LearningActivities.jsx` | `UnitBankSession.submit` async + `checkBankAnswer` + نشاندن کلید روی شیء سؤال | «تست‌های این بخش» از بانک تغذیه می‌شود | همان مرز برای درسنامهٔ جامع |
| `src/layout/dashboard/tests/bank/README.md` | بازنویسی بند ۳ «اصول کلیدی» | مستندات کهنه، منبع تصمیم غلط می‌شود | — |
| `package.json` | `npm run bank:test` و `npm run exam:test` | اجراپذیری تست‌ها | — |
| `database/testBankSecurity.test.mjs` | **جدید** — ۴۰ سنجه | §۳۸ | نگهبان رگرسیون |
| `docs/security/phase-2-exam-testbank-security-report.md` | **جدید** — همین سند | §۴۰ | — |

---

## C. Test Bank — Before / After

| محور | Before | After |
|---|---|---|
| `GET /api/public/test-bank/questions` | ۵۹ سؤال با `correctAnswer`, `explanation`, `stats.optionPercents`, `stats.difficultyIndex`, `conceptIds`, `status`, `createdBy`, `updatedBy` | همان ۵۹ سؤال، فقط با ۱۶ کلید مجاز: `id, subject, track, source, type, difficulty, year, examMonth, topicPath, tags, conceptIds, stem, figure, options, createdAt, updatedAt, stats{solves, correctPercent, avgTimeSec}` |
| آمار عمومی | `optionPercents` (توزیع گزینه‌ها = راهنمای مستقیم کلید) | حذف شد؛ توزیع گزینه‌ها فقط **پس از پاسخ** و همراه بازگشایی می‌آید |
| مسیر ادمین | کلید داشت (و باید داشته باشد) | **دست‌نخورده** — `testBankQuestionForAdmin` همان رکورد کامل را می‌دهد (سنجهٔ دستی: `correctAnswer` و `explanation` هر دو موجود) |
| Bundle | `correctAnswer` + متن تحلیل‌ها در JS | صفر (کنترل مثبت: متن ۱۲ سؤال در باندل هست ⇒ روش سنجش معتبر است؛ نشت `keyPoint`: ۰/۵۹، `deep`: ۰/۵۹، `trap`: ۰/۵۹) |
| مسیر درسنامهٔ جامع | `answer` + `explanation` هر سؤال بانک | حذف شد؛ درخواست `GET /api/public/comprehensive/library` هیچ `answer`/`explanation` در سؤال‌های بانکی ندارد |
| سؤال عمومی ≠ سؤال درونی | یک شکل واحد | سه شکل صریح با مرز `allowlist` |

---

## D. Grading — Before / After

| محور | Before | After |
|---|---|---|
| تعیین درستی | `selected === question.correctAnswer` در مرورگر | `selected === question.correctAnswer` **در سرور** |
| ساخت `result` | `submitSession` در کلاینت | `POST /api/users/test-bank/grade` → `gradeTestBankAttempt` سرور |
| `score` / `percentage` | کلاینت | سرور؛ `score`/`percentage`/`correct` در بدنهٔ درخواست **نادیده گرفته می‌شود** (سنجهٔ ۲۱/۲۲) |
| `wrongIds` / `unansweredIds` | کلاینت | سرور |
| تفکیک درس/مبحث (`subjects`/`topics`) | از کلید محلی | از **درستیِ برگشتی سرور** ساخته می‌شود (فقط ارائه) |
| شکست شبکه | نمرهٔ محلی نمایش داده می‌شد | پیام خطای صریح؛ **نمرهٔ ساختگی ساخته نمی‌شود** |
| تکرار تصحیح | — | deterministic (سنجهٔ ۲۳) |

---

## E. Attempt Integrity — Before / After

| محور | Before | After |
|---|---|---|
| سشن‌های بانک تست | محلی (`localStorage`، `tapesh:testbank:v1:*`) | **بدون تغییر** (تصمیم آگاهانه، بخش K) |
| پاسخ‌های قابل ارسال به دیگری | پاسخ‌ها با کلید `userId` کلاینت ذخیره می‌شد | همان (بخش K) — اما **تصحیح و پاداش** به هویت سروری گره خورده |
| هویت در ثبت پاسخ | سشن سروری (`createGuestSession` برای مهمان) | بدون تغییر + سنجهٔ ۳۲ (هویت از بدنه گرفته نمی‌شود) |
| بازگشایی کلید برای سشن در جریان | فقط در حالت `exam` حذف می‌شد (بقیه از کلید محلی می‌خواندند) | کلید محلی وجود ندارد؛ در `exam` هم هیچ کلیدی نمی‌آید |
| Replay سشن | — | تصحیح بی‌اثر (deterministic)؛ پاداش idempotent |
| مرز آزمون‌های هماهنگ | سرورمحور با state machine | **دست‌نخورده** (`examApi.test.mjs` ۲۷/۲۷) |

---

## F. Reward Integrity — Before / After

| محور | Before | After |
|---|---|---|
| منبع درستی برای پاداش | سرور (درست بود) | سرور (بدون تغییر) |
| کلید رویداد | `questionId:<answeredAt کلاینت>` | `questionId:<شمارهٔ روز ساعت سرور>` |
| Replay با timestamp جعلی | می‌توانست کلید تازه بسازد | **بی‌اثر** (سنجهٔ ۲۶) |
| تکرار یک سؤال در یک درخواست | یک پاداش (تصادفی، به‌خاطر `answeredAt` یکسان) | قطعی یک پاداش (سنجهٔ ۲۷) |
| `isCorrect`/`reward`/`hearts`/`score` در بدنه | خوانده نمی‌شد | خوانده نمی‌شود + صریحاً مستند و تست‌شده (سنجهٔ ۱۴/۱۵) |
| Rate Limit | نداشت | ۱۵۰/دقیقه per-identity، ۶۰۰/دقیقه per-IP (سنجهٔ ۳۴ روی مسیر `grade`) |
| سقف پاداش | نامحدود در تعداد سؤال | حداکثر ۱ قلب به ازای هر (کاربر، سؤال، روز) — سنجهٔ ۲۹ |

---

## G. Timing Integrity — Before / After

| محور | Before | After |
|---|---|---|
| زمان آزمون‌های هماهنگ | `GET /api/exams/server-time` + `endsAt` سروری | **دست‌نخورده** (مرز مرجع، سنجهٔ ۳۵) |
| تایمر سشن بانک تست | `startedAt`/`endsAt` محلی، از `createSession` کلاینت | **بدون تغییر** — این تایمر UX تمرین شخصی است، نه ددلاین آزمون رسمی (بخش K) |
| `timeSpent` در کارنامهٔ بانک | محاسبهٔ محلی | محلی (ارائه) + `avgTimeSec` **از سرور** |
| جعل ددلاین | در آزمون هماهنگ ناممکن | بدون تغییر؛ در بانک تمرینی ددلاین رسمی وجود ندارد |

---

## H. Tests

مجموعهٔ جدید: `database/testBankSecurity.test.mjs` → **۴۰/۴۰ موفق** (`npm run bank:test`)

| دسته (§۳۸) | سنجه‌ها | نتیجه |
|---|---|---|
| `public-question-security` | ۱–۷، ۳۸ | ✅ PASS |
| `answer-key-exposure` (Bundle + مسیرهای عمومی) | ۶، ۶.۱، ۸–۱۳ | ✅ PASS |
| `answer-submission-security` | ۱۴–۲۰ | ✅ PASS |
| `grading-integrity` | ۲۱–۲۵ | ✅ PASS |
| `replay-protection` | ۲۶ | ✅ PASS |
| `duplicate-submit` | ۲۷ | ✅ PASS |
| `reward-integrity` | ۲۸–۳۰ | ✅ PASS |
| `guest-security` | ۳۱–۳۳ | ✅ PASS |
| `rate-limit` | ۳۴، ۳۷ | ✅ PASS |
| `attempt-ownership` / `attempt-state` / `timing-integrity` / `ranking-integrity` / `localStorage-tampering` | ۳۵، ۳۶ (ارجاع به `examApi.test.mjs` به‌عنوان منبع پوشش) | ✅ PASS (به‌عنوان نگهبان مرز) |

### رگرسیون (قبل و بعد یکسان)

| مجموعه | قبل | بعد |
|---|---|---|
| `database/examApi.test.mjs` | ۲۷/۲۷ | **۲۷/۲۷** ✅ |
| `database/adminApi.test.mjs` | ۹۲/۹۲ | **۹۲/۹۲** ✅ |
| `database/usersAuth.test.mjs` | ۷۸/۷۸ | **۷۸/۷۸** ✅ |
| باندل کلاینت (esbuild، `--charset=utf8`) | — | **بدون خطا/هشدار** ✅ |

### ماتریس دستکاری کلاینت (§۳۱)

| # | تست | نتیجه |
|---|---|---|
| ۱ | تغییر score در مرورگر ⇒ نتیجهٔ سرور عوض نشود | ✅ PASS (سنجهٔ ۲۱/۲۲) |
| ۲ | تغییر پاسخ درست محلی ⇒ تصحیح سرور عوض نشود | ✅ PASS (سنجهٔ ۱۳/۱۵ — کلید محلی وجود ندارد) |
| ۳ | ارسال پاداش جعلی ⇒ رد | ✅ PASS (سنجهٔ ۱۴) |
| ۴ | Replay پاداش ⇒ بدون تکرار | ✅ PASS (سنجهٔ ۲۶) |
| ۵ | ارسال پاسخ به Attempt دیگری | ⚠️ **PARTIAL** — آزمون هماهنگ: ✅ (`examApi.test.mjs` سنجهٔ ۹) · بانک تمرینی: N/A (بخش K) |
| ۶ | تغییر ساعت کلاینت ⇒ ددلاین عوض نشود | ✅ PASS برای آزمون هماهنگ (`examApi.test.mjs` ۲۲/۲۳) |
| ۷ | ارسال دوبار ⇒ بدون نمرهٔ دوم | ✅ PASS (سنجهٔ ۲۳/۲۷) |
| ۸ | درخواست endpoint سؤال ⇒ بدون کلید | ✅ PASS (سنجهٔ ۳/۵/۳۸) |
| ۹ | درخواست Attempt دلخواه ⇒ رد | ✅ PASS برای آزمون هماهنگ (`examApi.test.mjs` سنجهٔ ۱۴) |
| ۱۰ | درخواست کارنامهٔ خصوصی ⇒ بررسی مالکیت | ✅ PASS برای آزمون هماهنگ (`examApi.test.mjs`) |

---

## I. Files Changed

**سرور**
1. `database/contentStore.js`
2. `database/usersApi.js`
3. `database/userRateLimit.js`
4. `database/testBankSeed.mjs` *(جدید)*
5. `database/testBankSecurity.test.mjs` *(جدید)*

**کلاینت**
6. `src/services/testBank/mockData.js`
7. `src/services/testBank/testBankService.js`
8. `src/layout/dashboard/tests/bank/BankSession.jsx`
9. `src/layout/dashboard/tests/bank/README.md`
10. `src/services/micro/microTestEngine.js`
11. `src/layout/dashboard/courses/micro/MicroCheckpoint.jsx`
12. `src/layout/dashboard/courses/micro/MicroCourseReader.jsx`
13. `src/layout/dashboard/courses/learning/LearningActivities.jsx`

**سایر**
14. `package.json` (دو اسکریپت تازه)
15. `docs/security/phase-2-exam-testbank-security-report.md` *(جدید)*

---

## J. Files Intentionally Unchanged

| فایل/دامنه | چرا دست نخورد |
|---|---|
| `database/examApi.js`, `database/examStore.js`, `database/examSeed.mjs` | امن‌ترین بخش پروژه؛ ۲۷/۲۷ سنجه. §۳۵ می‌گوید در صورت صحیح بودن **حفظ شود**. |
| `database/userSessions.js`, `database/sanitizeHtml.js` | هیچ نقصی در این فاز نداشتند؛ تغییر = ریسک بی‌دلیل. |
| `src/services/coordinatedExams/**` | کلید و Attempt از سرور می‌آید؛ نقشی در نشت بانک تست نداشت. |
| `src/services/league/**` | هیچ ارتباط مستقیمی با نتیجهٔ آزمون/بانک ندارد (§۱). |
| `database/adminApi.js` | مسیرهای ادمین بانک تست **باید** کلید را ببینند؛ با `testBankQuestionForAdmin` دست‌نخورده ماند. |
| `src/layout/admin/views/AdminTestBank.jsx`, `AdminMicro.jsx` | از API ادمین تغذیه می‌شوند و کلید را همان‌جا می‌گیرند. |
| `src/data/learning/anatomyCourse.js`, `src/data/micro/*.js` | محتوای **دست‌نویس مؤلف** (تمرین‌های درسنامه با پاسخ)، نه بانک سؤال آزمون — بخش K. |
| `src/services/learning/assessmentService.js` | برای همان تمرین‌های دست‌نویس است. |
| `src/layout/dashboard/tests/{QuestionLab,ResultView,QuestionExplanation}.jsx` | به آزمون‌های بین‌الملل سرویس می‌دهند، نه بانک تست. |
| ساختار `localStorage` سشن‌های بانک | مهاجرت کامل به سرور، تغییر معماری است؛ §۳۶ آن را ممنوع کرده. |
| وابستگی‌ها | هیچ پکیج تازه‌ای اضافه نشد (§۳۶). |

---

## K. Remaining Risks

1. **بانک تست یک «اوراکل تصحیح» است — پذیرفته و مستند.** `/api/users/test-bank/answers` بعد از ثبت پاسخ، کلید همان سؤال را برمی‌گرداند. این **الزام محصول** است (§۵: بازگشایی کنترل‌شده). با ۵۹ سؤال و ۴ گزینه، یک کاربر مصمم می‌تواند با ~۲۳۶ درخواست همهٔ کلیدها را استخراج کند. آنچه بسته شد **نشت انبوه** بود (دانلود ۱۶۴ کیلوبایتی کل کلید + Bundle). کنترل‌های باقی‌مانده: Rate Limit (۱۵۰/دقیقه)، ثبت هر پاسخ در سرور (قابل رهگیری)، و مستقل بودن آزمون‌های رسمی از این مسیر.
2. **سشن‌های تمرینی بانک تست همچنان محلی‌اند.** `questionIds` را کلاینت به `/test-bank/grade` می‌فرستد، پس می‌تواند سؤالی را حذف کند. اثرش فقط روی **کارنامهٔ تمرینی خودش** است: نه رتبه‌ای به آن گره خورده، نه گواهی، نه پاداش (پاداش مسیر مستقل و سرورمحور دارد). برای آزمون رسمی، معماری `examStore.js` برجاست.
3. **تمرین‌های دست‌نویس درسنامه‌ها** (`unit.learning.practice[].answer`, `labelQuiz.answer`) در payload عمومی و در Bundle هستند. این‌ها اثر مؤلف‌اند (شبیه پاسخ‌نامهٔ پایان فصل کتاب)، نه کلید بانک سؤال. اگر سیاست محصول بخواهد، فاز جداگانه لازم دارد.
4. **`database/testBankSeed.mjs` اکنون منبع کلید است.** هر ماژول کلاینتی که آن را import کند، نشت را برمی‌گرداند. سنجهٔ ۱۲ این را می‌سنجد، ولی یک بازبینی انسانی در Code Review هم لازم است.
5. **`conceptIds` عمداً عمومی است** — شناسهٔ مفهوم، نه کلید. اگر روزی معنی محرمانه گرفت، باید از allowlist حذف شود.
6. **تایمر و `timeSpent` بانک تست محلی است.** برای تمرین شخصی کافی است؛ اگر روزی «آزمون شخصی» کارنامهٔ رسمی بگیرد، باید مثل آزمون هماهنگ سرورمحور شود.
7. **Rate Limit درون-پروسسی است** — برای استقرار چند-نودی به ذخیره‌گاه مشترک نیاز دارد (محدودیت از پیش مستندشدهٔ پروژه).

---

## L. Deferred Problems

| # | مورد | چرا به فاز بعد |
|---|---|---|
| ۱ | انتقال کامل سشن‌های بانک تست به سرور (Attempt server-side با `questionIds` فریزشده) | نیازمند موتور Attempt دوم در کنار `examStore`؛ §۳۶ بازنویسی معماری را ممنوع کرده. برای بستن «حذف سؤال از بدنه» کافی است. |
| ۲ | پاسخ‌نامهٔ تمرین‌های دست‌نویس درسنامه‌ها → مسیر بازگشایی سروری | تغییر در `assessmentService` + `LearningEngine` + دادهٔ مؤلف؛ دامنه‌اش «درسنامه» است نه «بانک تست». |
| ۳ | صفحه‌بندی/`ETag` روی `/api/public/test-bank/questions` (۱۶۴KB در هر درخواست) | یافتهٔ عملکردی Audit قبلی، نه امنیتی. |
| ۴ | Telemetry ضدتقلب (تب‌سوییچ/تمام‌صفحه) برای آزمون هماهنگ | PHASE 4/31 سند؛ جای معماری‌اش (Audit chain) آماده است. |
| ۵ | Rate Limit توزیع‌شده | PHASE 34؛ نیازمند Redis. |
| ۶ | حذف ۴ فونت بی‌ارجاع (`Doran-Thin/Light/ExtraBlack`, `Pinar-FD-VF`) | منتظر تأیید صریح کاربر (یادداشت بلندمدت پروژه). |

---

## Completion Rule

| شرط §۴۱ | وضعیت |
|---|---|
| ۱. Correct Answer Leakage بسته شده | ✅ endpoint عمومی + مسیر جامع + Bundle |
| ۲. Grading Server-authoritative | ✅ `gradeTestBankAttempt` + `grade` endpoint |
| ۳. Attempt Ownership تأیید شده | ✅ آزمون هماهنگ ۲۷/۲۷ · بانک تمرینی: بدون Attempt سروری (مستند) |
| ۴. Score Tampering بسته شده | ✅ سنجهٔ ۲۱/۲۲ |
| ۵. Reward/Heart Tampering بسته شده | ✅ سنجهٔ ۱۴/۱۵/۲۶/۲۷/۲۹ |
| ۶. Replay/Double Submit کنترل شده | ✅ سنجهٔ ۲۳/۲۶/۲۷ |
| ۷. Timing Integrity تأیید شده | ✅ آزمون هماهنگ دست‌نخورده؛ بانک تمرینی تایمر UX (مستند) |
| ۸. Public Bundle پاک از Answer Key | ✅ باندل ساخته و اسکن شد (۰/۵۹ نشت تحلیل، ۰ کلید) |
| ۹. تست‌های جدید اجرا شده | ✅ ۴۰/۴۰ |
| ۱۰. Regression Testهای مرتبط Pass شده | ✅ ۲۷/۲۷ · ۹۲/۹۲ · ۷۸/۷۸ |

**نتیجه: `PHASE 2 COMPLETE`** — با سه محدودیت صریح و آگاهانه در بخش K (اوراکل بازگشایی به‌عنوان الزام محصول، سشن تمرینی محلی، تمرین‌های دست‌نویس مؤلف) که هیچ‌یک نشت انبوه کلید، تصحیح کلاینتی، یا پاداش قابل جعل را باز نمی‌گذارد.
