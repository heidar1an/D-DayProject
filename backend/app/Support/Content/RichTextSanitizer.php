<?php

namespace App\Support\Content;

/**
 * پاک‌ساز HTML مبتنی بر **whitelist** — مشترک فاز ۹ (کارت) و فاز ۱۰ (مقاله).
 *
 * چرا whitelist و نه blacklist: فهرست «چیزهای خطرناک» تمام‌شدنی نیست
 * (`<svg><animate onbegin>`, `<math><mtext>`, `srcdoc`, `xlink:href` …). اینجا
 * فقط چیزی می‌ماند که **صریحاً مجاز** است؛ هر چیز دیگر حذف یا بی‌اثر می‌شود.
 *
 * قواعد:
 *   • تگ‌های مجاز بر اساس «پروفایل» تعیین می‌شوند: `inline` برای کارت
 *     (قالب‌بندی سبک) و `rich` برای مقاله (سرتیتر، جدول، تصویر، نقل‌قول).
 *   • تگ‌های خطرناک (`script`, `style`, `iframe`, `object`, `embed`, `form`,
 *     `input`, `svg`, `math`, `link`, `meta`, `base`, `template`, `noscript`)
 *     با **کل محتوایشان** حذف می‌شوند.
 *   • هر `on*` حذف می‌شود. `style` حذف می‌شود (CSS می‌تواند URL اجرایی بسازد).
 *   • `href`/`src` فقط با scheme مجاز: `http`, `https`, `mailto`, `tel` یا
 *     مسیر نسبی. `javascript:`, `data:`, `vbscript:`, `blob:`, `file:` رد
 *     می‌شوند — شامل حالت‌های آمیخته با فاصله/نویسهٔ کنترلی.
 *   • `<` سرگردان (مثل `a < b`) به `&lt;` تبدیل می‌شود و **هرگز** حذف نمی‌شود؛
 *     متن کاربر نباید بی‌صدا از بین برود. اگر شناسهٔ بعد از `<` در فهرست تگ‌های
 *     شناخته‌شده نباشد، خودِ `<` escape می‌شود.
 *   • خروجی UTF-8 خام است (نه entity) تا جست‌وجوی متنی روی آن ممکن بماند.
 *
 * تنها نویسندهٔ محتوای ذخیره‌شده در دامنه‌های Flashcards/Wiki این کلاس است.
 */
class RichTextSanitizer
{
    /** تگ‌هایی که با کل محتوایشان حذف می‌شوند. */
    private const DROPPED_TAGS = [
        'script', 'style', 'iframe', 'object', 'embed', 'applet', 'form', 'input',
        'button', 'select', 'textarea', 'option', 'svg', 'math', 'link', 'meta',
        'base', 'template', 'noscript', 'frame', 'frameset', 'audio', 'video', 'source',
    ];

    private const INLINE_TAGS = ['b', 'strong', 'i', 'em', 'u', 's', 'del', 'ins', 'sub', 'sup', 'br', 'span', 'code', 'mark', 'small'];

    private const RICH_TAGS = [
        'p', 'div', 'br', 'hr', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'ins',
        'sub', 'sup', 'code', 'pre', 'mark', 'small', 'blockquote',
        'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'a', 'img', 'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
    ];

    private const VOID_TAGS = ['br', 'hr', 'img'];

    /** @var array<string, list<string>> */
    private const ALLOWED_ATTRIBUTES = [
        'a' => ['href', 'title', 'target', 'rel'],
        'img' => ['src', 'alt', 'title', 'width', 'height', 'loading'],
        'ol' => ['start', 'type'],
        'td' => ['colspan', 'rowspan'],
        'th' => ['colspan', 'rowspan', 'scope'],
        'blockquote' => ['cite'],
    ];

    /**
     * @param  'inline'|'rich'  $profile
     */
    public function sanitize(?string $html, string $profile = 'rich'): ?string
    {
        if ($html === null) {
            return null;
        }

        $allowed = $profile === 'inline' ? self::INLINE_TAGS : self::RICH_TAGS;

        // مسیر سریع: بدون `<` هیچ چیزی برای پارس‌کردن نیست.
        if (! str_contains($html, '<')) {
            return $html;
        }

        $html = $this->escapeStrayAngles($html, $allowed);

        if (! str_contains($html, '<')) {
            return $html;
        }

        if (! class_exists(\DOMDocument::class)) {
            // بدون DOM هیچ پاک‌سازی قابل‌اعتمادی وجود ندارد ⇒ fail closed.
            return $this->stripAllTags($html);
        }

        return $this->sanitizeWithDom($html, $allowed);
    }

    /** متن ساده: همهٔ تگ‌ها حذف و کاراکترهای خاص escape می‌شوند. */
    public function toPlainText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return $this->stripAllTags($value);
    }

    private function stripAllTags(string $value): string
    {
        $text = strip_tags($value);
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return trim($text);
    }

    /**
     * `<` سرگردان ⇒ `&lt;`.
     *
     * قاعده: `<` فقط وقتی تگ حساب می‌شود که بعد از آن (با `/` اختیاری) یک شناسهٔ
     * **شناخته‌شده** بیاید. `a < b` و `<foo>` هر دو escape می‌شوند؛ `<p>` و
     * `</p>` نه.
     *
     * @param  list<string>  $allowed
     */
    private function escapeStrayAngles(string $html, array $allowed): string
    {
        $known = array_flip([...$allowed, ...self::DROPPED_TAGS]);

        // ۱) `<` که بعدش حرف/اسلش/علامت تعجب نیست ⇒ قطعاً متن است.
        $html = preg_replace('/<(?![a-zA-Z\/!])/u', '&lt;', $html) ?? $html;

        // ۲) `<` که شناسهٔ بعدش تگ شناخته‌شده نیست ⇒ متن است.
        return preg_replace_callback(
            '/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)/u',
            static function (array $m) use ($known): string {
                return isset($known[strtolower($m[1])]) ? $m[0] : '&lt;'.substr($m[0], 1);
            },
            $html,
        ) ?? $html;
    }

    /** @param list<string> $allowed */
    private function sanitizeWithDom(string $html, array $allowed): string
    {
        $previous = libxml_use_internal_errors(true);

        try {
            $dom = new \DOMDocument('1.0', 'UTF-8');
            $loaded = $dom->loadHTML(
                '<?xml encoding="UTF-8">'.'<div id="__tapesh_root__">'.$html.'</div>',
                LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING,
            );

            if ($loaded === false) {
                return $this->stripAllTags($html);
            }

            $root = (new \DOMXPath($dom))->query('//div[@id="__tapesh_root__"]')->item(0);

            if (! $root instanceof \DOMElement) {
                return $this->stripAllTags($html);
            }

            $this->cleanChildren($root, $allowed);

            $out = '';

            foreach ($root->childNodes as $child) {
                $out .= $dom->saveHTML($child);
            }

            return trim($out);
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }

    /** @param list<string> $allowed */
    private function cleanChildren(\DOMNode $node, array $allowed): void
    {
        // از آخر به اول: حذف/جابه‌جایی، ایندکس فرزندان بعدی را به‌هم نمی‌زند.
        for ($i = $node->childNodes->length - 1; $i >= 0; $i--) {
            $child = $node->childNodes->item($i);

            if ($child === null) {
                continue;
            }

            if ($child instanceof \DOMComment || $child instanceof \DOMProcessingInstruction) {
                $node->removeChild($child);

                continue;
            }

            if (! $child instanceof \DOMElement) {
                continue;
            }

            $tag = strtolower($child->nodeName);

            if (in_array($tag, self::DROPPED_TAGS, true)) {
                // کل زیردرخت می‌رود؛ محتوای script/style هرگز «متن» نیست.
                $node->removeChild($child);

                continue;
            }

            if (! in_array($tag, $allowed, true)) {
                // تگ ناشناخته: حذف می‌شود ولی فرزندانش **حفظ** می‌شوند.
                $this->unwrap($child);

                continue;
            }

            $this->cleanAttributes($child, $tag);
            $this->cleanChildren($child, $allowed);
        }
    }

    private function unwrap(\DOMElement $element): void
    {
        $parent = $element->parentNode;

        if ($parent === null) {
            return;
        }

        while ($element->firstChild !== null) {
            $parent->insertBefore($element->firstChild, $element);
        }

        $parent->removeChild($element);
    }

    private function cleanAttributes(\DOMElement $element, string $tag): void
    {
        $allowedForTag = self::ALLOWED_ATTRIBUTES[$tag] ?? [];

        for ($i = $element->attributes->length - 1; $i >= 0; $i--) {
            $attribute = $element->attributes->item($i);

            if ($attribute === null) {
                continue;
            }

            $name = strtolower($attribute->nodeName);

            // هر on*، style و data-*/aria-* ناشناخته حذف می‌شود.
            if (! in_array($name, $allowedForTag, true)) {
                $element->removeAttribute($attribute->nodeName);

                continue;
            }

            if (in_array($name, ['href', 'src'], true) && ! $this->isSafeUrl($attribute->nodeValue ?? '')) {
                $element->removeAttribute($attribute->nodeName);
            }
        }

        if ($tag === 'a' && $element->hasAttribute('href')) {
            $target = $element->getAttribute('target');

            if ($target !== '' && ! in_array($target, ['_blank', '_self'], true)) {
                $element->removeAttribute('target');
                $target = '';
            }

            // لینک بیرونی هرگز دسترسی به window.opener نمی‌دهد.
            if ($target === '_blank') {
                $element->setAttribute('rel', 'noopener noreferrer');
            }
        }
    }

    /**
     * scheme مجاز؟ نویسه‌های کنترلی و فاصله حذف می‌شوند تا
     * `java\nscript:` یا `j a v a s c r i p t:` دور نزنند.
     */
    private function isSafeUrl(string $url): bool
    {
        $normalized = strtolower(preg_replace('/[\x00-\x20\x7f]/', '', $url) ?? '');

        if ($normalized === '') {
            return false;
        }

        if (str_starts_with($normalized, '//')) {
            // protocol-relative ⇒ به https محدود می‌شود، ولی خودِ URL مجاز است.
            return true;
        }

        if (preg_match('/^[a-z][a-z0-9+.\-]*:/', $normalized, $m) === 1) {
            return in_array(rtrim($m[0], ':'), ['http', 'https', 'mailto', 'tel'], true);
        }

        // نسبی: `/path`, `#anchor`, `page.html` — همه مجاز.
        return true;
    }
}
