# Dockerfile — تپش (استقرار staging/production)
#
# چرا سازگار است (و فقط «تزئینی» نیست):
#   • سرور production پروژه (`server.js`) **هیچ وابستگی بیرونی ندارد** — فقط
#     ماژول‌های خود نود و ماژول‌های داخلی پروژه. پس stage نهایی به `node_modules`
#     نیازی ندارد و ایمیج کوچک می‌ماند.
#   • فقط دو مسیر **نوشتنی** وجود دارد: `database/` (JSON) و `public/uploads/`.
#     هر دو در compose به volume وصل می‌شوند تا داده بین deployها بماند.
#   • healthcheck روی `/healthz` است که خود سرور دارد و به دیسک/سشن وابسته نیست.
#
# ⚠️ این ایمیج در محیط توسعهٔ فعلی **build نشده** (docker در دسترس نیست).
# وضعیت: IMPLEMENTED-BUT-UNVERIFIED. دستور تأیید:
#   docker build -t tapesh:staging . && docker run --rm -p 4173:4173 tapesh:staging

# ── stage ۱: build دارایی‌های کلاینت ───────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# نصب deterministic — فقط با lockfile
COPY package.json package-lock.json ./
RUN npm ci

# فقط ورودی‌های build (نه .git، نه Z-Anatomy-Beta — با .dockerignore)
COPY index.html vite.config.js jsconfig.json ./
COPY src ./src
COPY public ./public
COPY images ./images
COPY fonts ./fonts
COPY database ./database

RUN npm run build

# ── stage ۲: runtime ──────────────────────────────────────────────
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    TAPESH_ENV=production \
    PORT=4173 \
    HOST=0.0.0.0

WORKDIR /app

# دو مسیر نوشتنی را **پیش از `USER node`** می‌سازیم و مالکشان را `node` می‌کنیم.
# چرا لازم است: داکر یک named-volume را در مسیری که در ایمیج وجود ندارد، با
# مالک root می‌سازد؛ آن‌وقت کاربر `node` نه می‌تواند لاگ بنویسد و نه آپلود را
# ذخیره کند — یعنی staging با خطای دسترسی بالا می‌آمد، نه با خطای کد.
# (اگر مسیر در ایمیج باشد، داکر مالکیت همان پوشه را به volume منتقل می‌کند.)
RUN mkdir -p /app/logs /app/public/uploads && chown -R node:node /app/logs /app/public

# کاربر غیر-روت (تصویر رسمی نود از قبل `node` را دارد)
USER node

# سرور + لایهٔ داده + ماژول‌های دادهٔ خالصی که سرور import می‌کند
COPY --chown=node:node server.js package.json ./
COPY --chown=node:node database ./database
COPY --chown=node:node src ./src

# artifact ساخته‌شده در stage قبل
COPY --from=builder --chown=node:node /app/dist ./dist

EXPOSE 4173

# `/healthz` عمداً هیچ وابستگی‌ای را نمی‌سنجد (liveness) — همان قرارداد سرور.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4173)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `--env=production` گارد خودِ `deploy.mjs` را هم دارد؛ اینجا مستقیم start می‌کنیم
# چون build در stage قبل انجام شده است.
CMD ["node", "server.js"]
