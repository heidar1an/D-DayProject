<?php

/*
 * سنجش واقعی کارایی پیمایش گراف دانش (§36 پرامپت فاز ۱۲) روی PostgreSQL واقعی.
 *
 * سناریوها: گراف ریشه‌دار با ۱/۱۰/۵۰/۱۰۰/۲۰۰ نود (و یال متناسب) × depth ۱/۲/۳.
 * خروجی: زمان (ms) و تعداد کوئری — سنجشِ «بدون N+1» این است که تعداد کوئری با
 * اندازهٔ گراف **تغییر نکند** (فقط تابع عمق است).
 *
 * داده با Eloquent ساخته می‌شود (۲۵۰ نود/۶۰۰ یال حداکثر) و بین سناریوها
 * `migrate:fresh` می‌شود تا سقف‌های config (۲۰۰/۵۰۰) سنجه را مخدوش نکنند.
 *
 * هیچ سرویس دائمی‌ای لازم ندارد؛ خوشهٔ موقت /tmp را bash بالا می‌آورد:
 *
 *   export LC_ALL=C LANG=C
 *   initdb -D /tmp/tapesh-perf-pg -U postgres -A trust --encoding=UTF8 --locale=C
 *   pg_ctl -D /tmp/tapesh-perf-pg -o "-p 55433 -k /tmp" -l /tmp/tapesh-perf-pg.log -w start
 *   createdb -h /tmp -p 55433 -U postgres tapesh_perf
 *   DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=55433 DB_DATABASE=tapesh_perf \
 *     DB_USERNAME=postgres DB_PASSWORD= CACHE_STORE=array php artisan migrate:fresh --force
 *   DB_CONNECTION=pgsql ... php scripts/measure-phase12.php
 *   pg_ctl -D /tmp/tapesh-perf-pg -w stop && rm -rf /tmp/tapesh-perf-pg /tmp/tapesh-perf-pg.log
 *
 * گارد: فقط روی دیتابیس‌ای که نامش «perf» دارد اجرا می‌شود — تا هرگز به دادهٔ
 * dev/production دست نزند.
 */

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\KnowledgeEdge;
use App\Models\KnowledgeNode;
use App\Services\Knowledge\KnowledgeGraphService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

$db = (string) config('database.connections.'.config('database.default').'.database');

if ((string) config('database.default') !== 'pgsql' || ! str_contains((string) $db, 'perf')) {
    fwrite(STDERR, "✗ این اسکریپت فقط روی خوشهٔ موقت PG با دیتابیس «*perf*» اجرا می‌شود (فعلی: {$db}).\n");
    exit(1);
}

$relations = ['part_of', 'causes', 'related_to', 'produces', 'regulates'];

function seedGraph(int $nodes, array $relations): array
{
    /* ترتیب حذف: اول یال‌ها (FK روی RESTRICT است). */
    DB::table('knowledge_edges')->delete();
    DB::table('knowledge_nodes')->delete();

    $ids = [];

    for ($i = 1; $i <= $nodes; $i++) {
        $node = new KnowledgeNode;
        $node->forceFill([
            'kind' => 'concept',
            'label' => 'نود '.$i,
            'status' => KnowledgeNode::STATUS_PUBLISHED,
        ])->save();
        $ids[$i] = $node->getKey();
    }

    /* گراف خطی-درختی: i → i+1 و i → i+2 (هر نود درجهٔ خروجی ۲) */
    $created = 0;

    for ($i = 1; $i < $nodes; $i++) {
        foreach ([$i + 1, $i + 2] as $offset) {
            if ($offset > $nodes) {
                continue;
            }

            $edge = new KnowledgeEdge;
            $edge->forceFill([
                'from_node_id' => $ids[$i],
                'to_node_id' => $ids[$offset],
                'relation_type' => $relations[$created % count($relations)],
            ])->save();
            $created++;
        }
    }

    return $ids;
}

$service = KnowledgeGraphService::fromConfig();

printf("%-10s %-7s %-12s %-10s\n", 'nodes', 'depth', 'time(ms)', 'queries');

foreach ([1, 10, 50, 100, 200] as $size) {
    $ids = seedGraph($size, $relations);
    $root = $ids[1];

    foreach ([1, 2, 3] as $depth) {
        KnowledgeGraphService::bumpCacheVersion(); // همیشه مسیر سرد اندازه‌گیری شود.

        DB::enableQueryLog();
        DB::flushQueryLog();

        $t0 = microtime(true);
        $result = $service->graph($root, $depth, null, null);
        $ms = (microtime(true) - $t0) * 1000;
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();

        printf("%-10d %-7d %-12.1f %-10d (nodes=%d edges=%d)\n", $size, $depth, $ms, $queries, count($result['nodes']), count($result['edges']));
    }
}

/* حالت کل گراف (بدون ریشه) — باید ۲ کوئری باشد. */
seedGraph(200, $relations);
KnowledgeGraphService::bumpCacheVersion();

DB::enableQueryLog();
DB::flushQueryLog();
$t0 = microtime(true);
$result = $service->graph(null, null, null, null);
$ms = (microtime(true) - $t0) * 1000;
$queries = count(DB::getQueryLog());
DB::disableQueryLog();

printf("%-10s %-7s %-12.1f %-10d (nodes=%d edges=%d)\n", 'whole', '-', $ms, $queries, count($result['nodes']), count($result['edges']));

Cache::forget(KnowledgeGraphService::CACHE_VERSION_KEY);

echo "OK\n";
