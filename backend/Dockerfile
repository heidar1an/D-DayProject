# ─────────────────────────────────────────────────────────────────────
# TAPESH backend — Phase 1 foundation (PHP 8.5 / Laravel 13 / php-fpm)
# ⚠️ این ایمیج در محیط توسعهٔ فعلی build نشده (docker در دسترس نیست) —
#    IMPLEMENTED-BUT-UNVERIFIED. دستور تأیید: docs/development.md
# ─────────────────────────────────────────────────────────────────────

# stage ۱ — autoloader و vendor بدون dev-dependency
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts --no-autoloader
COPY app bootstrap config database routes ./
RUN composer dump-autoload --optimize --classmap-authoritative --no-dev

# stage ۲ — runtime
FROM php:8.5-fpm-alpine AS app

RUN apk add --no-cache icu-libs libpq libzip \
    && docker-php-ext-install pdo_pgsql opcache pcntl

WORKDIR /var/www/html

COPY --from=vendor /app .
COPY artisan .env.example ./
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/99-tapesh-opcache.ini

RUN chown -R www-data:www-data storage bootstrap/cache

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr_json

USER www-data

CMD ["php-fpm"]
