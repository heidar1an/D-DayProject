# `src/router/` — مسیر ریشهٔ اپ

ناوبری سایت هش‌محور است (`#auth`، `#pricing`، `#dashboard/...`، `#articles/...`).
این پوشه همان لایه را از `src/App.jsx` جدا می‌کند تا آن فایل هم روتر باشد و هم
صفحهٔ اصلی نباشد.

| فایل | چه چیزی |
| --- | --- |
| `routeHashes.js` | مجموعه‌های هش (`PRICING_HASHES`، `PRODUCTS_HASHES`، `ABOUT_HASHES`، `GROUP_HASH`، `GREEN_PATH_DASHBOARD_HASH`) و `courseDashboardHash(courseId)` |
| `appRoute.js` | `getAppRoute`، `getAuthMode`، `getArticleSlug`، `getRouteUrl`، `getRouteState` و قلاب‌های `useReturnToAnchor`/`useOnlineStatus` |

## قواعد

- **`getRouteUrl` باید `#auth/...` را حفظ کند.** زیرمسیرِ `#auth/register` همان
  مسیر است با حالت دیگر؛ نرمال‌سازی آدرس نباید آن را به `#auth` بچسباند.
- هش‌ها **فقط از این‌جا** ساخته می‌شوند. رشتهٔ هش دستی در JSX ننویسید.
- `dashboardRoute.jsx` (روتر درون داشبورد) جای دیگری است و به این پوشه وابسته نیست.
