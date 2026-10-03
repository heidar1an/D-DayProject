<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * نقش پنل. کلیدها **همان** کلیدهای واقعی legacy هستند:
 * `super-admin` | `admin` | `editor` (`database/contentStore.js`).
 */
class Role extends Model
{
    use HasUuids;

    public const SUPER_ADMIN = 'super-admin';

    public const ADMIN = 'admin';

    public const EDITOR = 'editor';

    protected $table = 'roles';

    /** @var list<string> */
    protected $fillable = ['key', 'name', 'description', 'is_system'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['is_system' => 'boolean'];
    }

    /** @return BelongsToMany<Permission, $this> */
    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'role_permissions')->withTimestamps();
    }

    /** @return BelongsToMany<Admin, $this> */
    public function admins(): BelongsToMany
    {
        return $this->belongsToMany(Admin::class, 'admin_roles')->withTimestamps();
    }
}
