<?php

namespace App\Http\Requests\Media\Admin;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;

/**
 * آپلود Media از پنل — فاز ۱۵ (§11).
 *
 * مصرف‌کنندهٔ واقعی آپلود در این فاز پنل محتواست (Reference/Anatomy assets)؛
 * آپلود دانشجو مصرف‌کننده ندارد و ساخته نشد (قاعدهٔ «endpoint بدون مصرف‌کننده»).
 * سقف حجم از config خوانده می‌شود، نه عدد ثابت (§7).
 */
final class StoreMediaRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(['visibility']);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $maxImage = (int) config('media.kinds.image.max_bytes');
        $maxDocument = (int) config('media.kinds.document.max_bytes');
        $maxVideo = (int) config('media.kinds.video.max_bytes');
        $maxModel = (int) config('media.kinds.model3d.max_bytes');

        return [
            'file' => ['required', 'file', 'max:'.(int) ceil(max($maxImage, $maxDocument, $maxVideo, $maxModel) / 1024)],
            'visibility' => ['nullable', Rule::in(['public', 'private'])],
        ];
    }

    public function fileUpload(): UploadedFile
    {
        /** @var UploadedFile */
        return $this->file('file');
    }
}
