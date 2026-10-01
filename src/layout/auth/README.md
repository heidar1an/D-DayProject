# `src/layout/auth/` — صفحهٔ ورود/ثبت‌نام

`AuthPage.jsx` پیش‌تر داخل `src/App.jsx` بود. سه بخش در همین یک ماژول زندگی می‌کنند:

1. دادهٔ ثابت کارت (`authHighlights`، `authCommunityAvatars`، `authAnimatedPhrases`،
   `GOOGLE_RETURN_MESSAGES`).
2. قلاب `useAuthTypewriter` برای عبارت تایپ‌شونده.
3. خودِ `AuthPage`.

## قواعد

- **مسیر دو حالت دارد:** `#auth` = ورود، `#auth/register` = ثبت‌نام. تشخیص با
  `getAuthMode()` در `src/router/appRoute.js` است و حالت به‌صورت پراپ
  `initialMode` می‌آید.
- **ورودی‌ها کنترل‌شده نیستند.** عمدی است تا `FormData` سالم بماند.
- **افکت گوگل یک‌بارمصرف است، نه فلگ `active`.** زیر `StrictMode` هر افکت دو بار
  اجرا می‌شود؛ اگر با فلگ نوشته شود، اجرای دوم «دست‌دادن» را از دست می‌دهد و کاربر
  بی‌خطا روی `#auth` می‌ماند. محافظ، `googleBootRef.current` است.
- **صفحهٔ ورود خودش دکمهٔ تم ندارد** — این سنجه در `verify-render` عمداً رد است.
- سنجش اختصاصی: `npm run auth:check` (۳۵ سنجه، دو حالت، بدون مرورگر).
