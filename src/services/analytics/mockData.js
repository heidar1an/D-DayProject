/*
 * دادهٔ Mock «تحلیل عملکرد» — تاریخچهٔ Attempt واقعی‌نما برای پروتوتایپ.
 *
 * اصل جدایی داده: سؤال‌ها از بانک واقعی تپش (testBank/mockData) می‌آیند و اینجا
 * **دوباره‌سازی نمی‌شوند**؛ این فایل فقط «تاریخچهٔ حل‌کردن» یک کاربر نمونه را
 * می‌سازد: سشن‌های تمرینی و آزمونی در ۱۲ هفتهٔ اخیر با دقت/زمان/اطمینان/نوع خطای
 * هم‌بسته با شخصیت کاربر، تا همهٔ تحلیل‌های موتور واقعاً معنی‌دار باشند.
 *
 * شخصیت کاربر نمونه (Persona): دانشجوی علوم پایه با پایهٔ قوی فیزیولوژی،
 * متوسط آناتومی و ضعف در متابولیسم بیوشیمی؛ روند کلی صعودی با یک هفتهٔ افت
 * (هفتهٔ آزمون‌های ترم)، افت دقت در ساعات پایانی شب، و چند مفهوم‌سازی خطرناک
 * در بیوشیمی (مطمئن اما غلط).
 *
 * خروجی Deterministic است: seed از userId می‌آید و برای هر کاربر در
 * localStorage کش می‌شود تا بین رفرش‌ها ثابت بماند (رفتار یک Backend واقعی).
 */

import { QUESTIONS } from '../testBank/mockData';

const DAY_MS = 86400000;
const HISTORY_DAYS = 84; // ۱۲ هفته

/* ────────────────────────── RNG قطعی (mulberry32) ────────────────────────── */

function hashSeed(input) {
  let hash = 2166136261;
  const text = String(input ?? 'guest');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (random, array) => array[Math.floor(random() * array.length)];

/* توزیع لگ‌نرمال ملایم برای زمان‌ها — بدون کیفیت‌های تصادفیِ بی‌منطق */
function lognormal(random, sigma = 0.32) {
  const u1 = Math.max(random(), 1e-9);
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.exp(z * sigma);
}

const clamp01 = (value) => Math.min(0.97, Math.max(0.05, value));

/* ────────────────────────── شخصیت کاربر ────────────────────────── */

/* توانایی پایه در هر درس — برای مستندسازی Persona (ملاک عملی، TOPIC_ABILITY است) */

/* تنظیم دقیق در سطح مبحث — نقاط قوت و ضعف داستان این Persona */
const TOPIC_ABILITY = {
  'قلب و عروق': 0.94,
  'عصب': 0.88,
  'تنفس': 0.88,
  'خون': 0.89,
  'کلیه': 0.76,
  'غدد درون‌ریز': 0.8,
  'گوارش': 0.82,
  'عضله': 0.82,
  'اندام فوقانی': 0.68,
  'قلب و توراکس': 0.76,
  'نوروآناتومی': 0.8,
  'اندام تحتانی': 0.72,
  'سر و گردن': 0.72,
  'شکم و لگن': 0.76,
  'آنزیم‌ها': 0.8,
  'متابولیسم کربوهیدرات': 0.66,
  'متابولیسم لیپید': 0.64,
  'بیوشیمی مولکولی': 0.76,
  'ویتامین‌ها': 0.8,
  'تعادل اسید-باز': 0.72,
  'چرخهٔ اوره': 0.74,
};

/* مبحث‌هایی که Persona در آن‌ها «مطمئن اما غلط» می‌شود (مفهوم‌سازی خطرناک) */
const OVERCONFIDENT_TOPICS = new Set(['متابولیسم کربوهیدرات', 'متابولیسم لیپید', 'تعادل اسید-باز']);

/* سرعت پاسخ نسبی هر درس (۱ = سرعتی متعارف) */
const SUBJECT_SPEED = { physiology: 0.95, anatomy: 1.08, biochemistry: 1.12 };

const DIFFICULTY_PROB_SHIFT = { easy: 0.09, medium: 0, hard: -0.11, very_hard: -0.2 };
const DIFFICULTY_BASE_TIME = { easy: 24, medium: 40, hard: 62, very_hard: 84 };

/* ────────────────────────── توانایی لحظه‌ای ────────────────────────── */

/*
 * توانایی مبحث در روز n از ۸۴ روز: رشد کلی + افت هفتهٔ میانی (هفتهٔ آزمون ترم)
 * + افت بازهٔ ساعتی پایانی شب.
 */
function abilityOn(topic, dayIndex, hour, random) {
  const topicAbility = TOPIC_ABILITY[topic] ?? 0.7;
  const growth = 0.9 + 0.2 * (dayIndex / (HISTORY_DAYS - 1)); // رشد ۹۰٪ → ۱۱۰٪
  const midtermDip = dayIndex >= 28 && dayIndex <= 36 ? 0.93 : 1; // هفتهٔ پرفشار ترم
  const eveningDip = hour >= 17 ? 0.88 : 1; // تست‌های پایانی روز
  const wobble = 0.94 + random() * 0.12; // نوسان روزانهٔ طبیعی
  return clamp01(topicAbility * growth * midtermDip * eveningDip * wobble);
}

/* ────────────────────────── ساخت سشن‌ها ────────────────────────── */

function sessionPlan(random) {
  const sessions = [];
  let dayCursor = HISTORY_DAYS - 2; // از دیروز به عقب می‌رویم
  let index = 0;

  /* آزمون‌های رسمی — نقاط زمانی ثابت داستان */
  const exams = [
    { day: 74, count: 25, duration: 50, title: 'آزمون جامع هماهنگ علوم پایه تپش', subtitle: 'دورهٔ اول — ارزیابی پایه', kind: 'coordinated', rank: true },
    { day: 63, count: 20, duration: 40, title: 'آزمونک هفتگی تپش', subtitle: 'هفتهٔ ۸ — فیزیولوژی و بیوشیمی', kind: 'weekly' },
    { day: 52, count: 25, duration: 50, title: 'آزمون علوم پایه وزارت بهداشت — ۱۴۰۲', subtitle: 'نوبت دوم · نمرهٔ منفی ۳/۱', kind: 'official', official: true },
    { day: 41, count: 20, duration: 40, title: 'آزمون موضوعی بیوشیمی — متابولیسم', subtitle: 'تمرکز: کربوهیدرات و لیپید', kind: 'topic' },
    { day: 30, count: 25, duration: 45, title: 'آزمون آزمایشی علوم پایه — مرداد', subtitle: 'شبیه‌ساز آزمون اصلی', kind: 'mock', timedOut: true },
    { day: 16, count: 30, duration: 60, title: 'آزمون جامع اول ترم — آبان', subtitle: 'پوشش کامل سه درس', kind: 'comprehensive', rank: true },
    { day: 5, count: 20, duration: 40, title: 'آزمونک هفتگی تپش', subtitle: 'هفتهٔ ۲ — مرور عمومی', kind: 'weekly' },
  ];
  for (const exam of exams) {
    sessions.push({ ...exam, mode: 'exam' });
  }

  /* تمرین‌ها — هر ۲ تا ۳ روز، با فواصلی که روزهای خالی هم در نمودار دیده شوند */
  const practiceTitles = [
    { title: 'تمرین درسی فیزیولوژی', subject: 'physiology' },
    { title: 'تمرین مبحثی — قلب و عروق', subject: 'physiology', topics: ['قلب و عروق'] },
    { title: 'تمرین درسی بیوشیمی', subject: 'biochemistry' },
    { title: 'تمرین درسی آناتومی', subject: 'anatomy' },
    { title: 'مرور اشتباه‌ها', mistakes: true },
    { title: 'تمرین اختلاطی روزانه', mixed: true },
    { title: 'تمرین مبحثی — متابولیسم', subject: 'biochemistry', topics: ['متابولیسم کربوهیدرات', 'متابولیسم لیپید', 'چرخهٔ اوره'] },
    { title: 'تمرین مبحثی — اندام فوقانی', subject: 'anatomy', topics: ['اندام فوقانی'] },
    { title: 'تمرین مبحثی — عصب و نوروآناتومی', subject: 'physiology', topics: ['عصب'], mixedWith: ['anatomy|نوروآناتومی'] },
    { title: 'تمرین سطح سخت', hard: true },
  ];

  while (dayCursor > 0) {
    const plan = practiceTitles[index % practiceTitles.length];
    index += 1;
    sessions.push({
      day: dayCursor,
      mode: 'practice',
      count: 8 + Math.floor(random() * 7), // ۸ تا ۱۴ سؤال
      ...plan,
    });
    dayCursor -= 2 + Math.floor(random() * 2); // فاصلهٔ ۲-۳ روزه (با گپ)
  }
  return sessions;
}

/* انتخاب سؤال‌های یک سشن بر اساس طرح سشن */
function selectQuestions(random, plan) {
  const pool = QUESTIONS.filter((question) => {
    if (plan.mixed || plan.mistakes) return true;
    if (plan.topics && !plan.mixedWith) return plan.topics.includes(question.topicPath[0]);
    if (plan.mixedWith && plan.topics) {
      return plan.topics.includes(question.topicPath[0]) || plan.mixedWith.some((pair) => question.subject === pair.split('|')[0] && question.topicPath[0] === pair.split('|')[1]);
    }
    if (plan.subject) return question.subject === plan.subject;
    return true;
  });
  const source = plan.hard ? pool.filter((question) => question.difficulty === 'hard') : pool;
  const base = source.length ? source : pool;
  const shuffled = [...base];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  /* تا رسیدن به طرحِ تعداد، دور می‌زنیم؛ اگر استخر کوچک‌تر بود سؤال بازحل می‌شود */
  const need = Math.min(plan.count ?? 10, 30);
  const selected = [];
  while (selected.length < need) {
    for (const question of shuffled) {
      if (selected.length >= need) break;
      selected.push(question);
    }
  }
  return selected;
}

/* ────────────────────────── ساخت یک Attempt ────────────────────────── */

function buildAttempt(random, { session, question, order, total, timestamp, hour, dayIndex }) {
  const topic = question.topicPath[0];
  const ability = abilityOn(topic, dayIndex, hour, random);
  const isExam = session.mode === 'exam';
  const progress = total > 1 ? order / (total - 1) : 0; // جایگاه سؤال در سشن
  /* فشار روانی آزمون: افت ملایم دقت در شرایط آزمون — داستان Persona */
  const examPressure = isExam ? (session.examKind === 'official' || session.examKind === 'coordinated' ? -0.14 : -0.11) : 0;

  /* بی‌پاسخ: در آزمون‌های زمان‌فشرده انتهای سشن؛ در تمرین نادر */
  let unanswered = false;
  if (isExam) {
    const pressure = session.timedOut ? 0.4 : 0.07;
    if (progress > 0.72 && random() < pressure) unanswered = true;
  } else if (random() < 0.015) {
    unanswered = true;
  }

  const probCorrect = clamp01(ability + (DIFFICULTY_PROB_SHIFT[question.difficulty] ?? 0) + examPressure);
  const correct = !unanswered && random() < probCorrect;

  /* زمان: پایهٔ سختی × سرعت درس × نویز؛ تندیِ بی‌دقت و کندیِ انتهای آزمون */
  const baseTime = question.stats?.avgTimeSec ?? DIFFICULTY_BASE_TIME[question.difficulty] ?? 40;
  let timeSpent = Math.round(
    baseTime * (SUBJECT_SPEED[question.subject] ?? 1) * lognormal(random) * (isExam ? 1 + 0.12 * progress : 1),
  );
  const carelessRush = !unanswered && !correct && random() < 0.22;
  if (carelessRush) timeSpent = Math.max(4, Math.round(timeSpent * (0.12 + random() * 0.25)));
  if (unanswered) timeSpent = random() < 0.5 ? 0 : Math.max(1, Math.round(timeSpent * 0.15));
  timeSpent = Math.min(240, timeSpent);

  /* اطمینان: هم‌بسته با توانایی و صحت؛ مبحث‌های «مطمئن اما غلط» Persona */
  let confidence = null;
  if (!unanswered && random() > 0.14) {
    const overconfident = OVERCONFIDENT_TOPICS.has(topic);
    const pHigh = correct
      ? 0.5 + 0.35 * ability
      : overconfident
        ? 0.62
        : 0.16 + 0.2 * ability;
    confidence = random() < pHigh ? 'high' : random() < 0.55 ? 'medium' : 'low';
  }

  /* نوع خطا — فقط برای غلط‌ها؛ ~۱۸٪ ثبت نمی‌شود تا حالت «احتمالاً نیازمند بررسی» واقعی باشد */
  let errorType = null;
  if (!unanswered && !correct && random() > 0.18) {
    const weights = [
      ['KNOWLEDGE_GAP', 0.26],
      ['CONCEPTUAL_ERROR', 0.18],
      ['CARELESS_MISTAKE', timeSpent < 12 ? 0.34 : 0.08],
      ['MISREADING', 0.07],
      ['TIME_PRESSURE', isExam && progress > 0.6 ? 0.16 : 0.02],
      ['CALCULATION_ERROR', question.type === 'calculation' ? 0.3 : 0.02],
      ['MEMORY_FAILURE', 0.09],
      ['UNCERTAIN_GUESS', confidence === 'low' ? 0.3 : 0.04],
    ];
    const totalWeight = sumWeights(weights);
    let roll = random() * totalWeight;
    for (const [type, weight] of weights) {
      roll -= weight;
      if (roll <= 0) {
        errorType = type;
        break;
      }
    }
  }

  /* گزینهٔ انتخابی: غلطِ «قریب‌به‌صحیح» طبیعی‌تر است — گزینهٔ نادرست تصادفی */
  const wrongOptions = question.options.map((_, index) => index).filter((index) => index !== question.correctAnswer);
  return {
    id: `at-${session.id}-${question.id}-${order}`,
    questionId: question.id,
    sessionId: session.id,
    examId: isExam ? session.id : null,
    mode: session.mode,
    selected: unanswered ? null : correct ? question.correctAnswer : pick(random, wrongOptions),
    correct: unanswered ? null : correct,
    timeSpent,
    confidence,
    errorType,
    skipped: unanswered && random() < 0.35,
    timestamp,
  };
}

const sumWeights = (weights) => weights.reduce((total, [, weight]) => total + weight, 0);

/* ────────────────────────── ورودی اصلی ────────────────────────── */

/*
 * generateMockHistory(userId) → { sessions, attempts, generatedAt }
 * سشن‌ها شامل متادیتای آزمون (rank/percentile/duration) هستند و attempts خام‌اند؛
 * تغذیهٔ متادیتای سؤال (درس/مبحث/سختی) در سرویس انجام می‌شود.
 */
export function generateMockHistory(userId) {
  const random = mulberry32(hashSeed(userId));
  const now = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 0);

  const plans = sessionPlan(random);
  const sessions = [];
  const attempts = [];

  for (const plan of plans) {
    const dayIndex = HISTORY_DAYS - 1 - plan.day;
    const hour = pick(random, plan.mode === 'exam' ? [9, 10, 11, 15, 16] : [10, 14, 16, 19, 20, 21, 22]);
    const startedAt = endOfToday.getTime() - plan.day * DAY_MS - (23 - hour) * 3600000 - Math.floor(random() * 50) * 60000;
    const questions = selectQuestions(random, plan);
    if (!questions.length) continue;

    const durationMinutes = plan.mode === 'exam' ? plan.duration : null;
    const session = {
      id: `an-${plan.mode === 'exam' ? 'ex' : 'pr'}-${dayIndex}-${Math.floor(random() * 1e6).toString(36)}`,
      mode: plan.mode,
      title: plan.title,
      subtitle: plan.subtitle ?? '',
      startedAt,
      submittedAt: startedAt + Math.round(questions.reduce((total, question) => total + (question.stats?.avgTimeSec ?? 40) * (plan.mode === 'exam' ? 0.95 : 1.1), 0) * 1000),
      durationMinutes,
      status: 'submitted',
      negativeMarking: plan.official ? -0.25 : plan.mode === 'exam' ? 0 : 0,
      examKind: plan.kind ?? (plan.mode === 'exam' ? 'personal' : null),
      timedOut: Boolean(plan.timedOut),
      rank: null,
      percentile: null,
      source: 'mock',
    };

    const total = questions.length;
    const secondsPerQuestion = (session.submittedAt - session.startedAt) / total / 1000;
    const sessionAttempts = questions.map((question, order) =>
      buildAttempt(random, {
        session,
        question,
        order,
        total,
        timestamp: startedAt + Math.round((order + 0.5) * secondsPerQuestion) * 1000,
        hour,
        dayIndex,
      }),
    );

    /* رتبه/صدک آزمون — هم‌بسته با دقت واقعی همان آزمون */
    if (plan.mode === 'exam') {
      const answered = sessionAttempts.filter((attempt) => attempt.correct !== null);
      const sessionAccuracy = answered.length
        ? answered.filter((attempt) => attempt.correct).length / answered.length
        : 0.5;
      session.percentile = Math.round(Math.min(99, Math.max(8, sessionAccuracy * 100 + (random() * 16 - 8))));
      if (plan.rank) {
        const cohort = 80 + Math.floor(random() * 160);
        session.rank = Math.max(1, Math.round(cohort * (1 - session.percentile / 100)));
        session.cohort = cohort;
      }
    }

    sessions.push(session);
    attempts.push(...sessionAttempts);
  }

  sessions.sort((a, b) => a.startedAt - b.startedAt);
  attempts.sort((a, b) => a.timestamp - b.timestamp);
  return { sessions, attempts, generatedAt: now };
}
