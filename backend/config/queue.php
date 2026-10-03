<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Queue Connection Name
    |--------------------------------------------------------------------------
    |
    | Laravel's queue supports a variety of backends via a single, unified
    | API, giving you convenient access to each backend using identical
    | syntax for each. The default queue connection is defined below.
    |
    */

    'default' => env('QUEUE_CONNECTION', 'database'),

    /*
    |--------------------------------------------------------------------------
    | Tapesh — نام صف‌ها و سیاست اجرا (فاز ۱۹)
    |--------------------------------------------------------------------------
    |
    | چرا جدا از `connections`: «کدام صف» و «با چه سیاستی» تصمیم محصول است، نه
    | جزئیات درایور. هیچ عددی اینجا hardcode نیست (§6) و هر Job از این بلوک
    | `tries`/`backoff`/`timeout`/`queue` خودش را می‌خواند.
    |
    | جداسازی صف ⇒ isolation، observability و throughput کنترل‌شده (§7):
    |   notifications  اعلان (کاربر-محور، تابع Provider بیرونی)
    |   search         ایندکس‌گذاری/حذف ایندکس
    |   outbox         انتشار رخداد ثبت‌شده
    |   default        بقیهٔ Side Effectهای امن
    */

    'tapesh' => [

        'queues' => [
            'default' => env('QUEUE_NAME_DEFAULT', 'default'),
            'notifications' => env('QUEUE_NAME_NOTIFICATIONS', 'notifications'),
            'search' => env('QUEUE_NAME_SEARCH', 'search'),
            'outbox' => env('QUEUE_NAME_OUTBOX', 'outbox'),
        ],

        /*
         * سیاست پیش‌فرض هر صف. retry محدود و backoff نمایی؛ «retry بی‌نهایت
         * ممنوع» (§9). مقادیر per-job می‌توانند از config دامنه بیایند و این
         * فقط fallback است.
         */
        'policy' => [
            'default' => ['tries' => (int) env('QUEUE_TRIES_DEFAULT', 3), 'backoff' => [10, 60, 300], 'timeout' => (int) env('QUEUE_TIMEOUT_DEFAULT', 60)],
            'notifications' => ['tries' => (int) env('QUEUE_TRIES_NOTIFICATIONS', 3), 'backoff' => [30, 120, 600], 'timeout' => (int) env('QUEUE_TIMEOUT_NOTIFICATIONS', 20)],
            'search' => ['tries' => (int) env('QUEUE_TRIES_SEARCH', 3), 'backoff' => [15, 60, 300], 'timeout' => (int) env('QUEUE_TIMEOUT_SEARCH', 30)],
            'outbox' => ['tries' => (int) env('QUEUE_TRIES_OUTBOX', 3), 'backoff' => [30, 120, 600], 'timeout' => (int) env('QUEUE_TIMEOUT_OUTBOX', 30)],
        ],

        /*
         * Dead letter: Jobهای شکست‌خورده در جدول `failed_jobs` لاراول می‌مانند و
         * از پنل (`GET /admin/queue/failed`) با metadata امن دیده می‌شوند (§10).
         * هیچ payload حساسی آنجا نوشته نمی‌شود چون Job فقط شناسه حمل می‌کند (§8).
         */
        'dead_letter' => [
            'table' => 'failed_jobs',
            'retention_days' => (int) env('QUEUE_FAILED_RETENTION_DAYS', 30),
            'prune_batch' => (int) env('QUEUE_FAILED_PRUNE_BATCH', 200),
        ],

        /* Worker: غیر root، bounded، graceful (مقدار در docs/ops توضیح داده شده). */
        'worker' => [
            'sleep_seconds' => (int) env('QUEUE_WORKER_SLEEP', 1),
            'max_time_seconds' => (int) env('QUEUE_WORKER_MAX_TIME', 3600),
            'memory_mb' => (int) env('QUEUE_WORKER_MEMORY', 256),
            'timeout_grace_seconds' => (int) env('QUEUE_WORKER_GRACE', 5),
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Queue Connections
    |--------------------------------------------------------------------------
    |
    | Here you may configure the connection options for every queue backend
    | used by your application. An example configuration is provided for
    | each backend supported by Laravel. You're also free to add more.
    |
    | Drivers: "sync", "database", "beanstalkd", "sqs", "redis",
    |          "deferred", "background", "failover", "null"
    |
    */

    'connections' => [

        'sync' => [
            'driver' => 'sync',
        ],

        'database' => [
            'driver' => 'database',
            'connection' => env('DB_QUEUE_CONNECTION'),
            'table' => env('DB_QUEUE_TABLE', 'jobs'),
            'queue' => env('DB_QUEUE', 'default'),
            'retry_after' => (int) env('DB_QUEUE_RETRY_AFTER', 90),
            'after_commit' => false,
        ],

        'beanstalkd' => [
            'driver' => 'beanstalkd',
            'host' => env('BEANSTALKD_QUEUE_HOST', 'localhost'),
            'queue' => env('BEANSTALKD_QUEUE', 'default'),
            'retry_after' => (int) env('BEANSTALKD_QUEUE_RETRY_AFTER', 90),
            'block_for' => 0,
            'after_commit' => false,
        ],

        'sqs' => [
            'driver' => 'sqs',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'prefix' => env('SQS_PREFIX', 'https://sqs.us-east-1.amazonaws.com/your-account-id'),
            'queue' => env('SQS_QUEUE', 'default'),
            'suffix' => env('SQS_SUFFIX'),
            'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
            'after_commit' => false,
        ],

        'redis' => [
            'driver' => 'redis',
            'connection' => env('REDIS_QUEUE_CONNECTION', 'default'),
            'queue' => env('REDIS_QUEUE', 'default'),
            'retry_after' => (int) env('REDIS_QUEUE_RETRY_AFTER', 90),
            'block_for' => null,
            'after_commit' => false,
        ],

        'deferred' => [
            'driver' => 'deferred',
        ],

        'background' => [
            'driver' => 'background',
        ],

        'failover' => [
            'driver' => 'failover',
            'connections' => [
                'database',
                'deferred',
            ],
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Job Batching
    |--------------------------------------------------------------------------
    |
    | The following options configure the database and table that store job
    | batching information. These options can be updated to any database
    | connection and table which has been defined by your application.
    |
    */

    'batching' => [
        'database' => env('DB_CONNECTION', 'sqlite'),
        'table' => 'job_batches',
    ],

    /*
    |--------------------------------------------------------------------------
    | Failed Queue Jobs
    |--------------------------------------------------------------------------
    |
    | These options configure the behavior of failed queue job logging so you
    | can control how and where failed jobs are stored. Laravel ships with
    | support for storing failed jobs in a simple file or in a database.
    |
    | Supported drivers: "database-uuids", "dynamodb", "file", "null"
    |
    */

    'failed' => [
        'driver' => env('QUEUE_FAILED_DRIVER', 'database-uuids'),
        'database' => env('DB_CONNECTION', 'sqlite'),
        'table' => 'failed_jobs',
    ],

];
