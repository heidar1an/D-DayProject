/*
 * هش‌های مسیر و سازندهٔ هش لایهٔ دوره.
 *
 * از `src/App.jsx` جدا شد تا آن فایل غولِ تک‌فایلی نماند.
 */

import { GROUP_PAGE_HASH } from '../services/group/groupService';
import { LAYER_IDS, dashboardRouteHash } from '../layout/dashboard/dashboardRoute';
import { COURSE_LAYERS } from '../layout/dashboard/DashboardLayout';

const PRICING_HASHES = new Set(['#pricing', '#pr-products', '#pr-plans', '#pr-compare']);
/* صفحهٔ محصولات یک مسیر تک‌لنگر است: `#products` */
const PRODUCTS_HASHES = new Set(['#products']);
/* صفحهٔ «دربارهٔ تپش» هم مسیر تک‌لنگر است: `#about` */
const ABOUT_HASHES = new Set(['#about']);
/*
 * صفحهٔ اشتراک گروهی: `#group`. لینک دعوت هم از همین مسیر می‌آید
 * (`#group?join=CODE`) و کد را در query می‌آورد تا فرمِ پیوستن خودش پُر شود —
 * پس برخلاف سه لایهٔ دیگر، تطبیق **دقیق** کافی نیست و پیشوند هم لازم است.
 * هیچ مسیر دیگری با `#group` شروع نمی‌شود، پس پیشوند امن است.
 * ⚠️ خودِ مسیر از سرویس گروه می‌آید (`GROUP_PAGE_HASH`) تا کارتِ صفحهٔ اصلی،
 * CTA پلن گروهی در تعرفه‌ها و این روتر هر سه یک رشته را بخوانند.
 */
const GROUP_HASH = GROUP_PAGE_HASH;
/* مقصد واحد Green Path — از شناسهٔ روتر ساخته می‌شود تا لینک عمومی و داشبورد جدا نشوند. */
const GREEN_PATH_DASHBOARD_HASH = dashboardRouteHash({ layer: LAYER_IDS.greenPath });

/*
 * مقصد هر یک از پنج کارتِ دورهٔ صفحهٔ اصلی. از همان نگاشت داشبورد (`COURSE_LAYERS`)
 * ساخته می‌شود؛ اگر روزی مقصد یک دوره عوض شود، کارت صفحهٔ اصلی و کارت داشبورد با هم
 * عوض می‌شوند. رشتهٔ دستی این‌جا نوشته نمی‌شود (تلهٔ ۱۰ فایل README).
 */
function courseDashboardHash(courseId) {
  const layerId = COURSE_LAYERS[courseId];
  return layerId ? dashboardRouteHash({ layer: layerId }) : null;
}

/*
 * ── مقصدهای فوتر ──
 *
 * هر عنوانِ فوتر به لایهٔ واقعیِ خودش می‌رسد، نه به یک لنگرِ بی‌ربط (تلهٔ ۱۰).
 * آدرس‌ها از `dashboardRouteHash` + `LAYER_IDS` ساخته می‌شوند، پس با تغییر نام یک
 * لایه هیچ لینکی بی‌صدا از کار نمی‌افتد. تنها مقصد غیرِداشبوردی «مقالات» است که
 * مسیر مستقل خودش را دارد و «علوم پایه» که به صفحهٔ محصولات می‌رود.
 *
 * چرا `export`: مثل `homePromoCards`، هارنس از همین دو جدول می‌سنجد که هر مقصد
 * یک لایهٔ واقعی است — چیزی که در HTML به‌تنهایی قابل اثبات نیست.
 */

export { PRICING_HASHES, PRODUCTS_HASHES, ABOUT_HASHES, GROUP_HASH, GREEN_PATH_DASHBOARD_HASH, courseDashboardHash };
