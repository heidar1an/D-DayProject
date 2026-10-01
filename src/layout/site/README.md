# `src/layout/site/` — پوستهٔ سایت

سرصفحه، فوتر، نشان برند و جدول‌های داده‌ای که صفحهٔ اصلی و همهٔ صفحات عمومی
مصرف می‌کنند. این‌ها پیش‌تر داخل `src/App.jsx` بودند.

| فایل | چه چیزی |
| --- | --- |
| `siteIcons.jsx` | `Brand` (با کلیک‌های ایستر اگ)، `ArrowIcon`، `ArrowLeftIcon`، `HeaderUserIcon`، `GoogleIcon`، `CheckIcon`، `SparkIcon`، `normalizeDigits` |
| `siteData.js` | `benefitRows`، `tapeshFeatures`، `homeArticles`، `faqItems`، `motionItems`، `FOOTER_PRODUCT_LINKS`، `FOOTER_SECTION_LINKS`، `FOOTER_SOCIAL_LINKS`، `homePromoCards` |
| `SiteChrome.jsx` | `MotionStrip`، `SiteHeader`، `SiteFooter` |

## قواعد

- **`siteData.js` خالص است** (بدون JSX). هر رکورد تازه‌ای که مقصد دارد، هش را از
  `src/router/routeHashes.js` بسازد — نه رشتهٔ دستی.
- `Brand` تنها نقطهٔ فعال‌سازی ایستر اگ است (پنج کلیک در ۱۵۰۰ms). نشان فوتر با
  `interactive={false}` رندر می‌شود و نباید فعال شود.
- `SiteFooter` لینک محصول را با پراپ `onProductLink` بالا می‌برد؛ خودش مسیر را
  نمی‌شناسد.
