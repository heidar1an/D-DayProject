#!/usr/bin/env bash
#
# تأیید واقعی روی PostgreSQL (+ Redis اختیاری) — بدون نصب سرویس دائمی.
#
# چرا این اسکریپت وجود دارد: تست‌های این پروژه روی SQLite `:memory:` اجرا می‌شوند و
# SQLite چند کلاس باگ را پنهان می‌کند (نوع ستون، ترتیب DDL، abort شدن تراکنش،
# تایم‌زون). در ۲۰۲۶-۱۰-۰۳ همین اجرا **۴ باگ PG-only** بیرون داد. پس این مسیر باید
# تکرارپذیر باشد، نه یک کار دستی یک‌باره.
#
# کاری که می‌کند:
#   ۱. یک خوشهٔ موقت PG در /tmp می‌سازد (پورت و مسیر قابل تغییر).
#   ۲. Redis موقت بالا می‌آورد (اگر در دسترس باشد).
#   ۳. migrate:fresh → rollback → migrate را روی PG اجرا می‌کند.
#   ۴. کل سوییت تست را روی PG اجرا می‌کند (CACHE_STORE=array — پایین توضیح).
#   ۵. همیشه (حتی روی خطا) سرویس‌ها را خاموش و /tmp را پاک می‌کند.
#
# ⚠️ `CACHE_STORE=array` عمدی است. با کش پایدار، شمارنده‌های rate limit بین تست‌ها
#    باقی می‌مانند و ~۱۶۰ تست با ۴۲۹/۴۰۱ قرمز می‌شوند — بدون هیچ باگ محصولی.
#    `phpunit.xml` همین را قفل کرده است. برای تست Redis، `TAPESH_TEST_REDIS=1`
#    فقط `ServiceIntegrationTest` را باز می‌کند.
#
# استفاده:
#   backend/scripts/verify-on-pg.sh              # PG + Redis
#   PG_PORT=55433 backend/scripts/verify-on-pg.sh
#   WITH_REDIS=0 backend/scripts/verify-on-pg.sh # فقط PG

set -uo pipefail

PG_PORT="${PG_PORT:-55432}"
REDIS_PORT="${REDIS_PORT:-56379}"
PG_DIR="${PG_DIR:-/tmp/tapesh-verify-pg}"
REDIS_DIR="${REDIS_DIR:-/tmp/tapesh-verify-redis}"
WITH_REDIS="${WITH_REDIS:-1}"

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_DIR" || exit 1

# ⚠️ بدون این، روی macOS `postmaster became multithreaded during startup` می‌دهد و
#    `pg_ctl` فقط می‌گوید «could not start server» (پیام اصلی در فایل -l است).
export LC_ALL=C LANG=C

PG_STARTED=0
REDIS_STARTED=0

cleanup() {
  local code=$?

  if [ "$PG_STARTED" = "1" ]; then
    pg_ctl -D "$PG_DIR" -m fast -w stop >/dev/null 2>&1 || true
  fi

  if [ "$REDIS_STARTED" = "1" ]; then
    redis-cli -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
  fi

  rm -rf "$PG_DIR" "$PG_DIR.log" "$REDIS_DIR"

  exit "$code"
}

trap cleanup EXIT INT TERM

fail() {
  echo "✗ $*" >&2
  exit 1
}

for bin in initdb pg_ctl createdb psql php; do
  command -v "$bin" >/dev/null 2>&1 || fail "«$bin» پیدا نشد. نصب: brew install postgresql@17"
done

echo "── پاک‌سازی وضعیت قبلی ──"
rm -rf "$PG_DIR" "$PG_DIR.log" "$REDIS_DIR"

echo "── ساخت خوشهٔ موقت PostgreSQL روی پورت $PG_PORT ──"
initdb -D "$PG_DIR" -U postgres -A trust --encoding=UTF8 --locale=C >"$PG_DIR.log" 2>&1 \
  || fail "initdb شکست خورد (لاگ: $PG_DIR.log)"

pg_ctl -D "$PG_DIR" -o "-p $PG_PORT -k /tmp" -l "$PG_DIR.log" -w start >>"$PG_DIR.log" 2>&1 \
  || fail "pg_ctl start شکست خورد — لاگ: $PG_DIR.log (تلهٔ رایج: LC_ALL)"
PG_STARTED=1

createdb -h /tmp -p "$PG_PORT" -U postgres tapesh_verify >>"$PG_DIR.log" 2>&1 \
  || fail "createdb شکست خورد"

if [ "$WITH_REDIS" = "1" ] && command -v redis-server >/dev/null 2>&1; then
  echo "── Redis موقت روی پورت $REDIS_PORT ──"
  mkdir -p "$REDIS_DIR"
  redis-server --port "$REDIS_PORT" --dir "$REDIS_DIR" --daemonize yes \
    --save '' --appendonly no >/dev/null 2>&1 || true

  if [ "$(redis-cli -p "$REDIS_PORT" ping 2>/dev/null)" = "PONG" ]; then
    REDIS_STARTED=1
  else
    echo "  ⚠ Redis بالا نیامد — تست Redis رد می‌شود"
  fi
else
  echo "── Redis: رد شد (WITH_REDIS=$WITH_REDIS) ──"
fi

export DB_CONNECTION=pgsql
export DB_HOST=127.0.0.1
export DB_PORT="$PG_PORT"
export DB_DATABASE=tapesh_verify
export DB_USERNAME=postgres
export DB_PASSWORD=
export CACHE_STORE=array
export TAPESH_TEST_PGSQL_HOST=127.0.0.1
export TAPESH_TEST_PGSQL_PORT="$PG_PORT"
export TAPESH_TEST_PGSQL_DB=tapesh_verify
export TAPESH_TEST_PGSQL_USER=postgres
export TAPESH_TEST_PGSQL_PASSWORD=

if [ "$REDIS_STARTED" = "1" ]; then
  export TAPESH_TEST_REDIS=1
  export REDIS_HOST=127.0.0.1
  export REDIS_PORT="$REDIS_PORT"
  export REDIS_CLIENT=predis
fi

echo "── migrate:fresh روی PostgreSQL ──"
php artisan migrate:fresh --force || fail "migrate:fresh شکست خورد"

echo "── migrate:rollback (همه) ──"
php artisan migrate:rollback --force || fail "rollback شکست خورد"

echo "── migrate دوباره ──"
php artisan migrate --force || fail "migrate دوم شکست خورد"

echo "── php artisan test روی PostgreSQL ──"
php artisan test || fail "تست‌ها روی PostgreSQL قرمز شدند"

echo "── Pint ──"
vendor/bin/pint --test || fail "Pint شکست خورد"

echo
echo "✓ تأیید PG کامل شد (پورت $PG_PORT، Redis: $REDIS_STARTED). سرویس‌ها خاموش و /tmp پاک شد."
