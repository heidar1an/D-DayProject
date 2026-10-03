<?php

namespace Tests\Feature;

use Illuminate\Foundation\Application;
use Tests\TestCase;

/** DoD فاز ۱ — «Application boots»: اپلیکیشن بدون خطا bootstrap می‌شود. */
class ApplicationBootsTest extends TestCase
{
    public function test_application_boots_with_resolved_key(): void
    {
        $this->assertInstanceOf(Application::class, $this->app);
        $this->assertNotEmpty((string) config('app.key'));
    }
}
