/*
 * پل ماژول «برنامه‌ریزی و مدیریت» به مخازن و بخش‌های واقعی پروژه.
 *
 * هیچ دادهٔ ساختگی این‌جا نیست. هر سه چیز از منبع رسمی خودِ پروژه می‌آید:
 *
 *   ۱) کاربران → `GET /api/admin/users` (همان سرویس پنل، همان نشست و مجوز)
 *   ۲) واحدها و پروژه‌ها → `services/products/productsService.js`؛ یعنی همان
 *      فهرست رسمی محصولات تپش که صفحهٔ عمومی و پنل هر دو از آن می‌خوانند.
 *      «واحد سازمانی» ردهٔ واقعی هر محصول است (`eyebrow`) و «پروژه» خودِ محصول.
 *   ۳) تعطیلات رسمی → تاریخ‌های ثابت شمسی تقویم رسمی کشور.
 *
 * چرا واحد از ردهٔ محصول ساخته می‌شود: پروژه هیچ جدول «واحد سازمانی» ندارد و
 * ساختن یک فهرست دستی، دادهٔ ساختگی می‌سازد. ردهٔ محصول اما واقعی است، در کد
 * پروژه تعریف شده و همان چیزی است که کاربر در سایت می‌بیند.
 */

import { users as adminUsersApi } from '../admin/adminService';
import { getProducts } from '../products/productsService';
import { jalaliToIso } from './jalali';

/* ───────────────────────────── پروژه و واحد ─────────────────────────────
 * هر دو از یک منبع ساخته می‌شوند تا هرگز از هم جدا نیفتند.
 */

/* کلید رنگ محصول (واقعی) → تُن پالت ماژول برنامه‌ریزی */
const ACCENT_TONE = {
  green: 'green',
  purple: 'accent',
  blue: 'blue',
  gold: 'gold',
  copper: 'copper',
  red: 'danger',
  orange: 'gold',
};

const toneFor = (accent) => ACCENT_TONE[accent] ?? 'muted';

/*
 * واحد سازمانی = ردهٔ واقعی محصولات (`eyebrow`).
 *
 * شناسهٔ واحد از شناسهٔ نخستین محصول همان رده ساخته می‌شود تا پایدار بماند و
 * با جابه‌جایی ترتیب محصولات عوض نشود.
 */
export function unitsFromProducts() {
  const units = [];
  const byLabel = new Map();

  getProducts().forEach((product) => {
    const label = String(product.eyebrow ?? '').trim();
    if (!label || !product.id) return;

    if (!byLabel.has(label)) {
      const unit = {
        id: `u-${product.id}`,
        name: label,
        parentId: null,
        level: 'manager',
        headId: '',
        description: String(product.subtitle ?? '').trim(),
        products: [],
      };
      byLabel.set(label, unit);
      units.push(unit);
    }

    byLabel.get(label).products.push(product.id);
  });

  return units;
}

/* پروژه = خودِ محصول واقعی پروژه؛ واحدش از ردهٔ همان محصول می‌آید */
export function projectsFromProducts(units = unitsFromProducts()) {
  const unitOfProduct = new Map();
  units.forEach((unit) => unit.products.forEach((id) => unitOfProduct.set(id, unit.id)));

  return getProducts()
    .filter((product) => product.id && product.title)
    .map((product) => ({
      id: product.id,
      title: product.title,
      unitId: unitOfProduct.get(product.id) ?? '',
      color: toneFor(product.accent),
      status: 'active',
      /* مقصد واقعی محصول در داشبورد — همان چیزی که صفحهٔ عمومی لینک می‌کند */
      href: product.href ?? '',
    }));
}

/* ───────────────────────────── کاربران واقعی ───────────────────────────── */

/* نقش واقعی پنل (`ROLES` در contentStore) → سطح سازمانی ماژول */
const ROLE_TO_LEVEL = {
  'super-admin': 'director',
  admin: 'manager',
  editor: 'lead',
  viewer: 'member',
};

/*
 * نگاشت فضای‌نام مجوز → شناسهٔ محصولی که همان کار را پوشش می‌دهد.
 *
 * این «چسب» است نه داده: از هم‌پوشانی واقعی نام‌ها نوشته شده تا واحد کاربر
 * از روی مجوزهای واقعی‌اش استنتاج شود. مقصدش واحدهایی است که خودشان از
 * محصولات واقعی ساخته می‌شوند، پس اگر محصولی حذف شود این نگاشت بی‌اثر می‌شود
 * و واحد کاربر خالی می‌ماند — نه اینکه دادهٔ ساختگی بسازد.
 */
const NAMESPACE_PRODUCT = {
  comprehensive: 'comprehensive',
  micro: 'micro',
  references: 'reference',
  pages: 'comprehensive',
  categories: 'comprehensive',

  testbank: 'bank',
  exams: 'bank',

  intl: 'international',

  flashcards: 'flashcards',
  notes: 'flashcards',

  articles: 'articles',

  media: 'articles',
  publishing: 'articles',
  banners: 'articles',

  analytics: 'analysis',
  logs: 'analysis',
  settings: 'analysis',
  users: 'analysis',
};

/* آیا این کاربر روی این محصول دسترسی دارد؟ */
export function hasProduct(user, productId) {
  const list = user?.permissions ?? [];
  if (list.includes('*')) return true;
  return list.some((permission) => NAMESPACE_PRODUCT[String(permission).split('.')[0]] === productId);
}

/* مسئول پروژه: نخستین کاربری که روی همان محصول دسترسی واقعی دارد */
export function ownerForProject(users, productId) {
  if (!productId) return '';
  return users.find((user) => {
    const list = user?.permissions ?? [];
    if (list.includes('*')) return false;
    return list.some((permission) => NAMESPACE_PRODUCT[String(permission).split('.')[0]] === productId);
  })?.id ?? '';
}

/* واحد کاربر از فضای‌نام‌های مجوز واقعی‌اش استنتاج می‌شود، نه از یک فیلد تزئینی */
function unitOfPermissions(permissions) {
  const list = Array.isArray(permissions) ? permissions : [];
  if (list.includes('*')) return '';

  const counts = new Map();
  list.forEach((permission) => {
    const productId = NAMESPACE_PRODUCT[String(permission).split('.')[0]];
    if (productId) counts.set(productId, (counts.get(productId) ?? 0) + 1);
  });

  let best = '';
  let bestCount = 0;
  counts.forEach((count, productId) => {
    if (count > bestCount) { best = productId; bestCount = count; }
  });
  return best ? `u-${best}` : '';
}

/* تبدیل مدیر پنل به کاربر ماژول */
export function adminToUser(admin) {
  const name = String(admin?.name ?? '').trim() || String(admin?.username ?? '').trim() || 'کاربر پنل';
  return {
    id: admin?.id ?? admin?.username ?? 'unknown',
    name,
    username: admin?.username ?? '',
    role: admin?.roleLabel ?? admin?.role ?? '',
    roleId: admin?.role ?? '',
    unitId: unitOfPermissions(admin?.permissions),
    level: ROLE_TO_LEVEL[admin?.role] ?? 'member',
    email: admin?.email ?? '',
    phone: admin?.phone ?? '',
    avatar: name.slice(0, 1),
    active: admin?.isActive !== false,
    permissions: Array.isArray(admin?.permissions) ? admin.permissions : [],
  };
}

/*
 * خواندن کاربران واقعی از همان API پنل.
 *
 * خطا عمداً بالا پرتاب نمی‌شود: اگر سرور در دسترس نباشد یا نشست منقضی شده
 * باشد، ماژول باید با آخرین فهرست ذخیره‌شده کار کند، نه اینکه صفحه سفید شود.
 */
export async function fetchAdmins() {
  const result = await adminUsersApi.list({ page: 1, perPage: 100, role: 'all' });
  const items = Array.isArray(result?.items) ? result.items : [];
  return items.map(adminToUser);
}

/* ───────────────────────────── تعطیلات رسمی ─────────────────────────────
 * تاریخ‌های ثابت شمسی تقویم رسمی کشور؛ هر سال تکرار می‌شوند.
 */

const OFFICIAL_HOLIDAYS = [
  { jm: 1, jd: 1, title: 'نوروز' },
  { jm: 1, jd: 2, title: 'نوروز' },
  { jm: 1, jd: 3, title: 'نوروز' },
  { jm: 1, jd: 4, title: 'نوروز' },
  { jm: 1, jd: 12, title: 'روز جمهوری اسلامی' },
  { jm: 1, jd: 13, title: 'روز طبیعت' },
  { jm: 3, jd: 14, title: 'رحلت امام خمینی' },
  { jm: 3, jd: 15, title: 'قیام ۱۵ خرداد' },
  { jm: 11, jd: 22, title: 'پیروزی انقلاب اسلامی' },
  { jm: 12, jd: 29, title: 'روز ملی‌شدن صنعت نفت' },
];

export function buildHolidays(years) {
  const rows = [];
  years.forEach((jy) => {
    OFFICIAL_HOLIDAYS.forEach((holiday, index) => {
      rows.push({
        id: `h-${jy}-${index}`,
        title: holiday.title,
        date: jalaliToIso(jy, holiday.jm, holiday.jd),
        official: true,
        recurring: true,
        jy,
        jm: holiday.jm,
        jd: holiday.jd,
      });
    });
  });
  return rows;
}

/* ───────────────────────────── پیش‌فرض‌های ماژول ───────────────────────────── */

export const defaultReminderSettings = {
  inApp: true,
  email: false,
  dailyDigest: true,
  digestTime: '08:00',
  defaultOffset: 1440,
  quietHours: true,
  quietFrom: '22:00',
  quietTo: '07:00',
  mutedKinds: ['system'],
};

export const defaultPlanningSettings = {
  weekStart: 6,               /* شنبه = ۰ در نمایش، ۶ در Date.getDay */
  defaultView: 'month',
  workingDays: ['ش', 'ی', 'د', 'س', 'چ', 'پ'],
  workingHours: { from: '08:00', to: '20:00' },
  showHolidays: true,
  showWeekNumbers: false,
  compactCards: false,
  fiscalYearStart: 1,         /* فروردین */
  currency: 'تومان',
  overdueGraceDays: 0,
};
