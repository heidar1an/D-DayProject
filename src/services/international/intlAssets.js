/*
 * نگاشت کلید دارایی → آدرس باندل‌شده — فقط سمت مرورگر.
 *
 * چرا جدا از کاتالوگ: `intlCatalog.js` را نود هم می‌خواند (seed سرور) و نود
 * نمی‌تواند تصویر import کند. پس رکوردهای ذخیره‌شده فقط `imageKey`/`logoKey`
 * دارند و این فایل، همان کلید را به آدرس واقعی Vite ترجمه می‌کند.
 *
 * ترتیب اولویت هنگام رندر:
 *   ۱) آدرس آپلودی پنل (`image`/`logo` روی رکورد)
 *   ۲) دارایی باندل‌شدهٔ همین فایل (با کلید)
 *   ۳) رشتهٔ خالی (کارت بدون تصویر رندر می‌شود، نه با تصویر شکسته)
 */

import bbcLogo from '../../../images/logos/bbc.png';
import cambridgeLogo from '../../../images/logos/cambridge.png';
import courseraLogo from '../../../images/logos/coursera.png';
import harvardLogo from '../../../images/logos/harvard.png';
import harvardMedLogo from '../../../images/logos/harvard-med.png';
import johnsHopkinsLogo from '../../../images/logos/johns-hopkins.png';
import khanAcademyLogo from '../../../images/logos/khan-academy.png';
import mitLogo from '../../../images/logos/mit.png';
import nejmLogo from '../../../images/logos/nejm.png';
import oxfordLogo from '../../../images/logos/oxford.png';
import stanfordMedLogo from '../../../images/logos/stanford-med.png';
import torontoLogo from '../../../images/logos/toronto.png';
import whoLogo from '../../../images/logos/who.png';

import globalHealthImage from '../../../images/courses/Asset 6.webp';
import researchMethodsImage from '../../../images/courses/Asset 5.webp';
import scientificEnglishImage from '../../../images/courses/english.webp';
import visualScienceImage from '../../../images/courses/immono.webp';
import mediaLiteracyImage from '../../../images/pictures/character-search.png';
import neuroscienceImage from '../../../images/pictures/images (1).jpeg';

/* کلید منبع → لوگو */
const PROVIDER_LOGOS = {
  bbc: bbcLogo,
  cambridge: cambridgeLogo,
  coursera: courseraLogo,
  harvard: harvardLogo,
  'harvard-med': harvardMedLogo,
  'johns-hopkins': johnsHopkinsLogo,
  'khan-academy': khanAcademyLogo,
  mit: mitLogo,
  nejm: nejmLogo,
  oxford: oxfordLogo,
  'stanford-med': stanfordMedLogo,
  toronto: torontoLogo,
  who: whoLogo,
};

/* کلید دوره → تصویر کارت */
const COURSE_IMAGES = {
  'global-health': globalHealthImage,
  'media-literacy': mediaLiteracyImage,
  neuroscience: neuroscienceImage,
  'research-methods': researchMethodsImage,
  'scientific-english': scientificEnglishImage,
  'visual-science': visualScienceImage,
};

/* کلیدهای موجود — پنل برای فهرست انتخاب تصویر/لوگو از همین‌ها می‌خواند */
export const COURSE_IMAGE_KEYS = Object.keys(COURSE_IMAGES);
export const PROVIDER_LOGO_KEYS = Object.keys(PROVIDER_LOGOS);

/* آدرس تصویر کارت دوره: آپلود پنل مقدم است، بعد دارایی باندل‌شده */
export function courseImage(course) {
  return course?.image || COURSE_IMAGES[course?.imageKey] || '';
}

/* آدرس لوگوی منبع — همان ترتیب اولویت */
export function providerLogo(provider) {
  return provider?.logo || PROVIDER_LOGOS[provider?.logoKey] || '';
}

/* آدرس دارایی یک کلید مشخص (برای پیش‌نمایش در فرم پنل) */
export function assetByKey(kind, key) {
  if (kind === 'course') return COURSE_IMAGES[key] ?? '';
  return PROVIDER_LOGOS[key] ?? '';
}
