<?php

namespace App\Events\Wiki;

use Illuminate\Foundation\Events\Dispatchable;

/**
 * مقالهٔ ویکی باز شد.
 *
 * ⚠️ این رخداد **به‌تنهایی completion آموزشی نیست** (§51). یک بازدید فقط یعنی
 * «کاربر مقاله را دید»؛ هیچ XP، هیچ پیشرفت و هیچ تسلطی از آن مشتق نمی‌شود.
 * `userId` برای مهمان `null` است.
 */
class WikiArticleOpened
{
    use Dispatchable;

    public function __construct(
        public readonly string $articleId,
        public readonly ?string $userId,
        public readonly string $slug,
    ) {}
}
