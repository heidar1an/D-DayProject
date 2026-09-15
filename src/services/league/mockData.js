/*
 * داده‌های Mock «لیگ تپش».
 * شکل هر موجودیت دقیقاً همان قرارداد API آینده است؛ کامپوننت‌ها فقط از سرویس تغذیه می‌شوند
 * تا بعداً اتصال به Backend بدون تغییر UI ممکن باشد. (مستند کامل: src/layout/dashboard/league/README.md)
 */

/* ── آواتار بازیکنان Mock — شناسهٔ دترمینیستیکی از کاتالوگ تصویری آواتار (۰۱ تا ۳۵) ── */
const AVATAR_COUNT = 35;

export function avatarForSeed(seed) {
  const rnd = (n) => {
    const x = Math.sin(seed * 9973 + n * 127.1) * 10000;
    return x - Math.floor(x);
  };

  return String(Math.floor(rnd(0) * AVATAR_COUNT) + 1).padStart(2, '0');
}

/* ── Entity: League (سطوح لیگ) — رنگ‌ها از پالت تپش اقتباس شده‌اند ── */
export const LEAGUE_TIERS = [
  { id: 'bronze',    name: 'برنزی',     min: 0,     max: 4999,   color: '#ab8e7c', icon: 'shield' },
  { id: 'silver',    name: 'نقره‌ای',   min: 5000,  max: 9999,   color: '#b9c2cc', icon: 'shield' },
  { id: 'gold',      name: 'طلایی',     min: 10000, max: 17999,  color: '#e0b45c', icon: 'shield-star' },
  { id: 'platinum',  name: 'پلاتینیوم', min: 18000, max: 26999,  color: '#9cc0e8', icon: 'shield-star' },
  { id: 'diamond',   name: 'الماسی',    min: 27000, max: 39999,  color: '#937fcd', icon: 'diamond' },
  { id: 'master',    name: 'استادی',    min: 40000, max: 59999,  color: '#77b787', icon: 'diamond' },
  { id: 'grandmaster', name: 'اسطوره',  min: 60000, max: null,   color: '#e26d6d', icon: 'crown' },
];

/* ── Entity: User (لایهٔ لیگ) — مقدار پیش‌فرض؛ با پروفایل واقعی کاربر merge می‌شود ── */
export const ME = {
  hearts: 12840,
  rank: 17,
  universityRank: 4,
  seasonRank: 3,
  globalRank: 1284,
  friendsRank: 12,
  bestRank: 8,
  streak: 12,
  longestStreak: 21,
  level: 26,
  levelStep: 500,
  tierId: 'gold',
  title: 'شکارچی سؤال',
};

/* ── Entity: Leaderboard (دانشگاه من) — کاربر بین نفرات ۱۶ تا ۱۸ تزریق می‌شود ── */
const UNI_PLAYERS = [
  { name: 'امیرمحمد کاظمی', hearts: 15420 },
  { name: 'علی صادقی', hearts: 14920 },
  { name: 'محمدحسین رضایی', hearts: 14700 },
  { name: 'سارا احمدی', hearts: 14650 },
  { name: 'زهرا موسوی', hearts: 14520 },
  { name: 'رضا کریمی', hearts: 14410 },
  { name: 'فاطمه نوری', hearts: 14300 },
  { name: 'حسین مرادی', hearts: 14180 },
  { name: 'نگین شریفی', hearts: 14020 },
  { name: 'مهدی عباسی', hearts: 13880 },
  { name: 'مریم حسینی', hearts: 13740 },
  { name: 'علی‌اصغر یوسفی', hearts: 13590 },
  { name: 'پارسا خانی', hearts: 13420 },
  { name: 'الهام رستمی', hearts: 13260 },
  { name: 'سینا جعفری', hearts: 13110 },
  { name: 'نیلوفر قاسمی', hearts: 12865 },
  { name: 'کیان سلطانی', hearts: 12700 },
  { name: 'یاسمن فرهادی', hearts: 12540 },
  { name: 'آرمان تهرانی', hearts: 12380 },
  { name: 'شقایق دهقان', hearts: 12190 },
  { name: 'بهنام اکبری', hearts: 11980 },
];

export const UNIVERSITY_PLAYERS = UNI_PLAYERS.map((player, index) => ({
  id: `uni-player-${index + 1}`,
  name: player.name,
  hearts: player.hearts,
  avatar: avatarForSeed(index + 3),
  university: 'دانشگاه علوم پزشکی قم',
}));

/* ── Entity: University + Leaderboard دانشگاه‌ها (سه معیار قابل‌جایگزین) ── */
export const UNIVERSITIES = [
  { id: 'tehran',   name: 'دانشگاه علوم پزشکی تهران',      total: 1245000, avg: 1480, active: 950 },
  { id: 'beheshti', name: 'دانشگاه علوم پزشکی شهید بهشتی',  total: 1204000, avg: 1290, active: 1010 },
  { id: 'mashhad',  name: 'دانشگاه علوم پزشکی مشهد',        total: 1196000, avg: 1502, active: 780 },
  { id: 'qom',      name: 'دانشگاه علوم پزشکی قم',          total: 1187420, avg: 1409, active: 842 },
  { id: 'isfahan',  name: 'دانشگاه علوم پزشکی اصفهان',      total: 1102000, avg: 1210, active: 705 },
  { id: 'tabriz',   name: 'دانشگاه علوم پزشکی تبریز',       total: 877300,  avg: 1180, active: 660 },
  { id: 'shiraz',   name: 'دانشگاه علوم پزشکی شیراز',       total: 812400,  avg: 1090, active: 610 },
  { id: 'kerman',   name: 'دانشگاه علوم پزشکی کرمان',       total: 601800,  avg: 920,   active: 470 },
];

/* ── Entity: Leaderboard (کل تپش) ── */
export const GLOBAL_TOP = [
  { id: 'g1', name: 'سارا محمدی', hearts: 96400, university: 'دانشگاه علوم پزشکی تهران' },
  { id: 'g2', name: 'آرش نیک‌پور', hearts: 91850, university: 'دانشگاه علوم پزشکی مشهد' },
  { id: 'g3', name: 'نگار صالحی', hearts: 88300, university: 'دانشگاه علوم پزشکی شیراز' },
];

/* پنجره‌ای حول کاربر — در نسخهٔ واقعی با cursor از سرور می‌آید */
export const GLOBAL_WINDOW = Array.from({ length: 24 }, (_, index) => {
  const rank = 1279 + index;
  const hearts = rank === 1284 ? 12840 : 12840 + (1284 - rank) * 35 + 55;
  return {
    id: `g-${rank}`,
    name: rank === 1284 ? 'کاربر تپش' : `کاربر تپش #${rank}`,
    hearts,
    university: rank === 1284 ? 'دانشگاه علوم پزشکی قم' : '—',
    isYou: rank === 1284,
    seed: rank,
  };
});

/* ── Entity: Season ── */
const SEASON_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const SEASON_LEFT_MS = ((12 * 24 + 8) * 60 + 32) * 60 * 1000;

export const SEASON = {
  id: 1,
  name: 'شروع بزرگ',
  number: 1,
  durationDays: 30,
  endsAt: Date.now() + SEASON_LEFT_MS,
  startedAt: Date.now() + SEASON_LEFT_MS - SEASON_DURATION_MS,
  rewards: ['نشان فصل طلایی', 'قاب پروفایل «شعله»', '+۵۰۰ قلب برای ۳ نفر برتر'],
};

export const PAST_SEASONS = [
  {
    id: 0,
    name: 'زمزمهٔ آغاز',
    number: 0,
    rank: 41,
    scope: 'دانشگاه',
    heartsEarned: 8320,
    tier: 'نقره‌ای',
    badgeColor: '#b9c2cc',
  },
];

/* ── Entity: Event (رویدادهای زنده) ── */
export const LIVE_EVENTS = [
  { id: 'e1', title: 'هفتهٔ فیزیولوژی', note: 'چالش‌های دوبرابر قلب در درس فیزیولوژی', leftLabel: '۵ روز باقی‌مانده', accent: '#77b787', status: 'live' },
  { id: 'e2', title: 'چالش کشوری علوم پایه', note: 'رقابت بین‌دانشگاهی با ۱۲ شرکت', leftLabel: '۲ روز باقی‌مانده', accent: '#5b8cc7', status: 'live' },
  { id: 'e3', title: 'نبرد دانشگاه‌ها', note: 'قم در برابر تهران، ۵۰ سؤال گروهی', leftLabel: 'فردا شروع می‌شود', accent: '#937fcd', status: 'upcoming' },
];

/* ── Entity: Challenge (روزانه) — rewardها در نسخهٔ واقعی از پنل Admin می‌آیند ── */
export const DAILY_CHALLENGES = [
  { id: 'd1', title: '۲۰ سؤال حل کن', note: 'از هر درسی که دوست داری', progress: 12, goal: 20, reward: 100, icon: 'target' },
  { id: 'd2', title: '۳۰ دقیقه مطالعه کن', note: 'زمان واقعی مطالعه حساب می‌شود', progress: 18, goal: 30, reward: 50, icon: 'book' },
  { id: 'd3', title: 'استریک امروز را نگه دار', note: 'یک فعالیت آموزشی کافی است', progress: 1, goal: 1, reward: 75, icon: 'flame' },
  { id: 'd4', title: 'یک مبحث را تمام کن', note: 'هر مبحثی از هر درس', progress: 0, goal: 1, reward: 80, icon: 'brain' },
];

export const WEEKLY_CHALLENGE = {
  id: 'w1',
  title: 'سلطان فیزیولوژی',
  note: '۱۵۰ سؤال فیزیولوژی حل کن و نشان هفته را بگیر',
  progress: 93,
  goal: 150,
  reward: 500,
  achievement: 'نشان «سلطان فیزیولوژی»',
};

/* ── Entity: Challenge (رقابتی) ── */
export const BATTLES = [
  {
    id: 'b1',
    title: 'نبرد فیزیولوژی',
    type: 'individual',
    questions: 50,
    participants: 128,
    endsLabel: '۶ ساعت باقی‌مانده',
    reward: 300,
    joined: false,
    podium: [
      { name: 'آرمان تهرانی', score: 480 },
      { name: 'امیرمحمد کاظمی', score: 455 },
      { name: 'رضا کریمی', score: 431 },
    ],
  },
  {
    id: 'b2',
    title: 'قم در برابر تهران',
    type: 'university',
    questions: 50,
    participants: 214,
    endsLabel: 'امشب ۲۱:۰۰ شروع می‌شود',
    reward: 400,
    joined: false,
    podium: null,
  },
];

/* ── Entity: Duel (پروتوتایپ) ── */
export const DUEL = {
  opponent: { name: 'امیرمحمد کاظمی', avatar: avatarForSeed(3) },
  questions: 50,
  stake: 500,
  winnerReward: 500,
  loserReward: 100,
  isPrototype: true,
};

/* ── Entity: Achievement / UserAchievement ── */
export const ACHIEVEMENTS = [
  { id: 'a1', icon: 'flame', title: 'شعلهٔ ۷ روزه', category: 'consistency', rarity: 'rare', unlocked: true, unlockedAt: '۵ روز پیش', description: '۷ روز پیوسته حداقل یک فعالیت آموزشی داشتی.' },
  { id: 'a2', icon: 'target', title: 'تک‌تیرانداز', category: 'knowledge', rarity: 'common', unlocked: true, unlockedAt: '۱۲ روز پیش', description: 'یک آزمون را بدون حتی یک پاسخ غلط تمام کردی.' },
  { id: 'a3', icon: 'book', title: 'شکارچی سؤال', category: 'study', rarity: 'rare', unlocked: true, unlockedAt: '۳ هفته پیش', description: '۵۰۰ سؤال حل کردی؛ فقط شروع ماجراست.' },
  { id: 'a4', icon: 'star', title: 'جمع ده‌تایی‌ها', category: 'competition', rarity: 'epic', unlocked: true, unlockedAt: 'فصل گذشته', description: 'به جمع ۱۰ نفر برتر دانشگاه رسیدی.' },
  { id: 'a5', icon: 'brain', title: 'استاد فیزیولوژی', category: 'knowledge', rarity: 'epic', unlocked: false, progress: 3, goal: 4, progressNote: '۳ از ۴ چالش فیزیولوژی', description: 'تمام چالش‌های فیزیولوژی را تکمیل کن.' },
  { id: 'a6', icon: 'spark', title: 'یادگیرندهٔ برق‌آسا', category: 'study', rarity: 'rare', unlocked: false, progress: 68, goal: 100, progressNote: '۶۸ از ۱۰۰ سرعت یادگیری', description: 'یک فصل را با عملکرد عالی تمام کن.' },
  { id: 'a7', icon: 'clock', title: 'جغد شب', category: 'special', rarity: 'common', unlocked: false, progress: 10, goal: 15, progressNote: '۱۰ از ۱۵ جلسهٔ شبانه', description: '۱۵ جلسهٔ مطالعهٔ بعد از نیمه‌شب داشته باش.' },
  { id: 'a8', icon: 'crown', title: 'پادشاه تداوم', category: 'consistency', rarity: 'legendary', unlocked: false, progress: 21, goal: 30, progressNote: '۲۱ از ۳۰ روز پیوسته', description: 'به استریک ۳۰ روزه برس.' },
  { id: 'a9', icon: 'trophy', title: 'قهرمان لیگ', category: 'competition', rarity: 'legendary', unlocked: false, progress: 0, goal: 1, progressNote: 'هنوز شروع نشده', description: 'یک فصل را با رتبهٔ ۱ تمام کن.' },
  { id: 'a10', icon: 'compass', title: 'کاوشگر تپش', category: 'exploration', rarity: 'common', unlocked: false, progress: 6, goal: 10, progressNote: '۶ از ۱۰ بخش سایت', description: 'همهٔ بخش‌های مختلف تپش را امتحان کن.' },
  { id: 'a11', icon: 'users', title: 'همیار', category: 'social', rarity: 'rare', unlocked: false, progress: 4, goal: 10, progressNote: '۴ از ۱۰ پاسخ مفید', description: 'به ۱۰ هم‌دانشگاهی در بخش‌های مجاز کمک کن.' },
  { id: 'a12', icon: 'diamond', title: 'قلب تپنده', category: 'special', rarity: 'epic', unlocked: false, progress: 12840, goal: 18000, progressNote: '۱۲٬۸۴۰ از ۱۸٬۰۰۰ قلب', description: 'به لیگ پلاتینیوم صعود کن.' },
];

export const ACHIEVEMENT_CATEGORIES = [
  { id: 'all', label: 'همه' },
  { id: 'study', label: 'مطالعه' },
  { id: 'consistency', label: 'تداوم' },
  { id: 'competition', label: 'رقابت' },
  { id: 'knowledge', label: 'دانش' },
  { id: 'exploration', label: 'کاوش' },
  { id: 'social', label: 'اجتماعی' },
  { id: 'special', label: 'ویژه' },
];

export const RARITY = {
  common: { label: 'معمولی', color: '#b9c2cc' },
  rare: { label: 'کمیاب', color: '#5b8cc7' },
  epic: { label: 'حماسی', color: '#937fcd' },
  legendary: { label: 'افسانه‌ای', color: '#e0b45c' },
};

/* ── Entity: Title ── */
export const TITLES = [
  { id: 't1', label: 'شکارچی سؤال', owned: true },
  { id: 't2', label: 'جنگاور ۷ روزه', owned: true },
  { id: 't3', label: 'تک‌تیرانداز', owned: true },
  { id: 't4', label: 'نایب‌قهرمان دانشگاه', owned: true },
  { id: 't5', label: 'قهرمان لیگ', owned: false },
  { id: 't6', label: 'جغد شب', owned: false },
];

/* ── Entity: Reward ── */
export const REWARDS = [
  { id: 'r1', kind: 'badge', label: 'نشان فصل طلایی', note: 'پایان فصل ۱ در جمع ۳ نفر برتر', color: '#e0b45c', owned: false },
  { id: 'r2', kind: 'frame', label: 'قاب پروفایل «شعله»', note: 'ریوارد استریک ۲۱ روزه', color: '#e26d6d', owned: true },
  { id: 'r3', kind: 'avatar', label: 'آواتار ویژهٔ «قلب تپنده»', note: 'ریوارد دستاورد حماسی', color: '#937fcd', owned: true },
  { id: 'r4', kind: 'access', label: 'چالش‌های ویژهٔ پلاتینیوم', note: 'با صعود به لیگ پلاتینیوم', color: '#9cc0e8', owned: false },
];

/* ── Entity: HeartTransaction — هر قلب قابل ردیابی است (پایهٔ Anti-Cheat و Analytics) ── */
export const HEART_LEDGER = [
  { id: 'h1', amount: 50, source: 'چالش روزانه: مطالعهٔ ۳۰ دقیقه', date: 'امروز' },
  { id: 'h2', amount: 28, source: 'آزمون تشریح — ۱۴ پاسخ صحیح', date: 'دیروز' },
  { id: 'h3', amount: 20, source: 'تکمیل مبحث آناتومی', date: 'دیروز' },
  { id: 'h4', amount: 75, source: 'حفظ استریک روزانه', date: '۲ روز پیش' },
  { id: 'h5', amount: 100, source: 'دستاورد: شعلهٔ ۷ روزه', date: '۵ روز پیش' },
  { id: 'h6', amount: 300, source: 'نبرد فیزیولوژی — رتبهٔ ۷', date: 'هفتهٔ پیش' },
];

/* ── Entity: Streak (تقویم فعالیت؛ ۳۵ روز اخیر، از قدیم به جدید) ── */
export const STREAK_HISTORY = [
  1, 1, 1, 0, 1, 1, 0,
  1, 1, 1, 1, 1, 1, 1,
  1, 1, 0, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1,
];

/* ── Entity: Notification ── */
export const LEAGUE_NOTIFICATIONS = [
  { id: 'n1', icon: 'warn', text: 'نیلوفر قاسمی فقط ۲۵ قلب با تو فاصله دارد!', time: '۱۰ دقیقه پیش', unread: true },
  { id: 'n2', icon: 'up', text: 'وارد جمع ۲۰ نفر برتر دانشگاه شدی؛ آفرین!', time: '۲ ساعت پیش', unread: true },
  { id: 'n3', icon: 'swords', text: 'نبرد فیزیولوژی ۶ ساعت دیگر تمام می‌شود.', time: '۴ ساعت پیش', unread: true },
  { id: 'n4', icon: 'trophy', text: 'دستاورد جدید: تک‌تیرانداز', time: 'دیروز', unread: false },
  { id: 'n5', icon: 'heart', text: 'فقط ۵٬۱۶۰ قلب تا لیگ پلاتینیوم!', time: '۲ روز پیش', unread: false },
];

/* ── Activity Feed (Privacy-aware: فقط فعالیت‌های عمومی کاربران) ── */
export const ACTIVITY_FEED = [
  { id: 'f1', text: 'امیرمحمد دستاورد «شعلهٔ ۷ روزه» را باز کرد', time: '۱ ساعت پیش', accent: '#e26d6d' },
  { id: 'f2', text: 'سارا احمدی به استریک ۳۰ روزه رسید', time: '۳ ساعت پیش', accent: '#77b787' },
  { id: 'f3', text: 'دانشگاه قم به رتبهٔ ۳ فصل رسید', time: 'دیروز', accent: '#937fcd' },
];

/* ── Entity: Friend (همخوان‌ها) — دوستانِ کاربر در لایهٔ لیگ ──
   سه همخوانِ اول با PeersSection داشبورد هم‌شناسه‌اند تا بعداً از یک منبع تغذیه شوند. */
export const FRIENDS = [
  { id: 'alireza',  name: 'علیرضا محمدی', username: 'alireza_m', hearts: 9120,  streak: 8,  tierId: 'silver',   avatar: avatarForSeed(41) },
  { id: 'leila',    name: 'لیلا کریمی',   username: 'leila_k',   hearts: 13420, streak: 21, tierId: 'gold',     avatar: avatarForSeed(42) },
  { id: 'mohammad', name: 'محمد رضایی',   username: 'mohammad_r',hearts: 5680,  streak: 3,  tierId: 'bronze',   avatar: avatarForSeed(43) },
  { id: 'sahar',    name: 'سحر نیک‌نام',  username: 'sahar_n',   hearts: 18340, streak: 30, tierId: 'platinum', avatar: avatarForSeed(44) },
  { id: 'kian',     name: 'کیان سلطانی',  username: 'kian_s',    hearts: 12700, streak: 12, tierId: 'gold',     avatar: avatarForSeed(45) },
];

/* ── Entity: FriendNotification — فعالیت، نتیجه و دستاوردِ «فقط دوستان» ──
   همین داده‌ای است که با کلیک روی آیکون چتِ کادر پروفایل داشبورد باز می‌شود.
   kind:
     action       → اقدامات: چالش، تست، مطالعه، پیوستن به نبرد
     result       → نتایج: رتبه، سکو، امتیاز نبرد، تغییر جایگاه
     achievement  → دستاوردهای باز‌شده (با rarity)
   ترتیب آرایه = جدید به قدیم. در نسخهٔ واقعی سرور فقط رویدادهای دوستانی را برمی‌گرداند
   که تنظیم حریم خصوصی‌شان اجازهٔ نمایش عمومی به دوستان را داده باشد. */
export const FRIENDS_LEAGUE_NOTIFICATIONS = [
  { id: 'fn1',  friendId: 'sahar',    kind: 'achievement', icon: 'crown',  text: 'دستاورد «پادشاه تداوم» را باز کرد', note: 'استریک ۳۰ روزهٔ پیوسته', rarity: 'legendary', hearts: 500, time: '۱۲ دقیقه پیش', unread: true },
  { id: 'fn2',  friendId: 'leila',    kind: 'action',      icon: 'target', text: 'چالش روزانهٔ «۲۰ سؤال حل کن» را تمام کرد', note: 'فیزیولوژی — ۲۰ از ۲۰', hearts: 100, time: '۲۵ دقیقه پیش', unread: true },
  { id: 'fn3',  friendId: 'kian',     kind: 'result',      icon: 'swords', text: 'در نبرد فیزیولوژی به رتبهٔ ۲ رسید', note: '۴۵۵ امتیاز از ۵۰۰', hearts: 300, time: '۱ ساعت پیش', unread: true },
  { id: 'fn4',  friendId: 'mohammad', kind: 'action',      icon: 'clock',  text: '۳۰ دقیقه مطالعهٔ متمرکز ثبت کرد', note: 'با تایمر پومودورو', hearts: 50, time: '۲ ساعت پیش', unread: true },
  { id: 'fn5',  friendId: 'alireza',  kind: 'achievement', icon: 'book',   text: 'دستاورد «شکارچی سؤال» را باز کرد', note: '۵۰۰ سؤال حل‌شده', rarity: 'rare', hearts: 100, time: '۳ ساعت پیش', unread: false },
  { id: 'fn6',  friendId: 'sahar',    kind: 'result',      icon: 'up',     text: 'به رتبهٔ ۹ دانشگاه رسید', note: '۷ پله صعود در یک روز', time: '۵ ساعت پیش', unread: false },
  { id: 'fn7',  friendId: 'leila',    kind: 'action',      icon: 'brain',  text: 'فصل «کاردیو» را با میانگین ۹۰٪ تمام کرد', note: 'میکرو درسنامه + تست', hearts: 80, time: '۷ ساعت پیش', unread: false },
  { id: 'fn8',  friendId: 'sahar',    kind: 'result',      icon: 'trophy', text: 'بهترین امتیاز هفتهٔ آزمون «آناتومی اندام‌ها» را گرفت', note: '۹۶ از ۱۰۰', hearts: 200, time: 'دیروز', unread: false },
  { id: 'fn9',  friendId: 'kian',     kind: 'achievement', icon: 'star',   text: 'دستاورد «تک‌تیرانداز» را باز کرد', note: 'آزمون بدون حتی یک پاسخ غلط', rarity: 'epic', time: 'دیروز', unread: false },
  { id: 'fn10', friendId: 'alireza',  kind: 'action',      icon: 'swords', text: 'به نبرد «قم در برابر تهران» پیوست', note: 'تو هم می‌تونی شرکت کنی', time: '۲ روز پیش', unread: false },
];
