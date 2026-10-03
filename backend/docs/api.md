# API v1 — قرارداد پایه (فاز ۱)

نسخهٔ فعلی فقط **زیرساخت** است. OpenAPI v1 از فاز وجود endpointهای واقعی تولید می‌شود (تولید از route/Request/Resource، جدا از `docs/api/openapi.json` legacy).

## Envelope استاندارد

```jsonc
// موفق — 2xx
{ "data": <…>, "meta": <…>? , "requestId": "<uuid>" }

// خطا — 4xx/5xx
{ "error": { "code": "<STABLE_CODE>", "message": "<…>", "fields": {} }, "requestId": "<uuid>" }
```

- `requestId` همیشه در بدنه و در هدر پاسخ `X-Request-Id` برمی‌گردد. کلاینت می‌تواند با همان هدر ارسال کند (الگوی مجاز: `[A-Za-z0-9._-]{8,64}`)؛ مقدار نامعتبر/غایب → UUIDv4 تازه.
- `fields` فقط برای ۴۲۲ پر می‌شود (نقشهٔ فیلد → پیام‌ها) و در بقیه `{}` است.
- پیام‌های 5xx همیشه عمومی‌اند («Internal server error.») — جزئیات در لاگ با همان `requestId`.

## نگاشت خطا (پایدار — فقط توسعه می‌یابد)

| HTTP | code |
|---|---|
| 400 | BAD_REQUEST |
| 401 | UNAUTHENTICATED |
| 403 | FORBIDDEN |
| 404 | NOT_FOUND |
| 405 | METHOD_NOT_ALLOWED |
| 409 | CONFLICT |
| 413 | PAYLOAD_TOO_LARGE |
| 415 | UNSUPPORTED_MEDIA_TYPE |
| 422 | VALIDATION_FAILED |
| 429 | RATE_LIMITED (+ هدرهای Retry-After عطف می‌شوند) |
| 500 | INTERNAL_ERROR |
| 503 | SERVICE_UNAVAILABLE |

## Endpoints سلامت (شکل محدودِ مجاز خودشان)

### `GET /api/v1/healthz` — liveness

```json
200 { "status": "ok", "requestId": "…" }
```

هیچ وابستگی‌ای چک نمی‌شود.

### `GET /api/v1/readyz` — readiness

```json
200 { "status": "ok", "checks": { "database": { "status": "ok" }, "redis": { "status": "ok" } }, "requestId": "…" }

503 { "status": "unavailable", "checks": { "database": { "status": "fail", "reason": "database_unavailable" } }, "requestId": "…" }
```

- دلایل fail همیشه عمومی‌اند (`*_unavailable`) — host/credential لو نمی‌رود.
- هر check با `READYZ_CHECK_DATABASE` / `READYZ_CHECK_REDIS` قابل خاموش‌کردن است (dev بدون سرویس).
- HTTP status = 200 فقط وقتی همهٔ checkهای فعال ok باشند.

## سطح فعلی v1 (فاز ۱ تا ۶)

`docs/openapi.v1.json` مرجع ماشین‌خوان است و با `ApiV1ContractTest` **دوطرفه** قفل
شده: هر مسیر واقعی باید مستند باشد و هر مسیر مستندشده باید وجود داشته باشد.

| گروه | مسیرها | دسترسی |
|---|---|---|
| زیرساخت | `GET /healthz`, `GET /readyz` | عمومی |
| هویت دانشجو | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` | عمومی |
| کاربر جاری | `GET /me`, `PATCH /me` | دانشجو |
| مرجع | `GET /universities` | عمومی |
| محتوا (فاز ۴) | `GET /subjects`, `GET /courses`, `GET /courses/{idOrSlug}`, `GET /lessons/{id}`, `GET /lesson-pages/{id}` | عمومی |
| یادگیری (فاز ۵) | `GET /me/progress`, `GET /me/progress/pages/{id}`, `PUT /me/progress/pages/{id}`, `POST /me/study-sessions` | دانشجو |
| بانک سؤال (فاز ۶) | `GET /questions`, `GET /questions/{id}` | عمومی |
| پاسخ و گزارش (فاز ۶) | `POST /questions/{id}/answers`, `POST /questions/{id}/reports` | دانشجو |
| سشن تمرین (فاز ۶) | `POST /bank/sessions`, `GET /bank/sessions/{id}` | دانشجو |
| پنل (فاز ۳) | `POST /admin/auth/login`, `POST /admin/auth/logout`, `GET /admin/auth/me` | عمومی/ادمین |
| CRUD سؤال (فاز ۶) | `GET/POST /admin/questions`, `GET/PATCH /admin/questions/{id}`, `POST /admin/questions/{id}/publish`, `POST /admin/questions/{id}/archive` | ادمین + `testbank.*` |

**عمداً وجود ندارد:** هر مسیری با `exam` در نام (Exam Engine فاز ۷)،
`GET /users/{id}/progress`، و `DELETE` برای سؤال.

### هدرهای قراردادی

| هدر | کاربرد |
|---|---|
| `X-Request-Id` | پذیرش/برگرداندن شناسهٔ درخواست |
| `X-CSRF-Token` | double-submit برای هر نوشتن با سشن (دانشجو و ادمین) |
| `Origin` | اجباری برای نوشتن‌ها (fail-closed) |
| `Idempotency-Key` | اختیاری روی `PUT /me/progress/pages/{id}`، `POST /me/study-sessions`؛ برای پاسخ سؤال، فیلد بدنه `attemptKey` همین نقش را دارد |

جزئیات دامنه‌ای: `docs/learning.md` (فاز ۵) و `docs/question-bank.md` (فاز ۶).

## نکته‌های نسخه‌بندی

- همهٔ endpointهای واقعی آینده زیر `/api/v1` و داخل `routes/api.php` ثبت می‌شوند.
- تغییر breaking در envelope/codes یعنی `/api/v2` — نه تغییر همین قرارداد.
- مسیر `/up` فریم‌ورک فقط bootstrap-check داخلی است؛ بخشی از قرارداد v1 نیست.
