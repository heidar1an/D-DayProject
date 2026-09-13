# آزمون‌ساز شخصی (Personal Exam Builder)

معماری این بخش در سه لایهٔ مستقل است؛ منطق کسب‌وکار از UI جدا و UI هرگز مستقیم به داده دست نمی‌زند.

```
services/examBuilder/
├── selectionEngine.js     ← موتور انتخاب سؤال (pure، بدون I/O، قابل تست)
├── presets.js             ← اهداف آزمون + پریست‌های هوشمند (هر کدام Configuration واقعی)
└── examBuilderService.js  ← لایهٔ API (فعلاً Mock + localStorage؛ قابل جایگزینی با Backend)

layout/dashboard/tests/builder/
├── PersonalExamBuilder.jsx   ← ریشه: Hub (مسیر سریع/پیشرفته) + Wizard
├── BuilderHub.jsx            ← ورود: مسیر سریع + پریست‌های هوشمند
├── BuilderWizard.jsx         ← ماشین حالت ۵ مرحله + draft + availability زنده
├── steps/                    ← هدف / درس‌ومبحث / تنظیمات / Blueprint
├── TopicTree.jsx             ← انتخاب درختی مبحث (Select All / Clear / Invert)
├── DifficultyDial.jsx        ← سطح سختی + توزیع درصدی
├── BlueprintCard.jsx         ← نمای Blueprint (تفکیک واقعی + هشدارها)
└── SavedExamsView.jsx        ← «آزمون‌های من» + Attemptها
```

## جریان داده

1. UI یک `config` (هدف، دروس، مباحث، تعداد، توزیع سختی، سهمیهٔ وضعیت، زمان، حالت، فیلترهای پیشرفته) می‌سازد.
2. `buildExamPlan(userId, config)` مخزن را از `testBankService` (با وضعیت کاربر) می‌گیرد، مباحث ضعیف را از پروفایل عملکرد استخراج می‌کند و `selectionEngine.planExam` سؤال‌ها را واقعاً برمی‌گزیند.
3. خروجی plan: `questionIds` + تفکیک واقعی + هشدارهای ساخت‌یافته (`quota-clamped`, `pool-smaller`, `difficulty-adjusted`, `subject-short`, `status-empty`, `no-match`) — هیچ Silent Failure وجود ندارد.
4. `saveExam` آزمون را با snapshot سؤال‌ها ذخیره می‌کند؛ `buildSessionConfigFromExam` آن را به سشن بانک تست تبدیل می‌کند (Player همان `BankSession` است).
5. پایان Attempt → `recordAttempt` درصد و نتیجه را به آزمون ذخیره می‌کند؛ روند پیشرفت در «آزمون‌های من» نمایش داده می‌شود.
6. CTA کارنامه → `prefillFromSession` مباحث ضعیف را استخراج و Builder را پیش‌تنظیم می‌کند.

## قلاب‌های آینده (بدون بازنویسی UI)

- **Backend**: امضای توابع همان REST آیندهٔ مستند در سربرگ سرویس است.
- **Knowledge Graph**: `fetchRelatedTopics` فعلاً از دادهٔ واقعی بانک (درخت مبحث + هم‌تگ‌ها) نتیجه می‌دهد؛ بعداً به گراف واقعی وصل می‌شود.
- **AI**: درخواست متنی کاربر در آینده به همان `config` تبدیل و به `buildExamPlan` داده می‌شود — کل مسیر پایین‌دست یکسان می‌ماند.
- **Seed-based generation**: موتور با `mulberry32` RNG قابل Seed دارد؛ تولید تکرارپذیر فقط نیاز به پاس‌دادن seed دارد.
