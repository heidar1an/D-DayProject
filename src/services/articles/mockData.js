/*
 * نگاشت تصویرهای «مقالات تپش» روی کاتالوگ خالص.
 *
 * خودِ داده در `articleCatalog.js` زندگی می‌کند و هیچ import ندارد تا سرور هم بتواند
 * همان فهرست را بخواند (`syncArticles` در `contentStore.js`). این فایل تنها جایی است
 * که تصویرهای واقعی import می‌شوند: کلید `figure` هر مقالهٔ کاتالوگ اینجا به نشانی
 * فایل تبدیل می‌شود. پس `ARTICLES` دقیقاً همان شکل قبلی را دارد و مصرف‌کننده‌های فعلی
 * (`articlesService`، `knowledgeService`، `productsService`) دست‌نخورده می‌مانند.
 *
 * مدل محتوا (content) بلوکی است و از همان واژگان «درسنامه‌خوان» داشبورد پیروی می‌کند:
 *   p | h2 | h3 | quote | list | olist | callout | table | image
 * داخل متن، **درشت** و *مورب* پشتیبانی می‌شود.
 */

import anatomyCover from '../../../images/pictures/ChatGPT Image ۲۷ مرداد ۱۴۰۵، ۱۷_۰۹_۵۰.png';
import stressCover from '../../../images/pictures/groupExam.png';
import searchCover from '../../../images/pictures/character-search.png';
import notesCover from '../../../images/pictures/ChatGPT Image ۲ شهریور ۱۴۰۵، ۱۳_۲۴_۴۵.png';
import antibioticsCover from '../../../images/pictures/tuberculosis-abstract-concept-vector-illustration-world-tuberculosis-day-mycobacterium-infection-diagnostics-treatment-infectious-lung-disease-contagious-infection-abstract-metaphor.png';
import biochemCover from '../../../images/pictures/HeidarianMan 2026-08-19 at 19.38.37.png';
import roadmapCover from '../../../images/pictures/universalExam.png';

import { ARTICLE_CATALOG } from './articleCatalog';

export { ARTICLE_AUTHORS as AUTHORS, ARTICLE_CATEGORIES as CATEGORIES } from './articleCatalog';

/* کلید `figure` هر مقاله → تصویر واقعی. مقالهٔ بدون کلید، بدون کاور می‌ماند. */
export const COVER_FIGURES = {
  anatomy: anatomyCover,
  stress: stressCover,
  search: searchCover,
  notes: notesCover,
  antibiotics: antibioticsCover,
  biochem: biochemCover,
  roadmap: roadmapCover,
};

export const ARTICLES = ARTICLE_CATALOG.map((article) => ({
  ...article,
  cover: COVER_FIGURES[article.figure] ?? '',
}));
