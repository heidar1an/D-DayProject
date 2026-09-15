/*
 * حساب کاربری مدیر — نمایش اطلاعات و تغییر رمز عبور.
 * تغییر رمز در سرور با بررسی رمز فعلی انجام می‌شود و رویدادش در گزارش ثبت می‌گردد.
 */

import { useState } from 'react';

import { auth } from '../../../services/admin/adminService';
import {
  Badge, Button, Card, Field, Input, faDateTime, toFa, useToast,
} from '../adminShared';
import { IconLock, IconShield } from '../adminIcons';

export default function AdminProfile({ admin }) {
  const notify = useToast();
  const [form, setForm] = useState({ currentPassword: '', nextPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.nextPassword.length < 4) return setError('رمز عبور جدید حداقل ۴ کاراکتر باشد.');
    if (form.nextPassword !== form.confirmPassword) return setError('تکرار رمز عبور مطابقت ندارد.');

    setBusy(true);
    try {
      await auth.changePassword({ currentPassword: form.currentPassword, nextPassword: form.nextPassword });
      setForm({ currentPassword: '', nextPassword: '', confirmPassword: '' });
      notify('رمز عبور با موفقیت تغییر کرد');
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy(false);
    }

    return undefined;
  };

  return (
    <div className="ad-stack ad-stack--narrow">
      <Card title="اطلاعات حساب">
        <dl className="ad-deflist">
          <div><dt>نام کاربری</dt><dd dir="ltr">{admin.username}</dd></div>
          <div><dt>نام نمایشی</dt><dd>{admin.name || '—'}</dd></div>
          <div><dt>ایمیل</dt><dd dir="ltr">{admin.email || '—'}</dd></div>
          <div><dt>نقش</dt><dd><Badge tone="published">{admin.roleLabel}</Badge></dd></div>
          <div><dt>آخرین ورود</dt><dd>{faDateTime(admin.lastLoginAt)}</dd></div>
          <div><dt>تعداد دسترسی</dt><dd>{toFa(admin.permissions?.length ?? 0)} مورد</dd></div>
        </dl>

        {admin.mustChangePassword ? (
          <p className="ad-warning">
            رمز عبور این حساب همان مقدار پیش‌فرض است. برای امنیت پنل، همین حالا آن را تغییر دهید.
          </p>
        ) : null}
      </Card>

      <Card
        title="تغییر رمز عبور"
        description="رمز جدید بلافاصله ذخیره می‌شود و از نشست‌های بعدی اعمال می‌گردد."
      >
        <form className="ad-form" onSubmit={submit}>
          <Field label="رمز عبور فعلی" required>
            <span className="ad-inputicon">
              <IconLock width={16} height={16} />
              <Input type="password" value={form.currentPassword} onChange={update('currentPassword')} dir="ltr" autoComplete="current-password" />
            </span>
          </Field>

          <Field label="رمز عبور جدید" required hint="حداقل ۴ کاراکتر">
            <span className="ad-inputicon">
              <IconShield width={16} height={16} />
              <Input type="password" value={form.nextPassword} onChange={update('nextPassword')} dir="ltr" autoComplete="new-password" />
            </span>
          </Field>

          <Field label="تکرار رمز عبور جدید" required>
            <Input type="password" value={form.confirmPassword} onChange={update('confirmPassword')} dir="ltr" autoComplete="new-password" />
          </Field>

          {error ? <p className="ad-login__error" role="alert">{error}</p> : null}

          <Button type="submit" loading={busy}>تغییر رمز عبور</Button>
        </form>
      </Card>

      <Card title="دسترسی‌های این نقش">
        <div className="ad-permlist">
          {(admin.permissions ?? []).map((permission) => (
            <code className="ad-code" dir="ltr" key={permission}>{permission}</code>
          ))}
        </div>
      </Card>
    </div>
  );
}
