<?php

namespace App\Console\Commands;

use App\Jobs\RebuildSearchIndexJob;
use App\Services\Search\SearchIndexer;
use Illuminate\Console\Command;
use InvalidArgumentException;

/**
 * بازسازی ایندکس جست‌وجو — فاز ۱۹ (§41).
 *
 * داخلی/ادمین-محور است، نه Public API. `--queue` برای دادهٔ بزرگ: کار به Worker
 * سپرده می‌شود تا دستور CLI ساعت‌ها نبندد.
 */
final class SearchRebuildCommand extends Command
{
    protected $signature = 'search:rebuild
        {--type= : فقط یک دامنه (پیش‌فرض: همه)}
        {--queue : اجرا به‌صورت Job در صف به‌جای اجرای همزمان}';

    protected $description = 'بازسازی ایندکس جست‌وجو (projection بازسازپذیر، نه منبع حقیقت)';

    public function handle(SearchIndexer $indexer): int
    {
        $type = $this->option('type');
        $type = is_string($type) && $type !== '' ? $type : null;

        if ($this->option('queue')) {
            RebuildSearchIndexJob::dispatch($type);

            $this->info('search rebuild queued.');

            return self::SUCCESS;
        }

        try {
            $indexed = $indexer->rebuild($type, function (string $entityType, int $count): void {
                $this->line("  {$entityType}: {$count}");
            });
        } catch (InvalidArgumentException $error) {
            $this->error($error->getMessage());

            return self::FAILURE;
        }

        foreach ($indexed as $entityType => $count) {
            $this->info("{$entityType}: {$count} document(s) indexed.");
        }

        return self::SUCCESS;
    }
}
