/*
 * مبدل بلوک‌های میکرودرسنامه به متن غنی (HTML).
 *
 * ── چرا لازم است؟ ──
 * مدل اولیهٔ صفحه «بلوک‌بندی‌شده» بود: هر صفحه آرایه‌ای از block داشت و ادمین برای
 * هر تکه متن یک فرم جدا پر می‌کرد. درخواست کاربر این بود که صفحه مثل یک ویرایشگر متن
 * معمولی نوشته شود. پس محتوای صفحه به یک فیلد متنی غنی (`page.content`) منتقل شد.
 *
 * اما حدود ۲۰۰ صفحهٔ موجود (۱۶ درس) همه بلوکی‌اند. این مبدل همان‌ها را یک‌بار به متن
 * غنی تبدیل می‌کند تا ادمین صفحه را باز کند و متنش را آماده ببیند — بدون کار دستی.
 *
 * ── قاعده‌های تبدیل ──
 *   • کلاس‌های CSS عیناً همان کلاس‌های خوانندهٔ قدیمی است (`micr-callout`,
 *     `micr-compare`, `micr-table`, …) تا تبدیل، ظاهر صفحه را عوض نکند.
 *   • فقط تگ‌های مجاز پاک‌ساز (`database/sanitizeHtml.js`) تولید می‌شوند؛ مثلاً
 *     `aside` و `small` در allow-list نیستند، پس `div` و `span` می‌گذاریم.
 *   • سه نوع بلوک از تبدیل **کنار گذاشته** می‌شوند چون متن نیستند و در HTML خالص
 *     قابل بیان نیستند: `figure` (دیاگرام SVG)، `flashcards`، `quickQuestion`.
 *     این‌ها همان‌جا در بلوک‌ها می‌مانند و خواننده آن‌ها را زیر متن غنی رندر می‌کند
 *     (تابع `interactiveBlocksOf`). پس هیچ محتوایی از دست نمی‌رود.
 *
 * این ماژول خالص است: نه React، نه DOM — هم در Node و هم در باندل مرورگر کار می‌کند.
 */

/* انواع بلوکی که به متن غنی تبدیل نمی‌شوند و تعاملی می‌مانند */
export const INTERACTIVE_BLOCK_TYPES = ['figure', 'flashcards', 'quickQuestion'];

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const items = (list) => (Array.isArray(list) ? list : []).filter(Boolean);

const listHtml = (values, className = '') => {
  const clean = items(values);
  if (!clean.length) return '';
  const attrs = className ? ` class="${className}"` : '';
  return `<ul${attrs}>${clean.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
};

const callout = (variant, inner) => `<div class="micr-callout micr-callout--${variant}">${inner}</div>`;

const label = (title) => (title ? `<p class="micr-block__label">${escapeHtml(title)}</p>` : '');

function blockToHtml(block) {
  switch (block.type) {
    case 'heading':
      return block.text ? `<h3 class="micr-h">${escapeHtml(block.text)}</h3>` : '';

    case 'intro':
      return block.text ? `<p class="micr-intro">${escapeHtml(block.text)}</p>` : '';

    case 'text':
      return block.text ? `<p class="micr-text">${escapeHtml(block.text)}</p>` : '';

    case 'keyPoint':
      return block.text
        ? callout('key', `<p><strong>نکتهٔ کلیدی</strong> ${escapeHtml(block.text)}</p>`)
        : '';

    case 'definition':
      return block.text
        ? callout('def', [
          '<p>',
          `<strong>${escapeHtml(block.term)}</strong>`,
          block.english ? ` <span class="micr-callout__en">${escapeHtml(block.english)}</span>` : '',
          '</p>',
          `<p>${escapeHtml(block.text)}</p>`,
        ].join(''))
        : '';

    case 'example':
      return block.text
        ? callout('example', `${block.title ? `<p><strong>${escapeHtml(block.title)}</strong></p>` : ''}<p>${escapeHtml(block.text)}</p>`)
        : '';

    case 'warning':
      return block.text
        ? callout('warn', `<p><strong>هشدار / اشتباه رایج</strong> ${escapeHtml(block.text)}</p>`)
        : '';

    case 'clinical':
      return block.text
        ? callout('clinical', [
          '<p><span class="micr-callout__tag">ارتباط بالینی</span>',
          block.title ? ` <strong>${escapeHtml(block.title)}</strong>` : '',
          '</p>',
          `<p>${escapeHtml(block.text)}</p>`,
        ].join(''))
        : '';

    case 'crossCourse': {
      const rows = items(block.items);
      if (!rows.length) return '';
      const body = rows
        .map((item) => `<li><strong>${escapeHtml(item.courseTitle)}</strong> <span>${escapeHtml(item.topic)}</span></li>`)
        .join('');
      return callout('cross', `${block.title ? `<p><strong>${escapeHtml(block.title)}</strong></p>` : ''}<ul>${body}</ul>`);
    }

    case 'comparison': {
      const side = (data) => [
        '<div class="micr-compare__side">',
        `<h4>${escapeHtml(data?.label)}</h4>`,
        listHtml(data?.items),
        '</div>',
      ].join('');
      return `<div class="micr-compare">${label(block.title)}<div class="micr-compare__grid">${side(block.left)}${side(block.right)}</div></div>`;
    }

    case 'table': {
      const head = items(block.head);
      const rows = (Array.isArray(block.rows) ? block.rows : []).filter((row) => items(row).length);
      if (!head.length && !rows.length) return '';
      const thead = head.length
        ? `<thead><tr>${head.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead>`
        : '';
      const tbody = rows.length
        ? `<tbody>${rows.map((row) => `<tr>${items(row).map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`
        : '';
      return `<div class="micr-table">${label(block.title)}<div class="micr-table__scroll"><table>${thead}${tbody}</table></div></div>`;
    }

    case 'summary':
      return items(block.items).length
        ? `<div class="micr-summary"><p><strong>جمع‌بندی صفحه</strong></p>${listHtml(block.items)}</div>`
        : '';

    /* figure | flashcards | quickQuestion → تعاملی می‌مانند، به متن تبدیل نمی‌شوند */
    default:
      return '';
  }
}

/*
 * تبدیل یک صفحهٔ بلوکی به متن غنی.
 * خروجی همیشه با `<p>` یا تگ بلوکی شروع می‌شود تا ویرایشگر متن آن را درست بچیند.
 */
export function blocksToHtml(blocks) {
  return (Array.isArray(blocks) ? blocks : [])
    .map(blockToHtml)
    .filter(Boolean)
    .join('\n');
}

/* بلوک‌های تعاملی یک صفحه — این‌ها زیر متن غنی رندر می‌شوند */
export function interactiveBlocksOf(page) {
  return (page?.blocks ?? []).filter((block) => INTERACTIVE_BLOCK_TYPES.includes(block.type));
}

/* آیا این صفحه متن غنی دارد؟ (فیلد خالی و تگ‌های بی‌محتوا حساب نمی‌شوند) */
export function hasRichContent(page) {
  return String(page?.content ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;
}

export default blocksToHtml;
