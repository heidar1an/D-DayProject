/*
 * مدل محتوای میکرودرسنامه — درس «زبان انگلیسی».
 *
 * همان قرارداد `physiologyCourse.js`؛ هیچ وابستگی‌ای به React ندارد و موتور یادگیری
 * (src/services/micro + src/layout/dashboard/courses/micro) فقط این شکل داده را مصرف می‌کند.
 * سلسله‌مراتب: درس → مبحث → واحد یادگیری → صفحهٔ میکرو → Blocks + Concepts → Checkpoints
 * سؤال‌های ایستگاه از بانک تست تپش و با گرهٔ testBank/concepts انتخاب می‌شوند.
 */

export const englishCourse = {
  id: 'english',
  subjectId: 'english',
  title: 'زبان انگلیسی',
  englishTitle: 'Medical English',
  accent: '#ab8e7c',
  kicker: 'میکرودرسنامهٔ زبان انگلیسی پزشکی',
  description:
    'واژه‌شناسی پزشکی صفحه‌به‌صفحه؛ ریشه، پیشوند و پسوند، اختصارات بالینی و استراتژی رمزگشایی گزینه‌ها.',
  estimatedTime: 26,
  difficulty: 'easy',
  topics: [
    {
      id: 'medical-terminology',
      title: 'واژه‌شناسی پزشکی',
      description: 'ریشه‌ها، پیشوندها، پسوندها، اختصارات و استراتژی تست',
      accent: '#ab8e7c',
      published: true,
      units: [
        {
          id: 'word-parts-unit',
          title: 'ساختار واژهٔ پزشکی و رمزگشایی',
          learningObjective:
            'بعد از این واحد می‌توانی یک واژهٔ پزشکی ناآشنا را به اجزایش بشکنی، معنی ریشه و پسوند و پیشوند را بگویی و با همین روش گزینهٔ درست را در تست انتخاب کنی.',
          estimatedTime: 26,
          difficulty: 'easy',
          checkpointInterval: 3,
          testBank: {
            /* نام درس زبان در بانک تست «esl» است، ولی شناسهٔ درس در فهرست
               میکرودرسنامه «english» است؛ اینجا عمداً شناسهٔ بانک را می‌گذاریم
               تا اگر سؤالی به بانک اضافه شد، استخر از همان ابتدا وصل باشد. */
            subjectId: 'esl',
            topicPaths: [['زبان انگلیسی', 'واژه‌شناسی پزشکی']],
            relatedTopicPaths: [['زبان انگلیسی', 'درک مطلب']],
          },
          finalAssessment: { questionCount: 5 },
          concepts: [
            {
              id: 'word-structure',
              title: 'ساختار واژهٔ پزشکی',
              english: 'Medical Word Structure',
              importance: 5,
              examFrequency: 'high',
              crossCourse: [
                { courseId: 'anatomy', courseTitle: 'آناتومی', topic: 'اصطلاحات آناتومیک' },
              ],
            },
            {
              id: 'organ-roots',
              title: 'ریشه‌های اعضا',
              english: 'Organ Roots',
              importance: 5,
              examFrequency: 'high',
              crossCourse: [
                { courseId: 'physiology', courseTitle: 'فیزیولوژی', topic: 'اصطلاحات اندام‌ها' },
              ],
            },
            {
              id: 'diagnostic-suffixes',
              title: 'پسوندهای تشخیصی و علامتی',
              english: 'Diagnostic Suffixes',
              importance: 5,
              examFrequency: 'high',
              crossCourse: [
                { courseId: 'pathology', courseTitle: 'پاتولوژی', topic: 'نام‌گذاری بیماری‌ها' },
              ],
            },
            {
              id: 'numeric-prefixes',
              title: 'پیشوندهای عدد و وضعیت',
              english: 'Numeric & Positional Prefixes',
              importance: 4,
              examFrequency: 'high',
              crossCourse: [
                { courseId: 'biochemistry', courseTitle: 'بیوشیمی', topic: 'نام‌گذاری ترکیبات' },
              ],
            },
            {
              id: 'clinical-abbreviations',
              title: 'اختصارات بالینی',
              english: 'Clinical Abbreviations',
              importance: 4,
              examFrequency: 'medium',
              crossCourse: [
                { courseId: 'pharmacology', courseTitle: 'فارماکولوژی', topic: 'نسخه‌نویسی و مسیر تجویز' },
              ],
            },
            {
              id: 'test-strategy',
              title: 'استراتژی رمزگشایی تست',
              english: 'Test Decoding Strategy',
              importance: 4,
              examFrequency: 'high',
              crossCourse: [
                { courseId: 'english', courseTitle: 'زبان انگلیسی', topic: 'درک مطلب' },
              ],
            },
          ],
          pages: [
            /* ─────────────── صفحهٔ ۱ ─────────────── */
            {
              id: 'p01',
              order: 1,
              title: 'ساختار واژهٔ پزشکی',
              learningObjective:
                'بعد از این صفحه می‌توانی یک واژهٔ پزشکی را به پیشوند، ریشه و پسوند بشکنی و معنی کلی آن را حدس بزنی.',
              estimatedTime: 4,
              difficulty: 'easy',
              importance: 5,
              examFrequency: 'high',
              keywords: ['پیشوند', 'ریشه', 'پسوند', 'واژه‌شناسی'],
              concepts: ['word-structure'],
              blocks: [
                {
                  type: 'intro',
                  text: 'واژه‌های پزشکی مثل قطعات لگو ساخته می‌شوند: یک ریشهٔ ثابت و چند قطعهٔ قابل‌تشخیص. اگر قطعات را بلد باشی، معنی واژهٔ ناآشنا هم قابل حدس است.',
                },
                {
                  type: 'text',
                  text: 'هر واژهٔ پزشکی از سه نوع قطعه ساخته می‌شود: ریشه (Root) که معنای اصلی و عضو یا بافت را می‌رساند، پیشوند (Prefix) که پیش از ریشه می‌آید و مکان، تعداد یا وضعیت را نشان می‌دهد، و پسوند (Suffix) که پس از ریشه می‌آید و معمولاً فرآیند، بیماری یا اقدام درمانی را می‌رساند. ترتیب خواندن در انگلیسی از آخر به اول است: اول پسوند، بعد پیشوند، بعد ریشه. نمونه: Pericarditis = peri- (پیرامون) + card- (قلب) + -itis (التهاب) → التهاب پیرامون قلب. نکتهٔ املایی مهم: وقتی پسوند به ریشه می‌چسبد، ممکن است یک حرف ربط اضافه شود (مثل -o- در cardiology) که معنی‌دار نیست و فقط برای تلفظ است.',
                },
                {
                  type: 'figure',
                  title: 'ترتیب ساخت واژه',
                  caption: 'پیشوند + ریشه + پسوند؛ در خواندن، از پسوند شروع کن چون ماهیت واژه را تعیین می‌کند.',
                  diagram: 'flow',
                  data: {
                    title: 'ترتیب ساخت واژه',
                    steps: [
                      { label: 'پیشوند', note: 'مکان، تعداد، وضعیت' },
                      { label: 'ریشه', note: 'عضو یا بافت' },
                      { label: 'پسوند', note: 'بیماری یا اقدام' },
                    ],
                  },
                },
                {
                  type: 'table',
                  title: 'سه قطعه و نقششان',
                  head: ['قطعه', 'جایگاه', 'چه می‌رساند'],
                  rows: [
                    ['پیشوند', 'پیش از ریشه', 'مکان، تعداد، وضعیت، نفی'],
                    ['ریشه', 'میانهٔ واژه', 'عضو، بافت یا ماده'],
                    ['پسوند', 'پس از ریشه', 'بیماری، فرآیند، اقدام درمانی'],
                  ],
                },
                {
                  type: 'keyPoint',
                  text: 'واژه را از آخر به اول بخوان: اول پسوند (ماهیت)، بعد پیشوند (وضعیت)، بعد ریشه (عضو).',
                },
                {
                  type: 'summary',
                  items: [
                    'واژهٔ پزشکی = پیشوند + ریشه + پسوند.',
                    'پسوند ماهیت واژه را تعیین می‌کند.',
                    'حروف ربط مثل -o- فقط تلفظی‌اند و معنی ندارند.',
                  ],
                },
              ],
            },
            /* ─────────────── صفحهٔ ۲ ─────────────── */
            {
              id: 'p02',
              order: 2,
              title: 'ریشه‌های شایع اعضا و دستگاه‌ها',
              learningObjective:
                'بعد از این صفحه می‌توانی ریشهٔ هر عضو اصلی را تشخیص دهی و در واژه‌های ترکیبی به‌کار ببری.',
              estimatedTime: 4,
              difficulty: 'easy',
              importance: 5,
              examFrequency: 'high',
              keywords: ['ریشه', 'عضو', 'cardio', 'nephro', 'hepato'],
              concepts: ['organ-roots'],
              blocks: [
                {
                  type: 'intro',
                  text: 'حدود بیست ریشه، بیشتر واژه‌های پزشکی را می‌سازند. اگر همین بیست تا را بلد باشی، حجم زیادی از متن پزشکی برایت خوانا می‌شود.',
                },
                {
                  type: 'text',
                  text: 'ریشه‌های پرکاربرد: cardi (قلب)، hepato (کبد)، nephro (کلیه)، neuro (عصب)، gastro (معده)، entero (روده)، pulmo و pneumo (ریه)، osteo (استخوان)، myo (عضله)، dermato (پوست)، hemato (خون)، cyto (سلول)، arthro (مفصل)، cysto (مثانه یا کیسه)، thoraco (قفسهٔ سینه)، spleno (طحال)، phlebo و veno (ورید)، arterio (شریان)، broncho (نایژه)، oto (گوش)، ophthalmo (چشم)، rhino (بینی)، odonto (دندان) و gingivo (لثه). نکتهٔ کاربردی: چند عضو دو ریشه دارند (ریه: pulmo و pneumo؛ روده: entero و colo) و انتخاب بین آن‌ها به بافت مورد نظر بستگی دارد — پس در تست، ریشه را با بافت تطبیق بده، نه فقط با عضو.',
                },
                {
                  type: 'table',
                  title: 'ریشه‌های کلیدی اعضا',
                  head: ['ریشه', 'معنی', 'نمونه'],
                  rows: [
                    ['cardi', 'قلب', 'Myocarditis'],
                    ['nephro', 'کلیه', 'Nephropathy'],
                    ['hepato', 'کبد', 'Hepatomegaly'],
                    ['gastro', 'معده', 'Gastroscopy'],
                    ['pulmo / pneumo', 'ریه', 'Pulmonary / Pneumonia'],
                    ['osteo', 'استخوان', 'Osteoporosis'],
                    ['neuro', 'عصب', 'Neuropathy'],
                    ['dermato', 'پوست', 'Dermatitis'],
                  ],
                },
                {
                  type: 'flashcards',
                  title: 'مرور سریع ریشه‌ها',
                  cards: [
                    { front: 'cardi-', back: 'قلب' },
                    { front: 'nephro-', back: 'کلیه' },
                    { front: 'hepato-', back: 'کبد' },
                    { front: 'pneumo-', back: 'ریه' },
                    { front: 'osteo-', back: 'استخوان' },
                    { front: 'dermato-', back: 'پوست' },
                  ],
                },
                {
                  type: 'keyPoint',
                  text: 'چند عضو دو ریشه دارند: pulmo و pneumo برای ریه، entero و colo برای روده. انتخاب ریشه به بافت بستگی دارد.',
                },
                {
                  type: 'summary',
                  items: [
                    'حدود بیست ریشه، بیشتر واژه‌های پزشکی را می‌سازند.',
                    'چند عضو دو ریشه دارند و انتخاب به بافت بستگی دارد.',
                    'تمرین فلش‌کارت ریشه‌ها، سریع‌ترین راه تثبیت است.',
                  ],
                },
              ],
            },
            /* ─────────────── صفحهٔ ۳ ─────────────── */
            {
              id: 'p03',
              order: 3,
              title: 'پسوندهای تشخیصی و علامتی',
              learningObjective:
                'بعد از این صفحه می‌توانی با دیدن پسوند، ماهیت واژه (التهاب، تومور، برداشتن، درد) را تشخیص دهی.',
              estimatedTime: 4,
              difficulty: 'medium',
              importance: 5,
              examFrequency: 'high',
              keywords: ['پسوند', '-itis', '-oma', '-ectomy', '-pathy'],
              concepts: ['diagnostic-suffixes'],
              blocks: [
                {
                  type: 'intro',
                  text: 'پسوند، «شغل» واژه را می‌گوید: آیا از التهاب حرف می‌زند، از تومور، از برداشتن یا از درد؟',
                },
                {
                  type: 'text',
                  text: 'پسوندهای شایع: -itis (التهاب)، -osis (وضعیت غیرطبیعی یا افزایش)، -oma (تومور)، -pathy (بیماری)، -algia (درد)، -emia (وضعیت خون)، -uria (وضعیت ادرار)، -megaly (بزرگ‌شدن)، -plegia (فلج)، -penia (کمبود)، -plasia (رشد و تشکیل)، -sclerosis (سختی و سفت‌شدن)، -stenosis (تنگی)، -rrhage (خونریزی). پسوندهای اقدام درمانی: -ectomy (برداشتن کامل)، -otomy (برش)، -ostomy (ساخت منفذ)، -plasty (ترمیم و بازسازی)، -scopy (معاینهٔ درون‌بین)، -graphy (تصویربرداری)، -logy (دانش و تخصص). نکتهٔ افتراقی پرتکرار: -ectomy برداشتن، -otomy برش و -ostomy منفذ — سه پسوندی که در گزینه‌ها زیاد جابه‌جا می‌شوند.',
                },
                {
                  type: 'comparison',
                  title: 'سه پسوند جراحی که زیاد اشتباه می‌شوند',
                  left: {
                    label: 'برداشتن در برابر برش',
                    items: [
                      '-ectomy: برداشتن کامل (Appendectomy)',
                      '-otomy: برش بدون برداشتن (Laparotomy)',
                      'تفاوت کلیدی: حذف عضو یا فقط باز کردن',
                    ],
                  },
                  right: {
                    label: 'منفذ در برابر ترمیم',
                    items: [
                      '-ostomy: ساخت منفذ پایدار (Colostomy)',
                      '-plasty: ترمیم و بازسازی (Rhinoplasty)',
                      'تفاوت کلیدی: مسیر تازه یا اصلاح شکل',
                    ],
                  },
                },
                {
                  type: 'table',
                  title: 'پسوندهای تشخیصی و اقدام',
                  head: ['پسوند', 'معنی', 'نمونه'],
                  rows: [
                    ['-itis', 'التهاب', 'Gastritis'],
                    ['-oma', 'تومور', 'Carcinoma'],
                    ['-megaly', 'بزرگ‌شدن', 'Hepatomegaly'],
                    ['-penia', 'کمبود', 'Leukopenia'],
                    ['-ectomy', 'برداشتن', 'Splenectomy'],
                    ['-ostomy', 'ساخت منفذ', 'Colostomy'],
                    ['-scopy', 'معاینهٔ درون‌بین', 'Endoscopy'],
                  ],
                },
                {
                  type: 'keyPoint',
                  text: 'الگوهای پرتکرار: -itis التهاب، -oma تومور، -megaly بزرگ‌شدن، -penia کمبود، -ectomy برداشتن.',
                },
                {
                  type: 'quickQuestion',
                  question: 'واژهٔ Nephrectomy چه معنایی دارد و از چه قطعاتی ساخته شده؟',
                  answer: 'برداشتن کلیه؛ از nephr- (کلیه) + -ectomy (برداشتن). پسوند است که ماهیت «جراحی» را می‌رساند.',
                },
                {
                  type: 'summary',
                  items: [
                    'پسوند، ماهیت واژه را تعیین می‌کند.',
                    '-itis التهاب، -oma تومور، -pathy بیماری، -algia درد.',
                    '-ectomy برداشتن، -otomy برش، -ostomy منفذ.',
                  ],
                },
              ],
            },
            /* ─────────────── صفحهٔ ۴ ─────────────── */
            {
              id: 'p04',
              order: 4,
              title: 'پیشوندهای عدد، مقدار و وضعیت',
              learningObjective:
                'بعد از این صفحه می‌توانی پیشوندهای عددی و مکانی را تشخیص دهی و واژهٔ ساخته‌شده را تفسیر کنی.',
              estimatedTime: 4,
              difficulty: 'medium',
              importance: 4,
              examFrequency: 'high',
              keywords: ['پیشوند', 'hyper', 'hypo', 'tachy', 'brady'],
              concepts: ['numeric-prefixes'],
              blocks: [
                {
                  type: 'intro',
                  text: 'پیشوندها به واژه «مقدار» و «مکان» می‌دهند؛ همین دو ویژگی، در تشخیص بالینی تفاوت بزرگی می‌سازند.',
                },
                {
                  type: 'text',
                  text: 'پیشوندهای مقدار: hyper- (بیش از حد)، hypo- (کمتر از حد)، tachy- (تند)، brady- (کند)، poly- (زیاد)، oligo- (کم)، a- و an- (بدون)، dys- (بدکارکرد)، eu- (طبیعی). پیشوندهای مکان: endo- (درون)، exo- (بیرون)، intra- (داخل)، inter- (میان)، sub- (زیر)، supra- (بالا)، peri- (پیرامون)، retro- (عقب)، trans- (عبور)، pre- (پیش) و post- (پس). پیشوندهای عدد: uni- و mono- (یک)، bi- و di- (دو)، tri- (سه)، quadri- (چهار)، multi- (چند). نکتهٔ بالینی مهم: تفاوت hyper- و hypo- فقط یک حرف است ولی دو بیماری کاملاً متفاوت می‌سازد (Hyperthyroidism در برابر Hypothyroidism)؛ در تست‌ها همین یک حرف، گزینهٔ غلط را می‌سازد.',
                },
                {
                  type: 'table',
                  title: 'پیشوندها و معنی',
                  head: ['پیشوند', 'معنی', 'نمونه'],
                  rows: [
                    ['hyper-', 'بیش از حد', 'Hypertension'],
                    ['hypo-', 'کمتر از حد', 'Hypoglycemia'],
                    ['tachy-', 'تند', 'Tachycardia'],
                    ['brady-', 'کند', 'Bradycardia'],
                    ['peri-', 'پیرامون', 'Pericarditis'],
                    ['retro-', 'عقب', 'Retroperitoneal'],
                    ['poly-', 'زیاد', 'Polyuria'],
                    ['oligo-', 'کم', 'Oliguria'],
                  ],
                },
                {
                  type: 'warning',
                  text: 'دام رایج: hyper- و hypo- را با یک نگاه سریع جابه‌جا نکن. در متن‌های بالینی، همین یک حرف جهت تشخیص را کامل عوض می‌کند.',
                },
                {
                  type: 'keyPoint',
                  text: 'پیشوندهای مقدار و مکان، واژه را دقیق می‌کنند: hyper/hypo، tachy/brady، poly/oligo، peri/sub/supra.',
                },
                {
                  type: 'summary',
                  items: [
                    'پیشوند مقدار: hyper، hypo، tachy، brady، poly، oligo.',
                    'پیشوند مکان: peri، sub، supra، retro، intra، inter.',
                    'تفاوت یک حرف (hyper/hypo) می‌تواند معنی را کامل برگرداند.',
                  ],
                },
              ],
            },
            /* ─────────────── صفحهٔ ۵ ─────────────── */
            {
              id: 'p05',
              order: 5,
              title: 'اختصارات و استراتژی رمزگشایی تست',
              learningObjective:
                'بعد از این صفحه می‌توانی اختصارات رایج بالینی را بشناسی و با روش تجزیهٔ قطعات، گزینهٔ درست را انتخاب کنی.',
              estimatedTime: 4,
              difficulty: 'medium',
              importance: 4,
              examFrequency: 'high',
              keywords: ['اختصار', 'Rx', 'Dx', 'b.i.d', 'استراتژی تست'],
              concepts: ['clinical-abbreviations', 'test-strategy'],
              confidenceCheck: true,
              blocks: [
                {
                  type: 'intro',
                  text: 'آخرین قطعهٔ این مبحث، ابزار عملی است: با تجزیهٔ قطعات و شناخت اختصارات، حتی واژهٔ ناآشنا هم قابل حل است.',
                },
                {
                  type: 'text',
                  text: 'اختصارات پرکاربرد بالینی: Dx (تشخیص)، Tx (درمان)، Rx (نسخه)، Hx (سابقه)، CBC (شمارش کامل سلول‌های خون)، ECG (نوار قلب)، BP (فشار خون)، HR (ضربان قلب)، IV (داخل‌وریدی)، PO (خوراکی)، PRN (در صورت نیاز)، NPO (ناشتا)، SOB (تنگی نفس)، q.d./b.i.d./t.i.d./q.i.d. (یک/دو/سه/چهار بار در روز). استراتژی حل تست واژه‌شناسی در سه گام: ۱) واژه یا گزینه‌ها را به قطعات بشکن و هر قطعه را جدا معنی کن. ۲) قطعهٔ کلیدی (معمولاً پسوند) را با خواستهٔ سؤال تطبیق بده. ۳) گزینه‌هایی که پسوند یا پیشوند ناسازگار دارند حذف کن — حتی اگر ریشه درست باشد. نکتهٔ نهایی: در سؤال‌های منفی («کدام گزینه غلط است؟») اول قطعهٔ مشترک همهٔ گزینه‌ها را مشخص کن؛ گزینه‌ای که در قطعهٔ اختصاصی با بقیه فرق دارد، معمولاً پاسخ است.',
                },
                {
                  type: 'table',
                  title: 'اختصارات کلیدی',
                  head: ['اختصار', 'معنی'],
                  rows: [
                    ['Dx / Tx / Rx', 'تشخیص / درمان / نسخه'],
                    ['b.i.d. / t.i.d.', 'دو بار / سه بار در روز'],
                    ['NPO', 'ناشتا'],
                    ['PRN', 'در صورت نیاز'],
                    ['SOB', 'تنگی نفس'],
                  ],
                },
                {
                  type: 'crossCourse',
                  title: 'این مفاهیم در تپش جای دیگری هم دیده شده‌اند',
                  items: [
                    { courseTitle: 'آناتومی', topic: 'اصطلاحات آناتومیک و جهت‌ها' },
                    { courseTitle: 'پاتولوژی', topic: 'نام‌گذاری بیماری‌ها' },
                    { courseTitle: 'فارماکولوژی', topic: 'نسخه‌نویسی و مسیر تجویز دارو' },
                  ],
                },
                {
                  type: 'keyPoint',
                  text: 'سه گام حل تست: تجزیه به قطعات، تطبیق قطعهٔ کلیدی با سؤال، حذف گزینه‌های ناسازگار. پسوند، بیشترین وزن را دارد.',
                },
                {
                  type: 'summary',
                  items: [
                    'اختصارات بالینی (Dx، Tx، Rx، b.i.d.، NPO) را بشناس.',
                    'اول پسوند و پیشوند را با خواستهٔ سؤال تطبیق بده.',
                    'در سؤال منفی، قطعهٔ اختصاصی گزینه‌ها را مقایسه کن.',
                  ],
                },
              ],
            },
          ],
          checkpoints: [
            {
              id: 'cp1',
              afterPage: 'p03',
              questionCount: 3,
              required: false,
              scopePages: ['p01', 'p02', 'p03'],
            },
            {
              id: 'cp2',
              afterPage: 'p05',
              questionCount: 3,
              required: true,
              scopePages: ['p04', 'p05'],
            },
          ],
        },
      ],
    },
    /* ── مبحث‌های بعدی زبان انگلیسی ── */
    { id: 'reading-comprehension', title: 'درک مطلب', description: 'متن‌های پزشکی، ایدهٔ اصلی و استنباط', accent: '#ab8e7c', published: false },
    { id: 'clinical-communication', title: 'ارتباط بالینی', description: 'مصاحبه با بیمار، شرح حال و نوشتن گزارش', accent: '#ab8e7c', published: false },
    { id: 'medical-writing', title: 'نوشتار علمی', description: 'خلاصهٔ مقاله، چکیده و نگارش آکادمیک', accent: '#ab8e7c', published: false },
  ],
};

export default englishCourse;
