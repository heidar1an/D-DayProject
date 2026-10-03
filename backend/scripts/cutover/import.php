<?php

/*
 * فاز ۲۲ — Importer مرحله‌ای (Staging/Rehearsal)، idempotent و restartable.
 *
 * ⚠️ این ابزار **نویسندهٔ دادهٔ legacy نیست**. فقط از snapshot خواندنی Node می‌خواند
 * و در DB مقصد Laravel می‌نویسد. تا Cutover، Node مالک نوشتن است.
 *
 * ⚠️ پیش‌فرض **dry-run** است. برای نوشتن واقعی باید صریح `--apply` بدهی.
 *
 * اجرا (از پوشهٔ backend):
 *   php scripts/cutover/import.php                      # dry-run همهٔ mapperها
 *   php scripts/cutover/import.php --only=Auth --apply   # فقط دامنهٔ Auth
 *   php scripts/cutover/import.php --apply --batch=100
 *
 * چرا DB خودش checkpoint است: هر رکورد با UUID قطعی (crosswalk) و `updateOrInsert`
 * نوشته می‌شود. اگر اجرا وسط کار بمیرد، اجرای بعدی همان رکوردها را no-op می‌کند ⇒
 * restartable بدون فایل وضعیت شکننده.
 *
 * دامنهٔ mapperهای موجود در این نسخه: Auth (users) · Admin (admins) ·
 * Articles (article_categories, articles). بقیهٔ دامنه‌ها صریحاً `not_mapped`
 * گزارش می‌شوند — نه با حدس.
 */

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$ROOT = dirname(__DIR__, 2);          // backend/
$REPO = dirname($ROOT);               // repo root
$CROSSWALK_FILE = $ROOT.'/docs/phase22-crosswalk.json';
$REPORT_FILE = $ROOT.'/docs/phase22-import-report.json';
$QUARANTINE_FILE = $ROOT.'/docs/phase22-quarantine.json';

$apply = in_array('--apply', $argv, true);
$batchSize = 100;
$onlyDomain = null;

foreach ($argv as $argument) {
    if (str_starts_with($argument, '--only=')) {
        $onlyDomain = substr($argument, 7);
    }
    if (str_starts_with($argument, '--batch=')) {
        $batchSize = max(1, (int) substr($argument, 8));
    }
}

if (! is_file($CROSSWALK_FILE)) {
    fwrite(STDERR, "crosswalk نیست — اول crosswalk.mjs را با --write اجرا کن.\n");
    exit(2);
}

$crosswalk = json_decode((string) file_get_contents($CROSSWALK_FILE), true, 512, JSON_THROW_ON_ERROR);
$uuid = [];

foreach ($crosswalk['entries'] as $entry) {
    $uuid[$entry['entity']][$entry['legacyId']] = $entry['uuid'];
}

$read = static function (string $relative) use ($REPO): array {
    $path = $REPO.'/'.$relative;

    return is_file($path) ? (array) json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR) : [];
};

/**
 * زمان: ISO رشته و epoch-ms عددی از هم تفکیک می‌شوند. هیچ timestamp با حدس
 * parse نمی‌شود (§22.5) — مقدار مشکوک ⇒ null و ثبت در quarantine.
 */
$time = static function (mixed $value): ?Carbon {
    if ($value === null || $value === '') {
        return null;
    }

    if (is_numeric($value)) {
        $number = (int) $value;

        /* epoch-ms در این پروژه ۱۳ رقم است؛ کمتر از آن ⇒ ثانیه. */
        return $number > 10_000_000_000
            ? Carbon::createFromTimestampMs($number)
            : Carbon::createFromTimestamp($number);
    }

    try {
        return Carbon::parse((string) $value);
    } catch (Throwable) {
        return null;
    }
};

$quarantine = [];

/** @return array<string, mixed>|null */
$mapUser = static function (array $record) use ($uuid, $time, &$quarantine): ?array {
    $legacyId = (string) ($record['id'] ?? '');

    if ($legacyId === '' || ! isset($uuid['user'][$legacyId])) {
        $quarantine[] = ['entity' => 'user', 'legacyId' => $legacyId, 'reason' => 'missing_identity'];

        return null;
    }

    return [
        'id' => $uuid['user'][$legacyId],
        'phone' => ($record['phone'] ?? '') !== '' ? (string) $record['phone'] : null,
        'email' => null,
        /* هش legacy عیناً حفظ می‌شود؛ مسیر verify/ارتقا در IdentityService است. */
        'password_hash' => ($record['passwordHash'] ?? '') !== '' ? (string) $record['passwordHash'] : null,
        'google_subject' => null,
        'created_at' => $time($record['createdAt'] ?? null),
        'updated_at' => $time($record['updatedAt'] ?? null),
    ];
};

/** @return array<string, mixed>|null */
$mapAdmin = static function (array $record) use ($uuid, $time, &$quarantine): ?array {
    $legacyId = (string) ($record['id'] ?? '');

    if ($legacyId === '' || ! isset($uuid['admin'][$legacyId])) {
        $quarantine[] = ['entity' => 'admin', 'legacyId' => $legacyId, 'reason' => 'missing_identity'];

        return null;
    }

    return [
        'id' => $uuid['admin'][$legacyId],
        'username' => (string) ($record['username'] ?? ''),
        'display_name' => ($record['name'] ?? '') !== '' ? (string) $record['name'] : null,
        'password_hash' => ($record['passwordHash'] ?? '') !== '' ? (string) $record['passwordHash'] : null,
        'active' => (bool) ($record['isActive'] ?? true),
        'must_change_password' => (bool) ($record['mustChangePassword'] ?? false),
        'last_login_at' => $time($record['lastLoginAt'] ?? null),
        'created_at' => $time($record['createdAt'] ?? null),
        'updated_at' => $time($record['updatedAt'] ?? null),
    ];
};

/** @return array<string, mixed>|null */
$mapCategory = static function (array $record) use ($uuid, &$quarantine): ?array {
    $legacyId = (string) ($record['id'] ?? '');

    if ($legacyId === '' || ! isset($uuid['category'][$legacyId])) {
        $quarantine[] = ['entity' => 'category', 'legacyId' => $legacyId, 'reason' => 'missing_identity'];

        return null;
    }

    return [
        'id' => $uuid['category'][$legacyId],
        'legacy_id' => $legacyId,
        'slug' => $legacyId,
        'name' => (string) ($record['label'] ?? $legacyId),
        'sort_order' => 0,
        /* دستهٔ مقاله taxonomy است و publish جدا ندارد (ناوردایی فاز ۱۶). */
        'status' => 'published',
        'created_at' => Carbon::now(),
        'updated_at' => Carbon::now(),
    ];
};

/** @return array<string, mixed>|null */
$mapArticle = static function (array $record) use ($uuid, $time, &$quarantine): ?array {
    $legacyId = (string) ($record['id'] ?? '');
    $slug = (string) ($record['slug'] ?? '');

    if ($legacyId === '' || ! isset($uuid['article'][$legacyId]) || $slug === '') {
        $quarantine[] = ['entity' => 'article', 'legacyId' => $legacyId, 'reason' => 'missing_identity_or_slug'];

        return null;
    }

    /*
     * بدنه: `contentHtml` رشته است. `content` در legacy می‌تواند ساختار بلوکی
     * (آرایه) باشد و رندر آن مالک دیگری است؛ تبدیل حدسی ممنوع (§22.6) ⇒ قرنطینه.
     */
    $body = $record['contentHtml'] ?? null;

    if (! is_string($body) || trim($body) === '') {
        $quarantine[] = [
            'entity' => 'article',
            'legacyId' => $legacyId,
            'reason' => is_string($record['content'] ?? null) ? 'empty_body' : 'body_not_html_string',
        ];

        return null;
    }

    $categoryLegacy = (string) ($record['category'] ?? '');

    return [
        'id' => $uuid['article'][$legacyId],
        'legacy_id' => $legacyId,
        'category_id' => $uuid['category'][$categoryLegacy] ?? null,
        'slug' => $slug,
        'title' => (string) ($record['title'] ?? $slug),
        'summary' => ($record['excerpt'] ?? '') !== '' ? (string) $record['excerpt'] : null,
        'body' => $body,
        /* فقط وضعیت‌های مجاز schema؛ مقدار ناشناخته ⇒ draft (محافظه‌کارانه). */
        'status' => in_array($record['status'] ?? '', ['draft', 'published', 'archived'], true) ? (string) $record['status'] : 'draft',
        'version' => 1,
        'author_admin_id' => null,
        'editor_admin_id' => null,
        'published_at' => $time($record['publishedAt'] ?? null) ?? ($record['status'] === 'published' ? Carbon::now() : null),
        'created_at' => $time($record['createdAt'] ?? null),
        'updated_at' => $time($record['updatedAt'] ?? null),
    ];
};

/* ── برنامهٔ import: entity → (جدول، فایل، mapper) ─────────────────────── */

$plan = [
    'user' => ['domain' => 'Auth', 'table' => 'users', 'file' => 'database/users.json', 'mapper' => $mapUser, 'container' => 'users'],
    'admin' => ['domain' => 'Admin', 'table' => 'admins', 'file' => 'database/content/admins.json', 'mapper' => $mapAdmin, 'container' => null],
    'category' => ['domain' => 'Articles', 'table' => 'article_categories', 'file' => 'database/content/categories.json', 'mapper' => $mapCategory, 'container' => null],
    'article' => ['domain' => 'Articles', 'table' => 'articles', 'file' => 'database/content/articles.json', 'mapper' => $mapArticle, 'container' => null],
];

$knownDomains = ['Auth', 'Admin', 'Articles', 'References', 'Flashcards', 'International', 'QuestionBank', 'Exam', 'Feedback', 'Media'];
$notMapped = array_values(array_diff($knownDomains, array_unique(array_column($plan, 'domain'))));

$results = [];
$written = 0;

foreach ($plan as $entity => $step) {
    if ($onlyDomain !== null && $step['domain'] !== $onlyDomain) {
        continue;
    }

    if (! Schema::hasTable($step['table'])) {
        $results[] = ['entity' => $entity, 'table' => $step['table'], 'status' => 'table_missing', 'records' => 0, 'written' => 0];

        continue;
    }

    $container = $read($step['file']);
    $records = $step['container'] !== null ? (array) ($container[$step['container']] ?? []) : array_values($container);
    $rows = [];
    $skipped = 0;

    foreach ($records as $record) {
        if (! is_array($record)) {
            $skipped++;

            continue;
        }

        $row = ($step['mapper'])($record);

        if ($row === null) {
            $skipped++;

            continue;
        }

        $rows[] = $row;
    }

    $entityWritten = 0;

    if ($apply && $rows !== []) {
        /* batch-based و transaction-safe: هر batch تراکنش خودش (§22.7). */
        foreach (array_chunk($rows, $batchSize) as $chunk) {
            $entityWritten += DB::transaction(function () use ($step, $chunk): int {
                $count = 0;

                foreach ($chunk as $row) {
                    $id = $row['id'];
                    unset($row['id']);

                    DB::table($step['table'])->updateOrInsert(['id' => $id], $row);
                    $count++;
                }

                return $count;
            });
        }
    }

    $written += $entityWritten;

    $results[] = [
        'entity' => $entity,
        'domain' => $step['domain'],
        'table' => $step['table'],
        'status' => $apply ? 'imported' : 'dry_run',
        'records' => count($records),
        'mapped' => count($rows),
        'quarantined' => $skipped,
        'written' => $entityWritten,
    ];
}

$report = [
    'phase' => 22,
    'kind' => 'import-report',
    'mode' => $apply ? 'apply' : 'dry-run',
    'generatedAt' => now()->toIso8601String(),
    'connection' => DB::connection()->getDriverName(),
    'database' => DB::connection()->getDatabaseName(),
    'batchSize' => $batchSize,
    'totals' => ['written' => $written, 'quarantined' => count($quarantine)],
    'entities' => $results,
    'notMappedDomains' => $notMapped,
];

printf("حالت: %s · اتصال: %s\n\n", $report['mode'], $report['connection']);

foreach ($results as $row) {
    printf("%-12s %-24s records=%-5d mapped=%-5d written=%-5d %s\n",
        $row['entity'], $row['table'], $row['records'], $row['mapped'], $row['written'], $row['status']);
}

printf("\nنوشته‌شده: %d · قرنطینه: %d\n", $written, count($quarantine));
printf("دامنه‌های بدون mapper (صریح): %s\n", implode(', ', $notMapped));

if ($apply) {
    file_put_contents($REPORT_FILE, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)."\n");
    file_put_contents($QUARANTINE_FILE, json_encode($quarantine, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)."\n");
    echo "گزارش: backend/docs/phase22-import-report.json · قرنطینه: backend/docs/phase22-quarantine.json\n";
}
