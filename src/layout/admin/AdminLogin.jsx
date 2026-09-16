/*
 * ورود به پنل مدیریت.
 *
 * نکات:
 *   - رمز هرگز در state ماندگار ذخیره نمی‌شود؛ فقط تا لحظهٔ ارسال.
 *   - خطاهای سرور یکسان نمایش داده می‌شوند (کاربر ناموجود / رمز اشتباه تفکیک نمی‌شود).
 *   - محدودیت تلاش ناموفق در سرور اعمال می‌شود، نه در کلاینت.
 */

import { useState } from 'react';

import { auth } from '../../services/admin/adminService';
import ThemeToggle from '../ThemeToggle';
import { Button, Field, Input } from './adminShared';
import { IconLock, IconShield, IconUser } from './adminIcons';

export default function AdminLogin({ onSuccess }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.username.trim() || !form.password) {
      setError('نام کاربری و رمز عبور را وارد کنید.');
      return;
    }

    setBusy(true);
    try {
      const admin = await auth.login({ username: form.username.trim(), password: form.password });
      setForm({ username: '', password: '' });
      onSuccess?.(admin);
    } catch (loginError) {
      setError(loginError.message || 'ورود ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-login">
      <div className="ad-login__backdrop" aria-hidden="true" />

      <form className="ad-login__card" onSubmit={submit}>
        <ThemeToggle className="ad-login__theme" />

        <header className="ad-login__head">
          <span className="ad-login__mark" aria-hidden="true">
            <IconShield width={26} height={26} />
          </span>
          <h1>پنل مدیریت تپش</h1>
          <p>برای مدیریت محتوای سایت وارد شوید</p>
        </header>

        <Field label="نام کاربری" required>
          <span className="ad-inputicon">
            <IconUser width={16} height={16} />
            <Input
              value={form.username}
              onChange={update('username')}
              autoComplete="username"
              dir="ltr"
              autoFocus
              placeholder="نام کاربری"
            />
          </span>
        </Field>

        <Field label="رمز عبور" required>
          <span className="ad-inputicon">
            <IconLock width={16} height={16} />
            <Input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={update('password')}
              autoComplete="current-password"
              dir="ltr"
              placeholder="••••••"
            />
            <button
              type="button"
              className="ad-inputicon__toggle"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
            >
              {showPassword ? 'پنهان' : 'نمایش'}
            </button>
          </span>
        </Field>

        {error ? <p className="ad-login__error" role="alert">{error}</p> : null}

        <Button type="submit" loading={busy} className="ad-login__submit">
          {busy ? 'در حال ورود…' : 'ورود به پنل'}
        </Button>

        <p className="ad-login__note">
          اطلاعات ورود از متغیرهای محیطی <code>TAPESH_ADMIN_USERNAME</code> و{' '}
          <code>TAPESH_ADMIN_PASSWORD</code> خوانده می‌شود.
        </p>
      </form>
    </div>
  );
}
