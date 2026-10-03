<?php

/*
 * پیکربندی گراف دانش — فاز ۱۲.
 *
 * ⚠️ همهٔ اعداد «سقف محافظتی/پیش‌فرض پیشنهادی» هستند و با benchmark واقعی
 * (تست کارایی فاز ۱۲: ۲۰۰ نود / ۵۰۰ یال) صحت‌سنجی شده‌اند؛ اگر مقیاس داده
 * عوض شد، اول اندازه‌گیری، بعد تغییر.
 *
 * مرز دامنه: Knowledge Graph دامنه‌ای **مستقل از ویکی** است و فقط یک reference
 * اختیاری به `wiki_articles` دارد (§1/§17). مالکیت مقاله همیشه با ویکی است.
 *
 * هیچ چیز AI/Vector/Neo4j/Elasticsearch در این فاز نیست — گراف دیتابیس‌محور و
 * deterministic است.
 */

return [

    'nodes' => [
        'label_max' => (int) env('KNOWLEDGE_LABEL_MAX', 240),
        'statuses' => ['draft', 'published', 'archived'],
        /*
         * انواع نود — **allowlist**. مقادیر عیناً از `NODE_TYPES` در
         * `src/services/knowledge/graphData.js` استخراج شده‌اند. نوع تازه فقط
         * با مصرف‌کنندهٔ واقعی اضافه می‌شود، نه «برای آینده».
         */
        'kinds' => [
            'disease',
            'concept',
            'anatomy',
            'process',
            'pathway',
            'drug',
            'cell',
            'molecule',
            'microorganism',
            'finding',
            'labTest',
        ],
    ],

    'edges' => [
        /*
         * نوع رابطه — **allowlist**. مقادیر عیناً از `RELATION_TYPES` در
         * `src/services/knowledge/graphData.js` استخراج شده‌اند (۱۵ نوع با
         * برچسب فارسی در فرانت). یال جهت‌دار است؛ معکوسِ معنایی (causes/
         * caused_by) فقط با دادهٔ واقعی اضافه می‌شود.
         */
        'relation_types' => [
            'part_of',
            'contains',
            'located_in',
            'produces',
            'regulates',
            'activates',
            'inhibits',
            'causes',
            'leads_to',
            'associated_with',
            'participates_in',
            'targets',
            'treated_by',
            'measured_by',
            'related_to',
        ],
        'max_weight' => (float) env('KNOWLEDGE_MAX_WEIGHT', 100),
    ],

    /*
     * سقف‌های traversal — بخشی از قرارداد امنیتی (§21/§33). کلاینت هرگز
     * `depth=999999` یا گراف بی‌کران نمی‌گیرد.
     */
    'graph' => [
        'max_depth' => (int) env('KNOWLEDGE_MAX_DEPTH', 3),
        'default_depth' => (int) env('KNOWLEDGE_DEFAULT_DEPTH', 2),
        'max_nodes' => (int) env('KNOWLEDGE_MAX_NODES', 200),
        'max_edges' => (int) env('KNOWLEDGE_MAX_EDGES', 500),
        /*
         * ترتیب قطع‌کردن گراف وقتی از سقف رد می‌شود: BFS قطعی است (ترتیب
         * درج یال‌ها) و بدون ترتیب، هر رفرش زیرگراف متفاوت می‌داد.
         */
        'node_order' => ['created_at', 'id'],
    ],

    'rate_limits' => [
        'read' => ['max' => (int) env('RATE_KNOWLEDGE_READ_MAX', 240), 'decay_minutes' => (int) env('RATE_KNOWLEDGE_READ_DECAY', 1)],
        'admin' => ['max' => (int) env('RATE_ADMIN_KNOWLEDGE_MAX', 180), 'decay_minutes' => (int) env('RATE_ADMIN_KNOWLEDGE_DECAY', 1)],
    ],

    /*
     * کش گراف عمومی. کلید شامل نسخهٔ جهانی گراف + همهٔ پارامترهای مؤثر است
     * (§34)؛ هیچ دادهٔ کاربر در آن نمی‌رود. هر mutation نسخه را bump می‌کند ⇒
     * invalidate فوری، و TTL سقف مطلق کهنگی است.
     */
    'cache' => [
        'ttl_seconds' => (int) env('KNOWLEDGE_GRAPH_TTL', 60),
    ],

];
