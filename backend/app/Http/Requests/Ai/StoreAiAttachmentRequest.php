<?php

namespace App\Http\Requests\Ai;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Http\UploadedFile;

final class StoreAiAttachmentRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery([]);
    }

    public function rules(): array
    {
        return ['file' => ['required', 'file', 'max:'.(int) ceil(max((int) config('media.kinds.image.max_bytes'), (int) config('media.kinds.document.max_bytes')) / 1024)]];
    }

    public function upload(): UploadedFile
    {
        /** @var UploadedFile */
        return $this->file('file');
    }
}
