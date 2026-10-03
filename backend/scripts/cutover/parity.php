<?php

/*
 * فاز ۲۲ — Parity خواندنی: legacy (Node) در برابر Laravel.
 *
 * این اسکریپت **هیچ چیزی را وارد نمی‌کند و هیچ جدولی را نمی‌نویسد**. فقط:
 *   ۱. counts هر جدول مقصد را با inventory می‌سنجد
 *   ۲. یتیم‌های FK را در جدول‌های نگاشت‌شده گزارش می‌کند
 *   ۳. اگر اختلاف باشد، کد خروج ۱ می‌دهد (گیت Cutover)
 *
 * اجرا (از پوشهٔ backend):
 *   php scripts/cutover/parity.php                 # گزارش
 *   php scripts/cutover/parity.php --write         # + docs/phase22-parity.json
 *   php scripts/cutover/parity.php --require=Auth  # فقط یک دامنه
 */

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$inventoryPath = __DIR__.'/../../docs/phase22-inventory.json';

if (! is_file($inventoryPath)) {
    fwrite(STDERR, "inventory نیست: docs/phase22-inventory.json — اول inventory.mjs را با --write اجرا کن.\n");
    exit(2);
}

$inventory = json_decode((string) file_get_contents($inventoryPath), true, 512, JSON_THROW_ON_ERROR);
$write = in_array('--write', $argv, true);
$onlyDomain = null;

foreach ($argv as $argument) {
    if (str_starts_with($argument, '--require=')) {
        $onlyDomain = substr($argument, 10);
    }
}

/** یتیم‌های FK که در Cutover باید صفر باشند. */
$orphanChecks = [
    ['articles', 'category_id', 'article_categories'],
    ['exam_questions', 'exam_id', 'exams'],
    ['exam_attempts', 'user_id', 'users'],
    ['exam_results', 'exam_id', 'exams'],
    ['flashcard_decks', 'owner_user_id', 'users'],
    ['feedback_replies', 'feedback_id', 'feedback'],
];

$domains = [];
$failures = 0;

foreach ($inventory['stores'] as $store) {
    $table = $store['table'] ?? null;

    if ($table === null) {
        continue;
    }

    if ($onlyDomain !== null && ($store['domain'] ?? null) !== $onlyDomain) {
        continue;
    }

    $legacy = (int) ($store['records'] ?? 0);
    $exists = Schema::hasTable($table);
    $laravel = $exists ? (int) DB::table($table)->count() : null;
    $delta = $laravel === null ? null : $laravel - $legacy;
    $policy = $store['policy'] ?? null;

    /*
     * entityهای «سیاست‌دار» (مثل session با `re-login`) عمداً مهاجرت نمی‌شوند؛
     * نباید به‌عنوان شکست parity شمرده شوند، ولی باید **دیده** شوند.
     */
    $excluded = $policy !== null;
    $parity = $excluded ? false : ($delta === 0);

    if (! $excluded && ! $parity) {
        $failures++;
    }

    $domains[] = [
        'domain' => $store['domain'],
        'entity' => $store['entity'],
        'table' => $table,
        'legacy' => $legacy,
        'laravel' => $laravel,
        'delta' => $delta,
        'parity' => $parity,
        'policy' => $policy,
        'status' => $excluded
            ? 'excluded_by_policy'
            : (! $exists ? 'table_missing' : ($parity ? 'parity' : 'not_migrated')),
    ];
}

$orphans = [];

foreach ($orphanChecks as [$table, $column, $parent]) {
    if (! Schema::hasTable($table) || ! Schema::hasTable($parent)) {
        continue;
    }

    $count = (int) DB::table($table)
        ->leftJoin($parent, $parent.'.id', '=', $table.'.'.$column)
        ->whereNotNull($table.'.'.$column)
        ->whereNull($parent.'.id')
        ->count();

    $orphans[] = ['table' => $table, 'column' => $column, 'parent' => $parent, 'orphans' => $count];
}

$report = [
    'phase' => 22,
    'kind' => 'legacy-laravel-parity',
    'generatedAt' => now()->toIso8601String(),
    'connection' => DB::connection()->getDriverName(),
    'database' => DB::connection()->getDatabaseName(),
    'inventoryGeneratedAt' => $inventory['generatedAt'] ?? null,
    'totals' => [
        'domains' => count($domains),
        'inParity' => count(array_filter($domains, static fn (array $row): bool => $row['parity'])),
        'notMigrated' => count(array_filter($domains, static fn (array $row): bool => $row['status'] === 'not_migrated')),
        'excludedByPolicy' => count(array_filter($domains, static fn (array $row): bool => $row['status'] === 'excluded_by_policy')),
        'tableMissing' => count(array_filter($domains, static fn (array $row): bool => $row['status'] === 'table_missing')),
    ],
    'domains' => $domains,
    'orphanChecks' => $orphans,
];

printf("اتصال: %s / %s\n", $report['connection'], $report['database']);
printf("دامنه: %d · هم‌تراز: %d · مهاجرت‌نشده: %d · جدول‌ناموجود: %d\n\n",
    $report['totals']['domains'], $report['totals']['inParity'],
    $report['totals']['notMigrated'], $report['totals']['tableMissing']);

foreach ($domains as $row) {
    printf("%-12s %-20s %-24s legacy=%-6d laravel=%-6s %s\n",
        (string) $row['domain'], (string) $row['entity'], (string) $row['table'],
        $row['legacy'], $row['laravel'] === null ? '—' : (string) $row['laravel'], $row['status']);
}

$orphanTotal = array_sum(array_column($orphans, 'orphans'));

printf("\nیتیم‌های FK: %d\n", $orphanTotal);

if ($write) {
    file_put_contents(__DIR__.'/../../docs/phase22-parity.json', json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)."\n");
    echo "نوشته شد: backend/docs/phase22-parity.json\n";
}

/*
 * کد خروج: ۰ یعنی هیچ اختلافی نیست (یا هنوز جدولی ساخته نشده)، ۱ یعنی اختلاف
 * count یا یتیم FK وجود دارد ⇒ گیت Cutover باز نمی‌شود.
 */
exit(($failures > 0 || $orphanTotal > 0) ? 1 : 0);
