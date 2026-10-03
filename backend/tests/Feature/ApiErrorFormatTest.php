<?php

namespace Tests\Feature;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

/**
 * DoD فاز ۱ — «API error format درست است» و «production secret/stack trace
 * leak نمی‌کند». مسیرهای _test/* فقط fixture آزمون‌اند و در production
 * ثبت نمی‌شوند (اینجا در هر تست ساخته و با app تازه دور ریخته می‌شوند).
 */
class ApiErrorFormatTest extends TestCase
{
    private string $formRequestClass;

    protected function setUp(): void
    {
        parent::setUp();

        $this->formRequestClass = get_class(new class extends ApiFormRequest
        {
            public function rules(): array
            {
                return ['amount' => ['required', 'integer', 'min:1']];
            }
        });

        Route::post('/api/v1/_test/validation', function () {
            $form = $this->formRequestClass::createFrom(request());
            $form->setContainer($this->app);
            $form->validateResolved();

            return response()->json(['data' => 'ok']);
        });

        Route::post('/api/v1/_test/failure', function () {
            throw new RuntimeException('internal-secret-db-credentials');
        });
    }

    public function test_unknown_api_route_returns_standard_404_envelope(): void
    {
        $response = $this->getJson('/api/v1/does-not-exist');

        $response->assertStatus(404);
        $this->assertSame('NOT_FOUND', $response->json('error.code'));
        $this->assertNotSame('', (string) $response->json('error.message'));
        $this->assertSame([], $response->json('error.fields'));
        $this->assertSame(
            $response->headers->get('X-Request-Id'),
            $response->json('requestId'),
        );

        $content = $response->getContent();
        $this->assertStringNotContainsString('trace', $content);
        $this->assertStringNotContainsString('exception', $content);
    }

    public function test_validation_failure_returns_422_with_field_errors(): void
    {
        $response = $this->postJson('/api/v1/_test/validation', ['amount' => 'not-a-number']);

        $response->assertStatus(422);
        $this->assertSame('VALIDATION_FAILED', $response->json('error.code'));
        $this->assertSame('The given data was invalid.', $response->json('error.message'));
        $this->assertNotEmpty($response->json('error.fields.amount'));
        $this->assertSame(
            $response->headers->get('X-Request-Id'),
            $response->json('requestId'),
        );
    }

    public function test_server_error_never_leaks_internals(): void
    {
        config(['app.debug' => false, 'app.env' => 'production']);

        $response = $this->postJson('/api/v1/_test/failure');

        $response->assertStatus(500);
        $this->assertSame('INTERNAL_ERROR', $response->json('error.code'));
        $this->assertSame('Internal server error.', $response->json('error.message'));

        $content = $response->getContent();
        $this->assertStringNotContainsString('internal-secret-db-credentials', $content);
        $this->assertStringNotContainsString('RuntimeException', $content);
        $this->assertStringNotContainsString('stack', $content);
        $this->assertStringNotContainsString('vendor/', $content);
    }

    public function test_method_not_allowed_maps_to_405_envelope(): void
    {
        $response = $this->postJson('/api/v1/healthz');

        $response->assertStatus(405);
        $this->assertSame('METHOD_NOT_ALLOWED', $response->json('error.code'));
    }
}
