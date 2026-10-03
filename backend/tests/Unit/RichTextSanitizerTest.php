<?php

namespace Tests\Unit;

use App\Support\Content\RichTextSanitizer;
use Tests\TestCase;

/**
 * پاک‌ساز HTML — فاز ۹ و ۱۰.
 *
 * چرا whitelist: فهرست «چیزهای خطرناک» تمام‌شدنی نیست. این تست‌ها همان
 * سناریوهایی هستند که در مرورگر واقعی اجرا می‌شوند و باید **بی‌اثر** شوند،
 * به‌علاوهٔ قاعدهٔ «متن کاربر بی‌صدا حذف نشود».
 *
 * این تست روی خروجی **واقعیِ اندازه‌گیری‌شده** نوشته شده، نه روی حدس.
 */
class RichTextSanitizerTest extends TestCase
{
    private RichTextSanitizer $sanitizer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sanitizer = new RichTextSanitizer;
    }

    private function rich(string $html): ?string
    {
        return $this->sanitizer->sanitize($html, 'rich');
    }

    private function inline(string $html): ?string
    {
        return $this->sanitizer->sanitize($html, 'inline');
    }

    // ── تگ‌های خطرناک ───────────────────────────────────────────────────

    public function test_script_is_removed_with_its_whole_content(): void
    {
        $this->assertSame('سلام', $this->rich('<script>alert(1)</script>سلام'));
        $this->assertSame('سلام', $this->inline('<script>alert(1)</script>سلام'));
    }

    public function test_an_inline_script_inside_a_paragraph_is_removed_and_the_text_survives(): void
    {
        $this->assertSame('<p>ab</p>', $this->rich('<p>a<script>x</script>b</p>'));
    }

    public function test_iframe_svg_and_style_are_removed(): void
    {
        $this->assertSame('ok', $this->rich('<iframe src="https://evil.example"></iframe>ok'));
        $this->assertSame('ok', $this->rich('<svg><animate onbegin="alert(1)"></animate></svg>ok'));
        $this->assertSame('ok', $this->rich('<style>body{}</style>ok'));
    }

    public function test_form_and_input_are_removed_but_surrounding_text_survives(): void
    {
        $this->assertSame('tail', $this->rich('<form action="/x"><input name="a"></form>tail'));
    }

    public function test_html_comments_are_removed(): void
    {
        $this->assertSame('ok', $this->rich('<!-- secret -->ok'));
    }

    // ── صفت‌های رویدادی و style ─────────────────────────────────────────

    public function test_event_handler_attributes_are_removed(): void
    {
        $this->assertSame('<p>متن</p>', $this->rich('<p onclick="x()">متن</p>'));
        $this->assertSame('<img src="/a.png">', $this->rich('<img src="/a.png" onerror="alert(1)">'));
    }

    public function test_the_style_attribute_is_removed(): void
    {
        $this->assertSame('<div>x</div>', $this->rich('<div style="color:red">x</div>'));
    }

    // ── URL ─────────────────────────────────────────────────────────────

    public function test_a_javascript_url_is_stripped_from_href(): void
    {
        $this->assertSame('<a>x</a>', $this->rich('<a href="javascript:alert(1)">x</a>'));
    }

    public function test_a_javascript_url_split_by_a_newline_is_still_stripped(): void
    {
        $this->assertSame('<a>x</a>', $this->rich("<a href=\"java\nscript:alert(1)\">x</a>"));
    }

    public function test_a_data_url_is_stripped_from_src(): void
    {
        $this->assertSame('<img>', $this->rich('<img src="data:image/svg+xml;base64,AAA">'));
    }

    public function test_safe_urls_are_preserved(): void
    {
        $this->assertSame('<a href="/wiki/a">x</a>', $this->rich('<a href="/wiki/a">x</a>'));
        $this->assertSame('<a href="mailto:a@b.c">x</a>', $this->rich('<a href="mailto:a@b.c">x</a>'));
        $this->assertSame(
            '<img src="https://x.example/a.png" alt="ب">',
            $this->rich('<img src="https://x.example/a.png" alt="ب">'),
        );
    }

    public function test_a_blank_target_gets_a_noopener_rel(): void
    {
        $this->assertSame(
            '<a href="https://x.example" target="_blank" rel="noopener noreferrer">x</a>',
            $this->rich('<a href="https://x.example" target="_blank">x</a>'),
        );
    }

    public function test_an_unknown_target_value_is_removed(): void
    {
        $this->assertSame('<a href="/a">x</a>', $this->rich('<a href="/a" target="_parent">x</a>'));
    }

    // ── متن نباید بی‌صدا حذف شود ────────────────────────────────────────

    public function test_a_stray_less_than_sign_is_escaped_and_not_dropped(): void
    {
        $this->assertSame('a &lt; b', $this->rich('a < b'));
        $this->assertSame('a &lt; b', $this->inline('a < b'));
    }

    public function test_an_unknown_tag_is_escaped_so_the_text_stays_visible(): void
    {
        $this->assertSame('&lt;foo>bar&lt;/foo>', $this->rich('<foo>bar</foo>'));
    }

    public function test_persian_text_survives_sanitization_unchanged(): void
    {
        $this->assertSame('<p>کلیه و مغز</p>', $this->rich('<p>کلیه و مغز</p>'));
    }

    // ── مجازها ──────────────────────────────────────────────────────────

    public function test_allowed_formatting_tags_survive_in_both_profiles(): void
    {
        $this->assertSame('<b>پررنگ</b>', $this->rich('<b>پررنگ</b>'));
        $this->assertSame('<b>پررنگ</b>', $this->inline('<b>پررنگ</b>'));
    }

    public function test_rich_tags_survive_in_the_rich_profile(): void
    {
        $this->assertSame('<h2>عنوان</h2>', $this->rich('<h2>عنوان</h2>'));
        $this->assertSame('<ul><li>یک</li></ul>', $this->rich('<ul><li>یک</li></ul>'));
    }

    public function test_rich_tags_are_escaped_in_the_inline_profile(): void
    {
        /*
         * کارت فلش‌کارت پروفایل `inline` دارد. `<p>` مجاز نیست، پس نه حذف
         * می‌شود و نه اجرا — به متن دیده‌شدنی تبدیل می‌شود. حذف بی‌صدا ممنوع
         * است، چون متن کاربر است.
         */
        $this->assertSame('&lt;p>متن&lt;/p>', $this->inline('<p>متن</p>'));
        $this->assertSame('&lt;h2>عنوان&lt;/h2>', $this->inline('<h2>عنوان</h2>'));
    }

    // ── متن ساده ────────────────────────────────────────────────────────

    public function test_plain_text_strips_tags_and_collapses_whitespace(): void
    {
        $this->assertSame('a b', $this->sanitizer->toPlainText('<b>a</b>  <i>b</i>'));
        $this->assertSame('alert(1)متن', $this->sanitizer->toPlainText('<script>alert(1)</script>متن'));
        $this->assertNull($this->sanitizer->toPlainText(null));
    }

    // ── مسیرهای سریع و null ─────────────────────────────────────────────

    public function test_null_input_returns_null(): void
    {
        $this->assertNull($this->sanitizer->sanitize(null));
    }

    public function test_plain_text_without_markup_is_returned_untouched(): void
    {
        $this->assertSame('متن ساده', $this->sanitizer->sanitize('متن ساده'));
    }

    public function test_an_empty_string_stays_empty(): void
    {
        $this->assertSame('', (string) $this->sanitizer->sanitize(''));
    }
}
