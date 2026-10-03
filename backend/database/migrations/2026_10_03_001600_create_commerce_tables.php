<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۸ — Commerce: محصول، طرح، قابلیت، سفارش، پرداخت، اشتراک، entitlement.
 *
 * مرز دامنه (Blueprint §4 و Prompt §90): هر جدول **یک** مالک دارد و هیچ‌کدام
 * جدول دامنهٔ دیگری را بازنویسی نمی‌کند. Content هیچ‌وقت به این جدول‌ها نگاه
 * نمی‌کند؛ فقط `EntitlementService` را صدا می‌زند.
 *
 * تصمیم‌های کلیدی:
 *   • **پول همیشه عدد صحیح minor است** (`*_minor bigint`). هیچ `float`/`decimal`
 *     برای مبلغ نیست: جمع اعشاری یعنی اختلاف یک‌ریالی در بازسازی معامله.
 *     `currency` کد ISO سه‌حرفی و از whitelist سمت سرویس است، نه ورودی آزاد.
 *   • **Snapshot تاریخی:** `orders.quote_snapshot` و `order_lines.snapshot` عکس
 *     لحظهٔ خرید هستند. تغییر قیمت طرح فردا، سفارش دیروز را عوض نمی‌کند.
 *     Snapshot هیچ رمز/توکن/Secret ندارد — فقط دادهٔ لازم برای بازسازی مبلغ.
 *   • **تغییرن‌پذیری مالی:** نه soft delete، نه cascade روی تاریخچهٔ مالی.
 *     FKها `RESTRICT` اند تا حذف تصادفی محصول، سفارش‌های گذشته را نبرد.
 *     حذف فیزیکی سفارش/پرداخت/اشتراک/entitlement در هیچ مسیری وجود ندارد.
 *   • **idempotency در دیتابیس:** `payments.authority` و
 *     `payments.provider_reference` یکتا (با شرط NOT NULL)، و
 *     `payment_webhooks UNIQUE(provider, event_id)`. این‌ها تنها تضمین واقعی
 *     ضد تکرار و ضد race هستند؛ بررسی «قبلاً دیدم؟» در کد race-safe نیست.
 *   • **قیدهای هم‌ارز:** `(status='paid') ⟷ paid_at`،
 *     `(verified ⟷ verified_at)`، `(revoked ⟷ revoked_at)` و
 *     `ends_at > starts_at`. قاعده‌ای که در کد هم نوشته می‌شود، اینجا هم قفل است.
 *   • `plan_id` در `study_groups` (فاز ۱۶) **دست‌نخورده** می‌ماند: یک رشتهٔ
 *     اطلاع‌رسانی بود، نه رابطه. اتصال واقعی گروه↔سفارش یک Use Case تازه است
 *     و در این فاز ساخته نشد (§61).
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const CURRENCY_CHECK = 'char_length(currency) = 3';

    public function up(): void
    {
        if ($this->isSqlite()) {
            foreach (self::sqliteStatements() as $statement) {
                DB::statement($statement);
            }

            return;
        }

        Schema::create('products', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('sku', 64)->unique();
            $table->string('kind', 24)->default('subscription');
            $table->string('name', 120);
            $table->string('status', 16)->default('draft');
            $table->timestampsTz();

            $table->index(['kind', 'status']);
        });
        $this->addCheck('products', 'products_status_valid', "status in ('draft','active','archived')");

        Schema::create('product_capabilities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('product_id');
            $table->string('code', 64);
            $table->string('coverage', 8)->default('full');
            $table->timestampsTz();

            $table->unique(['product_id', 'code']);
            $table->index('code');
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });
        $this->addCheck('product_capabilities', 'product_capabilities_coverage_valid', "coverage in ('full','partial')");

        Schema::create('plans', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 64)->unique();
            $table->uuid('product_id');
            $table->bigInteger('price_minor');
            $table->char('currency', 3);
            $table->unsignedSmallInteger('cycle_months');
            $table->unsignedSmallInteger('discount_percent')->default(0);
            $table->jsonb('pricing_rules')->nullable();
            $table->timestampTz('approved_at')->nullable();
            $table->string('status', 16)->default('draft');
            $table->timestampsTz();

            $table->unique(['product_id', 'cycle_months']);
            $table->index(['status', 'approved_at']);
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
        });
        $this->addCheck('plans', 'plans_status_valid', "status in ('draft','active','archived')");
        $this->addCheck('plans', 'plans_price_non_negative', 'price_minor >= 0');
        $this->addCheck('plans', 'plans_cycle_positive', 'cycle_months >= 1');
        $this->addCheck('plans', 'plans_discount_range', 'discount_percent >= 0 and discount_percent <= 100');
        $this->addCheck('plans', 'plans_currency_valid', self::CURRENCY_CHECK);

        Schema::create('orders', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('status', 20)->default('pending');
            $table->bigInteger('total_minor');
            $table->char('currency', 3);
            $table->jsonb('quote_snapshot');
            $table->timestampTz('expires_at');
            $table->timestampTz('paid_at')->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'created_at']);
            $table->index(['status', 'expires_at']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
        });
        $this->addCheck('orders', 'orders_status_valid', "status in ('pending','awaiting_payment','paid','failed','expired','cancelled')");
        $this->addCheck('orders', 'orders_total_non_negative', 'total_minor >= 0');
        $this->addCheck('orders', 'orders_currency_valid', self::CURRENCY_CHECK);
        $this->addCheck('orders', 'orders_paid_at_consistent', "(status = 'paid') = (paid_at is not null)");

        Schema::create('order_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('order_id');
            $table->uuid('product_id')->nullable();
            $table->uuid('plan_id')->nullable();
            $table->bigInteger('unit_minor');
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->bigInteger('line_total_minor');
            $table->jsonb('snapshot')->nullable();
            $table->timestampsTz();

            $table->index('order_id');
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
            $table->foreign('plan_id')->references('id')->on('plans')->restrictOnDelete();
        });
        $this->addCheck('order_lines', 'order_lines_unit_non_negative', 'unit_minor >= 0');
        $this->addCheck('order_lines', 'order_lines_line_total_non_negative', 'line_total_minor >= 0');
        $this->addCheck('order_lines', 'order_lines_quantity_positive', 'quantity >= 1');

        Schema::create('payments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('order_id')->nullable();
            $table->uuid('user_id');
            $table->string('provider', 32);
            $table->string('authority', 96)->nullable()->unique();
            $table->string('provider_reference', 96)->nullable()->unique();
            $table->string('status', 16)->default('pending');
            $table->bigInteger('amount_minor');
            $table->char('currency', 3);
            $table->timestampTz('verified_at')->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'created_at']);
            $table->index(['order_id', 'status']);
            $table->foreign('order_id')->references('id')->on('orders')->restrictOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
        });
        $this->addCheck('payments', 'payments_status_valid', "status in ('pending','verified','failed','expired','cancelled')");
        $this->addCheck('payments', 'payments_amount_non_negative', 'amount_minor >= 0');
        $this->addCheck('payments', 'payments_currency_valid', self::CURRENCY_CHECK);
        $this->addCheck('payments', 'payments_verified_at_consistent', "(status = 'verified') = (verified_at is not null)");

        Schema::create('payment_webhooks', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('provider', 32);
            $table->string('event_id', 96);
            $table->char('payload_hash', 64);
            $table->uuid('payment_id')->nullable();
            $table->uuid('order_id')->nullable();
            $table->string('status', 16)->default('received');
            $table->string('result', 48)->nullable();
            $table->timestampTz('processed_at')->nullable();
            $table->timestampsTz();

            $table->unique(['provider', 'event_id']);
            $table->index(['status', 'created_at']);
            $table->foreign('payment_id')->references('id')->on('payments')->restrictOnDelete();
            $table->foreign('order_id')->references('id')->on('orders')->restrictOnDelete();
        });
        $this->addCheck('payment_webhooks', 'payment_webhooks_status_valid', "status in ('received','processed','ignored','rejected')");

        Schema::create('subscriptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('plan_id')->nullable();
            $table->uuid('source_order_id')->nullable();
            $table->string('status', 20)->default('pending');
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at')->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'status', 'ends_at']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('plan_id')->references('id')->on('plans')->restrictOnDelete();
            $table->foreign('source_order_id')->references('id')->on('orders')->restrictOnDelete();
        });
        $this->addCheck('subscriptions', 'subscriptions_status_valid', "status in ('pending','active','expired','cancelled','revoked')");
        $this->addCheck('subscriptions', 'subscriptions_period_valid', 'ends_at is null or ends_at > starts_at');

        Schema::create('entitlements', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('capability', 64);
            $table->uuid('source_order_id')->nullable();
            $table->uuid('source_subscription_id')->nullable();
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at')->nullable();
            $table->timestampTz('revoked_at')->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'capability', 'ends_at']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('source_order_id')->references('id')->on('orders')->restrictOnDelete();
            $table->foreign('source_subscription_id')->references('id')->on('subscriptions')->restrictOnDelete();
        });
        $this->addCheck('entitlements', 'entitlements_period_valid', 'ends_at is null or ends_at > starts_at');
    }

    public function down(): void
    {
        Schema::dropIfExists('entitlements');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('payment_webhooks');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('order_lines');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('plans');
        Schema::dropIfExists('product_capabilities');
        Schema::dropIfExists('products');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            <<<'SQL'
            CREATE TABLE products (
                id varchar(36) not null primary key,
                sku varchar(64) not null,
                kind varchar(24) not null default 'subscription',
                name varchar(120) not null,
                status varchar(16) not null default 'draft',
                created_at datetime null,
                updated_at datetime null,
                constraint products_sku_unique unique (sku),
                constraint products_status_valid check (status in ('draft','active','archived'))
            )
            SQL,
            'CREATE INDEX products_kind_status_index ON products (kind, status)',
            <<<'SQL'
            CREATE TABLE product_capabilities (
                id varchar(36) not null primary key,
                product_id varchar(36) not null,
                code varchar(64) not null,
                coverage varchar(8) not null default 'full',
                created_at datetime null,
                updated_at datetime null,
                constraint product_capabilities_product_id_code_unique unique (product_id, code),
                constraint product_capabilities_coverage_valid check (coverage in ('full','partial')),
                foreign key (product_id) references products (id) on delete cascade
            )
            SQL,
            'CREATE INDEX product_capabilities_code_index ON product_capabilities (code)',
            <<<'SQL'
            CREATE TABLE plans (
                id varchar(36) not null primary key,
                code varchar(64) not null,
                product_id varchar(36) not null,
                price_minor integer not null,
                currency varchar(3) not null,
                cycle_months integer not null,
                discount_percent integer not null default 0,
                pricing_rules text null,
                approved_at datetime null,
                status varchar(16) not null default 'draft',
                created_at datetime null,
                updated_at datetime null,
                constraint plans_code_unique unique (code),
                constraint plans_product_id_cycle_months_unique unique (product_id, cycle_months),
                constraint plans_status_valid check (status in ('draft','active','archived')),
                constraint plans_price_non_negative check (price_minor >= 0),
                constraint plans_cycle_positive check (cycle_months >= 1),
                constraint plans_discount_range check (discount_percent >= 0 and discount_percent <= 100),
                constraint plans_currency_valid check (length(currency) = 3),
                foreign key (product_id) references products (id) on delete restrict
            )
            SQL,
            'CREATE INDEX plans_status_approved_at_index ON plans (status, approved_at)',
            <<<'SQL'
            CREATE TABLE orders (
                id varchar(36) not null primary key,
                user_id varchar(36) not null,
                status varchar(20) not null default 'pending',
                total_minor integer not null,
                currency varchar(3) not null,
                quote_snapshot text not null,
                expires_at datetime not null,
                paid_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint orders_status_valid check (status in ('pending','awaiting_payment','paid','failed','expired','cancelled')),
                constraint orders_total_non_negative check (total_minor >= 0),
                constraint orders_currency_valid check (length(currency) = 3),
                constraint orders_paid_at_consistent check ((status = 'paid') = (paid_at is not null)),
                foreign key (user_id) references users (id) on delete restrict
            )
            SQL,
            'CREATE INDEX orders_user_id_created_at_index ON orders (user_id, created_at)',
            'CREATE INDEX orders_status_expires_at_index ON orders (status, expires_at)',
            <<<'SQL'
            CREATE TABLE order_lines (
                id varchar(36) not null primary key,
                order_id varchar(36) not null,
                product_id varchar(36) null,
                plan_id varchar(36) null,
                unit_minor integer not null,
                quantity integer not null default 1,
                line_total_minor integer not null,
                snapshot text null,
                created_at datetime null,
                updated_at datetime null,
                constraint order_lines_unit_non_negative check (unit_minor >= 0),
                constraint order_lines_line_total_non_negative check (line_total_minor >= 0),
                constraint order_lines_quantity_positive check (quantity >= 1),
                foreign key (order_id) references orders (id) on delete cascade,
                foreign key (product_id) references products (id) on delete restrict,
                foreign key (plan_id) references plans (id) on delete restrict
            )
            SQL,
            'CREATE INDEX order_lines_order_id_index ON order_lines (order_id)',
            <<<'SQL'
            CREATE TABLE payments (
                id varchar(36) not null primary key,
                order_id varchar(36) null,
                user_id varchar(36) not null,
                provider varchar(32) not null,
                authority varchar(96) null,
                provider_reference varchar(96) null,
                status varchar(16) not null default 'pending',
                amount_minor integer not null,
                currency varchar(3) not null,
                verified_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint payments_authority_unique unique (authority),
                constraint payments_provider_reference_unique unique (provider_reference),
                constraint payments_status_valid check (status in ('pending','verified','failed','expired','cancelled')),
                constraint payments_amount_non_negative check (amount_minor >= 0),
                constraint payments_currency_valid check (length(currency) = 3),
                constraint payments_verified_at_consistent check ((status = 'verified') = (verified_at is not null)),
                foreign key (order_id) references orders (id) on delete restrict,
                foreign key (user_id) references users (id) on delete restrict
            )
            SQL,
            'CREATE INDEX payments_user_id_created_at_index ON payments (user_id, created_at)',
            'CREATE INDEX payments_order_id_status_index ON payments (order_id, status)',
            <<<'SQL'
            CREATE TABLE payment_webhooks (
                id varchar(36) not null primary key,
                provider varchar(32) not null,
                event_id varchar(96) not null,
                payload_hash varchar(64) not null,
                payment_id varchar(36) null,
                order_id varchar(36) null,
                status varchar(16) not null default 'received',
                result varchar(48) null,
                processed_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint payment_webhooks_provider_event_id_unique unique (provider, event_id),
                constraint payment_webhooks_status_valid check (status in ('received','processed','ignored','rejected')),
                foreign key (payment_id) references payments (id) on delete restrict,
                foreign key (order_id) references orders (id) on delete restrict
            )
            SQL,
            'CREATE INDEX payment_webhooks_status_created_at_index ON payment_webhooks (status, created_at)',
            <<<'SQL'
            CREATE TABLE subscriptions (
                id varchar(36) not null primary key,
                user_id varchar(36) not null,
                plan_id varchar(36) null,
                source_order_id varchar(36) null,
                status varchar(20) not null default 'pending',
                starts_at datetime not null,
                ends_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint subscriptions_status_valid check (status in ('pending','active','expired','cancelled','revoked')),
                constraint subscriptions_period_valid check (ends_at is null or ends_at > starts_at),
                foreign key (user_id) references users (id) on delete restrict,
                foreign key (plan_id) references plans (id) on delete restrict,
                foreign key (source_order_id) references orders (id) on delete restrict
            )
            SQL,
            'CREATE INDEX subscriptions_user_id_status_ends_at_index ON subscriptions (user_id, status, ends_at)',
            <<<'SQL'
            CREATE TABLE entitlements (
                id varchar(36) not null primary key,
                user_id varchar(36) not null,
                capability varchar(64) not null,
                source_order_id varchar(36) null,
                source_subscription_id varchar(36) null,
                starts_at datetime not null,
                ends_at datetime null,
                revoked_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint entitlements_period_valid check (ends_at is null or ends_at > starts_at),
                foreign key (user_id) references users (id) on delete restrict,
                foreign key (source_order_id) references orders (id) on delete restrict,
                foreign key (source_subscription_id) references subscriptions (id) on delete restrict
            )
            SQL,
            'CREATE INDEX entitlements_user_id_capability_ends_at_index ON entitlements (user_id, capability, ends_at)',
        ];
    }
};
