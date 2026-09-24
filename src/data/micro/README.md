# `src/data/micro/` — محتوای میکرودرسنامه

این پوشه **فقط داده** است. هیچ فایلی اینجا React ایمپورت نمی‌کند، هیچ سرویسی صدا نمی‌زند و
هیچ سؤالی داخلش تعریف نمی‌شود. موتور یادگیری
(`src/services/micro/`) و رابط کاربری (`src/layout/dashboard/courses/micro/`)
تنها این قرارداد را مصرف می‌کنند — پس **افزودن یک درس تازه = افزودن یک فایل داده، بدون
دست‌زدن به UI یا موتور**.

> مرجع سبک نوشتن: `physiologyCourse.js` — کامل‌ترین درس و همان چیزی که بقیه از رویش ساخته شده‌اند.

---

## ۱. سلسله‌مراتب

```
Subject Course  (یک فایل = یک درس)
└── Topic (مبحث)                published: true|false
    └── Learning Unit (واحد یادگیری)
        ├── concepts[]           گره‌های شبکهٔ دانش + قلاب اتصال به بانک تست
        ├── pages[]              صفحه‌های میکرو (order از ۱)
        │   ├── content          متن غنی صفحه (HTML پاک‌سازی‌شده) — منبع اصلی نمایش
        │   └── blocks[]         آرشیو مدل قدیمی؛ فقط سه نوع تعاملی هنوز رندر می‌شوند
        └── checkpoints[]        ایستگاه تست بعد از یک صفحهٔ مشخص
```

> **مدل نمایش صفحه از «بلوک‌بندی» به «متن غنی» منتقل شده است.** درس‌های این پوشه هنوز
> `blocks[]` دارند (متن‌های واقعی همان‌جاست) و سرور هنگام ذخیره، `content` را از همان
> بلوک‌ها می‌سازد (`src/data/micro/blocksToHtml.js`). پس فایل‌های این پوشه نیازی به
> بازنویسی ندارند. توضیح کامل در بخش ۳.۱.

## ۲. فیلدهای الزامی هر سطح

### درس (ریشهٔ فایل)

| فیلد | نوع | توضیح |
|---|---|---|
| `id` | string | **باید** با `subjectId` و با کلید رجیستری یکی باشد |
| `subjectId` | string | شناسهٔ درس در فهرست میکرودرسنامه (`SUBJECTS` در `MicroCourseLayer.jsx`) |
| `title` / `englishTitle` | string | نام فارسی و انگلیسی |
| `accent` | string | هگز `#rrggbb` — هم‌رنگ با همان درس در `SUBJECTS` |
| `kicker` / `description` | string | تیتر بالای صفحه و توضیح فهرست |
| `estimatedTime` | number | دقیقه |
| `difficulty` | string | `easy` \| `medium` \| `hard` \| `very_hard` |
| `topics[]` | array | حداقل یک عضو |

### مبحث

`id`, `title`, `description`, `accent`, `published` (boolean).

`published` **فقط «آمادگی محتوا»** است، نه دسترسی: همهٔ مبحث‌ها در فهرست فعال‌اند و مبحث
بدون واحد، در خواننده پیام «آماده نشده» می‌گیرد. تنها اثر واقعی‌اش انتخاب مسیر پیش‌فرض
ورود است (`firstPublishedTopicOf`).

### واحد یادگیری

`id`, `title`, `learningObjective`, `estimatedTime`, `difficulty`, `concepts[]`, `pages[]`,
`checkpoints[]`, و اختیاری `checkpointInterval` (اولویت: unit > topic > course؛ پیش‌فرض ۴).

### مفهوم

`id` (یکتا در همان واحد)، `title`، `english`، `importance` (۱..۵)،
`examFrequency` (`low`\|`medium`\|`high`)، `crossCourse[]` با `{ courseId, courseTitle, topic }`.
`courseId` **باید** یکی از کلیدهای `COURSE_REGISTRY` باشد.

### صفحه

`id` (یکتا در همان واحد)، `order` (۱..n پیوسته)، `title`، `learningObjective`،
`estimatedTime`، `difficulty`، `importance` (۱..۵)، `examFrequency`، `keywords[]`،
`concepts[]` (**زیرمجموعهٔ** مفهوم‌های همان واحد)، `blocks[]`، و اختیاری `confidenceCheck: true`.

### ایستگاه (checkpoint)

`id`، `afterPage` (باید `id` یکی از صفحه‌های همان واحد باشد)، `questionCount`،
`required` (boolean)، `scopePages[]` (زیرمجموعهٔ صفحه‌های همان واحد).

جریان مطالعه از `buildStudyFlow(unit)` می‌آید و صفحه‌ها و ایستگاه‌ها را با هم می‌بافد؛
خروجی `[{kind:'page'|'checkpoint', …}]` به ترتیب اجراست.

## ۳. انواع block و فیلدهای الزامی

| `type` | فیلدهای الزامی |
|---|---|
| `heading` | `text` |
| `intro` | `text` |
| `text` | `text` — با `depth: 'extended'` در «درس سریع» جمع می‌شود |
| `keyPoint` | `text` |
| `definition` | `term`, `text` (+ `english`) |
| `example` | `text` (+ `title`) |
| `comparison` | `left{label, items[]}`, `right{label, items[]}` |
| `table` | `head[]`, `rows[][]` — طول هر ردیف باید با `head` برابر باشد |
| `warning` | `text` |
| `clinical` | `title`, `text` |
| `crossCourse` | `title`, `items[{courseTitle, topic}]` |
| `figure` | `diagram`, `title` (+ `caption`, `data`) |
| `flashcards` | `cards[{front, back}]` |
| `quickQuestion` | `question`, `answer` |
| `summary` | `items[]` |

هر block متنی می‌تواند `depth: 'core' \| 'extended'` بگیرد.

### دیاگرام‌ها (`type: 'figure'`)

رندر در `microDiagrams.jsx` → رجیستری `FIGURES`. کلیدهای موجود:

| `diagram` | دادهٔ لازم | شکل |
|---|---|---|
| `pressure-timeline` | — | منحنی فشار ثابت (چرخهٔ قلبی) |
| `wiggers` | — | دیاگرام وینگرز ثابت |
| `pv-loop` | — | حلقهٔ فشار-حجم ثابت |
| `flow` | `data.steps[{label, note}]` | زنجیرهٔ مرحله‌ای، ۳ تا در هر ردیف |
| `bars` | `data.items[{label, value}]` + `data.unit` | نمودار میله‌ای افقی |
| `cycle` | `data.stages[{label}]` + `data.center` | چرخهٔ بستهٔ شعاعی |

سه دیاگرام آخر **عمومی و داده‌محور**اند: هر درس با پاس‌دادن `data` دیاگرام خودش را
می‌سازد و هیچ کد تازه‌ای لازم نیست. کلید ناشناخته ⇒ `MicroFigure` مقدار `null` می‌دهد.

### ۳.۱ متن غنی صفحه (`content`) — جایگزین بلوک‌بندی

صفحه امروز یک ویرایشگر متن است، نه لیستی از بلوک‌ها. قواعد:

| موضوع | رفتار |
|---|---|
| منبع نمایش | اگر `content` متن داشته باشد، همان رندر می‌شود؛ وگرنه همان `blocks[]` قبلی |
| مهاجرت | سرور در ذخیره، اگر `content` خالی باشد آن را از `blocks[]` می‌سازد (`blocksToHtml`) |
| اولویت | متنی که ادمین بنویسد همیشه بر مشتق‌شده اولویت دارد و ذخیرهٔ بعدی آن را بازنویسی نمی‌کند |
| پاک‌سازی | `content` هم در کلاینت و هم در سرور با `database/sanitizeHtml.js` پاک می‌شود |
| آرشیو | `blocks[]` در رکورد می‌ماند؛ بلوک‌های متنی دیگر نمایش داده نمی‌شوند |

سه نوع بلوک به HTML تبدیل **نمی‌شوند** (در متن خالص قابل بیان نیستند) و خواننده آن‌ها را
زیر متن غنی همان صفحه رندر می‌کند — `figure`، `flashcards`، `quickQuestion`
(`INTERACTIVE_BLOCK_TYPES` در `src/data/micro/blocksToHtml.js`).

پیامدِ پذیرفته‌شده: اگر صفحه‌ای دیاگرام یا فلش‌کارت **در میان** متن داشته باشد، بعد از
مهاجرت این افزودنی‌ها به **پایان** صفحه می‌روند. متن خودشان از دست نمی‌رود.

## ۴. اتصال به بانک تست

سؤال‌ها **فقط** از `src/services/testBank/` می‌آیند. گره اتصال دو لایه دارد
(`questionPoolOf` در `microTestEngine.js`):

1. `conceptIds` سؤال ∩ مفهوم‌های واحد — دقیق‌ترین اتصال.
2. `unit.testBank.topicPaths` + `relatedTopicPaths` — تطبیق مسیر مبحث.

`unit.testBank.subjectId` (اگر بدهی) بر `unit.subjectId` ترجیح داده می‌شود — برای وقتی که
بانک، درس را زیر نام دیگری می‌شناسد.

> **حالت خالی عمدی است، نه باگ.** اگر استخر سؤال یک واحد خالی باشد، ایستگاه پیام
> «برای این ایستگاه هنوز سؤالی ثبت نشده» و آزمون جمع‌بندی پیام مشابه می‌گیرد و کاربر
> با دکمهٔ ادامه بیرون می‌آید — هیچ‌جا بن‌بست نمی‌شود. این کار عمداً نقصِ پوشش بانک را
> **دیدنی** می‌کند تا پنهان نشود.

## ۵. وضعیت واقعی محتوا (اندازه‌گیری‌شده)

**۱۶ درس** ثبت‌شده · **۷۶ مبحث** (۱۶ منتشر، ۶۰ «در راه») · **۱۷ واحد** · **۹۰ صفحه** ·
**۵۷۸ block** · **۳۴ ایستگاه**.

| درس | عنوان | واحد | صفحه | واحدهای منتشرشده | مبحث‌ها (`*` = در راه) |
|---|---|---|---|---|---|
| `physiology` | فیزیولوژی | 1 | 12 | `cardiac-cycle-unit` | `heart-circulation`, `respiration*`, `kidney*`, `nervous*`, `digestion*`, `endocrine*`, `blood*`, `muscle*` |
| `anatomy` | آناتومی | 1 | 5 | `brachial-plexus-unit` | `upper-limb`, `lower-limb*`, `thorax*`, `abdomen*`, `head-neck*`, `neuroanatomy*` |
| `biochemistry` | بیوشیمی | 1 | 5 | `glycolysis-unit` | `carbohydrate-metabolism`, `lipid-metabolism*`, `proteins-enzymes*`, `molecular-biochemistry*`, `vitamins*` |
| `embryology` | جنین‌شناسی | 1 | 5 | `neurulation-unit` | `early-development`, `organogenesis*`, `face-neck*`, `placenta*` |
| `english` | زبان انگلیسی | 1 | 5 | `word-parts-unit` | `medical-terminology`, `reading-comprehension*`, `clinical-communication*`, `medical-writing*` |
| `entomology` | حشره‌شناسی | 1 | 5 | `vector-unit` | `arthropod-vectors`, `mosquitoes*`, `myiasis*`, `vector-control*` |
| `genetics` | ژنتیک | 1 | 5 | `inheritance-unit` | `mendelian-inheritance`, `chromosomal-disorders*`, `population-genetics*`, `cancer-genetics*` |
| `histology` | بافت‌شناسی | 1 | 5 | `enamel-dentin-unit` | `oral-histology`, `epithelium*`, `connective-tissue*`, `blood-histology*`, `muscle-nerve*` |
| `hygiene` | بهداشت عمومی | 1 | 5 | `prevention-unit` | `prevention-epidemiology`, `environmental-health*`, `occupational-health*`, `health-education*` |
| `immunology` | ایمونولوژی | 1 | 5 | `immunoglobulin-unit` | `humoral-immunity`, `cellular-immunity*`, `hypersensitivity*`, `transplant-tumor*`, `immunodeficiency*` |
| `microbiology` | میکروبیولوژی | 1 | 5 | `gpc-unit` | `gram-positive-cocci`, `gram-negative*`, `anaerobes*`, `mycobacteria*`, `lab-methods*` |
| `mycology` | قارچ‌شناسی | 1 | 5 | `fungal-infection-unit` | `medical-mycology`, `systemic-mycosis*`, `cryptococcus*`, `antifungals*` |
| `parasitology` | انگل‌شناسی | 1 | 5 | `parasite-cycle-unit` | `protozoa-helminths`, `helminthology*`, `opportunistic-parasites*`, `diagnostic-methods*` |
| `pathology` | پاتولوژی | 2 | 8 | `cell-injury-unit`, `premalignant-unit` | `cell-injury`, `oral-pathology`, `neoplasia*`, `hemodynamics*`, `systemic-pathology*` |
| `pharmacology` | فارماکولوژی | 1 | 5 | `pk-pd-unit` | `general-pharmacology`, `autonomic-drugs*`, `cns-drugs*`, `cardiovascular-drugs*`, `antimicrobials*` |
| `virology` | ویروس‌شناسی | 1 | 5 | `replication-unit` | `virus-basics`, `dna-viruses*`, `rna-viruses*`, `viral-hepatitis*` |

توزیع blockها: `text` ۹۴ · `intro` ۹۰ · `summary` ۸۹ · `keyPoint` ۸۶ · `table` ۶۸ ·
`clinical` ۲۷ · `definition` ۲۶ · `comparison` ۲۱ · `warning` ۱۸ · `crossCourse` ۱۶ ·
`quickQuestion` ۱۵ · `figure` ۱۵ · `flashcards` ۸ · `example` ۵. (`heading` تعریف شده ولی
هنوز استفاده نشده.)

### پوشش بانک تست — شکاف واقعی

بانک تست تپش **۵۹ سؤال** دارد و فقط **۷ درس** از ۱۶ درس میکرودرسنامه را پوشش می‌دهد:

| درس | سؤال در استخر |
|---|---|
| `physiology` | ۱۶ |
| `biochemistry` | ۵ |
| `anatomy` | ۴ |
| `genetics` | ۲ (از حوزهٔ بیوشیمی مولکولی) |
| `histology` | ۲ |
| `microbiology` | ۲ |
| `immunology` | ۱ |
| `pathology` | ۱ (فقط مبحث دهان؛ `cell-injury` عمداً `topicPaths: []` دارد) |
| `embryology`, `english`, `entomology`, `hygiene`, `mycology`, `parasitology`, `pharmacology`, `virology` | **۰** |

`conceptIds` هم فقط در سؤال‌های فیزیولوژی وجود دارد (۱۲ سؤال). یعنی **۹ واحد** ایستگاه
خالی می‌گیرند. برای پر شدنشان باید سؤال به بانک تست اضافه شود — کارِ لایهٔ محتوا، نه این پوشه.

دو `relatedTopicPaths` هم به بخش‌هایی اشاره می‌کنند که هنوز در بانک نیستند
(`بافت‌شناسی دهان و دندان › پالپ و پریودنشیوم` و `پاسخ ایمنی هومورال › کمپلمان`)؛ این‌ها
بی‌اثرند و فقط «قصد محتوایی» را ثبت می‌کنند.

## ۶. افزودن یک درس تازه — چک‌لیست

1. فایل `src/data/micro/<subjectId>Course.js` را از روی `physiologyCourse.js` بساز
   (هم `export const <name>Course` و هم `export default`).
2. درس را در `COURSE_REGISTRY` داخل `src/services/micro/microContentService.js` ثبت کن.
   **ترتیب کلیدها مهم است** — اولین عضو، درس پیش‌فرض ورود به میکرودرسنامه است.
3. اگر شناسهٔ درس در `SUBJECTS` فایل `MicroCourseLayer.jsx` نیست، اول آنجا اضافه‌اش کن؛
   `id` درس و `subjectId` و کلید رجیستری باید هر سه یکی باشند.
4. قرارداد را با هارنس بسنج (پایین) — نه با باز کردن مرورگر.

## ۷. بررسی بدون بیلد و بدون مرورگر

بیلد ممنوع است (بخش ۱۲ README ریشه). برای سنجش قرارداد:

```bash
# ۱) سینتکس و حل ایمپورت‌های کل لایه
./node_modules/.bin/esbuild src/layout/dashboard/courses/micro/MicroCourseReader.jsx \
  --bundle --format=esm --outfile=/tmp/chk.js

# ۲) اجرای سرویس بدون بیلد
./node_modules/.bin/esbuild src/services/micro/microContentService.js \
  --outfile=/tmp/chk-content.js
```

هارنس قرارداد (اسکریپت موقت، در ریپو نگه داشته نمی‌شود) این‌ها را می‌سنجد: یکتایی
`id`ها، پیوستگی `order`، زیرمجموعه بودن `page.concepts` در مفهوم‌های واحد، ارجاع
`afterPage`/`scopePages` به صفحه‌های موجود، فیلدهای الزامی هر block، تطابق طول
`table.head` با ردیف‌ها، کلید معتبر `figure.diagram`، و **اندازهٔ واقعی استخر سؤال هر واحد**.

## ۸. تله‌ها

- **`page.id` فقط در سطح واحد باید یکتا باشد** (پیشرفت و نشانه‌گذاری زیر
  `unitState.pages[pageId]` ذخیره می‌شوند). با این حال یکتا نگه‌داشتنش در کل درس، از
  اشتباه‌های آیندهٔ محتوایی جلوگیری می‌کند — دو مبحث پاتولوژی عمداً پیشوند جدا دارند
  (`p0x` و `op0x`).
- **`unit.testBank.subjectId` را با `unit.subjectId` قاطی نکن.** اولی فیلتر بانک است و
  می‌تواند عمداً فرق کند (مثل `genetics` → `biochemistry` و `english` → `esl`).
- **`conceptIds` صفحه باید در همان واحد تعریف شده باشد**؛ موتور با `conceptPageMap` روی
  همین فرض کار می‌کند.
- **سؤال داخل فایل درس ننویس.** هر سؤالی اینجا بنویسی، از چرخهٔ آمار، بانک و کارنامه
  بیرون می‌ماند.
