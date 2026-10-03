<?php

/*
 * سنجش واقعی کارایی دو کوئری حساس فاز ۹/۱۰ روی PostgreSQL واقعی (§47):
 *
 *   ۱) صف مرور فلشکارت (due states + new cards با NOT EXISTS)
 *   ۲) جست‌وجوی ویکی (LIKE با نرمال‌سازی دو-variant + facets)
 *
 * داده با generate_series ساخته می‌شود (اسکیل laravel-pg-real-verification، گام ۴).
 * هیچ سرویس دائمی‌ای لازم ندارد؛ خوشهٔ موقت /tmp را bash بالا می‌آورد:
 *
 *   export LC_ALL=C LANG=C
 *   initdb -D /tmp/tapesh-perf-pg -U postgres -A trust --encoding=UTF8 --locale=C
 *   pg_ctl -D /tmp/tapesh-perf-pg -o "-p 55433 -k /tmp" -l /tmp/tapesh-perf-pg.log -w start
 *   createdb -h /tmp -p 55433 -U postgres tapesh_perf
 *   DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=55433 DB_DATABASE=tapesh_perf \
 *     DB_USERNAME=postgres DB_PASSWORD= CACHE_STORE=array php artisan migrate:fresh --force
 *   DB_CONNECTION=pgsql ... php scripts/measure-phase9-10-pg.php
 *   pg_ctl -D /tmp/tapesh-perf-pg -w stop && rm -rf /tmp/tapesh-perf-pg /tmp/tapesh-perf-pg.log
 *
 * گارد: فقط روی دیتابیس‌ای که نامش «perf» دارد اجرا می‌شود — تا هرگز به دادهٔ
 * dev/production دست نزند.
 */

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use App\Models\User;
use App\Services\Flashcards\FlashcardQueryService;
use App\Services\Flashcards\FlashcardReviewService;
use App\Services\Wiki\WikiQueryService;
use App\Services\Wiki\WikiSearchService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

$db = (string) config('database.connections.'.config('database.default').'.database');

if ((string) config('database.default') !== 'pgsql' || ! str_contains((string) $db, 'perf')) {
    fwrite(STDERR, "✗ این اسکریپت فقط روی خوشهٔ موقت PG با دیتابیس «*perf*» اجرا می‌شود (فعلی: {$db}).\n");
    exit(1);
}

$t0 = microtime(true);

/* ── ۱) دادهٔ ساختگی با حجم واقع‌نما ── */

DB::statement("INSERT INTO users (id, phone, password_hash, created_at, updated_at)
    SELECT gen_random_uuid(), '0930' || lpad(g::text, 5, '0'), 'x', now(), now()
    FROM generate_series(1, 300) g ON CONFLICT DO NOTHING");

$me = User::query()->where('phone', '09300001')->first() ?? User::query()->orderBy('phone')->first();

/* دک رسمی: ۶۰ دک منتشرشدهٔ عمومی (owner NULL) × ۴۰ کارت + ۱۰۰ دک شخصی × ۱۲ کارت */
DB::statement("INSERT INTO flashcard_decks (id, title, status, visibility, version, published_at, created_at, updated_at)
    SELECT gen_random_uuid(), 'دک رسمی ' || g, 'published', 'public', 1, now(), now(), now()
    FROM generate_series(1, 60) g");
DB::statement("INSERT INTO flashcard_decks (id, owner_user_id, title, status, visibility, version, created_at, updated_at)
    SELECT gen_random_uuid(), u.id, 'دک شخصی ' || u.phone, 'published', 'private', 1, now(), now()
    FROM (SELECT id, phone, row_number() OVER (ORDER BY id) rn FROM users ORDER BY id LIMIT 100) u");
DB::statement("INSERT INTO flashcards (id, deck_id, front, back, position, status, created_at, updated_at)
    SELECT gen_random_uuid(), d.id, 'پرسش کارت ' || g, 'پاسخ کارت ' || g, g, 'active', now(), now()
    FROM (SELECT id FROM flashcard_decks WHERE owner_user_id IS NULL) d CROSS JOIN generate_series(1, 40) g");
DB::statement("INSERT INTO flashcards (id, deck_id, front, back, position, status, created_at, updated_at)
    SELECT gen_random_uuid(), d.id, 'پرسش شخصی ' || g, 'پاسخ ' || g, g, 'active', now(), now()
    FROM (SELECT id FROM flashcard_decks WHERE owner_user_id IS NOT NULL) d CROSS JOIN generate_series(1, 12) g");

/* وضعیت مرور: ۵۰ کاربر × ۲٬۴۰۰ کارت رسمی = ۱۲۰ هزار ردیف؛ ۳۰٪ سرآموخته، ۲٪ معلق */
DB::statement("INSERT INTO flashcard_states
    (id, user_id, card_id, algorithm_version, state, due_at, interval_days, interval_minutes, ease,
     learning_step, mastery_score, review_count, correct_count, incorrect_count, difficulty, stability,
     suspended, bookmarked, version, created_at, updated_at)
    SELECT gen_random_uuid(), u.id, c.id, 'sm2-tapesh-v1',
        CASE WHEN (u.rn * c.rn) % 17 = 3 THEN 'learning' ELSE 'review' END,
        CASE WHEN (u.rn + c.rn) % 10 < 3 THEN now() - interval '3 hours'
             ELSE now() + (((u.rn + c.rn) % 30) * interval '1 day') END,
        (u.rn + c.rn) % 21, ((u.rn + c.rn) % 21) * 1440, 2.5, 0,
        (u.rn * c.rn) % 100, 3, 2, 1, 0.3, 1.0,
        (u.rn * c.rn) % 50 = 7, false, 1, now(), now()
    FROM (SELECT id, row_number() OVER (ORDER BY id) rn FROM users ORDER BY id LIMIT 50) u
    CROSS JOIN (SELECT f.id, row_number() OVER (ORDER BY f.id) rn FROM flashcards f
                JOIN flashcard_decks d ON d.id = f.deck_id WHERE d.owner_user_id IS NULL) c");

/* تاریخچهٔ مرور: ۲۰ هزار رخداد تغییرناپذیر (بدون updated_at) */
DB::statement("INSERT INTO flashcard_reviews
    (id, state_id, rating, previous_state, new_state, previous_interval_minutes, next_interval_minutes,
     previous_ease, next_ease, previous_due_at, next_due_at, algorithm_version, request_key, reviewed_at, created_at)
    SELECT gen_random_uuid(), s.id,
        (ARRAY['again','hard','good','easy'])[1 + (s.rn % 4)], 'review', 'review',
        4320, 5760, 2.5, 2.5, now() - interval '4 days', now() + interval '4 days',
        'sm2-tapesh-v1', 'perf-' || s.rn || '-' || md5(random()::text), now() - (s.rn * interval '1 minute'), now() - (s.rn * interval '1 minute')
    FROM (SELECT id, row_number() OVER (ORDER BY id) rn FROM flashcard_states LIMIT 20000) s");

/* ویکی: ۴۰ دسته، ۱٬۲۰۰ مقاله (۱٬۰۰۰ منتشرشده؛ هر دهمی بدنه‌اش «کلیه» دارد)، روابط و نشانک */
DB::statement("INSERT INTO wiki_categories (id, slug, name, status, sort_order, created_at, updated_at)
    SELECT gen_random_uuid(), 'perf-cat-' || g, 'دسته ' || g, 'published', g, now(), now()
    FROM generate_series(1, 40) g");
DB::statement("INSERT INTO wiki_articles
    (id, slug, category_id, title, summary, body, subject, content_type, difficulty,
     key_facts, keywords, read_minutes, popularity, status, version, published_at, created_at, updated_at)
    SELECT gen_random_uuid(), 'perf-a-' || lpad(g::text, 4, '0'), c.id,
        'مقاله ' || g || CASE WHEN g % 10 = 0 THEN ' کلیه' ELSE ' قلب' END,
        'خلاصهٔ مقاله ' || g || ' دربارهٔ دستگاه ' || CASE WHEN g % 10 = 0 THEN 'کلیوی' ELSE 'قلبی' END,
        repeat('متن آزمایشی کلیه و قلب و اعصاب برای سنجش جست‌وجوی واقعی. ', 40) || ' شناسهٔ ' || g,
        'physiology', (ARRAY['concept','disease','drug','anatomy'])[1 + g % 4],
        (ARRAY['basic','intermediate','advanced'])[1 + g % 3], NULL, NULL,
        5 + g % 15, (g * 7) % 1000,
        CASE WHEN g % 12 = 0 THEN 'draft' WHEN g % 12 = 1 THEN 'archived' ELSE 'published' END,
        1, CASE WHEN g % 12 > 1 THEN now() - ((g % 400) * interval '1 day') END, now(), now()
    FROM generate_series(1, 1200) g
    JOIN LATERAL (SELECT id FROM wiki_categories ORDER BY id OFFSET (g % 40) LIMIT 1) c ON true");
DB::statement("INSERT INTO wiki_relations (id, from_article_id, to_article_id, kind, created_at, updated_at)
    SELECT gen_random_uuid(), f.id, t.id,
        (ARRAY['related_to','regulates','regulated_by','part_of','contains','produces','causes','caused_by','treated_by','measured_by','measures'])[1 + g % 11],
        now(), now()
    FROM generate_series(1, 2400) g
    JOIN LATERAL (SELECT id FROM wiki_articles WHERE status = 'published' ORDER BY id OFFSET 1 LIMIT 1) f ON true
    JOIN LATERAL (SELECT id FROM wiki_articles WHERE status = 'published' ORDER BY id OFFSET (1 + (g * 13) % 998) LIMIT 1) t ON true
    WHERE f.id <> t.id
    ON CONFLICT DO NOTHING");
DB::statement("INSERT INTO wiki_bookmarks (id, user_id, article_id, created_at, updated_at)
    SELECT gen_random_uuid(), u.id, a.id, now(), now()
    FROM (SELECT id, row_number() OVER (ORDER BY id) rn FROM users ORDER BY id LIMIT 50) u
    JOIN (SELECT id, row_number() OVER (ORDER BY id) rn FROM wiki_articles WHERE status = 'published' ORDER BY id LIMIT 1000) a
        ON a.rn <= 12 AND (u.rn * a.rn) % 7 = 0
    ON CONFLICT DO NOTHING");

DB::statement('ANALYZE');

/* کاربر اندازه‌گیری باید از میان کاربرانی باشد که وضعیت مرور دارند — وگرنه
 * مسیر due صف سنجیده نمی‌شود. پس از seed انتخاب می‌شود، نه قبل از آن. */
$me = User::query()->select('users.*')
    ->join('flashcard_states', 'flashcard_states.user_id', '=', 'users.id')
    ->groupBy('users.id')
    ->orderByRaw('count(*) desc')
    ->first() ?? $me;

$seedSeconds = round(microtime(true) - $t0, 1);
$counts = [
    'users' => DB::selectOne('SELECT count(*) c FROM users')->c,
    'states' => DB::selectOne('SELECT count(*) c FROM flashcard_states')->c,
    'reviews' => DB::selectOne('SELECT count(*) c FROM flashcard_reviews')->c,
    'articles(published)' => DB::selectOne("SELECT count(*) c FROM wiki_articles WHERE status = 'published'")->c,
    'relations' => DB::selectOne('SELECT count(*) c FROM wiki_relations')->c,
    'bookmarks' => DB::selectOne('SELECT count(*) c FROM wiki_bookmarks')->c,
];

/* ── ۲) سنجش عملیات واقعی سرویس‌ها (۱۵ بار پس از warm-up) ── */

$reviews = app(FlashcardReviewService::class);
$flashQuery = app(FlashcardQueryService::class);
$wikiSearch = app(WikiSearchService::class);
$wikiQuery = app(WikiQueryService::class);

$deckId = DB::selectOne('SELECT id FROM flashcard_decks WHERE owner_user_id IS NULL ORDER BY id LIMIT 1')->id;
$sampleArticle = $wikiQuery->publishedBySlug('perf-a-0003');

function measure(string $label, callable $fn, int $n = 15): array
{
    $fn(); // warm-up (plan cache، connection)

    $times = [];

    for ($i = 0; $i < $n; $i++) {
        $start = microtime(true);
        $fn();
        $times[] = (microtime(true) - $start) * 1000;
    }

    sort($times);

    return [
        'label' => $label,
        'mean' => round(array_sum($times) / $n, 2),
        'p95' => round($times[(int) floor($n * 0.95) - 1], 2),
        'min' => round($times[0], 2),
        'max' => round($times[$n - 1], 2),
    ];
}

$rows = [
    measure('flashcards: queue(today)', fn () => $reviews->queue($me, ['mode' => 'today'])),
    measure('flashcards: queue(deck)', fn () => $reviews->queue($me, ['mode' => 'deck', 'deckId' => $deckId])),
    measure('flashcards: progress', fn () => $reviews->progress($me)),
    measure('flashcards: decks(list)', fn () => $flashQuery->decks($me, [], 20)),
    measure("wiki: search('کلیه') + facets", fn () => $wikiSearch->search(['q' => 'کلیه'], 20)),
    measure('wiki: search(no-match)', fn () => $wikiSearch->search(['q' => 'کبد'], 20)),
    measure("wiki: suggest('کلیه')", fn () => $wikiSearch->suggest('کلیه', 8)),
    measure('wiki: relations(article)', fn () => $wikiQuery->relations($sampleArticle)),
];

/* ── ۳) EXPLAIN (ANALYZE, BUFFERS) روی SQL واقعیِ ثبت‌شده در query log ── */

DB::enableQueryLog();
$reviews->queue($me, ['mode' => 'today']);
$wikiSearch->search(['q' => 'کلیه'], 20);
$logged = collect(DB::getQueryLog());
DB::disableQueryLog();

$plans = [];

foreach ($logged as $entry) {
    $sql = (string) $entry['query'];
    $isCritical = str_contains($sql, 'from "flashcard_states"')
        || str_contains($sql, 'from "flashcards"')
        || str_contains($sql, 'from "wiki_articles"');

    if (! $isCritical) {
        continue;
    }

    try {
        $lines = DB::select('EXPLAIN (ANALYZE, BUFFERS) '.$sql, $entry['bindings']);
        $plans[] = [
            'sql' => preg_replace('/\s+/', ' ', mb_substr($sql, 0, 110)),
            'text' => collect($lines)->map(fn ($row) => (string) (is_object($row) ? ($row->{'QUERY PLAN'} ?? '') : ''))->all(),
        ];
    } catch (Throwable $e) {
        $plans[] = ['sql' => preg_replace('/\s+/', ' ', mb_substr($sql, 0, 110)), 'text' => ['EXPLAIN رد شد: '.mb_substr($e->getMessage(), 0, 90)]];
    }
}

/* ── ۴) گزارش ── */

echo "── دادهٔ ساختگی (seed {$seedSeconds}s) ──\n";

foreach ($counts as $name => $count) {
    echo str_pad((string) $count, 8), "  {$name}\n";
}

echo "\n── زمان اجرا (ms) — {$me->phone}، PG موقت ──\n";
echo str_pad('عملیات', 34), str_pad('mean', 8), str_pad('p95', 8), str_pad('min', 8), "max\n";

foreach ($rows as $row) {
    echo str_pad($row['label'], 34), str_pad((string) $row['mean'], 8), str_pad((string) $row['p95'], 8),
    str_pad((string) $row['min'], 8), $row['max'], "\n";
}

echo "\n── پلن‌های EXPLAIN (ANALYZE, BUFFERS) — فقط گره‌های کلیدی ──\n";

foreach ($plans as $plan) {
    echo "\n• {$plan['sql']}\n";

    foreach ($plan['text'] as $line) {
        if (preg_match('/(Seq Scan|Index Scan|Index Only|Rows Removed|Buffers:|Planning Time|Execution Time|Limit|Sort Method|actual time)/u', $line)) {
            echo '   ', trim($line), "\n";
        }
    }
}
