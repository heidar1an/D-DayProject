/*
 * دادهٔ محتوایی «آزمون‌های بین‌الملل» — لایهٔ CONTENT.
 *
 * اصل جدایی داده: این فایل فقط محتوای عمومی (آزمون، بخش، سؤال، گزینه، تحلیل) را نگه می‌دارد.
 * هیچ وضعیت وابسته به کاربر (گلچین، مجموعه، پاسخ، پیشرفت) اینجا وجود ندارد؛ آن‌ها در
 * internationalService.js و localStorage هر کاربر ذخیره می‌شوند.
 *
 * تمام سؤال‌ها «نمونهٔ آموزشی» تالیفی تپش هستند — نه سؤال رسمی آزمون‌ها. فیلد
 * source: 'educational_sample' در UI با برچسب «نمونه سؤال آموزشی» نمایش داده می‌شود
 * تا کاربر دچار سوءبرداشت نشود. با اتصال بک‌اند، این فایل حذف و با API جایگزین می‌شود.
 */

/* ── موضوعات (Subject) — فقط برای متادیتا و فیلتر ── */
export const SUBJECTS = [
  { id: 'physiology', name: 'Physiology', nameFa: 'فیزیولوژی', accent: '#937fcd' },
  { id: 'pharmacology', name: 'Pharmacology', nameFa: 'فارماکولوژی', accent: '#77b787' },
  { id: 'pathology', name: 'Pathology', nameFa: 'پاتولوژی', accent: '#e0b45c' },
  { id: 'biochemistry', name: 'Biochemistry', nameFa: 'بیوشیمی', accent: '#5b8cc7' },
  { id: 'microbiology', name: 'Microbiology', nameFa: 'میکروب‌شناسی', accent: '#ab8e7c' },
  { id: 'internal-medicine', name: 'Internal Medicine', nameFa: 'بیماری‌های داخلی', accent: '#61d192' },
  { id: 'anatomy', name: 'Anatomy', nameFa: 'آناتومی', accent: '#c9bdf0' },
  { id: 'pediatrics', name: 'Pediatrics', nameFa: 'اطفال', accent: '#ef9196' },
  { id: 'obstetrics', name: 'Obstetrics', nameFa: 'زنان و زایمان', accent: '#d5bba9' },
  { id: 'public-health', name: 'Public Health', nameFa: 'سلامت و آمار', accent: '#8fbcd4' },
];

/* ── آزمون‌های بین‌المللی (Exam + ExamSection) ── */
export const EXAMS = [
  {
    id: 'usmle',
    slug: 'usmle',
    shortName: 'USMLE',
    name: 'United States Medical Licensing Examination',
    nameFa: 'آزمون جامع پزشکی ایالات متحده',
    country: 'ایالات متحده',
    organization: 'NBME · FSMB',
    level: 'پیشرفته',
    type: 'licensing',
    accent: '#937fcd',
    glyph: 'shield',
    descriptionFa:
      'مهم‌ترین آزمون اعتبارپزشکی آمریکا؛ تمرکز آن بر حل مسئله بالینی بر پایه علوم پایه است. سؤال‌های تپش برای این آزمون حال‌وهوای Step 1 و Step 2 CK دارند.',
    subjects: ['physiology', 'pathology', 'biochemistry', 'microbiology', 'pharmacology'],
    sections: [
      { id: 'usmle-step1', name: 'Step 1', nameFa: 'استپ ۱ — علوم پایه', focus: 'مکانیسم‌های پایه و علوم پیش‌بالینی' },
      { id: 'usmle-step2ck', name: 'Step 2 CK', nameFa: 'استپ ۲ — دانش بالینی', focus: 'مدیریت بالینی و تشخیص' },
    ],
    updatedAtFa: 'شهریور ۱۴۰۵',
    status: 'published',
  },
  {
    id: 'plab',
    slug: 'plab',
    shortName: 'PLAB',
    name: 'Professional and Linguistic Assessments Board Test',
    nameFa: 'آزمون اعتبارپزشکی شورای پزشکی بریتانیا',
    country: 'بریتانیا',
    organization: 'GMC',
    level: 'متوسط',
    type: 'licensing',
    accent: '#77b787',
    glyph: 'arch',
    descriptionFa:
      'آزمون GMC برای پزشکان متقاضی کار در بریتانیا؛ سؤال‌ها سناریوهای بالینی مدیریت-محور و نزدیک به عمل روزمره پزشک هستند.',
    subjects: ['internal-medicine', 'pediatrics', 'obstetrics'],
    sections: [
      { id: 'plab-part1', name: 'Part 1', nameFa: 'پارت ۱ — سؤالات چهارگزینه‌ای', focus: 'تشخیص و مدیریت بالینی' },
      { id: 'plab-part2', name: 'Part 2', nameFa: 'پارت ۲ — OSCE', focus: 'ارزیابی عملی بالینی' },
    ],
    updatedAtFa: 'شهریور ۱۴۰۵',
    status: 'published',
  },
  {
    id: 'amc',
    slug: 'amc',
    shortName: 'AMC',
    name: 'Australian Medical Council Examination',
    nameFa: 'آزمون شورای پزشکی استرالیا',
    country: 'استرالیا',
    organization: 'AMC',
    level: 'متوسط',
    type: 'licensing',
    accent: '#e0b45c',
    glyph: 'delta',
    descriptionFa:
      'مسیر اعتبارپزشکی پزشکان برای استرالیا؛ سبک سؤال‌ها ترکیبی از علوم پایه و سناریوهای بالینی با تأکید بر طب اضطراری و اطفال است.',
    subjects: ['pediatrics', 'obstetrics', 'internal-medicine'],
    sections: [
      { id: 'amc-cat', name: 'CAT MCQ', nameFa: 'آزمون چندگزینه‌ای', focus: 'دانش بالینی کاربردی' },
      { id: 'amc-clinical', name: 'Clinical', nameFa: 'ارزیابی بالینی', focus: 'مصاحبه و معاینه' },
    ],
    updatedAtFa: 'مرداد ۱۴۰۵',
    status: 'published',
  },
  {
    id: 'mccqe',
    slug: 'mccqe',
    shortName: 'MCCQE',
    name: 'Medical Council of Canada Qualifying Examination',
    nameFa: 'آزمون صلاحیت پزشکی کانادا',
    country: 'کانادا',
    organization: 'MCC',
    level: 'متوسط',
    type: 'licensing',
    accent: '#5b8cc7',
    glyph: 'orbit',
    descriptionFa:
      'پارت ۱ آزمون شورای پزشکی کانادا؛ ضمن سناریوهای بالینی، بر بیماری‌های شایع جمعیت کانادا و اصول طب مبتنی بر شواهد تأکید دارد.',
    subjects: ['internal-medicine', 'public-health'],
    sections: [{ id: 'mccqe-part1', name: 'Part I', nameFa: 'پارت ۱', focus: 'بالینی + سلامت جمعیت' }],
    updatedAtFa: 'شهریور ۱۴۰۵',
    status: 'published',
  },
  {
    id: 'ifom',
    slug: 'ifom',
    shortName: 'IFOM',
    name: 'International Foundations of Medicine',
    nameFa: 'آزمون مبانی بین‌المللی پزشکی',
    country: 'بین‌المللی',
    organization: 'NBME',
    level: 'پایه',
    type: 'assessment',
    accent: '#ab8e7c',
    glyph: 'globe',
    descriptionFa:
      'مقیاس استاندارد NBME برای سنجش علوم پایه و بالینی در سطح جهانی؛ انتخاب خوبی برای سنجش خود قبل از ورود به USMLE است.',
    subjects: ['anatomy', 'physiology', 'internal-medicine'],
    sections: [
      { id: 'ifom-bse', name: 'Basic Science', nameFa: 'علوم پایه', focus: 'مبانی پیش‌بالینی' },
      { id: 'ifom-cse', name: 'Clinical Science', nameFa: 'علوم بالینی', focus: 'کاربرد بالینی مبانی' },
    ],
    updatedAtFa: 'مرداد ۱۴۰۵',
    status: 'published',
  },
];

/*
 * ── بانک سؤال (Question) ──
 * ساختار هر سؤال مطابق مدل Question + QuestionOption + QuestionExplanation سند معماری:
 * فقط محتوا؛ نه گلچین، نه پاسخ کاربر. در بک‌اند واقعی correctAnswer و optionExplanations
 * تا لحظهٔ Submit به کلاینت ارسال نمی‌شوند (اصل امنیتی سند معماری، بخش ۳۹).
 */
export const QUESTIONS = [
  /* ── USMLE ── */
  {
    id: 'q-usmle-01',
    examId: 'usmle',
    sectionId: 'usmle-step2ck',
    subjectId: 'internal-medicine',
    topic: { en: 'Coronary circulation', fa: 'گردش خون کرونر' },
    difficulty: 'medium',
    tags: ['high-yield', 'cardiology', 'ecg'],
    source: 'educational_sample',
    stem:
      'A 58-year-old man is brought to the emergency department after collapsing at work. He is diaphoretic and in distress. ECG shows ST-segment elevation in leads II, III, and aVF. Occlusion of which of the following vessels is the most likely cause of his presentation?',
    stemFa:
      'مردی ۵۸ ساله پس از افتادن سر کار به اورژانس آورده می‌شود. عرق‌کردن و ناآرام است. نوار قلب صعود قطعه ST در لیدهای II، III و aVF نشان می‌دهد. انسداد کدام عروق محتمل‌ترین علت این تصویر است؟',
    options: [
      { key: 'A', en: 'Left anterior descending artery', fa: 'شریان بین‌بطنی قدامی (LAD)' },
      { key: 'B', en: 'Right coronary artery', fa: 'شریان کرونر راست' },
      { key: 'C', en: 'Left circumflex artery', fa: 'شریان منحنی چپ' },
      { key: 'D', en: 'Left main coronary artery', fa: 'تنه اصلی کرونر چپ' },
      { key: 'E', en: 'Diagonal branch of the left coronary system', fa: 'شاخه قطری سیستم کرونر چپ' },
    ],
    correctAnswer: 'B',
    explanation: {
      en: 'ST elevation in leads II, III and aVF maps to the inferior wall of the left ventricle, which is supplied by the right coronary artery in about 85% of people (right-dominant circulation).',
      fa: 'صعود ST در لیدهای II، III و aVF به دیواره تحتانی بطن چپ نگاشت می‌شود که در حدود ۸۵٪ افراد (گردش راست‌غالب) توسط شریان کرونر راست خون‌رسانی می‌شود.',
    },
    optionExplanations: {
      A: { en: 'The LAD supplies the anterior wall and septum (V1–V4).', fa: 'LAD دیواره قدامی و سپتوم را تغذیه می‌کند (V1–V4).' },
      B: { en: 'Correct — the RCA supplies the inferior wall (II, III, aVF).', fa: 'درست — شریان کرونر راست دیواره تحتانی را تغذیه می‌کند (II، III، aVF).' },
      C: { en: 'The circumflex supplies the lateral wall (I, aVL, V5–V6).', fa: 'شریان منحنی دیواره جانبی را تغذیه می‌کند (I، aVL، V5–V6).' },
      D: { en: 'Left main occlusion causes widespread ischemia and cardiogenic shock, not an isolated inferior pattern.', fa: 'انسداد تنه اصلی چپ ایسکمی گسترده و شوک کاردیوژنیک می‌دهد، نه الگوی ایزوله تحتانی.' },
      E: { en: 'Diagonal branches supply the anterolateral wall.', fa: 'شاخه‌های قطری دیواره قدامی-جانبی را تغذیه می‌کنند.' },
    },
    keyLearningPoints: [
      'نگاشت لیدهای ECG به دیواره‌های بطن: تحتانی ← II، III، aVF؛ قدامی ← V1–V4؛ جانبی ← I، aVL، V5–V6.',
      'در سابقه بیمار «غالب‌بودن گردش کرونر» تعیین می‌کند دیواره تحتانی از کرونر راست یا منحنی خون بگیرد.',
    ],
    clinicalPearl:
      'در سکته قلبی تحتانی حتماً لیدهای راست‌سویه (V4R) را برای درگیری بطن راست چک کنید؛ اگر RV درگیر است نیترات می‌تواند فشار خون را فرو بریزد.',
    commonMistake:
      'توهم بین LAD و RCA هنگام عجله؛ لید I را با II اشتباه گرفتن، الگوی «تحتانی» را «جانبی» می‌کند.',
    examTip: 'الگوهای ECG و شریان مسئولشان از پرتکرارترین سؤال‌های Step 2 CK است؛ این جدول را با خودتان حفظ کنید.',
    reference: { title: 'First Aid for the USMLE Step 2 CK', note: 'فصل بیماری‌های قلبی-عروقی' },
  },
  {
    id: 'q-usmle-02',
    examId: 'usmle',
    sectionId: 'usmle-step2ck',
    subjectId: 'pharmacology',
    topic: { en: 'Antithyroid drugs', fa: 'داروهای ضد تیروئید' },
    difficulty: 'easy',
    tags: ['pharmacology', 'adverse-effects'],
    source: 'educational_sample',
    stem:
      'A 34-year-old woman with Graves disease has been taking propylthiouracil for 6 weeks. She now presents with fever and a severe sore throat. Which of the following is the most appropriate next step in management?',
    stemFa:
      'زنی ۳۴ ساله با بیماری گریوز از ۶ هفته پیش پروپیل‌تیواوراسیل مصرف می‌کند. اکنون با تب و گلودرد شدید مراجعه می‌کند. مناسب‌ترین گام بعدی چیست؟',
    options: [
      { key: 'A', en: 'Continue the drug and prescribe analgesics', fa: 'ادامه دارو و تجویز مسکن' },
      { key: 'B', en: 'Obtain a complete blood count with differential', fa: 'انجام شمارش کامل خون با افتراق' },
      { key: 'C', en: 'Switch immediately to radioiodine without workup', fa: 'ارجاع فوری به ید رادیواکتیو بدون بررسی' },
      { key: 'D', en: 'Double the dose of propylthiouracil', fa: 'دو برابر کردن دوز پروپیل‌تیواوراسیل' },
      { key: 'E', en: 'Start empiric levothyroxine', fa: 'شروع تجربی لووتیروکسین' },
    ],
    correctAnswer: 'B',
    explanation: {
      en: 'Fever and sore throat in a patient on an antithyroid drug are a warning for agranulocytosis, a life-threatening adverse effect; a CBC with differential is the immediate next step.',
      fa: 'تب و گلودرد در بیمار تحت درمان با داروی ضد تیروئید، هشدار آگرانولوسیتوز است؛ عارضه‌ای تهدیدکننده حیات. گام فوری، شمارش کامل خون با افتراق است.',
    },
    optionExplanations: {
      A: { en: 'Ignoring fever+sore throat on PTU can be fatal; the drug must be held pending CBC.', fa: 'بی‌توجهی به تب و گلودرد در حین PTU می‌تواند مرگ‌آور باشد؛ دارو تا نتیجه CBC باید قطع شود.' },
      B: { en: 'Correct — screens for agranulocytosis, the feared toxicity of thionamides.', fa: 'درست — غربالگری آگرانولوسیتوز، سمیت مهلک تیونامیدها.' },
      C: { en: 'Radioiodine may follow later, but the acute problem is the hematologic toxicity.', fa: 'ید رادیواکتیو بعداً ممکن است انتخاب شود، اما مشکل حاد سمیت خونی است.' },
      D: { en: 'Increasing the dose would worsen marrow suppression.', fa: 'افزایش دوز سرکوب مغز استخوان را بدتر می‌کند.' },
      E: { en: 'Levothyroxine has no role in this acute presentation.', fa: 'لووتیروکسین در این تصویر حاد جایی ندارد.' },
    },
    keyLearningPoints: [
      'تیونامیدها (PTU و متیمازول) می‌توانند آگرانولوسیتوز و هپاتوتوکسیسیتی ایجاد کنند.',
      'هر بیمار تحت PTU با تب و گلودرد تا خلافش ثابت شود آگرانولوسیتوز دارد.',
    ],
    clinicalPearl: 'به بیماران تیروئیدی آموزش دهید در صورت تب یا گلودرد فوراً CBC بدهند و دارو را قطع کنند.',
    commonMistake: 'گرفتن تب به‌عنوان عفونت ویروسی ساده و ادامه دارو؛ اهمیت زمان در نجات بیمار است.',
    examTip: 'الگوی «دارو + تب/گلودرد ← CBC» را در آزمون‌های بین‌المللی مرتب می‌بینید.',
    reference: { title: 'Katzung, Basic & Clinical Pharmacology', note: 'فصل داروهای تیروئید و ضدتیروئید' },
  },
  {
    id: 'q-usmle-03',
    examId: 'usmle',
    sectionId: 'usmle-step1',
    subjectId: 'biochemistry',
    topic: { en: 'Amino acid metabolism', fa: 'متابولیسم آمینواسیدها' },
    difficulty: 'hard',
    tags: ['high-yield', 'inborn-errors'],
    source: 'educational_sample',
    stem:
      'A 10-day-old boy presents with poor feeding, vomiting, and lethargy that worsened after introduction of protein-containing formula. Physical examination shows hypotonia. The urine has a distinctive sweet, maple-syrup-like odor. Which of the following enzymes is most likely deficient?',
    stemFa:
      'پسری ۱۰ روزه با بی‌اشتهایی، استفراغ و خواب‌آلودگی مراجعه می‌کند که پس از شروع شیر خشک پروتئین‌دار بدتر شده است. معاینه هیپوتونی نشان می‌دهد. بوی ادرار شیرین و شبیه شیره افرا است. کمبود کدام آنزیم محتمل است؟',
    options: [
      { key: 'A', en: 'Phenylalanine hydroxylase', fa: 'فنیل‌آلانین هیدروکسیلاز' },
      { key: 'B', en: 'Homogentisate oxidase', fa: 'هوموگنتیسات اکسیداز' },
      { key: 'C', en: 'Branched-chain α-ketoacid dehydrogenase', fa: 'آلفا-کتواسید دهیدروژناس زنجیره منشعب' },
      { key: 'D', en: 'Cystathionine synthase', fa: 'سیستاتیونین سنتاز' },
      { key: 'E', en: 'Ornithine transcarbamylase', fa: 'اورنیتین ترانس‌کاربامیلاز' },
    ],
    correctAnswer: 'C',
    explanation: {
      en: 'Maple syrup urine disease results from deficiency of branched-chain α-ketoacid dehydrogenase, causing accumulation of leucine, isoleucine, and valine; presentation is neonatal encephalopathy with the characteristic odor.',
      fa: 'بیماری ادرار شیره افرا از کمبود آلفا-کتواسید دهیدروژناس زنجیره منشعب ناشی می‌شود و به انباشت لوسین، ایزولوسین و والین می‌انجامد؛ تصویر بالینی، انسفالوپاتی نوزادی با بوی مشخص ادرار است.',
    },
    optionExplanations: {
      A: { en: 'Phenylalanine hydroxylase deficiency causes phenylketonuria (mousy odor, intellectual disability).', fa: 'کمبود فنیل‌آلانین هیدروکسیلاز فنیل‌کتونوری می‌دهد (بوی موش، عقب‌ماندگی ذهنی).' },
      B: { en: 'Homogentisate oxidase deficiency is alkaptonuria (dark urine, arthropathy).', fa: 'کمبود هوموگنتیسات اکسیداس آلکاپتونوری است (تیره شدن ادرار، آرتروپاتی).' },
      C: { en: 'Correct — the defective enzyme in maple syrup urine disease.', fa: 'درست — آنزیم معیوب در بیماری ادرار شیره افرا.' },
      D: { en: 'Cystathionine synthase deficiency is homocystinuria (ectopia lentis, thrombosis).', fa: 'کمبود سیستاتیونین سنتاز هوموسیستینوری است (دررفتگی عدسی، ترومبوز).' },
      E: { en: 'OTC deficiency causes hyperammonemia with orotic aciduria, not maple-syrup odor.', fa: 'کمبود OTC هیپرآمونمی با اوروت‌اسیدوری می‌دهد، نه بوی شیره افرا.' },
    },
    keyLearningPoints: [
      'بوی ادرار نوزاد یک clue تشخیصی مهم است: شیره افرا ← MSUD، موش ← PKU.',
      'MSUD: انباشت لوسین مسئول علامت عصبی است؛ درمان: محدودیت آمینواسید زنجیره منشعب و تیامین در برخی نوع‌ها.',
    ],
    clinicalPearl: 'در نوزاد بیمار با انسفالوپاتی و اسیدوز متابولیک، نمونه ادرار را قبل از شروع تغذیه وریدی بگیرید.',
    commonMistake: 'مردم‌آمیختن MSUD با PKU؛ یادآوری: «افرا = زنجیره منشعب».',
    examTip: 'جدول بوی ادرار/تعریق در خطاهای مادرزادی متابولیسم جزو پرتکرارترین نکات Step 1 است.',
    reference: { title: 'Robbins Basic Pathology, 11e', note: 'فصل بیماری‌های ژنتیکی و متابولیک' },
  },
  {
    id: 'q-usmle-04',
    examId: 'usmle',
    sectionId: 'usmle-step1',
    subjectId: 'physiology',
    topic: { en: 'Cardiac contractility', fa: 'انقباض‌پذیری قلب' },
    difficulty: 'medium',
    tags: ['physiology', 'frank-starling'],
    source: 'educational_sample',
    stem:
      'Which of the following physiologic changes shifts the ventricular function (Frank–Starling) curve upward, increasing stroke volume at any given end-diastolic volume?',
    stemFa:
      'کدام تغییر فیزیولوژیک منحنی عملکرد بطنی (فرانک-استارلینگ) را به بالا شیفت می‌دهد و در حجم انتهای دیاستول ثابت، حجم ضربه‌ای را بیشتر می‌کند؟',
    options: [
      { key: 'A', en: 'Increased afterload', fa: 'افزایش پس‌بار' },
      { key: 'B', en: 'Sympathetic stimulation of the myocardium', fa: 'تحریک سمپاتیک میوکارد' },
      { key: 'C', en: 'Decreased end-diastolic volume', fa: 'کاهش حجم انتهای دیاستول' },
      { key: 'D', en: 'Vagal (parasympathetic) stimulation', fa: 'تحریک پاراسمپاتیک (واگ)' },
      { key: 'E', en: 'Myocardial ischemia', fa: 'ایسکمی میوکارد' },
    ],
    correctAnswer: 'B',
    explanation: {
      en: 'Positive inotropic agents — chiefly β1-adrenergic stimulation — increase contractility, shifting the Frank–Starling curve upward: more stroke volume at the same preload.',
      fa: 'عوامل اینوتروپ مثبت — عمدتاً تحریک آدرنرژیک β1 — انقباض‌پذیری را افزایش می‌دهند و منحنی فرانک-استارلینگ را به بالا شیفت می‌دهند: حجم ضربه‌ای بیشتر در همان پیش‌بار.',
    },
    optionExplanations: {
      A: { en: 'Higher afterload reduces stroke volume at any preload (curve shifts down).', fa: 'پس‌بار بیشتر، حجم ضربه‌ای را در هر پیش‌بار کم می‌کند (شیفت به پایین).' },
      B: { en: 'Correct — β1 stimulation increases Ca²⁺ influx and contractility.', fa: 'درست — تحریک β1 ورود کلسیم و انقباض‌پذیری را زیاد می‌کند.' },
      C: { en: 'Changing preload moves along the curve, it does not shift it.', fa: 'تغییر پیش‌بار حرکت روی منحنی است، نه شیفت آن.' },
      D: { en: 'Vagal stimulation is negative inotropic.', fa: 'تحریک واگ اثر اینوتروپ منفی دارد.' },
      E: { en: 'Ischemia impairs contractility and shifts the curve downward.', fa: 'ایسکمی انقباض‌پذیری را کم و منحنی را پایین می‌برد.' },
    },
    keyLearningPoints: [
      'تفاوت «حرکت روی منحنی» (تغییر پیش‌بار) با «شیفت منحنی» (تغییر اینوتروپی).',
      'اینوتروپ مثبت: سمپاتیک/کاتکولامین، دیگوکسین؛ اینوتروپ منفی: واگ، ایسکمی، بتابلوکر.',
    ],
    clinicalPearl: 'در شوک کاردیوژنیک، درمان‌های اینوتروپ مثبت منحنی را بالا می‌برند اما مصرف اکسیژن میوکارد را هم زیاد می‌کنند.',
    commonMistake: 'انتخاب «افزایش پیش‌بار» به‌عنوان شیفت؛ پیش‌بار فقط روی همان منحنی حرکت می‌کند.',
    examTip: 'سؤال‌های شیفت منحنی را با یک سؤال ساده بسننجید: «اینوتروپی عوض شده یا بار قلب؟»',
    reference: { title: 'Guyton & Hall, Textbook of Medical Physiology, 14e', note: 'فصل عملکرد قلب' },
  },
  {
    id: 'q-usmle-05',
    examId: 'usmle',
    sectionId: 'usmle-step1',
    subjectId: 'microbiology',
    topic: { en: 'Atypical pneumonia', fa: 'پنومونی آتیپیک' },
    difficulty: 'easy',
    tags: ['microbiology', 'respiratory'],
    source: 'educational_sample',
    stem:
      'A 19-year-old college student presents with 1 week of dry cough, low-grade fever, and malaise. Chest radiograph shows diffuse bilateral infiltrates that appear far worse than his mild symptoms. Cold agglutinin testing is positive. Which organism is the most likely cause?',
    stemFa:
      'دانشجویی ۱۹ ساله با یک هفته سرفه خشک، تب خفیف و خستگی مراجعه می‌کند. رادیوگرافی قفسه سینه اینفیلترات دوطرفه گسترده با شدت بیش از حد علائم خفیف نشان می‌دهد. تست آگلوتینین سرد مثبت است. عامل محتمل کدام است؟',
    options: [
      { key: 'A', en: 'Streptococcus pneumoniae', fa: 'استرپتوکوک پنومونیه' },
      { key: 'B', en: 'Mycoplasma pneumoniae', fa: 'مایکوپلاسما پنومونیه' },
      { key: 'C', en: 'Legionella pneumophila', fa: 'لژیونلا پنوموفیلا' },
      { key: 'D', en: 'Haemophilus influenzae', fa: 'هموفیلوس آنفلوانزا' },
      { key: 'E', en: 'Chlamydia psittaci', fa: 'کلامیدیا پسیتاسی' },
    ],
    correctAnswer: 'B',
    explanation: {
      en: 'Classic picture of Mycoplasma pneumoniae: walking pneumonia in a young adult, marked radiographic findings disproportionate to symptoms, and positive cold agglutinins.',
      fa: 'تصویر کلاسیک مایکوپلاسما پنومونیه: پنومونی «سرپایی» در جوان، یافته‌های رادیوگرافی نامتناسب با علائم خفیف، و آگلوتینین سرد مثبت.',
    },
    optionExplanations: {
      A: { en: 'Typical pneumonia: acute high fever, rust-colored sputum, lobar consolidation.', fa: 'پنومونی تیپیک: تب حاد بالا، خلط زنگ‌مانند، تثبیت لوبار.' },
      B: { en: 'Correct — atypical pneumonia of young adults with positive cold agglutinins.', fa: 'درست — پنومونی آتیپیک جوانان با آگلوتینین سرد مثبت.' },
      C: { en: 'Legionella: GI symptoms, hyponatremia, exposure to water systems.', fa: 'لژیونلا: علائم گوارشی، هیپوناترمی، تماس با سیستم‌های آبی.' },
      D: { en: 'H. influenzae: COPD exacerbation and epiglottitis (unvaccinated children).', fa: 'هموفیلوس: تشدید COPD و اپیگلوتیت (در کودکان واکسن‌نخورده).' },
      E: { en: 'Psittacosis: contact with birds.', fa: 'پسیتاکوز: تماس با پرندگان.' },
    },
    keyLearningPoints: [
      'مایکوپلاسما فاقد دیواره سلولی است → پنی‌سیلین بی‌اثر؛ درمان ماکرولید یا داکسی‌سایکلین.',
      'آگلوتینین سرد مثبت + علائم خفیف با عکس سنگین = دستور سریع به سمت مایکوپلاسما.',
    ],
    clinicalPearl: 'در بیماران با پنومونی آتیپیک، درمان تجربی ماکرولید بدون انتظار برای کشت معمول است.',
    commonMistake: 'انتخاب پنوموکوک به‌خاطر «شایع‌ترین» بودن؛ نکته سؤال در دو hint آتیپیک است.',
    examTip: 'ترکیب «جوان + سرفه خشک + آگلوتینین سرد» را یاد بگیرید؛ تقریباً همیشه مایکوپلاسما است.',
    reference: { title: 'Microbiology and Immunology (Review)', note: 'فصل باکتری‌های بدون دیواره سلولی' },
  },
  {
    id: 'q-usmle-06',
    examId: 'usmle',
    sectionId: 'usmle-step1',
    subjectId: 'pathology',
    topic: { en: 'Esophageal pathology', fa: 'پاتولوژی مری' },
    difficulty: 'medium',
    tags: ['pathology', 'gi', 'high-yield'],
    source: 'educational_sample',
    stem:
      'A 45-year-old man with a 15-year history of gastroesophageal reflux undergoes endoscopy. Biopsy of the distal esophagus shows intestinal-type columnar metaplasia with goblet cells. This finding is a well-recognized precursor of which malignancy?',
    stemFa:
      'مردی ۴۵ ساله با سابقه ۱۵ ساله ریفلاکس گاستروازوفاژیال اندوسکوپی می‌شود. بیوپسی مری دیستال متاپلازی ستونی روده‌ای با سلول‌های جامی نشان می‌دهد. این یافته پیش‌ساز کدام بدخیمی شناخته‌شده است؟',
    options: [
      { key: 'A', en: 'Squamous cell carcinoma of the esophagus', fa: 'کارسینوم سلول سنگفرشی مری' },
      { key: 'B', en: 'Esophageal adenocarcinoma', fa: 'آدنوکارسینوم مری' },
      { key: 'C', en: 'Small cell carcinoma', fa: 'کارسینوم سلول کوچک' },
      { key: 'D', en: 'Leiomyosarcoma', fa: 'لیومیوسارکوم' },
      { key: 'E', en: 'Gastric carcinoid tumor', fa: 'تومور کارسینوئید معده' },
    ],
    correctAnswer: 'B',
    explanation: {
      en: 'Barrett esophagus — intestinal metaplasia of the distal esophagus — is the main precursor of esophageal adenocarcinoma; surveillance endoscopy is indicated.',
      fa: 'مری بارت — متاپلازی روده‌ای مری دیستال — پیش‌ساز اصلی آدنوکارسینوم مری است؛ اندوسکوپی نظارتی توصیه می‌شود.',
    },
    optionExplanations: {
      A: { en: 'SCC is linked to alcohol, smoking, achalasia, and hot beverages — not reflux metaplasia.', fa: 'SCC به الکل، سیگار، آشالازی و نوشیدنی داغ مرتبط است، نه متاپلازی ریفلاکسی.' },
      B: { en: 'Correct — Barrett → dysplasia → adenocarcinoma sequence.', fa: 'درست — توالی بارت ← دیسپلازی ← آدنوکارسینوم.' },
      C: { en: 'Small cell carcinoma is a lung neuroendocrine tumor.', fa: 'کارسینوم سلول کوچک تومور نورواندوکرین ریه است.' },
      D: { en: 'Leiomyosarcoma arises from smooth muscle, not metaplastic mucosa.', fa: 'لیومیوسارکوم از عضله صاف منشأ می‌گیرد، نه مخاط متاپلاستیک.' },
      E: { en: 'Gastric carcinoids arise from enterochromaffin-like cells.', fa: 'کارسینوئید معده از سلول‌های شبیه انتروکرومافین منشأ می‌گیرد.' },
    },
    keyLearningPoints: [
      'زنجیره: ریفلاکس مزمن ← مری بارت ← دیسپلازی کم‌درجه ← پردرجه ← آدنوکارسینوم.',
      'SCC مربوط به upper/middle مری است؛ آدنوکارسینوم دیستال و مرتبط با چاقی/GERD.',
    ],
    clinicalPearl: 'بیماران بارت با دیسپلازی پردرجه به رزکسیون یا آلبلیشن ارجاع می‌شوند.',
    commonMistake: 'مردم‌آمیختن سرطان‌های مرتبط با ریفلاکس (آدنوکارسینوم) و الکل/سیگار (SCC).',
    examTip: '«goblet cells in distal esophagus» را ببینید، جواب تقریباً همیشه آدنوکارسینوم است.',
    reference: { title: 'Robbins Basic Pathology, 11e', note: 'فصل مجاری گوارشی' },
  },

  /* ── PLAB ── */
  {
    id: 'q-plab-01',
    examId: 'plab',
    sectionId: 'plab-part1',
    subjectId: 'internal-medicine',
    topic: { en: 'Acute abdomen', fa: 'شکم حاد' },
    difficulty: 'easy',
    tags: ['surgery', 'classic'],
    source: 'educational_sample',
    stem:
      'A 27-year-old woman presents with 12 hours of right lower quadrant pain that began around the umbilicus, with nausea and a temperature of 37.8 °C. A urine pregnancy test is negative. What is the most likely diagnosis?',
    stemFa:
      'زنی ۲۷ ساله با ۱۲ ساعت درد ربع تحتانی راست — که اطراف ناف شروع شده — با تهوع و دمای ۳۷/۸ درجه مراجعه می‌کند. تست بارداری ادرار منفی است. محتمل‌ترین تشخیص چیست؟',
    options: [
      { key: 'A', en: 'Acute appendicitis', fa: 'آپاندیسیت حاد' },
      { key: 'B', en: 'Ruptured ectopic pregnancy', fa: 'پارگی بارداری خارج رحمی' },
      { key: 'C', en: 'Ovarian torsion', fa: 'پیچ‌خوردگی تخمدان' },
      { key: 'D', en: 'Pelvic inflammatory disease', fa: 'بیماری التهابی لگن' },
      { key: 'E', en: 'Gastroenteritis', fa: 'گاستروانتریت' },
    ],
    correctAnswer: 'A',
    explanation: {
      en: 'Migration of pain from the umbilicus to the right lower quadrant with anorexia, nausea, and low-grade fever is the classic presentation of acute appendicitis; negative pregnancy test removes the most dangerous mimic.',
      fa: 'مهاجرت درد از ناف به ربع تحتانی راست همراه بی‌اشتهایی، تهوع و تب خفیف، تصویر کلاسیک آپاندیسیت حاد است؛ تست بارداری منفی، مهم‌ترین تشخیص افتراقی خطرناک را حذف می‌کند.',
    },
    optionExplanations: {
      A: { en: 'Correct — classic migratory pain with systemic signs.', fa: 'درست — درد مهاجرت‌کننده کلاسیک با علائم سیستمیک.' },
      B: { en: 'Ruled out by negative pregnancy test; typically sudden severe pain with bleeding.', fa: 'با تست بارداری منفی رد می‌شود؛ معمولاً درد ناگهانی شدید با خونریزی.' },
      C: { en: 'Usually sudden severe unilateral pain, often with vomiting from onset.', fa: 'معمولاً درد ناگهانی شدید یک‌طرفه، اغلب با استفراغ از ابتدا.' },
      D: { en: 'Bilateral lower abdominal/pelvic pain with discharge and cervical motion tenderness.', fa: 'درد دوطرفه لگن با ترشح و حساسیت حرکتی سرویکس.' },
      E: { en: 'Diffuse crampy pain with diarrhea/vomiting, no focal peritoneal signs.', fa: 'درد کولیکی منتشر با اسهال/استفراغ، بدون علامت صفاقی موضعی.' },
    },
    keyLearningPoints: [
      'توالی کلاسیک: درد پری‌سانتری ← تهوع ← مهاجرت به RIF.',
      'در زن سنین باروری، آزمون بارداری قبل از هر تصویربرداری الزامی است.',
    ],
    clinicalPearl: 'امتیاز بالینی Alvarado برای triage مفید است اما تصمیم جراحی را CT/سونوگرافی قطعی می‌کند.',
    commonMistake: 'انتخاب تخمدان/لگن صرفاً به‌خاطر جنسیت بیمار؛ الگوی درد تعیین‌کننده است.',
    examTip: 'PLAB عاشق «most likely diagnosis» است؛ ابتدا خطرناک‌ترین افتراق را رد کنید.',
    reference: { title: 'Oxford Handbook of Clinical Medicine', note: 'فصل جراحی عمومی' },
  },
  {
    id: 'q-plab-02',
    examId: 'plab',
    sectionId: 'plab-part1',
    subjectId: 'internal-medicine',
    topic: { en: 'Stroke prevention', fa: 'پیشگیری از سکته' },
    difficulty: 'medium',
    tags: ['neurology', 'vascular'],
    source: 'educational_sample',
    stem:
      'A 66-year-old man reports a 10-minute episode of painless loss of vision in the right eye, describing it as a curtain coming down, which has fully resolved. Carotid bruit is audible on examination. What is the most appropriate initial investigation?',
    stemFa:
      'مردی ۶۶ ساله از اپیزود ۱۰ دقیقه‌ای بی‌دردِ کاهش بینایی چشم راست با توصیف «پرده پایین آمدن» می‌گوید که کاملاً برطرف شده. در معاینه بروئیت کاروتید شنیده می‌شود. مناسب‌ترین بررسی اولیه چیست؟',
    options: [
      { key: 'A', en: 'Carotid duplex ultrasound', fa: 'سونوگرافی داپلر کاروتید' },
      { key: 'B', en: 'Temporal artery biopsy', fa: 'بیوپسی شریان تمپورال' },
      { key: 'C', en: 'MRI of the brain', fa: 'ام‌آی‌آی مغز' },
      { key: 'D', en: 'Erythrocyte sedimentation rate', fa: 'ESR' },
      { key: 'E', en: 'Cerebral angiography', fa: 'آنژیوگرافی مغزی' },
    ],
    correctAnswer: 'A',
    explanation: {
      en: 'Amaurosis fugax with a carotid bruit suggests emboli from carotid stenosis; carotid duplex ultrasound is the first-line non-invasive investigation for stenosis degree.',
      fa: 'آماروزیس فوگاکس با بروئیت کاروتید به آمبولی از تنگی کاروتید اشاره دارد؛ داپلر کاروتید بررسی خط اول و غیرتهاجمی برای تعیین درجه تنگی است.',
    },
    optionExplanations: {
      A: { en: 'Correct — first-line assessment of carotid stenosis after amaurosis fugax.', fa: 'درست — ارزیابی خط اول تنگی کاروتید پس از آماروزیس فوگاکس.' },
      B: { en: 'For giant cell arteritis with jaw claudication and headache, not painless monocular vision loss.', fa: 'برای آرتریت سلول غول‌پیکر با کلادیکاسیون فک و سردرد است، نه کاهش بی‌درد بینایی تک‌چشم.' },
      C: { en: 'Brain imaging is part of stroke workup but the eye symptom points to the carotid first.', fa: 'تصویربرداری مغز بخشی از بررسی سکته است، اما علامت چشمی ابتدا کاروتید را مطرح می‌کند.' },
      D: { en: 'ESR alone is nonspecific for this presentation.', fa: 'ESR به‌تنهایی در این تصویر غیراختصاصی است.' },
      E: { en: 'Invasive; reserved for pre-operative planning after duplex.', fa: 'تهاجمی است؛ برای برنامه‌ریزی قبل جراحی بعد از داپلر رزرو می‌شود.' },
    },
    keyLearningPoints: [
      'آماروزیس فوگاکس = TIA در قلمرو چشمی؛ مدیریت مثل TIA: بررسی سریع کاروتید + آنتی‌پلاتلت + کنترل ریسک.',
      'بروئیت کاروتید یک یافته مهم اما نه تعیین‌کننده درجه تنگی است؛ داپلر کمّی است.',
    ],
    clinicalPearl: 'پس از آماروزیس فوگاکس ریسک سکته در روزهای اول بالاست؛ ارزیابی را به تعویق نیندازید.',
    commonMistake: 'انتخاب MRI مغز به‌عنوان «بررسی کامل‌تر»؛ سؤال، بررسی «مناسب اولیه» را خواسته است.',
    examTip: 'در PLAB همیشه بین «initial» و «best» تفکیک قائل شوید.',
    reference: { title: 'Oxford Handbook of Clinical Medicine', note: 'فصل نورولوژی/عروق' },
  },
  {
    id: 'q-plab-03',
    examId: 'plab',
    sectionId: 'plab-part1',
    subjectId: 'internal-medicine',
    topic: { en: 'Endocrine hypertension', fa: 'هایپرتنشن اندوکرین' },
    difficulty: 'medium',
    tags: ['endocrine', 'management'],
    source: 'educational_sample',
    stem:
      'A 24-hour urinary metanephrine collection is markedly elevated in a 38-year-old man with episodes of palpitations, sweating, and headache, and sustained hypertension. Which is the most appropriate next investigation to localise the lesion?',
    stemFa:
      'در مردی ۳۸ ساله با اپیزودهای پالپیتاسیون، تعریق و سردرد و هایپرتنشن پایدار، متانفرین ادرار ۲۴ ساعته به‌طور بارز بالا است. مناسب‌ترین بررسی بعدی برای لوکالیزه کردن ضایعه کدام است؟',
    options: [
      { key: 'A', en: 'CT or MRI of the abdomen and pelvis', fa: 'CT یا MRI شکم و لگن' },
      { key: 'B', en: 'Dexamethasone suppression test', fa: 'تست سرکوب دگزامتازون' },
      { key: 'C', en: 'Renal artery Doppler', fa: 'داپلر شریان کلیه' },
      { key: 'D', en: 'Selective venous sampling', fa: 'نمونه‌گیری وریدی انتخابی' },
      { key: 'E', en: 'Repeat urine collection after 3 months', fa: 'تکرار جمع‌آوری ادرار بعد از ۳ ماه' },
    ],
    correctAnswer: 'A',
    explanation: {
      en: 'Confirmed catecholamine excess (phaeochromocytoma) must next be localised with cross-sectional imaging of the adrenals — CT or MRI of abdomen and pelvis.',
      fa: 'پس از تأیید اضافه کاتکولامین (فاوکروموسیتوم)، گام بعدی لوکالیزه کردن با تصویربرداری مقطعی آدرنال‌ها — CT یا MRI شکم و لگن — است.',
    },
    optionExplanations: {
      A: { en: 'Correct — standard localisation imaging for phaeochromocytoma.', fa: 'درست — تصویربرداری استاندارد لوکالیزاسیون فاوکروموسیتوم.' },
      B: { en: 'Investigates Cushing syndrome, not catecholamine excess.', fa: 'برای بررسی سندرم کوشینگ است، نه اضافه کاتکولامین.' },
      C: { en: 'For renovascular hypertension.', fa: 'برای هایپرتنشن رنواسکولار.' },
      D: { en: 'Used in selected cases after imaging, not first.', fa: 'در موارد منتخب بعد از تصویربرداری استفاده می‌شود، نه ابتدا.' },
      E: { en: 'Delaying workup of confirmed phaeochromocytoma is unsafe.', fa: 'به تعویق انداختن بررسی فاوکروموسیتوم تأییدشده ناایمن است.' },
    },
    keyLearningPoints: [
      'توالی تشخیص فاوکروموسیتوم: biochemical confirmation ← imaging localisation.',
      'قبل از جراحی: بلوک آلفا قبل از بلوک بتا؛ بعد تیروزی‌سازی کامل.',
    ],
    clinicalPearl: 'بی‌خبریِ فاوکروموسیتوم تشخیص‌نشده در حین بیهوشی می‌تواند مرگ‌آور باشد؛ تأیید را جدی بگیرید.',
    commonMistake: 'شروع بتا-بلوکر تنها؛ می‌تواند بحران هایپرتنشن ایجاد کند.',
    examTip: '«cannonball adrenal mass + headaches» در PLAB همیشه با فاوکروموسیتوم همراه است.',
    reference: { title: 'Endocrinology (Clinical Review)', note: 'فصل تومورهای آدرنال' },
  },

  /* ── AMC ── */
  {
    id: 'q-amc-01',
    examId: 'amc',
    sectionId: 'amc-cat',
    subjectId: 'pediatrics',
    topic: { en: 'Upper airway — croup', fa: 'راه هوایی فوقانی — کروپ' },
    difficulty: 'easy',
    tags: ['pediatrics', 'emergency'],
    source: 'educational_sample',
    stem:
      'A 3-year-old boy presents at night with a barking cough, inspiratory stridor at rest, and a temperature of 38 °C. He is alert with a normal work of breathing apart from the stridor. What is the most appropriate initial management?',
    stemFa:
      'پسری ۳ ساله شبانه با سرفه پارس‌مانند، استریدور دم در حالت استراحت و دمای ۳۸ درجه مراجعه می‌کند. جز استریدور، هوشیار است و کار تنفس طبیعی دارد. مناسب‌ترین درمان اولیه چیست؟',
    options: [
      { key: 'A', en: 'Oral dexamethasone', fa: 'دگزامتازون خوراکی' },
      { key: 'B', en: 'Oral amoxicillin', fa: 'آموکسی‌سیلین خوراکی' },
      { key: 'C', en: 'Immediate tracheal intubation', fa: 'لوله‌گذاری فوری تراشه' },
      { key: 'D', en: 'Nebulised salbutamol', fa: 'سالبوتامول نبولایز' },
      { key: 'E', en: 'Antitussive syrup at home', fa: 'شربت ضد سرفه در منزل' },
    ],
    correctAnswer: 'A',
    explanation: {
      en: 'Croup (laryngotracheobronchitis) is managed with a single dose of oral dexamethasone for all severities; nebulised epinephrine is added for severe distress.',
      fa: 'کروپ (لارنگیوتراکئوبرونشیت) با دوز واحد دگزامتازون خوراکی در همه شدت‌ها درمان می‌شود؛ اپی‌نفرین نبولایز برای دیسترس شدید اضافه می‌شود.',
    },
    optionExplanations: {
      A: { en: 'Correct — corticosteroid is the evidence-based cornerstone for croup.', fa: 'درست — کورتیکواستروئید سنگ‌بنای درمان کروپ است.' },
      B: { en: 'Croup is viral; antibiotics have no role.', fa: 'کروپ ویروسی است؛ آنتی‌بیوتیک جایی ندارد.' },
      C: { en: 'Reserved for impending airway obstruction, not mild stridor.', fa: 'برای انسداد قریب‌الوقوع راه هوایی است، نه استریدور خفیف.' },
      D: { en: 'Salbutamol treats lower-airway bronchospasm, not subglottic edema.', fa: 'سالبوتامول برونکواسپاسم راه هوایی تحتانی را درمان می‌کند، نه ادما زیر حنجره.' },
      E: { en: 'Stridor at rest needs medical therapy, not symptomatic home care.', fa: 'استریدور در استراحت نیاز به درمان پزشکی دارد، نه مراقبت علامتی خانگی.' },
    },
    keyLearningPoints: [
      'کروپ: سرفه پارس + استریدور دم + بدتر شدن شبانه در ۶ ماه تا ۳ سال.',
      'دگزامتازون خوراکی ۰/۱۵–۰/۶ mg/kg برای همه درجات؛ اپی‌نفرین نبولایز برای شدید.',
    ],
    clinicalPearl: 'بیدار نگه‌داشتن آرام کودک؛ گریه استریدور را بدتر می‌کند.',
    commonMistake: 'انتخاب اپی‌نفرین برای همه؛ اپی‌نفرین فقط دیسترس شدید یا پیش از ترخیص پس از دگزامتازون.',
    examTip: 'شدت را با «استریدور در استراحت» تعیین کنید؛ این عبارت سطح درمان را بالا می‌برد.',
    reference: { title: 'Paediatric Handbook', note: 'فصل راه هوایی فوقانی' },
  },
  {
    id: 'q-amc-02',
    examId: 'amc',
    sectionId: 'amc-cat',
    subjectId: 'obstetrics',
    topic: { en: 'Hypertensive pregnancy disorders', fa: 'اختلالات فشار خون بارداری' },
    difficulty: 'medium',
    tags: ['obstetrics', 'high-yield'],
    source: 'educational_sample',
    stem:
      'A 30-year-old woman at 34 weeks of gestation presents with blood pressure 150/100 mmHg on two occasions, 2+ proteinuria, and new-onset headache. Her blood pressure was normal before 20 weeks. What is the most likely diagnosis?',
    stemFa:
      'زنی ۳۰ ساله در هفته ۳۴ بارداری با فشار خون ۱۵۰/۱۰۰ در دو نوبت، پروتئینوری ۲+ و سردرد تازه مراجعه می‌کند. فشار خون او قبل از هفته ۲۰ طبیعی بوده است. محتمل‌ترین تشخیص چیست؟',
    options: [
      { key: 'A', en: 'Chronic hypertension', fa: 'هایپرتنشن مزمن' },
      { key: 'B', en: 'Gestational hypertension', fa: 'هایپرتنشن بارداری بدون پروتئینوری' },
      { key: 'C', en: 'Preeclampsia with severe features', fa: 'پره‌اکلامپسی با ویژگی‌های شدید' },
      { key: 'D', en: 'HELLP syndrome', fa: 'سندرم HELLP' },
      { key: 'E', en: 'Eclampsia', fa: 'اکلامپسی' },
    ],
    correctAnswer: 'C',
    explanation: {
      en: 'New hypertension after 20 weeks with proteinuria defines preeclampsia; cerebral symptoms (headache) qualify as severe features requiring urgent management.',
      fa: 'هایپرتنشن تازه بعد از هفته ۲۰ با پروتئینوری، پره‌اکلامپسی را تعریف می‌کند؛ علائم مغزی (سردرد) ویژگی شدید محسوب می‌شود و مدیریت فوری می‌طلبد.',
    },
    optionExplanations: {
      A: { en: 'Requires hypertension before 20 weeks — explicitly absent here.', fa: 'نیازمند فشار خون قبل از هفته ۲۰ است — اینجا صراحتاً نیست.' },
      B: { en: 'Gestational hypertension lacks proteinuria/organ involvement.', fa: 'هایپرتنشن بارداری پروتئینوری یا درگیری اندام ندارد.' },
      C: { en: 'Correct — proteinuria plus neurologic severe feature.', fa: 'درست — پروتئینوری به‌علاوه ویژگی شدید نورولوژیک.' },
      D: { en: 'HELLP needs hemolysis, elevated liver enzymes, low platelets — not provided.', fa: 'HELLP همولیز، آنزیم کبدی بالا و پلاکت پایین می‌خواهد — ذکر نشده.' },
      E: { en: 'Eclampsia requires a seizure — none reported.', fa: 'اکلامپسی تشنج می‌خواهد — گزارش نشده.' },
    },
    keyLearningPoints: [
      'پره‌اکلامپسی: HTN تازه بعد هفته ۲۰ + پروتئینوری یا درگیری اندام.',
      'ویژگی‌های شدید: سردرد/اختلال بینایی، درد RUQ، پلاکت <۱۰۰k، کراتینین بالا، IUGR شدید.',
    ],
    clinicalPearl: 'در پره‌اکلامپسی شدید، منیزیم سولفات برای پیشگیری از تشنج و کنترل فشار شروع می‌شود؛ توالی فوری است.',
    commonMistake: 'فرق «severe features» با HELLP و اکلامپسی را قاطی کردن؛ سؤال فقط سردرد داده است.',
    examTip: 'در آزمون‌های مامایی، هفته ۲۰ مرز طلایی طبقه‌بندی است.',
    reference: { title: 'Obstetrics (Clinical Guidelines)', note: 'فصل هایپرتنشن بارداری' },
  },
  {
    id: 'q-amc-03',
    examId: 'amc',
    sectionId: 'amc-cat',
    subjectId: 'internal-medicine',
    topic: { en: 'Chest trauma', fa: 'ترومای قفسه سینه' },
    difficulty: 'medium',
    tags: ['emergency', 'classic'],
    source: 'educational_sample',
    stem:
      'A 22-year-old man is stabbed in the left chest. He is hypotensive with a systolic BP of 85 mmHg, distended neck veins, and muffled heart sounds; breath sounds are present bilaterally. What is the most likely diagnosis?',
    stemFa:
      'مردی ۲۲ ساله با چاقو در قفسه سینه چپ زخمی می‌شود. هیپوتانسیو است (سیستول ۸۵)، وریدهای گردن متسع و صداهای قلبی کور است؛ صداهای تنفسی دوطرفه شنیده می‌شود. محتمل‌ترین تشخیص چیست؟',
    options: [
      { key: 'A', en: 'Tension pneumothorax', fa: 'پنوموتوراکس تنشی' },
      { key: 'B', en: 'Cardiac tamponade', fa: 'تامپوناد قلبی' },
      { key: 'C', en: 'Massive haemothorax', fa: 'هموتوراکس وسیع' },
      { key: 'D', en: 'Traumatic aortic injury', fa: 'آسیب تروماتیک آئورت' },
      { key: 'E', en: 'Neurogenic shock', fa: 'شوک نوروژنیک' },
    ],
    correctAnswer: 'B',
    explanation: {
      en: 'Beck triad — hypotension, distended neck veins, muffled heart sounds — with preserved breath sounds indicates cardiac tamponade from a penetrating chest injury.',
      fa: 'تریاد بک — هیپوتانسیون، وریدهای گردن متسع، صداهای قلبی کور — با تنفس سالم، تامپوناد قلبی ناشی از زخم نفوذی را نشان می‌دهد.',
    },
    optionExplanations: {
      A: { en: 'Tension pneumothorax gives absent breath sounds and tracheal deviation.', fa: 'پنوموتوراکس تنشی صدای تنفسی حذف‌شده و انحراف تراشه می‌دهد.' },
      B: { en: 'Correct — classic Beck triad after penetrating precordial injury.', fa: 'درست — تریاد کلاسیک بک پس از زخم نفوذی پره‌کاردیوم.' },
      C: { en: 'Massive haemothorax: absent breath sounds on the affected side + dullness.', fa: 'هموتوراکس وسیع: حذف صدای تنفسی همان سمت + کوبی.' },
      D: { en: 'Aortic injury usually follows deceleration; presents differently.', fa: 'آسیب آئورت معمولاً از شتاب‌گیری-ترمز است و تصویر متفاوتی دارد.' },
      E: { en: 'Neurogenic shock features warm, dry skin with bradycardia.', fa: 'شوک نوروژنیک: پوست گرم و خشک با برادی‌کاردی.' },
    },
    keyLearningPoints: [
      'تریاد بک = تامپوناد؛ علامت افتراقی از پنوموتوراکس تنشی: صداهای تنفسی موجود + بدون انحراف تراشه.',
      'درمان حیاتی: پری‌کاردیوسنتز اورژانس (subxiphoid pericardial window).',
    ],
    clinicalPearl: 'پالس پارادوکس >۱۰ mmHg در تامپوناد کمکی اما حساسیت صددرصد ندارد.',
    commonMistake: 'انتخاب تنشی صرفاً چون شایع‌تر است؛ صداهای تنفسی موجود، تنشی را رد می‌کند.',
    examTip: 'در ATLS-style سؤال‌ها، «breath sounds present» معمولاً انحراف پاسخ از پنوموتوراکس است.',
    reference: { title: 'Emergency & Trauma Care (ATLS-based Review)', note: 'فصل ترومای قفسه سینه' },
  },

  /* ── MCCQE ── */
  {
    id: 'q-mccqe-01',
    examId: 'mccqe',
    sectionId: 'mccqe-part1',
    subjectId: 'internal-medicine',
    topic: { en: 'Valvular heart disease', fa: 'بیماری‌های دریچه‌ای قلب' },
    difficulty: 'medium',
    tags: ['cardiology', 'classic'],
    source: 'educational_sample',
    stem:
      'A 68-year-old woman reports exertional syncope over the past two months. Examination reveals a harsh ejection systolic murmur at the right second intercostal space radiating to the carotids with slow-rising, low-amplitude carotid pulses. What is the most likely diagnosis?',
    stemFa:
      'زنی ۶۸ ساله از سینکوپ فعالیت دو ماه اخیر می‌گوید. معاینه صدای سیستولیک خشن اخراجی در فضای بین‌دنده‌ای دوم راست با انتشار به کاروتید و پالس کاروتید کند و کم‌دامنه نشان می‌دهد. محتمل‌ترین تشخیص چیست؟',
    options: [
      { key: 'A', en: 'Aortic stenosis', fa: 'تنگی آئورت' },
      { key: 'B', en: 'Hypertrophic obstructive cardiomyopathy', fa: 'کاردیومیوپاتی هیپرتروفیک انسدادی' },
      { key: 'C', en: 'Mitral regurgitation', fa: 'نارسایی میترال' },
      { key: 'D', en: 'Aortic regurgitation', fa: 'نارسایی آئورت' },
      { key: 'E', en: 'Tricuspid stenosis', fa: 'تنگی سه‌لتی' },
    ],
    correctAnswer: 'A',
    explanation: {
      en: 'Exertional syncope + crescendo–decrescendo systolic murmur radiating to carotids + pulsus parvus et tardus is the classic triad of aortic stenosis in the elderly.',
      fa: 'سینکوپ فعالیت + صدای سیستولیک سیر صعودی-نزولی با انتشار به کاروتید + پالوس پارووس ات تاردوس، تریاد کلاسیک تنگی آئورت در سالمندان است.',
    },
    optionExplanations: {
      A: { en: 'Correct — matches murmur, radiation, and carotid character.', fa: 'درست — با صدا، انتشار و ماهیت پالس کاروتید همخوان است.' },
      B: { en: 'HOCM murmur increases with Valsalva and does not radiate to carotids classically.', fa: 'صدای HOCM با والسالا بیشتر می‌شود و کلاسیک به کاروتید منتشر نمی‌شود.' },
      C: { en: 'Mitral regurgitation: holosystolic, radiates to axilla.', fa: 'نارسایی میترال: هولوسیستولیک با انتشار به بغل.' },
      D: { en: 'Aortic regurgitation: diastolic decrescendo with wide pulse pressure.', fa: 'نارسایی آئورت: دیاستولیک نزولی با فشار نبض وسیع.' },
      E: { en: 'Tricuspid stenosis: diastolic rumble at left sternal border.', fa: 'تنگی سه‌لتی: خمیر دیاستولیک در حاشیه چپ استرنوم.' },
    },
    keyLearningPoints: [
      'سندرم کلاسیک AS: آنژین + سینکوپ + دیس‌پنه (SAD).',
      'پالس پارووس ات تاردوس = کم‌حجم و دیررس؛ نشانگر تنگی شدید.',
    ],
    clinicalPearl: 'سینکوپ در تنگی شدید آئورت، علامت پیش‌آگهی بد است؛ ارزیابی سریع برای تعویض دریچه لازم است.',
    commonMistake: 'مردم‌آمیختن با HOCM؛ افزایش صدا با والسالا به HOCM و کاهش به AS اشاره دارد.',
    examTip: '«radiates to carotids» را ببینید؛ جواب تنگی آئورت است.',
    reference: { title: 'Cardiology (Clinical Review)', note: 'فصل بیماری دریچه‌ای' },
  },
  {
    id: 'q-mccqe-02',
    examId: 'mccqe',
    sectionId: 'mccqe-part1',
    subjectId: 'public-health',
    topic: { en: 'Screening test statistics', fa: 'آمار تست غربالگری' },
    difficulty: 'hard',
    tags: ['ebm', 'biostatistics'],
    source: 'educational_sample',
    stem:
      'A new screening test for colorectal cancer has a sensitivity of 80% and a specificity of 95%. It is applied to a population with a disease prevalence of 1%. What is the approximate positive predictive value?',
    stemFa:
      'تست غربالگری جدید سرطان کولورکتال حساسیت ۸۰٪ و ویژگی ۹۵٪ دارد. در جمعیتی با شیوع ۱٪ به کار می‌رود. تقریباً ارزش پیش‌گویی مثبت چقدر است؟',
    options: [
      { key: 'A', en: 'About 8%', fa: 'حدود ۸٪' },
      { key: 'B', en: 'About 14%', fa: 'حدود ۱۴٪' },
      { key: 'C', en: 'About 50%', fa: 'حدود ۵۰٪' },
      { key: 'D', en: 'About 80%', fa: 'حدود ۸۰٪' },
      { key: 'E', en: 'About 95%', fa: 'حدود ۹۵٪' },
    ],
    correctAnswer: 'B',
    explanation: {
      en: 'In 10,000 people: 100 cases → 80 true positives; 9,900 healthy → ~495 false positives. PPV = 80/(80+495) ≈ 14%. Low prevalence means most positives are false.',
      fa: 'در ۱۰٬۰۰۰ نفر: ۱۰۰ بیمار ← ۸۰ مثبت واقعی؛ ۹٬۹۰۰ سالم ← حدود ۴۹۵ مثبت کاذب. PPV = ۸۰/(۸۰+۴۹۵) ≈ ۱۴٪. در شیوع پایین، اکثر مثبت‌ها کاذب‌اند.',
    },
    optionExplanations: {
      A: { en: 'Underestimates; recheck the false-positive fraction.', fa: 'کم‌برآورد است؛ کسر مثبت کاذب را دوباره بررسی کنید.' },
      B: { en: 'Correct — 80/(80+495) ≈ 14%.', fa: 'درست — ۸۰/(۸۰+۴۹۵) ≈ ۱۴٪.' },
      C: { en: 'Would require a much higher prevalence.', fa: 'این عدد شیوع بسیار بالاتری لازم دارد.' },
      D: { en: '80% is the sensitivity, not the PPV.', fa: '۸۰٪ حساسیت است، نه PPV.' },
      E: { en: '95% is the specificity, not the PPV.', fa: '۹۵٪ ویژگی است، نه PPV.' },
    },
    keyLearningPoints: [
      'PPV به شیوع وابسته است؛ در شیوع پایین حتی تست‌های عالی PPV کم دارند.',
      'فرمول سریع: PPV = (Se×Prev)/(Se×Prev + (1−Sp)×(1−Prev)).',
    ],
    clinicalPearl: 'در مشاوره قبل از غربالگری، احتمال «مثبت کاذب» را شفاف بگویید تا اضطراب بی‌مورد ایجاد نشود.',
    commonMistake: 'جایگذاری حساسیت به‌جای PPV؛ PPV هرگز مستقل از شیوع نیست.',
    examTip: 'با جمعیت ۱۰٬۰۰۰ نفری حساب کنید؛ سریع‌ترین روش بدون اشتباه است.',
    reference: { title: 'Epidemiology & Biostatistics (Review)', note: 'فصل دقت آزمون‌های تشخیصی' },
  },

  /* ── IFOM ── */
  {
    id: 'q-ifom-01',
    examId: 'ifom',
    sectionId: 'ifom-cse',
    subjectId: 'anatomy',
    topic: { en: 'Laryngeal nerve injuries', fa: 'آسیب اعصاب حنجره' },
    difficulty: 'medium',
    tags: ['anatomy', 'surgery'],
    source: 'educational_sample',
    stem:
      'During thyroidectomy, the external branch of the superior laryngeal nerve is injured while ligating the superior thyroid artery. Which deficit is most likely to result?',
    stemFa:
      'در حین تیروئیدکتومی، شاخه خارجی عصب حنجره‌ای فوقانی هنگام بستن شریان تیروئید فوقانی آسیب می‌بیند. محتمل‌ترین نقص حاصل کدام است؟',
    options: [
      { key: 'A', en: 'Hoarse, breathy voice from vocal cord paralysis', fa: 'صدای خشن و نفسی به‌دلیل فلج طناب صوتی' },
      { key: 'B', en: 'Loss of high-pitch voice production', fa: 'از دست رفتن توان تولید صدای زیر' },
      { key: 'C', en: 'Aspiration from loss of supraglottic sensation', fa: 'آسپیراسیون به‌دلیل از دست رفتن حس فوق حنجره' },
      { key: 'D', en: 'Severe airway obstruction at rest', fa: 'انسداد شدید راه هوایی در حالت استراحت' },
      { key: 'E', en: 'Inability to abduct the vocal cords', fa: 'ناتوانی در آبداکشن طناب‌های صوتی' },
    ],
    correctAnswer: 'B',
    explanation: {
      en: 'The external branch of the superior laryngeal nerve innervates the cricothyroid muscle, which tenses the vocal cords for high-pitched phonation; injury flattens the voice.',
      fa: 'شاخه خارجی عصب حنجره‌ای فوقانی عضله کریکوتیروئید را عصب‌دهی می‌کند که برای صدای زیر، طناب‌های صوتی را کشیده می‌کند؛ آسیب آن صدا را یکنواخت می‌کند.',
    },
    optionExplanations: {
      A: { en: 'Hoarse voice follows recurrent laryngeal nerve injury.', fa: 'صدای خشن به آسیب عصب حنجره‌ای راجع (RLN) مربوط است.' },
      B: { en: 'Correct — cricothyroid paralysis removes high-pitch phonation.', fa: 'درست — فلج کریکوتیروئید صدای زیر را از بین می‌برد.' },
      C: { en: 'Supraglottic sensation is carried by the internal branch.', fa: 'حس فوق حنجره با شاخه داخلی منتقل می‌شود.' },
      D: { en: 'Bilateral recurrent nerve injury threatens the airway, not external SLN.', fa: 'آسیب دوطرفه RLN راه هوایی را تهدید می‌کند، نه شاخه خارجی SLN.' },
      E: { en: 'Abduction is a posterior cricoarytenoid function (recurrent nerve).', fa: 'آبداکشن کار عضله کریکوآریتنوئید خلفی است (عصب راجع).' },
    },
    keyLearningPoints: [
      'شاخه خارجی SLN = حرکتی برای کریکوتیروئید (کشش طناب، صدای زیر).',
      'شاخه داخلی SLN = حسی فوق حنجره؛ RLN = همه عضلات حنجره داخلی به‌جز کریکوتیروئید.',
    ],
    clinicalPearl: 'جراح شریان تیروئید فوقانی را نزدیک غده می‌بندد تا از شاخه خارجی SLN فاصله بگیرد.',
    commonMistake: 'جایگزینی نقش‌های شاخه خارجی و داخلی SLN.',
    examTip: '«ligating superior thyroid artery → external SLN» جفت کلاسیک IFOM/Step 1 است.',
    reference: { title: 'Clinically Oriented Anatomy', note: 'فصل گردن و حنجره' },
  },
  {
    id: 'q-ifom-02',
    examId: 'ifom',
    sectionId: 'ifom-bse',
    subjectId: 'physiology',
    topic: { en: 'Water homeostasis', fa: 'همئوستاز آب' },
    difficulty: 'hard',
    tags: ['renal', 'physiology'],
    source: 'educational_sample',
    stem:
      'During a water-deprivation test, a patient\'s urine osmolality fails to rise above plasma osmolality, and it remains unchanged after desmopressin administration. What is the most likely diagnosis?',
    stemFa:
      'در آزمون محرومیت از آب، اسمولالیته ادرار بیمار از اسمولالیته پلاسما بالا نمی‌رود و پس از تجویز دسموپرسین نیز تغییری نمی‌کند. محتمل‌ترین تشخیص چیست؟',
    options: [
      { key: 'A', en: 'Central diabetes insipidus', fa: 'دیابت بی‌مزه مرکزی' },
      { key: 'B', en: 'Nephrogenic diabetes insipidus', fa: 'دیابت بی‌مزه نفرژنیک' },
      { key: 'C', en: 'SIADH', fa: 'SIADH' },
      { key: 'D', en: 'Primary polydipsia', fa: 'پلی‌دیپسی اولیه' },
      { key: 'E', en: 'Osmotic diuresis', fa: 'دیورز اسموتیک' },
    ],
    correctAnswer: 'B',
    explanation: {
      en: 'Failure to concentrate urine after water deprivation AND after exogenous ADH (desmopressin) localizes the defect to the collecting duct receptor/response — nephrogenic DI.',
      fa: 'شکست در تغلیظ ادرار هم بعد محرومیت از آب و هم بعد از ADH برون‌زاد (دسموپرسین)، نقص را به سطح گیرنده/پاسخ مجرای جمع‌کننده ارجاع می‌دهد — دیابت بی‌مزه نفرژنیک.',
    },
    optionExplanations: {
      A: { en: 'Central DI responds to desmopressin with a marked osmolality rise.', fa: 'DI مرکزی به دسموپرسین با افزایش چشمگیر اسمولالیته پاسخ می‌دهد.' },
      B: { en: 'Correct — no response to ADH because the kidney is the problem.', fa: 'درست — پاسخی به ADH نیست چون مشکل از کلیه است.' },
      C: { en: 'SIADH is the opposite: inappropriately concentrated urine.', fa: 'SIADH برعکس است: ادرار بیش از حد تغلیظ‌شده.' },
      D: { en: 'Primary polydipsia concentrates urine normally after deprivation.', fa: 'پلی‌دیپسی اولیه بعد از محرومیت ادرار را طبیعی تغلیظ می‌کند.' },
      E: { en: 'Osmotic diuresis reflects solute load, not ADH unresponsiveness.', fa: 'دیورز اسموتیک به بار محلول مربوط است، نه بی‌پاسخی به ADH.' },
    },
    keyLearningPoints: [
      'تفکیک DI: پاسخ به دسموپرسین ← مرکزی؛ بدون پاسخ ← نفرژنیک.',
      'علل نفرژنیک: لیتیوم، هایپرکلسمی، هیپوکالمی، نقص ژنی V2.',
    ],
    clinicalPearl: 'در بیمار لیتیوم‌دار با پلی‌اوری، پیش از هر چیز DI نفرژنیک را در نظر بگیرید.',
    commonMistake: 'انتخاب DI مرکزی به‌خاطر «شایع‌تر» بودن؛ کلید سؤال، نبودِ پاسخ به دسموپرسین است.',
    examTip: 'جفت «دسموپرسین + عدم پاسخ» را در آزمون ببینید؛ بدون فکر کردن، نفرژنیک.',
    reference: { title: 'Guyton & Hall, Textbook of Medical Physiology, 14e', note: 'فصل تنظیم آب و ادرار' },
  },
];

/* موضوعات تحت پوشش هر آزمون از روی خود سؤال‌ها ساخته می‌شود (تک منبع حقیقت) */
export function subjectsForQuestions(questions) {
  const map = new Map();
  for (const question of questions) {
    map.set(question.subjectId, (map.get(question.subjectId) ?? 0) + 1);
  }
  return map;
}
