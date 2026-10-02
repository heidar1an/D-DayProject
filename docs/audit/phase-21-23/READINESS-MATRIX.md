# READINESS-MATRIX — فازهای ۲۱–۲۳

> **وضعیت current (بازنگری ۲۰۲۶-۱۰-۰۲):** دروازه اکنون **۳۶ گام** است
> (`scripts/verify-all.mjs`)؛ مهاجرت نسخه‌دار پیاده شده؛ SEO پیاده و
> `seo:check` سبز است؛ build واقعی از سورس اجرا و `perf:bundle` سبز شد.
> ردیف‌های زیر با همین وضعیت هم‌گام شده‌اند. موارد `BLOCKED`/`UNVERIFIED`
> دست‌نخورده مانده‌اند (سبز ساختگی ساخته نشد).
>
> سابقه (فقط تاریخ، نه وضعیت فعلی): اجرای مرجع دروازهٔ **۲۶ گامه**
> (۲۶/۲۶ سبز، exit 0، ۴۲۶٫۷s) — ۲۰۲۶-۱۰-۰۱

| حوزه | وضعیت Audit | وضعیت فعلی | شواهد | ریسک باقی‌مانده | Owner | وضعیت |
|---|---|---|---|---|---|---|
| Build | UNVERIFIED | `vite build` واقعی از سورس اجرا شد (۲۰۲۶-۱۰-۰۲) · entry `index-DnIy5Pw5.js` · `build:check` **سبز** | `build:check` · `perf:bundle` | — | dev | **VERIFIED** |
| Deployment | UNVERIFIED | `deploy.mjs` کامل با ۷ کد خروج | E25 | drill واقعی انجام نشد | SRE | VERIFIED (کد) |
| Staging | NOT FOUND | وجود ندارد | E4 | کل مسیر پیش‌از‌production دستی است | SRE | **BLOCKED** |
| CI/CD | NOT FOUND | `.github/workflows/ci.yml` (verify · build+budget · audit) | E38 | **اجرای واقعی CI دیده نشد** · روی `main` ۱۶۵ تغییر commit‌نشده | SRE | **PARTIAL** |
| Health/Readiness | PARTIAL | `/healthz` `/api/health` `/readyz` `/metrics` | E10 · E11 · E35 | — | SRE | **VERIFIED** |
| Backup | PARTIAL | `data-backup.mjs` + `backup:restore:test` ۱۲/۱۲ | E12 · E13 | بدون زمان‌بندی و بدون محل خارج از سایت | SRE | VERIFIED (دستی) |
| Restore | UNVERIFIED | dry-run پیش‌فرض + عکس `pre-restore` | E12 | drill روی دادهٔ production انجام نشد | SRE | VERIFIED (تست) |
| Rollback | UNVERIFIED | rollback درون‌خطی `deploy.mjs` کد ۸ | E25 | drill ثبت‌نشده | SRE | PARTIAL |
| Persistence | PARTIAL | write اتمیک · کنترل corruption · mtime cache | `content:atomic:test` · `content:hotpath:test` · `storage:test` | read-modify-write بدون lock بین‌پروسه‌ای | dev | VERIFIED |
| Migration | NOT FOUND | **پیاده شد** — `database/migrations/registry.js` + `runner.js` (نسخه‌دار) · `data:migrate:dry` | `migration:test` (گام دروازه) · `data:migrate:dry` | drill روی دادهٔ production انجام نشد | dev | **VERIFIED** |
| Authentication | PARTIAL | `scrypt$salt$hash` + legacy SHA-256 · `timingSafeEqual` | E16 · `auth:test` ۷۸/۷۸ · E35 | — | security | **VERIFIED** |
| Authorization | PARTIAL | RBAC + deny-by-default + مجوزهای مرزی · `assertSameOrigin` روی ۷ نقطه · کوکی `HttpOnly; SameSite=Strict` + `Secure` شرطی | `admin:rbac:test` ۶۴/۶۴ · E17b · E17c · E35 | enumeration مسیر ادمین (T-08، LOW) | security | **VERIFIED** |
| API Contract | PARTIAL | ۲۲۹ مسیر · ۲۸ کد خطا · ۱۱ DTO · ۰ نقض | E22 | OpenAPI وجود ندارد · شکل خطای `users` ناهمگون (قفل‌شده در E35) | dev | VERIFIED (اسکریپتی) |
| Sanitization | PARTIAL | allowlist tag/attr · **دور زدن XSS رفع شد** · **۵ از ۵ sink پاک‌سازیِ زمان‌رندر دارند** (فهرست استثنا خالی) | E20 · E33 · **E40–E46** · `xss:test` ۱۴/۱۴ · `bank:test` ۴۰/۴۰ | — | security | **VERIFIED** |
| Dependency Security | PARTIAL | `npm audit` = ۰ آسیب‌پذیری | E15 | ۱۳ فایل حجیم · ۵ دادهٔ زمان‌اجرا tracked | security | VERIFIED |
| Secret Hygiene | PARTIAL | ۰ سرّ در فایل‌های tracked | E23 | `admins.json`/`activity.json` در **تاریخچه** | security | **PARTIAL** |
| Threat Model | NOT FOUND | `docs/security/threat-model.md` — ۲۰ تهدید · ۵ ردیف OPEN | E36 | ردیف‌های OPEN بدهی‌اند | security | **VERIFIED (سند)** |
| E2E | NOT FOUND | `e2e:api` — ۲۷ سنجه، گام آخر دروازه | E34 · E35 | **فقط سطح API**؛ جریان‌های مرورگری پوشش ندارند | QA | **PARTIAL** |
| Accessibility | PARTIAL | ۴۳/۵۵ فایل CSS گارد reduced-motion · ۱۷۶۵ `aria-*` · ۳۴۲ `role` · ۷۰/۷۰ `<img>` با `alt` | E29 · E29b · E30 | بدون بررسی صفحه‌خوان و ترتیب فوکوس | QA | PARTIAL |
| Performance | PARTIAL | **baseline واقعی از `dist/` تازهٔ ۲۰۲۶-۱۰-۰۲**: کل ۲۰۰٫۹۱MB · JS ۵٫۷۶MB · CSS ۹۳۶KB · بزرگ‌ترین chunk ۱٫۸۱MB · ۰ نقض بودجه · **chunk پنل ادمین از بار اولیه خارج شد** (لینک `modulepreload`/CSS ادمین در `dist/index.html` دیگر نیست) | `perf:bundle --check` · `build:check` · `scripts/startup-benchmark.mjs` | Core Web Vitals اندازه‌گیری نشد · `mockData` ۱٫۸۱MB بک‌اند ندارد | dev | **VERIFIED (baseline)** |
| Load Testing | NOT FOUND | وجود ندارد | — | بدون staging | SRE | **BLOCKED** |
| Observability | PARTIAL | لاگ JSON تک‌خطی · `X-Request-Id` · `/metrics` توکن‌دار | E11 · `obs:test` | متریک درون‌حافظه (چند-نودی) | SRE | **VERIFIED** |
| Analytics | PARTIAL | تست‌های `obs:test` سبز | E8 | retention/dedup/compaction مستند نشده | dev | PARTIAL |
| Publisher | UNVERIFIED | ۴ آداپتر واقعی · گارد SSRF · بدون توکن صفر درخواست | E21 · `publish:guard:test` | بدون retry/backoff · بدون sandbox واقعی | dev | **UNVERIFIED** |
| AI | UNVERIFIED | — | — | بدون consumer و secret injection | dev | **UNVERIFIED** |
| Payment | UNVERIFIED | — | — | بدون sandbox و webhook verification | dev | **UNVERIFIED** |
| SEO | NOT READY | **پیاده شد** — `database/seo.js` + `seoFiles.js`؛ build هر بار `dist/robots.txt` و `dist/sitemap.xml` (۱۹ URL) می‌سازد · robots صریحاً `Allow: /` دارد · متای پایه/canonical/JSON-LD تزریق می‌شود | `seo:check` (گام دروازه) · `seo:generate` | Core Web Vitals و دادهٔ ساخت‌یافتهٔ صفحه‌به‌صفحه سنجیده نشد | product | **VERIFIED** |
| Disaster Recovery | PARTIAL | مسیر backup/restore مستند و تست‌شده | E12 · `docs/ops/deployment-and-recovery.md` | drill DR کامل + RTO/RPO تعریف‌نشده | SRE | PARTIAL |

## خلاصهٔ شمارش

| وضعیت | تعداد |
|---|---|
| VERIFIED | ۱۰ |
| VERIFIED (جزئی/کد/سند/baseline) | ۶ |
| PARTIAL | ۷ |
| UNVERIFIED | ۳ |
| BLOCKED | ۲ |
| NOT FOUND / NOT READY | ۰ |

## تغییر نسبت به شروع این نشست

| حوزه | پیش | پس | علت |
|---|---|---|---|
| CI/CD | BLOCKED | PARTIAL | workflow CI افزوده شد |
| E2E | BLOCKED | PARTIAL | `e2e:api` با ۲۷ سنجه |
| Sanitization | PARTIAL | **VERIFIED** | **یک دور زدن واقعی XSS کشف و رفع شد** + `xss:test` (گام ۵ دروازه) + بستن آخرین sink بدون پاک‌سازیِ زمان‌رندر |
| Performance | PARTIAL (UNVERIFIED) | **VERIFIED (baseline)** | `perf:bundle` — اندازه‌گیری واقعی از `dist/` + بودجهٔ گام‌در‌دروازه |
| Threat Model | UNKNOWN | VERIFIED (سند) | `docs/security/threat-model.md` |
| SEO | NOT READY | NOT READY (تصمیم مستند) | سند تصمیم بدون تغییر کد |
| Secret Hygiene | PARTIAL | PARTIAL | بدون تغییر — Critical باز است |

## بازنگری ۲۰۲۶-۱۰-۰۲ (current)

| حوزه | پیش (این سند) | پس | علت |
|---|---|---|---|
| Migration | NOT FOUND | **VERIFIED** | `database/migrations/registry.js` + `runner.js` نسخه‌دار + گام `migration:test` |
| SEO | NOT READY | **VERIFIED** | `seo:check` سبز · build هر بار `robots.txt`/`sitemap.xml` می‌سازد |
| Build | VERIFIED (بیرونی) | **VERIFIED** | build واقعی از سورس اجرا شد؛ `build:check` سبز (بیرون سندباکس) |
| Performance | VERIFIED (baseline) | **VERIFIED (baseline)** | baseline تازه + **خروج chunk ادمین از بار اولیه** |
| داده/دروازه | — | — | `data:test` ۲۵۷/۲۵۷ (مستقل از دادهٔ زمان‌اجرا) · `data:check` ۰ خطا |

**یادداشت اندازه‌گیری راه‌اندازی (Phase 3):** «~۸ ثانیه راه‌اندازی» **آرتیفکت
محیط** بود، نه bottleneck پروژه. جداسازی ۲×۲:

| محیط | شیم FS میزبان | راه‌اندازی |
|---|---|---|
| ترمینال معمولی | خاموش | **۱۳۵–۱۵۲ ms** |
| ترمینال معمولی | روشن (`NODE_OPTIONS`) | ۱۱٫۶–۱۶٫۱ s |
| سندباکس | خاموش | ۱۱۵–۱۳۷ ms |
| سندباکس | روشن | ۱۰٫۴–۲۳٫۶ s |

⇒ هزینه از **شیم سیستم‌فایل** می‌آید که هر خواندن ماژول را واسطه می‌کند. بازتولید:
`NODE_OPTIONS= node scripts/startup-benchmark.mjs`. هیچ تغییر lazy-loading
اعمال **نشد** — چون bottleneck واقعی‌ای برای رفع وجود ندارد و refactor پرریسک
فقط semantics را به خطر می‌انداخت.

**سه Blocker اصلی (بدون تغییر):**
۱. **سرّ و دادهٔ زمان‌اجرا در تاریخچهٔ Git** (Critical، نیازمند تأیید صریح).
۲. **نبود staging** ⇒ Load test و اجرای واقعی CI سنجیده نمی‌شود.
۳. **E2E مرورگری** ⇒ جریان‌های حیاتی UI هنوز end-to-end آزموده نمی‌شوند.
