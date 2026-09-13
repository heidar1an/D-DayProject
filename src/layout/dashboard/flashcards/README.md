# فلش‌کارت تپش — معماری

لایهٔ یادگیری مبتنی بر Spaced Repetition: تپش نه فقط فلش‌کارت می‌دهد، بلکه می‌داند کاربر
چه چیزی را فراموش می‌کند، چه زمانی باید دوباره ببیند و چه چیزی باید قوی‌تر شود.

## نقشهٔ فایل‌ها

```
src/services/flashcards/
├── mockData.js            ← موجودیت‌های دامنه (Mock) + دک‌های رسمی تپش + محتوای واقعی کارت‌ها
├── spacedRepetition.js    ← موتور مستقل الگوریتم (SM-2 سبک، نسخه‌دار و config-driven)
└── flashcardService.js    ← قرارداد API واقعی (فعلاً Mock + localStorage + Sync-Queue آماده)

src/layout/dashboard/flashcards/
├── FlashcardSection.jsx   ← پوستهٔ لایه: هیرو، برنامهٔ امروز، دک‌ها، ضعیف‌ها، پیشنهادها، توست
├── ReviewSession.jsx      ← فضای مرور متمرکز + میانبرهای کیبورد + ارزیابی خوش‌بینانه
├── DeckView.jsx           ← جزئیات دِک: جستجو، فیلتر حالت/تگ، مدیریت کارت‌ها
├── CardEditor.jsx         ← ساخت/ویرایش کارت (basic | basic-hint | cloze | mcq) + هشدار کیفیت
├── DeckModal.jsx          ← ساخت/ویرایش دِک (نام، توضیح، موضوع، رنگ، دسترسی)
├── StatsView.jsx          ← آمار مینیمال: نمودار روزانه، هیت‌مپ تپشی، مباحث ضعیف، ترکیب کارت‌ها
├── SettingsView.jsx       ← محدودیت روزانه، پیکربندی الگوریتم، تجربهٔ مرور، خروجی JSON
├── flashcardShared.jsx    ← آیکن‌ها، StateChip، MasteryRing، Modal، رندر کلوز + reuse از leagueShared
└── flashcards.css         ← انیمیشن‌های ظریف مرور + گارد prefers-reduced-motion
```

## ۱. مدل داده (Entity ها)

شکل دقیق هر موجودیت در `mockData.js` مستند شده و همان قرارداد Backend آینده است:

- **Deck** `{ id, userId|null, title, description, type: user|tapesh, visibility, subjectId, level, cover, … }`
  — دو نوع: دک کاربر و دک رسمی تپش (`byTapesh`). محتوای دک تپش immutable است و «حذف» فقط یعنی خروج از کتابخانه.
- **Flashcard** `{ id, deckId, type, front, back, hint, media, tags[], subjectId, topicId, source, language, status, version, … }`
  — محتوای مستقل؛ `version` برای ویرایش کارت‌های تپش توسط کاربر (override محلی).
- **UserCardState** `{ userId, cardId, state, dueAt, intervalMinutes, easeFactor, stability,
  difficulty, learningStep, lapseCount, suspended, buriedUntil, bookmarked, masteryScore, … }`
  — **وضعیت یادگیری متعلق به کاربر است نه کارت**؛ از محتوای کاملاً جداست.
  حالت‌ها: `new | learning | review | relearning | mastered | suspended | archived`.
- **ReviewLog** `{ id, userId, cardId, deckId, rating, previousState, newState, previousInterval,
  newInterval, timeSpent, reviewedAt, algorithmVersion, mode }`
  — `algorithmVersion` (فعلاً `sm2-tapesh-v1`) تضمین می‌کند تغییر الگوریتم در آینده لاگ‌های قدیمی را نشکند.
- **CardSource** `{ sourceType: lesson|question|article|book|manual|ai|user, sourceId, title, url }`
  — رابطهٔ کارت با درسنامه/سؤال/مقاله؛ پایهٔ Learning Graph آینده.
- **Rating**: `again | hard | good | easy`

## ۲. موتور Spaced Repetition (`spacedRepetition.js`)

- کاملاً خالص و بدون وابستگی به React/Storage — فقط `rate(state, rating, config, now)` و خروجی‌های محاسباتی.
- پیکربندی در `DEFAULT_ALGORITHM_CONFIG`: گام‌های یادگیری، فاصلهٔ فارغ‌التحصیلی، آسان/سخت، سقف فاصله …
  کاربر از «تنظیمات» می‌تواند `algorithmConfig` را Override کند.
- `computeMastery` امتیاز تسلط ۰–۱۰۰ را از ترکیب صحت + ماندگاری (فاصله) + تازگی + سختی − لغزش
  محاسبه می‌کند (نه صرفاً تعداد مرور) و متمرکز است تا در آینده با FSRS جایگزین شود.
- `previewIntervals` پیش‌نمایش فاصلهٔ هر دکمهٔ ارزیابی را می‌دهد؛ **UI هرگز ریاضی فاصله انجام نمی‌دهد.**
- `isDue / isMastered / startOfLocalDay` معنای «امروز» و «تسلط» را یک‌جا تعریف می‌کنند.

## ۳. صف مرور و اولویت‌بندی

`buildQueue` در سرویس (نه UI):
- حذف کارت‌های Suspended و Buried تا پایان روز (`buriedUntil` با سوسپند تفاوت دارد).
- ترتیب: گام‌های یادگیری عقب‌افتاده → کم‌تسلط‌ترین‌ها → قدیمی‌ترین overdue — نه تصادفی.
- محدودیت روزانه: `newCardsPerDay` و `maxReviewsPerDay` با شمارش `ReviewLog` امروز
  (`previousState === 'new'` = کارت نو معرفی‌شده).
- کارت‌های نو بین مرورها پخش می‌شوند (نه دسته‌ای).
- حالت‌ها: `today` (برنامهٔ روز)، `deck` (کل دِک)، `weak` (تسلط < ۵۰)، `cram` (مرور آزاد؛
  فقط لاگ می‌شود و زمان‌بندی واقعی را تغییر نمی‌دهد).

## ۴. ارزیابی خوش‌بینانه و Offline-ready

- در `ReviewSession` موتور نتیجهٔ ارزیابی را بلافاصله محاسبه می‌کند و کارت بعدی **بدون انتظار شبکه**
  نمایش داده می‌شود؛ ثبت دائمی `rateCard` در پس‌زمینه می‌رود (`pendingOps` صف Sync برای نسخهٔ سرور).
- فاصلهٔ هدف: «پاسخ کاربر → کارت بعدی» حداقل؛ انیمیشن خروج ۲۲۰ms و با reduced-motion خاموش.

## ۵. تجربهٔ مرور (Focus Mode)

- سربرگ حداقلی: پایان مرور + «۱۸ / ۴۲» + نوار پیشرفت. بدون سایدبار و شلوغی.
- دکمه‌های ارزیابی مدرن با رنگ + **برچسب فاصلهٔ بعدی** (رنگ هرگز تنها حامل معنا نیست — همه متن و عدد دارند).
- میانبرها (فقط دسکتاپ، تشخیص `pointer: coarse`): Space = پاسخ، ۱–۴ = ارزیابی، N = انتقال به
  انتهای صف، E = ویرایش، S = سوسپند، B = گلچین، ? = راهنما. ویرایش در مودال باز می‌شود و
  بعد از Save مرور بدون از دست رفتن State ادامه می‌یابد.
- انواع کارت: basic، basic-hint (راهنما با کلیک)، cloze (مخفی → reveal)، mcq (انتخاب گزینه + توضیح).
- پایان مرور: Daily Summary (تعداد، دقت، زمان) و بازگشت با refresh کامل داده‌ها.

## ۶. API Contract (قرارداد با Backend)

- `GET /api/flashcards/overview` — امروز، شمارنده‌ها، استریک، ضعیف‌ها، پیشنهادها
- `GET /api/flashcards/decks` · `GET /api/flashcards/decks/:id` · `POST/PATCH/DELETE`
- `GET /api/flashcards/library` · `POST /api/flashcards/library/:id/add|remove`
- `POST /api/flashcards/cards` · `PATCH/DELETE /api/flashcards/cards/:id` · `…/archive`
- `GET /api/flashcards/review/queue?mode=today|deck|weak|cram&deckId=`
- `POST /api/flashcards/review/:cardId/rate` ← اعتبارسنجی سمت سرور (Anti-Cheat: هیچ امتیازی از Frontend قابل درج نیست)
- `POST /api/flashcards/cards/:id/suspend|unsuspend|bury|bookmark`
- `GET /api/flashcards/stats` · `GET/PATCH /api/flashcards/settings` · `POST /api/flashcards/events`

اتصال واقعی فقط بدنهٔ توابع `flashcardService.js` را تغییر می‌دهد؛ UI دست نمی‌خورد.

## ۷. اتصال به اکوسیستم تپش

- «ساخت فلش‌کارت از درسنامه» و «تبدیل سؤال به فلش‌کارت»: با فراخوانی `createCard` همراه با
  `source: { sourceType: 'lesson'|'question', sourceId, … }` — رابطه در مدل حفظ می‌شود و
  «مشاهده سؤال اصلی» از همان مسیر باز می‌شود. پنل‌های درسنامه/تست فقط یک دکمه لازم دارند.
- «از اشتباهاتم فلش‌کارت بساز»: پیشنهاد `sug-mistakes` در `SMART_SUGGESTIONS` الگوی payload دارد؛
  در نسخهٔ واقعی لیست سؤال‌های غلط‌زدهٔ تکراری از سرویس تست می‌آید و به همین Editor می‌ریزد.
- AI Integration: قرارداد `AI_CARD_PREVIEW` — پیشنهاد فقط با «تأیید و افزودن» کاربر وارد می‌شود.
- ناوبری: آیتم «فلش‌کارت» در هدر داشبورد + اکشن‌کارت «فلش کارت» صفحهٔ خانه (`DashboardActionCards`).

## ۸. پایداری، دسترس‌پذیری و ریضیک

- داده‌ها در `localStorage` با کلید `tapesh:flashcards:v1` به تفکیک `userId` — مرورها بین رفرش می‌مانند.
  برای ریست کامل: `localStorage.removeItem('tapesh:flashcards:v1')`.
- `useAsyncData` (مشترک با لیگ) لودینگ/خطا/Retry را می‌دهد؛ اسکلت‌ها هم‌اندازه‌اند و Layout Shift ندارند.
- همهٔ اعداد فارسی (`toFa/faNum`)، `dir=rtl`، فوکوس‌پذیری، `aria-pressed/expanded/current`،
  `role=switch/progressbar/progressbar`، دکمه‌های لمسی بزرگ در موبایل و گارد `prefers-reduced-motion`.
- تست حالت خطا از کنسول: `__flashcardService.__setFailure(true)` و سپس تعویض تب.
